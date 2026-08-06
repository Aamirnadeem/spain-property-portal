import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DEMO_IDENTITIES, ORG_VIEWER_ID } from '@/lib/demo-identities';
import { isFakeDevAuthUiAllowed, readAuthRuntimeConfig } from '@spain/communications';
import { ensureUserRow } from '@/lib/ensure-user';
import { getAppDb } from '@/lib/db';
import { appendFakeSessionCookie } from '@/lib/session';
import { assertSameOrigin } from '@/lib/csrf';

const bodySchema = z.object({
  userId: z.string().uuid(),
});

const ALLOWED = new Set([...DEMO_IDENTITIES.map((d) => d.id), ORG_VIEWER_ID]);

/**
 * Local/test only: mint a FakeAuth sealed session for a seeded demo user.
 * Forbidden unless development/test + OTP_PROVIDER=fake.
 */
export async function POST(request: Request) {
  if (!isFakeDevAuthUiAllowed(readAuthRuntimeConfig())) {
    return NextResponse.json({ error: 'not_available' }, { status: 404 });
  }

  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });

  try {
    const body = bodySchema.parse(await request.json());
    if (!ALLOWED.has(body.userId)) {
      return NextResponse.json({ error: 'unknown_demo_user' }, { status: 400 });
    }

    const { db, client } = getAppDb();
    try {
      await ensureUserRow(db, body.userId);
    } finally {
      await client.end({ timeout: 5 });
    }

    const headers = new Headers();
    appendFakeSessionCookie(headers, body.userId);
    return NextResponse.json({ ok: true, userId: body.userId }, { headers });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    throw err;
  }
}
