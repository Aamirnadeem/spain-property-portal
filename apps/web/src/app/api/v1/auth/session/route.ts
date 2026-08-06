import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

/** Non-authoritative display of current session user (cookies only). */
export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ userId: null }, { status: 200 });
  }
  return NextResponse.json({ userId: session.userId, provider: session.provider });
}
