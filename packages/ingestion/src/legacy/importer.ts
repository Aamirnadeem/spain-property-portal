import { readFile } from 'node:fs/promises';
import * as schema from '@spain/database/schema';
import { and, eq } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { legacyPropertyRecordSchema, legacyPropertyRecordsFileSchema } from './schema';
import {
  normalizeEnvironmentType,
  normalizePropertyType,
  nullifyNotApplicable,
  type EnvironmentType,
} from './normalize';

export const LEGACY_SOURCE_KEY = 'legacy-barcelona-explorer-60';

type DbClient = PostgresJsDatabase<typeof schema>;

export interface ImportErrorEntry {
  externalListingId: string | null;
  recordIndex: number;
  code: string;
  message: string;
}

export interface LegacyImportReport {
  runId: string;
  inserted: number;
  updated: number;
  rejected: number;
  skipped: number;
  errors: ImportErrorEntry[];
}

export interface ImportLegacyBarcelona60Options {
  databaseUrl: string;
  filePath: string;
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractExternalId(rawRecord: unknown): string | null {
  if (isRecordLike(rawRecord) && 'id' in rawRecord) {
    const id = rawRecord.id;
    if (typeof id === 'number' || typeof id === 'string') return String(id);
  }
  return null;
}

function computeRoundedPricePerSqm(price: number, sizeSqm: number): number {
  return Math.round((price / sizeSqm) * 100) / 100;
}

async function ensureLegacyDataSource(db: DbClient) {
  const existing = await db
    .select()
    .from(schema.dataSources)
    .where(eq(schema.dataSources.sourceKey, LEGACY_SOURCE_KEY))
    .limit(1);
  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(schema.dataSources)
    .values({
      sourceKey: LEGACY_SOURCE_KEY,
      name: 'Barcelona Property Explorer (legacy snapshot)',
      sourceType: 'legacy_snapshot',
      permissionStatus: 'restricted',
      imageRights: 'none',
      notes: 'Frozen 60-record legacy dataset imported as a read-only, unverified snapshot.',
    })
    .returning();
  return created!;
}

interface UpsertLegacyListingInput {
  dataSourceId: string;
  externalListingId: string;
  record: import('./schema').LegacyPropertyRecord;
  propertyTypeKey: string;
  environmentType: EnvironmentType;
}

async function upsertLegacyListing(
  db: DbClient,
  input: UpsertLegacyListingInput,
): Promise<'inserted' | 'updated'> {
  const { dataSourceId, externalListingId, record, propertyTypeKey, environmentType } = input;
  const beachProximity = nullifyNotApplicable(record.beach_proximity);
  const parkProximity = nullifyNotApplicable(record.park_proximity);
  const pricePerSqm = computeRoundedPricePerSqm(record.price, record.size_sqm);
  const searchDocument = [record.title, record.area, record.address, record.portal]
    .join(' ')
    .toLowerCase();
  const now = new Date();

  const existingListing = (
    await db
      .select()
      .from(schema.propertyListings)
      .where(
        and(
          eq(schema.propertyListings.dataSourceId, dataSourceId),
          eq(schema.propertyListings.externalListingId, externalListingId),
        ),
      )
      .limit(1)
  )[0];

  if (!existingListing) {
    const [physicalProperty] = await db
      .insert(schema.physicalProperties)
      .values({
        bedrooms: record.bedrooms,
        builtAreaSqm: String(record.size_sqm),
        confidence: 'provisional',
      })
      .returning();

    await db.insert(schema.propertyAddresses).values({
      physicalPropertyId: physicalProperty!.id,
      freeText: record.address,
      countryCode: 'ES',
    });

    await db.insert(schema.propertyLocations).values({
      physicalPropertyId: physicalProperty!.id,
      areaLabel: record.area,
      accuracy: 'unknown',
    });

    const [listing] = await db
      .insert(schema.propertyListings)
      .values({
        dataSourceId,
        externalListingId,
        physicalPropertyId: physicalProperty!.id,
        title: record.title,
        sourceUrl: record.url,
        portalName: record.portal,
        currency: 'EUR',
        priceAmount: String(record.price),
        bedrooms: record.bedrooms,
        builtAreaSqm: String(record.size_sqm),
        pricePerSqm: String(pricePerSqm),
        propertyTypeRaw: record.property_type,
        propertyTypeKey,
        environmentType,
        areaLabel: record.area,
        addressText: record.address,
        nearestTransit: record.nearest_transit,
        commuteMin: record.commute_min,
        beachProximity,
        parkProximity,
        operationalStatus: 'legacy_snapshot',
        freshnessMethod: 'legacy_snapshot',
        isLegacySnapshot: true,
        isPublicBrowseable: true,
        firstSeenAt: now,
        lastSeenAt: now,
        lastCheckedAt: now,
        lastConfirmedAvailableAt: null,
        importedAt: now,
        searchDocument,
      })
      .returning();

    await db.insert(schema.propertyProvenance).values({
      listingId: listing!.id,
      dataSourceId,
      externalListingId,
      sourceUrl: record.url,
      importMethod: 'legacy_snapshot',
      importedAt: now,
      rawSnapshot: record,
    });

    await db.insert(schema.listingPriceHistory).values({
      listingId: listing!.id,
      currency: 'EUR',
      priceAmount: String(record.price),
      recordedAt: now,
      source: 'import',
    });

    await db.insert(schema.listingMedia).values({
      listingId: listing!.id,
      mediaAssetId: null,
      sortOrder: 0,
      isPlaceholder: true,
    });

    return 'inserted';
  }

  if (existingListing.physicalPropertyId) {
    const physicalPropertyId = existingListing.physicalPropertyId;
    await db
      .update(schema.physicalProperties)
      .set({ bedrooms: record.bedrooms, builtAreaSqm: String(record.size_sqm) })
      .where(eq(schema.physicalProperties.id, physicalPropertyId));

    const existingAddress = (
      await db
        .select()
        .from(schema.propertyAddresses)
        .where(eq(schema.propertyAddresses.physicalPropertyId, physicalPropertyId))
        .limit(1)
    )[0];
    if (existingAddress) {
      await db
        .update(schema.propertyAddresses)
        .set({ freeText: record.address })
        .where(eq(schema.propertyAddresses.id, existingAddress.id));
    } else {
      await db.insert(schema.propertyAddresses).values({
        physicalPropertyId,
        freeText: record.address,
        countryCode: 'ES',
      });
    }

    const existingLocation = (
      await db
        .select()
        .from(schema.propertyLocations)
        .where(eq(schema.propertyLocations.physicalPropertyId, physicalPropertyId))
        .limit(1)
    )[0];
    if (existingLocation) {
      await db
        .update(schema.propertyLocations)
        .set({ areaLabel: record.area })
        .where(eq(schema.propertyLocations.id, existingLocation.id));
    } else {
      await db.insert(schema.propertyLocations).values({
        physicalPropertyId,
        areaLabel: record.area,
        accuracy: 'unknown',
      });
    }
  }

  await db
    .update(schema.propertyListings)
    .set({
      title: record.title,
      sourceUrl: record.url,
      portalName: record.portal,
      priceAmount: String(record.price),
      bedrooms: record.bedrooms,
      builtAreaSqm: String(record.size_sqm),
      pricePerSqm: String(pricePerSqm),
      propertyTypeRaw: record.property_type,
      propertyTypeKey,
      environmentType,
      areaLabel: record.area,
      addressText: record.address,
      nearestTransit: record.nearest_transit,
      commuteMin: record.commute_min,
      beachProximity,
      parkProximity,
      isLegacySnapshot: true,
      isPublicBrowseable: true,
      lastSeenAt: now,
      lastCheckedAt: now,
      importedAt: now,
      searchDocument,
    })
    .where(eq(schema.propertyListings.id, existingListing.id));

  const previousPrice = Number(existingListing.priceAmount);
  if (previousPrice !== record.price) {
    await db.insert(schema.listingPriceHistory).values({
      listingId: existingListing.id,
      currency: 'EUR',
      priceAmount: String(record.price),
      recordedAt: now,
      source: 'import',
    });
  }

  await db
    .update(schema.propertyProvenance)
    .set({ sourceUrl: record.url, importedAt: now, rawSnapshot: record })
    .where(eq(schema.propertyProvenance.listingId, existingListing.id));

  const existingMedia = (
    await db
      .select()
      .from(schema.listingMedia)
      .where(eq(schema.listingMedia.listingId, existingListing.id))
      .limit(1)
  )[0];
  if (!existingMedia) {
    await db.insert(schema.listingMedia).values({
      listingId: existingListing.id,
      mediaAssetId: null,
      sortOrder: 0,
      isPlaceholder: true,
    });
  }

  return 'updated';
}

async function runImport(db: DbClient, filePath: string): Promise<LegacyImportReport> {
  const fileContents = await readFile(filePath, 'utf8');
  const parsedFile = legacyPropertyRecordsFileSchema.safeParse(JSON.parse(fileContents));
  if (!parsedFile.success) {
    throw new Error(`Legacy import file must contain a JSON array: ${filePath}`);
  }
  const rawRecords = parsedFile.data;

  const dataSource = await ensureLegacyDataSource(db);

  const [run] = await db
    .insert(schema.importRuns)
    .values({
      dataSourceId: dataSource.id,
      status: 'running',
      totalRecords: rawRecords.length,
    })
    .returning();
  const runId = run!.id;

  let inserted = 0;
  let updated = 0;
  let rejected = 0;
  let skipped = 0;
  const errors: ImportErrorEntry[] = [];

  for (let index = 0; index < rawRecords.length; index += 1) {
    const rawRecord = rawRecords[index];
    const externalListingId = extractExternalId(rawRecord);
    const parsed = legacyPropertyRecordSchema.safeParse(rawRecord);

    if (!parsed.success) {
      rejected += 1;
      const message = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      errors.push({ externalListingId, recordIndex: index, code: 'validation_error', message });
      await db.insert(schema.importErrors).values({
        importRunId: runId,
        externalListingId,
        recordIndex: index,
        code: 'validation_error',
        message,
        rawRecord: isRecordLike(rawRecord) ? rawRecord : { value: rawRecord },
      });
      continue;
    }

    const record = parsed.data;
    const canonicalExternalId = String(record.id);

    let propertyTypeKey: string;
    let environmentType: EnvironmentType;
    try {
      propertyTypeKey = normalizePropertyType(record.property_type);
      environmentType = normalizeEnvironmentType(record.category);
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        externalListingId: canonicalExternalId,
        recordIndex: index,
        code: 'unmapped_value',
        message,
      });
      await db.insert(schema.importErrors).values({
        importRunId: runId,
        externalListingId: canonicalExternalId,
        recordIndex: index,
        code: 'unmapped_value',
        message,
        rawRecord: record,
      });
      continue;
    }

    try {
      const outcome = await upsertLegacyListing(db, {
        dataSourceId: dataSource.id,
        externalListingId: canonicalExternalId,
        record,
        propertyTypeKey,
        environmentType,
      });
      if (outcome === 'inserted') inserted += 1;
      else updated += 1;
    } catch (error) {
      rejected += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        externalListingId: canonicalExternalId,
        recordIndex: index,
        code: 'persist_error',
        message,
      });
      await db.insert(schema.importErrors).values({
        importRunId: runId,
        externalListingId: canonicalExternalId,
        recordIndex: index,
        code: 'persist_error',
        message,
        rawRecord: record,
      });
    }
  }

  await db
    .update(schema.importRuns)
    .set({
      status: rejected > 0 || skipped > 0 ? 'completed_with_errors' : 'completed',
      finishedAt: new Date(),
      insertedCount: inserted,
      updatedCount: updated,
      skippedCount: skipped,
      rejectedCount: rejected,
      report: { inserted, updated, rejected, skipped },
    })
    .where(eq(schema.importRuns.id, runId));

  return { runId, inserted, updated, rejected, skipped, errors };
}

export async function importLegacyBarcelona60(
  options: ImportLegacyBarcelona60Options,
): Promise<LegacyImportReport> {
  const client = postgres(options.databaseUrl, { max: 1 });
  const db = drizzle(client, { schema });
  try {
    return await runImport(db, options.filePath);
  } finally {
    await client.end();
  }
}
