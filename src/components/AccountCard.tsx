'use client';

import { useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import type { PublicAccount } from '@/lib/types';
import {
  formatExactResetTime,
  formatRelativeTime,
  formatResetCountdown,
  PLATFORM_META,
  quotaTextColor,
} from '@/lib/format';
import {
  getDisplayQuotaItems,
  getModelDisplayLabel,
  groupModelsForDisplay,
  resolveAccountAvailableModels,
} from '@/lib/models';
import {
  FOCUS_RING,
  InlineDeleteControl,
  MODEL_FAMILY_META,
  QuotaTrack,
  useCopyFeedback,
} from './uiPrimitives';

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
  const [modelsExpanded, setModelsExpanded] = useState(false);
  const { copiedKey, copyText } = useCopyFeedback();

  const meta = PLATFORM_META[account.platform];
  const items = getDisplayQuotaItems(account);
  const isForbidden = account.status === 'forbidden' || Boolean(account.quota?.forbidden);

  const { models, isLive } = resolveAccountAvailableModels(account);
  const modelGroups = groupModelsForDisplay(models);
  const canExpandModels =
    modelGroups.length > 4 ||
    modelGroups.some((g) => g.models.length > 1 || g.efforts.length > 0);
  const collapsedGroups = modelGroups.slice(0, 4);
  const hiddenGroupCount = Math.max(0, modelGroups.length - collapsedGroups.length);

  const wakeupModel = account.wakeupModel || meta.defaultWakeupModel;
  const wakeupFriendly = getModelDisplayLabel(wakeupModel, account.platform);

  return (
    <article className="bg-[#16181b] border border-white/[0.08] rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-white/[0.14] transition-colors">
      <div className="space-y-4">
        {/* Top Row: Platform + Plan + Wake-up Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: meta.dotColor }}
              />
              <span className="text-[12px] text-[#b4bac4]">{meta.label}</span>
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

            <h3
              className="text-[15px] font-medium text-[#f3f4f6] truncate"
              title={account.email}
            >
              {account.displayName || account.email}
            </h3>
            {account.displayName && (
              <p className="text-[12px] text-[#8b93a1] truncate">{account.email}</p>
            )}
          </div>

          {account.wakeupEnabled && (
            <span
              className="shrink-0 inline-flex items-center gap-1 text-[11px] font-mono text-[#34d399] bg-[#34d399]/[0.08] border border-[#34d399]/20 px-2 py-0.5 rounded max-w-[148px]"
              title={`เปิดปลุกอัตโนมัติ: ${wakeupModel}${
                wakeupFriendly ? ` (${wakeupFriendly})` : ''
              }`}
            >
              <Zap size={12} strokeWidth={1.5} className="shrink-0" />
              <span className="truncate">Wake · {wakeupModel}</span>
            </span>
          )}
        </div>

        {/* Tags + Note */}
        {(account.tags.length > 0 || account.note) && (
          <div className="flex flex-wrap items-center gap-2">
            {account.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick(tag)}
                className={`text-[11px] text-[#b4bac4] bg-[#0f1012] border border-white/[0.06] hover:border-white/[0.16] px-2 py-0.5 rounded transition-colors ${FOCUS_RING}`}
              >
                #{tag}
              </button>
            ))}
            {account.note && (
              <span className="text-[12px] text-[#8b93a1] truncate max-w-full">
                {account.note}
              </span>
            )}
          </div>
        )}

        {/* Error / Forbidden Alert */}
        {(account.lastError || isForbidden) && (
          <div className="flex items-start gap-2 text-[12px] text-[#f87171] bg-[#f87171]/[0.08] border border-[#f87171]/20 rounded-lg px-3 py-2">
            <AlertCircle size={15} strokeWidth={1.5} className="shrink-0 mt-1" />
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
              const exactReset = formatExactResetTime(item.resetAt) || undefined;
              return (
                <div key={item.key} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="text-[#f3f4f6] truncate" title={item.label}>
                      {item.label}
                    </span>
                    <div className="flex items-baseline gap-2 shrink-0 font-mono tabular-nums">
                      <span
                        title={exactReset}
                        className="text-[11px] text-[#8b93a1]"
                      >
                        {formatResetCountdown(item.resetAt)}
                      </span>
                      <span className={`font-medium ${quotaTextColor(pct)}`}>{pct}%</span>
                    </div>
                  </div>
                  <QuotaTrack percent={pct} />
                  {item.detail && (
                    <p className="text-[11px] font-mono tabular-nums text-[#8b93a1]">
                      {item.detail}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-4 text-center text-[12px] text-[#8b93a1] bg-[#0f1012]/60 rounded-lg border border-white/[0.04]">
            ยังไม่มีข้อมูลโควต้า กดปุ่มรีเฟรชเพื่อดึงข้อมูลล่าสุด
          </div>
        )}

        {/* Usable Models Section */}
        <div className="pt-3 border-t border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#b4bac4] tabular-nums">
                โมเดลที่ใช้งานได้ ({models.length})
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  isLive
                    ? 'text-[#34d399] bg-[#34d399]/[0.08] border-[#34d399]/20'
                    : 'text-[#8b93a1] bg-[#0f1012] border-white/[0.06]'
                }`}
              >
                {isLive ? 'Live' : 'Catalog'}
              </span>
            </div>

            {canExpandModels && (
              <button
                type="button"
                aria-expanded={modelsExpanded}
                onClick={() => setModelsExpanded((prev) => !prev)}
                className={`h-6 px-2 rounded text-[11px] text-[#b4bac4] hover:text-[#f3f4f6] hover:bg-white/[0.06] inline-flex items-center gap-1 transition-colors ${FOCUS_RING}`}
              >
                <span>{modelsExpanded ? 'ซ่อน' : 'ดูรายละเอียด'}</span>
                {modelsExpanded ? (
                  <ChevronUp size={12} strokeWidth={1.5} />
                ) : (
                  <ChevronDown size={12} strokeWidth={1.5} />
                )}
              </button>
            )}
          </div>

          {!modelsExpanded ? (
            <div className="flex flex-wrap items-center gap-2">
              {collapsedGroups.map((group) => {
                const familyMeta = MODEL_FAMILY_META[group.family];
                return (
                  <span
                    key={group.groupKey}
                    className="inline-flex items-center gap-2 text-[11px] text-[#b4bac4] bg-[#0f1012] border border-white/[0.08] px-2 py-0.5 rounded"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: familyMeta.dotColor }}
                    />
                    <span>{group.label}</span>
                  </span>
                );
              })}
              {hiddenGroupCount > 0 && (
                <button
                  type="button"
                  onClick={() => setModelsExpanded(true)}
                  className={`text-[11px] font-mono tabular-nums text-[#8b93a1] hover:text-[#f3f4f6] bg-[#1c1f24] border border-white/[0.06] px-2 py-0.5 rounded transition-colors ${FOCUS_RING}`}
                >
                  +{hiddenGroupCount} อื่นๆ
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {models.map((model) => {
                const isCopied = copiedKey === model.id;
                const familyMeta = MODEL_FAMILY_META[model.family];
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => void copyText(model.id, model.id)}
                    title={`คัดลอก ID: ${model.id}`}
                    className={`w-full px-3 py-2 rounded-lg bg-[#0f1012] border text-left flex items-center justify-between gap-2 transition-colors ${FOCUS_RING} ${
                      isCopied
                        ? 'border-[#34d399]/30 bg-[#34d399]/[0.06]'
                        : 'border-white/[0.06] hover:border-white/[0.16]'
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: familyMeta.dotColor }}
                      />
                      <div className="min-w-0">
                        <div className="text-[12px] text-[#f3f4f6] truncate">
                          {model.displayName}
                        </div>
                        <div className="text-[11px] font-mono text-[#8b93a1] truncate">
                          {model.id}
                          {model.reasoningEfforts && model.reasoningEfforts.length > 0
                            ? ` · ${model.reasoningEfforts.join('/')}`
                            : ''}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2 font-mono tabular-nums text-[11px]">
                      {typeof model.remainingPercent === 'number' &&
                        Number.isFinite(model.remainingPercent) && (
                          <span className={quotaTextColor(model.remainingPercent)}>
                            {Math.round(model.remainingPercent)}%
                          </span>
                        )}
                      {isCopied ? (
                        <span className="font-sans text-[#34d399] inline-flex items-center gap-1">
                          <Check size={12} strokeWidth={1.5} />
                          คัดลอกแล้ว
                        </span>
                      ) : (
                        <Copy size={12} strokeWidth={1.5} className="text-[#8b93a1]" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {account.quota?.creditsText && (
          <div className="text-[12px] font-mono tabular-nums text-[#b4bac4] pt-2 border-t border-white/[0.05]">
            {account.quota.creditsText}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono tabular-nums text-[#8b93a1] truncate min-w-0">
          อัปเดต {formatRelativeTime(account.lastRefreshedAt)}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => onRefresh(account.id)}
            title="รีเฟรชโควต้าสด"
            className={`h-8 px-2 rounded-lg text-[12px] text-[#b4bac4] hover:text-[#f3f4f6] hover:bg-white/[0.06] disabled:opacity-40 inline-flex items-center gap-1 transition-colors ${FOCUS_RING}`}
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
            className={`h-8 px-2 rounded-lg text-[12px] text-[#b4bac4] hover:text-[#f3f4f6] hover:bg-white/[0.06] disabled:opacity-40 inline-flex items-center gap-1 transition-colors ${FOCUS_RING}`}
          >
            <Zap size={14} strokeWidth={1.5} />
            <span>{waking ? 'กำลังปลุก...' : 'ปลุก'}</span>
          </button>

          <button
            type="button"
            onClick={() => onEdit(account)}
            title="ตั้งค่ากลุ่ม แท็ก และ Wake-up"
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
      </div>
    </article>
  );
}
