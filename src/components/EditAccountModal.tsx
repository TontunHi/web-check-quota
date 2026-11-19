'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import type { PublicAccount } from '@/lib/types';
import { PLATFORM_META } from '@/lib/format';
import {
  getModelDisplayLabel,
  isLegacyWakeupModel,
  PLATFORM_WAKEUP_PRESETS,
  resolveAccountAvailableModels,
} from '@/lib/models';
import { FOCUS_RING, ModalShell } from './uiPrimitives';

interface EditAccountModalProps {
  account: PublicAccount;
  onClose: () => void;
  onSaved: (updated: PublicAccount) => void;
}

export function EditAccountModal({
  account,
  onClose,
  onSaved,
}: EditAccountModalProps) {
  const meta = PLATFORM_META[account.platform];
  const [displayName, setDisplayName] = useState(account.displayName ?? '');
  const [groupName, setGroupName] = useState(account.groupName ?? '');
  const [tagsInput, setTagsInput] = useState(account.tags.join(', '));
  const [note, setNote] = useState(account.note ?? '');
  const [wakeupEnabled, setWakeupEnabled] = useState(account.wakeupEnabled);
  const [wakeupModel, setWakeupModel] = useState(
    account.wakeupModel || meta.defaultWakeupModel
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedAccountModels = useMemo(
    () => resolveAccountAvailableModels(account),
    [account]
  );

  const livePickerItems = useMemo(() => {
    if (!resolvedAccountModels.isLive && !account.quota?.availableModels?.length) {
      return [];
    }
    return resolvedAccountModels.models.map((m) => ({
      id: m.id,
      label: getModelDisplayLabel(m.id, account.platform) ?? m.displayName ?? m.id,
    }));
  }, [account.platform, account.quota?.availableModels?.length, resolvedAccountModels]);

  const presetPickerItems = useMemo(
    () =>
      PLATFORM_WAKEUP_PRESETS[account.platform].map((modelId) => ({
        id: modelId,
        label: getModelDisplayLabel(modelId, account.platform) ?? modelId,
      })),
    [account.platform]
  );

  const isLegacy = isLegacyWakeupModel(account.platform, wakeupModel);
  const selectedTrimmed = wakeupModel.trim();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          groupName: groupName.trim() || null,
          tags,
          note: note.trim() || null,
          wakeupEnabled,
          wakeupModel: wakeupModel.trim() || meta.defaultWakeupModel,
        }),
      });
      const data = (await res.json()) as { account?: PublicAccount; error?: string };
      if (!res.ok || !data.account) {
        setError(data.error || 'บันทึกข้อมูลไม่สำเร็จ');
        setSaving(false);
        return;
      }
      onSaved(data.account);
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="ตั้งค่าบัญชีและ Wake-up"
      subtitle={account.email}
      maxWidthClass="max-w-[500px]"
      panelClassName="max-h-[90vh] overflow-y-auto"
      onClose={onClose}
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] text-[#b4bac4] mb-2">
              ชื่อแสดงผล
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="เช่น บัญชีหลัก"
              className={`w-full h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] text-[13px] text-[#f3f4f6] placeholder:text-[#8b93a1] transition-colors ${FOCUS_RING}`}
            />
          </div>

          <div>
            <label className="block text-[12px] text-[#b4bac4] mb-2">
              กลุ่ม (Group)
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="เช่น งานหลัก / สำรอง"
              className={`w-full h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] text-[13px] text-[#f3f4f6] placeholder:text-[#8b93a1] transition-colors ${FOCUS_RING}`}
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] text-[#b4bac4] mb-2">
            แท็ก (คั่นด้วยลูกน้ำ ,)
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="pro, team-a, backup"
            className={`w-full h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] text-[13px] text-[#f3f4f6] placeholder:text-[#8b93a1] transition-colors ${FOCUS_RING}`}
          />
        </div>

        <div>
          <label className="block text-[12px] text-[#b4bac4] mb-2">
            หมายเหตุ
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="บันทึกเพิ่มเติม"
            className={`w-full h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] text-[13px] text-[#f3f4f6] placeholder:text-[#8b93a1] transition-colors ${FOCUS_RING}`}
          />
        </div>

        <div className="pt-3 border-t border-white/[0.06] space-y-3">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <span className="block text-[13px] text-[#f3f4f6]">
                เปิดใช้งาน Wake-up อัตโนมัติ
              </span>
              <span className="block text-[11px] text-[#8b93a1]">
                รวมบัญชีนี้เมื่อสั่งปลุกทั้งหมดหรือรันผ่าน Cron
              </span>
            </div>
            <input
              type="checkbox"
              checked={wakeupEnabled}
              onChange={(e) => setWakeupEnabled(e.target.checked)}
              className={`h-4 w-4 accent-[#34d399] rounded ${FOCUS_RING}`}
            />
          </label>

          <div className="space-y-2">
            <label
              htmlFor={`wakeup-model-${account.id}`}
              className="block text-[12px] text-[#b4bac4]"
            >
              โมเดลที่ใช้ส่งคำสั่งปลุก (Wake-up model)
            </label>
            <input
              id={`wakeup-model-${account.id}`}
              type="text"
              value={wakeupModel}
              onChange={(e) => setWakeupModel(e.target.value)}
              placeholder={meta.defaultWakeupModel}
              className={`w-full h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] font-mono text-[12px] text-[#f3f4f6] placeholder:text-[#8b93a1] transition-colors ${FOCUS_RING}`}
            />

            {isLegacy && (
              <div className="rounded-xl bg-[#fbbf24]/[0.08] border border-[#fbbf24]/25 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[12px] text-[#fbbf24]">
                  <AlertTriangle size={14} strokeWidth={1.5} className="shrink-0" />
                  <span>รุ่นที่เลือกอาจถูกปลดระวางหรือเป็นรหัสเก่าแล้ว</span>
                </div>
                <button
                  type="button"
                  onClick={() => setWakeupModel(meta.defaultWakeupModel)}
                  className={`shrink-0 h-7 px-3 rounded-lg bg-[#fbbf24]/15 border border-[#fbbf24]/30 text-[11px] font-medium text-[#fbbf24] hover:bg-[#fbbf24]/25 transition-colors ${FOCUS_RING}`}
                >
                  ใช้รุ่นแนะนำ ({meta.defaultWakeupModel})
                </button>
              </div>
            )}

            {/* Custom Dark Wake-up Model Picker */}
            <div className="max-h-52 overflow-y-auto rounded-xl bg-[#0f1012] border border-white/[0.08] divide-y divide-white/[0.06]">
              {livePickerItems.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-[11px] font-medium text-[#8b93a1] bg-[#16181b] border-b border-white/[0.06] sticky top-0">
                    โมเดลจากบัญชีนี้ (Live)
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {livePickerItems.map((item) => {
                      const active = selectedTrimmed === item.id;
                      return (
                        <button
                          key={`live:${item.id}`}
                          type="button"
                          onClick={() => setWakeupModel(item.id)}
                          className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors ${FOCUS_RING} ${
                            active
                              ? 'bg-[#1c1f24] text-[#f3f4f6]'
                              : 'hover:bg-white/[0.03] text-[#b4bac4]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-[12px] text-[#f3f4f6] truncate">
                              {item.label}
                            </div>
                            <div className="text-[11px] font-mono text-[#8b93a1] truncate">
                              {item.id}
                            </div>
                          </div>
                          {active && (
                            <Check
                              size={14}
                              strokeWidth={1.5}
                              className="text-[#34d399] shrink-0"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="px-3 py-2 text-[11px] font-medium text-[#8b93a1] bg-[#16181b] border-b border-white/[0.06] sticky top-0">
                  ชุดแนะนำ (v1.3.80)
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {presetPickerItems.map((item) => {
                    const active = selectedTrimmed === item.id;
                    return (
                      <button
                        key={`preset:${item.id}`}
                        type="button"
                        onClick={() => setWakeupModel(item.id)}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors ${FOCUS_RING} ${
                          active
                            ? 'bg-[#1c1f24] text-[#f3f4f6]'
                            : 'hover:bg-white/[0.03] text-[#b4bac4]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-[12px] text-[#f3f4f6] truncate">
                            {item.label}
                          </div>
                          <div className="text-[11px] font-mono text-[#8b93a1] truncate">
                            {item.id}
                          </div>
                        </div>
                        {active && (
                          <Check
                            size={14}
                            strokeWidth={1.5}
                            className="text-[#34d399] shrink-0"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="text-[12px] text-[#f87171] bg-[#f87171]/[0.08] border border-[#f87171]/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`h-9 px-4 rounded-lg text-[13px] text-[#b4bac4] hover:text-[#f3f4f6] hover:bg-white/[0.06] transition-colors ${FOCUS_RING}`}
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className={`h-9 px-4 rounded-lg bg-[#f3f4f6] text-[#0f1012] text-[13px] font-medium hover:bg-white disabled:opacity-50 transition-colors ${FOCUS_RING}`}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
