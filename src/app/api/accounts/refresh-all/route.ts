import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import {
  listAccountsWithSecret,
  listPublicAccounts,
  updateAccountAfterRefresh,
} from '@/lib/db';
import { computeAccountStatus, refreshPlatformQuota } from '@/lib/providers';
import type { PlatformId } from '@/lib/types';

export async function POST(req: NextRequest) {
  const unauth = await requireApiAuth(req);
  if (unauth) return unauth;

  const body = (await req.json().catch(() => ({}))) as { platform?: PlatformId };
  const targets = await listAccountsWithSecret(
    body.platform ? { platform: body.platform } : undefined
  );

  // Bounded concurrency (3 at a time)
  const concurrency = 3;
  let index = 0;
  let successCount = 0;
  let failCount = 0;

  async function worker() {
    while (index < targets.length) {
      const current = targets[index++];
      try {
        const result = await refreshPlatformQuota(
          current.platform,
          current.credentials
        );
        await updateAccountAfterRefresh({
          id: current.id,
          credentials: result.credentialsChanged ? result.credentials : undefined,
          quota: result.quota,
          plan: result.quota.plan ?? current.plan,
          status: computeAccountStatus(result.quota),
          lastError: null,
        });
        successCount++;
      } catch (err) {
        failCount++;
        await updateAccountAfterRefresh({
          id: current.id,
          status: 'error',
          lastError: err instanceof Error ? err.message : 'รีเฟรชโควต้าไม่สำเร็จ',
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, targets.length) }, () => worker())
  );

  const accounts = await listPublicAccounts();
  return NextResponse.json({ accounts, successCount, failCount });
}
