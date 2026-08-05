import { NextResponse } from 'next/server';
import { listAllAuditEvents } from '@spain/database';
import { getAppDb } from '@/lib/db';
import { isErrorResponse, resolveAdminContext } from '@/lib/partner-auth';

export async function GET(request: Request) {
  const { db, client } = getAppDb();
  try {
    const ctx = await resolveAdminContext(request, db);
    if (isErrorResponse(ctx)) return ctx;
    const events = await listAllAuditEvents(db);
    return NextResponse.json({ items: events });
  } finally {
    await client.end({ timeout: 5 });
  }
}
