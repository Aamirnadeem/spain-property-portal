import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mergeGuestWorkspace } from '@spain/domain';
import { authProvider, mapOtpError } from '@/lib/auth-runtime';
import { ensureUserRow } from '@/lib/ensure-user';
import { getAppDb } from '@/lib/db';
import { appendFakeSessionCookie, appendSupabaseSessionCookies } from '@/lib/session';
import { assertSameOrigin } from '@/lib/csrf';

const bodySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().min(4).max(8),
  guestKey: z.string().max(128).optional(),
  guestPayload: z
    .object({
      favouriteListingIds: z.array(z.string()).max(200).default([]),
      comparisonListingIds: z.array(z.string()).max(50).default([]),
      recentViewListingIds: z.array(z.string()).max(100).default([]),
      savedSearchCriteria: z.array(z.unknown()).max(20).default([]),
    })
    .optional(),
});

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });

  try {
    const json = await request.json();
    const body = bodySchema.parse(json);
    const verified = await authProvider.verifyOtp({
      challengeId: body.challengeId,
      code: body.code,
    });
    const user = verified.user;

    const { db, client } = getAppDb();
    try {
      await ensureUserRow(db, user.id);
    } finally {
      await client.end({ timeout: 5 });
    }

    let merge = null;
    if (body.guestKey && body.guestPayload) {
      merge = mergeGuestWorkspace(
        {
          guestSessionId: body.guestKey,
          ...body.guestPayload,
        },
        {
          userId: user.id,
          favouriteListingIds: [],
          comparisonListingIds: [],
          recentViewListingIds: [],
          savedSearchCriteria: [],
        },
      );
    }

    const headers = new Headers();
    if (authProvider.name === 'fake') {
      appendFakeSessionCookie(headers, user.id);
    } else if (verified.providerSession) {
      appendSupabaseSessionCookies(headers, verified.providerSession);
    }

    return NextResponse.json(
      {
        userId: user.id,
        email: user.email,
        mobile: user.mobile,
        merged: Boolean(merge),
        merge,
      },
      { headers },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    const mapped = mapOtpError(err);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
