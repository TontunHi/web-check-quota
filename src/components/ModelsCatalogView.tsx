'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, Search, X } from 'lucide-react';
import type { PlatformId, PublicAccount } from '@/lib/types';
import { PLATFORM_META, quotaTextColor } from '@/lib/format';
import {
  buildCatalogGroups,
  getEffortChipLabel,
  PLATFORMS,
  type CatalogGroupEntry,
  type CatalogScope,
} from './modelViewHelpers';
import { FOCUS_RING, MODEL_FAMILY_META, useCopyFeedback } from './uiPrimitives';

interface ModelsCatalogViewProps {
  accounts: PublicAccount[];
  onSelectModelAccountFilter: (platform: PlatformId, modelId: string) => void;
}

export function ModelsCatalogView({
  accounts,
  onSelectModelAccountFilter,
}: ModelsCatalogViewProps) {
  const [scope, setScope] = useState<CatalogScope>(
    accounts.length > 0 ? 'accounts' : 'catalog'
  );
  const [platformFilter, setPlatformFilter] = useState<'all' | PlatformId>('all');
  const [search, setSearch] = useState('');
  const { copiedKey, copyText } = useCopyFeedback();

  const groupedByPlatform = useMemo(
    () => buildCatalogGroups(accounts, scope),
    [accounts, scope]
  );

  const platformCounts = useMemo(() => {
    const antigravity = groupedByPlatform.antigravity.length;
    const codex = groupedByPlatform.codex.length;
    const claude = groupedByPlatform.claude.length;
    return {
      all: antigravity + codex + claude,
      antigravity,
      codex,
      claude,
    };
  }, [groupedByPlatform]);

  const filteredByPlatform = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchEntry = (entry: CatalogGroupEntry): boolean => {
      if (!q) return true;
      const familyLabel = MODEL_FAMILY_META[entry.group.family].label.toLowerCase();
      if (
        entry.group.label.toLowerCase().includes(q) ||
        entry.group.groupKey.toLowerCase().includes(q) ||
        familyLabel.includes(q)
      ) {
        return true;
      }
      return entry.group.models.some(
        (m) =>
          m.id.toLowerCase().includes(q) ||
          m.displayName.toLowerCase().includes(q)
      );
    };

    const targetPlatforms =
      platformFilter === 'all' ? PLATFORMS : ([platformFilter] as const);

    return targetPlatforms
      .map((platform) => ({
        platform,
        entries: groupedByPlatform[platform].filter(matchEntry),
      }))
      .filter((section) => section.entries.length > 0);
  }, [groupedByPlatform, platformFilter, search]);

  const totalVisibleGroups = filteredByPlatform.reduce(
    (sum, section) => sum + section.entries.length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Scope Switcher */}
          <div
            role="tablist"
            aria-label="ขอบเขตโมเดล"
            className="inline-flex items-center p-1 rounded-xl bg-[#16181b] border border-white/[0.08]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'accounts'}
              onClick={() => setScope('accounts')}
              className={`h-8 px-3 rounded-lg text-[13px] transition-colors ${FOCUS_RING} ${
                scope === 'accounts'
                  ? 'bg-[#1c1f24] text-[#f3f4f6] font-medium border border-white/[0.1]'
                  : 'text-[#b4bac4] hover:text-[#f3f4f6]'
              }`}
            >
              จากบัญชีของฉัน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'catalog'}
              onClick={() => setScope('catalog')}
              className={`h-8 px-3 rounded-lg text-[13px] transition-colors ${FOCUS_RING} ${
                scope === 'catalog'
                  ? 'bg-[#1c1f24] text-[#f3f4f6] font-medium border border-white/[0.1]'
                  : 'text-[#b4bac4] hover:text-[#f3f4f6]'
              }`}
            >
              แคตตาล็อกทั้งหมด (v1.3.80)
            </button>
          </div>

          {/* Platform Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'all', label: 'ทั้งหมด', count: platformCounts.all, dotColor: null },
                {
                  id: 'antigravity',
                  label: PLATFORM_META.antigravity.label,
                  count: platformCounts.antigravity,
                  dotColor: PLATFORM_META.antigravity.dotColor,
                },
                {
                  id: 'codex',
                  label: PLATFORM_META.codex.label,
                  count: platformCounts.codex,
                  dotColor: PLATFORM_META.codex.dotColor,
                },
                {
                  id: 'claude',
                  label: PLATFORM_META.claude.label,
                  count: platformCounts.claude,
                  dotColor: PLATFORM_META.claude.dotColor,
                },
              ] as const
            ).map((pill) => {
              const active = platformFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPlatformFilter(pill.id)}
                  className={`h-9 px-3 rounded-lg text-[13px] inline-flex items-center gap-2 border transition-colors ${FOCUS_RING} ${
                    active
                      ? 'bg-[#1c1f24] border-white/[0.16] text-[#f3f4f6] font-medium'
                      : 'bg-[#16181b] border-white/[0.08] text-[#b4bac4] hover:text-[#f3f4f6]'
                  }`}
                >
                  {pill.dotColor && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: pill.dotColor }}
                    />
                  )}
                  <span>{pill.label}</span>
                  <span className="font-mono tabular-nums text-[11px] text-[#8b93a1]">
                    {pill.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-72">
          <Search
            size={15}
            strokeWidth={1.5}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b93a1] pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาโมเดลหรือ ID"
            aria-label="ค้นหาโมเดลหรือ ID"
            className={`w-full h-9 pl-9 pr-8 rounded-lg bg-[#16181b] border border-white/[0.08] text-[13px] text-[#f3f4f6] placeholder:text-[#8b93a1] transition-colors ${FOCUS_RING}`}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="ล้างคำค้นหา"
              className={`absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded text-[#8b93a1] hover:text-[#f3f4f6] inline-flex items-center justify-center ${FOCUS_RING}`}
            >
              <X size={13} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </section>

      {/* Model Sections or Empty State */}
      {totalVisibleGroups === 0 ? (
        <section className="bg-[#16181b] border border-white/[0.08] rounded-2xl p-10 text-center space-y-4">
          <p className="text-[14px] text-[#b4bac4]">
            {scope === 'accounts' && accounts.length === 0
              ? 'ยังไม่มีบัญชีที่เชื่อมต่อในระบบสำหรับแสดงรายการโมเดลส่วนตัว'
              : 'ไม่พบโมเดลที่ตรงกับเงื่อนไขการค้นหา'}
          </p>
          <div className="flex items-center justify-center gap-2">
            {scope === 'accounts' && (
              <button
                type="button"
                onClick={() => {
                  setScope('catalog');
                  setSearch('');
                  setPlatformFilter('all');
                }}
                className={`h-9 px-4 rounded-lg bg-[#f3f4f6] text-[#0f1012] text-[13px] font-medium hover:bg-white transition-colors ${FOCUS_RING}`}
              >
                ดูแคตตาล็อกทั้งหมด (v1.3.80)
              </button>
            )}
            {(search || platformFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPlatformFilter('all');
                }}
                className={`h-9 px-4 rounded-lg bg-[#1c1f24] border border-white/[0.08] text-[13px] text-[#f3f4f6] hover:border-white/[0.16] transition-colors ${FOCUS_RING}`}
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          {filteredByPlatform.map(({ platform, entries }) => {
            const pMeta = PLATFORM_META[platform];
            const totalModels = entries.reduce(
              (acc, entry) => acc + entry.group.models.length,
              0
            );

            return (
              <section key={platform} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: pMeta.dotColor }}
                    />
                    <h2 className="text-[14px] font-medium text-[#f3f4f6]">
                      {pMeta.label}
                    </h2>
                    <span className="text-[12px] font-mono tabular-nums text-[#8b93a1]">
                      {entries.length} กลุ่ม · {totalModels} รุ่น
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {entries.map((entry) => {
                    const { group, accountCount, bestRemainingPercent, primaryModelId } =
                      entry;
                    const familyMeta = MODEL_FAMILY_META[group.family];
                    const hasMultipleModels = group.models.length > 1;

                    return (
                      <article
                        key={`${platform}:${group.groupKey}`}
                        className="bg-[#16181b] border border-white/[0.08] rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-white/[0.14] transition-colors"
                      >
                        <div className="space-y-3">
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-[15px] font-medium text-[#f3f4f6] truncate">
                                {group.label}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="inline-flex items-center gap-2 text-[11px] text-[#b4bac4]">
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: familyMeta.dotColor }}
                                  />
                                  {familyMeta.label}
                                </span>
                                <span
                                  className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                                    group.isLive
                                      ? 'text-[#34d399] bg-[#34d399]/[0.08] border-[#34d399]/20'
                                      : 'text-[#8b93a1] bg-[#0f1012] border-white/[0.08]'
                                  }`}
                                >
                                  {group.isLive ? 'Live' : 'Catalog'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* ID / Effort Chips */}
                          {hasMultipleModels ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                {group.models.map((model) => {
                                  const chipKey = `${platform}:${model.id}`;
                                  const isCopied = copiedKey === chipKey;
                                  return (
                                    <button
                                      key={model.id}
                                      type="button"
                                      onClick={() => void copyText(chipKey, model.id)}
                                      title={`คัดลอก ID: ${model.id}`}
                                      className={`h-7 px-2 rounded-lg border text-[12px] inline-flex items-center gap-1 transition-colors ${FOCUS_RING} ${
                                        isCopied
                                          ? 'bg-[#34d399]/10 border-[#34d399]/30 text-[#34d399]'
                                          : 'bg-[#0f1012] border-white/[0.08] text-[#f3f4f6] hover:border-white/[0.18]'
                                      }`}
                                    >
                                      <span>{getEffortChipLabel(model)}</span>
                                      {isCopied ? (
                                        <>
                                          <Check size={12} strokeWidth={1.5} />
                                          <span className="text-[11px]">คัดลอกแล้ว</span>
                                        </>
                                      ) : (
                                        <Copy
                                          size={11}
                                          strokeWidth={1.5}
                                          className="text-[#8b93a1]"
                                        />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                              <p
                                className="text-[11px] font-mono text-[#8b93a1] truncate"
                                title={primaryModelId}
                              >
                                {primaryModelId}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {(() => {
                                const chipKey = `${platform}:${primaryModelId}`;
                                const isCopied = copiedKey === chipKey;
                                return (
                                  <button
                                    type="button"
                                    onClick={() => void copyText(chipKey, primaryModelId)}
                                    title={`คัดลอก ID: ${primaryModelId}`}
                                    className={`max-w-full h-7 px-2 rounded-lg border font-mono text-[12px] inline-flex items-center gap-2 transition-colors ${FOCUS_RING} ${
                                      isCopied
                                        ? 'bg-[#34d399]/10 border-[#34d399]/30 text-[#34d399]'
                                        : 'bg-[#0f1012] border-white/[0.08] text-[#b4bac4] hover:text-[#f3f4f6] hover:border-white/[0.18]'
                                    }`}
                                  >
                                    <span className="truncate">{primaryModelId}</span>
                                    {isCopied ? (
                                      <>
                                        <Check
                                          size={12}
                                          strokeWidth={1.5}
                                          className="shrink-0"
                                        />
                                        <span className="font-sans text-[11px] shrink-0">
                                          คัดลอกแล้ว
                                        </span>
                                      </>
                                    ) : (
                                      <Copy
                                        size={12}
                                        strokeWidth={1.5}
                                        className="text-[#8b93a1] shrink-0"
                                      />
                                    )}
                                  </button>
                                );
                              })()}

                              {group.efforts.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-[11px] text-[#8b93a1] mr-1">
                                    Effort:
                                  </span>
                                  {group.efforts.map((effort) => (
                                    <span
                                      key={effort}
                                      className="px-2 py-0.5 rounded bg-[#0f1012] border border-white/[0.06] font-mono text-[11px] text-[#8b93a1]"
                                    >
                                      {effort}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Availability Summary Footer */}
                        <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-[12px] tabular-nums">
                            <span
                              className={
                                accountCount > 0 ? 'text-[#b4bac4]' : 'text-[#8b93a1]'
                              }
                            >
                              ใช้ได้ {accountCount} บัญชี
                            </span>
                            {bestRemainingPercent !== null && (
                              <>
                                <span className="text-[#8b93a1]">·</span>
                                <span
                                  className={`font-mono font-medium ${quotaTextColor(
                                    bestRemainingPercent
                                  )}`}
                                >
                                  สูงสุด {Math.round(bestRemainingPercent)}%
                                </span>
                              </>
                            )}
                          </div>

                          {accountCount > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                onSelectModelAccountFilter(platform, primaryModelId)
                              }
                              className={`h-7 px-3 rounded-lg bg-[#1c1f24] border border-white/[0.08] hover:border-white/[0.18] text-[12px] text-[#f3f4f6] inline-flex items-center gap-1 transition-colors shrink-0 ${FOCUS_RING}`}
                            >
                              <span>ดูบัญชี</span>
                              <ArrowRight size={12} strokeWidth={1.5} />
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
