import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  verifyAdminPassword,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { password?: string };
    const password = String(body.password ?? '');

    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'ADMIN_PASSWORD environment variable is not configured on the server' },
        { status: 500 }
      );
    }

    const ok = await verifyAdminPassword(password);
    if (!ok) {
      return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    const token = await createSessionToken();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    return res;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
