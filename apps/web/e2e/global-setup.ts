import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

/**
 * Gives every Playwright run a freshly migrated, seeded and legacy-imported database so the
 * agency CSV journey exercises a genuine first-time import instead of inheriting listings that
 * an earlier run already published. Set E2E_SKIP_DB_RESET=true to reuse the existing state.
 */
export default function globalSetup(): void {
  if (process.env.E2E_SKIP_DB_RESET === 'true') {
    console.log('[e2e] E2E_SKIP_DB_RESET=true — reusing existing database state');
    return;
  }

  const result = spawnSync('pnpm', ['db:reset:e2e'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(
      `e2e database reset failed: ${result.error?.message ?? `exit ${result.status}`}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    );
  }
  console.log(result.stdout?.trim() ?? '');
}
