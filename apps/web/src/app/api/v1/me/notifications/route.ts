import { NextResponse } from 'next/server';
import { listNotifications, unreadCount } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { ensureUserRow } from '@/lib/ensure-user';
import { getSession } from '@/lib/session';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return withAppAuthenticatedDb(session.userId, async (db) => {
    await ensureUserRow(db, session.userId);
    const [items, unread] = await Promise.all([
      listNotifications(db, session.userId),
      unreadCount(db, session.userId),
    ]);
    return NextResponse.json({ items, unread });
  });
}
