'use client';

import { useEffect, useState } from 'react';
import { Zap, CheckCircle2, XCircle } from 'lucide-react';
import type { WakeupLogItem } from '@/lib/types';
import { PLATFORM_META } from '@/lib/format';
import { getModelDisplayLabel } from '@/lib/models';
import { FOCUS_RING, ModalShell } from './uiPrimitives';

interface WakeupLogsModalProps {
  onClose: () => void;
  onRunAllWakeup: () => Promise<void>;
  runningAll: boolean;
}

export function WakeupLogsModal({
  onClose,
  onRunAllWakeup,
  runningAll,
}: WakeupLogsModalProps) {
  const [logs, setLogs] = useState<WakeupLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await fetch('/api/wakeup');
      if (res.ok) {
        const data = (await res.json()) as { logs?: WakeupLogItem[] };
        setLogs(data.logs ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  async function handleTriggerAll() {
    await onRunAllWakeup();
    await loadLogs();
  }

  return (
    <ModalShell
      title="ประวัติและคำสั่งปลุกโมเดล (Wake-up)"
      subtitle="ยิงข้อความสั้นเพื่อเริ่มนับรอบรีเซ็ตโควต้าล่วงหน้า (รองรับ Cron อัตโนมัติที่ /api/cron/wakeup)"
      maxWidthClass="max-w-[640px]"
      panelClassName="max-h-[82vh] flex flex-col"
      onClose={onClose}
    >
      <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-white/[0.06]">
        <span className="text-[12px] text-[#8b93a1] tabular-nums">
          แสดงรายการล่าสุดสูงสุด 30 รายการ
        </span>
        <button
          type="button"
          disabled={runningAll}
          onClick={handleTriggerAll}
          className={`h-9 px-4 rounded-lg bg-[#f3f4f6] text-[#0f1012] text-[13px] font-medium inline-flex items-center gap-2 hover:bg-white disabled:opacity-50 transition-colors ${FOCUS_RING}`}
        >
          <Zap size={14} strokeWidth={1.5} />
          <span>
            {runningAll
              ? 'กำลังปลุกทุกบัญชีที่เปิดไว้...'
              : 'ปลุกทุกบัญชีที่เปิด Wake-up ตอนนี้'}
          </span>
        </button>
      </div>

      <div className="overflow-y-auto flex-1 space-y-2 pr-1">
        {loading ? (
          <div className="py-10 text-center text-[13px] text-[#8b93a1]">
            กำลังโหลดประวัติ...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-[#8b93a1]">
            ยังไม่มีประวัติการสั่ง Wake-up
          </div>
        ) : (
          logs.map((log) => {
            const meta = PLATFORM_META[log.platform];
            const friendlyModel = getModelDisplayLabel(log.model, log.platform);
            return (
              <div
                key={log.id}
                className="bg-[#0f1012] border border-white/[0.06] rounded-xl px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    {log.success ? (
                      <CheckCircle2
                        size={14}
                        strokeWidth={1.5}
                        className="text-[#34d399] shrink-0"
                      />
                    ) : (
                      <XCircle
                        size={14}
                        strokeWidth={1.5}
                        className="text-[#f87171] shrink-0"
                      />
                    )}
                    <span className="text-[#b4bac4]">{meta?.label ?? log.platform}</span>
                    <span className="text-[#f3f4f6] font-medium truncate">
                      {log.email}
                    </span>
                    {friendlyModel && (
                      <span className="text-[11px] text-[#b4bac4]">
                        {friendlyModel}
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-[#8b93a1]">
                      {log.model}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#b4bac4] pl-5 break-words">
                    {log.message}
                  </p>
                </div>

                <div className="text-right shrink-0 font-mono tabular-nums text-[11px] text-[#8b93a1]">
                  <div>{new Date(log.createdAt).toLocaleString('th-TH')}</div>
                  <div>
                    {log.durationMs} ms · {log.triggerSource === 'scheduled' ? 'cron' : 'manual'}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </ModalShell>
  );
}
