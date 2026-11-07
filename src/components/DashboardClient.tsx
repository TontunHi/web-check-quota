'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  RefreshCw,
  Zap,
  Search,
  LogOut,
  X,
} from 'lucide-react';
import type { PlatformId, PublicAccount } from '@/lib/types';
import { getLowestRemainingPercent, PLATFORM_META } from '@/lib/format';
import { AccountCard } from './AccountCard';
import { AddAccountModal } from './AddAccountModal';
import { EditAccountModal } from './EditAccountModal';
import { WakeupLogsModal } from './WakeupLogsModal';

interface DashboardClientProps {
  initialAccounts: PublicAccount[];
}

export function DashboardClient({ initialAccounts }: DashboardClientProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<PublicAccount[]>(initialAccounts);
  const [platformFilter, setPlatformFilter] = useState<'all' | PlatformId>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'healthy' | 'low' | 'issue'>('all');
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

  const stats = useMemo(() => {
    const total = accounts.length;
    const byPlatform = {
      antigravity: accounts.filter((a) => a.platform === 'antigravity').length,
      codex: accounts.filter((a) => a.platform === 'codex').length,
      claude: accounts.filter((a) => a.platform === 'claude').length,
    };
    let healthy = 0;
    let lowOrIssue = 0;
    let wakeupCount = 0;

    for (const a of accounts) {
      if (a.wakeupEnabled) wakeupCount++;
      const minPct = getLowestRemainingPercent(a);
      const hasIssue =
        a.status === 'error' ||
        a.status === 'forbidden' ||
        a.quota?.forbidden ||
        (minPct !== null && minPct <= 20);
      if (hasIssue) lowOrIssue++;
      else healthy++;
    }

    return { total, byPlatform, healthy, lowOrIssue, wakeupCount };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (platformFilter !== 'all' && a.platform !== platformFilter) return false;
      if (groupFilter !== 'all' && (a.groupName ?? '') !== groupFilter) return false;
      if (selectedTag && !a.tags.includes(selectedTag)) return false;

      if (statusFilter !== 'all') {
        const minPct = getLowestRemainingPercent(a);
        const isIssue =
          a.status === 'error' || a.status === 'forbidden' || Boolean(a.quota?.forbidden);
        const isLow = !isIssue && minPct !== null && minPct <= 25;
        if (statusFilter === 'issue' && !isIssue) return false;
        if (statusFilter === 'low' && !isLow) return false;
        if (statusFilter === 'healthy' && (isIssue || isLow)) return false;
      }

      if (q) {
        const hay = [
          a.email,
          a.displayName ?? '',
          a.groupName ?? '',
          a.note ?? '',
          a.plan ?? '',
          ...a.tags,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [accounts, platformFilter, groupFilter, statusFilter, selectedTag, search]);

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
    if (!window.confirm(`ต้องการลบบัญชี ${account.email} ออกจากฐานข้อมูลหรือไม่?`)) {
      return;
    }
    const res = await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' });
    if (res.ok) {
      setAccounts((prev) => prev.filter((a) => a.id !== account.id));
      showToast(`ลบบัญชี ${account.email} แล้ว`);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

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
            <span className="hidden sm:inline text-[12px] text-[#6b7280]">
              Antigravity · Codex · Claude
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={refreshingAll || accounts.length === 0}
              onClick={handleRefreshAll}
              className="h-9 px-3 rounded-lg bg-[#16181b] border border-white/[0.08] hover:border-white/[0.18] text-[13px] text-[#f3f4f6] disabled:opacity-40 inline-flex items-center gap-2 transition-colors"
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
              className="h-9 px-3 rounded-lg bg-[#16181b] border border-white/[0.08] hover:border-white/[0.18] text-[13px] text-[#f3f4f6] inline-flex items-center gap-2 transition-colors"
            >
              <Zap size={15} strokeWidth={1.5} />
              <span className="hidden sm:inline">Wake-up</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="h-9 px-3.5 rounded-lg bg-[#f3f4f6] text-[#0f1012] hover:bg-white text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus size={16} strokeWidth={1.5} />
              <span>เพิ่มบัญชี</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title="ออกจากระบบ"
              className="h-9 px-2.5 rounded-lg text-[13px] text-[#9ca3af] hover:text-[#f3f4f6] inline-flex items-center gap-1.5 transition-colors ml-1"
            >
              <LogOut size={15} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-8 space-y-6">
        {/* Stat Summary Row */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#16181b] border border-white/[0.08] rounded-2xl p-5">
            <div className="text-[12px] text-[#9ca3af] mb-1">บัญชีทั้งหมด</div>
            <div className="text-[28px] font-medium font-mono tabular-nums text-[#f3f4f6]">
              {stats.total}
            </div>
            <div className="text-[12px] font-mono tabular-nums text-[#6b7280] mt-1">
              AG {stats.byPlatform.antigravity} · CX {stats.byPlatform.codex} · CL{' '}
              {stats.byPlatform.claude}
            </div>
          </div>

          <div className="bg-[#16181b] border border-white/[0.08] rounded-2xl p-5">
            <div className="text-[12px] text-[#9ca3af] mb-1">พร้อมใช้งานปกติ</div>
            <div className="text-[28px] font-medium font-mono tabular-nums text-[#34d399]">
              {stats.healthy}
            </div>
            <div className="text-[12px] text-[#6b7280] mt-1">
              โควต้าคงเหลือมากกว่า 20%
            </div>
          </div>

          <div className="bg-[#16181b] border border-white/[0.08] rounded-2xl p-5">
            <div className="text-[12px] text-[#9ca3af] mb-1">โควต้าต่ำหรือติดจำกัด</div>
            <div className="text-[28px] font-medium font-mono tabular-nums text-[#fbbf24]">
              {stats.lowOrIssue}
            </div>
            <div className="text-[12px] text-[#6b7280] mt-1">
              ต่ำกว่า 20% หรือต้องตรวจสอบสิทธิ์
            </div>
          </div>

          <div className="bg-[#16181b] border border-white/[0.08] rounded-2xl p-5">
            <div className="text-[12px] text-[#9ca3af] mb-1">ตั้งปลุกอัตโนมัติ (Wake-up)</div>
            <div className="text-[28px] font-medium font-mono tabular-nums text-[#f3f4f6]">
              {stats.wakeupCount}
            </div>
            <div className="text-[12px] text-[#6b7280] mt-1">
              บัญชีที่เปิดรับคำสั่งปลุกรอบโควต้า
            </div>
          </div>
        </section>

        {/* Filter & Search Bar */}
        <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'ทั้งหมด', count: stats.total },
                {
                  id: 'antigravity',
                  label: PLATFORM_META.antigravity.label,
                  count: stats.byPlatform.antigravity,
                },
                {
                  id: 'codex',
                  label: PLATFORM_META.codex.label,
                  count: stats.byPlatform.codex,
                },
                {
                  id: 'claude',
                  label: PLATFORM_META.claude.label,
                  count: stats.byPlatform.claude,
                },
              ] as const
            ).map((tab) => {
              const active = platformFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPlatformFilter(tab.id)}
                  className={`h-9 px-3.5 rounded-lg text-[13px] inline-flex items-center gap-2 border transition-colors ${
                    active
                      ? 'bg-[#1e2025] border-white/[0.16] text-[#f3f4f6] font-medium'
                      : 'bg-[#16181b] border-white/[0.06] text-[#9ca3af] hover:text-[#f3f4f6]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="font-mono tabular-nums text-[11px] text-[#6b7280]">
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {allGroups.length > 0 && (
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="h-9 px-3 rounded-lg bg-[#16181b] border border-white/[0.08] text-[13px] text-[#f3f4f6] focus:outline-none focus:border-[#38bdf8]"
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
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | 'healthy' | 'low' | 'issue')
              }
              className="h-9 px-3 rounded-lg bg-[#16181b] border border-white/[0.08] text-[13px] text-[#f3f4f6] focus:outline-none focus:border-[#38bdf8]"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="healthy">ปกติ (&gt;25%)</option>
              <option value="low">โควต้าต่ำ (&le;25%)</option>
              <option value="issue">มีข้อผิดพลาด / 403</option>
            </select>

            <div className="relative flex-1 sm:flex-initial sm:w-64">
              <Search
                size={15}
                strokeWidth={1.5}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาอีเมล กลุ่ม หรือแท็ก"
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#16181b] border border-white/[0.08] text-[13px] text-[#f3f4f6] placeholder:text-[#6b7280] focus:outline-none focus:border-[#38bdf8]"
              />
            </div>
          </div>
        </section>

        {/* Active Tag Row */}
        {allTags.length > 0 && (
          <section className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-[#6b7280] mr-1">แท็ก:</span>
            {allTags.map((tag) => {
              const isSelected = selectedTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(isSelected ? null : tag)}
                  className={`h-7 px-2.5 rounded-md text-[12px] border inline-flex items-center gap-1 transition-colors ${
                    isSelected
                      ? 'bg-[#38bdf8]/15 border-[#38bdf8]/50 text-[#f3f4f6]'
                      : 'bg-[#16181b] border-white/[0.06] text-[#9ca3af] hover:text-[#f3f4f6]'
                  }`}
                >
                  <span>#{tag}</span>
                  {isSelected && <X size={12} strokeWidth={1.5} />}
                </button>
              );
            })}
          </section>
        )}

        {/* Accounts Grid or Empty State */}
        {accounts.length === 0 ? (
          <section className="bg-[#16181b] border border-white/[0.08] rounded-2xl p-12 text-center max-w-[540px] mx-auto my-8">
            <h2 className="text-[18px] font-medium text-[#f3f4f6] mb-2">
              ยังไม่มีบัญชีในระบบ
            </h2>
            <p className="text-[13px] text-[#9ca3af] mb-6 leading-relaxed">
              เริ่มต้นเพิ่มบัญชี Antigravity, Codex หรือ Claude ผ่านลิงก์ OAuth, วาง Refresh Token หรือนำเข้าไฟล์ JSON จากโปรแกรม Cockpit Tools เดิมได้ทันที
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="h-10 px-5 rounded-lg bg-[#f3f4f6] text-[#0f1012] text-[14px] font-medium inline-flex items-center gap-2 hover:bg-white transition-colors"
            >
              <Plus size={16} strokeWidth={1.5} />
              <span>เพิ่มบัญชีแรก</span>
            </button>
          </section>
        ) : filteredAccounts.length === 0 ? (
          <section className="bg-[#16181b] border border-white/[0.08] rounded-2xl p-10 text-center text-[13px] text-[#9ca3af]">
            ไม่พบบัญชีที่ตรงกับตัวกรองที่เลือก
          </section>
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
      </main>

      {/* Modals */}
      {showAddModal && (
        <AddAccountModal
          onClose={() => setShowAddModal(false)}
          onAdded={(added) => {
            setAccounts((prev) => {
              const map = new Map(prev.map((a) => [a.id, a]));
              for (const item of added) {
                // Replace if same platform+email existed
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
          className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl border text-[13px] shadow-lg ${
            notice.isError
              ? 'bg-[#1c1315] border-[#f87171]/30 text-[#f87171]'
              : 'bg-[#16181b] border-white/[0.12] text-[#f3f4f6]'
          }`}
        >
          {notice.text}
        </div>
      )}
    </div>
  );
}
