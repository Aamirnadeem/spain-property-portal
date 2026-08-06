import { NextResponse } from 'next/server';
import { dismissNotification } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      const item = await dismissNotification(db, session.userId, id);
      return NextResponse.json({ item });
    });
  } catch (err) {
    return workspaceErrorResponse(err);
  }
}
