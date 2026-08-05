import { NextResponse } from 'next/server';
import { getPropertyDetails } from '@spain/database';
import { getAppDb } from '@/lib/db';

export async function GET(_request: Request, context: { params: Promise<{ listingId: string }> }) {
  try {
    const { listingId } = await context.params;
    const { db, client } = getAppDb();
    try {
      const detail = await getPropertyDetails(db, listingId);
      if (!detail) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      return NextResponse.json(detail);
    } finally {
      await client.end({ timeout: 5 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'detail_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
