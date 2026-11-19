'use client';

import {
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import type { PublicAccount } from '@/lib/types';
import {
  formatExactResetTime,
  formatResetCountdown,
  getLowestRemainingPercent,
  getSoonestResetMs,
  PLATFORM_META,
  quotaTextColor,
} from '@/lib/format';
import {
  getModelDisplayLabel,
  groupModelsForDisplay,
  resolveAccountAvailableModels,
} from '@/lib/models';
import {
  FOCUS_RING,
  InlineDeleteControl,
  MODEL_FAMILY_META,
  QuotaTrack,
} from './uiPrimitives';

interface AccountTableProps {
  accounts: PublicAccount[];
  refreshingIds: Record<string, boolean>;
  wakingIds: Record<string, boolean>;
  onRefresh: (id: string) => void;
  onWakeup: (id: string) => void;
  onEdit: (account: PublicAccount) => void;
  onDelete: (account: PublicAccount) => void;
}

export function AccountTable({
  accounts,
  refreshingIds,
  wakingIds,
  onRefresh,
  onWakeup,
  onEdit,
  onDelete,
}: AccountTableProps) {
  return (
    <section className="bg-[#16181b] border border-white/[0.08] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-white/[0.08] text-[12px] font-medium text-[#8b93a1]">
              <th className="py-3 px-4 font-medium">บัญชี</th>
              <th className="py-3 px-4 font-medium min-w-[180px]">โควต้าต่ำสุด</th>
              <th className="py-3 px-4 font-medium min-w-[220px]">โมเดลที่ใช้ได้</th>
              <th className="py-3 px-4 font-medium">Wake-up</th>
              <th className="py-3 px-4 font-medium text-right">การจัดการ</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/[0.06] text-[13px]">
            {accounts.map((account) => {
              const meta = PLATFORM_META[account.platform];
              const isRefreshing = Boolean(refreshingIds[account.id]);
              const isWaking = Boolean(wakingIds[account.id]);
              const isForbidden =
                account.status === 'forbidden' || Boolean(account.quota?.forbidden);
              const errorText =
                account.quota?.forbiddenReason ||
                account.lastError ||
                (isForbidden ? 'ถูกจำกัดสิทธิ์ (403)' : null);

              const minPct = getLowestRemainingPercent(account);
              const soonestResetMs = getSoonestResetMs(account);
              const soonestResetIso =
                soonestResetMs !== null ? new Date(soonestResetMs).toISOString() : null;
              const exactResetTitle = formatExactResetTime(soonestResetIso) || undefined;

              const { models, isLive } = resolveAccountAvailableModels(account);
              const groups = groupModelsForDisplay(models);
              const visibleGroups = groups.slice(0, 2);
              const overflowCount = Math.max(0, groups.length - visibleGroups.length);

              const wakeupModel = account.wakeupModel || meta.defaultWakeupModel;
              const wakeupFriendly = getModelDisplayLabel(wakeupModel, account.platform);

              return (
                <tr
                  key={account.id}
                  className="hover:bg-white/[0.02] transition-colors align-middle"
                >
                  {/* Account Column */}
                  <td className="py-3 px-4">
                    <div className="flex items-start gap-3 min-w-[220px]">
                      <span
                        className="w-2 h-2 rounded-full mt-2 shrink-0"
                        style={{ backgroundColor: meta.dotColor }}
                        title={meta.label}
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-[#f3f4f6] truncate max-w-[220px]">
                            {account.displayName || account.email}
                          </span>
                          {account.plan && (
                            <span className="text-[11px] font-mono text-[#f3f4f6] bg-white/[0.06] px-2 py-0.5 rounded">
                              {account.plan}
                            </span>
                          )}
                          {account.groupName && (
                            <span className="text-[11px] text-[#b4bac4] bg-[#1c1f24] border border-white/[0.06] px-2 py-0.5 rounded">
                              {account.groupName}
                            </span>
                          )}
                        </div>
                        {account.displayName && (
                          <div className="text-[12px] text-[#8b93a1] truncate max-w-[260px]">
                            {account.email}
                          </div>
                        )}
                        {errorText && (
                          <div
                            title={errorText}
                            className="inline-flex items-center gap-1 text-[11px] text-[#f87171] bg-[#f87171]/[0.08] border border-[#f87171]/20 px-2 py-0.5 rounded max-w-[280px]"
                          >
                            <AlertCircle size={12} strokeWidth={1.5} className="shrink-0" />
                            <span className="truncate">
                              {isForbidden ? '403 · จำกัดสิทธิ์' : errorText}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Lowest Quota Column */}
                  <td className="py-3 px-4">
                    {minPct !== null ? (
                      <div className="space-y-2 max-w-[200px]">
                        <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
                          <span
                            className={`text-[13px] font-medium ${quotaTextColor(minPct)}`}
                          >
                            {Math.round(minPct)}%
                          </span>
                          <span
                            title={exactResetTitle}
                            className="text-[11px] text-[#8b93a1] truncate"
                          >
                            {formatResetCountdown(soonestResetIso)}
                          </span>
                        </div>
                        <QuotaTrack percent={minPct} />
                      </div>
                    ) : (
                      <span className="font-mono tabular-nums text-[12px] text-[#8b93a1]">
                        —
                      </span>
                    )}
                  </td>

                  {/* Usable Models Column */}
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        title={isLive ? 'ข้อมูลรุ่นโมเดลสดจากบัญชี' : 'อ้างอิงจากแคตตาล็อกแผน'}
                        className="text-[11px] font-mono tabular-nums text-[#8b93a1]"
                      >
                        {models.length}
                      </span>
                      {visibleGroups.map((group) => {
                        const familyMeta = MODEL_FAMILY_META[group.family];
                        return (
                          <span
                            key={group.groupKey}
                            className="inline-flex items-center gap-1 text-[11px] text-[#b4bac4] bg-[#0f1012] border border-white/[0.08] px-2 py-0.5 rounded"
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: familyMeta.dotColor }}
                            />
                            <span className="truncate max-w-[120px]">{group.label}</span>
                          </span>
                        );
                      })}
                      {overflowCount > 0 && (
                        <span className="text-[11px] font-mono tabular-nums text-[#8b93a1] bg-[#1c1f24] border border-white/[0.06] px-2 py-0.5 rounded">
                          +{overflowCount}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Wake-up Column */}
                  <td className="py-3 px-4">
                    {account.wakeupEnabled ? (
                      <span
                        title={`${wakeupModel}${wakeupFriendly ? ` (${wakeupFriendly})` : ''}`}
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-[#34d399] bg-[#34d399]/[0.08] border border-[#34d399]/20 px-2 py-0.5 rounded max-w-[180px]"
                      >
                        <Zap size={11} strokeWidth={1.5} className="shrink-0" />
                        <span className="truncate">เปิด · {wakeupModel}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[11px] text-[#8b93a1] bg-[#0f1012] border border-white/[0.06] px-2 py-0.5 rounded">
                        ปิด
                      </span>
                    )}
                  </td>

                  {/* Actions Column */}
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        disabled={isRefreshing}
                        onClick={() => onRefresh(account.id)}
                        title="รีเฟรชโควต้าสด"
                        aria-label={`รีเฟรช ${account.displayName || account.email}`}
                        className={`h-8 w-8 rounded-lg text-[#b4bac4] hover:text-[#f3f4f6] hover:bg-white/[0.06] disabled:opacity-40 inline-flex items-center justify-center transition-colors ${FOCUS_RING}`}
                      >
                        <RefreshCw
                          size={14}
                          strokeWidth={1.5}
                          className={isRefreshing ? 'animate-spin' : ''}
                        />
                      </button>

                      <button
                        type="button"
                        disabled={isWaking}
                        onClick={() => onWakeup(account.id)}
                        title="สั่งปลุกโมเดล (Wake-up) ทันที"
                        aria-label={`ปลุก ${account.displayName || account.email}`}
                        className={`h-8 w-8 rounded-lg text-[#b4bac4] hover:text-[#f3f4f6] hover:bg-white/[0.06] disabled:opacity-40 inline-flex items-center justify-center transition-colors ${FOCUS_RING}`}
                      >
                        <Zap size={14} strokeWidth={1.5} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onEdit(account)}
                        title="ตั้งค่าบัญชีและ Wake-up"
                        aria-label={`ตั้งค่า ${account.displayName || account.email}`}
                        className={`h-8 w-8 rounded-lg text-[#b4bac4] hover:text-[#f3f4f6] hover:bg-white/[0.06] inline-flex items-center justify-center transition-colors ${FOCUS_RING}`}
                      >
                        <SlidersHorizontal size={14} strokeWidth={1.5} />
                      </button>

                      <InlineDeleteControl
                        accountLabel={account.displayName || account.email}
                        onConfirmDelete={() => onDelete(account)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
