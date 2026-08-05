import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mergeGuestWorkspace } from '@spain/domain';
import { mapOtpError, otpStore, upsertUserFromIdentity } from '@/lib/auth-runtime';

const bodySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().min(4).max(8),
  guestKey: z.string().optional(),
  guestPayload: z
    .object({
      favouriteListingIds: z.array(z.string()).default([]),
      comparisonListingIds: z.array(z.string()).default([]),
      recentViewListingIds: z.array(z.string()).default([]),
      savedSearchCriteria: z.array(z.unknown()).default([]),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = bodySchema.parse(json);
    const verified = await otpStore.verifyCode({
      challengeId: body.challengeId,
      code: body.code,
    });
    const user = upsertUserFromIdentity(verified.channel, verified.destination);

    let merge = null;
    if (body.guestKey && body.guestPayload) {
      merge = mergeGuestWorkspace(
        {
          guestSessionId: body.guestKey,
          ...body.guestPayload,
        },
        {
          userId: user.userId,
          favouriteListingIds: [],
          comparisonListingIds: [],
          recentViewListingIds: [],
          savedSearchCriteria: [],
        },
      );
    }

    return NextResponse.json({
      userId: user.userId,
      channel: verified.channel,
      destination: verified.destination,
      merged: Boolean(merge),
      merge,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    const mapped = mapOtpError(err);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
