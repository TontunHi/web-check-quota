'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
        setLoading(false);
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#0f1012]">
      <div className="w-full max-w-[380px] bg-[#16181b] border border-white/[0.08] rounded-2xl p-6">
        <div className="flex items-center gap-2.5 mb-6">
          <span className="w-2 h-2 rounded-full bg-[#34d399]" />
          <span className="text-[15px] font-medium text-[#f3f4f6]">
            Cockpit Telemetry
          </span>
        </div>

        <h1 className="text-[20px] font-medium text-[#f3f4f6] mb-1">
          ยืนยันตัวตนเข้าใช้งาน
        </h1>
        <p className="text-[13px] text-[#9ca3af] mb-6">
          แดชบอร์ดติดตามโควต้าส่วนตัวสำหรับ Antigravity, Codex และ Claude
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-[13px] text-[#9ca3af] mb-2"
            >
              รหัสผ่านผู้ดูแล (ADMIN_PASSWORD)
            </label>
            <div className="relative">
              <KeyRound
                size={16}
                strokeWidth={1.5}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]"
              />
              <input
                id="password"
                type="password"
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#0f1012] border border-white/[0.08] text-[14px] text-[#f3f4f6] placeholder:text-[#6b7280] focus:outline-none focus:border-[#38bdf8] transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="text-[13px] text-[#f87171] bg-[#f87171]/[0.08] border border-[#f87171]/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full h-10 rounded-lg bg-[#f3f4f6] text-[#0f1012] text-[14px] font-medium flex items-center justify-center gap-2 hover:bg-white disabled:opacity-50 transition-colors"
          >
            <span>{loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่แดชบอร์ด'}</span>
            {!loading && <ArrowRight size={16} strokeWidth={1.5} />}
          </button>
        </form>
      </div>
    </main>
  );
}
