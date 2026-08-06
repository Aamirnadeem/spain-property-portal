import { NextResponse } from 'next/server';
import { listDataSourcesAdmin } from '@spain/database';
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
    const sources = await listDataSourcesAdmin(db);
    return NextResponse.json({ items: sources });
  });
}
