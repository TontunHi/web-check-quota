import type { PlatformId, StoredCredentials } from './types';

export interface ParsedImportCandidate {
  platform: PlatformId;
  email?: string;
  displayName?: string | null;
  tags?: string[];
  note?: string | null;
  credentials: StoredCredentials;
}

function asObj(val: unknown): Record<string, unknown> | null {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : null;
}

function str(val: unknown): string | undefined {
  return typeof val === 'string' && val.trim() ? val.trim() : undefined;
}

function strArr(val: unknown): string[] | undefined {
  if (!Array.isArray(val)) return undefined;
  const list = val.map((v) => String(v).trim()).filter(Boolean);
  return list.length > 0 ? list : undefined;
}

function parseSingleObject(
  obj: Record<string, unknown>,
  fallbackPlatform: PlatformId
): ParsedImportCandidate | null {
  // 1) Claude `.credentials.json` or Cockpit ClaudeAccount
  const claudeRaw =
    asObj(obj.claudeAiOauth) ??
    asObj(asObj(obj.claude_credentials_raw)?.claudeAiOauth) ??
    asObj(asObj(obj.claudeCredentialsRaw)?.claudeAiOauth) ??
    asObj(asObj(obj.credentials)?.claudeAiOauth);

  if (claudeRaw) {
    const configOauth =
      asObj(obj.oauthAccount) ??
      asObj(asObj(obj.claude_config_raw)?.oauthAccount) ??
      asObj(asObj(obj.claudeConfigRaw)?.oauthAccount) ??
      asObj(asObj(obj.config)?.oauthAccount);

    const refreshToken = str(claudeRaw.refreshToken) ?? str(claudeRaw.refresh_token);
    const accessToken = str(claudeRaw.accessToken) ?? str(claudeRaw.access_token);
    if (!refreshToken && !accessToken) return null;

    return {
      platform: 'claude',
      email: str(obj.email) ?? str(configOauth?.emailAddress),
      displayName: str(configOauth?.displayName) ?? null,
      tags: strArr(obj.tags),
      credentials: {
        authType: 'oauth',
        refreshToken,
        accessToken,
        organizationUuid:
          str(obj.organization_uuid) ?? str(configOauth?.organizationUuid),
        expiresAt:
          typeof claudeRaw.expiresAt === 'number' ? claudeRaw.expiresAt : undefined,
      },
    };
  }

  // 2) Codex `auth.json` or Cockpit CodexAccount
  const codexTokens = asObj(obj.tokens);
  if (
    codexTokens &&
    (str(codexTokens.refresh_token) ||
      str(codexTokens.access_token) ||
      str(codexTokens.id_token))
  ) {
    const rt = str(codexTokens.refresh_token);
    const at = str(codexTokens.access_token);
    const idt = str(codexTokens.id_token);
    // Distinguish Antigravity `token: { refresh_token: "1//..." }` vs Codex `tokens: { ... }`
    return {
      platform: 'codex',
      email: str(obj.email),
      tags: strArr(obj.tags),
      credentials: {
        authType: 'oauth',
        refreshToken: rt,
        accessToken: at,
        idToken: idt,
        accountId: str(obj.account_id) ?? str(codexTokens.account_id),
      },
    };
  }

  // 3) Antigravity full Account `{ token: { refresh_token: "1//..." } }`
  const agToken = asObj(obj.token);
  if (agToken && (str(agToken.refresh_token) || str(agToken.access_token))) {
    return {
      platform: 'antigravity',
      email: str(obj.email),
      displayName: str(obj.name) ?? null,
      tags: strArr(obj.tags),
      note: str(obj.notes) ?? str(obj.note) ?? null,
      credentials: {
        authType: 'oauth',
        refreshToken: str(agToken.refresh_token),
        accessToken: str(agToken.access_token),
        idToken: str(agToken.id_token),
        projectId: str(agToken.project_id),
        isGcpTos: typeof agToken.is_gcp_tos === 'boolean' ? agToken.is_gcp_tos : undefined,
      },
    };
  }

  // 4) Direct API Key objects (Codex or Claude)
  const apiKey =
    str(obj.openai_api_key) ??
    str(obj.OPENAI_API_KEY) ??
    str(obj.api_key) ??
    str(obj.apiKey) ??
    str(obj.anthropicApiKey);
  if (apiKey) {
    const plat: PlatformId =
      apiKey.startsWith('sk-ant-') || fallbackPlatform === 'claude'
        ? 'claude'
        : 'codex';
    return {
      platform: plat,
      email: str(obj.email),
      tags: strArr(obj.tags),
      credentials: {
        authType: 'api_key',
        apiKey,
        baseUrl: str(obj.api_base_url) ?? str(obj.base_url),
      },
    };
  }

  // 5) Simple `{ email, refresh_token }` or ChatGPT web session `{ accessToken }`
  const rt = str(obj.refresh_token) ?? str(obj.refreshToken);
  const at = str(obj.access_token) ?? str(obj.accessToken);
  if (rt || at) {
    let detected: PlatformId = fallbackPlatform;
    if (rt?.startsWith('1//')) detected = 'antigravity';
    else if (rt?.startsWith('rt_') || at?.startsWith('eyJ')) detected = 'codex';
    else if (rt?.startsWith('sk-ant-') || at?.startsWith('sk-ant-')) detected = 'claude';

    const nestedUser = asObj(obj.user);
    const nestedAccount = asObj(obj.account);

    return {
      platform: detected,
      email: str(obj.email) ?? str(nestedUser?.email),
      tags: strArr(obj.tags),
      note: str(obj.notes) ?? str(obj.note) ?? str(obj.remark) ?? null,
      credentials: {
        authType: 'oauth',
        refreshToken: rt,
        accessToken: at,
        accountId: str(obj.account_id) ?? str(nestedAccount?.id),
      },
    };
  }

  return null;
}

function extractPlatformArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val;
  const o = asObj(val);
  if (!o) return [];
  if (Array.isArray(o.exported_data)) return o.exported_data;
  if (Array.isArray(o.data)) return o.data;
  if (Array.isArray(o.accounts)) return o.accounts;
  return [];
}

export function parseCockpitImportPayload(
  rawText: string,
  defaultPlatform: PlatformId = 'antigravity'
): ParsedImportCandidate[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // Support plaintext `email----password----...----1//refresh_token` lines
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    const results: ParsedImportCandidate[] = [];
    for (const line of trimmed.split(/\r?\n/)) {
      const l = line.trim();
      if (!l) continue;
      if (l.includes('----')) {
        const parts = l.split('----').map((p) => p.trim());
        const tokenPart = parts.find((p) => p.startsWith('1//') || p.startsWith('rt_') || p.startsWith('sk-ant-'));
        if (tokenPart) {
          const plat: PlatformId = tokenPart.startsWith('1//')
            ? 'antigravity'
            : tokenPart.startsWith('rt_')
              ? 'codex'
              : 'claude';
          results.push({
            platform: plat,
            email: parts[0]?.includes('@') ? parts[0] : undefined,
            credentials: { authType: 'oauth', refreshToken: tokenPart },
          });
        }
      } else if (l.startsWith('1//') || l.startsWith('rt_') || l.startsWith('sk-ant-')) {
        const plat: PlatformId = l.startsWith('1//')
          ? 'antigravity'
          : l.startsWith('rt_')
            ? 'codex'
            : 'claude';
        results.push({
          platform: plat,
          credentials: { authType: 'oauth', refreshToken: l },
        });
      }
    }
    return results;
  }

  const parsed = JSON.parse(trimmed) as unknown;
  const candidates: ParsedImportCandidate[] = [];

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const o = asObj(item);
      if (!o) continue;
      const c = parseSingleObject(o, defaultPlatform);
      if (c) candidates.push(c);
    }
  } else {
    const root = asObj(parsed);
    if (!root) return [];

    // Check Cockpit full backup (`cockpit-tools.data-transfer` or `cockpit-tools.account-transfer`)
    const accountsSection = asObj(root.accounts) ?? root;
    const platformsObj = asObj(accountsSection.platforms);

    if (platformsObj) {
      const mapping: Array<[string, PlatformId]> = [
        ['antigravity', 'antigravity'],
        ['antigravity_ide', 'antigravity'],
        ['codex', 'codex'],
        ['claude', 'claude'],
      ];
      for (const [key, plat] of mapping) {
        for (const item of extractPlatformArray(platformsObj[key])) {
          const o = asObj(item);
          if (!o) continue;
          const c = parseSingleObject(o, plat);
          if (c) candidates.push(c);
        }
      }
    } else if (Array.isArray(root.accounts)) {
      for (const item of root.accounts) {
        const o = asObj(item);
        if (!o) continue;
        const c = parseSingleObject(o, defaultPlatform);
        if (c) candidates.push(c);
      }
    } else {
      const single = parseSingleObject(root, defaultPlatform);
      if (single) candidates.push(single);
    }
  }

  // Deduplicate (e.g. `antigravity` + `antigravity_ide` in full backup)
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const dedupKey = `${c.platform}:${
      c.credentials.refreshToken ||
      c.credentials.accessToken ||
      c.credentials.apiKey ||
      c.credentials.sessionKey ||
      c.email ||
      ''
    }`;
    if (seen.has(dedupKey)) return false;
    seen.add(dedupKey);
    return true;
  });
}
