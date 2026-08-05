import { NextResponse } from 'next/server';
import { searchProperties } from '@spain/database';
import { parseSearchParams } from '@spain/search';
import { getAppDb } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const criteria = parseSearchParams(url.searchParams);
    const { db, client } = getAppDb();
    try {
      const result = await searchProperties(db, criteria);
      return NextResponse.json(result);
    } finally {
      await client.end({ timeout: 5 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'search_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
