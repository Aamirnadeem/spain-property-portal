import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateShortlistNote } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({ body: z.string().max(4000) });

export async function PUT(request: Request, ctx: Ctx) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const body = bodySchema.parse(await request.json());
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      const note = await updateShortlistNote(db, session.userId, id, body.body);
      return NextResponse.json({ note });
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    return workspaceErrorResponse(err);
  }
}
