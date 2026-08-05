import { NextResponse } from 'next/server';
import { listOrgListings } from '@spain/database';
import { getAppDb } from '@/lib/db';
import { isErrorResponse, resolvePartnerContext } from '@/lib/partner-auth';

export async function GET(request: Request) {
  const { db, client } = getAppDb();
  try {
    const ctx = await resolvePartnerContext(request, db);
    if (isErrorResponse(ctx)) return ctx;
    const listings = await listOrgListings(db, ctx.organizationId);
    return NextResponse.json({ items: listings });
  } finally {
    await client.end({ timeout: 5 });
  }
}
