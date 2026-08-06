import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mergeGuestWorkspaceIntoUser } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { ensureUserRow } from '@/lib/ensure-user';
import { readGuestToken } from '@/lib/guest-cookie';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

const bodySchema = z
  .object({
    favouriteListingIds: z.array(z.string().uuid()).max(200).optional(),
    comparisonListingIds: z.array(z.string().uuid()).max(50).optional(),
    recentViewListingIds: z.array(z.string().uuid()).max(100).optional(),
    savedSearchCriteria: z.array(z.unknown()).max(20).optional(),
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
      .optional(),
    preferenceWeights: z.record(z.string(), z.number()).optional(),
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
      .optional(),
    savedSearches: z
      .array(
        z.object({
          name: z.string().max(120),
          criteria: z.unknown(),
          criteriaHash: z.string().max(64).optional(),
          alertsEnabled: z.boolean().optional(),
          alertTypes: z.array(z.string().max(64)).max(10).optional(),
          disabled: z.boolean().optional(),
        }),
      )
      .max(5)
      .optional(),
    browsingHistory: z
      .array(
        z.object({
          listingId: z.string().uuid(),
          physicalPropertyId: z.string().uuid().optional(),
          firstViewedAt: z.string(),
          lastViewedAt: z.string(),
          viewCount: z.number().int().positive(),
          channel: z.string().max(32).optional(),
          context: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .max(50)
      .optional(),
  })
  .optional();

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const json = await request.json().catch(() => ({}));
    const fallback = bodySchema.parse(json);
    const guestToken = readGuestToken(request);
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      await ensureUserRow(db, session.userId);
      const result = await mergeGuestWorkspaceIntoUser(db, session.userId, {
        guestToken,
        fallbackPayload: fallback
          ? {
              favouriteListingIds: fallback.favouriteListingIds ?? [],
              comparisonListingIds: fallback.comparisonListingIds ?? [],
              recentViewListingIds: fallback.recentViewListingIds ?? [],
              savedSearchCriteria: fallback.savedSearchCriteria ?? [],
              shortlists: fallback.shortlists,
              preferenceWeights: fallback.preferenceWeights,
              propertyNotes: fallback.propertyNotes,
              savedSearches: fallback.savedSearches,
              browsingHistory: fallback.browsingHistory,
            }
          : null,
      });
      return NextResponse.json({ ok: true, result });
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    return workspaceErrorResponse(err);
  }
}
