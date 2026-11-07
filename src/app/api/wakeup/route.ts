import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import {
  listAccountsWithSecret,
  listPublicAccounts,
  listWakeupLogs,
  recordWakeupLog,
  updateAccountAfterRefresh,
} from '@/lib/db';
import { PLATFORM_META } from '@/lib/format';
import { computeAccountStatus, runPlatformWakeup } from '@/lib/providers';

export async function GET(req: NextRequest) {
  const unauth = await requireApiAuth(req);
  if (unauth) return unauth;

  const logs = await listWakeupLogs(30);
  return NextResponse.json({ logs });
}

export async function POST(req: NextRequest) {
  const unauth = await requireApiAuth(req);
  if (unauth) return unauth;

  const enabled = await listAccountsWithSecret({ wakeupOnly: true });
  let successCount = 0;
  let failCount = 0;

  for (const acc of enabled) {
    const started = Date.now();
    const model = acc.wakeupModel || PLATFORM_META[acc.platform].defaultWakeupModel;
    try {
      const res = await runPlatformWakeup(acc.platform, acc.credentials, model);
      await recordWakeupLog({
        id: randomUUID(),
        accountId: acc.id,
        platform: acc.platform,
        email: acc.email,
        model: res.model,
        triggerSource: 'manual',
        success: true,
        message: res.message,
        durationMs: Date.now() - started,
      });
      await updateAccountAfterRefresh({
        id: acc.id,
        credentials: res.credentials,
        quota: res.quota,
        plan: res.quota.plan ?? acc.plan,
        status: computeAccountStatus(res.quota),
        lastError: null,
      });
      successCount++;
    } catch (err) {
      failCount++;
      await recordWakeupLog({
        id: randomUUID(),
        accountId: acc.id,
        platform: acc.platform,
        email: acc.email,
        model,
        triggerSource: 'manual',
        success: false,
        message: err instanceof Error ? err.message : 'Wake-up failed',
        durationMs: Date.now() - started,
      });
    }
  }

  const accounts = await listPublicAccounts();
  return NextResponse.json({ accounts, successCount, failCount });
}
