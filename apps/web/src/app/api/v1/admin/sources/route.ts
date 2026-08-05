import { NextResponse } from 'next/server';
import { listDataSourcesAdmin } from '@spain/database';
import { getAppDb } from '@/lib/db';
import { isErrorResponse, resolveAdminContext } from '@/lib/partner-auth';

export async function GET(request: Request) {
  const { db, client } = getAppDb();
  try {
    const ctx = await resolveAdminContext(request, db);
    if (isErrorResponse(ctx)) return ctx;
    const sources = await listDataSourcesAdmin(db);
    return NextResponse.json({ items: sources });
  } finally {
    await client.end({ timeout: 5 });
  }
}
