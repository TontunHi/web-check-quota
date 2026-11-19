import type {
  AvailableModel,
  ModelFamily,
  PlatformId,
  PublicAccount,
  QuotaItem,
} from './types';

export interface CanonicalModelEntry {
  platform: PlatformId;
  id: string;
  displayName: string;
  family: ModelFamily;
  groupKey: string;
  groupLabel: string;
  effortLabel?: string;
  reasoningEfforts?: readonly string[];
  paidOnly?: boolean;
  aliases?: readonly string[];
}

export interface DisplayModelGroup {
  groupKey: string;
  label: string;
  family: ModelFamily;
  models: AvailableModel[];
  efforts: string[];
  remainingPercent: number | null;
  resetAt: string | null;
  isLive: boolean;
}

const CODEX_BASE_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;
const CODEX_EXTENDED_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'] as const;

const ANTIGRAVITY_CANONICAL_MODELS: readonly CanonicalModelEntry[] = [
  {
    platform: 'antigravity',
    id: 'gemini-4-argon-high',
    displayName: 'Gemini 4 Argon (High)',
    family: 'gemini',
    groupKey: 'gemini-4-argon',
    groupLabel: 'Gemini 4 Argon',
    effortLabel: 'High',
    aliases: ['gemini-4-argon', 'MODEL_PLACEHOLDER_M417'],
  },
  {
    platform: 'antigravity',
    id: 'gemini-4-argon-medium',
    displayName: 'Gemini 4 Argon (Medium)',
    family: 'gemini',
    groupKey: 'gemini-4-argon',
    groupLabel: 'Gemini 4 Argon',
    effortLabel: 'Medium',
    aliases: ['MODEL_PLACEHOLDER_M418'],
  },
  {
    platform: 'antigravity',
    id: 'gemini-4-argon-low',
    displayName: 'Gemini 4 Argon (Low)',
    family: 'gemini',
    groupKey: 'gemini-4-argon',
    groupLabel: 'Gemini 4 Argon',
    effortLabel: 'Low',
    aliases: ['MODEL_PLACEHOLDER_M419'],
  },
  {
    platform: 'antigravity',
    id: 'gemini-3.8-flash-high',
    displayName: 'Gemini 3.8 Flash (High)',
    family: 'gemini',
    groupKey: 'gemini-3.8-flash',
    groupLabel: 'Gemini 3.8 Flash',
    effortLabel: 'High',
    aliases: ['gemini-3.8-flash', 'MODEL_PLACEHOLDER_M318'],
  },
  {
    platform: 'antigravity',
    id: 'gemini-3.8-flash-medium',
    displayName: 'Gemini 3.8 Flash (Medium)',
    family: 'gemini',
    groupKey: 'gemini-3.8-flash',
    groupLabel: 'Gemini 3.8 Flash',
    effortLabel: 'Medium',
    aliases: ['MODEL_PLACEHOLDER_M319'],
  },
  {
    platform: 'antigravity',
    id: 'gemini-3.8-flash-low',
    displayName: 'Gemini 3.8 Flash (Low)',
    family: 'gemini',
    groupKey: 'gemini-3.8-flash',
    groupLabel: 'Gemini 3.8 Flash',
    effortLabel: 'Low',
    aliases: ['MODEL_PLACEHOLDER_M320'],
  },
  {
    platform: 'antigravity',
    id: 'claude-opus-5-5-high',
    displayName: 'Claude Opus 5.5 (High)',
    family: 'claude',
    groupKey: 'claude-opus-5-5',
    groupLabel: 'Claude Opus 5.5',
    effortLabel: 'High',
    aliases: ['claude-opus-5-5', 'MODEL_PLACEHOLDER_M402'],
  },
  {
    platform: 'antigravity',
    id: 'claude-opus-5-5-medium',
    displayName: 'Claude Opus 5.5 (Medium)',
    family: 'claude',
    groupKey: 'claude-opus-5-5',
    groupLabel: 'Claude Opus 5.5',
    effortLabel: 'Medium',
    aliases: ['MODEL_PLACEHOLDER_M401'],
  },
  {
    platform: 'antigravity',
    id: 'claude-opus-5-5-low',
    displayName: 'Claude Opus 5.5 (Low)',
    family: 'claude',
    groupKey: 'claude-opus-5-5',
    groupLabel: 'Claude Opus 5.5',
    effortLabel: 'Low',
    aliases: ['MODEL_PLACEHOLDER_M400'],
  },
  {
    platform: 'antigravity',
    id: 'claude-sonnet-5-5-high',
    displayName: 'Claude Sonnet 5.5 (High)',
    family: 'claude',
    groupKey: 'claude-sonnet-5-5',
    groupLabel: 'Claude Sonnet 5.5',
    effortLabel: 'High',
    aliases: ['claude-sonnet-5-5', 'MODEL_PLACEHOLDER_M405'],
  },
  {
    platform: 'antigravity',
    id: 'claude-sonnet-5-5-medium',
    displayName: 'Claude Sonnet 5.5 (Medium)',
    family: 'claude',
    groupKey: 'claude-sonnet-5-5',
    groupLabel: 'Claude Sonnet 5.5',
    effortLabel: 'Medium',
    aliases: ['MODEL_PLACEHOLDER_M404'],
  },
  {
    platform: 'antigravity',
    id: 'claude-sonnet-5-5-low',
    displayName: 'Claude Sonnet 5.5 (Low)',
    family: 'claude',
    groupKey: 'claude-sonnet-5-5',
    groupLabel: 'Claude Sonnet 5.5',
    effortLabel: 'Low',
    aliases: ['MODEL_PLACEHOLDER_M403'],
  },
  {
    platform: 'antigravity',
    id: 'gemini-3.1-pro-high',
    displayName: 'Gemini 3.1 Pro (High)',
    family: 'gemini',
    groupKey: 'gemini-3.1-pro',
    groupLabel: 'Gemini 3.1 Pro',
    effortLabel: 'High',
    aliases: ['gemini-3-pro-high', 'MODEL_PLACEHOLDER_M37', 'MODEL_PLACEHOLDER_M8'],
  },
  {
    platform: 'antigravity',
    id: 'gemini-3.1-pro-low',
    displayName: 'Gemini 3.1 Pro (Low)',
    family: 'gemini',
    groupKey: 'gemini-3.1-pro',
    groupLabel: 'Gemini 3.1 Pro',
    effortLabel: 'Low',
    aliases: ['gemini-3-pro-low', 'MODEL_PLACEHOLDER_M36', 'MODEL_PLACEHOLDER_M7'],
  },
  {
    platform: 'antigravity',
    id: 'gemini-3-flash',
    displayName: 'Gemini 3 Flash',
    family: 'gemini',
    groupKey: 'gemini-3-flash',
    groupLabel: 'Gemini 3 Flash',
    aliases: ['MODEL_PLACEHOLDER_M18'],
  },
  {
    platform: 'antigravity',
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6 (Thinking)',
    family: 'claude',
    groupKey: 'claude-sonnet-4-6',
    groupLabel: 'Claude Sonnet 4.6',
    aliases: [
      'claude-sonnet-4-6-thinking',
      'claude-sonnet-4-5',
      'claude-sonnet-4-5-thinking',
      'MODEL_PLACEHOLDER_M35',
      'MODEL_CLAUDE_4_5_SONNET',
      'MODEL_CLAUDE_4_5_SONNET_THINKING',
    ],
  },
  {
    platform: 'antigravity',
    id: 'claude-opus-4-6-thinking',
    displayName: 'Claude Opus 4.6 (Thinking)',
    family: 'claude',
    groupKey: 'claude-opus-4-6-thinking',
    groupLabel: 'Claude Opus 4.6',
    aliases: [
      'claude-opus-4-6',
      'claude-opus-4-5-thinking',
      'MODEL_PLACEHOLDER_M26',
      'MODEL_PLACEHOLDER_M12',
    ],
  },
  {
    platform: 'antigravity',
    id: 'gpt-oss-120b-medium',
    displayName: 'GPT-OSS 120B (Medium)',
    family: 'openai',
    groupKey: 'gpt-oss-120b',
    groupLabel: 'GPT-OSS 120B',
    effortLabel: 'Medium',
    aliases: ['MODEL_OPENAI_GPT_OSS_120B_MEDIUM'],
  },
];

const CODEX_CANONICAL_MODELS: readonly CanonicalModelEntry[] = [
  {
    platform: 'codex',
    id: 'gpt-6.1-sol',
    displayName: 'GPT-6.1 Sol',
    family: 'openai',
    groupKey: 'gpt-6.1-sol',
    groupLabel: 'GPT-6.1 Sol',
    reasoningEfforts: CODEX_EXTENDED_EFFORTS,
  },
  {
    platform: 'codex',
    id: 'gpt-6-astra',
    displayName: 'GPT-6 Astra',
    family: 'openai',
    groupKey: 'gpt-6-astra',
    groupLabel: 'GPT-6 Astra',
    paidOnly: true,
    reasoningEfforts: CODEX_BASE_EFFORTS,
  },
  {
    platform: 'codex',
    id: 'gpt-6.1-terra',
    displayName: 'GPT-6.1 Terra',
    family: 'openai',
    groupKey: 'gpt-6.1-terra',
    groupLabel: 'GPT-6.1 Terra',
    reasoningEfforts: CODEX_EXTENDED_EFFORTS,
  },
  {
    platform: 'codex',
    id: 'gpt-6-sol',
    displayName: 'GPT-6 Sol',
    family: 'openai',
    groupKey: 'gpt-6-sol',
    groupLabel: 'GPT-6 Sol',
    reasoningEfforts: CODEX_BASE_EFFORTS,
  },
  {
    platform: 'codex',
    id: 'gpt-6-luna',
    displayName: 'GPT-6 Luna',
    family: 'openai',
    groupKey: 'gpt-6-luna',
    groupLabel: 'GPT-6 Luna',
    reasoningEfforts: CODEX_BASE_EFFORTS,
  },
  {
    platform: 'codex',
    id: 'gpt-5.6-sol',
    displayName: 'GPT-5.6 Sol',
    family: 'openai',
    groupKey: 'gpt-5.6-sol',
    groupLabel: 'GPT-5.6 Sol',
    reasoningEfforts: CODEX_BASE_EFFORTS,
  },
  {
    platform: 'codex',
    id: 'gpt-5.6-terra',
    displayName: 'GPT-5.6 Terra',
    family: 'openai',
    groupKey: 'gpt-5.6-terra',
    groupLabel: 'GPT-5.6 Terra',
    reasoningEfforts: CODEX_BASE_EFFORTS,
  },
  {
    platform: 'codex',
    id: 'gpt-5.6-luna',
    displayName: 'GPT-5.6 Luna',
    family: 'openai',
    groupKey: 'gpt-5.6-luna',
    groupLabel: 'GPT-5.6 Luna',
    reasoningEfforts: CODEX_BASE_EFFORTS,
  },
];

const CLAUDE_CANONICAL_MODELS: readonly CanonicalModelEntry[] = [
  {
    platform: 'claude',
    id: 'claude-opus-4-8',
    displayName: 'Claude Opus 4.8',
    family: 'claude',
    groupKey: 'claude-opus-4-8',
    groupLabel: 'Claude Opus 4.8',
    paidOnly: true,
  },
  {
    platform: 'claude',
    id: 'claude-fable-5',
    displayName: 'Claude Fable 5',
    family: 'claude',
    groupKey: 'claude-fable-5',
    groupLabel: 'Claude Fable 5',
    paidOnly: true,
  },
  {
    platform: 'claude',
    id: 'claude-opus-4-7',
    displayName: 'Claude Opus 4.7',
    family: 'claude',
    groupKey: 'claude-opus-4-7',
    groupLabel: 'Claude Opus 4.7',
    paidOnly: true,
  },
  {
    platform: 'claude',
    id: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    family: 'claude',
    groupKey: 'claude-opus-4-6',
    groupLabel: 'Claude Opus 4.6',
    paidOnly: true,
  },
  {
    platform: 'claude',
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    family: 'claude',
    groupKey: 'claude-sonnet-4-6',
    groupLabel: 'Claude Sonnet 4.6',
  },
  {
    platform: 'claude',
    id: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
    family: 'claude',
    groupKey: 'claude-haiku-4-5-20251001',
    groupLabel: 'Claude Haiku 4.5',
    aliases: ['claude-haiku-4-5'],
  },
];

export const CANONICAL_MODELS_BY_PLATFORM: Record<PlatformId, readonly CanonicalModelEntry[]> = {
  antigravity: ANTIGRAVITY_CANONICAL_MODELS,
  codex: CODEX_CANONICAL_MODELS,
  claude: CLAUDE_CANONICAL_MODELS,
};

export const PLATFORM_WAKEUP_DEFAULTS: Record<PlatformId, string> = {
  antigravity: 'gemini-3.8-flash-high',
  codex: 'gpt-5.6-luna',
  claude: 'claude-haiku-4-5-20251001',
};

export const PLATFORM_WAKEUP_PRESETS: Record<PlatformId, string[]> = {
  antigravity: [
    'gemini-3.8-flash-high',
    'gemini-4-argon-high',
    'claude-sonnet-5-5-high',
    'claude-opus-5-5-high',
    'gemini-3.8-flash-high + claude-sonnet-5-5-high',
    'gemini-3-flash',
    'claude-sonnet-4-6',
    'claude-opus-4-6-thinking',
    'gemini-3.1-pro-high',
  ],
  codex: [
    'gpt-5.6-luna',
    'gpt-6.1-sol',
    'gpt-6-astra',
    'gpt-6.1-terra',
    'gpt-6-sol',
    'gpt-6-luna',
    'gpt-5.6-sol',
    'gpt-5.6-terra',
  ],
  claude: [
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6',
    'claude-opus-4-8',
    'claude-fable-5',
    'claude-opus-4-7',
    'claude-opus-4-6',
  ],
};

function normalizeLookupKey(value?: string | null): string {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface PlatformIndex {
  byExactId: Map<string, CanonicalModelEntry>;
  byAlias: Map<string, CanonicalModelEntry>;
  rankById: Map<string, number>;
  groupRankByKey: Map<string, number>;
}

function buildPlatformIndex(entries: readonly CanonicalModelEntry[]): PlatformIndex {
  const byExactId = new Map<string, CanonicalModelEntry>();
  const byAlias = new Map<string, CanonicalModelEntry>();
  const rankById = new Map<string, number>();
  const groupRankByKey = new Map<string, number>();

  entries.forEach((entry, idx) => {
    rankById.set(entry.id, idx);
    if (!groupRankByKey.has(entry.groupKey)) {
      groupRankByKey.set(entry.groupKey, groupRankByKey.size);
    }

    const exactKey = normalizeLookupKey(entry.id);
    if (exactKey && !byExactId.has(exactKey)) {
      byExactId.set(exactKey, entry);
    }

    const candidates = [entry.id, entry.displayName, ...(entry.aliases ?? [])];
    for (const raw of candidates) {
      const key = normalizeLookupKey(raw);
      if (key && !byAlias.has(key)) {
        byAlias.set(key, entry);
      }
      if (raw.startsWith('MODEL_')) {
        const strippedKey = normalizeLookupKey(raw.slice('MODEL_'.length));
        if (strippedKey && !byAlias.has(strippedKey)) {
          byAlias.set(strippedKey, entry);
        }
      }
    }
  });

  return { byExactId, byAlias, rankById, groupRankByKey };
}

const INDEX_BY_PLATFORM: Record<PlatformId, PlatformIndex> = {
  antigravity: buildPlatformIndex(ANTIGRAVITY_CANONICAL_MODELS),
  codex: buildPlatformIndex(CODEX_CANONICAL_MODELS),
  claude: buildPlatformIndex(CLAUDE_CANONICAL_MODELS),
};

function resolveCanonical(
  platform: PlatformId,
  ...candidates: Array<string | null | undefined>
): CanonicalModelEntry | undefined {
  const index = INDEX_BY_PLATFORM[platform];
  for (const candidate of candidates) {
    const key = normalizeLookupKey(candidate);
    if (!key) continue;
    const hit = index.byExactId.get(key) ?? index.byAlias.get(key);
    if (hit) return hit;
  }
  return undefined;
}

function resolveAnyCanonical(
  platform: PlatformId | undefined,
  modelId: string,
  displayName?: string | null
): CanonicalModelEntry | undefined {
  if (platform) {
    return resolveCanonical(platform, modelId, displayName);
  }
  const idKey = normalizeLookupKey(modelId);
  const nameKey = normalizeLookupKey(displayName);
  const platforms: readonly PlatformId[] = ['antigravity', 'codex', 'claude'];

  // Exact display-name + id match wins when models share an ID across platforms (e.g. claude-sonnet-4-6).
  if (nameKey) {
    for (const p of platforms) {
      const hit = INDEX_BY_PLATFORM[p].byExactId.get(idKey);
      if (hit && normalizeLookupKey(hit.displayName) === nameKey) return hit;
    }
  }
  for (const p of platforms) {
    const hit = INDEX_BY_PLATFORM[p].byExactId.get(idKey);
    if (hit) return hit;
  }
  for (const p of platforms) {
    const hit = resolveCanonical(p, modelId, displayName);
    if (hit) return hit;
  }
  return undefined;
}

function inferModelFamily(id: string, displayName?: string | null): ModelFamily {
  const combined = `${id} ${displayName ?? ''}`.toLowerCase();
  if (combined.includes('gemini')) return 'gemini';
  if (combined.includes('claude')) return 'claude';
  if (
    combined.includes('gpt') ||
    combined.includes('openai') ||
    combined.includes('codex') ||
    /\bo[134](?:\b|-)/.test(combined)
  ) {
    return 'openai';
  }
  return 'other';
}

function validIsoOrNull(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return Number.isFinite(Date.parse(trimmed)) ? trimmed : null;
}

function pickEarliestIso(a: string | null, b: string | null): string | null {
  const validA = validIsoOrNull(a);
  const validB = validIsoOrNull(b);
  if (!validA) return validB;
  if (!validB) return validA;
  return Date.parse(validA) <= Date.parse(validB) ? validA : validB;
}

function toCatalogAvailableModel(entry: CanonicalModelEntry): AvailableModel {
  return {
    id: entry.id,
    displayName: entry.displayName,
    family: entry.family,
    recommended: true,
    ...(entry.reasoningEfforts ? { reasoningEfforts: [...entry.reasoningEfforts] } : {}),
    source: 'catalog',
  };
}

function isFreePlan(plan?: string | null): boolean {
  return Boolean(plan && plan.toLowerCase().includes('free'));
}

export function getModelDisplayLabel(modelId: string, platform?: PlatformId): string | null {
  const trimmed = modelId.trim();
  if (!trimmed) return null;

  const parts = trimmed
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const labels = parts.map((part) => resolveAnyCanonical(platform, part)?.displayName ?? null);
  if (labels.every((label) => label === null)) return null;

  return parts.map((part, idx) => labels[idx] ?? part).join(' + ');
}

export function isBlacklistedAntigravityModel(
  id: string,
  displayName?: string | null
): boolean {
  const lowerId = id.trim().toLowerCase();
  const lowerName = (displayName ?? '').trim().toLowerCase();

  if (lowerId) {
    if (
      lowerId === 'gemini-2.5' ||
      lowerId.startsWith('gemini-2.5-') ||
      lowerId === 'chat_20706' ||
      lowerId === 'chat_23310' ||
      lowerId.startsWith('chat_') ||
      lowerId.startsWith('model_google_gemini_2_5_') ||
      lowerId.startsWith('model_chat_') ||
      lowerId === 'model_placeholder_m19' ||
      lowerId.endsWith('-tiered') ||
      lowerId.endsWith('-sonar')
    ) {
      return true;
    }
  }

  if (lowerName && (lowerName.startsWith('gemini 2.5') || lowerName.startsWith('chat_'))) {
    return true;
  }

  return false;
}

interface RawAntigravityModelInfo {
  displayName?: string;
  model?: string;
  recommended?: boolean;
  quotaInfo?: { remainingFraction?: number; resetTime?: string };
}

interface RawAntigravityAgentModelSort {
  groups?: Array<{ modelIds?: Array<string | null | undefined> | null } | null> | null;
}

interface RawAntigravityPayload {
  agentModelSorts?: RawAntigravityAgentModelSort[] | null;
  models?: Record<string, RawAntigravityModelInfo> | null;
  payload?: {
    agentModelSorts?: RawAntigravityAgentModelSort[] | null;
    models?: Record<string, RawAntigravityModelInfo> | null;
  } | null;
}

function buildLiveAntigravityModel(
  id: string,
  info: RawAntigravityModelInfo,
  canonical: CanonicalModelEntry | undefined,
  recommended: boolean
): AvailableModel {
  const displayName = info.displayName?.trim() || canonical?.displayName || id;
  const frac = info.quotaInfo?.remainingFraction;
  const remainingPercent =
    typeof frac === 'number' && Number.isFinite(frac)
      ? Math.max(0, Math.min(100, Math.trunc(frac * 100)))
      : null;

  return {
    id,
    displayName,
    family: canonical?.family ?? inferModelFamily(id, displayName),
    remainingPercent,
    resetAt: info.quotaInfo?.resetTime?.trim() || null,
    recommended,
    source: 'live',
  };
}

export function extractAntigravityAvailableModels(rawPayload: unknown): AvailableModel[] {
  if (!rawPayload || typeof rawPayload !== 'object') return [];
  const raw = rawPayload as RawAntigravityPayload;
  const models = raw.payload?.models ?? raw.models;
  if (!models || typeof models !== 'object') return [];

  const sorts = raw.payload?.agentModelSorts ?? raw.agentModelSorts;
  const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(models, key);

  // Follow the official picker order whenever agentModelSorts lists valid models.
  if (Array.isArray(sorts) && sorts.length > 0) {
    const picked: AvailableModel[] = [];
    const seen = new Set<string>();
    for (const sort of sorts) {
      for (const group of sort?.groups ?? []) {
        for (const rawId of group?.modelIds ?? []) {
          const id = typeof rawId === 'string' ? rawId.trim() : '';
          if (!id || seen.has(id) || !hasOwn(id)) continue;
          const info = models[id];
          if (!info || isBlacklistedAntigravityModel(id, info.displayName)) continue;
          seen.add(id);
          const canonical = resolveCanonical('antigravity', id, info.model, info.displayName);
          picked.push(buildLiveAntigravityModel(id, info, canonical, true));
        }
      }
    }
    if (picked.length > 0) return picked;
  }

  const rankMap = INDEX_BY_PLATFORM.antigravity.rankById;
  const fallback: Array<{
    rank: number;
    canonicalId: string | null;
    isExactId: boolean;
    model: AvailableModel;
  }> = [];
  const seenKey = new Set<string>();

  for (const [rawId, info] of Object.entries(models)) {
    const id = rawId.trim();
    if (!id || !info || isBlacklistedAntigravityModel(id, info.displayName)) continue;

    const canonical = resolveCanonical('antigravity', id, info.model, info.displayName);
    if (!info.quotaInfo && !canonical) continue;
    if (!canonical && info.recommended !== true) continue;

    const dedupeKey = canonical?.id ?? id;
    const isExactId = canonical ? canonical.id === id : true;
    if (seenKey.has(dedupeKey)) {
      if (isExactId) {
        const idx = fallback.findIndex((item) => (item.canonicalId ?? item.model.id) === dedupeKey);
        if (idx !== -1 && !fallback[idx].isExactId) {
          fallback[idx] = {
            rank: canonical ? (rankMap.get(canonical.id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER,
            canonicalId: canonical?.id ?? null,
            isExactId,
            model: buildLiveAntigravityModel(id, info, canonical, info.recommended ?? Boolean(canonical)),
          };
        }
      }
      continue;
    }

    seenKey.add(dedupeKey);
    fallback.push({
      rank: canonical ? (rankMap.get(canonical.id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER,
      canonicalId: canonical?.id ?? null,
      isExactId,
      model: buildLiveAntigravityModel(id, info, canonical, info.recommended ?? Boolean(canonical)),
    });
  }

  fallback.sort((a, b) => a.rank - b.rank);
  return fallback.map((entry) => entry.model);
}

export function buildAntigravityFallbackQuotaItems(
  availableModels: AvailableModel[]
): QuotaItem[] {
  const groupRankMap = INDEX_BY_PLATFORM.antigravity.groupRankByKey;
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      rank: number;
      remainingPercent: number;
      resetAt: string | null;
    }
  >();

  for (const model of availableModels) {
    if (
      typeof model.remainingPercent !== 'number' ||
      !Number.isFinite(model.remainingPercent) ||
      isBlacklistedAntigravityModel(model.id, model.displayName)
    ) {
      continue;
    }

    const canonical = resolveCanonical('antigravity', model.id, model.displayName);
    if (!canonical && model.recommended !== true) continue;

    const key = canonical?.groupKey ?? model.id;
    const label = canonical?.groupLabel ?? (model.displayName || model.id);
    const rank = canonical
      ? (groupRankMap.get(canonical.groupKey) ?? Number.MAX_SAFE_INTEGER)
      : Number.MAX_SAFE_INTEGER;
    const pct = Math.max(0, Math.min(100, Math.trunc(model.remainingPercent)));
    const resetAt = validIsoOrNull(model.resetAt);

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { key, label, rank, remainingPercent: pct, resetAt });
    } else {
      existing.remainingPercent = Math.min(existing.remainingPercent, pct);
      existing.resetAt = pickEarliestIso(existing.resetAt, resetAt);
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => a.rank - b.rank)
    .map(({ key, label, remainingPercent, resetAt }) => ({
      key,
      label,
      remainingPercent,
      resetAt,
    }));
}

export function normalizeAntigravityWakeupModel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return PLATFORM_WAKEUP_DEFAULTS.antigravity;
  if (isBlacklistedAntigravityModel(trimmed)) {
    return PLATFORM_WAKEUP_DEFAULTS.antigravity;
  }
  const canonical = resolveCanonical('antigravity', trimmed);
  return canonical ? canonical.id : trimmed;
}

export function getAntigravityDirectFallbackModel(model: string): string {
  return model.trim().toLowerCase().startsWith('claude-')
    ? 'claude-sonnet-4-6'
    : 'gemini-3-flash';
}

function parseGptMajorMinor(model: string): [number, number] | null {
  const lower = model.trim().toLowerCase();
  if (!lower.startsWith('gpt-')) return null;
  const rest = lower.slice(4);
  const match = /^(\d+)(?:\.(\d+))?(?=$|[^0-9.])/.exec(rest);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = match[2] !== undefined ? Number(match[2]) : 0;
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;
  return [major, minor];
}

export function isRetiredCodexModel(model: string): boolean {
  const lower = model.trim().toLowerCase();
  if (!lower) return false;
  if (
    lower.startsWith('codex-mini') ||
    lower === 'o3' ||
    lower.startsWith('o3-') ||
    lower === 'o4' ||
    lower.startsWith('o4-')
  ) {
    return true;
  }
  const version = parseGptMajorMinor(lower);
  if (!version) return false;
  const [major, minor] = version;
  return major < 5 || (major === 5 && minor < 6);
}

export function normalizeCodexWakeupModel(
  raw?: string | null,
  isApiKey = false
): string {
  const trimmed = raw?.trim() || '';
  if (!trimmed) return PLATFORM_WAKEUP_DEFAULTS.codex;
  if (isApiKey) return trimmed;
  return isRetiredCodexModel(trimmed) ? PLATFORM_WAKEUP_DEFAULTS.codex : trimmed;
}

export function normalizeClaudeWakeupModel(raw?: string | null): string {
  const trimmed = raw?.trim() || '';
  if (!trimmed) return PLATFORM_WAKEUP_DEFAULTS.claude;
  if (trimmed.toLowerCase() === 'claude-haiku-4-5') {
    return PLATFORM_WAKEUP_DEFAULTS.claude;
  }
  return trimmed;
}

export function getCodexCatalogForPlan(plan?: string | null): AvailableModel[] {
  const free = isFreePlan(plan);
  return CODEX_CANONICAL_MODELS.filter((entry) => !(free && entry.paidOnly)).map(
    toCatalogAvailableModel
  );
}

export function getClaudeCatalogForPlan(plan?: string | null): AvailableModel[] {
  const free = isFreePlan(plan);
  return CLAUDE_CANONICAL_MODELS.filter((entry) => !(free && entry.paidOnly)).map(
    toCatalogAvailableModel
  );
}

export function getAntigravityCatalog(): AvailableModel[] {
  return ANTIGRAVITY_CANONICAL_MODELS.map(toCatalogAvailableModel);
}

const NON_CHAT_MODEL_RE =
  /(embedding|tts|whisper|moderation|dall-e|audio|realtime|babbage|davinci)/i;

interface RawModelsListEntry {
  id?: unknown;
  display_name?: unknown;
  created?: unknown;
  created_at?: unknown;
}

function parseProviderModelsList(
  data: unknown,
  primaryPlatform: 'codex' | 'claude'
): AvailableModel[] {
  if (!data || typeof data !== 'object') return [];
  const rawList = (data as { data?: unknown }).data;
  if (!Array.isArray(rawList)) return [];

  const rankMap = INDEX_BY_PLATFORM[primaryPlatform].rankById;
  const seen = new Set<string>();
  const collected: Array<{
    rank: number;
    createdMs: number;
    model: AvailableModel;
  }> = [];

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as RawModelsListEntry;
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!id || NON_CHAT_MODEL_RE.test(id)) continue;

    const dedupeKey = id.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const canonical =
      resolveCanonical(primaryPlatform, id) ?? resolveAnyCanonical(undefined, id);
    const rawDisplayName =
      typeof entry.display_name === 'string' ? entry.display_name.trim() : '';
    const displayName = rawDisplayName || canonical?.displayName || id;
    const family = canonical?.family ?? inferModelFamily(id, displayName);

    let createdMs = 0;
    if (typeof entry.created === 'number' && Number.isFinite(entry.created)) {
      createdMs = entry.created;
    } else if (typeof entry.created_at === 'string') {
      const parsed = Date.parse(entry.created_at);
      if (Number.isFinite(parsed)) createdMs = parsed;
    }

    const rank =
      canonical && canonical.platform === primaryPlatform
        ? (rankMap.get(canonical.id) ?? Number.MAX_SAFE_INTEGER)
        : Number.MAX_SAFE_INTEGER;

    collected.push({
      rank,
      createdMs,
      model: {
        id,
        displayName,
        family,
        recommended: Boolean(canonical),
        ...(canonical?.reasoningEfforts
          ? { reasoningEfforts: [...canonical.reasoningEfforts] }
          : {}),
        source: 'live',
      },
    });
  }

  collected.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.createdMs !== b.createdMs) return b.createdMs - a.createdMs;
    return a.model.id.localeCompare(b.model.id);
  });

  return collected.map((entry) => entry.model);
}

export function parseOpenAiModelsList(data: unknown): AvailableModel[] {
  return parseProviderModelsList(data, 'codex');
}

export function parseAnthropicModelsList(data: unknown): AvailableModel[] {
  return parseProviderModelsList(data, 'claude');
}

function isBucketQuotaItem(item: QuotaItem): boolean {
  return item.key.startsWith('bucket:') || item.key.startsWith('window:');
}

function sanitizeLegacyAntigravityItems(
  items: QuotaItem[],
  knownAvailableModels?: AvailableModel[]
): AvailableModel[] {
  const rankMap = INDEX_BY_PLATFORM.antigravity.rankById;
  const recommendedUnknown = new Set(
    (knownAvailableModels ?? [])
      .filter((m) => m.recommended === true)
      .map((m) => m.id)
  );
  const byId = new Map<string, { rank: number; model: AvailableModel }>();

  for (const item of items) {
    if (isBucketQuotaItem(item)) continue;
    if (isBlacklistedAntigravityModel(item.key, item.label)) continue;

    const canonical = resolveCanonical('antigravity', item.key, item.label);
    if (!canonical && !recommendedUnknown.has(item.key)) continue;

    const id = canonical?.id ?? item.key;
    const displayName = canonical?.displayName ?? item.label;
    const family = canonical?.family ?? inferModelFamily(id, displayName);
    const pct = Number.isFinite(item.remainingPercent)
      ? Math.max(0, Math.min(100, Math.trunc(item.remainingPercent)))
      : null;
    const resetAt = validIsoOrNull(item.resetAt);

    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, {
        rank: canonical
          ? (rankMap.get(canonical.id) ?? Number.MAX_SAFE_INTEGER)
          : Number.MAX_SAFE_INTEGER,
        model: {
          id,
          displayName,
          family,
          remainingPercent: pct,
          resetAt,
          recommended: true,
          source: 'live',
        },
      });
    } else {
      if (pct !== null) {
        existing.model.remainingPercent =
          existing.model.remainingPercent === null || existing.model.remainingPercent === undefined
            ? pct
            : Math.min(existing.model.remainingPercent, pct);
      }
      existing.model.resetAt = pickEarliestIso(existing.model.resetAt ?? null, resetAt);
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.model);
}

export function resolveAccountAvailableModels(account: PublicAccount): {
  models: AvailableModel[];
  isLive: boolean;
} {
  const storedModels = account.quota?.availableModels;
  if (storedModels && storedModels.length > 0) {
    const models =
      account.platform === 'antigravity'
        ? storedModels.filter((m) => !isBlacklistedAntigravityModel(m.id, m.displayName))
        : storedModels;
    if (models.length > 0) {
      return {
        models,
        isLive: models.some((m) => m.source === 'live'),
      };
    }
  }

  if (account.platform === 'antigravity' && account.quota?.items?.length) {
    const nonBucket = account.quota.items.filter((i) => !isBucketQuotaItem(i));
    if (nonBucket.length > 0) {
      const sanitized = sanitizeLegacyAntigravityItems(nonBucket);
      if (sanitized.length > 0) {
        return { models: sanitized, isLive: true };
      }
    }
  }

  const plan = account.plan ?? account.quota?.plan ?? null;
  if (account.platform === 'antigravity') {
    return { models: getAntigravityCatalog(), isLive: false };
  }
  if (account.platform === 'codex') {
    return { models: getCodexCatalogForPlan(plan), isLive: false };
  }
  return { models: getClaudeCatalogForPlan(plan), isLive: false };
}

export function getDisplayQuotaItems(account: PublicAccount): QuotaItem[] {
  const items = account.quota?.items ?? [];
  if (items.length === 0) return [];

  if (account.platform === 'antigravity' && !items.some(isBucketQuotaItem)) {
    const sanitized = sanitizeLegacyAntigravityItems(
      items,
      account.quota?.availableModels
    );
    return buildAntigravityFallbackQuotaItems(sanitized);
  }

  return items;
}

const EFFORT_NAME_SUFFIX_RE = /^(.*)\s+\((High|Medium|Low)\)$/i;

function inferEffortGroup(model: AvailableModel): {
  groupKey: string;
  label: string;
  effortLabel?: string;
} {
  const match = EFFORT_NAME_SUFFIX_RE.exec((model.displayName || '').trim());
  if (match) {
    const rawEffort = match[2];
    const idSuffix = `-${rawEffort.toLowerCase()}`;
    if (model.id.toLowerCase().endsWith(idSuffix)) {
      return {
        groupKey: model.id.slice(0, -idSuffix.length),
        label: match[1].trim(),
        effortLabel: rawEffort.charAt(0).toUpperCase() + rawEffort.slice(1).toLowerCase(),
      };
    }
  }
  return {
    groupKey: model.id,
    label: model.displayName || model.id,
  };
}

export function groupModelsForDisplay(models: AvailableModel[]): DisplayModelGroup[] {
  const groups = new Map<string, DisplayModelGroup>();

  for (const model of models) {
    const canonical = resolveAnyCanonical(undefined, model.id, model.displayName);
    const inferred = canonical ? null : inferEffortGroup(model);
    const groupKey = canonical?.groupKey ?? inferred!.groupKey;
    const label = canonical?.groupLabel ?? inferred!.label;
    const effortLabel = canonical?.effortLabel ?? inferred?.effortLabel;
    const pct =
      typeof model.remainingPercent === 'number' && Number.isFinite(model.remainingPercent)
        ? model.remainingPercent
        : null;
    const resetAt = validIsoOrNull(model.resetAt);

    let group = groups.get(groupKey);
    if (!group) {
      group = {
        groupKey,
        label,
        family: canonical?.family ?? model.family,
        models: [],
        efforts: [],
        remainingPercent: null,
        resetAt: null,
        isLive: false,
      };
      groups.set(groupKey, group);
    }

    group.models.push(model);
    if (effortLabel && !group.efforts.includes(effortLabel)) {
      group.efforts.push(effortLabel);
    }
    for (const effort of model.reasoningEfforts ?? []) {
      if (!group.efforts.includes(effort)) {
        group.efforts.push(effort);
      }
    }
    if (pct !== null) {
      group.remainingPercent =
        group.remainingPercent === null ? pct : Math.min(group.remainingPercent, pct);
    }
    group.resetAt = pickEarliestIso(group.resetAt, resetAt);
    if (model.source === 'live') {
      group.isLive = true;
    }
  }

  return Array.from(groups.values());
}

const LEGACY_CLAUDE_IDS = new Set([
  'claude-sonnet-4-20250514',
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-20250929',
  'claude-opus-4-5',
  'claude-opus-4-1',
]);

export function isLegacyWakeupModel(
  platform: PlatformId,
  model?: string | null
): boolean {
  const trimmed = model?.trim();
  if (!trimmed) return false;

  const parts = trimmed
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.some((part) => {
    if (platform === 'codex') {
      return isRetiredCodexModel(part);
    }
    if (platform === 'antigravity') {
      if (isBlacklistedAntigravityModel(part)) return true;
      return normalizeAntigravityWakeupModel(part) !== part;
    }
    const lower = part.toLowerCase();
    return LEGACY_CLAUDE_IDS.has(lower) || lower.startsWith('claude-3-');
  });
}
