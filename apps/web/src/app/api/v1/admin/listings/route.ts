import { NextResponse } from 'next/server';
import { listPendingReviewListings } from '@spain/database';
import { getAppDb } from '@/lib/db';
import { isErrorResponse, resolveAdminContext } from '@/lib/partner-auth';

export async function GET(request: Request) {
  const { db, client } = getAppDb();
  try {
    const ctx = await resolveAdminContext(request, db);
    if (isErrorResponse(ctx)) return ctx;
    const listings = await listPendingReviewListings(db);
    return NextResponse.json({ items: listings });
  } finally {
    await client.end({ timeout: 5 });
  }
}
