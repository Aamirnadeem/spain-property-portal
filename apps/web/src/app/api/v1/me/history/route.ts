import { NextResponse } from 'next/server';
import { clearBrowsingHistory, listRecentlyViewed } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { ensureUserRow } from '@/lib/ensure-user';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return withAppAuthenticatedDb(session.userId, async (db) => {
    await ensureUserRow(db, session.userId);
    const items = await listRecentlyViewed(db, session.userId);
    return NextResponse.json({ items });
  });
}

export async function DELETE(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      await clearBrowsingHistory(db, session.userId);
      return NextResponse.json({ ok: true });
    });
  } catch (err) {
    return workspaceErrorResponse(err);
  }
}
