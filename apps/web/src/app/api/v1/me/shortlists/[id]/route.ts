import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteShortlist, setDefaultShortlist, updateShortlist } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(request: Request, ctx: Ctx) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const body = patchSchema.parse(await request.json());
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      let item;
      if (body.isDefault) {
        item = await setDefaultShortlist(db, session.userId, id);
      }
      if (body.name != null) {
        item = await updateShortlist(db, session.userId, id, { name: body.name });
      }
      if (!item) {
        item = await setDefaultShortlist(db, session.userId, id);
      }
      return NextResponse.json({ item });
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    return workspaceErrorResponse(err);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      await deleteShortlist(db, session.userId, id);
      return NextResponse.json({ ok: true });
    });
  } catch (err) {
    return workspaceErrorResponse(err);
  }
}
