import { neon } from '@neondatabase/serverless';
import { decryptJson, encryptJson } from './crypto';
import type {
  PlatformId,
  PublicAccount,
  QuotaSnapshot,
  StoredCredentials,
  WakeupLogItem,
} from './types';

function getSql() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  return neon(rawUrl);
}

let schemaReady = false;

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS cockpit_accounts (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      email TEXT NOT NULL,
      display_name TEXT,
      plan TEXT,
      group_name TEXT,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      note TEXT,
      credentials_enc TEXT NOT NULL,
      quota_snapshot JSONB,
      status TEXT NOT NULL DEFAULT 'active',
      last_error TEXT,
      wakeup_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      wakeup_model TEXT,
      last_refreshed_at TIMESTAMPTZ,
      last_wakeup_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (platform, email)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_cockpit_accounts_platform
    ON cockpit_accounts (platform, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS cockpit_wakeup_logs (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES cockpit_accounts(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      email TEXT NOT NULL,
      model TEXT NOT NULL,
      trigger_source TEXT NOT NULL DEFAULT 'manual',
      success BOOLEAN NOT NULL,
      message TEXT NOT NULL,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_cockpit_wakeup_logs_created
    ON cockpit_wakeup_logs (created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS cockpit_oauth_states (
      state TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      code_verifier TEXT,
      redirect_uri TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  schemaReady = true;
}

export interface AccountRowWithSecret extends PublicAccount {
  credentials: StoredCredentials;
}

function mapPublicRow(row: Record<string, unknown>): PublicAccount {
  const tagsRaw = row.tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.map((t) => String(t))
    : typeof tagsRaw === 'string'
      ? (JSON.parse(tagsRaw) as string[])
      : [];

  const quotaRaw = row.quota_snapshot;
  const quota =
    quotaRaw && typeof quotaRaw === 'object'
      ? (quotaRaw as QuotaSnapshot)
      : typeof quotaRaw === 'string'
        ? (JSON.parse(quotaRaw) as QuotaSnapshot)
        : null;

  return {
    id: String(row.id),
    platform: row.platform as PlatformId,
    email: String(row.email),
    displayName: row.display_name ? String(row.display_name) : null,
    plan: row.plan ? String(row.plan) : null,
    groupName: row.group_name ? String(row.group_name) : null,
    tags,
    note: row.note ? String(row.note) : null,
    wakeupEnabled: Boolean(row.wakeup_enabled),
    wakeupModel: row.wakeup_model ? String(row.wakeup_model) : null,
    status: (row.status as PublicAccount['status']) || 'active',
    lastError: row.last_error ? String(row.last_error) : null,
    quota,
    lastRefreshedAt: row.last_refreshed_at
      ? new Date(String(row.last_refreshed_at)).toISOString()
      : null,
    lastWakeupAt: row.last_wakeup_at
      ? new Date(String(row.last_wakeup_at)).toISOString()
      : null,
    createdAt: row.created_at
      ? new Date(String(row.created_at)).toISOString()
      : new Date().toISOString(),
  };
}

export async function listPublicAccounts(): Promise<PublicAccount[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      id, platform, email, display_name, plan, group_name, tags, note,
      quota_snapshot, status, last_error, wakeup_enabled, wakeup_model,
      last_refreshed_at, last_wakeup_at, created_at
    FROM cockpit_accounts
    ORDER BY created_at ASC
  `;
  return rows.map((r) => mapPublicRow(r as Record<string, unknown>));
}

export async function getAccountWithSecret(id: string): Promise<AccountRowWithSecret | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM cockpit_accounts WHERE id = ${id} LIMIT 1
  `;
  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;
  const pub = mapPublicRow(row);
  const credentials = decryptJson<StoredCredentials>(String(row.credentials_enc));
  return { ...pub, credentials };
}

export async function listAccountsWithSecret(opts?: {
  platform?: PlatformId;
  wakeupOnly?: boolean;
}): Promise<AccountRowWithSecret[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = opts?.wakeupOnly
    ? await sql`SELECT * FROM cockpit_accounts WHERE wakeup_enabled = TRUE ORDER BY created_at ASC`
    : opts?.platform
      ? await sql`SELECT * FROM cockpit_accounts WHERE platform = ${opts.platform} ORDER BY created_at ASC`
      : await sql`SELECT * FROM cockpit_accounts ORDER BY created_at ASC`;

  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      ...mapPublicRow(row),
      credentials: decryptJson<StoredCredentials>(String(row.credentials_enc)),
    };
  });
}

export async function upsertAccount(input: {
  id: string;
  platform: PlatformId;
  email: string;
  displayName?: string | null;
  plan?: string | null;
  groupName?: string | null;
  tags?: string[];
  note?: string | null;
  credentials: StoredCredentials;
  quota?: QuotaSnapshot | null;
  status?: PublicAccount['status'];
  lastError?: string | null;
  wakeupEnabled?: boolean;
  wakeupModel?: string | null;
}): Promise<PublicAccount> {
  await ensureSchema();
  const sql = getSql();
  const enc = encryptJson(input.credentials);
  const tagsJson = JSON.stringify(input.tags ?? []);
  const quotaJson = input.quota ? JSON.stringify(input.quota) : null;
  const refreshedAt = input.quota ? new Date().toISOString() : null;

  const rows = await sql`
    INSERT INTO cockpit_accounts (
      id, platform, email, display_name, plan, group_name, tags, note,
      credentials_enc, quota_snapshot, status, last_error,
      wakeup_enabled, wakeup_model, last_refreshed_at, updated_at
    ) VALUES (
      ${input.id},
      ${input.platform},
      ${input.email.trim().toLowerCase()},
      ${input.displayName ?? null},
      ${input.plan ?? input.quota?.plan ?? null},
      ${input.groupName ?? null},
      ${tagsJson}::jsonb,
      ${input.note ?? null},
      ${enc},
      ${quotaJson}::jsonb,
      ${input.status ?? 'active'},
      ${input.lastError ?? null},
      ${input.wakeupEnabled ?? false},
      ${input.wakeupModel ?? null},
      ${refreshedAt},
      NOW()
    )
    ON CONFLICT (platform, email) DO UPDATE SET
      display_name = COALESCE(EXCLUDED.display_name, cockpit_accounts.display_name),
      plan = COALESCE(EXCLUDED.plan, cockpit_accounts.plan),
      group_name = COALESCE(EXCLUDED.group_name, cockpit_accounts.group_name),
      tags = CASE
        WHEN jsonb_array_length(EXCLUDED.tags) > 0 THEN EXCLUDED.tags
        ELSE cockpit_accounts.tags
      END,
      note = COALESCE(EXCLUDED.note, cockpit_accounts.note),
      credentials_enc = EXCLUDED.credentials_enc,
      quota_snapshot = COALESCE(EXCLUDED.quota_snapshot, cockpit_accounts.quota_snapshot),
      status = EXCLUDED.status,
      last_error = EXCLUDED.last_error,
      last_refreshed_at = COALESCE(EXCLUDED.last_refreshed_at, cockpit_accounts.last_refreshed_at),
      updated_at = NOW()
    RETURNING
      id, platform, email, display_name, plan, group_name, tags, note,
      quota_snapshot, status, last_error, wakeup_enabled, wakeup_model,
      last_refreshed_at, last_wakeup_at, created_at
  `;

  return mapPublicRow(rows[0] as Record<string, unknown>);
}

export async function updateAccountAfterRefresh(input: {
  id: string;
  credentials?: StoredCredentials;
  quota?: QuotaSnapshot | null;
  plan?: string | null;
  status: PublicAccount['status'];
  lastError: string | null;
}): Promise<PublicAccount | null> {
  await ensureSchema();
  const sql = getSql();
  const quotaJson = input.quota ? JSON.stringify(input.quota) : null;

  const rows = input.credentials
    ? await sql`
        UPDATE cockpit_accounts
        SET
          credentials_enc = ${encryptJson(input.credentials)},
          quota_snapshot = COALESCE(${quotaJson}::jsonb, quota_snapshot),
          plan = COALESCE(${input.plan ?? input.quota?.plan ?? null}, plan),
          status = ${input.status},
          last_error = ${input.lastError},
          last_refreshed_at = CASE WHEN ${quotaJson}::jsonb IS NOT NULL THEN NOW() ELSE last_refreshed_at END,
          updated_at = NOW()
        WHERE id = ${input.id}
        RETURNING
          id, platform, email, display_name, plan, group_name, tags, note,
          quota_snapshot, status, last_error, wakeup_enabled, wakeup_model,
          last_refreshed_at, last_wakeup_at, created_at
      `
    : await sql`
        UPDATE cockpit_accounts
        SET
          quota_snapshot = COALESCE(${quotaJson}::jsonb, quota_snapshot),
          plan = COALESCE(${input.plan ?? input.quota?.plan ?? null}, plan),
          status = ${input.status},
          last_error = ${input.lastError},
          last_refreshed_at = CASE WHEN ${quotaJson}::jsonb IS NOT NULL THEN NOW() ELSE last_refreshed_at END,
          updated_at = NOW()
        WHERE id = ${input.id}
        RETURNING
          id, platform, email, display_name, plan, group_name, tags, note,
          quota_snapshot, status, last_error, wakeup_enabled, wakeup_model,
          last_refreshed_at, last_wakeup_at, created_at
      `;

  if (rows.length === 0) return null;
  return mapPublicRow(rows[0] as Record<string, unknown>);
}

export async function updateAccountMeta(
  id: string,
  patch: {
    displayName?: string | null;
    groupName?: string | null;
    tags?: string[];
    note?: string | null;
    wakeupEnabled?: boolean;
    wakeupModel?: string | null;
  }
): Promise<PublicAccount | null> {
  await ensureSchema();
  const sql = getSql();
  const current = await getAccountWithSecret(id);
  if (!current) return null;

  const nextDisplay = patch.displayName !== undefined ? patch.displayName : current.displayName;
  const nextGroup = patch.groupName !== undefined ? patch.groupName : current.groupName;
  const nextTags = JSON.stringify(patch.tags !== undefined ? patch.tags : current.tags);
  const nextNote = patch.note !== undefined ? patch.note : current.note;
  const nextWakeEnabled =
    patch.wakeupEnabled !== undefined ? patch.wakeupEnabled : current.wakeupEnabled;
  const nextWakeModel =
    patch.wakeupModel !== undefined ? patch.wakeupModel : current.wakeupModel;

  const rows = await sql`
    UPDATE cockpit_accounts
    SET
      display_name = ${nextDisplay},
      group_name = ${nextGroup},
      tags = ${nextTags}::jsonb,
      note = ${nextNote},
      wakeup_enabled = ${nextWakeEnabled},
      wakeup_model = ${nextWakeModel},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING
      id, platform, email, display_name, plan, group_name, tags, note,
      quota_snapshot, status, last_error, wakeup_enabled, wakeup_model,
      last_refreshed_at, last_wakeup_at, created_at
  `;
  if (rows.length === 0) return null;
  return mapPublicRow(rows[0] as Record<string, unknown>);
}

export async function deleteAccountById(id: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM cockpit_accounts WHERE id = ${id}`;
}

export async function recordWakeupLog(entry: {
  id: string;
  accountId: string;
  platform: PlatformId;
  email: string;
  model: string;
  triggerSource: 'manual' | 'scheduled';
  success: boolean;
  message: string;
  durationMs: number;
}): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO cockpit_wakeup_logs (
      id, account_id, platform, email, model, trigger_source, success, message, duration_ms
    ) VALUES (
      ${entry.id}, ${entry.accountId}, ${entry.platform}, ${entry.email},
      ${entry.model}, ${entry.triggerSource}, ${entry.success}, ${entry.message}, ${entry.durationMs}
    )
  `;
  if (entry.success) {
    await sql`
      UPDATE cockpit_accounts SET last_wakeup_at = NOW(), updated_at = NOW() WHERE id = ${entry.accountId}
    `;
  }
}

export async function listWakeupLogs(limit = 30): Promise<WakeupLogItem[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, account_id, platform, email, model, trigger_source, success, message, duration_ms, created_at
    FROM cockpit_wakeup_logs
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      accountId: String(row.account_id),
      platform: row.platform as PlatformId,
      email: String(row.email),
      model: String(row.model),
      triggerSource: (row.trigger_source as 'manual' | 'scheduled') || 'manual',
      success: Boolean(row.success),
      message: String(row.message),
      durationMs: Number(row.duration_ms ?? 0),
      createdAt: new Date(String(row.created_at)).toISOString(),
    };
  });
}

export async function saveOAuthState(entry: {
  state: string;
  platform: PlatformId;
  codeVerifier?: string | null;
  redirectUri: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  // Clean up states older than 30 minutes
  await sql`DELETE FROM cockpit_oauth_states WHERE created_at < NOW() - INTERVAL '30 minutes'`;
  await sql`
    INSERT INTO cockpit_oauth_states (state, platform, code_verifier, redirect_uri, metadata)
    VALUES (
      ${entry.state},
      ${entry.platform},
      ${entry.codeVerifier ?? null},
      ${entry.redirectUri},
      ${JSON.stringify(entry.metadata ?? {})}::jsonb
    )
  `;
}

export async function consumeOAuthState(state: string): Promise<{
  platform: PlatformId;
  codeVerifier: string | null;
  redirectUri: string;
  metadata: Record<string, unknown>;
} | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM cockpit_oauth_states
    WHERE state = ${state} AND created_at >= NOW() - INTERVAL '30 minutes'
    RETURNING platform, code_verifier, redirect_uri, metadata
  `;
  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;
  return {
    platform: row.platform as PlatformId,
    codeVerifier: row.code_verifier ? String(row.code_verifier) : null,
    redirectUri: String(row.redirect_uri),
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {},
  };
}
