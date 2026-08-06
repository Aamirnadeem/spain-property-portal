import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getActivePreferenceProfile, updateComparisonWeights } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return withAppAuthenticatedDb(session.userId, async (db) => {
    const profile = await getActivePreferenceProfile(db, session.userId);
    return NextResponse.json({ profile });
  });
}

const putSchema = z.object({
  weights: z.record(z.string(), z.number().int().min(0).max(10)),
});

export async function PUT(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = putSchema.parse(await request.json());
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      const profile = await updateComparisonWeights(db, session.userId, body.weights);
      return NextResponse.json({ profile });
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    return workspaceErrorResponse(err);
  }
}
