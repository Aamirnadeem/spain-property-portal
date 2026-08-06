import { NextResponse } from 'next/server';
import { NotFoundError, publishListing } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { getSession } from '@/lib/session';
import { isErrorResponse, resolveAdminContext } from '@/lib/partner-auth';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return withAppAuthenticatedDb(session.userId, async (db) => {
    const ctx = await resolveAdminContext(request, db);
    if (isErrorResponse(ctx)) return ctx;
    const { id } = await context.params;
    try {
      // Ignore any client-supplied actorUserId — session identity only.
      const listing = await publishListing(db, { listingId: id, actorUserId: ctx.userId });
      return NextResponse.json({ listing });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      if (error instanceof Error && error.message === 'source_not_approved') {
        return NextResponse.json({ error: 'source_not_approved' }, { status: 409 });
      }
      throw error;
    }
  });
}
