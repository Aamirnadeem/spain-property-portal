import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as schema from '@spain/database/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { importLegacyBarcelona60, LEGACY_SOURCE_KEY } from './importer';

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

const fixtureExternalIds = ['900001', '900002'];

const fixtureRecords = [
  {
    id: 900001,
    title: 'Ingestion test fixture apartment',
    url: 'https://example.com/listings/900001',
    portal: 'Test Portal',
    area: 'Eixample',
    price: 500000,
    bedrooms: 2,
    size_sqm: 80,
    price_per_sqm: 6250,
    address: 'Test address 1',
    nearest_transit: 'Test transit',
    commute_min: 10,
    beach_proximity: 'N/A',
    park_proximity: 'N/A',
    property_type: 'apartment',
    category: 'City Center',
  },
  {
    id: 900002,
    title: 'Ingestion test fixture villa',
    url: 'https://example.com/listings/900002',
    portal: 'Test Portal',
    area: 'Sitges',
    price: 900000,
    bedrooms: 4,
    size_sqm: 200,
    price_per_sqm: 4500,
    address: 'Test address 2',
    nearest_transit: 'Test transit 2',
    commute_min: 30,
    beach_proximity: 'Beachfront',
    park_proximity: 'N/A',
    property_type: 'House/Chalet',
    category: 'Coastal',
  },
];

describe.skipIf(!databaseUrl)('importLegacyBarcelona60 (integration)', () => {
  let tempDir: string;
  let fixtureFilePath: string;
  const runIds: string[] = [];

  beforeAll(async () => {
    assertSafeTestDatabase(databaseUrl!);
    tempDir = await mkdtemp(join(tmpdir(), 'spain-ingestion-'));
    fixtureFilePath = join(tempDir, 'fixture.json');
    await writeFile(fixtureFilePath, JSON.stringify(fixtureRecords), 'utf8');
  });

  afterAll(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
    if (!databaseUrl) return;

    const client = postgres(databaseUrl, { max: 1 });
    const db = drizzle(client, { schema });
    try {
      const dataSource = (
        await db
          .select()
          .from(schema.dataSources)
          .where(eq(schema.dataSources.sourceKey, LEGACY_SOURCE_KEY))
          .limit(1)
      )[0];

      if (dataSource) {
        const listings = await db
          .select()
          .from(schema.propertyListings)
          .where(
            and(
              eq(schema.propertyListings.dataSourceId, dataSource.id),
              inArray(schema.propertyListings.externalListingId, fixtureExternalIds),
            ),
          );

        for (const listing of listings) {
          await db.delete(schema.listingMedia).where(eq(schema.listingMedia.listingId, listing.id));
          await db
            .delete(schema.listingPriceHistory)
            .where(eq(schema.listingPriceHistory.listingId, listing.id));
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
      }

      for (const runId of runIds) {
        await db.delete(schema.importErrors).where(eq(schema.importErrors.importRunId, runId));
        await db.delete(schema.importRuns).where(eq(schema.importRuns.id, runId));
      }
    } finally {
      await client.end();
    }
  });

  it('inserts new listings on first run and updates them idempotently on rerun', async () => {
    const firstReport = await importLegacyBarcelona60({
      databaseUrl: databaseUrl!,
      filePath: fixtureFilePath,
    });
    runIds.push(firstReport.runId);
    expect(firstReport.inserted).toBe(2);
    expect(firstReport.updated).toBe(0);
    expect(firstReport.rejected).toBe(0);
    expect(firstReport.skipped).toBe(0);

    const secondReport = await importLegacyBarcelona60({
      databaseUrl: databaseUrl!,
      filePath: fixtureFilePath,
    });
    runIds.push(secondReport.runId);
    expect(secondReport.inserted).toBe(0);
    expect(secondReport.updated).toBe(2);
    expect(secondReport.rejected).toBe(0);

    const client = postgres(databaseUrl!, { max: 1 });
    const db = drizzle(client, { schema });
    try {
      const dataSource = (
        await db
          .select()
          .from(schema.dataSources)
          .where(eq(schema.dataSources.sourceKey, LEGACY_SOURCE_KEY))
          .limit(1)
      )[0];
      const listings = await db
        .select()
        .from(schema.propertyListings)
        .where(
          and(
            eq(schema.propertyListings.dataSourceId, dataSource!.id),
            inArray(schema.propertyListings.externalListingId, fixtureExternalIds),
          ),
        );
      expect(listings).toHaveLength(2);
      for (const listing of listings) {
        expect(listing.isLegacySnapshot).toBe(true);
        expect(listing.operationalStatus).toBe('legacy_snapshot');
        expect(listing.isPublicBrowseable).toBe(true);
        expect(listing.lastConfirmedAvailableAt).toBeNull();
      }
    } finally {
      await client.end();
    }
  });
});
