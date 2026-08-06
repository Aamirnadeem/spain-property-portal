import type { ComparisonWeights, SuitabilityScoreResult } from './comparison-scoring';
import { SCORE_MODEL_VERSION } from './comparison-scoring';

export const PHASE4C_SCHEMA_VERSION = 'phase4c.v1' as const;
export const MAX_EXPIRY_DAYS = 90;
export const DEFAULT_EXPIRY_DAYS = 7;

export const DEFAULT_PUBLIC_FIELDS = [
  'title',
  'asking_price',
  'price_per_sqm',
  'location_precision',
  'bedrooms',
  'bathrooms',
  'built_area',
  'usable_area',
  'authorized_images',
  'public_features',
  'environment',
  'transport_proximity',
  'freshness',
  'listing_status',
  'source_attribution',
  'source_link',
] as const;

export type PublicComparisonFieldKey =
  (typeof DEFAULT_PUBLIC_FIELDS)[number] | 'frozen_score' | 'frozen_score_explanation';

export type PublicListingWarningCode =
  | 'price_changed'
  | 'status_reserved'
  | 'status_under_offer'
  | 'listing_withdrawn'
  | 'listing_stale'
  | 'listing_deleted'
  | 'image_authorization_lost'
  | 'physical_property_merged'
  | 'listing_replaced'
  | 'not_publicly_browseable';

export type PublicCell =
  | { status: 'available'; value: unknown }
  | { status: 'unavailable'; reason: 'not_in_source' | 'not_applicable' | 'not_authorized' };

export interface FrozenScoreSnapshot extends SuitabilityScoreResult {}

export interface PublicComparisonListingRow {
  listingId: string;
  position: number;
  slotStatus: 'available' | 'warning' | 'unavailable';
  warnings: PublicListingWarningCode[];
  cells: Partial<Record<PublicComparisonFieldKey, PublicCell>>;
  frozenScore?: FrozenScoreSnapshot | null;
}

export interface PublicComparisonDto {
  schemaVersion: typeof PHASE4C_SCHEMA_VERSION;
  publicTitle: string | null;
  publicDescription: string | null;
  createdAt: string;
  expiresAt: string;
  includeScores: boolean;
  includeWeights: boolean;
  scoreModelVersion: typeof SCORE_MODEL_VERSION | null;
  disclaimerKey: 'suitability_not_valuation' | null;
  fields: PublicComparisonFieldKey[];
  listings: PublicComparisonListingRow[];
  weightSnapshot?: ComparisonWeights | null;
}

export type ComparisonShareExpiryPreset = '24h' | '7d' | '30d' | 'custom';

export function calculateComparisonShareExpiry(
  input: {
    expiresAt?: Date | string;
    expiryPreset?: ComparisonShareExpiryPreset;
    customExpiresAt?: string;
  },
  now = new Date(),
): Date {
  const preset = input.expiryPreset;
  let expiresAt: Date;

  if (input.expiresAt != null) {
    expiresAt = new Date(input.expiresAt);
  } else if (preset === 'custom') {
    if (!input.customExpiresAt) throw new Error('custom_expiry_required');
    expiresAt = new Date(input.customExpiresAt);
  } else {
    const days = preset === '24h' ? 1 : preset === '30d' ? 30 : DEFAULT_EXPIRY_DAYS;
    expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
    throw new Error('invalid_expiry');
  }
  const maximum = new Date(now.getTime() + MAX_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  if (expiresAt > maximum) throw new Error('expiry_too_far');
  return expiresAt;
}
