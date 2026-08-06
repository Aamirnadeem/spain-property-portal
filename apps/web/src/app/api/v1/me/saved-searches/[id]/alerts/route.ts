import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setSavedSearchAlerts } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  enabled: z.boolean(),
  alertTypes: z.array(z.string().max(64)).max(10).optional(),
});

export async function PATCH(request: Request, ctx: Ctx) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const raw = await request.text();
    const body = patchSchema.parse(raw ? JSON.parse(raw) : {});
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      const item = await setSavedSearchAlerts(db, session.userId, id, body);
      return NextResponse.json({ item });
    });
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    return workspaceErrorResponse(err);
  }
}
