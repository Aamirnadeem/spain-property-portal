import { NextResponse } from 'next/server';
import { getListingById, NotFoundError } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { getSession } from '@/lib/session';
import { isErrorResponse, resolveAdminContext } from '@/lib/partner-auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return withAppAuthenticatedDb(session.userId, async (db) => {
    const ctx = await resolveAdminContext(request, db);
    if (isErrorResponse(ctx)) return ctx;
    const { id } = await context.params;
    try {
      const listing = await getListingById(db, id);
      return NextResponse.json({ listing });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      throw error;
    }
  });
}
