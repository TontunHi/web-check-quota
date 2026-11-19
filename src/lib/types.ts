export type PlatformId = 'antigravity' | 'codex' | 'claude';
export type ModelFamily = 'gemini' | 'claude' | 'openai' | 'other';
export type AccountHealth = 'healthy' | 'low' | 'issue';

export interface AvailableModel {
  id: string;
  displayName: string;
  family: ModelFamily;
  remainingPercent?: number | null;
  resetAt?: string | null;
  recommended?: boolean;
  reasoningEfforts?: string[];
  source?: 'live' | 'catalog';
}

export interface QuotaItem {
  key: string;
  label: string;
  remainingPercent: number; // 0 - 100
  usedPercent?: number;
  resetAt?: string | null; // ISO 8601 timestamp
  detail?: string | null;
}

export interface QuotaSnapshot {
  items: QuotaItem[];
  availableModels?: AvailableModel[];
  plan?: string | null;
  creditsText?: string | null;
  forbidden?: boolean;
  forbiddenReason?: string | null;
  rawSummary?: string | null;
  fetchedAt: string; // ISO 8601
}

export interface StoredCredentials {
  authType?: 'oauth' | 'session_key' | 'api_key';
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number; // Unix seconds
  accountId?: string; // e.g. ChatGPT account_id or Claude org uuid
  projectId?: string; // e.g. Antigravity Cloud Code project_id
  isGcpTos?: boolean;
  sessionKey?: string; // Claude web sessionKey cookie
  apiKey?: string;
  baseUrl?: string;
  clientId?: string;
  organizationUuid?: string;
}

export interface PublicAccount {
  id: string;
  platform: PlatformId;
  email: string;
  displayName: string | null;
  plan: string | null;
  groupName: string | null;
  tags: string[];
  note: string | null;
  wakeupEnabled: boolean;
  wakeupModel: string | null;
  status: 'active' | 'warning' | 'forbidden' | 'error';
  lastError: string | null;
  quota: QuotaSnapshot | null;
  lastRefreshedAt: string | null;
  lastWakeupAt: string | null;
  createdAt: string;
}

export interface WakeupLogItem {
  id: string;
  accountId: string;
  platform: PlatformId;
  email: string;
  model: string;
  triggerSource: 'manual' | 'scheduled';
  success: boolean;
  message: string;
  durationMs: number;
  createdAt: string;
}
