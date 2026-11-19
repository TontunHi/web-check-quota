'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Cpu,
  LayoutGrid,
  List,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type { PlatformId, PublicAccount } from '@/lib/types';
import { classifyAccountHealth, PLATFORM_META } from '@/lib/format';
import { resolveAccountAvailableModels } from '@/lib/models';
import { AccountCard } from './AccountCard';
import { AccountTable } from './AccountTable';
import { AddAccountModal } from './AddAccountModal';
import { EditAccountModal } from './EditAccountModal';
import { ModelsCatalogView } from './ModelsCatalogView';
import { WakeupLogsModal } from './WakeupLogsModal';
import {
  accountMatchesModelFilter,
  collectAccountModelFilterOptions,
  countUniqueAccountModels,
  sortAccounts,
  type AccountSortMode,
  type StatusFilterMode,
} from './modelViewHelpers';
import { FOCUS_RING } from './uiPrimitives';

interface DashboardClientProps {
  initialAccounts: PublicAccount[];
}

type WorkspaceView = 'accounts' | 'models';
type AccountLayoutMode = 'grid' | 'table';

export function DashboardClient({ initialAccounts }: DashboardClientProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<PublicAccount[]>(initialAccounts);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('accounts');
  const [layoutMode, setLayoutMode] = useState<AccountLayoutMode>('grid');

  const [platformFilter, setPlatformFilter] = useState<'all' | PlatformId>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterMode>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<AccountSortMode>('default');
  const [wakeupOnlyFilter, setWakeupOnlyFilter] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [refreshingIds, setRefreshingIds] = useState<Record<string, boolean>>({});
  const [wakingIds, setWakingIds] = useState<Record<string, boolean>>({});
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [runningAllWakeup, setRunningAllWakeup] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PublicAccount | null>(null);
  const [showWakeupModal, setShowWakeupModal] = useState(false);
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  function showToast(text: string, isError = false) {
    setNotice({ text, isError });
    setTimeout(() => {
      setNotice((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }

  const allGroups = useMemo(() => {
    const set = new Set<string>();
    for (const a of accounts) {
      if (a.groupName) set.add(a.groupName);
    }
    return Array.from(set).sort();
  }, [accounts]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const a of accounts) {
      for (const t of a.tags) set.add(t);
    }
    return Array.from(set).sort();
  }, [accounts]);

  const uniqueModelsCount = useMemo(
    () => countUniqueAccountModels(accounts),
    [accounts]
  );

  const modelFilterOptions = useMemo(
    () => collectAccountModelFilterOptions(accounts, platformFilter, modelFilter),
    [accounts, platformFilter, modelFilter]
  );

  const stats = useMemo(() => {
    const total = accounts.length;
    const byPlatform = {
      antigravity: 0,
      codex: 0,
      claude: 0,
    };
    let healthy = 0;
    let low = 0;
    let issue = 0;
    let wakeupCount = 0;

    for (const a of accounts) {
      byPlatform[a.platform]++;
      if (a.wakeupEnabled) wakeupCount++;
      const health = classifyAccountHealth(a);
      if (health === 'healthy') healthy++;
      else if (health === 'low') low++;
      else issue++;
    }

    return {
      total,
      byPlatform,
      healthy,
      low,
      issue,
      attention: low + issue,
      wakeupCount,
    };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = accounts.filter((a) => {
      if (platformFilter !== 'all' && a.platform !== platformFilter) return false;
      if (groupFilter !== 'all' && (a.groupName ?? '') !== groupFilter) return false;
      if (selectedTag && !a.tags.includes(selectedTag)) return false;
      if (wakeupOnlyFilter && !a.wakeupEnabled) return false;

      if (statusFilter !== 'all') {
        const health = classifyAccountHealth(a);
        if (statusFilter === 'healthy' && health !== 'healthy') return false;
        if (statusFilter === 'low' && health !== 'low') return false;
        if (statusFilter === 'issue' && health !== 'issue') return false;
        if (statusFilter === 'attention' && health === 'healthy') return false;
      }

      if (modelFilter !== 'all' && !accountMatchesModelFilter(a, modelFilter)) {
        return false;
      }

      if (q) {
        const usableModels = resolveAccountAvailableModels(a).models;
        const hay = [
          a.email,
          a.displayName ?? '',
          a.groupName ?? '',
          a.note ?? '',
          a.plan ?? '',
          ...a.tags,
          ...usableModels.flatMap((m) => [m.id, m.displayName]),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return sortAccounts(matched, sortMode);
  }, [
    accounts,
    platformFilter,
    groupFilter,
    selectedTag,
    wakeupOnlyFilter,
    statusFilter,
    modelFilter,
    search,
    sortMode,
  ]);

  const hasActiveFilters =
    platformFilter !== 'all' ||
    groupFilter !== 'all' ||
    statusFilter !== 'all' ||
    modelFilter !== 'all' ||
    selectedTag !== null ||
    wakeupOnlyFilter ||
    search.trim() !== '';

  function clearAllFilters() {
    setPlatformFilter('all');
    setGroupFilter('all');
    setStatusFilter('all');
    setModelFilter('all');
    setWakeupOnlyFilter(false);
    setSelectedTag(null);
    setSearch('');
  }

  function handleSelectPlatformTab(nextPlatform: 'all' | PlatformId) {
    setPlatformFilter(nextPlatform);
    if (nextPlatform !== 'all' && modelFilter !== 'all') {
      const stillValid = accounts.some(
        (acc) => acc.platform === nextPlatform && accountMatchesModelFilter(acc, modelFilter)
      );
      if (!stillValid) {
        setModelFilter('all');
      }
    }
  }

  function handleSelectModelAccountFilter(platform: PlatformId, modelId: string) {
    setPlatformFilter(platform);
    setModelFilter(modelId);
    setStatusFilter('all');
    setGroupFilter('all');
    setWakeupOnlyFilter(false);
    setSelectedTag(null);
    setSearch('');
    setWorkspaceView('accounts');
  }

  async function handleRefreshOne(id: string) {
    setRefreshingIds((s) => ({ ...s, [id]: true }));
    try {
      const res = await fetch(`/api/accounts/${id}/refresh`, { method: 'POST' });
      const data = (await res.json()) as { account?: PublicAccount; error?: string };
      if (data.account) {
        setAccounts((prev) =>
          prev.map((a) => (a.id === id ? data.account! : a))
        );
      }
      if (!res.ok) {
        showToast(data.error || 'รีเฟรชโควต้าไม่สำเร็จ', true);
      } else {
        showToast('อัปเดตโควต้าล่าสุดแล้ว');
      }
    } catch {
      showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', true);
    } finally {
      setRefreshingIds((s) => ({ ...s, [id]: false }));
    }
  }

  async function handleRefreshAll() {
    if (refreshingAll || accounts.length === 0) return;
    setRefreshingAll(true);
    try {
      const body =
        platformFilter !== 'all' ? JSON.stringify({ platform: platformFilter }) : '{}';
      const res = await fetch('/api/accounts/refresh-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const data = (await res.json()) as {
        accounts?: PublicAccount[];
        successCount?: number;
        failCount?: number;
      };
      if (data.accounts) setAccounts(data.accounts);
      showToast(
        `รีเฟรชสำเร็จ ${data.successCount ?? 0} บัญชี${
          data.failCount ? ` (ไม่สำเร็จ ${data.failCount})` : ''
        }`,
        Boolean(data.failCount)
      );
    } catch {
      showToast('รีเฟรชทั้งหมดไม่สำเร็จ', true);
    } finally {
      setRefreshingAll(false);
    }
  }

  async function handleWakeupOne(id: string) {
    setWakingIds((s) => ({ ...s, [id]: true }));
    try {
      const res = await fetch(`/api/accounts/${id}/wakeup`, { method: 'POST' });
      const data = (await res.json()) as {
        account?: PublicAccount;
        message?: string;
        error?: string;
      };
      if (data.account) {
        setAccounts((prev) =>
          prev.map((a) => (a.id === id ? data.account! : a))
        );
      }
      if (!res.ok) {
        showToast(data.error || 'สั่ง Wake-up ไม่สำเร็จ', true);
      } else {
        showToast(data.message || 'ปลุกโมเดลสำเร็จ');
      }
    } catch {
      showToast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', true);
    } finally {
      setWakingIds((s) => ({ ...s, [id]: false }));
    }
  }

  async function handleRunAllWakeup() {
    setRunningAllWakeup(true);
    try {
      const res = await fetch('/api/wakeup', { method: 'POST' });
      const data = (await res.json()) as {
        accounts?: PublicAccount[];
        successCount?: number;
        failCount?: number;
      };
      if (data.accounts) setAccounts(data.accounts);
      showToast(
        `สั่ง Wake-up สำเร็จ ${data.successCount ?? 0} บัญชี${
          data.failCount ? ` (ล้มเหลว ${data.failCount})` : ''
        }`,
        Boolean(data.failCount)
      );
    } finally {
      setRunningAllWakeup(false);
    }
  }

  async function handleDelete(account: PublicAccount) {
    try {
      const res = await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== account.id));
        showToast(`ลบบัญชี ${account.email} แล้ว`);
      } else {
        showToast(`ลบบัญชี ${account.email} ไม่สำเร็จ`, true);
      }
    } catch {
      showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', true);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  const attentionToneClass =
    stats.attention === 0
      ? 'text-[#8b93a1]'
      : stats.issue > 0
        ? 'text-[#f87171]'
        : 'text-[#fbbf24]';

  const selectClass = `h-9 px-3 rounded-lg bg-[#16181b] border border-white/[0.08] text-[13px] text-[#f3f4f6] transition-colors ${FOCUS_RING}`;

  return (
    <div className="min-h-screen bg-[#0f1012] text-[#f3f4f6]">
      {/* Quiet Top Bar */}
      <header className="border-b border-white/[0.08] bg-[#0f1012]/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#34d399]" />
            <span className="text-[15px] font-medium text-[#f3f4f6]">
              Cockpit Telemetry
            </span>
            <span className="hidden sm:inline text-[12px] text-[#8b93a1]">
              Antigravity · Codex · Claude
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={refreshingAll || accounts.length === 0}
              onClick={handleRefreshAll}
              className={`h-9 px-3 rounded-lg bg-[#16181b] border border-white/[0.08] hover:border-white/[0.18] text-[13px] text-[#f3f4f6] disabled:opacity-40 inline-flex items-center gap-2 transition-colors ${FOCUS_RING}`}
            >
              <RefreshCw
                size={15}
                strokeWidth={1.5}
                className={refreshingAll ? 'animate-spin' : ''}
              />
              <span className="hidden sm:inline">
                {refreshingAll ? 'กำลังอัปเดต...' : 'รีเฟรชทั้งหมด'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowWakeupModal(true)}
              className={`h-9 px-3 rounded-lg bg-[#16181b] border border-white/[0.08] hover:border-white/[0.18] text-[13px] text-[#f3f4f6] inline-flex items-center gap-2 transition-colors ${FOCUS_RING}`}
            >
              <Zap size={15} strokeWidth={1.5} />
              <span className="hidden sm:inline">Wake-up</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className={`h-9 px-4 rounded-lg bg-[#f3f4f6] text-[#0f1012] hover:bg-white text-[13px] font-medium inline-flex items-center gap-2 transition-colors ${FOCUS_RING}`}
            >
              <Plus size={16} strokeWidth={1.5} />
              <span>เพิ่มบัญชี</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
              className={`h-9 px-3 rounded-lg text-[13px] text-[#b4bac4] hover:text-[#f3f4f6] inline-flex items-center gap-2 transition-colors ml-1 ${FOCUS_RING}`}
            >
              <LogOut size={15} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-8 space-y-6">
        {/* Workspace View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="มุมมองหลัก"
            className="inline-flex items-center p-1 rounded-xl bg-[#16181b] border border-white/[0.08]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={workspaceView === 'accounts'}
              onClick={() => setWorkspaceView('accounts')}
              className={`h-8 px-3 rounded-lg text-[13px] inline-flex items-center gap-2 transition-colors ${FOCUS_RING} ${
                workspaceView === 'accounts'
                  ? 'bg-[#1c1f24] text-[#f3f4f6] font-medium border border-white/[0.1]'
                  : 'text-[#b4bac4] hover:text-[#f3f4f6]'
              }`}
            >
              <Users size={14} strokeWidth={1.5} />
              <span>บัญชี & โควต้า</span>
              <span className="font-mono tabular-nums text-[11px] text-[#8b93a1]">
                {accounts.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={workspaceView === 'models'}
              onClick={() => setWorkspaceView('models')}
              className={`h-8 px-3 rounded-lg text-[13px] inline-flex items-center gap-2 transition-colors ${FOCUS_RING} ${
                workspaceView === 'models'
                  ? 'bg-[#1c1f24] text-[#f3f4f6] font-medium border border-white/[0.1]'
                  : 'text-[#b4bac4] hover:text-[#f3f4f6]'
              }`}
            >
              <Cpu size={14} strokeWidth={1.5} />
              <span>โมเดลที่ใช้งานได้</span>
              <span className="font-mono tabular-nums text-[11px] text-[#8b93a1]">
                {uniqueModelsCount}
              </span>
            </button>
          </div>
        </div>

        {workspaceView === 'models' ? (
          <ModelsCatalogView
            accounts={accounts}
            onSelectModelAccountFilter={handleSelectModelAccountFilter}
          />
        ) : (
          <>
            {/* KPI Row: 4 clickable, wordless telemetry tiles */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                type="button"
                aria-pressed={statusFilter === 'all' && !wakeupOnlyFilter}
                onClick={() => {
                  setStatusFilter('all');
                  setWakeupOnlyFilter(false);
                }}
                className={`text-left rounded-2xl p-5 border transition-colors ${FOCUS_RING} ${
                  statusFilter === 'all' && !wakeupOnlyFilter
                    ? 'bg-[#1c1f24] border-white/[0.16]'
                    : 'bg-[#16181b] border-white/[0.08] hover:border-white/[0.16]'
                }`}
              >
                <div className="text-[12px] text-[#b4bac4] mb-1">บัญชีทั้งหมด</div>
                <div className="text-[28px] font-medium font-mono tabular-nums text-[#f3f4f6]">
                  {stats.total}
                </div>
                <div className="text-[12px] font-mono tabular-nums text-[#8b93a1] mt-1">
                  AG {stats.byPlatform.antigravity} · CX {stats.byPlatform.codex} · CL{' '}
                  {stats.byPlatform.claude}
                </div>
              </button>

              <button
                type="button"
                aria-pressed={statusFilter === 'healthy'}
                onClick={() =>
                  setStatusFilter((prev) => (prev === 'healthy' ? 'all' : 'healthy'))
                }
                className={`text-left rounded-2xl p-5 border transition-colors ${FOCUS_RING} ${
                  statusFilter === 'healthy'
                    ? 'bg-[#1c1f24] border-[#34d399]/35'
                    : 'bg-[#16181b] border-white/[0.08] hover:border-white/[0.16]'
                }`}
              >
                <div className="text-[12px] text-[#b4bac4] mb-1">พร้อมใช้งาน</div>
                <div
                  className={`text-[28px] font-medium font-mono tabular-nums ${
                    stats.healthy > 0 ? 'text-[#34d399]' : 'text-[#8b93a1]'
                  }`}
                >
                  {stats.healthy}
                </div>
                <div className="text-[12px] font-mono tabular-nums text-[#8b93a1] mt-1">
                  &gt;20% ปกติ
                </div>
              </button>

              <button
                type="button"
                aria-pressed={statusFilter === 'attention'}
                onClick={() =>
                  setStatusFilter((prev) =>
                    prev === 'attention' ? 'all' : 'attention'
                  )
                }
                className={`text-left rounded-2xl p-5 border transition-colors ${FOCUS_RING} ${
                  statusFilter === 'attention'
                    ? stats.issue > 0
                      ? 'bg-[#1c1f24] border-[#f87171]/35'
                      : 'bg-[#1c1f24] border-[#fbbf24]/35'
                    : 'bg-[#16181b] border-white/[0.08] hover:border-white/[0.16]'
                }`}
              >
                <div className="text-[12px] text-[#b4bac4] mb-1">ต้องดูแล</div>
                <div
                  className={`text-[28px] font-medium font-mono tabular-nums ${attentionToneClass}`}
                >
                  {stats.attention}
                </div>
                <div className="text-[12px] font-mono tabular-nums text-[#8b93a1] mt-1">
                  &le;20% · 403 · Error
                </div>
              </button>

              <button
                type="button"
                aria-pressed={wakeupOnlyFilter}
                onClick={() => setWakeupOnlyFilter((prev) => !prev)}
                className={`text-left rounded-2xl p-5 border transition-colors ${FOCUS_RING} ${
                  wakeupOnlyFilter
                    ? 'bg-[#1c1f24] border-[#38bdf8]/40'
                    : 'bg-[#16181b] border-white/[0.08] hover:border-white/[0.16]'
                }`}
              >
                <div className="text-[12px] text-[#b4bac4] mb-1">Wake-up อัตโนมัติ</div>
                <div className="text-[28px] font-medium font-mono tabular-nums text-[#f3f4f6]">
                  {stats.wakeupCount}
                </div>
                <div className="text-[12px] font-mono tabular-nums text-[#8b93a1] mt-1">
                  {stats.wakeupCount} / {stats.total} เปิด / ทั้งหมด
                </div>
              </button>
            </section>

            {/* Filter & Search Toolbar */}
            <section className="space-y-3">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                {/* Platform Filter Tabs */}
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      {
                        id: 'all',
                        label: 'ทั้งหมด',
                        count: stats.total,
                        dotColor: null,
                      },
                      {
                        id: 'antigravity',
                        label: PLATFORM_META.antigravity.label,
                        count: stats.byPlatform.antigravity,
                        dotColor: PLATFORM_META.antigravity.dotColor,
                      },
                      {
                        id: 'codex',
                        label: PLATFORM_META.codex.label,
                        count: stats.byPlatform.codex,
                        dotColor: PLATFORM_META.codex.dotColor,
                      },
                      {
                        id: 'claude',
                        label: PLATFORM_META.claude.label,
                        count: stats.byPlatform.claude,
                        dotColor: PLATFORM_META.claude.dotColor,
                      },
                    ] as const
                  ).map((tab) => {
                    const active = platformFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => handleSelectPlatformTab(tab.id)}
                        className={`h-9 px-3 rounded-lg text-[13px] inline-flex items-center gap-2 border transition-colors ${FOCUS_RING} ${
                          active
                            ? 'bg-[#1c1f24] border-white/[0.16] text-[#f3f4f6] font-medium'
                            : 'bg-[#16181b] border-white/[0.08] text-[#b4bac4] hover:text-[#f3f4f6]'
                        }`}
                      >
                        {tab.dotColor && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: tab.dotColor }}
                          />
                        )}
                        <span>{tab.label}</span>
                        <span className="font-mono tabular-nums text-[11px] text-[#8b93a1]">
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selects, Search & Layout Switcher */}
                <div className="flex flex-wrap items-center gap-2">
                  {allGroups.length > 0 && (
                    <select
                      aria-label="กรองตามกลุ่ม"
                      value={groupFilter}
                      onChange={(e) => setGroupFilter(e.target.value)}
                      className={selectClass}
                    >
                      <option value="all">ทุกกลุ่ม</option>
                      {allGroups.map((g) => (
                        <option key={g} value={g}>
                          กลุ่ม: {g}
                        </option>
                      ))}
                    </select>
                  )}

                  <select
                    aria-label="กรองตามสถานะ"
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as StatusFilterMode)
                    }
                    className={selectClass}
                  >
                    <option value="all">ทุกสถานะ</option>
                    <option value="healthy">ปกติ (&gt;20%)</option>
                    <option value="low">โควต้าต่ำ (&le;20%)</option>
                    <option value="attention">ต้องดูแล (ต่ำ/ผิดพลาด)</option>
                    <option value="issue">มีข้อผิดพลาด / 403</option>
                  </select>

                  <select
                    aria-label="กรองตามโมเดล"
                    value={modelFilter}
                    onChange={(e) => setModelFilter(e.target.value)}
                    className={`${selectClass} max-w-[200px]`}
                  >
                    <option value="all">ทุกโมเดล</option>
                    {modelFilterOptions.map((opt) => (
                      <option
                        key={`${opt.platform}:${opt.groupKey}:${opt.value}`}
                        value={opt.value}
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="เรียงลำดับบัญชี"
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as AccountSortMode)}
                    className={selectClass}
                  >
                    <option value="default">ค่าเริ่มต้น</option>
                    <option value="lowest_quota">โควต้าต่ำสุดก่อน</option>
                    <option value="soonest_reset">รีเซ็ตเร็วสุด</option>
                    <option value="name">ชื่อบัญชี</option>
                  </select>

                  <div className="relative flex-1 sm:flex-initial sm:w-64">
                    <Search
                      size={15}
                      strokeWidth={1.5}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b93a1] pointer-events-none"
                    />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="ค้นหาอีเมล กลุ่ม แท็ก หรือโมเดล"
                      aria-label="ค้นหาอีเมล กลุ่ม แท็ก หรือโมเดล"
                      className={`w-full h-9 pl-9 pr-3 rounded-lg bg-[#16181b] border border-white/[0.08] text-[13px] text-[#f3f4f6] placeholder:text-[#8b93a1] transition-colors ${FOCUS_RING}`}
                    />
                  </div>

                  {/* Grid / Table Toggle */}
                  <div
                    role="group"
                    aria-label="รูปแบบการแสดงผล"
                    className="inline-flex items-center p-1 rounded-lg bg-[#16181b] border border-white/[0.08] h-9"
                  >
                    <button
                      type="button"
                      aria-pressed={layoutMode === 'grid'}
                      onClick={() => setLayoutMode('grid')}
                      title="มุมมองการ์ด"
                      aria-label="มุมมองการ์ด"
                      className={`h-7 w-7 rounded inline-flex items-center justify-center transition-colors ${FOCUS_RING} ${
                        layoutMode === 'grid'
                          ? 'bg-[#1c1f24] text-[#f3f4f6]'
                          : 'text-[#8b93a1] hover:text-[#f3f4f6]'
                      }`}
                    >
                      <LayoutGrid size={15} strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      aria-pressed={layoutMode === 'table'}
                      onClick={() => setLayoutMode('table')}
                      title="มุมมองตาราง"
                      aria-label="มุมมองตาราง"
                      className={`h-7 w-7 rounded inline-flex items-center justify-center transition-colors ${FOCUS_RING} ${
                        layoutMode === 'table'
                          ? 'bg-[#1c1f24] text-[#f3f4f6]'
                          : 'text-[#8b93a1] hover:text-[#f3f4f6]'
                      }`}
                    >
                      <List size={15} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Filter Summary Bar */}
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#16181b] border border-white/[0.08] text-[12px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[#b4bac4] tabular-nums">
                      แสดง {filteredAccounts.length} จาก {accounts.length} บัญชี
                    </span>
                    {modelFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1c1f24] border border-white/[0.08] font-mono text-[11px] text-[#f3f4f6]">
                        {modelFilter}
                        <button
                          type="button"
                          onClick={() => setModelFilter('all')}
                          aria-label="ยกเลิกตัวกรองโมเดล"
                          className={`text-[#8b93a1] hover:text-[#f3f4f6] ${FOCUS_RING}`}
                        >
                          <X size={11} strokeWidth={1.5} />
                        </button>
                      </span>
                    )}
                    {wakeupOnlyFilter && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1c1f24] border border-white/[0.08] text-[11px] text-[#34d399]">
                        เฉพาะ Wake-up
                        <button
                          type="button"
                          onClick={() => setWakeupOnlyFilter(false)}
                          aria-label="ยกเลิกตัวกรอง Wake-up"
                          className={`text-[#8b93a1] hover:text-[#f3f4f6] ${FOCUS_RING}`}
                        >
                          <X size={11} strokeWidth={1.5} />
                        </button>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className={`h-7 px-3 rounded-lg text-[12px] text-[#b4bac4] hover:text-[#f3f4f6] hover:bg-white/[0.06] inline-flex items-center gap-1 transition-colors ${FOCUS_RING}`}
                  >
                    <X size={12} strokeWidth={1.5} />
                    <span>ล้างตัวกรอง</span>
                  </button>
                </div>
              )}
            </section>

            {/* Active Tag Row */}
            {allTags.length > 0 && (
              <section className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-[#8b93a1]">แท็ก:</span>
                {allTags.map((tag) => {
                  const isSelected = selectedTag === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTag(isSelected ? null : tag)}
                      className={`h-7 px-3 rounded-md text-[12px] border inline-flex items-center gap-1 transition-colors ${FOCUS_RING} ${
                        isSelected
                          ? 'bg-[#38bdf8]/15 border-[#38bdf8]/50 text-[#f3f4f6]'
                          : 'bg-[#16181b] border-white/[0.06] text-[#b4bac4] hover:text-[#f3f4f6]'
                      }`}
                    >
                      <span>#{tag}</span>
                      {isSelected && <X size={12} strokeWidth={1.5} />}
                    </button>
                  );
                })}
              </section>
            )}

            {/* Accounts Grid / Table or Empty State */}
            {accounts.length === 0 ? (
              <section className="bg-[#16181b] border border-white/[0.08] rounded-2xl p-12 text-center max-w-[540px] mx-auto my-8">
                <h2 className="text-[18px] font-medium text-[#f3f4f6] mb-2">
                  ยังไม่มีบัญชีในระบบ
                </h2>
                <p className="text-[13px] text-[#b4bac4] mb-6 leading-relaxed">
                  เริ่มต้นเพิ่มบัญชี Antigravity, Codex หรือ Claude ผ่านลิงก์ OAuth, วาง Refresh Token หรือนำเข้าไฟล์ JSON จากโปรแกรม Cockpit Tools เดิมได้ทันที
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className={`h-10 px-5 rounded-lg bg-[#f3f4f6] text-[#0f1012] text-[14px] font-medium inline-flex items-center gap-2 hover:bg-white transition-colors ${FOCUS_RING}`}
                >
                  <Plus size={16} strokeWidth={1.5} />
                  <span>เพิ่มบัญชีแรก</span>
                </button>
              </section>
            ) : filteredAccounts.length === 0 ? (
              <section className="bg-[#16181b] border border-white/[0.08] rounded-2xl p-10 text-center space-y-3">
                <p className="text-[13px] text-[#b4bac4]">
                  ไม่พบบัญชีที่ตรงกับตัวกรองที่เลือก
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className={`h-8 px-3 rounded-lg bg-[#1c1f24] border border-white/[0.08] hover:border-white/[0.16] text-[12px] text-[#f3f4f6] transition-colors ${FOCUS_RING}`}
                  >
                    ล้างตัวกรองทั้งหมด
                  </button>
                )}
              </section>
            ) : layoutMode === 'table' ? (
              <AccountTable
                accounts={filteredAccounts}
                refreshingIds={refreshingIds}
                wakingIds={wakingIds}
                onRefresh={handleRefreshOne}
                onWakeup={handleWakeupOne}
                onEdit={setEditingAccount}
                onDelete={handleDelete}
              />
            ) : (
              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredAccounts.map((acc) => (
                  <AccountCard
                    key={acc.id}
                    account={acc}
                    refreshing={Boolean(refreshingIds[acc.id])}
                    waking={Boolean(wakingIds[acc.id])}
                    onRefresh={handleRefreshOne}
                    onWakeup={handleWakeupOne}
                    onEdit={setEditingAccount}
                    onDelete={handleDelete}
                    onTagClick={(tag) =>
                      setSelectedTag((prev) => (prev === tag ? null : tag))
                    }
                  />
                ))}
              </section>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {showAddModal && (
        <AddAccountModal
          onClose={() => setShowAddModal(false)}
          onAdded={(added) => {
            setAccounts((prev) => {
              const map = new Map(prev.map((a) => [a.id, a]));
              for (const item of added) {
                for (const [k, v] of map.entries()) {
                  if (v.platform === item.platform && v.email === item.email && k !== item.id) {
                    map.delete(k);
                  }
                }
                map.set(item.id, item);
              }
              return Array.from(map.values());
            });
            setShowAddModal(false);
            showToast(`นำเข้าสำเร็จ ${added.length} บัญชี`);
          }}
        />
      )}

      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSaved={(updated) => {
            setAccounts((prev) =>
              prev.map((a) => (a.id === updated.id ? updated : a))
            );
            setEditingAccount(null);
            showToast('บันทึกการตั้งค่าบัญชีแล้ว');
          }}
        />
      )}

      {showWakeupModal && (
        <WakeupLogsModal
          onClose={() => setShowWakeupModal(false)}
          onRunAllWakeup={handleRunAllWakeup}
          runningAll={runningAllWakeup}
        />
      )}

      {/* Toast Notification */}
      {notice && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border text-[13px] ${
            notice.isError
              ? 'bg-[#1c1315] border-[#f87171]/30 text-[#f87171]'
              : 'bg-[#1c1f24] border-white/[0.14] text-[#f3f4f6]'
          }`}
        >
          {notice.text}
        </div>
      )}
    </div>
  );
}
