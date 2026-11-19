import type { AccountHealth, PlatformId, PublicAccount } from './types';
import {
  getDisplayQuotaItems,
  PLATFORM_WAKEUP_DEFAULTS,
  PLATFORM_WAKEUP_PRESETS,
} from './models';

export const LOW_QUOTA_THRESHOLD = 20;

export const PLATFORM_META: Record<
  PlatformId,
  { label: string; dotColor: string; defaultWakeupModel: string; wakeupModels: string[] }
> = {
  antigravity: {
    label: 'Antigravity',
    dotColor: '#38bdf8',
    defaultWakeupModel: PLATFORM_WAKEUP_DEFAULTS.antigravity,
    wakeupModels: [...PLATFORM_WAKEUP_PRESETS.antigravity],
  },
  codex: {
    label: 'Codex',
    dotColor: '#34d399',
    defaultWakeupModel: PLATFORM_WAKEUP_DEFAULTS.codex,
    wakeupModels: [...PLATFORM_WAKEUP_PRESETS.codex],
  },
  claude: {
    label: 'Claude',
    dotColor: '#fbbf24',
    defaultWakeupModel: PLATFORM_WAKEUP_DEFAULTS.claude,
    wakeupModels: [...PLATFORM_WAKEUP_PRESETS.claude],
  },
};

export function formatResetCountdown(resetAt?: string | null): string {
  if (!resetAt) return 'ไม่มีกำหนดรีเซ็ต';
  const target = new Date(resetAt).getTime();
  if (!Number.isFinite(target)) return resetAt;

  const diffMs = target - Date.now();
  if (diffMs <= 0) return 'พร้อมรีเซ็ต';

  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;

  if (days > 0) return `อีก ${days} วัน ${hours} ชม.`;
  if (hours > 0) return `อีก ${hours} ชม. ${mins} นาที`;
  return `อีก ${mins} นาที`;
}

export function formatExactResetTime(resetAt?: string | null): string {
  if (!resetAt) return '';
  const target = new Date(resetAt);
  if (!Number.isFinite(target.getTime())) return '';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(target);
}

export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return 'ยังไม่เคยอัปเดต';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '-';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'เมื่อสักครู่';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชม. ที่แล้ว`;
  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}

export function getLowestRemainingPercent(account: PublicAccount): number | null {
  const items = getDisplayQuotaItems(account);
  if (items.length === 0) return null;
  return items.reduce(
    (min, item) => Math.min(min, item.remainingPercent),
    items[0].remainingPercent
  );
}

export function getSoonestResetMs(account: PublicAccount): number | null {
  const items = getDisplayQuotaItems(account);
  let minMs: number | null = null;
  for (const item of items) {
    if (!item.resetAt) continue;
    const ts = Date.parse(item.resetAt);
    if (!Number.isFinite(ts)) continue;
    minMs = minMs === null ? ts : Math.min(minMs, ts);
  }
  return minMs;
}

export function classifyAccountHealth(account: PublicAccount): AccountHealth {
  if (
    account.status === 'forbidden' ||
    account.status === 'error' ||
    Boolean(account.quota?.forbidden) ||
    Boolean(account.lastError?.trim())
  ) {
    return 'issue';
  }
  const minPct = getLowestRemainingPercent(account);
  if (
    minPct !== null ? minPct <= LOW_QUOTA_THRESHOLD : account.status === 'warning'
  ) {
    return 'low';
  }
  return 'healthy';
}

export function quotaBarColor(percent: number): string {
  if (percent <= 15) return 'bg-[#f87171]';
  if (percent <= 35) return 'bg-[#fbbf24]';
  return 'bg-[#34d399]';
}

export function quotaTextColor(percent: number): string {
  if (percent <= 15) return 'text-[#f87171]';
  if (percent <= 35) return 'text-[#fbbf24]';
  return 'text-[#34d399]';
}
