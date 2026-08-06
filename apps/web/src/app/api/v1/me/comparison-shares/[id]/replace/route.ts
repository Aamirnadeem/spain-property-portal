import { NextResponse } from 'next/server';
import { z } from 'zod';
import { replaceComparisonShare } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    listingIds: z.array(z.string().uuid()).min(2).max(5).optional(),
    publicTitle: z.string().max(120).nullable().optional(),
    publicDescription: z.string().max(500).nullable().optional(),
    expiryPreset: z.enum(['24h', '7d', '30d', 'custom']).optional(),
    customExpiresAt: z.string().optional(),
    includeWeights: z.boolean().optional(),
    includeScores: z.boolean().optional(),
    weights: z.record(z.string(), z.number()).optional(),
    locale: z.string().min(2).max(5).optional(),
  })
  .optional();

export async function POST(request: Request, ctx: Ctx) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!checkRateLimit(`share-replace:${session.userId}`, 10, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  try {
    const { id } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const body = bodySchema.parse(raw) ?? {};
    const locale = body.locale ?? 'en';
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      const created = await replaceComparisonShare(db, session.userId, id, body);
      return NextResponse.json({
        item: created.share,
        plaintextToken: created.plaintextToken,
        publicPath: created.publicPath,
        publicUrl: `/${locale}${created.publicPath}`,
      });
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    return workspaceErrorResponse(err);
  }
}
