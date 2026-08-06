import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getOrCreateGuestSession,
  mintGuestToken,
  updateGuestPayload,
  type GuestWorkspacePayload,
} from '@spain/database';
import { getAppDb } from '@/lib/db';
import { assertSameOrigin } from '@/lib/csrf';
import { appendGuestTokenCookie, readGuestToken } from '@/lib/guest-cookie';

const payloadSchema = z.object({
  favouriteListingIds: z.array(z.string().uuid()).max(200).default([]),
  comparisonListingIds: z.array(z.string().uuid()).max(50).default([]),
  recentViewListingIds: z.array(z.string().uuid()).max(100).default([]),
  savedSearchCriteria: z.array(z.unknown()).max(20).default([]),
  shortlists: z
    .array(
      z.object({
        name: z.string().max(80),
        isDefault: z.boolean().optional(),
        listingIds: z.array(z.string().uuid()).max(100),
        note: z.string().max(4000).optional(),
      }),
    )
    .max(20)
    .default([]),
  preferenceWeights: z.record(z.string(), z.number()).default({}),
  propertyNotes: z
    .array(
      z.object({
        listingId: z.string().uuid(),
        body: z.string().max(4000),
        positives: z.array(z.string().max(200)).max(10).optional(),
        negatives: z.array(z.string().max(200)).max(10).optional(),
      }),
    )
    .max(100)
    .default([]),
});

export async function GET(request: Request) {
  const existing = readGuestToken(request);
  const token = existing ?? mintGuestToken();
  const { db, client } = getAppDb();
  try {
    const { session } = await getOrCreateGuestSession(db, token);
    const headers = new Headers();
    if (!existing) appendGuestTokenCookie(headers, token);
    return NextResponse.json({ payload: session.payload, guestSessionId: session.id }, { headers });
  } finally {
    await client.end({ timeout: 5 });
  }
}

export async function PUT(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });

  try {
    const raw = await request.text();
    const json = raw ? JSON.parse(raw) : {};
    const body = payloadSchema.parse(json);
    const existing = readGuestToken(request);
    const token = existing ?? mintGuestToken();
    const { db, client } = getAppDb();
    try {
      await getOrCreateGuestSession(db, token);
      const session = await updateGuestPayload(db, token, body as GuestWorkspacePayload);
      const headers = new Headers();
      if (!existing) appendGuestTokenCookie(headers, token);
      return NextResponse.json(
        { payload: session.payload, guestSessionId: session.id },
        { headers },
      );
    } finally {
      await client.end({ timeout: 5 });
    }
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    throw err;
  }
}
