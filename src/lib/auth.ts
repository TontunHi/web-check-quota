import { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE = 'cockpit_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSigningSecret(): string {
  const appSecret = process.env.APP_SECRET || '';
  const adminPw = process.env.ADMIN_PASSWORD || '';
  if (!appSecret && !adminPw) return '';
  return `${appSecret}:${adminPw}`;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(`cockpit-auth:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyAdminPassword(input: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const secret = getSigningSecret();
  const [h1, h2] = await Promise.all([
    hmacHex(secret, input),
    hmacHex(secret, expected),
  ]);
  return constantTimeEqual(h1, h2);
}

export async function createSessionToken(): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `admin.${exp}`;
  const sig = await hmacHex(getSigningSecret(), payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token?: string | null): Promise<boolean> {
  if (!token) return false;
  const secret = getSigningSecret();
  if (!secret) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'admin') return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expectedSig = await hmacHex(secret, `${parts[0]}.${parts[1]}`);
  return constantTimeEqual(parts[2], expectedSig);
}

export async function isAuthorizedRequest(req: NextRequest): Promise<boolean> {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(cookie)) return true;

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (cronSecret && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const [h1, h2] = await Promise.all([
      hmacHex(cronSecret, token),
      hmacHex(cronSecret, cronSecret),
    ]);
    return constantTimeEqual(h1, h2);
  }
  return false;
}

export async function requireApiAuth(req: NextRequest): Promise<NextResponse | null> {
  if (await isAuthorizedRequest(req)) return null;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
};
