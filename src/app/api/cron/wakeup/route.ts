import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedRequest } from '@/lib/auth';
import {
  listAccountsWithSecret,
  recordWakeupLog,
  updateAccountAfterRefresh,
} from '@/lib/db';
import { PLATFORM_META } from '@/lib/format';
import { isFreeAccount } from '@/lib/models';
import { computeAccountStatus, runPlatformWakeup } from '@/lib/providers';

async function handleScheduledWakeup(req: NextRequest) {
  if (!(await isAuthorizedRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  const enabled = (await listAccountsWithSecret({ wakeupOnly: true })).filter(
    (acc) => !isFreeAccount(acc)
  );
  let triggered = 0;
  let failed = 0;

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
        triggerSource: 'scheduled',
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
      triggered++;
    } catch (err) {
      failed++;
      await recordWakeupLog({
        id: randomUUID(),
        accountId: acc.id,
        platform: acc.platform,
        email: acc.email,
        model,
        triggerSource: 'scheduled',
        success: false,
        message: err instanceof Error ? err.message : 'Scheduled wake-up failed',
        durationMs: Date.now() - started,
      });
    }
  }

  return NextResponse.json({ ok: true, triggered, failed });
}

export async function GET(req: NextRequest) {
  return handleScheduledWakeup(req);
}

export async function POST(req: NextRequest) {
  return handleScheduledWakeup(req);
}
