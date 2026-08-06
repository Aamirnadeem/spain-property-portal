import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createComparison, getComparison } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

const postSchema = z.object({
  listingIds: z.array(z.string().uuid()).min(2).max(5),
  shortlistId: z.string().uuid().nullable().optional(),
  weights: z.record(z.string(), z.number().int().min(0).max(10)).optional(),
  includeNotes: z.boolean().optional(),
});

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = postSchema.parse(await request.json());
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      const set = await createComparison(db, session.userId, {
        listingIds: body.listingIds,
        shortlistId: body.shortlistId,
        weights: body.weights,
      });
      const comparison = await getComparison(db, session.userId, {
        listingIds: body.listingIds,
        includeNotes: body.includeNotes ?? true,
        weights: body.weights,
        comparisonSetId: set.id,
      });
      return NextResponse.json({ comparisonSetId: set.id, comparison }, { status: 201 });
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    return workspaceErrorResponse(err);
  }
}
