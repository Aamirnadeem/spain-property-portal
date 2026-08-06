import { z } from 'zod';

/**
 * Sync SHA-256 hex digest that works in Node and Next client bundles.
 * Avoids `node:crypto` (Webpack UnhandledSchemeError on client imports of `@spain/domain`).
 */
function sha256Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const hash = sha256Bytes(bytes);
  return Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compact SHA-256 (FIPS 180-4) for short canonical JSON strings. */
function sha256Bytes(data: Uint8Array): Uint8Array {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const l = data.length;
  const bitLenHi = Math.floor((l * 8) / 0x100000000);
  const bitLenLo = (l * 8) >>> 0;
  const withOne = l + 1;
  const paddedLen = (withOne + 8 + 63) & ~63;
  const buf = new Uint8Array(paddedLen);
  buf.set(data);
  buf[l] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(paddedLen - 8, bitLenHi, false);
  view.setUint32(paddedLen - 4, bitLenLo, false);

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let i = 0; i < paddedLen; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = view.getUint32(i + j * 4, false);
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15]!, 7) ^ rotr(w[j - 15]!, 18) ^ (w[j - 15]! >>> 3);
      const s1 = rotr(w[j - 2]!, 17) ^ rotr(w[j - 2]!, 19) ^ (w[j - 2]! >>> 10);
      w[j] = (w[j - 16]! + s0 + w[j - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e!, 6) ^ rotr(e!, 11) ^ rotr(e!, 25);
      const ch = (e! & f!) ^ (~e! & g!);
      const temp1 = (h! + S1 + ch + K[j]! + w[j]!) >>> 0;
      const S0 = rotr(a!, 2) ^ rotr(a!, 13) ^ rotr(a!, 22);
      const maj = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d! + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0]! + a!) >>> 0;
    H[1] = (H[1]! + b!) >>> 0;
    H[2] = (H[2]! + c!) >>> 0;
    H[3] = (H[3]! + d!) >>> 0;
    H[4] = (H[4]! + e!) >>> 0;
    H[5] = (H[5]! + f!) >>> 0;
    H[6] = (H[6]! + g!) >>> 0;
    H[7] = (H[7]! + h!) >>> 0;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, H[i]!, false);
  return out;
}

export const SAVED_SEARCH_CRITERIA_VERSION = 'phase4b.v1' as const;

export const OFF_PLAN_OPTIONS = ['any', 'only', 'exclude'] as const;
export const FRESHNESS_OPTIONS = ['any', 'current_only'] as const;

export const DEFAULT_ALERT_TYPES = ['new_match', 'price_reduction'] as const;

export const ALERT_TYPE_OPTIONS = [
  'new_match',
  'price_reduction',
  'price_increase',
  'status_reserved',
  'status_under_offer',
  'listing_withdrawn',
  'listing_stale',
  'saved_property_updated',
] as const;

export type AlertType = (typeof ALERT_TYPE_OPTIONS)[number];

const optionalTrimmedString = z.string().trim().min(1).optional();
const optionalNonNegativeNumber = z.number().nonnegative().finite().optional();
const optionalNonNegativeInt = z.number().int().nonnegative().optional();

/** Persisted saved-search envelope (no page/pageSize/view). */
export const savedSearchCriteriaV1Schema = z
  .object({
    criteriaVersion: z
      .literal(SAVED_SEARCH_CRITERIA_VERSION)
      .default(SAVED_SEARCH_CRITERIA_VERSION),
    q: optionalTrimmedString,
    autonomousCommunity: optionalTrimmedString,
    province: optionalTrimmedString,
    municipality: optionalTrimmedString,
    districtOrLocality: optionalTrimmedString,
    area: optionalTrimmedString,
    minPrice: optionalNonNegativeNumber,
    maxPrice: optionalNonNegativeNumber,
    minBedrooms: optionalNonNegativeInt,
    maxBedrooms: optionalNonNegativeInt,
    minBathrooms: optionalNonNegativeInt,
    maxBathrooms: optionalNonNegativeInt,
    minSizeSqm: optionalNonNegativeNumber,
    maxSizeSqm: optionalNonNegativeNumber,
    propertyType: optionalTrimmedString,
    environmentType: z.enum(['city_center', 'coastal', 'hillside']).optional(),
    listingStatuses: z.array(z.string().trim().min(1)).optional(),
    offPlan: z.enum(OFF_PLAN_OPTIONS).optional(),
    freshness: z.enum(FRESHNESS_OPTIONS).optional(),
    sort: z.enum(['price_asc', 'price_desc', 'size_desc', 'newest']).default('newest'),
  })
  .superRefine((value, ctx) => {
    if (
      value.minPrice !== undefined &&
      value.maxPrice !== undefined &&
      value.minPrice > value.maxPrice
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minPrice must not exceed maxPrice',
        path: ['minPrice'],
      });
    }
    if (
      value.minBedrooms !== undefined &&
      value.maxBedrooms !== undefined &&
      value.minBedrooms > value.maxBedrooms
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minBedrooms must not exceed maxBedrooms',
        path: ['minBedrooms'],
      });
    }
    if (
      value.minBathrooms !== undefined &&
      value.maxBathrooms !== undefined &&
      value.minBathrooms > value.maxBathrooms
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minBathrooms must not exceed maxBathrooms',
        path: ['minBathrooms'],
      });
    }
    if (
      value.minSizeSqm !== undefined &&
      value.maxSizeSqm !== undefined &&
      value.minSizeSqm > value.maxSizeSqm
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minSizeSqm must not exceed maxSizeSqm',
        path: ['minSizeSqm'],
      });
    }
  });

export type SavedSearchCriteriaV1 = z.infer<typeof savedSearchCriteriaV1Schema>;

export const MAX_SAVED_SEARCHES_PER_USER = 25;
export const MAX_GUEST_SAVED_SEARCHES = 5;
export const MAX_BROWSING_HISTORY = 50;
export const DEFAULT_HISTORY_RETENTION_DAYS = 90;

function stripEmpty<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const value = obj[key];
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (key === 'offPlan' && value === 'any') continue;
    if (key === 'freshness' && value === 'any') continue;
    out[key] = value;
  }
  return out;
}

/** Normalize criteria for storage and hashing. Strips pagination/view if present. */
export function normalizeSavedSearchCriteria(input: unknown): SavedSearchCriteriaV1 {
  const raw =
    typeof input === 'object' && input !== null ? { ...(input as Record<string, unknown>) } : {};
  delete raw.page;
  delete raw.pageSize;
  delete raw.view;
  if (!raw.criteriaVersion) raw.criteriaVersion = SAVED_SEARCH_CRITERIA_VERSION;
  if (Array.isArray(raw.listingStatuses)) {
    raw.listingStatuses = [...(raw.listingStatuses as string[])].map(String).sort();
  }
  const parsed = savedSearchCriteriaV1Schema.parse(raw);
  return parsed;
}

export function hashSavedSearchCriteria(criteria: SavedSearchCriteriaV1): string {
  const forHash = stripEmpty({
    ...criteria,
    criteriaVersion: SAVED_SEARCH_CRITERIA_VERSION,
  });
  const canonical = JSON.stringify(forHash);
  return sha256Hex(canonical);
}

export function indexedColumnsFromCriteria(criteria: SavedSearchCriteriaV1): {
  idxMinPrice: string | null;
  idxMaxPrice: string | null;
  idxMinBedrooms: number | null;
  idxMunicipality: string | null;
  idxProvince: string | null;
  idxPropertyType: string | null;
  idxOffPlan: string | null;
  sort: string;
} {
  return {
    idxMinPrice: criteria.minPrice != null ? String(criteria.minPrice) : null,
    idxMaxPrice: criteria.maxPrice != null ? String(criteria.maxPrice) : null,
    idxMinBedrooms: criteria.minBedrooms ?? null,
    idxMunicipality: criteria.municipality ?? criteria.area ?? null,
    idxProvince: criteria.province ?? null,
    idxPropertyType: criteria.propertyType ?? null,
    idxOffPlan: criteria.offPlan && criteria.offPlan !== 'any' ? criteria.offPlan : null,
    sort: criteria.sort,
  };
}

export type ListingMatchFacts = {
  id: string;
  priceAmount: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  builtAreaSqm: number | null;
  areaLabel: string | null;
  addressText: string | null;
  environmentType: string | null;
  propertyTypeKey: string | null;
  operationalStatus: string;
  isPublicBrowseable: boolean;
  isLegacySnapshot: boolean;
  title?: string | null;
};

export function matchesListing(
  criteria: SavedSearchCriteriaV1,
  listing: ListingMatchFacts,
  options?: { allowLegacy?: boolean },
): boolean {
  if (!listing.isPublicBrowseable) return false;
  if (listing.isLegacySnapshot && !options?.allowLegacy) return false;
  if (listing.operationalStatus === 'legacy_snapshot' && !options?.allowLegacy) return false;

  if (criteria.minPrice != null) {
    if (listing.priceAmount == null || listing.priceAmount < criteria.minPrice) return false;
  }
  if (criteria.maxPrice != null) {
    if (listing.priceAmount == null || listing.priceAmount > criteria.maxPrice) return false;
  }
  if (criteria.minBedrooms != null) {
    if (listing.bedrooms == null || listing.bedrooms < criteria.minBedrooms) return false;
  }
  if (criteria.maxBedrooms != null) {
    if (listing.bedrooms == null || listing.bedrooms > criteria.maxBedrooms) return false;
  }
  if (criteria.minBathrooms != null) {
    if (listing.bathrooms == null || listing.bathrooms < criteria.minBathrooms) return false;
  }
  if (criteria.maxBathrooms != null) {
    if (listing.bathrooms == null || listing.bathrooms > criteria.maxBathrooms) return false;
  }
  if (criteria.minSizeSqm != null) {
    if (listing.builtAreaSqm == null || listing.builtAreaSqm < criteria.minSizeSqm) return false;
  }
  if (criteria.maxSizeSqm != null) {
    if (listing.builtAreaSqm == null || listing.builtAreaSqm > criteria.maxSizeSqm) return false;
  }
  if (criteria.environmentType) {
    if (listing.environmentType !== criteria.environmentType) return false;
  }
  if (criteria.propertyType) {
    if (
      !listing.propertyTypeKey ||
      listing.propertyTypeKey.toLowerCase() !== criteria.propertyType.toLowerCase()
    ) {
      return false;
    }
  }
  if (criteria.listingStatuses && criteria.listingStatuses.length > 0) {
    if (!criteria.listingStatuses.includes(listing.operationalStatus)) return false;
  }
  if (criteria.freshness === 'current_only') {
    if (['stale', 'withdrawn', 'sold', 'rejected'].includes(listing.operationalStatus)) {
      return false;
    }
  }
  // offPlan: inventory has no off_plan column — fail closed when filter is only/exclude
  if (criteria.offPlan === 'only' || criteria.offPlan === 'exclude') {
    return false;
  }

  const geoNeedles = [
    criteria.autonomousCommunity,
    criteria.province,
    criteria.municipality,
    criteria.districtOrLocality,
    criteria.area,
  ].filter(Boolean) as string[];
  if (geoNeedles.length > 0) {
    const hay = `${listing.areaLabel ?? ''} ${listing.addressText ?? ''}`.toLowerCase();
    if (!geoNeedles.every((n) => hay.includes(n.toLowerCase()))) return false;
  }

  if (criteria.q) {
    const hay =
      `${listing.title ?? ''} ${listing.areaLabel ?? ''} ${listing.addressText ?? ''}`.toLowerCase();
    if (!hay.includes(criteria.q.toLowerCase())) return false;
  }

  return true;
}

export function notificationDedupeKey(parts: {
  userId: string;
  type: string;
  listingId?: string | null;
  savedSearchId?: string | null;
  sourceEventId: string;
}): string {
  const material = [
    parts.userId,
    parts.type,
    parts.listingId ?? parts.savedSearchId ?? '',
    parts.sourceEventId,
  ].join('|');
  return sha256Hex(material);
}

export function resolveSavedSearchName(desired: string, existingNames: Set<string>): string {
  const base = desired.trim() || 'Saved search';
  if (!existingNames.has(base.toLowerCase())) return base;
  const prefixed = `Guest — ${base}`;
  if (!existingNames.has(prefixed.toLowerCase())) return prefixed;
  let i = 2;
  while (existingNames.has(`Guest — ${base} (${i})`.toLowerCase())) i += 1;
  return `Guest — ${base} (${i})`;
}

export function defaultAlertTypesOnEnable(): string[] {
  return [...DEFAULT_ALERT_TYPES];
}
