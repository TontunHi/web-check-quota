'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { PublicAccount } from '@/lib/types';
import { PLATFORM_META } from '@/lib/format';

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

  const suggestedModels = Array.from(
    new Set([
      ...meta.wakeupModels,
      ...(account.quota?.items
        .filter((i) => !i.key.startsWith('bucket:') && !i.key.startsWith('window:'))
        .map((i) => i.key) ?? []),
    ])
  );

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
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-[460px] bg-[#16181b] border border-white/[0.08] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[17px] font-medium text-[#f3f4f6]">
              ตั้งค่าบัญชีและ Wake-up
            </h2>
            <p className="text-[12px] text-[#6b7280] truncate max-w-[340px]">
              {account.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-white/[0.06] inline-flex items-center justify-center"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] text-[#9ca3af] mb-1.5">
                ชื่อแสดงผล
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="เช่น บัญชีหลัก"
                className="w-full h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] text-[13px] text-[#f3f4f6] placeholder:text-[#6b7280] focus:outline-none focus:border-[#38bdf8]"
              />
            </div>

            <div>
              <label className="block text-[12px] text-[#9ca3af] mb-1.5">
                กลุ่ม (Group)
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="เช่น งานหลัก / สำรอง"
                className="w-full h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] text-[13px] text-[#f3f4f6] placeholder:text-[#6b7280] focus:outline-none focus:border-[#38bdf8]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] text-[#9ca3af] mb-1.5">
              แท็ก (คั่นด้วยลูกน้ำ ,)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="pro, team-a, backup"
              className="w-full h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] text-[13px] text-[#f3f4f6] placeholder:text-[#6b7280] focus:outline-none focus:border-[#38bdf8]"
            />
          </div>

          <div>
            <label className="block text-[12px] text-[#9ca3af] mb-1.5">
              หมายเหตุ
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="บันทึกเพิ่มเติม"
              className="w-full h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] text-[13px] text-[#f3f4f6] placeholder:text-[#6b7280] focus:outline-none focus:border-[#38bdf8]"
            />
          </div>

          <div className="pt-3 border-t border-white/[0.06] space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="block text-[13px] text-[#f3f4f6]">
                  เปิดใช้งาน Wake-up อัตโนมัติ
                </span>
                <span className="block text-[11px] text-[#6b7280]">
                  รวมบัญชีนี้เมื่อสั่งปลุกทั้งหมดหรือรันผ่าน Cron
                </span>
              </div>
              <input
                type="checkbox"
                checked={wakeupEnabled}
                onChange={(e) => setWakeupEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#34d399] rounded"
              />
            </label>

            <div>
              <label className="block text-[12px] text-[#9ca3af] mb-1.5">
                โมเดลที่ใช้ส่งคำสั่งปลุก (Wake-up model)
              </label>
              <input
                type="text"
                list={`models-${account.id}`}
                value={wakeupModel}
                onChange={(e) => setWakeupModel(e.target.value)}
                placeholder={meta.defaultWakeupModel}
                className="w-full h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] font-mono text-[12px] text-[#f3f4f6] focus:outline-none focus:border-[#38bdf8]"
              />
              <datalist id={`models-${account.id}`}>
                {suggestedModels.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
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
              className="h-9 px-4 rounded-lg text-[13px] text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-white/[0.06] transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 rounded-lg bg-[#f3f4f6] text-[#0f1012] text-[13px] font-medium hover:bg-white disabled:opacity-50 transition-colors"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
