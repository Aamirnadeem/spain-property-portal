import { and, asc, count, desc, eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  computePricePerSqm,
  legacyFreshnessWarning,
  type ListingCardDto,
  type ListingDetailDto,
} from '@spain/domain';
import type { PropertySearchCriteria } from '@spain/search';
import * as schema from '../schema/index';

type Db = PostgresJsDatabase<typeof schema>;

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapCard(row: typeof schema.propertyListings.$inferSelect): ListingCardDto {
  const price = toNumber(row.priceAmount);
  const size = toNumber(row.builtAreaSqm);
  return {
    id: row.id,
    title: row.title,
    priceAmount: price,
    currency: row.currency,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    builtAreaSqm: size,
    pricePerSqm: toNumber(row.pricePerSqm) ?? computePricePerSqm(price, size),
    areaLabel: row.areaLabel,
    environmentType: row.environmentType,
    propertyTypeKey: row.propertyTypeKey,
    isLegacySnapshot: row.isLegacySnapshot,
    freshnessMethod: row.freshnessMethod,
    operationalStatus: row.operationalStatus,
    lastConfirmedAvailableAt: row.lastConfirmedAvailableAt?.toISOString() ?? null,
    hasAuthorizedImage: false,
    thumbnailUrl: null,
  };
}

function buildFilters(criteria: PropertySearchCriteria): SQL[] {
  const filters: SQL[] = [eq(schema.propertyListings.isPublicBrowseable, true)];
  if (criteria.minPrice != null) {
    filters.push(gte(schema.propertyListings.priceAmount, String(criteria.minPrice)));
  }
  if (criteria.maxPrice != null) {
    filters.push(lte(schema.propertyListings.priceAmount, String(criteria.maxPrice)));
  }
  if (criteria.minBedrooms != null) {
    filters.push(gte(schema.propertyListings.bedrooms, criteria.minBedrooms));
  }
  if (criteria.maxBedrooms != null) {
    filters.push(lte(schema.propertyListings.bedrooms, criteria.maxBedrooms));
  }
  if (criteria.minSizeSqm != null) {
    filters.push(gte(schema.propertyListings.builtAreaSqm, String(criteria.minSizeSqm)));
  }
  if (criteria.maxSizeSqm != null) {
    filters.push(lte(schema.propertyListings.builtAreaSqm, String(criteria.maxSizeSqm)));
  }
  if (criteria.area) {
    filters.push(ilike(schema.propertyListings.areaLabel, criteria.area));
  }
  if (criteria.environmentType) {
    filters.push(eq(schema.propertyListings.environmentType, criteria.environmentType));
  }
  if (criteria.q) {
    const pattern = `%${criteria.q}%`;
    filters.push(
      or(
        ilike(schema.propertyListings.title, pattern),
        ilike(schema.propertyListings.searchDocument, pattern),
        ilike(schema.propertyListings.areaLabel, pattern),
        ilike(schema.propertyListings.addressText, pattern),
      )!,
    );
  }
  return filters;
}

function orderBy(criteria: PropertySearchCriteria) {
  switch (criteria.sort) {
    case 'price_asc':
      return asc(schema.propertyListings.priceAmount);
    case 'price_desc':
      return desc(schema.propertyListings.priceAmount);
    case 'size_desc':
      return desc(schema.propertyListings.builtAreaSqm);
    default:
      return desc(schema.propertyListings.importedAt);
  }
}

export async function searchProperties(
  db: Db,
  criteria: PropertySearchCriteria,
): Promise<{ items: ListingCardDto[]; total: number; page: number; pageSize: number }> {
  const where = and(...buildFilters(criteria));
  const [totalRow] = await db.select({ value: count() }).from(schema.propertyListings).where(where);
  const total = Number(totalRow?.value ?? 0);
  const offset = (criteria.page - 1) * criteria.pageSize;
  const rows = await db
    .select()
    .from(schema.propertyListings)
    .where(where)
    .orderBy(orderBy(criteria))
    .limit(criteria.pageSize)
    .offset(offset);
  return {
    items: rows.map(mapCard),
    total,
    page: criteria.page,
    pageSize: criteria.pageSize,
  };
}

export async function getPropertyDetails(
  db: Db,
  listingId: string,
): Promise<ListingDetailDto | null> {
  const [row] = await db
    .select()
    .from(schema.propertyListings)
    .where(
      and(
        eq(schema.propertyListings.id, listingId),
        eq(schema.propertyListings.isPublicBrowseable, true),
      ),
    )
    .limit(1);
  if (!row) return null;

  const media = await db
    .select()
    .from(schema.listingMedia)
    .where(eq(schema.listingMedia.listingId, listingId));
  const hasAuthorizedImage = media.some((m) => !m.isPlaceholder && m.mediaAssetId);

  return {
    ...mapCard(row),
    hasAuthorizedImage,
    description: row.description,
    addressText: row.addressText,
    nearestTransit: row.nearestTransit,
    commuteMin: row.commuteMin,
    beachProximity: row.beachProximity,
    parkProximity: row.parkProximity,
    sourceUrl: row.sourceUrl,
    portalName: row.portalName,
    importedAt: row.importedAt?.toISOString() ?? null,
    features: [],
    freshnessWarning: row.isLegacySnapshot
      ? legacyFreshnessWarning()
      : 'Freshness has not been confirmed.',
    sourceAttribution: row.portalName
      ? `Source: ${row.portalName} (snapshot)`
      : 'Source: legacy snapshot',
    mediaUrls: [],
  };
}

export async function listFavourites(db: Db, userId: string): Promise<ListingCardDto[]> {
  const rows = await db
    .select({ listing: schema.propertyListings })
    .from(schema.favourites)
    .innerJoin(schema.propertyListings, eq(schema.favourites.listingId, schema.propertyListings.id))
    .where(eq(schema.favourites.userId, userId))
    .orderBy(desc(schema.favourites.createdAt));
  return rows.map((r) => mapCard(r.listing));
}

export async function addFavourite(db: Db, userId: string, listingId: string): Promise<void> {
  await db.insert(schema.favourites).values({ userId, listingId }).onConflictDoNothing();
}

export async function removeFavourite(db: Db, userId: string, listingId: string): Promise<void> {
  await db
    .delete(schema.favourites)
    .where(and(eq(schema.favourites.userId, userId), eq(schema.favourites.listingId, listingId)));
}

export async function mergeGuestFavouritesIntoUser(
  db: Db,
  userId: string,
  guestListingIds: string[],
): Promise<string[]> {
  await db.transaction(async (tx) => {
    for (const listingId of guestListingIds) {
      await tx.insert(schema.favourites).values({ userId, listingId }).onConflictDoNothing();
    }
  });
  const listed = await listFavourites(db, userId);
  return listed.map((l) => l.id);
}
