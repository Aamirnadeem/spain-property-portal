import { NextResponse } from 'next/server';
import { adminWithdrawListing, NotFoundError } from '@spain/database';
import { getAppDb } from '@/lib/db';
import { isErrorResponse, resolveAdminContext } from '@/lib/partner-auth';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { db, client } = getAppDb();
  try {
    const ctx = await resolveAdminContext(request, db);
    if (isErrorResponse(ctx)) return ctx;
    const { id } = await context.params;
    const listing = await adminWithdrawListing(db, { listingId: id, actorUserId: ctx.userId });
    return NextResponse.json({ listing });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    throw error;
  } finally {
    await client.end({ timeout: 5 });
  }
}
