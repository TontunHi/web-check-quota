import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { saveOAuthState } from '@/lib/db';
import { startPlatformOAuth } from '@/lib/providers';
import type { PlatformId } from '@/lib/types';

export async function POST(req: NextRequest) {
  const unauth = await requireApiAuth(req);
  if (unauth) return unauth;

  try {
    const body = (await req.json()) as { platform?: PlatformId };
    if (
      !body.platform ||
      !['antigravity', 'codex', 'claude'].includes(body.platform)
    ) {
      return NextResponse.json({ error: 'ไม่รองรับค่ายนี้' }, { status: 400 });
    }

    const started = startPlatformOAuth(body.platform);
    await saveOAuthState({
      state: started.state,
      platform: body.platform,
      codeVerifier: started.codeVerifier ?? null,
      redirectUri: started.redirectUri,
    });

    return NextResponse.json({
      authUrl: started.authUrl,
      state: started.state,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'สร้างลิงก์ OAuth ไม่สำเร็จ' },
      { status: 500 }
    );
  }
}
