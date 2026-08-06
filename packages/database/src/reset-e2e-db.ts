import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

/**
 * Recreates the dedicated local Playwright database from migrations + seed + legacy import.
 *
 * The partner CSV fixture is deliberately NOT imported: the agency journey e2e asserts a
 * first-time CSV insert lands in `pending_review`, and per ADR-026 a reimport of an already
 * published listing applies the CSV status directly. The suite therefore needs a database
 * without `partner-csv-demo-catalonia` listings to stay meaningful and repeatable.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

const DEFAULT_E2E_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/spain_properties_e2e';

function resolveE2eDatabaseUrl(): URL {
  const url = new URL(process.env.E2E_DATABASE_URL ?? DEFAULT_E2E_DATABASE_URL);
  const database = url.pathname.slice(1);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !database.endsWith('_e2e')) {
    throw new Error('E2E_DATABASE_URL must target a localhost database ending in _e2e');
  }
  return url;
}

async function recreateDatabase(url: URL): Promise<void> {
  const database = url.pathname.slice(1);
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    await admin.unsafe(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [database],
    );
    await admin.unsafe(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.unsafe(`CREATE DATABASE "${database}"`);
  } finally {
    await admin.end();
  }
}

function runScript(
  script: 'db:migrate' | 'db:seed' | 'db:import-legacy',
  databaseUrl: string,
): void {
  const result = spawnSync('pnpm', [script], {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(
      `${script} failed: ${result.error?.message ?? `exit ${result.status}`}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    );
  }
}

async function main(): Promise<void> {
  const url = resolveE2eDatabaseUrl();
  const databaseUrl = url.toString();
  console.log(`[reset-e2e-db] recreating ${url.pathname.slice(1)}`);
  await recreateDatabase(url);
  runScript('db:migrate', databaseUrl);
  runScript('db:seed', databaseUrl);
  runScript('db:import-legacy', databaseUrl);
  console.log('[reset-e2e-db] ready (migrated + seeded + legacy snapshot, no partner fixture)');
}

main().catch((error) => {
  console.error('[reset-e2e-db] failed');
  console.error(error);
  process.exit(1);
});
