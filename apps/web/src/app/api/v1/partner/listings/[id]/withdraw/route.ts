import { NextResponse } from 'next/server';
import { NotFoundError, withdrawOrgListing } from '@spain/database';
import { getAppDb } from '@/lib/db';
import { isErrorResponse, resolvePartnerContext } from '@/lib/partner-auth';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { db, client } = getAppDb();
  try {
    const ctx = await resolvePartnerContext(request, db);
    if (isErrorResponse(ctx)) return ctx;
    const { id } = await context.params;
    const listing = await withdrawOrgListing(db, {
      organizationId: ctx.organizationId,
      listingId: id,
      actorUserId: ctx.userId,
    });
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
