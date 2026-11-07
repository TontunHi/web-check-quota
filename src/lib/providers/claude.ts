import { createHash, randomBytes } from 'node:crypto';
import type { QuotaItem, QuotaSnapshot, StoredCredentials } from '../types';

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const AUTH_URL = 'https://claude.com/cai/oauth/authorize';
const MANUAL_REDIRECT_URI = 'https://platform.claude.com/oauth/code/callback';
const TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const PROFILE_URL = 'https://api.anthropic.com/api/oauth/profile';
const OAUTH_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const OAUTH_BETA = 'oauth-2025-04-20';
const COCKPIT_UA = 'antigravity-cockpit-tools';

const SCOPES =
  'org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload';

export function buildClaudeAuthUrl(): {
  authUrl: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
} {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  const state = randomBytes(32).toString('base64url');

  const url = new URL(AUTH_URL);
  url.searchParams.set('code', 'true');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', MANUAL_REDIRECT_URI);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);

  return {
    authUrl: url.toString(),
    state,
    codeVerifier,
    redirectUri: MANUAL_REDIRECT_URI,
  };
}

export function parseClaudeCallback(raw: string): {
  code: string;
  state: string | null;
} {
  const trimmed = raw.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const parsed = new URL(trimmed);
    const code = parsed.searchParams.get('code')?.trim();
    const state =
      parsed.searchParams.get('state')?.trim() ||
      parsed.hash.replace(/^#/, '').trim() ||
      null;
    if (!code) throw new Error('ไม่พบ code ใน Callback URL ของ Claude');
    return { code, state };
  }

  // Anthropic manual page shows `<code_part>#<state_part>`
  const hashIdx = trimmed.indexOf('#');
  if (hashIdx !== -1) {
    const code = trimmed.slice(0, hashIdx).split('&')[0].trim();
    const state = trimmed.slice(hashIdx + 1).trim() || null;
    if (!code) throw new Error('รหัสยืนยัน Claude ไม่ถูกต้อง');
    return { code, state };
  }

  return { code: trimmed.split('&')[0].trim(), state: null };
}

function normalizeClaudePlan(
  orgType?: string | null,
  rateTier?: string | null,
  hasMax?: boolean,
  hasPro?: boolean
): string | null {
  const tier = (rateTier || '').toLowerCase();
  const org = (orgType || '').toLowerCase();
  if (tier.includes('max_20x')) return 'MAX 20X';
  if (tier.includes('max_5x')) return 'MAX 5X';
  if (org.includes('max') || hasMax) return 'MAX';
  if (org.includes('pro') || hasPro) return 'PRO';
  if (org.includes('enterprise')) return 'ENTERPRISE';
  if (org.includes('team')) return 'TEAM';
  if (org.includes('free')) return 'FREE';
  return null;
}

export async function fetchClaudeOAuthProfile(accessToken: string): Promise<{
  email?: string;
  displayName?: string;
  organizationUuid?: string;
  plan?: string | null;
}> {
  const res = await fetch(PROFILE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': COCKPIT_UA,
    },
  });
  if (!res.ok) return {};
  const data = (await res.json().catch(() => ({}))) as {
    account?: {
      email?: string;
      email_address?: string;
      display_name?: string;
      has_claude_max?: boolean;
      has_claude_pro?: boolean;
    };
    organization?: {
      uuid?: string;
      organization_type?: string;
      rate_limit_tier?: string;
    };
  };

  return {
    email: data.account?.email || data.account?.email_address,
    displayName: data.account?.display_name,
    organizationUuid: data.organization?.uuid,
    plan: normalizeClaudePlan(
      data.organization?.organization_type,
      data.organization?.rate_limit_tier,
      data.account?.has_claude_max,
      data.account?.has_claude_pro
    ),
  };
}

export async function exchangeClaudeCode(
  code: string,
  codeVerifier: string,
  state: string
): Promise<{
  email: string;
  displayName: string | null;
  plan: string | null;
  credentials: StoredCredentials;
}> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      'User-Agent': COCKPIT_UA,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      redirect_uri: MANUAL_REDIRECT_URI,
      code_verifier: codeVerifier,
      state,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    account?: { email_address?: string };
    organization?: { uuid?: string };
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || `แลก Claude OAuth token ไม่สำเร็จ (${res.status})`
    );
  }

  const profile = await fetchClaudeOAuthProfile(data.access_token);
  const email =
    profile.email ||
    data.account?.email_address ||
    `claude-${(data.organization?.uuid || 'user').slice(0, 8)}`;

  return {
    email,
    displayName: profile.displayName ?? null,
    plan: profile.plan ?? null,
    credentials: {
      authType: 'oauth',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      organizationUuid: profile.organizationUuid || data.organization?.uuid,
      expiresAt: Math.floor(Date.now() / 1000) + Number(data.expires_in ?? 28800),
    },
  };
}

export async function ensureFreshClaudeToken(
  creds: StoredCredentials,
  force = false
): Promise<{ credentials: StoredCredentials; changed: boolean }> {
  if (creds.authType === 'session_key' || creds.authType === 'api_key') {
    return { credentials: creds, changed: false };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  // Normalize expiresAt in case imported from .credentials.json in milliseconds
  const expSec =
    creds.expiresAt && creds.expiresAt > 10_000_000_000
      ? Math.floor(creds.expiresAt / 1000)
      : creds.expiresAt;

  const needsRefresh =
    force || !creds.accessToken || (typeof expSec === 'number' && expSec <= nowSec + 300);

  if (!needsRefresh) {
    return { credentials: { ...creds, expiresAt: expSec }, changed: expSec !== creds.expiresAt };
  }

  if (!creds.refreshToken) {
    if (creds.accessToken && !force) return { credentials: creds, changed: false };
    throw new Error('ไม่มี refresh_token สำหรับรีเฟรชสิทธิ์ Claude OAuth');
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': COCKPIT_UA,
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken,
      client_id: CLIENT_ID,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || `รีเฟรช Claude token ไม่สำเร็จ (${res.status})`
    );
  }

  return {
    changed: true,
    credentials: {
      ...creds,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || creds.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + Number(data.expires_in ?? 28800),
    },
  };
}

function parseResetIso(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') {
    const ts = Date.parse(val);
    return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
  }
  if (typeof val === 'number' && val > 0) {
    const ms = val > 10_000_000_000 ? val : val * 1000;
    return new Date(ms).toISOString();
  }
  return null;
}

function remainingFromUtilization(util?: number): number {
  if (typeof util !== 'number' || !Number.isFinite(util)) return 100;
  const pct = util > 0 && util < 1 ? util * 100 : util;
  return Math.max(0, Math.min(100, Math.round(100 - pct)));
}

export async function fetchClaudeQuota(creds: StoredCredentials): Promise<{
  quota: QuotaSnapshot;
  credentials: StoredCredentials;
  credentialsChanged: boolean;
}> {
  // Mode 1: API Key / Custom Gateway
  if (creds.authType === 'api_key' || creds.apiKey) {
    const baseUrl = (creds.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/v1/models`, {
      headers: {
        'x-api-key': creds.apiKey!,
        'anthropic-version': '2023-06-01',
      },
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`ตรวจสอบ Claude API Key ไม่สำเร็จ (${res.status})`);
    }
    return {
      credentials: creds,
      credentialsChanged: false,
      quota: {
        items: [
          {
            key: 'apikey:status',
            label: 'Anthropic API Key พร้อมใช้งาน',
            remainingPercent: 100,
            detail: baseUrl,
          },
        ],
        plan: 'API KEY',
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  // Mode 2: Web Session Cookie (`claude.ai`)
  if (creds.authType === 'session_key' || creds.sessionKey) {
    const sessionKey = creds.sessionKey!;
    const browserHeaders = (orgId?: string): Record<string, string> => ({
      Accept: 'application/json',
      Cookie: orgId
        ? `sessionKey=${sessionKey}; lastActiveOrg=${orgId}`
        : `sessionKey=${sessionKey}`,
      ...(orgId ? { 'x-organization-uuid': orgId } : {}),
      Origin: 'https://claude.ai',
      Referer: 'https://claude.ai/settings/usage',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });

    let orgUuid = creds.organizationUuid || creds.accountId;
    let changed = false;

    if (!orgUuid) {
      const orgRes = await fetch('https://claude.ai/api/organizations', {
        headers: browserHeaders(),
      });
      if (orgRes.status === 403) {
        return {
          credentials: creds,
          credentialsChanged: false,
          quota: {
            items: [],
            forbidden: true,
            forbiddenReason:
              'claude.ai บล็อกคำขอด้วย Cloudflare สำหรับโหมด Session Key (แนะนำใช้โหมด Claude OAuth แทน)',
            fetchedAt: new Date().toISOString(),
          },
        };
      }
      if (!orgRes.ok) {
        throw new Error(`ดึง Organization ของ Claude ไม่สำเร็จ (${orgRes.status})`);
      }
      const orgs = (await orgRes.json()) as Array<{ uuid?: string }>;
      orgUuid = orgs[0]?.uuid;
      if (!orgUuid) throw new Error('ไม่พบ Organization UUID ในบัญชี Claude');
      changed = true;
    }

    const usageRes = await fetch(
      `https://claude.ai/api/organizations/${orgUuid}/usage`,
      { headers: browserHeaders(orgUuid) }
    );
    if (usageRes.status === 403) {
      return {
        credentials: { ...creds, organizationUuid: orgUuid },
        credentialsChanged: changed,
        quota: {
          items: [],
          forbidden: true,
          forbiddenReason:
            'ติด Cloudflare บน claude.ai (แนะนำล็อกอินผ่านแท็บ OAuth ซึ่งเรียก api.anthropic.com โดยตรง)',
          fetchedAt: new Date().toISOString(),
        },
      };
    }
    if (!usageRes.ok) {
      throw new Error(`ดึงโควต้า claude.ai ไม่สำเร็จ (${usageRes.status})`);
    }
    const webData = (await usageRes.json()) as {
      limits?: Array<{
        kind?: string;
        group?: string;
        percent?: number;
        resets_at?: unknown;
        scope?: { model?: { display_name?: string } };
      }>;
      five_hour?: { utilization?: number; resets_at?: unknown };
      seven_day?: { utilization?: number; resets_at?: unknown };
    };

    const items: QuotaItem[] = [];
    if (Array.isArray(webData.limits) && webData.limits.length > 0) {
      for (const lim of webData.limits) {
        const isSession = lim.kind === 'session' || lim.group === 'session';
        const modelName = lim.scope?.model?.display_name;
        items.push({
          key: isSession
            ? 'window:5h'
            : modelName
              ? `window:7d:${modelName}`
              : 'window:7d',
          label: isSession
            ? '5h Session Window'
            : modelName
              ? `Weekly (${modelName})`
              : '7d Weekly Window',
          remainingPercent: remainingFromUtilization(lim.percent),
          resetAt: parseResetIso(lim.resets_at),
        });
      }
    } else {
      if (webData.five_hour) {
        items.push({
          key: 'window:5h',
          label: '5h Session Window',
          remainingPercent: remainingFromUtilization(webData.five_hour.utilization),
          resetAt: parseResetIso(webData.five_hour.resets_at),
        });
      }
      if (webData.seven_day) {
        items.push({
          key: 'window:7d',
          label: '7d Weekly Window',
          remainingPercent: remainingFromUtilization(webData.seven_day.utilization),
          resetAt: parseResetIso(webData.seven_day.resets_at),
        });
      }
    }

    return {
      credentials: { ...creds, organizationUuid: orgUuid },
      credentialsChanged: changed,
      quota: {
        items,
        plan: null,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  // Mode 3 (Recommended): Official Claude Code OAuth -> api.anthropic.com (No Cloudflare block!)
  let refreshed = await ensureFreshClaudeToken(creds, false);
  let nextCreds = refreshed.credentials;
  let changed = refreshed.changed;

  let res = await fetch(OAUTH_USAGE_URL, {
    headers: {
      Authorization: `Bearer ${nextCreds.accessToken}`,
      'anthropic-beta': OAUTH_BETA,
      'User-Agent': COCKPIT_UA,
    },
  });

  if (res.status === 401 && nextCreds.refreshToken) {
    refreshed = await ensureFreshClaudeToken(nextCreds, true);
    nextCreds = refreshed.credentials;
    changed = true;
    res = await fetch(OAUTH_USAGE_URL, {
      headers: {
        Authorization: `Bearer ${nextCreds.accessToken}`,
        'anthropic-beta': OAUTH_BETA,
        'User-Agent': COCKPIT_UA,
      },
    });
  }

  if (!res.ok) {
    const errTxt = await res.text().catch(() => '');
    throw new Error(`ดึงโควต้า Claude OAuth ไม่สำเร็จ (${res.status}): ${errTxt.slice(0, 120)}`);
  }

  const raw = (await res.json()) as {
    five_hour?: { utilization?: number; resets_at?: unknown };
    seven_day?: { utilization?: number; resets_at?: unknown };
    seven_day_sonnet?: { utilization?: number; resets_at?: unknown };
    seven_day_sonnet_4?: { utilization?: number; resets_at?: unknown };
    extra_usage?: {
      is_enabled?: boolean;
      utilization?: number;
      resets_at?: unknown;
      used_credits?: number;
      monthly_limit?: number;
    };
  };

  const profile = await fetchClaudeOAuthProfile(nextCreds.accessToken!);
  const items: QuotaItem[] = [];

  if (raw.five_hour) {
    items.push({
      key: 'window:5h',
      label: '5h Session Window (รอบ 5 ชั่วโมง)',
      remainingPercent: remainingFromUtilization(raw.five_hour.utilization),
      resetAt: parseResetIso(raw.five_hour.resets_at),
    });
  }

  if (raw.seven_day) {
    items.push({
      key: 'window:7d',
      label: '7d All Models (รายสัปดาห์)',
      remainingPercent: remainingFromUtilization(raw.seven_day.utilization),
      resetAt: parseResetIso(raw.seven_day.resets_at),
    });
  }

  const sonnetWin = raw.seven_day_sonnet ?? raw.seven_day_sonnet_4;
  if (sonnetWin) {
    items.push({
      key: 'window:7d_sonnet',
      label: '7d Sonnet Quota',
      remainingPercent: remainingFromUtilization(sonnetWin.utilization),
      resetAt: parseResetIso(sonnetWin.resets_at),
    });
  }

  let creditsText: string | null = null;
  if (raw.extra_usage?.is_enabled) {
    const usedUsd = ((raw.extra_usage.used_credits ?? 0) / 100).toFixed(2);
    const limitUsd = ((raw.extra_usage.monthly_limit ?? 0) / 100).toFixed(2);
    creditsText = `Extra Usage: $${usedUsd} / $${limitUsd}`;
  }

  return {
    credentials: nextCreds,
    credentialsChanged: changed,
    quota: {
      items,
      plan: profile.plan ?? null,
      creditsText,
      forbidden: false,
      fetchedAt: new Date().toISOString(),
    },
  };
}

export async function wakeupClaude(
  creds: StoredCredentials,
  preferredModel?: string | null
): Promise<{
  model: string;
  message: string;
  credentials: StoredCredentials;
  quota: QuotaSnapshot;
}> {
  const model = preferredModel?.trim() || 'claude-haiku-4-5-20251001';

  if (creds.authType === 'api_key' || creds.apiKey) {
    const baseUrl = (creds.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': creds.apiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    if (!res.ok) {
      throw new Error(`ส่งข้อความปลุก Claude API Key ไม่สำเร็จ (${res.status})`);
    }
    const after = await fetchClaudeQuota(creds);
    return {
      model,
      message: 'ปลุก Claude API Key สำเร็จ',
      credentials: after.credentials,
      quota: after.quota,
    };
  }

  if (creds.authType === 'session_key') {
    throw new Error(
      'โหมด Session Key รองรับเฉพาะการเช็คโควต้า หากต้องการสั่ง Wake-up กรุณาเพิ่มบัญชีด้วย Claude OAuth'
    );
  }

  const refreshed = await ensureFreshClaudeToken(creds, false);
  const nextCreds = refreshed.credentials;

  const res = await fetch('https://api.anthropic.com/v1/messages?beta=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${nextCreds.accessToken}`,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': OAUTH_BETA,
      'Content-Type': 'application/json',
      'User-Agent': COCKPIT_UA,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  });

  if (!res.ok) {
    const errTxt = await res.text().catch(() => '');
    throw new Error(`ปลุก Claude OAuth ไม่สำเร็จ (${res.status}): ${errTxt.slice(0, 140)}`);
  }

  const after = await fetchClaudeQuota(nextCreds);
  return {
    model,
    message: 'ปลุกโมเดล Claude สำเร็จและเริ่มนับรอบ 5h แล้ว',
    credentials: after.credentials,
    quota: after.quota,
  };
}
