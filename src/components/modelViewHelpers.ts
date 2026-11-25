import type { AvailableModel, PlatformId, PublicAccount } from '@/lib/types';
import {
  getAntigravityCatalog,
  getClaudeCatalogForPlan,
  getCodexCatalogForPlan,
  getDisplayQuotaItems,
  getModelDisplayLabel,
  groupModelsForDisplay,
  resolveAccountAvailableModels,
  type DisplayModelGroup,
} from '@/lib/models';
import {
  getLowestRemainingPercent,
  getSoonestResetMs,
  PLATFORM_META,
} from '@/lib/format';

export const PLATFORMS: readonly PlatformId[] = ['antigravity', 'codex', 'claude'];

export type CatalogScope = 'accounts' | 'catalog';
export type AccountSortMode = 'default' | 'lowest_quota' | 'soonest_reset' | 'name';
export type StatusFilterMode = 'all' | 'healthy' | 'low' | 'attention' | 'issue';

export interface CatalogGroupEntry {
  platform: PlatformId;
  group: DisplayModelGroup;
  primaryModelId: string;
  accountCount: number;
  bestRemainingPercent: number | null;
}

export interface ModelFilterOption {
  value: string;
  label: string;
  platform: PlatformId;
  groupKey: string;
}

export function getAccountFamilyRemainingPercent(
  account: PublicAccount,
  group: DisplayModelGroup
): number | null {
  if (account.status === 'forbidden' || account.quota?.forbidden) {
    return null;
  }

  if (group.remainingPercent !== null && Number.isFinite(group.remainingPercent)) {
    return group.remainingPercent;
  }

  const quotaItems = getDisplayQuotaItems(account).filter(
    (item) => !item.key.startsWith('apikey:')
  );
  if (quotaItems.length === 0) return null;

  if (account.platform === 'antigravity') {
    const keyLower = group.groupKey.toLowerCase();
    if (keyLower.includes('hydrogen')) {
      const hydrogenMatched = quotaItems.filter((item) =>
        `${item.key} ${item.label}`.toLowerCase().includes('hydrogen')
      );
      if (hydrogenMatched.length > 0) {
        return Math.min(...hydrogenMatched.map((item) => item.remainingPercent));
      }
    }
    const matched = quotaItems.filter((item) => {
      const text = `${item.key} ${item.label}`.toLowerCase();
      if (keyLower.includes('argon')) return text.includes('argon');
      if (group.family === 'claude') return text.includes('3p') || text.includes('claude');
      if (group.family === 'gemini') {
        return text.includes('gemini') && !text.includes('argon') && !text.includes('hydrogen');
      }
      return false;
    });
    if (matched.length === 0) return null;
    return Math.min(...matched.map((item) => item.remainingPercent));
  }

  if (account.platform === 'claude') {
    const keyLower = group.groupKey.toLowerCase();
    const matched = quotaItems.filter((item) => {
      if (item.key === 'window:7d_opus') return keyLower.includes('opus');
      if (item.key === 'window:7d_sonnet') return keyLower.includes('sonnet');
      return true;
    });
    if (matched.length === 0) return null;
    return Math.min(...matched.map((item) => item.remainingPercent));
  }

  return Math.min(...quotaItems.map((item) => item.remainingPercent));
}

function mergeAccountModelsForPlatform(accounts: PublicAccount[]): AvailableModel[] {
  const byId = new Map<string, AvailableModel>();

  for (const account of accounts) {
    const { models } = resolveAccountAvailableModels(account);
    for (const model of models) {
      const existing = byId.get(model.id);
      if (!existing) {
        byId.set(model.id, {
          ...model,
          ...(model.reasoningEfforts ? { reasoningEfforts: [...model.reasoningEfforts] } : {}),
        });
        continue;
      }

      const nextSource =
        existing.source === 'live' || model.source === 'live' ? 'live' : existing.source;
      const mergedEfforts = Array.from(
        new Set([...(existing.reasoningEfforts ?? []), ...(model.reasoningEfforts ?? [])])
      );
      const nextRemaining =
        typeof existing.remainingPercent === 'number' && Number.isFinite(existing.remainingPercent)
          ? typeof model.remainingPercent === 'number' && Number.isFinite(model.remainingPercent)
            ? Math.max(existing.remainingPercent, model.remainingPercent)
            : existing.remainingPercent
          : model.remainingPercent;

      byId.set(model.id, {
        ...existing,
        source: nextSource,
        remainingPercent: nextRemaining,
        ...(mergedEfforts.length > 0 ? { reasoningEfforts: mergedEfforts } : {}),
      });
    }
  }

  return Array.from(byId.values());
}

function getCatalogForPlatform(platform: PlatformId): AvailableModel[] {
  if (platform === 'antigravity') return getAntigravityCatalog();
  if (platform === 'codex') return getCodexCatalogForPlan('PRO');
  return getClaudeCatalogForPlan('MAX 20X');
}

export function buildCatalogGroups(
  accounts: PublicAccount[],
  scope: CatalogScope
): Record<PlatformId, CatalogGroupEntry[]> {
  const result: Record<PlatformId, CatalogGroupEntry[]> = {
    antigravity: [],
    codex: [],
    claude: [],
  };

  for (const platform of PLATFORMS) {
    const platformAccounts = accounts.filter((acc) => acc.platform === platform);
    const perAccountGroups = platformAccounts.map((account) => ({
      account,
      groups: groupModelsForDisplay(resolveAccountAvailableModels(account).models),
    }));

    const baseModels =
      scope === 'catalog'
        ? getCatalogForPlatform(platform)
        : mergeAccountModelsForPlatform(platformAccounts);

    const displayGroups = groupModelsForDisplay(baseModels);

    result[platform] = displayGroups.map((group) => {
      const groupModelIds = new Set(group.models.map((m) => m.id));
      let accountCount = 0;
      let bestRemainingPercent: number | null = null;

      for (const { account, groups } of perAccountGroups) {
        const matchedGroup = groups.find(
          (ag) =>
            ag.groupKey === group.groupKey ||
            ag.models.some((m) => groupModelIds.has(m.id))
        );
        if (!matchedGroup) continue;

        accountCount++;
        const pct = getAccountFamilyRemainingPercent(account, matchedGroup);
        if (pct !== null && Number.isFinite(pct)) {
          bestRemainingPercent =
            bestRemainingPercent === null ? pct : Math.max(bestRemainingPercent, pct);
        }
      }

      return {
        platform,
        group,
        primaryModelId: group.models[0]?.id ?? group.groupKey,
        accountCount,
        bestRemainingPercent,
      };
    });
  }

  return result;
}

export function countUniqueAccountModels(accounts: PublicAccount[]): number {
  const unique = new Set<string>();
  for (const account of accounts) {
    const { models } = resolveAccountAvailableModels(account);
    for (const model of models) {
      unique.add(`${account.platform}:${model.id}`);
    }
  }
  return unique.size;
}

export function getCanonicalGroupKeyForModelId(modelId: string): string {
  const trimmed = modelId.trim();
  if (!trimmed) return '';
  const grouped = groupModelsForDisplay([
    { id: trimmed, displayName: trimmed, family: 'other' },
  ]);
  return grouped[0]?.groupKey ?? trimmed;
}

export function accountMatchesModelFilter(
  account: PublicAccount,
  modelFilter: string
): boolean {
  if (!modelFilter || modelFilter === 'all') return true;
  const { models } = resolveAccountAvailableModels(account);
  if (models.some((m) => m.id === modelFilter)) return true;

  const targetGroupKey = getCanonicalGroupKeyForModelId(modelFilter);
  if (!targetGroupKey) return false;

  const groups = groupModelsForDisplay(models);
  return groups.some((g) => g.groupKey === targetGroupKey);
}

export function collectAccountModelFilterOptions(
  accounts: PublicAccount[],
  platformFilter: 'all' | PlatformId,
  activeModelFilter: string
): ModelFilterOption[] {
  const byKey = new Map<
    string,
    {
      value: string;
      baseLabel: string;
      platform: PlatformId;
      groupKey: string;
      memberIds: Set<string>;
    }
  >();

  for (const account of accounts) {
    if (platformFilter !== 'all' && account.platform !== platformFilter) continue;
    const groups = groupModelsForDisplay(resolveAccountAvailableModels(account).models);
    for (const group of groups) {
      const key = `${account.platform}:${group.groupKey}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          value: group.models[0]?.id ?? group.groupKey,
          baseLabel: group.label,
          platform: account.platform,
          groupKey: group.groupKey,
          memberIds: new Set(group.models.map((m) => m.id)),
        });
      } else {
        for (const m of group.models) {
          existing.memberIds.add(m.id);
        }
      }
    }
  }

  const labelCounts = new Map<string, number>();
  for (const item of byKey.values()) {
    labelCounts.set(item.baseLabel, (labelCounts.get(item.baseLabel) ?? 0) + 1);
  }

  const options: ModelFilterOption[] = Array.from(byKey.values()).map((item) => {
    const needsPlatformSuffix =
      platformFilter === 'all' && (labelCounts.get(item.baseLabel) ?? 0) > 1;
    return {
      value: item.value,
      label: needsPlatformSuffix
        ? `${item.baseLabel} (${PLATFORM_META[item.platform].label})`
        : item.baseLabel,
      platform: item.platform,
      groupKey: item.groupKey,
    };
  });

  if (
    activeModelFilter !== 'all' &&
    !options.some((opt) => opt.value === activeModelFilter)
  ) {
    const activeGroupKey = getCanonicalGroupKeyForModelId(activeModelFilter);
    const matchingItem = Array.from(byKey.values()).find(
      (item) =>
        item.memberIds.has(activeModelFilter) || item.groupKey === activeGroupKey
    );

    if (matchingItem) {
      const idx = options.findIndex(
        (opt) =>
          opt.platform === matchingItem.platform &&
          opt.groupKey === matchingItem.groupKey
      );
      if (idx !== -1) {
        options[idx] = { ...options[idx], value: activeModelFilter };
      }
    } else {
      const fallbackPlatform = platformFilter === 'all' ? 'antigravity' : platformFilter;
      const friendly = getModelDisplayLabel(
        activeModelFilter,
        platformFilter === 'all' ? undefined : platformFilter
      );
      options.unshift({
        value: activeModelFilter,
        label: friendly ?? activeModelFilter,
        platform: fallbackPlatform,
        groupKey: activeGroupKey || activeModelFilter,
      });
    }
  }

  return options;
}

export function sortAccounts(
  accounts: PublicAccount[],
  sortMode: AccountSortMode
): PublicAccount[] {
  if (sortMode === 'default') return accounts;

  const copy = [...accounts];
  const compareName = (a: PublicAccount, b: PublicAccount) =>
    (a.displayName || a.email).localeCompare(b.displayName || b.email);

  if (sortMode === 'name') {
    copy.sort(compareName);
    return copy;
  }

  if (sortMode === 'lowest_quota') {
    copy.sort((a, b) => {
      const pctA = getLowestRemainingPercent(a);
      const pctB = getLowestRemainingPercent(b);
      if (pctA === null && pctB === null) return compareName(a, b);
      if (pctA === null) return 1;
      if (pctB === null) return -1;
      if (pctA !== pctB) return pctA - pctB;
      return compareName(a, b);
    });
    return copy;
  }

  copy.sort((a, b) => {
    const resetA = getSoonestResetMs(a);
    const resetB = getSoonestResetMs(b);
    if (resetA === null && resetB === null) {
      const pctA = getLowestRemainingPercent(a) ?? Number.MAX_SAFE_INTEGER;
      const pctB = getLowestRemainingPercent(b) ?? Number.MAX_SAFE_INTEGER;
      return pctA !== pctB ? pctA - pctB : compareName(a, b);
    }
    if (resetA === null) return 1;
    if (resetB === null) return -1;
    if (resetA !== resetB) return resetA - resetB;
    return compareName(a, b);
  });

  return copy;
}

const EFFORT_TAIL_RE = /\((High|Medium|Low|Thinking)\)$/i;

export function getEffortChipLabel(model: AvailableModel): string {
  const match = EFFORT_TAIL_RE.exec((model.displayName || '').trim());
  if (match) {
    const raw = match[1];
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }
  return model.displayName || model.id;
}
