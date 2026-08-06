import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mergeGuestWorkspaceIntoUser } from '@spain/database';
import { authProvider, mapOtpError } from '@/lib/auth-runtime';
import { ensureUserRow } from '@/lib/ensure-user';
import { getAppDb } from '@/lib/db';
import { appendFakeSessionCookie, appendSupabaseSessionCookies } from '@/lib/session';
import { assertSameOrigin } from '@/lib/csrf';
import { readGuestToken } from '@/lib/guest-cookie';

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
      shortlists: z
        .array(
          z.object({
            name: z.string().max(80),
            isDefault: z.boolean().optional(),
            listingIds: z.array(z.string()).max(100),
            note: z.string().max(4000).optional(),
          }),
        )
        .max(20)
        .optional(),
      preferenceWeights: z.record(z.string(), z.number()).optional(),
      propertyNotes: z
        .array(
          z.object({
            listingId: z.string(),
            body: z.string().max(4000),
            positives: z.array(z.string()).max(10).optional(),
            negatives: z.array(z.string()).max(10).optional(),
          }),
        )
        .max(100)
        .optional(),
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
    const guestToken = readGuestToken(request);

    const { db, client } = getAppDb();
    let mergeResult = null;
    try {
      await ensureUserRow(db, user.id);
      mergeResult = await mergeGuestWorkspaceIntoUser(db, user.id, {
        guestToken,
        guestSessionId: body.guestKey,
        fallbackPayload: body.guestPayload
          ? {
              favouriteListingIds: body.guestPayload.favouriteListingIds ?? [],
              comparisonListingIds: body.guestPayload.comparisonListingIds ?? [],
              recentViewListingIds: body.guestPayload.recentViewListingIds ?? [],
              savedSearchCriteria: body.guestPayload.savedSearchCriteria ?? [],
              shortlists: body.guestPayload.shortlists,
              preferenceWeights: body.guestPayload.preferenceWeights,
              propertyNotes: body.guestPayload.propertyNotes,
            }
          : null,
      });
    } finally {
      await client.end({ timeout: 5 });
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
        merged: Boolean(mergeResult),
        merge: mergeResult,
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
