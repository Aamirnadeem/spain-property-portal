import { NextResponse } from 'next/server';
import { appendClearSessionCookies } from '@/lib/session';
import { assertSameOrigin } from '@/lib/csrf';

/** Idempotent logout — clears FakeAuth / Supabase / legacy identity cookies. */
export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });

  const headers = new Headers();
  appendClearSessionCookies(headers);
  return new NextResponse(null, { status: 204, headers });
}
