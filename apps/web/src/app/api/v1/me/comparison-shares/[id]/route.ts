import { NextResponse } from 'next/server';
import { getComparisonShareForOwner } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const { id } = await ctx.params;
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      const item = await getComparisonShareForOwner(db, session.userId, id);
      return NextResponse.json({ item });
    });
  } catch (err) {
    return workspaceErrorResponse(err);
  }
}
