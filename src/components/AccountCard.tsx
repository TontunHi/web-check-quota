'use client';

import { RefreshCw, Zap, SlidersHorizontal, Trash2, AlertCircle } from 'lucide-react';
import type { PublicAccount } from '@/lib/types';
import {
  formatRelativeTime,
  formatResetCountdown,
  PLATFORM_META,
  quotaBarColor,
} from '@/lib/format';

interface AccountCardProps {
  account: PublicAccount;
  refreshing: boolean;
  waking: boolean;
  onRefresh: (id: string) => void;
  onWakeup: (id: string) => void;
  onEdit: (account: PublicAccount) => void;
  onDelete: (account: PublicAccount) => void;
  onTagClick: (tag: string) => void;
}

export function AccountCard({
  account,
  refreshing,
  waking,
  onRefresh,
  onWakeup,
  onEdit,
  onDelete,
  onTagClick,
}: AccountCardProps) {
  const meta = PLATFORM_META[account.platform];
  const items = account.quota?.items ?? [];
  const isForbidden = account.status === 'forbidden' || account.quota?.forbidden;

  return (
    <article className="bg-[#16181b] border border-white/[0.08] rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-white/[0.14] transition-colors">
      <div className="space-y-4">
        {/* Top Row: Platform + Plan + Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: meta.dotColor }}
              />
              <span className="text-[12px] text-[#9ca3af]">{meta.label}</span>
              {account.plan && (
                <span className="text-[11px] font-mono text-[#f3f4f6] bg-white/[0.06] px-2 py-0.5 rounded">
                  {account.plan}
                </span>
              )}
              {account.groupName && (
                <span className="text-[11px] text-[#9ca3af] bg-[#1e2025] border border-white/[0.06] px-2 py-0.5 rounded">
                  {account.groupName}
                </span>
              )}
            </div>

            <h3
              className="text-[15px] font-medium text-[#f3f4f6] truncate"
              title={account.email}
            >
              {account.displayName || account.email}
            </h3>
            {account.displayName && (
              <p className="text-[12px] text-[#6b7280] truncate">{account.email}</p>
            )}
          </div>

          {account.wakeupEnabled && (
            <span
              className="shrink-0 inline-flex items-center gap-1 text-[11px] font-mono text-[#34d399] bg-[#34d399]/[0.08] border border-[#34d399]/20 px-2 py-0.5 rounded"
              title={`เปิดปลุกอัตโนมัติ (${account.wakeupModel || meta.defaultWakeupModel})`}
            >
              <Zap size={12} strokeWidth={1.5} />
              Wake
            </span>
          )}
        </div>

        {/* Tags + Note */}
        {(account.tags.length > 0 || account.note) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {account.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick(tag)}
                className="text-[11px] text-[#9ca3af] bg-[#0f1012] border border-white/[0.06] hover:border-white/[0.16] px-2 py-0.5 rounded transition-colors"
              >
                #{tag}
              </button>
            ))}
            {account.note && (
              <span className="text-[12px] text-[#6b7280] truncate max-w-full">
                {account.note}
              </span>
            )}
          </div>
        )}

        {/* Error / Forbidden Alert */}
        {(account.lastError || isForbidden) && (
          <div className="flex items-start gap-2 text-[12px] text-[#f87171] bg-[#f87171]/[0.08] border border-[#f87171]/20 rounded-lg px-3 py-2">
            <AlertCircle size={15} strokeWidth={1.5} className="shrink-0 mt-0.5" />
            <span className="break-words line-clamp-2">
              {account.quota?.forbiddenReason ||
                account.lastError ||
                'บัญชีถูกจำกัดสิทธิ์การเข้าถึงโควต้า (403)'}
            </span>
          </div>
        )}

        {/* Quota Telemetry Bars */}
        {items.length > 0 ? (
          <div className="space-y-3 pt-1">
            {items.map((item) => {
              const pct = Math.max(0, Math.min(100, Math.round(item.remainingPercent)));
              return (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="text-[#f3f4f6] truncate" title={item.label}>
                      {item.label}
                    </span>
                    <div className="flex items-baseline gap-2 shrink-0 font-mono tabular-nums">
                      <span className="text-[11px] text-[#6b7280]">
                        {formatResetCountdown(item.resetAt)}
                      </span>
                      <span
                        className={
                          pct <= 15
                            ? 'text-[#f87171] font-medium'
                            : pct <= 35
                              ? 'text-[#fbbf24] font-medium'
                              : 'text-[#f3f4f6] font-medium'
                        }
                      >
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-colors ${quotaBarColor(pct)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {item.detail && (
                    <p className="text-[11px] font-mono tabular-nums text-[#6b7280]">
                      {item.detail}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-4 text-center text-[12px] text-[#6b7280] bg-[#0f1012]/60 rounded-lg border border-white/[0.04]">
            ยังไม่มีข้อมูลโควต้า กดปุ่มรีเฟรชเพื่อดึงข้อมูลล่าสุด
          </div>
        )}

        {account.quota?.creditsText && (
          <div className="text-[12px] font-mono tabular-nums text-[#9ca3af] pt-1 border-t border-white/[0.05]">
            {account.quota.creditsText}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono tabular-nums text-[#6b7280]">
          อัปเดต {formatRelativeTime(account.lastRefreshedAt)}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => onRefresh(account.id)}
            title="รีเฟรชโควต้าสด"
            className="h-8 px-2.5 rounded-lg text-[12px] text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-white/[0.06] disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw
              size={14}
              strokeWidth={1.5}
              className={refreshing ? 'animate-spin' : ''}
            />
            <span>รีเฟรช</span>
          </button>

          <button
            type="button"
            disabled={waking}
            onClick={() => onWakeup(account.id)}
            title="สั่งปลุกโมเดล (Wake-up) ทันที"
            className="h-8 px-2.5 rounded-lg text-[12px] text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-white/[0.06] disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors"
          >
            <Zap size={14} strokeWidth={1.5} />
            <span>{waking ? 'กำลังปลุก...' : 'ปลุก'}</span>
          </button>

          <button
            type="button"
            onClick={() => onEdit(account)}
            title="ตั้งค่ากลุ่ม แท็ก และ Wake-up"
            className="h-8 w-8 rounded-lg text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-white/[0.06] inline-flex items-center justify-center transition-colors"
          >
            <SlidersHorizontal size={14} strokeWidth={1.5} />
          </button>

          <button
            type="button"
            onClick={() => onDelete(account)}
            title="ลบบัญชี"
            className="h-8 w-8 rounded-lg text-[#6b7280] hover:text-[#f87171] hover:bg-[#f87171]/[0.08] inline-flex items-center justify-center transition-colors"
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </article>
  );
}
