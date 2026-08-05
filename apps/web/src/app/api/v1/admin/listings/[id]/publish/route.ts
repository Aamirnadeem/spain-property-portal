import { NextResponse } from 'next/server';
import { NotFoundError, publishListing } from '@spain/database';
import { getAppDb } from '@/lib/db';
import { isErrorResponse, resolveAdminContext } from '@/lib/partner-auth';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { db, client } = getAppDb();
  try {
    const ctx = await resolveAdminContext(request, db);
    if (isErrorResponse(ctx)) return ctx;
    const { id } = await context.params;
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
  } finally {
    await client.end({ timeout: 5 });
  }
}
