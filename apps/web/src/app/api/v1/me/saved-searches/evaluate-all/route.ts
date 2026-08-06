import { NextResponse } from 'next/server';
import { evaluateAllDueSavedSearches } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { workspaceErrorResponse } from '@/lib/workspace-errors';

/**
 * Test-harness only: evaluates every alert-enabled saved search for the signed-in user's
 * scope. Production automation is intentionally out of scope for 4B (D14) — this exists so
 * Playwright/integration tests can trigger the scheduler seam deterministically.
 */
export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return await withAppAuthenticatedDb(session.userId, async (db) => {
      const result = await evaluateAllDueSavedSearches(db);
      return NextResponse.json({ result });
    });
  } catch (err) {
    return workspaceErrorResponse(err);
  }
}
