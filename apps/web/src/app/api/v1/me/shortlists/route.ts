import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createShortlist, listShortlists } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { ensureUserRow } from '@/lib/ensure-user';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return withAppAuthenticatedDb(session.userId, async (db) => {
    await ensureUserRow(db, session.userId);
    const items = await listShortlists(db, session.userId);
    return NextResponse.json({ items });
  });
}

const postSchema = z.object({
  name: z.string().min(1).max(80),
  isDefault: z.boolean().optional(),
});

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = postSchema.parse(await request.json());
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      await ensureUserRow(db, session.userId);
      const item = await createShortlist(db, session.userId, body);
      return NextResponse.json({ item }, { status: 201 });
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    return workspaceErrorResponse(err);
  }
}
