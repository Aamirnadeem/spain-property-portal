import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deletePropertyNote, getPropertyNote, updatePropertyNote } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

type Ctx = { params: Promise<{ listingId: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { listingId } = await ctx.params;
  return withAppAuthenticatedDb(session.userId, async (db) => {
    const note = await getPropertyNote(db, session.userId, listingId);
    return NextResponse.json({ note });
  });
}

const putSchema = z.object({
  body: z.string().max(4000),
  positives: z.array(z.string().max(200)).max(10).optional(),
  negatives: z.array(z.string().max(200)).max(10).optional(),
});

export async function PUT(request: Request, ctx: Ctx) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { listingId } = await ctx.params;
  try {
    const body = putSchema.parse(await request.json());
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      const note = await updatePropertyNote(db, session.userId, listingId, body);
      return NextResponse.json({ note });
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
  const { listingId } = await ctx.params;
  return withAppAuthenticatedDb(session.userId, async (db) => {
    await deletePropertyNote(db, session.userId, listingId);
    return NextResponse.json({ ok: true });
  });
}
