import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import {
  getAccountWithSecret,
  recordWakeupLog,
  updateAccountAfterRefresh,
} from '@/lib/db';
import { PLATFORM_META } from '@/lib/format';
import { computeAccountStatus, runPlatformWakeup } from '@/lib/providers';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const unauth = await requireApiAuth(req);
  if (unauth) return unauth;

  const { id } = await context.params;
  const existing = await getAccountWithSecret(id);
  if (!existing) {
    return NextResponse.json({ error: 'ไม่พบบัญชีนี้' }, { status: 404 });
  }

  const started = Date.now();
  const preferredModel =
    existing.wakeupModel || PLATFORM_META[existing.platform].defaultWakeupModel;

  try {
    const result = await runPlatformWakeup(
      existing.platform,
      existing.credentials,
      preferredModel
    );
    const durationMs = Date.now() - started;

    await recordWakeupLog({
      id: randomUUID(),
      accountId: existing.id,
      platform: existing.platform,
      email: existing.email,
      model: result.model,
      triggerSource: 'manual',
      success: true,
      message: result.message,
      durationMs,
    });

    const updated = await updateAccountAfterRefresh({
      id: existing.id,
      credentials: result.credentials,
      quota: result.quota,
      plan: result.quota.plan ?? existing.plan,
      status: computeAccountStatus(result.quota),
      lastError: null,
    });

    return NextResponse.json({ account: updated, message: result.message });
  } catch (err) {
    const durationMs = Date.now() - started;
    const msg = err instanceof Error ? err.message : 'สั่งปลุกโมเดลไม่สำเร็จ';

    await recordWakeupLog({
      id: randomUUID(),
      accountId: existing.id,
      platform: existing.platform,
      email: existing.email,
      model: preferredModel,
      triggerSource: 'manual',
      success: false,
      message: msg,
      durationMs,
    });

    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
