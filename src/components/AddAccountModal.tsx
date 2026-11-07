'use client';

import { useState } from 'react';
import { X, ExternalLink, Upload, KeyRound, FileJson } from 'lucide-react';
import type { PlatformId, PublicAccount } from '@/lib/types';

interface AddAccountModalProps {
  onClose: () => void;
  onAdded: (accounts: PublicAccount[]) => void;
}

type TabMode = 'oauth' | 'token' | 'import';

export function AddAccountModal({ onClose, onAdded }: AddAccountModalProps) {
  const [tab, setTab] = useState<TabMode>('oauth');
  const [platform, setPlatform] = useState<PlatformId>('antigravity');

  // OAuth state
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const [oauthState, setOauthState] = useState<string | null>(null);
  const [callbackInput, setCallbackInput] = useState('');
  const [preparingOauth, setPreparingOauth] = useState(false);

  // Manual token state
  const [email, setEmail] = useState('');
  const [credentialType, setCredentialType] = useState<'oauth' | 'session_key' | 'api_key'>('oauth');
  const [tokenInput, setTokenInput] = useState('');
  const [accessTokenInput, setAccessTokenInput] = useState('');
  const [accountIdInput, setAccountIdInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [groupName, setGroupName] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // Import JSON state
  const [jsonText, setJsonText] = useState('');
  const [defaultImportPlatform, setDefaultImportPlatform] = useState<PlatformId>('antigravity');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePrepareOAuth() {
    setPreparingOauth(true);
    setError(null);
    try {
      const res = await fetch('/api/oauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });
      const data = (await res.json()) as {
        authUrl?: string;
        state?: string;
        error?: string;
      };
      if (!res.ok || !data.authUrl) {
        setError(data.error || 'ไม่สามารถสร้างลิงก์ OAuth ได้');
        return;
      }
      setOauthUrl(data.authUrl);
      setOauthState(data.state ?? null);
      window.open(data.authUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setPreparingOauth(false);
    }
  }

  async function handleCompleteOAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!callbackInput.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/oauth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          state: oauthState,
          callbackUrl: callbackInput.trim(),
          groupName: groupName.trim() || null,
          tags: tagsInput
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const data = (await res.json()) as {
        account?: PublicAccount;
        error?: string;
      };
      if (!res.ok || !data.account) {
        setError(data.error || 'ยืนยัน OAuth ไม่สำเร็จ');
        setSubmitting(false);
        return;
      }
      onAdded([data.account]);
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
      setSubmitting(false);
    }
  }

  async function handleAddToken(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenInput.trim() && !accessTokenInput.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          email: email.trim() || undefined,
          authType: credentialType,
          token: tokenInput.trim(),
          accessToken: accessTokenInput.trim() || undefined,
          accountId: accountIdInput.trim() || undefined,
          baseUrl: baseUrlInput.trim() || undefined,
          groupName: groupName.trim() || null,
          tags: tagsInput
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const data = (await res.json()) as {
        account?: PublicAccount;
        error?: string;
      };
      if (!res.ok || !data.account) {
        setError(data.error || 'เพิ่มบัญชีไม่สำเร็จ');
        setSubmitting(false);
        return;
      }
      onAdded([data.account]);
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
      setSubmitting(false);
    }
  }

  async function handleImportJson(e: React.FormEvent) {
    e.preventDefault();
    if (!jsonText.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/accounts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw: jsonText,
          defaultPlatform: defaultImportPlatform,
          groupName: groupName.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        accounts?: PublicAccount[];
        errors?: string[];
        error?: string;
      };
      if (!res.ok || !data.accounts || data.accounts.length === 0) {
        setError(
          data.error ||
            data.errors?.join('; ') ||
            'ไม่พบบัญชีที่นำเข้าได้ในข้อมูล JSON นี้'
        );
        setSubmitting(false);
        return;
      }
      onAdded(data.accounts);
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
      setSubmitting(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setJsonText(reader.result);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-[540px] max-h-[88vh] overflow-y-auto bg-[#16181b] border border-white/[0.08] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[17px] font-medium text-[#f3f4f6]">
            เพิ่มบัญชีเข้าแดชบอร์ด
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-white/[0.06] inline-flex items-center justify-center"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#0f1012] border border-white/[0.06] mb-5">
          <button
            type="button"
            onClick={() => {
              setTab('oauth');
              setError(null);
            }}
            className={`h-8 rounded-lg text-[12px] inline-flex items-center justify-center gap-1.5 transition-colors ${
              tab === 'oauth'
                ? 'bg-[#1e2025] text-[#f3f4f6] font-medium border border-white/[0.08]'
                : 'text-[#9ca3af] hover:text-[#f3f4f6]'
            }`}
          >
            <ExternalLink size={14} strokeWidth={1.5} />
            <span>OAuth ล็อกอิน</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('token');
              setError(null);
            }}
            className={`h-8 rounded-lg text-[12px] inline-flex items-center justify-center gap-1.5 transition-colors ${
              tab === 'token'
                ? 'bg-[#1e2025] text-[#f3f4f6] font-medium border border-white/[0.08]'
                : 'text-[#9ca3af] hover:text-[#f3f4f6]'
            }`}
          >
            <KeyRound size={14} strokeWidth={1.5} />
            <span>วาง Token / Key</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('import');
              setError(null);
            }}
            className={`h-8 rounded-lg text-[12px] inline-flex items-center justify-center gap-1.5 transition-colors ${
              tab === 'import'
                ? 'bg-[#1e2025] text-[#f3f4f6] font-medium border border-white/[0.08]'
                : 'text-[#9ca3af] hover:text-[#f3f4f6]'
            }`}
          >
            <FileJson size={14} strokeWidth={1.5} />
            <span>Import JSON</span>
          </button>
        </div>

        {/* Platform Picker for OAuth & Token */}
        {tab !== 'import' && (
          <div className="mb-4">
            <label className="block text-[12px] text-[#9ca3af] mb-1.5">
              เลือกค่าย (Platform)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'antigravity', label: 'Antigravity' },
                  { id: 'codex', label: 'Codex (OpenAI)' },
                  { id: 'claude', label: 'Claude' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPlatform(p.id);
                    setOauthUrl(null);
                    setOauthState(null);
                    setCredentialType('oauth');
                  }}
                  className={`h-9 rounded-lg text-[13px] border transition-colors ${
                    platform === p.id
                      ? 'bg-[#1e2025] border-[#38bdf8] text-[#f3f4f6] font-medium'
                      : 'bg-[#0f1012] border-white/[0.08] text-[#9ca3af] hover:text-[#f3f4f6]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 1: OAuth */}
        {tab === 'oauth' && (
          <form onSubmit={handleCompleteOAuth} className="space-y-4">
            <div className="bg-[#0f1012] border border-white/[0.06] rounded-xl p-4 space-y-3">
              <p className="text-[12px] text-[#9ca3af] leading-relaxed">
                1. กดปุ่มด้านล่างเพื่อเปิดหน้าล็อกอินทางการในแท็บใหม่
                <br />
                2. เมื่ออนุมัติสิทธิ์เสร็จ เบราว์เซอร์จะเด้งไปหน้า Callback (เช่น{' '}
                <code className="font-mono text-[#f3f4f6]">http://localhost:...</code> หรือรหัสยืนยัน) ให้คัดลอก URL ทั้งเส้นจากช่องที่อยู่มาวางด้านล่าง
              </p>

              <button
                type="button"
                disabled={preparingOauth}
                onClick={handlePrepareOAuth}
                className="w-full h-9 rounded-lg bg-[#1e2025] border border-white/[0.1] hover:border-white/[0.2] text-[13px] text-[#f3f4f6] inline-flex items-center justify-center gap-2 transition-colors"
              >
                <ExternalLink size={14} strokeWidth={1.5} />
                <span>
                  {preparingOauth
                    ? 'กำลังสร้างลิงก์...'
                    : oauthUrl
                      ? 'เปิดลิงก์ยืนยันตัวตนอีกครั้ง'
                      : '1. สร้างและเปิดลิงก์ยืนยันตัวตน (OAuth)'}
                </span>
              </button>

              {oauthUrl && (
                <input
                  type="text"
                  readOnly
                  value={oauthUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full h-8 px-2.5 rounded bg-[#16181b] border border-white/[0.06] font-mono text-[11px] text-[#6b7280]"
                />
              )}
            </div>

            <div>
              <label className="block text-[12px] text-[#9ca3af] mb-1.5">
                2. วาง Callback URL หรือ Authorization Code ที่ได้รับ
              </label>
              <input
                type="text"
                required
                value={callbackInput}
                onChange={(e) => setCallbackInput(e.target.value)}
                placeholder={
                  platform === 'claude'
                    ? 'วาง code#state หรือ Callback URL'
                    : 'http://localhost:.../oauth-callback?code=...'
                }
                className="w-full h-10 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] font-mono text-[12px] text-[#f3f4f6] placeholder:text-[#6b7280] focus:outline-none focus:border-[#38bdf8]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="กลุ่ม (ไม่บังคับ)"
                className="h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] text-[12px] text-[#f3f4f6] placeholder:text-[#6b7280]"
              />
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="แท็ก คั่นด้วย , (ไม่บังคับ)"
                className="h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] text-[12px] text-[#f3f4f6] placeholder:text-[#6b7280]"
              />
            </div>

            {error && (
              <div className="text-[12px] text-[#f87171] bg-[#f87171]/[0.08] border border-[#f87171]/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-lg text-[13px] text-[#9ca3af] hover:text-[#f3f4f6]"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={submitting || !callbackInput.trim()}
                className="h-9 px-4 rounded-lg bg-[#f3f4f6] text-[#0f1012] text-[13px] font-medium hover:bg-white disabled:opacity-50"
              >
                {submitting ? 'กำลังยืนยันและดึงโควต้า...' : 'ยืนยันและเพิ่มบัญชี'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: Direct Token */}
        {tab === 'token' && (
          <form onSubmit={handleAddToken} className="space-y-4">
            {platform === 'claude' && (
              <div>
                <label className="block text-[12px] text-[#9ca3af] mb-1.5">
                  ประเภทข้อมูลยืนยันตัวตน Claude
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'oauth', label: 'OAuth Token' },
                      { id: 'session_key', label: 'Session Key' },
                      { id: 'api_key', label: 'API Key' },
                    ] as const
                  ).map((ct) => (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => setCredentialType(ct.id)}
                      className={`h-8 rounded-lg text-[12px] border ${
                        credentialType === ct.id
                          ? 'bg-[#1e2025] border-[#38bdf8] text-[#f3f4f6]'
                          : 'bg-[#0f1012] border-white/[0.08] text-[#9ca3af]'
                      }`}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[12px] text-[#9ca3af] mb-1.5">
                {platform === 'antigravity'
                  ? 'Refresh Token (1//0...)'
                  : platform === 'codex'
                    ? 'Refresh Token (rt_...) หรือ API Key (sk-...)'
                    : credentialType === 'session_key'
                      ? 'Claude Web sessionKey (sk-ant-sid01-...)'
                      : credentialType === 'api_key'
                        ? 'Anthropic API Key (sk-ant-api...)'
                        : 'Claude OAuth Refresh Token (sk-ant-ort01-...)'}
              </label>
              <textarea
                rows={3}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="วาง Token ที่นี่"
                className="w-full p-3 rounded-lg bg-[#0f1012] border border-white/[0.08] font-mono text-[12px] text-[#f3f4f6] placeholder:text-[#6b7280] focus:outline-none focus:border-[#38bdf8]"
              />
            </div>

            {platform !== 'antigravity' && credentialType === 'oauth' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#6b7280] mb-1">
                    Access Token (ถ้ามี)
                  </label>
                  <input
                    type="text"
                    value={accessTokenInput}
                    onChange={(e) => setAccessTokenInput(e.target.value)}
                    placeholder="eyJ... หรือ sk-ant-oat01-..."
                    className="w-full h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] font-mono text-[12px] text-[#f3f4f6]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#6b7280] mb-1">
                    Account / Org ID (ถ้ามี)
                  </label>
                  <input
                    type="text"
                    value={accountIdInput}
                    onChange={(e) => setAccountIdInput(e.target.value)}
                    placeholder="Optional UUID"
                    className="w-full h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] font-mono text-[12px] text-[#f3f4f6]"
                  />
                </div>
              </div>
            )}

            {credentialType === 'api_key' && (
              <div>
                <label className="block text-[11px] text-[#6b7280] mb-1">
                  Base URL (เว้นว่างเพื่อใช้ค่าเริ่มต้นทางการ)
                </label>
                <input
                  type="text"
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  placeholder="https://api.anthropic.com"
                  className="w-full h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] font-mono text-[12px] text-[#f3f4f6]"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="อีเมล/ชื่อเรียก (ถ้าทราบ)"
                className="h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] text-[12px] text-[#f3f4f6] placeholder:text-[#6b7280]"
              />
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="กลุ่ม (ไม่บังคับ)"
                className="h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] text-[12px] text-[#f3f4f6] placeholder:text-[#6b7280]"
              />
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="แท็ก (คั่นด้วย ,)"
                className="h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] text-[12px] text-[#f3f4f6] placeholder:text-[#6b7280]"
              />
            </div>

            {error && (
              <div className="text-[12px] text-[#f87171] bg-[#f87171]/[0.08] border border-[#f87171]/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-lg text-[13px] text-[#9ca3af] hover:text-[#f3f4f6]"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={submitting || (!tokenInput.trim() && !accessTokenInput.trim())}
                className="h-9 px-4 rounded-lg bg-[#f3f4f6] text-[#0f1012] text-[13px] font-medium hover:bg-white disabled:opacity-50"
              >
                {submitting ? 'กำลังตรวจสอบและดึงโควต้า...' : 'บันทึกบัญชี'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: Import Cockpit JSON */}
        {tab === 'import' && (
          <form onSubmit={handleImportJson} className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-[#9ca3af]">
                รองรับไฟล์ Backup/Export JSON จาก Cockpit Tools, auth.json และ .credentials.json
              </span>
              <label className="shrink-0 h-8 px-3 rounded-lg bg-[#1e2025] border border-white/[0.08] hover:border-white/[0.18] text-[12px] text-[#f3f4f6] inline-flex items-center gap-1.5 cursor-pointer">
                <Upload size={13} strokeWidth={1.5} />
                <span>เลือกไฟล์ .json</span>
                <input
                  type="file"
                  accept=".json,.txt,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              rows={6}
              required
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='วางเนื้อหา JSON จาก Cockpit Tools เช่น [{"email":"...","refresh_token":"1//..."}] หรือไฟล์ cockpit_accounts_backup.json'
              className="w-full p-3 rounded-lg bg-[#0f1012] border border-white/[0.08] font-mono text-[12px] text-[#f3f4f6] placeholder:text-[#6b7280] focus:outline-none focus:border-[#38bdf8]"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[#6b7280] mb-1">
                  ค่ายเริ่มต้น (กรณีไฟล์ไม่ได้ระบุชื่อค่าย)
                </label>
                <select
                  value={defaultImportPlatform}
                  onChange={(e) => setDefaultImportPlatform(e.target.value as PlatformId)}
                  className="w-full h-9 px-2.5 rounded-lg bg-[#0f1012] border border-white/[0.08] text-[12px] text-[#f3f4f6]"
                >
                  <option value="antigravity">Antigravity</option>
                  <option value="codex">Codex (OpenAI)</option>
                  <option value="claude">Claude</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#6b7280] mb-1">
                  จัดเข้ากลุ่มอัตโนมัติ (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="เช่น Imported"
                  className="w-full h-9 px-3 rounded-lg bg-[#0f1012] border border-white/[0.08] text-[12px] text-[#f3f4f6]"
                />
              </div>
            </div>

            {error && (
              <div className="text-[12px] text-[#f87171] bg-[#f87171]/[0.08] border border-[#f87171]/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-lg text-[13px] text-[#9ca3af] hover:text-[#f3f4f6]"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={submitting || !jsonText.trim()}
                className="h-9 px-4 rounded-lg bg-[#f3f4f6] text-[#0f1012] text-[13px] font-medium hover:bg-white disabled:opacity-50"
              >
                {submitting ? 'กำลังนำเข้าและเช็คโควต้า...' : 'นำเข้าบัญชี'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
