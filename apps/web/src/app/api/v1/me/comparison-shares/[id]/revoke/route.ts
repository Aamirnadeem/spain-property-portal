import { NextResponse } from 'next/server';
import { revokeComparisonShare } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!checkRateLimit(`share-revoke:${session.userId}`, 30, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  try {
    const { id } = await ctx.params;
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      const item = await revokeComparisonShare(db, session.userId, id);
      return NextResponse.json({ item });
    });
  } catch (err) {
    return workspaceErrorResponse(err);
  }
}
