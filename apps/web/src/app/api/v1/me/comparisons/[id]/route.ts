import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  comparisonItems,
  comparisonSets,
  getComparison,
  updateComparisonSelection,
} from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      const [set] = await db
        .select()
        .from(comparisonSets)
        .where(eq(comparisonSets.id, id))
        .limit(1);
      if (!set || set.userId !== session.userId) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      const items = await db
        .select()
        .from(comparisonItems)
        .where(eq(comparisonItems.comparisonSetId, id));
      const comparison = await getComparison(db, session.userId, {
        listingIds: items.map((i) => i.listingId),
        includeNotes: true,
        weights: (set.weightSnapshot as Record<string, number> | null) ?? undefined,
      });
      return NextResponse.json({ comparisonSetId: id, comparison });
    });
  } catch (err) {
    return workspaceErrorResponse(err);
  }
}

const patchSchema = z.object({
  listingIds: z.array(z.string().uuid()).min(2).max(5),
});

export async function PATCH(request: Request, ctx: Ctx) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const body = patchSchema.parse(await request.json());
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      await updateComparisonSelection(db, session.userId, id, body.listingIds);
      const comparison = await getComparison(db, session.userId, {
        listingIds: body.listingIds,
        includeNotes: true,
      });
      return NextResponse.json({ comparisonSetId: id, comparison });
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    return workspaceErrorResponse(err);
  }
}
