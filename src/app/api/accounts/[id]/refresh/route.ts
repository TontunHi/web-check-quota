import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { getAccountWithSecret, updateAccountAfterRefresh } from '@/lib/db';
import { computeAccountStatus, refreshPlatformQuota } from '@/lib/providers';

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

  try {
    const result = await refreshPlatformQuota(existing.platform, existing.credentials);
    const updated = await updateAccountAfterRefresh({
      id,
      credentials: result.credentialsChanged ? result.credentials : undefined,
      quota: result.quota,
      plan: result.quota.plan ?? existing.plan,
      status: computeAccountStatus(result.quota),
      lastError: null,
    });
    return NextResponse.json({ account: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'รีเฟรชโควต้าไม่สำเร็จ';
    const updated = await updateAccountAfterRefresh({
      id,
      status: 'error',
      lastError: msg,
    });
    return NextResponse.json({ account: updated, error: msg }, { status: 502 });
  }
}
