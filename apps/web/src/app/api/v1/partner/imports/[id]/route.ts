import { NextResponse } from 'next/server';
import { getOrgImportRun, NotFoundError } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { getSession } from '@/lib/session';
import { isErrorResponse, resolvePartnerContext } from '@/lib/partner-auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return withAppAuthenticatedDb(session.userId, async (db) => {
    const ctx = await resolvePartnerContext(request, db);
    if (isErrorResponse(ctx)) return ctx;
    const { id } = await context.params;
    try {
      const { run, errors } = await getOrgImportRun(db, ctx.organizationId, id);
      return NextResponse.json({ run, errors });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      const message = error instanceof Error ? error.message : 'lookup_failed';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
