import { NextResponse } from 'next/server';
import { listAllAuditEvents } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { getSession } from '@/lib/session';
import { isErrorResponse, resolveAdminContext } from '@/lib/partner-auth';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return withAppAuthenticatedDb(session.userId, async (db) => {
    const ctx = await resolveAdminContext(request, db);
    if (isErrorResponse(ctx)) return ctx;
    const events = await listAllAuditEvents(db);
    return NextResponse.json({ items: events });
  });
}
