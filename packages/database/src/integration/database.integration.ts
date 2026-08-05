import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../../..');
const testUrl =
  process.env.DATABASE_TEST_URL ??
  'postgresql://postgres:postgres@localhost:5432/spain_properties_test';

function assertSafeTestDatabase(url: URL): void {
  const database = url.pathname.slice(1);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !database.endsWith('_test')) {
    throw new Error('DATABASE_TEST_URL must target a localhost database ending in _test');
  }
}

function runScript(script: 'db:migrate' | 'db:seed' | 'db:import-legacy'): void {
  const result = spawnSync('pnpm', [script], {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: testUrl },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(
      `${script} failed: ${result.error?.message ?? `exit ${result.status}`}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    );
  }
}

async function recreateDatabase(url: URL): Promise<void> {
  const database = url.pathname.slice(1);
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    await admin.unsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [database],
    );
    await admin.unsafe(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.unsafe(`CREATE DATABASE "${database}"`);
  } finally {
    await admin.end();
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function withRole<T>(
  sql: postgres.Sql,
  role: 'authenticated' | 'anon',
  settings: Record<string, string>,
  query: () => Promise<T>,
): Promise<T> {
  await sql.unsafe('BEGIN');
  try {
    await sql.unsafe(`SET LOCAL ROLE ${role}`);
    for (const [key, value] of Object.entries(settings)) {
      await sql`SELECT set_config(${key}, ${value}, true)`;
    }
    const result = await query();
    await sql.unsafe('ROLLBACK');
    return result;
  } catch (error) {
    await sql.unsafe('ROLLBACK');
    throw error;
  }
}

async function main(): Promise<void> {
  const parsed = new URL(testUrl);
  assertSafeTestDatabase(parsed);
  await recreateDatabase(parsed);
  runScript('db:migrate');
  runScript('db:seed');
  runScript('db:import-legacy');
  // Idempotency: second import must not duplicate listings
  runScript('db:import-legacy');

  const sql = postgres(testUrl, { max: 1 });
  const userA = '11111111-1111-4111-8111-111111111111';
  const userB = '22222222-2222-4222-8222-222222222222';
  try {
    const seed = await sql`
      SELECT m.name_en AS municipality, p.name_en AS province, a.name_en AS community
      FROM municipalities m
      JOIN provinces p ON p.id = m.province_id
      JOIN autonomous_communities a ON a.id = p.autonomous_community_id
      WHERE m.name_en = 'Alcaraz'
    `;
    assert(seed.length === 1, 'seed must create Alcaraz');
    assert(
      seed[0]?.province === 'Albacete' && seed[0]?.community === 'Castilla-La Mancha',
      'Alcaraz seed hierarchy is incorrect',
    );

    await sql.unsafe(`
      DO $$ BEGIN
        CREATE ROLE authenticated NOLOGIN;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
      DO $$ BEGIN
        CREATE ROLE anon NOLOGIN;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
      GRANT USAGE ON SCHEMA public TO authenticated, anon;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, anon;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
    `);

    await sql`
      INSERT INTO users (id, display_name)
      VALUES (${userA}, 'Buyer A'), (${userB}, 'Buyer B')
    `;
    await sql`
      INSERT INTO user_consents (user_id, purpose, granted)
      VALUES (${userA}, 'analytics', true), (${userB}, 'analytics', false)
    `;
    await sql`
      INSERT INTO auth_identities (user_id, type, value)
      VALUES
        (${userA}, 'email', 'buyer-a@example.com'),
        (${userB}, 'email', 'buyer-b@example.com')
    `;
    await sql`
      INSERT INTO guest_sessions (anonymous_key_hash, expires_at)
      VALUES
        (${'a'.repeat(64)}, now() + interval '1 day'),
        (${'b'.repeat(64)}, now() + interval '1 day')
    `;

    const visibleUsers = await withRole(
      sql,
      'authenticated',
      { 'request.jwt.claim.sub': userA },
      () => sql`SELECT id FROM users ORDER BY id`,
    );
    assert(
      visibleUsers.length === 1 && visibleUsers[0]?.id === userA,
      'identity RLS leaked another user',
    );

    const visibleConsents = await withRole(
      sql,
      'authenticated',
      { 'request.jwt.claim.sub': userA },
      () => sql`SELECT user_id FROM user_consents`,
    );
    assert(
      visibleConsents.length === 1 && visibleConsents[0]?.user_id === userA,
      'consent RLS leaked another user',
    );

    const visibleIdentities = await withRole(
      sql,
      'authenticated',
      { 'request.jwt.claim.sub': userA },
      () => sql`SELECT user_id FROM auth_identities`,
    );
    assert(
      visibleIdentities.length === 1 && visibleIdentities[0]?.user_id === userA,
      'auth identity RLS leaked another user',
    );

    const visibleGuests = await withRole(
      sql,
      'anon',
      { 'app.guest_key_hash': 'a'.repeat(64) },
      () => sql`SELECT anonymous_key_hash FROM guest_sessions`,
    );
    assert(
      visibleGuests.length === 1 && visibleGuests[0]?.anonymous_key_hash === 'a'.repeat(64),
      'guest RLS leaked another session',
    );

    let uniqueRejected = false;
    try {
      await sql`
        INSERT INTO auth_identities (user_id, type, value)
        VALUES (${userB}, 'email', 'buyer-a@example.com')
      `;
    } catch (error) {
      uniqueRejected =
        typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
    }
    assert(uniqueRejected, 'auth identity unique constraint was not enforced');

    let foreignKeyRejected = false;
    try {
      await sql`
        INSERT INTO user_consents (user_id, purpose, granted)
        VALUES (${'99999999-9999-4999-8999-999999999999'}, 'analytics', true)
      `;
    } catch (error) {
      foreignKeyRejected =
        typeof error === 'object' && error !== null && 'code' in error && error.code === '23503';
    }
    assert(foreignKeyRejected, 'user consent foreign key was not enforced');

    const listings = await sql`
      SELECT COUNT(*)::int AS count FROM property_listings WHERE is_legacy_snapshot = true
    `;
    assert(listings[0]?.count === 60, 'legacy import must yield 60 snapshot listings');

    const publicListings = await withRole(
      sql,
      'anon',
      {},
      () => sql`SELECT COUNT(*)::int AS count FROM property_listings`,
    );
    assert(publicListings[0]?.count === 60, 'anon should read browseable legacy listings');

    const listingId = (
      await sql`SELECT id FROM property_listings ORDER BY external_listing_id LIMIT 1`
    )[0]?.id as string;
    await sql`
      INSERT INTO favourites (user_id, listing_id)
      VALUES (${userA}, ${listingId}), (${userB}, ${listingId})
    `;
    const favs = await withRole(
      sql,
      'authenticated',
      { 'request.jwt.claim.sub': userA },
      () => sql`SELECT user_id FROM favourites`,
    );
    assert(favs.length === 1 && favs[0]?.user_id === userA, 'favourite RLS leaked another user');

    console.log(
      'Database integration passed: migration, seed, legacy import, RLS, uniqueness, foreign keys',
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
