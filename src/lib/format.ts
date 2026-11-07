import type { PlatformId, PublicAccount } from './types';

export const PLATFORM_META: Record<
  PlatformId,
  { label: string; dotColor: string; defaultWakeupModel: string; wakeupModels: string[] }
> = {
  antigravity: {
    label: 'Antigravity',
    dotColor: '#38bdf8',
    defaultWakeupModel: 'gemini-3-flash',
    wakeupModels: [
      'gemini-3-flash',
      'claude-sonnet-4-6',
      'gemini-3-flash + claude-sonnet-4-6',
      'gemini-2.5-pro',
      'claude-opus-4-6-thinking',
    ],
  },
  codex: {
    label: 'Codex',
    dotColor: '#34d399',
    defaultWakeupModel: 'gpt-5-codex',
    wakeupModels: ['gpt-5-codex', 'gpt-5', 'codex-mini-latest', 'gpt-4.1-mini'],
  },
  claude: {
    label: 'Claude',
    dotColor: '#fbbf24',
    defaultWakeupModel: 'claude-haiku-4-5-20251001',
    wakeupModels: [
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-5',
      'claude-sonnet-4-20250514',
    ],
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
  const items = account.quota?.items;
  if (!items || items.length === 0) return null;
  return items.reduce(
    (min, item) => Math.min(min, item.remainingPercent),
    items[0].remainingPercent
  );
}

export function quotaBarColor(percent: number): string {
  if (percent <= 15) return 'bg-[#f87171]';
  if (percent <= 35) return 'bg-[#fbbf24]';
  return 'bg-[#34d399]';
}
