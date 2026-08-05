import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '@spain/database/schema';
import { DEMO_SOURCE_KEY } from '@spain/database';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { runSpainPartnerCsvImport, type PartnerImportMode } from './partner/pipeline';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for db:import-partner-fixture');
  }

  const filePath =
    process.env.PARTNER_IMPORT_FILE ??
    join(__dirname, '../../../data/fixtures/partner/spain-partner-v1-valid.csv');
  const mode = (process.env.PARTNER_IMPORT_MODE ?? 'confirm') as PartnerImportMode;
  const sourceKey = process.env.PARTNER_IMPORT_SOURCE_KEY ?? DEMO_SOURCE_KEY;

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client, { schema });
  try {
    const [source] = await db
      .select()
      .from(schema.dataSources)
      .where(eq(schema.dataSources.sourceKey, sourceKey))
      .limit(1);
    if (!source) {
      throw new Error(`Data source not seeded: ${sourceKey} (run pnpm db:seed first)`);
    }

    const bytes = await readFile(filePath);
    const report = await runSpainPartnerCsvImport({
      db,
      dataSourceId: source.id,
      actorUserId: null,
      bytes,
      mode,
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.rejected > 0 && mode === 'confirm') {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
