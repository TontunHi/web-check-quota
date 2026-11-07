import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { QuotaItem, QuotaSnapshot, StoredCredentials } from '../types';

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const AUTH_URL = 'https://auth.openai.com/oauth/authorize';
const TOKEN_URL = 'https://auth.openai.com/oauth/token';
const DEFAULT_REDIRECT_URI = 'http://localhost:1455/auth/callback';
const WHAM_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';
const CODEX_RESPONSES_URL = 'https://chatgpt.com/backend-api/codex/responses';
const DESKTOP_UA = 'Codex Desktop/0.1.0 (Windows 10.0.22631; x86_64)';
const TUI_UA =
  'codex-tui/0.153.4 (Mac OS 26.5.0; arm64) iTerm.app/3.6.10 (codex-tui; 0.153.4)';

const SCOPES =
  'openid profile email offline_access api.connectors.read api.connectors.invoke';

function decodeJwtPayload(jwt?: string | null): Record<string, unknown> | null {
  if (!jwt) return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

export function extractCodexJwtIdentity(
  idToken?: string | null,
  accessToken?: string | null
): {
  email?: string;
  accountId?: string;
  plan?: string;
  expiresAt?: number;
} {
  const idPayload = decodeJwtPayload(idToken);
  const accPayload = decodeJwtPayload(accessToken);

  const profileObj = (idPayload?.['https://api.openai.com/profile'] ??
    accPayload?.['https://api.openai.com/profile']) as
    | { email?: string }
    | undefined;

  const email =
    (typeof idPayload?.email === 'string' ? idPayload.email : undefined) ??
    (typeof accPayload?.email === 'string' ? accPayload.email : undefined) ??
    profileObj?.email;

  const authObj = (accPayload?.['https://api.openai.com/auth'] ??
    idPayload?.['https://api.openai.com/auth']) as
    | {
        chatgpt_account_id?: string;
        account_id?: string;
        chatgpt_plan_type?: string;
      }
    | undefined;

  const accountId = authObj?.chatgpt_account_id ?? authObj?.account_id;
  const plan = authObj?.chatgpt_plan_type;
  const expiresAt =
    typeof accPayload?.exp === 'number' ? accPayload.exp : undefined;

  return { email, accountId, plan, expiresAt };
}

export function buildCodexAuthUrl(): {
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
  const stableId = randomUUID();

  const url = new URL(AUTH_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', DEFAULT_REDIRECT_URI);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('id_token_add_organizations', 'true');
  url.searchParams.set('codex_cli_simplified_flow', 'true');
  url.searchParams.set('codex_streamlined_login', 'true');
  url.searchParams.set('state', state);
  url.searchParams.set('originator', 'Codex Desktop');
  url.searchParams.set('codex_app_version', '0.1.0');
  url.searchParams.set('source_surface_stable_id', stableId);
  url.searchParams.set('codex_origin_stable_id', stableId);

  return {
    authUrl: url.toString(),
    state,
    codeVerifier,
    redirectUri: DEFAULT_REDIRECT_URI,
  };
}

export function parseCodexCallback(raw: string): {
  code: string;
  state: string | null;
} {
  const trimmed = raw.trim();
  let parsed: URL;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    parsed = new URL(trimmed);
  } else if (trimmed.startsWith('/')) {
    parsed = new URL(`http://localhost:1455${trimmed}`);
  } else {
    parsed = new URL(
      `http://localhost:1455/auth/callback?${trimmed.replace(/^\?/, '')}`
    );
  }
  const code = parsed.searchParams.get('code')?.trim();
  const state = parsed.searchParams.get('state')?.trim() || null;
  if (!code) {
    throw new Error('ไม่พบพารามิเตอร์ code ใน Callback URL ของ Codex');
  }
  return { code, state };
}

export async function exchangeCodexCode(
  code: string,
  codeVerifier: string,
  redirectUri = DEFAULT_REDIRECT_URI
): Promise<{
  email: string;
  plan: string | null;
  credentials: StoredCredentials;
}> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await res.json().catch(() => ({}))) as {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || `แลก Codex OAuth token ไม่สำเร็จ (${res.status})`
    );
  }

  const identity = extractCodexJwtIdentity(data.id_token, data.access_token);
  return {
    email: identity.email || `codex-${(identity.accountId || 'user').slice(0, 8)}`,
    plan: identity.plan ? identity.plan.toUpperCase() : null,
    credentials: {
      authType: 'oauth',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
      accountId: identity.accountId,
      expiresAt: identity.expiresAt,
    },
  };
}

export async function ensureFreshCodexToken(
  creds: StoredCredentials,
  force = false
): Promise<{ credentials: StoredCredentials; changed: boolean }> {
  if (creds.authType === 'api_key' || creds.apiKey) {
    return { credentials: creds, changed: false };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const jwtExp = extractCodexJwtIdentity(creds.idToken, creds.accessToken).expiresAt;
  const effectiveExp = creds.expiresAt ?? jwtExp;

  const needsRefresh =
    force ||
    !creds.accessToken ||
    (typeof effectiveExp === 'number' && effectiveExp <= nowSec + 300);

  if (!needsRefresh) {
    return { credentials: creds, changed: false };
  }

  if (!creds.refreshToken) {
    if (creds.accessToken && !force) return { credentials: creds, changed: false };
    throw new Error('ไม่มี refresh_token สำหรับรีเฟรชสิทธิ์ Codex');
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': DESKTOP_UA,
      originator: 'Codex Desktop',
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    id_token?: string;
    refresh_token?: string;
    error?: { message?: string; code?: string } | string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    const errMsg =
      typeof data.error === 'string'
        ? data.error_description || data.error
        : data.error?.message || data.error?.code || `HTTP ${res.status}`;
    throw new Error(`รีเฟรช Codex token ไม่สำเร็จ: ${errMsg}`);
  }

  const nextIdToken = data.id_token || creds.idToken;
  const identity = extractCodexJwtIdentity(nextIdToken, data.access_token);

  return {
    changed: true,
    credentials: {
      ...creds,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || creds.refreshToken,
      idToken: nextIdToken,
      accountId: creds.accountId || identity.accountId,
      expiresAt: identity.expiresAt,
    },
  };
}

function windowResetIso(w?: {
  reset_at?: number;
  reset_after_seconds?: number;
}): string | null {
  if (!w) return null;
  if (typeof w.reset_at === 'number' && w.reset_at > 0) {
    const ms = w.reset_at > 10_000_000_000 ? w.reset_at : w.reset_at * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof w.reset_after_seconds === 'number' && w.reset_after_seconds > 0) {
    return new Date(Date.now() + w.reset_after_seconds * 1000).toISOString();
  }
  return null;
}

function remainingFromUsed(usedPercent?: number): number {
  if (typeof usedPercent !== 'number' || !Number.isFinite(usedPercent)) return 100;
  return Math.max(0, Math.min(100, Math.ceil(100 - usedPercent)));
}

function formatCodexPlan(raw?: string | null): string | null {
  if (!raw) return null;
  const k = raw.toLowerCase();
  if (k === 'prolite' || k === 'pro-lite' || k === 'chatgptprolite') return 'PRO LITE';
  if (k === 'promax' || k === 'pro-max' || k === 'chatgptpromax') return 'PRO MAX';
  if (k === 'chatgptpro') return 'PRO';
  return raw.toUpperCase();
}

export async function fetchCodexQuota(creds: StoredCredentials): Promise<{
  quota: QuotaSnapshot;
  credentials: StoredCredentials;
  credentialsChanged: boolean;
}> {
  if (creds.authType === 'api_key' || creds.apiKey) {
    const baseUrl = (creds.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const probe = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    if (!probe.ok) {
      throw new Error(`ตรวจสอบ API Key ไม่สำเร็จ (HTTP ${probe.status})`);
    }
    return {
      credentials: creds,
      credentialsChanged: false,
      quota: {
        items: [
          {
            key: 'apikey:status',
            label: 'API Key พร้อมใช้งาน',
            remainingPercent: 100,
            detail: baseUrl,
          },
        ],
        plan: 'API KEY',
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  let refreshed = await ensureFreshCodexToken(creds, false);
  let nextCreds = refreshed.credentials;
  let changed = refreshed.changed;

  const buildHeaders = (token: string, accountId?: string) => {
    const h: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'User-Agent': DESKTOP_UA,
      originator: 'Codex Desktop',
      Accept: 'application/json',
    };
    if (accountId) h['ChatGPT-Account-Id'] = accountId;
    return h;
  };

  let res = await fetch(WHAM_USAGE_URL, {
    headers: buildHeaders(nextCreds.accessToken!, nextCreds.accountId),
  });

  if (res.status === 401 && nextCreds.refreshToken) {
    refreshed = await ensureFreshCodexToken(nextCreds, true);
    nextCreds = refreshed.credentials;
    changed = true;
    res = await fetch(WHAM_USAGE_URL, {
      headers: buildHeaders(nextCreds.accessToken!, nextCreds.accountId),
    });
  }

  if (res.status === 403) {
    const txt = await res.text().catch(() => '');
    const isCf = txt.toLowerCase().includes('cloudflare') || txt.includes('Just a moment');
    return {
      credentials: nextCreds,
      credentialsChanged: changed,
      quota: {
        items: [],
        plan: null,
        forbidden: true,
        forbiddenReason: isCf
          ? 'ติด Cloudflare Challenge บน chatgpt.com จาก IP เซิร์ฟเวอร์'
          : `403 Forbidden: ${txt.slice(0, 100)}`,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  if (!res.ok) {
    throw new Error(`ดึงโควต้า Codex (wham/usage) ไม่สำเร็จ (${res.status})`);
  }

  const data = (await res.json()) as {
    account_id?: string;
    plan_type?: string;
    rate_limit?: {
      primary_window?: {
        used_percent?: number;
        reset_at?: number;
        reset_after_seconds?: number;
      };
      secondary_window?: {
        used_percent?: number;
        reset_at?: number;
        reset_after_seconds?: number;
      };
    };
    code_review_rate_limit?: {
      primary_window?: {
        used_percent?: number;
        reset_at?: number;
        reset_after_seconds?: number;
      };
    };
    additional_rate_limits?: Array<{
      limit_name?: string;
      rate_limit?: {
        primary_window?: {
          used_percent?: number;
          reset_at?: number;
          reset_after_seconds?: number;
        };
      };
    }>;
    credits?: { balance?: string | number; remaining?: number; unlimited?: boolean };
    rate_limit_reset_credits?: { available_count?: number };
  };

  if (data.account_id && !nextCreds.accountId) {
    nextCreds = { ...nextCreds, accountId: data.account_id };
    changed = true;
  }

  const weeklyRem = remainingFromUsed(data.rate_limit?.secondary_window?.used_percent);
  const rawHourlyRem = remainingFromUsed(data.rate_limit?.primary_window?.used_percent);
  const hourlyRem = weeklyRem === 0 ? 0 : rawHourlyRem;

  const items: QuotaItem[] = [
    {
      key: 'window:5h',
      label: '5h Window (รอบ 5 ชั่วโมง)',
      remainingPercent: hourlyRem,
      resetAt: windowResetIso(data.rate_limit?.primary_window),
    },
    {
      key: 'window:7d',
      label: 'Weekly Window (รอบ 7 วัน)',
      remainingPercent: weeklyRem,
      resetAt: windowResetIso(data.rate_limit?.secondary_window),
    },
  ];

  if (data.code_review_rate_limit?.primary_window) {
    items.push({
      key: 'window:code_review',
      label: 'Code Review',
      remainingPercent: remainingFromUsed(
        data.code_review_rate_limit.primary_window.used_percent
      ),
      resetAt: windowResetIso(data.code_review_rate_limit.primary_window),
    });
  }

  for (const extra of data.additional_rate_limits ?? []) {
    if (extra.limit_name && extra.rate_limit?.primary_window) {
      items.push({
        key: `extra:${extra.limit_name}`,
        label: extra.limit_name,
        remainingPercent: remainingFromUsed(extra.rate_limit.primary_window.used_percent),
        resetAt: windowResetIso(extra.rate_limit.primary_window),
      });
    }
  }

  const creditParts: string[] = [];
  if (data.credits?.unlimited) {
    creditParts.push('Credits: Unlimited');
  } else if (data.credits?.balance !== undefined) {
    creditParts.push(`Credits: $${data.credits.balance}`);
  }
  if (typeof data.rate_limit_reset_credits?.available_count === 'number') {
    creditParts.push(`Reset credits: ${data.rate_limit_reset_credits.available_count}`);
  }

  return {
    credentials: nextCreds,
    credentialsChanged: changed,
    quota: {
      items,
      plan: formatCodexPlan(data.plan_type),
      creditsText: creditParts.length > 0 ? creditParts.join(' · ') : null,
      forbidden: false,
      fetchedAt: new Date().toISOString(),
    },
  };
}

export async function wakeupCodex(
  creds: StoredCredentials,
  preferredModel?: string | null
): Promise<{
  model: string;
  message: string;
  credentials: StoredCredentials;
  quota: QuotaSnapshot;
}> {
  if (creds.authType === 'api_key' || creds.apiKey) {
    const baseUrl = (creds.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const model = preferredModel?.trim() || 'gpt-4.1-mini';
    const res = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: 'hi',
        max_output_tokens: 16,
      }),
    });
    if (!res.ok) {
      throw new Error(`API Key wake-up ล้มเหลว (${res.status})`);
    }
    const fetched = await fetchCodexQuota(creds);
    return {
      model,
      message: 'ส่งคำสั่งทดสอบ API Key สำเร็จ',
      credentials: fetched.credentials,
      quota: fetched.quota,
    };
  }

  const refreshed = await ensureFreshCodexToken(creds, false);
  const nextCreds = refreshed.credentials;
  const model = preferredModel?.trim() || 'gpt-5-codex';

  const installationId = randomUUID();
  const sessionId = randomUUID();
  const turnId = randomUUID();
  const requestId = randomUUID();
  const windowId = `${sessionId}:0`;
  const turnMeta = JSON.stringify({
    prompt_cache_key: sessionId,
    turn_id: turnId,
    window_id: windowId,
  });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${nextCreds.accessToken}`,
    'User-Agent': TUI_UA,
    Originator: 'codex-tui',
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
    'Session-Id': sessionId,
    'thread-id': sessionId,
    conversation_id: sessionId,
    'x-client-request-id': requestId,
    'x-codex-installation-id': installationId,
    'x-codex-window-id': windowId,
    'x-codex-turn-metadata': turnMeta,
  };
  if (nextCreds.accountId) {
    headers['ChatGPT-Account-Id'] = nextCreds.accountId;
  }

  const body = {
    model,
    input: [
      {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'hi' }],
      },
    ],
    instructions: '',
    reasoning: { effort: 'low', summary: 'auto' },
    parallel_tool_calls: false,
    store: false,
    stream: true,
    prompt_cache_key: sessionId,
  };

  const res = await fetch(CODEX_RESPONSES_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errTxt = await res.text().catch(() => '');
    throw new Error(`ปลุก Codex ไม่สำเร็จ (HTTP ${res.status}): ${errTxt.slice(0, 140)}`);
  }

  await res.text();
  const after = await fetchCodexQuota(nextCreds);

  return {
    model,
    message: 'ปลุกบัญชี Codex สำเร็จและอัปเดตเวลาเริ่มรอบ 5h แล้ว',
    credentials: after.credentials,
    quota: after.quota,
  };
}
