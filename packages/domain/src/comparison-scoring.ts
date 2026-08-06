/**
 * Phase 4A explainable comparison scoring (score-model version phase4a.v1).
 * Preference fit only — never a valuation or investment recommendation.
 */

export const SCORE_MODEL_VERSION = 'phase4a.v1' as const;

export const COMPARISON_WEIGHT_KEYS = [
  'price',
  'location',
  'commute',
  'quiet_surroundings',
  'coastal_access',
  'outdoor_space',
  'size',
  'condition',
  'energy_efficiency',
  'accessibility',
  'investment_potential',
] as const;

export type ComparisonWeightKey = (typeof COMPARISON_WEIGHT_KEYS)[number];

export type ComparisonWeights = Partial<Record<ComparisonWeightKey, number>>;

/** Listing facts used for scoring — null/undefined means unavailable. */
export interface ComparisonListingFacts {
  listingId: string;
  priceAmount: number | null;
  pricePerSqm: number | null;
  builtAreaSqm: number | null;
  usableAreaSqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaLabel: string | null;
  environmentType: string | null;
  commuteMin: number | null;
  beachProximity: string | null;
  parkProximity: string | null;
  condition: string | null;
  energyRating: string | null;
  hasOutdoorSpace: boolean | null;
  accessibilityFeature: boolean | null;
  lastConfirmedAvailableAt: string | null;
}

export type CompareCell<T> =
  | { status: 'available'; value: T }
  | { status: 'unavailable'; reason: 'not_in_source' | 'not_applicable' };

export interface ScoreFactor {
  key: ComparisonWeightKey;
  weight: number;
  factScore: number;
  contribution: number;
  sourceValue: unknown;
}

export interface SuitabilityScoreResult {
  listingId: string;
  score: number | null;
  factors: ScoreFactor[];
  missing: ComparisonWeightKey[];
  reason?: 'no_scorable_inputs';
  scoreModelVersion: typeof SCORE_MODEL_VERSION;
  explanation: {
    formula: string;
    weightSum: number;
    weightedFactSum: number;
    disclaimerKey: 'suitability_not_valuation';
  };
}

export class InvalidWeightsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWeightsError';
  }
}

/** Validate weights: integers 0–10 only; unknown keys rejected. */
export function validateComparisonWeights(input: Record<string, unknown>): ComparisonWeights {
  const out: ComparisonWeights = {};
  for (const [rawKey, rawVal] of Object.entries(input)) {
    if (!(COMPARISON_WEIGHT_KEYS as readonly string[]).includes(rawKey)) {
      throw new InvalidWeightsError(`unknown_weight_key:${rawKey}`);
    }
    const key = rawKey as ComparisonWeightKey;
    if (typeof rawVal !== 'number' || !Number.isFinite(rawVal) || !Number.isInteger(rawVal)) {
      throw new InvalidWeightsError(`invalid_weight_value:${key}`);
    }
    if (rawVal < 0 || rawVal > 10) {
      throw new InvalidWeightsError(`weight_out_of_range:${key}`);
    }
    out[key] = rawVal;
  }
  return out;
}

function invertNormalize(value: number, min: number, max: number): number {
  if (max <= min) return 1;
  return Math.max(0, Math.min(1, (max - value) / (max - min)));
}

function normalizeAsc(value: number, min: number, max: number): number {
  if (max <= min) return 1;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function cohortValues(
  listings: ComparisonListingFacts[],
  pick: (f: ComparisonListingFacts) => number | null,
): number[] {
  return listings.map(pick).filter((v): v is number => v != null && Number.isFinite(v));
}

/**
 * Score one listing against weights using only available facts within the comparison set.
 * Missing criteria are listed and excluded from the denominator.
 */
export function scoreListingAgainstWeights(
  listing: ComparisonListingFacts,
  weights: ComparisonWeights,
  cohort: ComparisonListingFacts[],
): SuitabilityScoreResult {
  const validated = validateComparisonWeights(weights as Record<string, unknown>);
  const factors: ScoreFactor[] = [];
  const missing: ComparisonWeightKey[] = [];

  const prices = cohortValues(cohort, (f) => f.priceAmount);
  const sizes = cohortValues(cohort, (f) => f.builtAreaSqm ?? f.usableAreaSqm);
  const commutes = cohortValues(cohort, (f) => f.commuteMin);
  const priceMin = prices.length ? Math.min(...prices) : 0;
  const priceMax = prices.length ? Math.max(...prices) : 0;
  const sizeMin = sizes.length ? Math.min(...sizes) : 0;
  const sizeMax = sizes.length ? Math.max(...sizes) : 0;
  const commuteMin = commutes.length ? Math.min(...commutes) : 0;
  const commuteMax = commutes.length ? Math.max(...commutes) : 0;

  const tryFactor = (
    key: ComparisonWeightKey,
    weight: number,
    available: boolean,
    factScore: number,
    sourceValue: unknown,
  ) => {
    if (weight <= 0) return;
    if (!available) {
      missing.push(key);
      return;
    }
    factors.push({
      key,
      weight,
      factScore,
      contribution: weight * factScore,
      sourceValue,
    });
  };

  for (const key of COMPARISON_WEIGHT_KEYS) {
    const weight = validated[key] ?? 0;
    if (weight <= 0) continue;

    switch (key) {
      case 'price': {
        const v = listing.priceAmount;
        tryFactor(
          key,
          weight,
          v != null && prices.length > 0,
          v != null ? invertNormalize(v, priceMin, priceMax) : 0,
          v,
        );
        break;
      }
      case 'size': {
        const v = listing.builtAreaSqm ?? listing.usableAreaSqm;
        tryFactor(
          key,
          weight,
          v != null && sizes.length > 0,
          v != null ? normalizeAsc(v, sizeMin, sizeMax) : 0,
          v,
        );
        break;
      }
      case 'commute': {
        const v = listing.commuteMin;
        tryFactor(
          key,
          weight,
          v != null && commutes.length > 0,
          v != null ? invertNormalize(v, commuteMin, commuteMax) : 0,
          v,
        );
        break;
      }
      case 'location': {
        const ok = Boolean(listing.areaLabel && listing.areaLabel.trim());
        tryFactor(key, weight, ok, ok ? 1 : 0, listing.areaLabel);
        break;
      }
      case 'coastal_access': {
        const unknown = listing.environmentType == null && listing.beachProximity == null;
        if (unknown) {
          missing.push(key);
          break;
        }
        const coastal =
          listing.environmentType === 'coastal' ||
          (listing.beachProximity != null && listing.beachProximity.length > 0);
        tryFactor(key, weight, true, coastal ? 1 : 0, {
          environmentType: listing.environmentType,
          beachProximity: listing.beachProximity,
        });
        break;
      }
      case 'quiet_surroundings': {
        const env = listing.environmentType;
        const ok = env === 'hillside' || env === 'city_center' || env === 'coastal';
        // Weak signal: environment present counts as available fact, score hillside higher
        const fact =
          env === 'hillside' ? 1 : env === 'coastal' ? 0.6 : env === 'city_center' ? 0.4 : 0;
        tryFactor(key, weight, ok, fact, env);
        break;
      }
      case 'outdoor_space': {
        tryFactor(
          key,
          weight,
          listing.hasOutdoorSpace != null,
          listing.hasOutdoorSpace ? 1 : 0,
          listing.hasOutdoorSpace,
        );
        break;
      }
      case 'condition': {
        tryFactor(
          key,
          weight,
          listing.condition != null && listing.condition.length > 0,
          listing.condition ? 1 : 0,
          listing.condition,
        );
        break;
      }
      case 'energy_efficiency': {
        tryFactor(
          key,
          weight,
          listing.energyRating != null && listing.energyRating.length > 0,
          listing.energyRating ? 1 : 0,
          listing.energyRating,
        );
        break;
      }
      case 'accessibility': {
        tryFactor(
          key,
          weight,
          listing.accessibilityFeature != null,
          listing.accessibilityFeature ? 1 : 0,
          listing.accessibilityFeature,
        );
        break;
      }
      case 'investment_potential':
        // Never inferred — always missing in phase4a.v1
        missing.push(key);
        break;
      default:
        missing.push(key);
    }
  }

  // Deduplicate missing (coastal path may double-push)
  const missingUnique = [...new Set(missing)];

  const weightSum = factors.reduce((s, f) => s + f.weight, 0);
  const weightedFactSum = factors.reduce((s, f) => s + f.contribution, 0);

  if (weightSum <= 0) {
    return {
      listingId: listing.listingId,
      score: null,
      factors: [],
      missing: missingUnique,
      reason: 'no_scorable_inputs',
      scoreModelVersion: SCORE_MODEL_VERSION,
      explanation: {
        formula:
          'score = round(100 * Σ(weight_i * fact_i) / Σ(weight_i)) over available criteria only',
        weightSum: 0,
        weightedFactSum: 0,
        disclaimerKey: 'suitability_not_valuation',
      },
    };
  }

  const score = Math.round((100 * weightedFactSum) / weightSum);
  factors.sort((a, b) => b.contribution - a.contribution);

  return {
    listingId: listing.listingId,
    score,
    factors,
    missing: missingUnique,
    scoreModelVersion: SCORE_MODEL_VERSION,
    explanation: {
      formula:
        'score = round(100 * Σ(weight_i * fact_i) / Σ(weight_i)) over available criteria only',
      weightSum,
      weightedFactSum,
      disclaimerKey: 'suitability_not_valuation',
    },
  };
}

export function scoreComparisonSet(
  listings: ComparisonListingFacts[],
  weights: ComparisonWeights,
): SuitabilityScoreResult[] {
  return listings.map((l) => scoreListingAgainstWeights(l, weights, listings));
}

export const COMPARISON_MAX_ITEMS = 5;
export const COMPARISON_MIN_ITEMS = 2;
export const MAX_SHORTLISTS_PER_USER = 20;
export const MAX_ITEMS_PER_SHORTLIST = 100;
