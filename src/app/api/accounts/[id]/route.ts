import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { deleteAccountById, updateAccountMeta } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const unauth = await requireApiAuth(req);
  if (unauth) return unauth;

  const { id } = await context.params;
  try {
    const body = (await req.json()) as {
      displayName?: string | null;
      groupName?: string | null;
      tags?: string[];
      note?: string | null;
      wakeupEnabled?: boolean;
      wakeupModel?: string | null;
    };

    const updated = await updateAccountMeta(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'ไม่พบบัญชีนี้' }, { status: 404 });
    }
    return NextResponse.json({ account: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'อัปเดตไม่สำเร็จ' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const unauth = await requireApiAuth(req);
  if (unauth) return unauth;

  const { id } = await context.params;
  await deleteAccountById(id);
  return NextResponse.json({ ok: true });
}
