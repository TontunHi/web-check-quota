import { randomUUID } from 'node:crypto';
import type {
  PlatformId,
  PublicAccount,
  QuotaSnapshot,
  StoredCredentials,
} from '../types';
import {
  buildAntigravityAuthUrl,
  createAntigravityFromRefreshToken,
  exchangeAntigravityCode,
  fetchAntigravityQuota,
  parseAntigravityCallback,
  wakeupAntigravity,
} from './antigravity';
import {
  buildCodexAuthUrl,
  ensureFreshCodexToken,
  exchangeCodexCode,
  extractCodexJwtIdentity,
  fetchCodexQuota,
  parseCodexCallback,
  wakeupCodex,
} from './codex';
import {
  buildClaudeAuthUrl,
  ensureFreshClaudeToken,
  exchangeClaudeCode,
  fetchClaudeOAuthProfile,
  fetchClaudeQuota,
  parseClaudeCallback,
  wakeupClaude,
} from './claude';

export function computeAccountStatus(quota?: QuotaSnapshot | null): PublicAccount['status'] {
  if (!quota) return 'active';
  if (quota.forbidden) return 'forbidden';
  const hasLow = quota.items.some((i) => i.remainingPercent <= 20);
  return hasLow ? 'warning' : 'active';
}

export function startPlatformOAuth(platform: PlatformId): {
  authUrl: string;
  state: string;
  codeVerifier?: string;
  redirectUri: string;
} {
  if (platform === 'antigravity') return buildAntigravityAuthUrl();
  if (platform === 'codex') return buildCodexAuthUrl();
  return buildClaudeAuthUrl();
}

export async function completePlatformOAuth(input: {
  platform: PlatformId;
  callbackUrl: string;
  redirectUri: string;
  codeVerifier?: string | null;
  expectedState?: string | null;
}): Promise<{
  email: string;
  displayName: string | null;
  plan: string | null;
  credentials: StoredCredentials;
  quota: QuotaSnapshot;
}> {
  if (input.platform === 'antigravity') {
    const { code } = parseAntigravityCallback(input.callbackUrl, input.redirectUri);
    const exchanged = await exchangeAntigravityCode(code, input.redirectUri);
    const fetched = await fetchAntigravityQuota(exchanged.credentials);
    return {
      email: exchanged.email,
      displayName: exchanged.displayName,
      plan: fetched.quota.plan ?? null,
      credentials: fetched.credentials,
      quota: fetched.quota,
    };
  }

  if (input.platform === 'codex') {
    if (!input.codeVerifier) {
      throw new Error('เซสชัน OAuth หมดอายุ กรุณากดสร้างลิงก์ยืนยันตัวตนใหม่อีกครั้ง');
    }
    const { code } = parseCodexCallback(input.callbackUrl);
    const exchanged = await exchangeCodexCode(code, input.codeVerifier, input.redirectUri);
    const fetched = await fetchCodexQuota(exchanged.credentials);
    return {
      email: exchanged.email,
      displayName: null,
      plan: fetched.quota.plan ?? exchanged.plan,
      credentials: fetched.credentials,
      quota: fetched.quota,
    };
  }

  // Claude
  if (!input.codeVerifier) {
    throw new Error('เซสชัน OAuth หมดอายุ กรุณากดสร้างลิงก์ยืนยันตัวตนใหม่อีกครั้ง');
  }
  const { code, state } = parseClaudeCallback(input.callbackUrl);
  const exchanged = await exchangeClaudeCode(
    code,
    input.codeVerifier,
    state || input.expectedState || ''
  );
  const fetched = await fetchClaudeQuota(exchanged.credentials);
  return {
    email: exchanged.email,
    displayName: exchanged.displayName,
    plan: fetched.quota.plan ?? exchanged.plan,
    credentials: fetched.credentials,
    quota: fetched.quota,
  };
}

export async function refreshPlatformQuota(
  platform: PlatformId,
  creds: StoredCredentials
): Promise<{
  quota: QuotaSnapshot;
  credentials: StoredCredentials;
  credentialsChanged: boolean;
}> {
  if (platform === 'antigravity') return fetchAntigravityQuota(creds);
  if (platform === 'codex') return fetchCodexQuota(creds);
  return fetchClaudeQuota(creds);
}

export async function runPlatformWakeup(
  platform: PlatformId,
  creds: StoredCredentials,
  model?: string | null
): Promise<{
  model: string;
  message: string;
  credentials: StoredCredentials;
  quota: QuotaSnapshot;
}> {
  if (platform === 'antigravity') return wakeupAntigravity(creds, model);
  if (platform === 'codex') return wakeupCodex(creds, model);
  return wakeupClaude(creds, model);
}

export async function buildAccountFromTokenInput(input: {
  platform: PlatformId;
  email?: string;
  authType?: 'oauth' | 'session_key' | 'api_key';
  token?: string;
  accessToken?: string;
  accountId?: string;
  baseUrl?: string;
}): Promise<{
  id: string;
  email: string;
  displayName: string | null;
  plan: string | null;
  credentials: StoredCredentials;
  quota: QuotaSnapshot;
}> {
  const token = (input.token || '').trim();
  const accessToken = (input.accessToken || '').trim();

  if (input.platform === 'antigravity') {
    const created = await createAntigravityFromRefreshToken(token || accessToken);
    return {
      id: randomUUID(),
      email: input.email?.trim() || created.email,
      displayName: created.displayName,
      plan: created.quota.plan ?? null,
      credentials: created.credentials,
      quota: created.quota,
    };
  }

  if (input.platform === 'codex') {
    const isApiKey =
      input.authType === 'api_key' ||
      (token.startsWith('sk-') && !token.startsWith('sk-ant-'));

    if (isApiKey) {
      const creds: StoredCredentials = {
        authType: 'api_key',
        apiKey: token,
        baseUrl: input.baseUrl?.trim() || undefined,
      };
      const fetched = await fetchCodexQuota(creds);
      return {
        id: randomUUID(),
        email: input.email?.trim() || `codex-key-${token.slice(-6)}`,
        displayName: null,
        plan: fetched.quota.plan ?? 'API KEY',
        credentials: fetched.credentials,
        quota: fetched.quota,
      };
    }

    const initial: StoredCredentials = {
      authType: 'oauth',
      refreshToken: token.startsWith('eyJ') ? undefined : token || undefined,
      accessToken: token.startsWith('eyJ') ? token : accessToken || undefined,
      accountId: input.accountId?.trim() || undefined,
    };
    const refreshed = await ensureFreshCodexToken(initial, !initial.accessToken);
    const identity = extractCodexJwtIdentity(
      refreshed.credentials.idToken,
      refreshed.credentials.accessToken
    );
    const fetched = await fetchCodexQuota(refreshed.credentials);

    return {
      id: randomUUID(),
      email:
        input.email?.trim() ||
        identity.email ||
        `codex-${(fetched.credentials.accountId || 'account').slice(0, 8)}`,
      displayName: null,
      plan: fetched.quota.plan ?? (identity.plan ? identity.plan.toUpperCase() : null),
      credentials: fetched.credentials,
      quota: fetched.quota,
    };
  }

  // Claude
  const mode =
    input.authType ||
    (token.startsWith('sk-ant-sid')
      ? 'session_key'
      : token.startsWith('sk-ant-api')
        ? 'api_key'
        : 'oauth');

  if (mode === 'api_key') {
    const creds: StoredCredentials = {
      authType: 'api_key',
      apiKey: token,
      baseUrl: input.baseUrl?.trim() || undefined,
    };
    const fetched = await fetchClaudeQuota(creds);
    return {
      id: randomUUID(),
      email: input.email?.trim() || `claude-key-${token.slice(-6)}`,
      displayName: null,
      plan: 'API KEY',
      credentials: fetched.credentials,
      quota: fetched.quota,
    };
  }

  if (mode === 'session_key') {
    const creds: StoredCredentials = {
      authType: 'session_key',
      sessionKey: token,
      organizationUuid: input.accountId?.trim() || undefined,
    };
    const fetched = await fetchClaudeQuota(creds);
    return {
      id: randomUUID(),
      email:
        input.email?.trim() ||
        `claude-web-${(fetched.credentials.organizationUuid || token).slice(-6)}`,
      displayName: null,
      plan: fetched.quota.plan ?? null,
      credentials: fetched.credentials,
      quota: fetched.quota,
    };
  }

  const initial: StoredCredentials = {
    authType: 'oauth',
    refreshToken: token.startsWith('sk-ant-oat') ? undefined : token || undefined,
    accessToken: token.startsWith('sk-ant-oat') ? token : accessToken || undefined,
    organizationUuid: input.accountId?.trim() || undefined,
  };
  const refreshed = await ensureFreshClaudeToken(initial, !initial.accessToken);
  const profile = await fetchClaudeOAuthProfile(refreshed.credentials.accessToken!);
  const fetched = await fetchClaudeQuota(refreshed.credentials);

  return {
    id: randomUUID(),
    email: input.email?.trim() || profile.email || `claude-${randomUUID().slice(0, 6)}`,
    displayName: profile.displayName ?? null,
    plan: fetched.quota.plan ?? profile.plan ?? null,
    credentials: fetched.credentials,
    quota: fetched.quota,
  };
}
