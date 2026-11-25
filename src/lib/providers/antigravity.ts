import { randomBytes, randomUUID } from 'node:crypto';
import type { QuotaItem, QuotaSnapshot, StoredCredentials } from '../types';
import {
  buildAntigravityFallbackQuotaItems,
  extractAntigravityAvailableModels,
  getAntigravityDirectFallbackModel,
  normalizeAntigravityWakeupModel,
  PLATFORM_WAKEUP_DEFAULTS,
} from '../models';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const OAUTH_UA = 'vscode/1.X.X (Antigravity/4.3.0)';

function getGoogleOAuthClient(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      'ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID หรือ GOOGLE_CLIENT_SECRET ใน Environment Variables'
    );
  }
  return { clientId, clientSecret };
}

const CLOUD_CODE_DAILY = 'https://daily-cloudcode-pa.googleapis.com';
const CLOUD_CODE_PROD = 'https://cloudcode-pa.googleapis.com';
const LOAD_CODE_ASSIST_UA =
  'antigravity/2.25.0 windows/amd64 google-api-nodejs-client/10.3.0';
const CLOUD_CODE_UA =
  'antigravity/2.25.0 (aidev_client; os_type=windows; arch=amd64; cl=1003475615)';

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cclog',
  'https://www.googleapis.com/auth/experimentsandconfigs',
  'https://www.googleapis.com/auth/aicode',
].join(' ');

function validProjectId(id?: string | null): string | undefined {
  const trimmed = id?.trim();
  if (!trimmed || trimmed === 'aicode-consumers') return undefined;
  return trimmed;
}

function resolveBaseUrl(creds: StoredCredentials): string {
  if (creds.isGcpTos && validProjectId(creds.projectId)) {
    return CLOUD_CODE_PROD;
  }
  return CLOUD_CODE_DAILY;
}

export function buildAntigravityAuthUrl(): {
  authUrl: string;
  state: string;
  redirectUri: string;
} {
  const { clientId } = getGoogleOAuthClient();
  const port = 51200 + (randomBytes(2).readUInt16BE(0) % 8500);
  const redirectUri = `http://localhost:${port}/oauth-callback`;
  const state = randomUUID();

  const url = new URL(AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);

  return { authUrl: url.toString(), state, redirectUri };
}

export function parseAntigravityCallback(
  rawCallbackUrl: string,
  storedRedirectUri?: string
): { code: string; state: string | null } {
  const trimmed = rawCallbackUrl.trim();
  let parsed: URL;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    parsed = new URL(trimmed);
  } else {
    const base = storedRedirectUri
      ? new URL(storedRedirectUri).origin
      : 'http://localhost:54321';
    if (trimmed.startsWith('/')) {
      parsed = new URL(base + trimmed);
    } else {
      parsed = new URL(`${base}/oauth-callback?${trimmed.replace(/^\?/, '')}`);
    }
  }
  const code = parsed.searchParams.get('code')?.trim();
  const state = parsed.searchParams.get('state')?.trim() || null;
  if (!code) {
    throw new Error('ไม่พบพารามิเตอร์ code ใน Callback URL ที่วาง');
  }
  return { code, state };
}

export async function exchangeAntigravityCode(
  code: string,
  redirectUri: string
): Promise<{ email: string; displayName: string | null; credentials: StoredCredentials }> {
  const { clientId, clientSecret } = getGoogleOAuthClient();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': OAUTH_UA,
    },
    body: body.toString(),
  });

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || `แลก OAuth token ไม่สำเร็จ (${res.status})`
    );
  }

  const user = await fetchGoogleUserInfo(data.access_token);
  const nowSec = Math.floor(Date.now() / 1000);

  return {
    email: user.email,
    displayName: user.name ?? null,
    credentials: {
      authType: 'oauth',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
      expiresAt: nowSec + Number(data.expires_in ?? 3600),
    },
  };
}

export async function fetchGoogleUserInfo(
  accessToken: string
): Promise<{ email: string; name?: string }> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`ดึงข้อมูลผู้ใช้ Google ไม่สำเร็จ (${res.status})`);
  }
  const data = (await res.json()) as { email?: string; name?: string };
  if (!data.email) {
    throw new Error('ไม่พบอีเมลจากบัญชี Google');
  }
  return { email: data.email, name: data.name };
}

export async function ensureFreshAntigravityToken(
  creds: StoredCredentials
): Promise<{ credentials: StoredCredentials; changed: boolean }> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (creds.accessToken && creds.expiresAt && creds.expiresAt > nowSec + 900) {
    return { credentials: creds, changed: false };
  }
  if (!creds.refreshToken) {
    if (creds.accessToken) return { credentials: creds, changed: false };
    throw new Error('ไม่มี refresh_token สำหรับรีเฟรชสิทธิ์ Antigravity');
  }

  const { clientId, clientSecret } = getGoogleOAuthClient();
  let lastErr = 'รีเฟรช Google OAuth token ไม่สำเร็จ';
  for (let attempt = 0; attempt < 2; attempt++) {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': OAUTH_UA,
      },
      body: body.toString(),
    });

    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      id_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (res.ok && data.access_token) {
      return {
        changed: true,
        credentials: {
          ...creds,
          accessToken: data.access_token,
          refreshToken: data.refresh_token || creds.refreshToken,
          idToken: data.id_token || creds.idToken,
          expiresAt: Math.floor(Date.now() / 1000) + Number(data.expires_in ?? 3600),
        },
      };
    }

    lastErr = data.error_description || data.error || `HTTP ${res.status}`;
    if (data.error === 'invalid_grant' && attempt === 0) {
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    break;
  }

  throw new Error(lastErr);
}

function formatBucketLabel(bucketId: string, displayName?: string): string {
  const id = bucketId.toLowerCase();
  const is5h = id.includes('5h') || displayName?.toLowerCase().includes('five hour');
  const isWeekly = id.includes('weekly') || displayName?.toLowerCase().includes('weekly');
  const period = is5h ? '5h' : isWeekly ? 'Weekly' : '';

  if (id.startsWith('3p') || id.startsWith('claude')) {
    return period ? `Claude / 3P (${period})` : displayName || bucketId;
  }
  if (id.includes('hydrogen')) {
    return period ? `Gemini Hydrogen (${period})` : displayName || bucketId;
  }
  if (id.includes('argon')) {
    return period ? `Gemini Argon (${period})` : displayName || bucketId;
  }
  if (id.startsWith('gemini')) {
    return period ? `Gemini (${period})` : displayName || bucketId;
  }
  return displayName || bucketId;
}

function normalizePlanTier(rawTier?: string | null): string {
  if (!rawTier) return 'FREE';
  const lower = rawTier.toLowerCase();
  if (lower.includes('ultra')) return 'ULTRA';
  if (lower.includes('pro')) return 'PRO';
  if (lower.includes('free')) return 'FREE';
  return rawTier.toUpperCase();
}

function extractRawProjectId(val: unknown): string | undefined {
  if (typeof val === 'string' && val.trim()) return val.trim();
  if (val && typeof val === 'object' && 'id' in val) {
    const id = String((val as { id?: unknown }).id ?? '').trim();
    if (id) return id;
  }
  return undefined;
}

function extractProjectId(val: unknown): string | undefined {
  return validProjectId(extractRawProjectId(val));
}

async function loadCodeAssist(
  accessToken: string,
  creds: StoredCredentials
): Promise<{
  projectId?: string;
  rawProjectId?: string;
  isGcpTos?: boolean;
  plan: string;
  creditsText: string | null;
}> {
  const baseUrl = resolveBaseUrl(creds);
  const existingProject = validProjectId(creds.projectId);
  const metadata: Record<string, unknown> = {
    ideName: 'antigravity',
    ideType: 'ANTIGRAVITY',
    ideVersion: '2.25.0',
    pluginVersion: '1.3.80',
    platform: 'WINDOWS_AMD64',
    updateChannel: 'stable',
    pluginType: 'GEMINI',
  };
  if (existingProject) metadata.duetProject = existingProject;

  const payload: Record<string, unknown> = {
    metadata,
    mode: 'FULL_ELIGIBILITY_CHECK',
  };
  if (existingProject) payload.cloudaicompanionProject = existingProject;

  const res = await fetch(`${baseUrl}/v1internal:loadCodeAssist`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': LOAD_CODE_ASSIST_UA,
      'x-goog-api-client': 'gl-node/22.21.1',
      Accept: '*/*',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return {
      projectId: existingProject,
      isGcpTos: creds.isGcpTos,
      plan: 'FREE',
      creditsText: null,
    };
  }

  const data = (await res.json()) as {
    paidTier?: {
      id?: string;
      availableCredits?: Array<{ creditType?: string; creditAmount?: string }>;
    };
    currentTier?: { id?: string; usesGcpTos?: boolean };
    allowedTiers?: Array<{ id?: string; isDefault?: boolean; usesGcpTos?: boolean }>;
    cloudaicompanionProject?: unknown;
  };

  const rawTier = data.paidTier?.id ?? data.currentTier?.id ?? null;
  const plan = normalizePlanTier(rawTier);
  const isGcpTos =
    data.currentTier?.usesGcpTos ??
    data.allowedTiers?.find((t) => t.isDefault)?.usesGcpTos ??
    creds.isGcpTos;

  let rawProjectId = extractRawProjectId(data.cloudaicompanionProject);
  let projectId = validProjectId(rawProjectId) ?? existingProject;

  // Onboard fallback if projectId is still absent
  if (!projectId && !rawProjectId) {
    const tierId =
      data.allowedTiers?.find((t) => t.isDefault)?.id ??
      data.allowedTiers?.find((t) => t.id)?.id ??
      rawTier ??
      'free-tier';
    try {
      const onboardRes = await fetch(`${baseUrl}/v1internal:onboardUser`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': LOAD_CODE_ASSIST_UA,
          'x-goog-api-client': 'gl-node/22.21.1',
        },
        body: JSON.stringify({ tierId, metadata }),
      });
      if (onboardRes.ok) {
        const op = (await onboardRes.json()) as {
          done?: boolean;
          name?: string;
          response?: { cloudaicompanionProject?: unknown };
        };
        rawProjectId = extractRawProjectId(op.response?.cloudaicompanionProject);
        projectId = validProjectId(rawProjectId);
      }
    } catch {
      // Ignore onboard fallback errors
    }
  }

  const credits = (data.paidTier?.availableCredits ?? []).filter(
    (c) => c.creditType && c.creditAmount
  );
  const creditsText =
    credits.length > 0
      ? credits.map((c) => `${c.creditType}: ${c.creditAmount}`).join(' · ')
      : null;

  return { projectId, rawProjectId, isGcpTos, plan, creditsText };
}

export async function fetchAntigravityQuota(creds: StoredCredentials): Promise<{
  quota: QuotaSnapshot;
  credentials: StoredCredentials;
  credentialsChanged: boolean;
}> {
  const refreshed = await ensureFreshAntigravityToken(creds);
  let nextCreds = refreshed.credentials;
  let changed = refreshed.changed;

  const assist = await loadCodeAssist(nextCreds.accessToken!, nextCreds);
  if (
    (assist.projectId && assist.projectId !== nextCreds.projectId) ||
    (assist.isGcpTos !== undefined && assist.isGcpTos !== nextCreds.isGcpTos)
  ) {
    nextCreds = {
      ...nextCreds,
      projectId: assist.projectId ?? nextCreds.projectId,
      isGcpTos: assist.isGcpTos ?? nextCreds.isGcpTos,
    };
    changed = true;
  }

  const baseUrl = resolveBaseUrl(nextCreds);
  const projectBody = validProjectId(nextCreds.projectId)
    ? { project: validProjectId(nextCreds.projectId) }
    : {};

  const modelsRes = await fetch(`${baseUrl}/v1internal:fetchAvailableModels`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${nextCreds.accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': CLOUD_CODE_UA,
    },
    body: JSON.stringify(projectBody),
  });

  if (modelsRes.status === 403) {
    const errBody = (await modelsRes.json().catch(() => ({}))) as {
      error?: { message?: string; details?: Array<{ reason?: string }> };
    };
    const reason =
      errBody.error?.details?.[0]?.reason ||
      errBody.error?.message ||
      '403 Forbidden (ต้องยืนยันบัญชีหรือไม่มีสิทธิ์ Cloud Code)';
    return {
      credentials: nextCreds,
      credentialsChanged: changed,
      quota: {
        items: [],
        plan: assist.plan,
        creditsText: assist.creditsText,
        forbidden: true,
        forbiddenReason: reason,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  if (!modelsRes.ok) {
    throw new Error(`ดึงโควต้า Antigravity ไม่สำเร็จ (${modelsRes.status})`);
  }

  type RawAntigravityModel = {
    displayName?: string;
    model?: string;
    recommended?: boolean;
    quotaInfo?: { remainingFraction?: number; resetTime?: string };
  };
  type RawAgentModelSort = {
    groups?: Array<{ modelIds?: string[] | null } | null> | null;
  };

  const modelsData = (await modelsRes.json()) as {
    agentModelSorts?: RawAgentModelSort[] | null;
    models?: Record<string, RawAntigravityModel>;
    payload?: {
      agentModelSorts?: RawAgentModelSort[] | null;
      models?: Record<string, RawAntigravityModel>;
    };
  };

  const availableModels = extractAntigravityAvailableModels(modelsData);
  const items: QuotaItem[] = [];

  // 1) Try summary buckets (5h & weekly) first
  try {
    const summaryRes = await fetch(`${baseUrl}/v1internal:retrieveUserQuotaSummary`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${nextCreds.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': CLOUD_CODE_UA,
      },
      body: JSON.stringify(projectBody),
    });
    if (summaryRes.ok) {
      const summaryData = (await summaryRes.json()) as {
        groups?: Array<{
          buckets?: Array<{
            bucketId?: string;
            displayName?: string;
            remainingFraction?: number;
            resetTime?: string;
          }>;
        }>;
      };
      for (const group of summaryData.groups ?? []) {
        for (const bucket of group.buckets ?? []) {
          if (bucket.bucketId && typeof bucket.remainingFraction === 'number') {
            items.push({
              key: `bucket:${bucket.bucketId}`,
              label: formatBucketLabel(bucket.bucketId, bucket.displayName),
              remainingPercent: Math.max(
                0,
                Math.min(100, Math.trunc(bucket.remainingFraction * 100))
              ),
              resetAt: bucket.resetTime || null,
            });
          }
        }
      }
      items.sort(
        (a, b) =>
          bucketSortPriority(a.key.slice('bucket:'.length)) -
          bucketSortPriority(b.key.slice('bucket:'.length))
      );
    }
  } catch {
    // Summary endpoint is optional
  }

  // 2) Fall back to grouped canonical models when summary buckets are empty
  if (items.length === 0) {
    items.push(...buildAntigravityFallbackQuotaItems(availableModels));
  }

  return {
    credentials: nextCreds,
    credentialsChanged: changed,
    quota: {
      items,
      availableModels,
      plan: assist.plan,
      creditsText: assist.creditsText,
      forbidden: false,
      fetchedAt: new Date().toISOString(),
    },
  };
}

function bucketSortPriority(bucketId: string): number {
  const id = bucketId.trim().toLowerCase();
  if (id === 'gemini-5h' || id === 'gemini:5h') return 0;
  if (id === 'gemini-weekly' || id === 'gemini:weekly') return 1;
  if (id === '3p-5h' || id === 'claude:5h') return 2;
  if (id === '3p-weekly' || id === 'claude:weekly') return 3;
  if (
    id === 'argon-5h' ||
    id === 'argon:5h' ||
    id === 'gemini-argon-5h' ||
    (id.includes('argon') && id.includes('5h'))
  ) {
    return 4;
  }
  if (
    id === 'argon-weekly' ||
    id === 'argon:weekly' ||
    id === 'gemini-argon-wtu-weekly' ||
    (id.includes('argon') && id.includes('weekly'))
  ) {
    return 5;
  }
  if (id.includes('hydrogen') && id.includes('5h')) {
    return 6;
  }
  if (id.includes('hydrogen') && id.includes('weekly')) {
    return 7;
  }
  return 8;
}

async function sendAntigravityStreamWakeup(
  targetHost: string,
  accessToken: string,
  streamProject: string,
  model: string
): Promise<Response> {
  const suffix = randomBytes(3).toString('hex');
  const nowMs = Date.now();
  const reqBody = {
    project: streamProject,
    requestId: `req_${nowMs}_${suffix}`,
    model,
    userAgent: 'antigravity',
    requestType: 'agent',
    request: {
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
      session_id: `sess_${nowMs}_${suffix}`,
      systemInstruction: {
        parts: [
          {
            text: 'You are Antigravity, a powerful agentic AI coding assistant designed by the Google Deepmind team working on Advanced Agentic Coding.',
          },
        ],
      },
      generationConfig: { temperature: 0 },
    },
  };

  return fetch(`${targetHost}/v1internal:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'antigravity',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(reqBody),
  });
}

export async function wakeupAntigravity(
  creds: StoredCredentials,
  preferredModel?: string | null
): Promise<{
  model: string;
  message: string;
  credentials: StoredCredentials;
  quota: QuotaSnapshot;
}> {
  const refreshed = await ensureFreshAntigravityToken(creds);
  let nextCreds = refreshed.credentials;

  const assist = await loadCodeAssist(nextCreds.accessToken!, nextCreds);
  const gcpProjectId = assist.projectId ?? validProjectId(nextCreds.projectId);
  const streamProject = gcpProjectId ?? assist.rawProjectId ?? 'aicode-consumers';

  nextCreds = {
    ...nextCreds,
    projectId: gcpProjectId ?? nextCreds.projectId,
    isGcpTos: assist.isGcpTos ?? nextCreds.isGcpTos,
  };

  const requestedModels = (preferredModel?.trim() || PLATFORM_WAKEUP_DEFAULTS.antigravity)
    .split('+')
    .map(normalizeAntigravityWakeupModel)
    .filter(Boolean);
  const uniqueModels = Array.from(new Set(requestedModels));

  const targetHost = resolveBaseUrl(nextCreds);
  const replies: string[] = [];

  for (const model of uniqueModels) {
    let label = model;
    let res = await sendAntigravityStreamWakeup(
      targetHost,
      nextCreds.accessToken!,
      streamProject,
      model
    );

    if (!res.ok && (res.status === 400 || res.status === 404)) {
      const fallback = getAntigravityDirectFallbackModel(model);
      if (fallback !== model) {
        const retryRes = await sendAntigravityStreamWakeup(
          targetHost,
          nextCreds.accessToken!,
          streamProject,
          fallback
        );
        if (!retryRes.ok) {
          const errTxt = await retryRes.text().catch(() => '');
          throw new Error(
            `HTTP ${retryRes.status} (${fallback}): ${errTxt.slice(0, 140)}`
          );
        }
        res = retryRes;
        label = `${model} -> ${fallback}`;
      }
    }

    if (!res.ok) {
      const errTxt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} (${model}): ${errTxt.slice(0, 140)}`);
    }

    const rawText = await res.text();
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('data:') && l !== 'data: [DONE]');

    if (lines.length === 0 && !rawText.trim()) {
      throw new Error(`Cloud Code stream ไม่ส่งข้อมูลกลับมา (${model})`);
    }

    let replySnippet = '';
    for (const line of lines) {
      try {
        const json = JSON.parse(line.slice(5).trim()) as {
          response?: {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string; thought?: boolean }> };
            }>;
          };
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string; thought?: boolean }> };
          }>;
        };
        const parts =
          json.response?.candidates?.[0]?.content?.parts ??
          json.candidates?.[0]?.content?.parts ??
          [];
        for (const p of parts) {
          if (!p.thought && p.text) replySnippet += p.text;
        }
      } catch {
        // Ignore partial chunk parse error
      }
    }
    replies.push(
      replySnippet.trim()
        ? `${label}: "${replySnippet.trim().slice(0, 40)}"`
        : `${label}: OK`
    );
  }

  const afterQuota = await fetchAntigravityQuota(nextCreds);
  return {
    model: uniqueModels.join(' + '),
    message: `ปลุกโมเดลสำเร็จ (${replies.join(', ')})`,
    credentials: afterQuota.credentials,
    quota: afterQuota.quota,
  };
}

export async function createAntigravityFromRefreshToken(refreshToken: string): Promise<{
  email: string;
  displayName: string | null;
  credentials: StoredCredentials;
  quota: QuotaSnapshot;
}> {
  const cleaned = refreshToken.trim();
  const initial: StoredCredentials = {
    authType: 'oauth',
    refreshToken: cleaned,
  };
  const refreshed = await ensureFreshAntigravityToken(initial);
  const user = await fetchGoogleUserInfo(refreshed.credentials.accessToken!);
  const fetched = await fetchAntigravityQuota(refreshed.credentials);

  return {
    email: user.email,
    displayName: user.name ?? null,
    credentials: fetched.credentials,
    quota: fetched.quota,
  };
}
