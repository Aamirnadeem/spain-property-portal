import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addPropertyToShortlist, removePropertyFromShortlist } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

type Ctx = { params: Promise<{ id: string }> };

const postSchema = z.object({ listingId: z.string().uuid() });

export async function POST(request: Request, ctx: Ctx) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const body = postSchema.parse(await request.json());
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      await addPropertyToShortlist(db, session.userId, id, body.listingId);
      return NextResponse.json({ ok: true }, { status: 201 });
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
  const listingId = new URL(request.url).searchParams.get('listingId');
  if (!listingId) return NextResponse.json({ error: 'listingId_required' }, { status: 400 });
  try {
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      await removePropertyFromShortlist(db, session.userId, id, listingId);
      return NextResponse.json({ ok: true });
    });
  } catch (err) {
    return workspaceErrorResponse(err);
  }
}
