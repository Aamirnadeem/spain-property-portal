import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import * as schema from '@spain/database/schema';
import { listOrgImportRuns } from '@spain/database';
import { runSpainPartnerCsvImport } from '@spain/ingestion';
import { getAppDb } from '@/lib/db';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { getSession } from '@/lib/session';
import { isErrorResponse, resolvePartnerContext } from '@/lib/partner-auth';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return withAppAuthenticatedDb(session.userId, async (db) => {
    const ctx = await resolvePartnerContext(request, db);
    if (isErrorResponse(ctx)) return ctx;
    const runs = await listOrgImportRuns(db, ctx.organizationId);
    return NextResponse.json({ items: runs });
  });
}

/**
 * CSV ingestion uses the service-role connection after session + mutator checks
 * (workers/CLI exception — see SESSION_SECURITY_DESIGN / RLS_IMPLEMENTATION_STATUS).
 */
export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { db, client } = getAppDb();
  try {
    const ctx = await resolvePartnerContext(request, db, { mutate: true });
    if (isErrorResponse(ctx)) return ctx;

    const formData = await request.formData();
    const file = formData.get('file');
    const modeRaw = formData.get('mode');
    const mode = modeRaw === 'confirm' ? 'confirm' : 'dry_run';

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file_required' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'file_too_large' }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'file_empty' }, { status: 400 });
    }

    const [dataSource] = await db
      .select()
      .from(schema.dataSources)
      .where(eq(schema.dataSources.organizationId, ctx.organizationId))
      .limit(1);
    if (!dataSource) {
      return NextResponse.json({ error: 'no_data_source_for_org' }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const report = await runSpainPartnerCsvImport({
      db,
      dataSourceId: dataSource.id,
      actorUserId: ctx.userId,
      bytes,
      fileName: file.name,
      mode,
    });
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'import_failed';
    const code = (error as { code?: string }).code;
    return NextResponse.json({ error: message, code }, { status: 422 });
  } finally {
    await client.end({ timeout: 5 });
  }
}
