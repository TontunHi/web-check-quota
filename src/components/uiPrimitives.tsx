'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { ModelFamily } from '@/lib/types';
import { quotaBarColor } from '@/lib/format';

export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]/70';

export const MODEL_FAMILY_META: Record<
  ModelFamily,
  { label: string; dotColor: string }
> = {
  gemini: { label: 'Gemini', dotColor: '#38bdf8' },
  claude: { label: 'Claude', dotColor: '#fbbf24' },
  openai: { label: 'OpenAI', dotColor: '#34d399' },
  other: { label: 'Other', dotColor: '#8b93a1' },
};

export function useCopyFeedback(durationMs = 1800) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function copyText(key: string, value: string) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      }
      setCopiedKey(key);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, durationMs);
    } catch {
      // Clipboard write may be unavailable in restricted non-HTTPS contexts
    }
  }

  return { copiedKey, copyText };
}

export function QuotaTrack({
  percent,
  className = 'w-full',
}: {
  percent: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className={`relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden ${className}`}
    >
      <div
        className={`h-full rounded-full transition-colors ${quotaBarColor(clamped)}`}
        style={{ width: `${clamped}%` }}
      />
      <span
        aria-hidden="true"
        className="absolute top-0 bottom-0 left-[20%] w-px bg-white/25 pointer-events-none"
      />
    </div>
  );
}

interface InlineDeleteControlProps {
  accountLabel: string;
  onConfirmDelete: () => Promise<void> | void;
}

export function InlineDeleteControl({
  accountLabel,
  onConfirmDelete,
}: InlineDeleteControlProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    if (deleting) return;
    setDeleting(true);
    try {
      await onConfirmDelete();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          disabled={deleting}
          onClick={() => void handleConfirm()}
          className={`h-7 px-2 rounded-lg bg-[#f87171]/15 border border-[#f87171]/35 text-[11px] font-medium text-[#f87171] hover:bg-[#f87171]/25 disabled:opacity-50 transition-colors ${FOCUS_RING}`}
        >
          {deleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={() => setConfirming(false)}
          className={`h-7 px-2 rounded-lg text-[11px] text-[#b4bac4] hover:text-[#f3f4f6] hover:bg-white/[0.06] disabled:opacity-50 transition-colors ${FOCUS_RING}`}
        >
          ยกเลิก
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      title={`ลบบัญชี ${accountLabel}`}
      aria-label={`ลบบัญชี ${accountLabel}`}
      className={`h-8 w-8 rounded-lg text-[#8b93a1] hover:text-[#f87171] hover:bg-[#f87171]/[0.08] inline-flex items-center justify-center transition-colors ${FOCUS_RING}`}
    >
      <Trash2 size={14} strokeWidth={1.5} />
    </button>
  );
}

interface ModalShellProps {
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  panelClassName?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function ModalShell({
  title,
  subtitle,
  maxWidthClass = 'max-w-[480px]',
  panelClassName = '',
  onClose,
  children,
}: ModalShellProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidthClass} bg-[#16181b] border border-white/[0.08] rounded-2xl p-6 ${panelClassName}`}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <h2 className="text-[17px] font-medium text-[#f3f4f6]">{title}</h2>
            {subtitle && (
              <p className="text-[12px] text-[#8b93a1] truncate mt-1">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className={`h-8 w-8 rounded-lg text-[#b4bac4] hover:text-[#f3f4f6] hover:bg-white/[0.06] inline-flex items-center justify-center shrink-0 transition-colors ${FOCUS_RING}`}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
