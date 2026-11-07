import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { consumeOAuthState, upsertAccount } from '@/lib/db';
import { completePlatformOAuth, computeAccountStatus } from '@/lib/providers';
import type { PlatformId } from '@/lib/types';

export async function POST(req: NextRequest) {
  const unauth = await requireApiAuth(req);
  if (unauth) return unauth;

  try {
    const body = (await req.json()) as {
      platform?: PlatformId;
      state?: string | null;
      callbackUrl?: string;
      groupName?: string | null;
      tags?: string[];
    };

    if (!body.platform || !body.callbackUrl?.trim()) {
      return NextResponse.json(
        { error: 'กรุณาวาง Callback URL หรือรหัสยืนยันที่ได้รับ' },
        { status: 400 }
      );
    }

    // Extract state from callback URL if not passed explicitly
    let lookupState = body.state?.trim() || null;
    if (!lookupState) {
      const trimmed = body.callbackUrl.trim();
      if (trimmed.includes('state=')) {
        try {
          const u = trimmed.startsWith('http')
            ? new URL(trimmed)
            : new URL(`http://localhost/?${trimmed.replace(/^\?/, '')}`);
          lookupState = u.searchParams.get('state');
        } catch {
          // Ignore URL parse error
        }
      } else if (trimmed.includes('#')) {
        lookupState = trimmed.split('#')[1]?.trim() || null;
      }
    }

    const stored = lookupState ? await consumeOAuthState(lookupState) : null;
    if (!stored) {
      return NextResponse.json(
        {
          error:
            'ไม่พบเซสชัน OAuth หรือหมดเวลา 30 นาที กรุณากดปุ่มสร้างลิงก์ OAuth ใหม่อีกครั้ง',
        },
        { status: 400 }
      );
    }

    const completed = await completePlatformOAuth({
      platform: stored.platform,
      callbackUrl: body.callbackUrl,
      redirectUri: stored.redirectUri,
      codeVerifier: stored.codeVerifier,
      expectedState: lookupState,
    });

    const saved = await upsertAccount({
      id: randomUUID(),
      platform: stored.platform,
      email: completed.email,
      displayName: completed.displayName,
      plan: completed.plan,
      groupName: body.groupName ?? null,
      tags: body.tags ?? [],
      credentials: completed.credentials,
      quota: completed.quota,
      status: computeAccountStatus(completed.quota),
    });

    return NextResponse.json({ account: saved });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'ยืนยัน OAuth ไม่สำเร็จ' },
      { status: 400 }
    );
  }
}
