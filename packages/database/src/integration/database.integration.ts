import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema/index';
import {
  DEMO_ORG_ID,
  DEMO_SOURCE_KEY,
  LISTING_REVIEWER_USER_ID,
  ORG_AGENT_USER_ID,
  ORG_OWNER_USER_ID,
  PLATFORM_ADMIN_USER_ID,
} from '../seed-constants';
import {
  adminWithdrawListing,
  listPendingReviewListings,
  publishListing,
  updateSourcePermission,
} from '../services/admin';
import { listAuditEventsForOrganization } from '../services/audit';
import { ForbiddenError, requireOrgMember, requirePlatformRole } from '../services/organizations';
import { updateOrgListingPrice, withdrawOrgListing } from '../services/partner';

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

function runScript(
  script: 'db:migrate' | 'db:seed' | 'db:import-legacy' | 'db:import-partner-fixture',
): void {
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
  runScript('db:import-partner-fixture');
  // Idempotency: reimporting the same Spain Partner CSV v1 fixture must not duplicate listings
  runScript('db:import-partner-fixture');

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

    // ---- Phase 3: partner CSV -> admin review -> publish -> update -> withdraw ----
    const db = drizzle(sql, { schema });

    const [demoSource] = await db
      .select()
      .from(schema.dataSources)
      .where(eq(schema.dataSources.sourceKey, DEMO_SOURCE_KEY))
      .limit(1);
    assert(demoSource !== undefined, 'demo partner data source must be seeded');
    const demoSourceId = demoSource!.id;

    const demoListings = await sql`
      SELECT id, operational_status, is_public_browseable FROM property_listings
      WHERE data_source_id = ${demoSourceId}
      ORDER BY external_listing_id
    `;
    assert(
      demoListings.length === 6,
      'partner fixture import must yield 6 listings (no duplicates on reimport)',
    );
    assert(
      demoListings.every(
        (r) => r.operational_status === 'pending_review' && r.is_public_browseable === false,
      ),
      'newly imported partner listings must start pending_review and non-browseable',
    );

    const pendingReview = await listPendingReviewListings(db);
    assert(
      pendingReview.filter((l) => l.dataSourceId === demoSourceId).length === 6,
      'admin pending-review queue must include all newly imported partner listings',
    );

    // Authz: seeded org owner is a member of the demo org; platform admin is intentionally not.
    const ownerMembership = await requireOrgMember(db, ORG_OWNER_USER_ID, DEMO_ORG_ID);
    assert(ownerMembership.role === 'org_owner', 'seeded org owner role mismatch');
    let adminNotOrgMember = false;
    try {
      await requireOrgMember(db, PLATFORM_ADMIN_USER_ID, DEMO_ORG_ID);
    } catch (error) {
      adminNotOrgMember = error instanceof ForbiddenError;
    }
    assert(adminNotOrgMember, 'platform admin must not be an implicit org member');

    let ownerLacksPlatformRole = false;
    try {
      await requirePlatformRole(db, ORG_OWNER_USER_ID);
    } catch (error) {
      ownerLacksPlatformRole = error instanceof ForbiddenError;
    }
    assert(ownerLacksPlatformRole, 'org owner must not hold a platform role');
    await requirePlatformRole(db, PLATFORM_ADMIN_USER_ID);
    await requirePlatformRole(db, LISTING_REVIEWER_USER_ID);

    // RLS: an unrelated buyer must not see the demo org's pending listings or import history.
    const foreignPendingListings = await withRole(
      sql,
      'authenticated',
      { 'request.jwt.claim.sub': userB },
      () => sql`SELECT id FROM property_listings WHERE data_source_id = ${demoSourceId}`,
    );
    assert(
      foreignPendingListings.length === 0,
      'unrelated user must not see org-scoped pending listings via RLS',
    );

    const ownerPendingListings = await withRole(
      sql,
      'authenticated',
      { 'request.jwt.claim.sub': ORG_OWNER_USER_ID },
      () => sql`SELECT id FROM property_listings WHERE data_source_id = ${demoSourceId}`,
    );
    assert(
      ownerPendingListings.length === 6,
      'org owner must see their own org pending listings via RLS',
    );

    const foreignImportRuns = await withRole(
      sql,
      'authenticated',
      { 'request.jwt.claim.sub': userB },
      () => sql`SELECT id FROM import_runs WHERE data_source_id = ${demoSourceId}`,
    );
    assert(
      foreignImportRuns.length === 0,
      'unrelated user must not see org-scoped import runs via RLS',
    );

    const publicSeesPending = await withRole(
      sql,
      'anon',
      {},
      () => sql`SELECT id FROM property_listings WHERE data_source_id = ${demoSourceId}`,
    );
    assert(publicSeesPending.length === 0, 'anon must not see pending_review partner listings');

    // Admin publish moves a listing into public browse.
    const targetListingId = demoListings[0]!.id as string;
    const published = await publishListing(db, {
      listingId: targetListingId,
      actorUserId: PLATFORM_ADMIN_USER_ID,
    });
    assert(
      published.operationalStatus === 'available' && published.isPublicBrowseable === true,
      'publish must set available + browseable',
    );

    const publicSeesPublished = await withRole(
      sql,
      'anon',
      {},
      () => sql`SELECT id FROM property_listings WHERE id = ${targetListingId}`,
    );
    assert(publicSeesPublished.length === 1, 'anon must see a published+browseable listing');

    // Agency self-service price update on an already-published listing.
    const priceUpdated = await updateOrgListingPrice(db, {
      organizationId: DEMO_ORG_ID,
      listingId: targetListingId,
      actorUserId: ORG_AGENT_USER_ID,
      priceAmount: 399000,
    });
    assert(Number(priceUpdated.priceAmount) === 399000, 'agency price update must persist');

    const priceHistoryRows = await sql`
      SELECT COUNT(*)::int AS count FROM listing_price_history WHERE listing_id = ${targetListingId}
    `;
    assert(
      (priceHistoryRows[0]?.count ?? 0) >= 2,
      'price history must record both the import and the agency update',
    );

    // Agency withdraws their own listing.
    const withdrawn = await withdrawOrgListing(db, {
      organizationId: DEMO_ORG_ID,
      listingId: targetListingId,
      actorUserId: ORG_OWNER_USER_ID,
    });
    assert(
      withdrawn.operationalStatus === 'withdrawn' && withdrawn.isPublicBrowseable === false,
      'agency withdrawal must hide the listing',
    );

    const publicSeesWithdrawn = await withRole(
      sql,
      'anon',
      {},
      () => sql`SELECT id FROM property_listings WHERE id = ${targetListingId}`,
    );
    assert(publicSeesWithdrawn.length === 0, 'anon must not see a withdrawn listing');

    // Admin can also withdraw directly (not just the owning agency).
    const secondListingId = demoListings[1]!.id as string;
    await publishListing(db, { listingId: secondListingId, actorUserId: PLATFORM_ADMIN_USER_ID });
    const adminWithdrawn = await adminWithdrawListing(db, {
      listingId: secondListingId,
      actorUserId: LISTING_REVIEWER_USER_ID,
    });
    assert(adminWithdrawn.operationalStatus === 'withdrawn', 'admin withdrawal must set withdrawn');

    // Source permission gate: suspending a source is recorded as an auditable event.
    await updateSourcePermission(db, {
      dataSourceId: demoSourceId,
      actorUserId: PLATFORM_ADMIN_USER_ID,
      toStatus: 'suspended',
      note: 'integration test suspension',
    });
    const suspendedSource = await sql`
      SELECT permission_status FROM data_sources WHERE id = ${demoSourceId}
    `;
    assert(
      suspendedSource[0]?.permission_status === 'suspended',
      'source permission update must persist',
    );
    const permissionEvents = await sql`
      SELECT COUNT(*)::int AS count FROM source_permission_events
      WHERE data_source_id = ${demoSourceId} AND to_status = 'suspended'
    `;
    assert(
      (permissionEvents[0]?.count ?? 0) === 1,
      'permission change must be recorded as a source_permission_events row',
    );

    const auditEvents = await listAuditEventsForOrganization(db, DEMO_ORG_ID);
    const auditActions = new Set(auditEvents.map((e) => e.action));
    assert(auditActions.has('listing.publish'), 'publish must be audited');
    assert(auditActions.has('listing.price_update'), 'price update must be audited');
    assert(auditActions.has('listing.withdraw'), 'withdraw must be audited');
    assert(auditActions.has('source.permission_change'), 'permission change must be audited');

    console.log(
      'Phase 3 integration passed: partner CSV import idempotency, org RLS isolation, ' +
        'admin publish/withdraw, agency price update + self-withdraw, source permission gate, audit trail',
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
