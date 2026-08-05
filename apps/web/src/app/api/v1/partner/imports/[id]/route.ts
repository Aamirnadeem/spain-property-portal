import { NextResponse } from 'next/server';
import { getOrgImportRun, NotFoundError } from '@spain/database';
import { getAppDb } from '@/lib/db';
import { isErrorResponse, resolvePartnerContext } from '@/lib/partner-auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { db, client } = getAppDb();
  try {
    const ctx = await resolvePartnerContext(request, db);
    if (isErrorResponse(ctx)) return ctx;
    const { id } = await context.params;
    const { run, errors } = await getOrgImportRun(db, ctx.organizationId, id);
    return NextResponse.json({ run, errors });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : 'lookup_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await client.end({ timeout: 5 });
  }
}
