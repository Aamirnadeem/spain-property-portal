import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '@spain/database/schema';
import { and, eq } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSpainPartnerCsvImport } from './pipeline';
import { SourceNotRunnableError } from './permission-gate';

const __dirname = dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL;

function assertSafeTestDatabase(url: string): void {
  const parsed = new URL(url);
  const database = parsed.pathname.slice(1);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !database.endsWith('_test')) {
    throw new Error(
      'DATABASE_URL must target a localhost database ending in _test to run ingestion integration tests',
    );
  }
}

const TEST_SOURCE_KEY = 'partner-csv-pipeline-test-fixture';
const PENDING_SOURCE_KEY = 'partner-csv-pipeline-test-pending';

describe.skipIf(!databaseUrl)('runSpainPartnerCsvImport (integration)', () => {
  let db: PostgresJsDatabase<typeof schema>;
  let client: postgres.Sql;
  let approvedSourceId: string;
  let pendingSourceId: string;
  let validCsvBytes: Buffer;
  let errorCsvBytes: Buffer;
  const importRunIds: string[] = [];

  beforeAll(async () => {
    assertSafeTestDatabase(databaseUrl!);
    client = postgres(databaseUrl!, { max: 1 });
    db = drizzle(client, { schema });

    const [approved] = await db
      .insert(schema.dataSources)
      .values({
        sourceKey: TEST_SOURCE_KEY,
        name: 'Pipeline test fixture (approved)',
        sourceType: 'csv',
        permissionStatus: 'approved',
        imageRights: 'none',
        organizationId: null,
      })
      .onConflictDoNothing()
      .returning();
    approvedSourceId =
      approved?.id ??
      (
        await db
          .select()
          .from(schema.dataSources)
          .where(eq(schema.dataSources.sourceKey, TEST_SOURCE_KEY))
          .limit(1)
      )[0]!.id;

    const [pending] = await db
      .insert(schema.dataSources)
      .values({
        sourceKey: PENDING_SOURCE_KEY,
        name: 'Pipeline test fixture (pending)',
        sourceType: 'csv',
        permissionStatus: 'pending',
        imageRights: 'none',
        organizationId: null,
      })
      .onConflictDoNothing()
      .returning();
    pendingSourceId =
      pending?.id ??
      (
        await db
          .select()
          .from(schema.dataSources)
          .where(eq(schema.dataSources.sourceKey, PENDING_SOURCE_KEY))
          .limit(1)
      )[0]!.id;

    validCsvBytes = await readFile(
      join(__dirname, '../../../../data/fixtures/partner/spain-partner-v1-valid.csv'),
    );
    errorCsvBytes = await readFile(
      join(__dirname, '../../../../data/fixtures/partner/spain-partner-v1-with-errors.csv'),
    );
  });

  afterAll(async () => {
    if (!databaseUrl) return;
    for (const sourceId of [approvedSourceId, pendingSourceId]) {
      const listings = await db
        .select()
        .from(schema.propertyListings)
        .where(eq(schema.propertyListings.dataSourceId, sourceId));
      for (const listing of listings) {
        await db.delete(schema.listingMedia).where(eq(schema.listingMedia.listingId, listing.id));
        await db
          .delete(schema.listingPriceHistory)
          .where(eq(schema.listingPriceHistory.listingId, listing.id));
        await db
          .delete(schema.listingStatusHistory)
          .where(eq(schema.listingStatusHistory.listingId, listing.id));
        await db
          .delete(schema.propertyProvenance)
          .where(eq(schema.propertyProvenance.listingId, listing.id));
        await db.delete(schema.propertyListings).where(eq(schema.propertyListings.id, listing.id));
        if (listing.physicalPropertyId) {
          await db
            .delete(schema.propertyAddresses)
            .where(eq(schema.propertyAddresses.physicalPropertyId, listing.physicalPropertyId));
          await db
            .delete(schema.propertyLocations)
            .where(eq(schema.propertyLocations.physicalPropertyId, listing.physicalPropertyId));
          await db
            .delete(schema.physicalProperties)
            .where(eq(schema.physicalProperties.id, listing.physicalPropertyId));
        }
      }
      const runs = await db
        .select({ id: schema.importRuns.id })
        .from(schema.importRuns)
        .where(eq(schema.importRuns.dataSourceId, sourceId));
      for (const run of runs) {
        await db.delete(schema.rawSnapshots).where(eq(schema.rawSnapshots.importRunId, run.id));
        await db.delete(schema.importErrors).where(eq(schema.importErrors.importRunId, run.id));
        await db.delete(schema.importRuns).where(eq(schema.importRuns.id, run.id));
      }
      await db.delete(schema.dataSources).where(eq(schema.dataSources.id, sourceId));
    }
    await client.end();
  });

  it('refuses to run for a non-approved source', async () => {
    await expect(
      runSpainPartnerCsvImport({
        db,
        dataSourceId: pendingSourceId,
        actorUserId: null,
        bytes: validCsvBytes,
        mode: 'confirm',
      }),
    ).rejects.toThrow(SourceNotRunnableError);
  });

  it('dry-run reports a preview without persisting listings', async () => {
    const report = await runSpainPartnerCsvImport({
      db,
      dataSourceId: approvedSourceId,
      actorUserId: null,
      bytes: validCsvBytes,
      mode: 'dry_run',
    });
    importRunIds.push(report.runId);
    expect(report.inserted).toBe(6);
    expect(report.rejected).toBe(0);
    expect(report.preview).toHaveLength(6);

    const listings = await db
      .select()
      .from(schema.propertyListings)
      .where(eq(schema.propertyListings.dataSourceId, approvedSourceId));
    expect(listings).toHaveLength(0);
  });

  it('inserts new listings as pending_review and is idempotent on rerun', async () => {
    const firstReport = await runSpainPartnerCsvImport({
      db,
      dataSourceId: approvedSourceId,
      actorUserId: null,
      bytes: validCsvBytes,
      mode: 'confirm',
    });
    expect(firstReport.inserted).toBe(6);
    expect(firstReport.updated).toBe(0);
    expect(firstReport.rejected).toBe(0);

    const listings = await db
      .select()
      .from(schema.propertyListings)
      .where(eq(schema.propertyListings.dataSourceId, approvedSourceId));
    expect(listings).toHaveLength(6);
    for (const listing of listings) {
      expect(listing.operationalStatus).toBe('pending_review');
      expect(listing.isPublicBrowseable).toBe(false);
      expect(listing.freshnessMethod).toBe('partner_feed');
      expect(listing.isLegacySnapshot).toBe(false);
    }

    const secondReport = await runSpainPartnerCsvImport({
      db,
      dataSourceId: approvedSourceId,
      actorUserId: null,
      bytes: validCsvBytes,
      mode: 'confirm',
    });
    expect(secondReport.inserted).toBe(0);
    expect(secondReport.updated).toBe(6);

    const listingsAfterRerun = await db
      .select()
      .from(schema.propertyListings)
      .where(eq(schema.propertyListings.dataSourceId, approvedSourceId));
    expect(listingsAfterRerun).toHaveLength(6);

    // Reimporting identical prices must not spam price history.
    const demo1001 = listingsAfterRerun.find((l) => l.externalListingId === 'DEMO-1001')!;
    const priceHistory = await db
      .select()
      .from(schema.listingPriceHistory)
      .where(eq(schema.listingPriceHistory.listingId, demo1001.id));
    expect(priceHistory).toHaveLength(1);
  });

  it('quarantines invalid/unmapped rows while the batch continues', async () => {
    const report = await runSpainPartnerCsvImport({
      db,
      dataSourceId: approvedSourceId,
      actorUserId: null,
      bytes: errorCsvBytes,
      mode: 'confirm',
    });
    importRunIds.push(report.runId);

    expect(report.total).toBe(6);
    expect(report.rejected).toBe(2); // missing price + non-numeric bedrooms
    expect(report.skipped).toBe(2); // unmapped property_type + unmapped status
    expect(report.inserted).toBe(2); // DEMO-2001, DEMO-2006

    const codes = report.errors.map((e) => e.code).sort();
    expect(codes).toEqual([
      'unmapped_property_type',
      'unmapped_status',
      'validation_error',
      'validation_error',
    ]);

    const [run] = await db
      .select()
      .from(schema.importRuns)
      .where(eq(schema.importRuns.id, report.runId))
      .limit(1);
    expect(run?.status).toBe('completed_with_errors');

    const snapshot = await db
      .select()
      .from(schema.rawSnapshots)
      .where(eq(schema.rawSnapshots.importRunId, report.runId));
    expect(snapshot).toHaveLength(1);
  });

  it('lets an already-published listing self-service price and status updates via re-upload', async () => {
    // Publish DEMO-1002 out from under pending_review, as an admin action would.
    const [listing] = await db
      .select()
      .from(schema.propertyListings)
      .where(
        and(
          eq(schema.propertyListings.dataSourceId, approvedSourceId),
          eq(schema.propertyListings.externalListingId, 'DEMO-1002'),
        ),
      )
      .limit(1);
    await db
      .update(schema.propertyListings)
      .set({ operationalStatus: 'available', isPublicBrowseable: true })
      .where(eq(schema.propertyListings.id, listing!.id));

    const updatedCsv = validCsvBytes
      .toString('utf8')
      .replace('1250000,villa,available', '1195000,villa,sold');
    const report = await runSpainPartnerCsvImport({
      db,
      dataSourceId: approvedSourceId,
      actorUserId: null,
      bytes: Buffer.from(updatedCsv, 'utf8'),
      mode: 'confirm',
    });
    importRunIds.push(report.runId);

    const [refreshed] = await db
      .select()
      .from(schema.propertyListings)
      .where(eq(schema.propertyListings.id, listing!.id))
      .limit(1);
    expect(Number(refreshed!.priceAmount)).toBe(1195000);
    expect(refreshed!.operationalStatus).toBe('sold');
    expect(refreshed!.isPublicBrowseable).toBe(false);

    const priceHistory = await db
      .select()
      .from(schema.listingPriceHistory)
      .where(eq(schema.listingPriceHistory.listingId, listing!.id));
    expect(priceHistory.length).toBeGreaterThanOrEqual(2);

    const statusHistory = await db
      .select()
      .from(schema.listingStatusHistory)
      .where(eq(schema.listingStatusHistory.listingId, listing!.id));
    expect(statusHistory.some((s) => s.status === 'sold')).toBe(true);
  });
});
