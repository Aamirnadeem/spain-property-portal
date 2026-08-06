import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordPropertyView } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { ensureUserRow } from '@/lib/ensure-user';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

const postSchema = z.object({
  listingId: z.string().uuid(),
  physicalPropertyId: z.string().uuid().optional(),
  channel: z.string().max(32).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const raw = await request.text();
    const body = postSchema.parse(raw ? JSON.parse(raw) : {});
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      await ensureUserRow(db, session.userId);
      const item = await recordPropertyView(db, session.userId, body);
      return NextResponse.json({ item, recorded: item !== null }, { status: 201 });
    });
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    return workspaceErrorResponse(err);
  }
}
