import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { upsertAccount } from '@/lib/db';
import { parseCockpitImportPayload } from '@/lib/importParser';
import { computeAccountStatus, refreshPlatformQuota } from '@/lib/providers';
import { fetchGoogleUserInfo } from '@/lib/providers/antigravity';
import { extractCodexJwtIdentity } from '@/lib/providers/codex';
import { fetchClaudeOAuthProfile } from '@/lib/providers/claude';
import type { PlatformId, PublicAccount } from '@/lib/types';

export async function POST(req: NextRequest) {
  const unauth = await requireApiAuth(req);
  if (unauth) return unauth;

  try {
    const body = (await req.json()) as {
      raw?: string;
      defaultPlatform?: PlatformId;
      groupName?: string | null;
    };

    const candidates = parseCockpitImportPayload(
      body.raw ?? '',
      body.defaultPlatform ?? 'antigravity'
    );

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลบัญชีที่รองรับในไฟล์หรือข้อความ JSON ที่ระบุ' },
        { status: 400 }
      );
    }

    const imported: PublicAccount[] = [];
    const errors: string[] = [];

    for (const candidate of candidates) {
      try {
        const fetched = await refreshPlatformQuota(
          candidate.platform,
          candidate.credentials
        );
        let email = candidate.email;
        let displayName = candidate.displayName ?? null;

        if (!email) {
          if (
            candidate.platform === 'antigravity' &&
            fetched.credentials.accessToken
          ) {
            const u = await fetchGoogleUserInfo(fetched.credentials.accessToken);
            email = u.email;
            displayName = displayName || u.name || null;
          } else if (candidate.platform === 'codex') {
            const id = extractCodexJwtIdentity(
              fetched.credentials.idToken,
              fetched.credentials.accessToken
            );
            email =
              id.email ||
              `codex-${(fetched.credentials.accountId || randomUUID()).slice(0, 8)}`;
          } else if (
            candidate.platform === 'claude' &&
            fetched.credentials.accessToken
          ) {
            const p = await fetchClaudeOAuthProfile(fetched.credentials.accessToken);
            email = p.email || `claude-${randomUUID().slice(0, 8)}`;
            displayName = displayName || p.displayName || null;
          } else {
            email = `${candidate.platform}-${randomUUID().slice(0, 8)}`;
          }
        }

        const saved = await upsertAccount({
          id: randomUUID(),
          platform: candidate.platform,
          email,
          displayName,
          plan: fetched.quota.plan ?? null,
          groupName: body.groupName ?? null,
          tags: candidate.tags ?? [],
          note: candidate.note ?? null,
          credentials: fetched.credentials,
          quota: fetched.quota,
          status: computeAccountStatus(fetched.quota),
        });
        imported.push(saved);
      } catch (err) {
        errors.push(
          `${candidate.email || candidate.platform}: ${
            err instanceof Error ? err.message : 'นำเข้าไม่สำเร็จ'
          }`
        );
      }
    }

    return NextResponse.json({ accounts: imported, errors });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'รูปแบบ JSON ไม่ถูกต้อง ไม่สามารถอ่านข้อมูลได้',
      },
      { status: 400 }
    );
  }
}
