import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { rlsPolicyStatements } from './rls/policies';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('DATABASE_URL missing — migrate skipped (see docs/PHASE1_ASSUMPTIONS.md).');
    process.exit(0);
  }

  const client = postgres(url, { max: 1 });
  const extSql = readFileSync(join(__dirname, '../drizzle/0000_extensions.sql'), 'utf8');
  await client.unsafe(extSql);

  const push = spawnSync('pnpm', ['exec', 'drizzle-kit', 'push', '--force'], {
    cwd: join(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
    shell: true,
  });
  if (push.status !== 0) {
    throw new Error('drizzle-kit push failed');
  }

  for (const stmt of rlsPolicyStatements) {
    try {
      await client.unsafe(stmt);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!/already exists/i.test(message)) {
        console.warn('RLS statement warning:', message);
      }
    }
  }

  await client.end();
  console.log('Migrate finished');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
