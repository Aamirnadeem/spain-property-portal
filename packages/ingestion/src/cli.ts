import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importLegacyBarcelona60 } from './legacy/importer';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for db:import-legacy');
  }

  const filePath =
    process.env.LEGACY_IMPORT_FILE ??
    join(__dirname, '../../../data/legacy/barcelona_property_explorer_legacy_60.json');

  const report = await importLegacyBarcelona60({ databaseUrl, filePath });
  console.log(JSON.stringify(report, null, 2));

  if (report.rejected > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
