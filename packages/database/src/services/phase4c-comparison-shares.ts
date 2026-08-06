import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  COMPARISON_MAX_ITEMS,
  COMPARISON_MIN_ITEMS,
  DEFAULT_PUBLIC_FIELDS,
  PHASE4C_SCHEMA_VERSION,
  SCORE_MODEL_VERSION,
  calculateComparisonShareExpiry,
  scoreComparisonSet,
  validateComparisonWeights,
  type ComparisonListingFacts,
  type ComparisonShareExpiryPreset,
  type ComparisonWeights,
  type PublicCell,
  type PublicComparisonDto,
  type PublicComparisonFieldKey,
  type PublicComparisonListingRow,
  type PublicListingWarningCode,
  type SuitabilityScoreResult,
} from '@spain/domain';
import * as schema from '../schema/index';
import { BuyerWorkspaceError, hashGuestToken, mintGuestToken } from './buyer-workspace';

type Db = PostgresJsDatabase<typeof schema>;
type Share = typeof schema.comparisonShares.$inferSelect;
type ShareItem = typeof schema.comparisonShareItems.$inferSelect;
type Listing = typeof schema.propertyListings.$inferSelect;
type UaCategory = 'browser' | 'bot' | 'preview' | 'other';
type AccessResult = 'ok' | 'not_found' | 'expired' | 'revoked';

export interface CreateComparisonShareInput {
  listingIds: string[];
  publicTitle?: string | null;
  publicDescription?: string | null;
  expiresAt?: Date | string;
  expiryPreset?: ComparisonShareExpiryPreset;
  customExpiresAt?: string;
  includeWeights?: boolean;
  includeScores?: boolean;
  comparisonSetId?: string | null;
  weights?: ComparisonWeights;
}

type ShareManifest = {
  schemaVersion: typeof PHASE4C_SCHEMA_VERSION;
  fields: PublicComparisonFieldKey[];
  listingIds: string[];
  includeWeights: boolean;
  includeScores: boolean;
  scoreModelVersion: typeof SCORE_MODEL_VERSION | null;
  scoreSnapshot?: SuitabilityScoreResult[];
  createdAt: string;
  expiresAt: string;
};

export const mintShareToken = mintGuestToken;
export const hashShareToken = hashGuestToken;

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function availableCell(value: unknown): PublicCell {
  if (value == null || value === '') return { status: 'unavailable', reason: 'not_in_source' };
  return { status: 'available', value };
}

function unavailableCell(
  reason: 'not_in_source' | 'not_applicable' | 'not_authorized' = 'not_in_source',
): PublicCell {
  return { status: 'unavailable', reason };
}

function listingToFacts(row: Listing): ComparisonListingFacts {
  return {
    listingId: row.id,
    priceAmount: toNumber(row.priceAmount),
    pricePerSqm: toNumber(row.pricePerSqm),
    builtAreaSqm: toNumber(row.builtAreaSqm),
    usableAreaSqm: null,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    areaLabel: row.areaLabel,
    environmentType: row.environmentType,
    commuteMin: row.commuteMin,
    beachProximity: row.beachProximity,
    parkProximity: row.parkProximity,
    condition: null,
    energyRating: null,
    hasOutdoorSpace: null,
    accessibilityFeature: null,
    lastConfirmedAvailableAt: row.lastConfirmedAvailableAt?.toISOString() ?? null,
  };
}

function shareStatus(share: Share): 'active' | 'expired' | 'revoked' {
  if (share.revokedAt) return 'revoked';
  if (new Date() >= share.expiresAt) return 'expired';
  return 'active';
}

function ownerShare(share: Share, listingIds?: string[]) {
  const { tokenHash: _tokenHash, manifest: _manifest, ...safe } = share;
  const base = { ...safe, status: shareStatus(share) };
  return listingIds ? { ...base, listingIds } : base;
}

function manifestOf(share: Share): ShareManifest {
  return share.manifest as ShareManifest;
}

async function resolveWeights(
  db: Db,
  userId: string,
  input: CreateComparisonShareInput,
): Promise<ComparisonWeights | null> {
  if (!input.includeWeights && !input.includeScores) return null;
  if (input.weights) {
    return validateComparisonWeights(input.weights as Record<string, unknown>);
  }
  const [profile] = await db
    .select({ weights: schema.userPreferenceProfiles.weights })
    .from(schema.userPreferenceProfiles)
    .where(
      and(
        eq(schema.userPreferenceProfiles.userId, userId),
        eq(schema.userPreferenceProfiles.isActive, true),
      ),
    )
    .limit(1);
  return validateComparisonWeights(
    (profile?.weights ?? { price: 5, size: 5, location: 5 }) as Record<string, unknown>,
  );
}

function validateText(value: string | null | undefined, max: number, code: string) {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed.length > max) throw new BuyerWorkspaceError(code, code, 400);
  return trimmed || null;
}

function calculateExpiry(input: CreateComparisonShareInput, now: Date): Date {
  try {
    return calculateComparisonShareExpiry(input, now);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invalid_expiry';
    throw new BuyerWorkspaceError(code, code, 400);
  }
}

async function createComparisonShareWithDb(
  db: Db,
  userId: string,
  input: CreateComparisonShareInput,
) {
  const listingIds = [...new Set(input.listingIds)];
  if (
    listingIds.length !== input.listingIds.length ||
    listingIds.length < COMPARISON_MIN_ITEMS ||
    listingIds.length > COMPARISON_MAX_ITEMS
  ) {
    throw new BuyerWorkspaceError('comparison_size', 'comparison_size', 400);
  }

  const publicTitle = validateText(input.publicTitle, 120, 'public_title_too_long');
  const publicDescription = validateText(
    input.publicDescription,
    500,
    'public_description_too_long',
  );
  const now = new Date();
  const expiresAt = calculateExpiry(input, now);

  if (input.comparisonSetId) {
    const [ownedSet] = await db
      .select({ id: schema.comparisonSets.id })
      .from(schema.comparisonSets)
      .where(
        and(
          eq(schema.comparisonSets.id, input.comparisonSetId),
          eq(schema.comparisonSets.userId, userId),
        ),
      )
      .limit(1);
    if (!ownedSet) throw new BuyerWorkspaceError('comparison_not_found', 'not_found', 404);
  }

  const listings = await db
    .select()
    .from(schema.propertyListings)
    .where(inArray(schema.propertyListings.id, listingIds));
  if (listings.length !== listingIds.length) {
    throw new BuyerWorkspaceError('listing_not_found', 'listing_not_found', 404);
  }
  const ordered = listingIds.map((id) => listings.find((listing) => listing.id === id)!);

  const includeWeights = input.includeWeights ?? false;
  const includeScores = input.includeScores ?? false;
  const weights = await resolveWeights(db, userId, { ...input, includeWeights, includeScores });
  const scoreSnapshot =
    includeScores && weights ? scoreComparisonSet(ordered.map(listingToFacts), weights) : undefined;
  const fields: PublicComparisonFieldKey[] = [
    ...DEFAULT_PUBLIC_FIELDS,
    ...(includeScores
      ? (['frozen_score', 'frozen_score_explanation'] as PublicComparisonFieldKey[])
      : []),
  ];
  const token = mintShareToken();
  const manifest: ShareManifest = {
    schemaVersion: PHASE4C_SCHEMA_VERSION,
    fields,
    listingIds,
    includeWeights,
    includeScores,
    scoreModelVersion: includeScores ? SCORE_MODEL_VERSION : null,
    ...(scoreSnapshot ? { scoreSnapshot } : {}),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const [share] = await db
    .insert(schema.comparisonShares)
    .values({
      userId,
      comparisonSetId: input.comparisonSetId ?? null,
      tokenHash: hashShareToken(token),
      publicTitle,
      publicDescription,
      expiresAt,
      manifest,
      includeWeights,
      includeScores,
      scoreModelVersion: includeScores ? SCORE_MODEL_VERSION : null,
      weightSnapshot: weights,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!share) throw new BuyerWorkspaceError('share_create_failed', 'share_create_failed', 500);

  await db.insert(schema.comparisonShareItems).values(
    ordered.map((listing, position) => ({
      shareId: share.id,
      listingId: listing.id,
      position,
      physicalPropertyId: listing.physicalPropertyId,
    })),
  );

  return {
    share: ownerShare(share, listingIds),
    plaintextToken: token,
    publicPath: `/shared-comparison/${token}`,
  };
}

export async function createComparisonShare(
  db: Db,
  userId: string,
  input: CreateComparisonShareInput,
) {
  return db.transaction((tx) => createComparisonShareWithDb(tx as unknown as Db, userId, input));
}

export async function listComparisonShares(db: Db, userId: string) {
  const shares = await db
    .select()
    .from(schema.comparisonShares)
    .where(eq(schema.comparisonShares.userId, userId))
    .orderBy(desc(schema.comparisonShares.createdAt));
  const result = [];
  for (const share of shares) {
    const items = await db
      .select({ listingId: schema.comparisonShareItems.listingId })
      .from(schema.comparisonShareItems)
      .where(eq(schema.comparisonShareItems.shareId, share.id))
      .orderBy(asc(schema.comparisonShareItems.position));
    result.push(ownerShare(share, items.map((item) => item.listingId).filter(Boolean) as string[]));
  }
  return result;
}

export async function getComparisonShareForOwner(db: Db, userId: string, id: string) {
  const [share] = await db
    .select()
    .from(schema.comparisonShares)
    .where(and(eq(schema.comparisonShares.id, id), eq(schema.comparisonShares.userId, userId)))
    .limit(1);
  if (!share) throw new BuyerWorkspaceError('not_found', 'not_found', 404);
  const items = await db
    .select()
    .from(schema.comparisonShareItems)
    .where(eq(schema.comparisonShareItems.shareId, id))
    .orderBy(asc(schema.comparisonShareItems.position));
  return ownerShare(share, items.map((item) => item.listingId).filter(Boolean) as string[]);
}

export async function revokeComparisonShare(db: Db, userId: string, id: string) {
  const [share] = await db
    .update(schema.comparisonShares)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.comparisonShares.id, id), eq(schema.comparisonShares.userId, userId)))
    .returning();
  if (!share) throw new BuyerWorkspaceError('not_found', 'not_found', 404);
  return ownerShare(share);
}

export async function replaceComparisonShare(
  db: Db,
  userId: string,
  id: string,
  input: Partial<CreateComparisonShareInput> = {},
) {
  return db.transaction(async (tx) => {
    const transactionDb = tx as unknown as Db;
    const [oldShare] = await transactionDb
      .select()
      .from(schema.comparisonShares)
      .where(and(eq(schema.comparisonShares.id, id), eq(schema.comparisonShares.userId, userId)))
      .limit(1);
    if (!oldShare) throw new BuyerWorkspaceError('not_found', 'not_found', 404);
    if (oldShare.revokedAt) throw new BuyerWorkspaceError('share_revoked', 'share_revoked', 409);

    const items = await transactionDb
      .select()
      .from(schema.comparisonShareItems)
      .where(eq(schema.comparisonShareItems.shareId, id))
      .orderBy(asc(schema.comparisonShareItems.position));
    const originalManifest = manifestOf(oldShare);
    const listingIds = items.map(
      (item, position) => item.listingId ?? originalManifest.listingIds[position]!,
    );
    const replacement = await createComparisonShareWithDb(transactionDb, userId, {
      publicTitle: oldShare.publicTitle,
      publicDescription: oldShare.publicDescription,
      includeWeights: oldShare.includeWeights,
      includeScores: oldShare.includeScores,
      comparisonSetId: oldShare.comparisonSetId,
      weights: (oldShare.weightSnapshot as ComparisonWeights | null) ?? undefined,
      ...input,
      listingIds: input.listingIds ?? listingIds,
    });
    await transactionDb
      .update(schema.comparisonShares)
      .set({
        revokedAt: new Date(),
        replacedByShareId: replacement.share.id,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.comparisonShares.id, id), eq(schema.comparisonShares.userId, userId)));
    return replacement;
  });
}

function warningState(listing: Listing, item: ShareItem): PublicListingWarningCode[] {
  const warnings: PublicListingWarningCode[] = [];
  if (listing.operationalStatus === 'reserved') warnings.push('status_reserved');
  if (listing.operationalStatus === 'under_offer') warnings.push('status_under_offer');
  if (listing.operationalStatus === 'withdrawn') warnings.push('listing_withdrawn');
  if (listing.operationalStatus === 'stale') warnings.push('listing_stale');
  if (!listing.isPublicBrowseable) warnings.push('not_publicly_browseable');
  if (item.physicalPropertyId && item.physicalPropertyId !== listing.physicalPropertyId) {
    warnings.push('physical_property_merged');
  }
  return warnings;
}

export function toPublicComparisonDto(
  share: Share,
  items: ShareItem[],
  liveListings: Listing[],
): PublicComparisonDto {
  const manifest = manifestOf(share);
  const listingById = new Map(liveListings.map((listing) => [listing.id, listing]));
  const scoreById = new Map(
    (manifest.scoreSnapshot ?? []).map((score) => [score.listingId, score]),
  );
  const rows: PublicComparisonListingRow[] = items.map((item, position) => {
    const frozenListingId = manifest.listingIds[position] ?? item.listingId ?? '';
    const listing = item.listingId ? listingById.get(item.listingId) : undefined;
    if (!listing) {
      return {
        listingId: frozenListingId,
        position: item.position,
        slotStatus: 'unavailable',
        warnings: ['listing_deleted'],
        cells: {},
        ...(share.includeScores ? { frozenScore: scoreById.get(frozenListingId) ?? null } : {}),
      };
    }

    const warnings = warningState(listing, item);
    const unavailable = listing.operationalStatus === 'withdrawn' || !listing.isPublicBrowseable;
    const cells: Partial<Record<PublicComparisonFieldKey, PublicCell>> = {
      title: availableCell(listing.title),
      asking_price: availableCell(toNumber(listing.priceAmount)),
      price_per_sqm: availableCell(toNumber(listing.pricePerSqm)),
      location_precision: availableCell(listing.areaLabel),
      bedrooms: availableCell(listing.bedrooms),
      bathrooms: availableCell(listing.bathrooms),
      built_area: availableCell(toNumber(listing.builtAreaSqm)),
      usable_area: unavailableCell(),
      authorized_images: { status: 'available', value: [] },
      public_features: unavailableCell(),
      environment: availableCell(listing.environmentType),
      transport_proximity: availableCell({
        nearestTransit: listing.nearestTransit,
        commuteMin: listing.commuteMin,
        beachProximity: listing.beachProximity,
        parkProximity: listing.parkProximity,
      }),
      freshness: availableCell(
        listing.lastConfirmedAvailableAt?.toISOString() ?? listing.freshnessMethod,
      ),
      listing_status: availableCell(listing.operationalStatus),
      source_attribution: availableCell(listing.portalName),
      source_link: availableCell(listing.sourceUrl),
    };
    const frozenScore = scoreById.get(listing.id) ?? null;
    if (share.includeScores) {
      cells.frozen_score = availableCell(frozenScore?.score ?? null);
      cells.frozen_score_explanation = availableCell(frozenScore?.explanation ?? null);
    }

    return {
      listingId: listing.id,
      position: item.position,
      slotStatus: unavailable ? 'unavailable' : warnings.length ? 'warning' : 'available',
      warnings,
      cells: Object.fromEntries(
        Object.entries(cells).filter(([key]) =>
          manifest.fields.includes(key as PublicComparisonFieldKey),
        ),
      ) as Partial<Record<PublicComparisonFieldKey, PublicCell>>,
      ...(share.includeScores ? { frozenScore } : {}),
    };
  });

  return {
    schemaVersion: PHASE4C_SCHEMA_VERSION,
    publicTitle: share.publicTitle,
    publicDescription: share.publicDescription,
    createdAt: share.createdAt.toISOString(),
    expiresAt: share.expiresAt.toISOString(),
    includeScores: share.includeScores,
    includeWeights: share.includeWeights,
    scoreModelVersion: share.includeScores ? SCORE_MODEL_VERSION : null,
    disclaimerKey: share.includeScores ? 'suitability_not_valuation' : null,
    fields: manifest.fields,
    listings: rows,
    ...(share.includeWeights
      ? { weightSnapshot: share.weightSnapshot as ComparisonWeights | null }
      : {}),
  };
}

export async function recordShareAccess(
  db: Db,
  shareId: string,
  result: AccessResult,
  uaCategory?: UaCategory,
) {
  const now = new Date();
  await db.transaction(async (tx) => {
    if (result === 'ok') {
      await tx
        .update(schema.comparisonShares)
        .set({
          accessCount: sql`${schema.comparisonShares.accessCount} + 1`,
          lastAccessedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.comparisonShares.id, shareId));
    }
    await tx.insert(schema.comparisonShareAccessEvents).values({
      shareId,
      result,
      uaCategory: uaCategory ?? null,
      accessedAt: now,
    });
  });
}

export async function resolvePublicComparisonShare(
  db: Db,
  token: string,
  opts: { uaCategory?: UaCategory } = {},
): Promise<{ status: 'ok'; dto: PublicComparisonDto } | { status: 'unavailable' }> {
  const [share] = await db
    .select()
    .from(schema.comparisonShares)
    .where(eq(schema.comparisonShares.tokenHash, hashShareToken(token)))
    .limit(1);
  if (!share) return { status: 'unavailable' };

  if (share.revokedAt) {
    await recordShareAccess(db, share.id, 'revoked', opts.uaCategory);
    return { status: 'unavailable' };
  }
  if (new Date() >= share.expiresAt) {
    await recordShareAccess(db, share.id, 'expired', opts.uaCategory);
    return { status: 'unavailable' };
  }

  const items = await db
    .select()
    .from(schema.comparisonShareItems)
    .where(eq(schema.comparisonShareItems.shareId, share.id))
    .orderBy(asc(schema.comparisonShareItems.position));
  const listingIds = items.map((item) => item.listingId).filter(Boolean) as string[];
  const listings =
    listingIds.length === 0
      ? []
      : await db
          .select()
          .from(schema.propertyListings)
          .where(inArray(schema.propertyListings.id, listingIds));
  const dto = toPublicComparisonDto(share, items, listings);
  await recordShareAccess(db, share.id, 'ok', opts.uaCategory);
  return { status: 'ok', dto };
}
