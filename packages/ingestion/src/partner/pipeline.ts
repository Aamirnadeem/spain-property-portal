import { createHash } from 'node:crypto';
import * as schema from '@spain/database/schema';
import { and, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { parseCsv, rowToRecord } from './csv';
import {
  computeRoundedPricePerSqm,
  isBrowseableStatus,
  isPrePublishStatus,
  normalizePartnerEnvironmentType,
  normalizePartnerPropertyType,
  normalizePartnerStatus,
  splitListField,
  type PartnerListingStatus,
} from './normalize';
import { assertSourceRunnable } from './permission-gate';
import { missingRequiredColumns, spainPartnerCsvRowSchema } from './schema';

export const SPAIN_PARTNER_CSV_V1_PARSER_VERSION = 'spain-partner-csv-v1@1';

type DbClient = PostgresJsDatabase<typeof schema>;

export interface CanonicalListingDraft {
  externalListingId: string;
  title: string;
  description: string | null;
  priceAmount: number;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  builtAreaSqm: number | null;
  propertyTypeRaw: string;
  propertyTypeKey: string;
  environmentType: string | null;
  municipalityName: string | null;
  neighborhoodName: string | null;
  addressText: string | null;
  lat: number | null;
  lng: number | null;
  locationAccuracy: string | null;
  status: PartnerListingStatus;
  sourceUpdatedAt: Date | null;
  imageUrls: string[];
  features: string[];
}

export interface PartnerImportErrorEntry {
  externalListingId: string | null;
  recordIndex: number;
  code: string;
  message: string;
}

export type PartnerImportMode = 'dry_run' | 'confirm';

export interface RunSpainPartnerCsvImportOptions {
  db: DbClient;
  dataSourceId: string;
  actorUserId: string | null;
  bytes: Uint8Array;
  fileName?: string;
  mode: PartnerImportMode;
}

export interface DryRunPreviewRow {
  recordIndex: number;
  externalListingId: string;
  action: 'would_insert' | 'would_update';
  draft: CanonicalListingDraft;
}

export interface PartnerImportReport {
  runId: string;
  mode: PartnerImportMode;
  total: number;
  inserted: number;
  updated: number;
  rejected: number;
  skipped: number;
  errors: PartnerImportErrorEntry[];
  warnings: PartnerImportErrorEntry[];
  preview?: DryRunPreviewRow[];
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function buildSearchDocument(parts: Array<string | null | undefined>): string {
  return parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(' ')
    .toLowerCase();
}

function toDraft(row: ReturnType<typeof spainPartnerCsvRowSchema.parse>): {
  draft: Omit<CanonicalListingDraft, 'propertyTypeKey' | 'status'> & {
    propertyTypeRawValue: string;
    statusRawValue: string;
  };
} {
  return {
    draft: {
      externalListingId: row.external_id,
      title: row.title,
      description: row.description ?? null,
      priceAmount: row.price_eur,
      currency: row.currency ?? 'EUR',
      bedrooms: row.bedrooms ?? null,
      bathrooms: row.bathrooms ?? null,
      builtAreaSqm: row.built_area_sqm ?? null,
      propertyTypeRaw: row.property_type,
      propertyTypeRawValue: row.property_type,
      environmentType: null,
      municipalityName: row.municipality ?? null,
      neighborhoodName: row.neighborhood ?? null,
      addressText: row.address_text ?? null,
      lat: row.lat ?? null,
      lng: row.lng ?? null,
      locationAccuracy: row.location_accuracy ?? null,
      statusRawValue: row.status,
      sourceUpdatedAt: row.source_updated_at ? new Date(row.source_updated_at) : null,
      imageUrls: splitListField(row.image_urls),
      features: splitListField(row.features),
    },
  };
}

async function upsertPartnerListing(
  db: DbClient,
  input: {
    dataSourceId: string;
    organizationId: string | null;
    draft: CanonicalListingDraft;
    rawRecord: Record<string, unknown>;
  },
): Promise<'inserted' | 'updated'> {
  const { dataSourceId, organizationId, draft, rawRecord } = input;
  const now = new Date();
  const areaLabel = draft.neighborhoodName ?? draft.municipalityName ?? null;
  const pricePerSqm = draft.builtAreaSqm
    ? computeRoundedPricePerSqm(draft.priceAmount, draft.builtAreaSqm)
    : null;
  const searchDocument = buildSearchDocument([
    draft.title,
    draft.municipalityName,
    draft.neighborhoodName,
    draft.addressText,
  ]);

  const existingListing = (
    await db
      .select()
      .from(schema.propertyListings)
      .where(
        and(
          eq(schema.propertyListings.dataSourceId, dataSourceId),
          eq(schema.propertyListings.externalListingId, draft.externalListingId),
        ),
      )
      .limit(1)
  )[0];

  if (!existingListing) {
    const [physicalProperty] = await db
      .insert(schema.physicalProperties)
      .values({
        bedrooms: draft.bedrooms,
        bathrooms: draft.bathrooms,
        builtAreaSqm: draft.builtAreaSqm != null ? String(draft.builtAreaSqm) : null,
        confidence: 'provisional',
      })
      .returning();

    await db.insert(schema.propertyAddresses).values({
      physicalPropertyId: physicalProperty!.id,
      freeText: draft.addressText,
      countryCode: 'ES',
      accuracy: draft.locationAccuracy ?? 'approximate',
    });

    await db.insert(schema.propertyLocations).values({
      physicalPropertyId: physicalProperty!.id,
      areaLabel,
      latitude: draft.lat != null ? String(draft.lat) : null,
      longitude: draft.lng != null ? String(draft.lng) : null,
      accuracy: draft.locationAccuracy ?? 'unknown',
      displayPolicy: 'approximate',
    });

    const [listing] = await db
      .insert(schema.propertyListings)
      .values({
        dataSourceId,
        externalListingId: draft.externalListingId,
        physicalPropertyId: physicalProperty!.id,
        organizationId,
        title: draft.title,
        description: draft.description,
        portalName: null,
        currency: draft.currency,
        priceAmount: String(draft.priceAmount),
        bedrooms: draft.bedrooms,
        bathrooms: draft.bathrooms,
        builtAreaSqm: draft.builtAreaSqm != null ? String(draft.builtAreaSqm) : null,
        pricePerSqm: pricePerSqm != null ? String(pricePerSqm) : null,
        propertyTypeRaw: draft.propertyTypeRaw,
        propertyTypeKey: draft.propertyTypeKey,
        environmentType: draft.environmentType,
        areaLabel,
        addressText: draft.addressText,
        operationalStatus: 'pending_review',
        freshnessMethod: 'partner_feed',
        isLegacySnapshot: false,
        isPublicBrowseable: false,
        sourceUpdatedAt: draft.sourceUpdatedAt,
        firstSeenAt: now,
        lastSeenAt: now,
        lastCheckedAt: now,
        importedAt: now,
        searchDocument,
      })
      .returning();

    await db.insert(schema.propertyProvenance).values({
      listingId: listing!.id,
      dataSourceId,
      externalListingId: draft.externalListingId,
      sourceUrl: null,
      importMethod: 'partner_feed',
      importedAt: now,
      rawSnapshot: rawRecord,
    });

    await db.insert(schema.listingPriceHistory).values({
      listingId: listing!.id,
      currency: draft.currency,
      priceAmount: String(draft.priceAmount),
      recordedAt: now,
      source: 'import',
    });

    await db.insert(schema.listingStatusHistory).values({
      listingId: listing!.id,
      status: 'pending_review',
      recordedAt: now,
      note: 'Created from Spain Partner CSV v1 import',
    });

    await db.insert(schema.listingMedia).values({
      listingId: listing!.id,
      mediaAssetId: null,
      sortOrder: 0,
      isPlaceholder: true,
    });

    return 'inserted';
  }

  // Pre-publish listings stay pending_review regardless of the CSV status column — only an
  // admin publish action (Task 15) may move a listing out of review the first time. Once a
  // listing has been published at least once, the owning agency may self-service price and
  // status updates (including withdrawal) via re-upload.
  const currentStatus = existingListing.operationalStatus;
  let nextStatus = currentStatus;
  let nextBrowseable = existingListing.isPublicBrowseable;
  if (!isPrePublishStatus(currentStatus)) {
    nextStatus = draft.status;
    nextBrowseable = isBrowseableStatus(draft.status);
  }

  if (existingListing.physicalPropertyId) {
    const physicalPropertyId = existingListing.physicalPropertyId;
    await db
      .update(schema.physicalProperties)
      .set({
        bedrooms: draft.bedrooms,
        bathrooms: draft.bathrooms,
        builtAreaSqm: draft.builtAreaSqm != null ? String(draft.builtAreaSqm) : null,
      })
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
        .set({ freeText: draft.addressText })
        .where(eq(schema.propertyAddresses.id, existingAddress.id));
    } else {
      await db.insert(schema.propertyAddresses).values({
        physicalPropertyId,
        freeText: draft.addressText,
        countryCode: 'ES',
        accuracy: draft.locationAccuracy ?? 'approximate',
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
        .set({
          areaLabel,
          latitude: draft.lat != null ? String(draft.lat) : null,
          longitude: draft.lng != null ? String(draft.lng) : null,
        })
        .where(eq(schema.propertyLocations.id, existingLocation.id));
    } else {
      await db.insert(schema.propertyLocations).values({
        physicalPropertyId,
        areaLabel,
        latitude: draft.lat != null ? String(draft.lat) : null,
        longitude: draft.lng != null ? String(draft.lng) : null,
        accuracy: draft.locationAccuracy ?? 'unknown',
      });
    }
  }

  await db
    .update(schema.propertyListings)
    .set({
      title: draft.title,
      description: draft.description,
      priceAmount: String(draft.priceAmount),
      bedrooms: draft.bedrooms,
      bathrooms: draft.bathrooms,
      builtAreaSqm: draft.builtAreaSqm != null ? String(draft.builtAreaSqm) : null,
      pricePerSqm: pricePerSqm != null ? String(pricePerSqm) : null,
      propertyTypeRaw: draft.propertyTypeRaw,
      propertyTypeKey: draft.propertyTypeKey,
      environmentType: draft.environmentType,
      areaLabel,
      addressText: draft.addressText,
      operationalStatus: nextStatus,
      isPublicBrowseable: nextBrowseable,
      sourceUpdatedAt: draft.sourceUpdatedAt,
      lastSeenAt: now,
      lastCheckedAt: now,
      importedAt: now,
      searchDocument,
    })
    .where(eq(schema.propertyListings.id, existingListing.id));

  const previousPrice =
    existingListing.priceAmount == null ? null : Number(existingListing.priceAmount);
  if (previousPrice !== draft.priceAmount) {
    await db.insert(schema.listingPriceHistory).values({
      listingId: existingListing.id,
      currency: draft.currency,
      priceAmount: String(draft.priceAmount),
      recordedAt: now,
      source: 'import',
    });
  }

  if (nextStatus !== currentStatus) {
    await db.insert(schema.listingStatusHistory).values({
      listingId: existingListing.id,
      status: nextStatus,
      recordedAt: now,
      note: 'Updated from Spain Partner CSV v1 import',
    });
  }

  await db
    .update(schema.propertyProvenance)
    .set({ importedAt: now, rawSnapshot: rawRecord })
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

/**
 * Spain Partner CSV v1 pipeline: permission_gate -> load+snapshot -> parse -> validate ->
 * normalize -> persist (skipped in dry_run) -> finalize_import_run. See
 * docs/INGESTION_ARCHITECTURE.md for the full stage diagram (JSON/XML/geo-match/duplicates
 * are out of scope for this vertical slice — see docs/KNOWN_ISSUES.md).
 */
export async function runSpainPartnerCsvImport(
  options: RunSpainPartnerCsvImportOptions,
): Promise<PartnerImportReport> {
  const { db, dataSourceId, actorUserId, bytes, mode } = options;

  const [dataSource] = await db
    .select()
    .from(schema.dataSources)
    .where(eq(schema.dataSources.id, dataSourceId))
    .limit(1);
  if (!dataSource) {
    throw new Error(`Unknown data source: ${dataSourceId}`);
  }
  assertSourceRunnable(dataSource);

  const [feedConfig] = await db
    .select()
    .from(schema.feedConfigs)
    .where(eq(schema.feedConfigs.dataSourceId, dataSourceId))
    .limit(1);

  const text = Buffer.from(bytes).toString('utf8');
  const { headers, rows } = parseCsv(text);
  const missingColumns = missingRequiredColumns(headers);

  const [run] = await db
    .insert(schema.importRuns)
    .values({
      dataSourceId,
      organizationId: dataSource.organizationId,
      feedConfigId: feedConfig?.id ?? null,
      // import_runs.mode is a shared enum (dry_run/full/incremental) across all adapters;
      // the partner pipeline's own dry_run/confirm distinction maps 'confirm' -> 'full'.
      mode: mode === 'dry_run' ? 'dry_run' : 'full',
      parserVersion: SPAIN_PARTNER_CSV_V1_PARSER_VERSION,
      actorUserId,
      status: 'running',
      totalRecords: rows.length,
    })
    .returning();
  const runId = run!.id;

  const rawRecords = rows.map((row) => rowToRecord(headers, row));
  const [snapshot] = await db
    .insert(schema.rawSnapshots)
    .values({
      importRunId: runId,
      dataSourceId,
      contentSha256: sha256Hex(bytes),
      parserVersion: SPAIN_PARTNER_CSV_V1_PARSER_VERSION,
      byteSize: bytes.byteLength,
      payload: rawRecords,
    })
    .returning();
  await db
    .update(schema.importRuns)
    .set({ rawSnapshotId: snapshot!.id })
    .where(eq(schema.importRuns.id, runId));

  if (missingColumns.length > 0) {
    const message = `Missing required column(s): ${missingColumns.join(', ')}`;
    await db.insert(schema.importErrors).values({
      importRunId: runId,
      externalListingId: null,
      recordIndex: -1,
      code: 'missing_required_columns',
      message,
      rawRecord: { headers },
    });
    await db
      .update(schema.importRuns)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        report: { inserted: 0, updated: 0, rejected: rows.length, skipped: 0, mode },
      })
      .where(eq(schema.importRuns.id, runId));
    return {
      runId,
      mode,
      total: rows.length,
      inserted: 0,
      updated: 0,
      rejected: rows.length,
      skipped: 0,
      errors: [
        { externalListingId: null, recordIndex: -1, code: 'missing_required_columns', message },
      ],
      warnings: [],
    };
  }

  let inserted = 0;
  let updated = 0;
  let rejected = 0;
  let skipped = 0;
  const errors: PartnerImportErrorEntry[] = [];
  const warnings: PartnerImportErrorEntry[] = [];
  const preview: DryRunPreviewRow[] = [];

  for (let index = 0; index < rawRecords.length; index += 1) {
    const rawRecord = rawRecords[index]!;
    const externalListingId = rawRecord.external_id || null;
    const parsed = spainPartnerCsvRowSchema.safeParse(rawRecord);

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
        rawRecord,
      });
      continue;
    }

    const row = parsed.data;
    const propertyTypeKey = normalizePartnerPropertyType(row.property_type);
    if (!propertyTypeKey) {
      skipped += 1;
      const message = `Unmapped property_type: "${row.property_type}"`;
      errors.push({
        externalListingId: row.external_id,
        recordIndex: index,
        code: 'unmapped_property_type',
        message,
      });
      await db.insert(schema.importErrors).values({
        importRunId: runId,
        externalListingId: row.external_id,
        recordIndex: index,
        code: 'unmapped_property_type',
        message,
        rawRecord,
      });
      continue;
    }

    const status = normalizePartnerStatus(row.status);
    if (!status) {
      skipped += 1;
      const message = `Unmapped status: "${row.status}"`;
      errors.push({
        externalListingId: row.external_id,
        recordIndex: index,
        code: 'unmapped_status',
        message,
      });
      await db.insert(schema.importErrors).values({
        importRunId: runId,
        externalListingId: row.external_id,
        recordIndex: index,
        code: 'unmapped_status',
        message,
        rawRecord,
      });
      continue;
    }

    let environmentType: string | null = null;
    if (row.environment_type) {
      environmentType = normalizePartnerEnvironmentType(row.environment_type);
      if (!environmentType) {
        const message = `Unmapped environment_type ignored: "${row.environment_type}"`;
        warnings.push({
          externalListingId: row.external_id,
          recordIndex: index,
          code: 'unmapped_environment_type',
          message,
        });
      }
    }

    const { draft: partialDraft } = toDraft(row);
    const draft: CanonicalListingDraft = {
      ...partialDraft,
      propertyTypeKey,
      environmentType,
      status,
    };

    if (mode === 'dry_run') {
      const existing = (
        await db
          .select({ id: schema.propertyListings.id })
          .from(schema.propertyListings)
          .where(
            and(
              eq(schema.propertyListings.dataSourceId, dataSourceId),
              eq(schema.propertyListings.externalListingId, draft.externalListingId),
            ),
          )
          .limit(1)
      )[0];
      if (existing) updated += 1;
      else inserted += 1;
      if (preview.length < 20) {
        preview.push({
          recordIndex: index,
          externalListingId: draft.externalListingId,
          action: existing ? 'would_update' : 'would_insert',
          draft,
        });
      }
      continue;
    }

    try {
      const outcome = await upsertPartnerListing(db, {
        dataSourceId,
        organizationId: dataSource.organizationId,
        draft,
        rawRecord,
      });
      if (outcome === 'inserted') inserted += 1;
      else updated += 1;
    } catch (error) {
      rejected += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        externalListingId: row.external_id,
        recordIndex: index,
        code: 'persist_error',
        message,
      });
      await db.insert(schema.importErrors).values({
        importRunId: runId,
        externalListingId: row.external_id,
        recordIndex: index,
        code: 'persist_error',
        message,
        rawRecord,
      });
    }
  }

  const status = rejected > 0 || skipped > 0 ? 'completed_with_errors' : 'completed';
  await db
    .update(schema.importRuns)
    .set({
      status,
      finishedAt: new Date(),
      insertedCount: inserted,
      updatedCount: updated,
      skippedCount: skipped,
      rejectedCount: rejected,
      report: { inserted, updated, rejected, skipped, mode, warnings: warnings.length },
    })
    .where(eq(schema.importRuns.id, runId));

  return {
    runId,
    mode,
    total: rows.length,
    inserted,
    updated,
    rejected,
    skipped,
    errors,
    warnings,
    preview: mode === 'dry_run' ? preview : undefined,
  };
}
