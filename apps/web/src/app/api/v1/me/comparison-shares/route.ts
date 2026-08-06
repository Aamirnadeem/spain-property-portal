import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createComparisonShare, listComparisonShares } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { ensureUserRow } from '@/lib/ensure-user';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return withAppAuthenticatedDb(session.userId, async (db) => {
    await ensureUserRow(db, session.userId);
    const items = await listComparisonShares(db, session.userId);
    return NextResponse.json({ items });
  });
}

const postSchema = z.object({
  listingIds: z.array(z.string().uuid()).min(2).max(5),
  publicTitle: z.string().max(120).nullable().optional(),
  publicDescription: z.string().max(500).nullable().optional(),
  expiryPreset: z.enum(['24h', '7d', '30d', 'custom']).optional(),
  customExpiresAt: z.string().optional(),
  includeWeights: z.boolean().optional(),
  includeScores: z.boolean().optional(),
  comparisonSetId: z.string().uuid().nullable().optional(),
  weights: z.record(z.string(), z.number()).optional(),
  locale: z.string().min(2).max(5).optional(),
});

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!checkRateLimit(`share-create:${session.userId}`, 10, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  try {
    const body = postSchema.parse(await request.json());
    const locale = body.locale ?? 'en';
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      await ensureUserRow(db, session.userId);
      const created = await createComparisonShare(db, session.userId, body);
      return NextResponse.json(
        {
          item: created.share,
          plaintextToken: created.plaintextToken,
          publicPath: created.publicPath,
          publicUrl: `/${locale}${created.publicPath}`,
        },
        { status: 201 },
      );
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    return workspaceErrorResponse(err);
  }
}
