import { NextResponse } from 'next/server';
import { markAllNotificationsRead } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      const count = await markAllNotificationsRead(db, session.userId);
      return NextResponse.json({ ok: true, count });
    });
  } catch (err) {
    return workspaceErrorResponse(err);
  }
}
