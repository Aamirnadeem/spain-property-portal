import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteSavedSearch, getSavedSearch, updateSavedSearch } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  criteria: z.unknown().optional(),
});

export async function GET(request: Request, ctx: Ctx) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      const item = await getSavedSearch(db, session.userId, id);
      return NextResponse.json({ item });
    });
  } catch (err) {
    return workspaceErrorResponse(err);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const body = patchSchema.parse(await request.json());
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      const item = await updateSavedSearch(db, session.userId, id, body);
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
      await deleteSavedSearch(db, session.userId, id);
      return NextResponse.json({ ok: true });
    });
  } catch (err) {
    return workspaceErrorResponse(err);
  }
}
