import { NextResponse } from 'next/server';
import { removeHistoryItem } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

type Ctx = { params: Promise<{ listingId: string }> };

export async function DELETE(request: Request, ctx: Ctx) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { listingId } = await ctx.params;
  try {
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      await removeHistoryItem(db, session.userId, listingId);
      return NextResponse.json({ ok: true });
    });
  } catch (err) {
    return workspaceErrorResponse(err);
  }
}
