import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { listPublicAccounts, upsertAccount } from '@/lib/db';
import {
  buildAccountFromTokenInput,
  computeAccountStatus,
} from '@/lib/providers';
import type { PlatformId } from '@/lib/types';

export async function GET(req: NextRequest) {
  const unauth = await requireApiAuth(req);
  if (unauth) return unauth;

  try {
    const accounts = await listPublicAccounts();
    return NextResponse.json({ accounts });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load accounts' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const unauth = await requireApiAuth(req);
  if (unauth) return unauth;

  try {
    const body = (await req.json()) as {
      platform?: PlatformId;
      email?: string;
      authType?: 'oauth' | 'session_key' | 'api_key';
      token?: string;
      accessToken?: string;
      accountId?: string;
      baseUrl?: string;
      groupName?: string | null;
      tags?: string[];
    };

    if (
      !body.platform ||
      !['antigravity', 'codex', 'claude'].includes(body.platform)
    ) {
      return NextResponse.json({ error: 'กรุณาระบุค่ายที่ถูกต้อง' }, { status: 400 });
    }

    const built = await buildAccountFromTokenInput({
      platform: body.platform,
      email: body.email,
      authType: body.authType,
      token: body.token,
      accessToken: body.accessToken,
      accountId: body.accountId,
      baseUrl: body.baseUrl,
    });

    const saved = await upsertAccount({
      id: built.id,
      platform: body.platform,
      email: built.email,
      displayName: built.displayName,
      plan: built.plan,
      groupName: body.groupName ?? null,
      tags: body.tags ?? [],
      credentials: built.credentials,
      quota: built.quota,
      status: computeAccountStatus(built.quota),
    });

    return NextResponse.json({ account: saved });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'เพิ่มบัญชีไม่สำเร็จ' },
      { status: 400 }
    );
  }
}
