import { describe, expect, it } from 'vitest';
import {
  InvalidWeightsError,
  SCORE_MODEL_VERSION,
  scoreComparisonSet,
  scoreListingAgainstWeights,
  validateComparisonWeights,
  type ComparisonListingFacts,
  type ComparisonWeights,
} from './comparison-scoring';

function facts(
  partial: Partial<ComparisonListingFacts> & { listingId: string },
): ComparisonListingFacts {
  return {
    priceAmount: null,
    pricePerSqm: null,
    builtAreaSqm: null,
    usableAreaSqm: null,
    bedrooms: null,
    bathrooms: null,
    areaLabel: null,
    environmentType: null,
    commuteMin: null,
    beachProximity: null,
    parkProximity: null,
    condition: null,
    energyRating: null,
    hasOutdoorSpace: null,
    accessibilityFeature: null,
    lastConfirmedAvailableAt: null,
    ...partial,
  };
}

const equalWeights: ComparisonWeights = {
  price: 5,
  size: 5,
  location: 5,
};

describe('validateComparisonWeights', () => {
  it('accepts 0–10 integers', () => {
    expect(validateComparisonWeights({ price: 0, size: 10 })).toEqual({ price: 0, size: 10 });
  });

  it('rejects negatives', () => {
    expect(() => validateComparisonWeights({ price: -1 })).toThrow(InvalidWeightsError);
  });

  it('rejects non-integers and unknown keys', () => {
    expect(() => validateComparisonWeights({ price: 1.5 })).toThrow(InvalidWeightsError);
    expect(() => validateComparisonWeights({ foo: 1 })).toThrow(InvalidWeightsError);
  });
});

describe('scoreListingAgainstWeights', () => {
  const a = facts({
    listingId: 'a',
    priceAmount: 100_000,
    builtAreaSqm: 50,
    areaLabel: 'Barcelona',
  });
  const b = facts({
    listingId: 'b',
    priceAmount: 200_000,
    builtAreaSqm: 100,
    areaLabel: 'Girona',
  });

  it('scores with equal weights deterministically', () => {
    const r1 = scoreListingAgainstWeights(a, equalWeights, [a, b]);
    const r2 = scoreListingAgainstWeights(a, equalWeights, [a, b]);
    expect(r1).toEqual(r2);
    expect(r1.scoreModelVersion).toBe(SCORE_MODEL_VERSION);
    expect(r1.score).not.toBeNull();
    expect(r1.explanation.disclaimerKey).toBe('suitability_not_valuation');
  });

  it('ignores zero-weight criteria', () => {
    const r = scoreListingAgainstWeights(a, { price: 0, size: 10 }, [a, b]);
    expect(r.factors.every((f) => f.key !== 'price')).toBe(true);
    expect(r.factors.some((f) => f.key === 'size')).toBe(true);
  });

  it('excludes missing values from denominator', () => {
    const sparse = facts({ listingId: 's', priceAmount: 150_000 });
    const r = scoreListingAgainstWeights(sparse, { price: 5, size: 5, condition: 5 }, [sparse, a]);
    expect(r.missing).toContain('size');
    expect(r.missing).toContain('condition');
    expect(r.factors.some((f) => f.key === 'price')).toBe(true);
  });

  it('returns null score when all values missing', () => {
    const empty = facts({ listingId: 'e' });
    const r = scoreListingAgainstWeights(empty, { price: 5, size: 5 }, [empty]);
    expect(r.score).toBeNull();
    expect(r.reason).toBe('no_scorable_inputs');
  });

  it('handles extreme prices and sizes', () => {
    const cheap = facts({ listingId: 'c', priceAmount: 1, builtAreaSqm: 1 });
    const expensive = facts({ listingId: 'x', priceAmount: 50_000_000, builtAreaSqm: 10_000 });
    const byPrice = scoreComparisonSet([cheap, expensive], { price: 10 });
    expect(byPrice[0]!.score!).toBeGreaterThan(byPrice[1]!.score!);
    const bySize = scoreComparisonSet([cheap, expensive], { size: 10 });
    expect(bySize[1]!.score!).toBeGreaterThan(bySize[0]!.score!);
  });

  it('produces tied results for identical facts', () => {
    const x = facts({ listingId: 'x', priceAmount: 100, builtAreaSqm: 40, areaLabel: 'A' });
    const y = facts({ listingId: 'y', priceAmount: 100, builtAreaSqm: 40, areaLabel: 'A' });
    const sx = scoreListingAgainstWeights(x, equalWeights, [x, y]);
    const sy = scoreListingAgainstWeights(y, equalWeights, [x, y]);
    expect(sx.score).toBe(sy.score);
  });

  it('changes ranking after weight changes', () => {
    const cheapSmall = facts({ listingId: 'cs', priceAmount: 80_000, builtAreaSqm: 40 });
    const dearLarge = facts({ listingId: 'dl', priceAmount: 300_000, builtAreaSqm: 200 });
    const byPrice = scoreComparisonSet([cheapSmall, dearLarge], { price: 10, size: 0 });
    const bySize = scoreComparisonSet([cheapSmall, dearLarge], { price: 0, size: 10 });
    expect(byPrice[0]!.score!).toBeGreaterThan(byPrice[1]!.score!);
    expect(bySize[1]!.score!).toBeGreaterThan(bySize[0]!.score!);
  });

  it('always marks investment_potential as missing', () => {
    const r = scoreListingAgainstWeights(a, { investment_potential: 10, price: 5 }, [a, b]);
    expect(r.missing).toContain('investment_potential');
    expect(r.factors.every((f) => f.key !== 'investment_potential')).toBe(true);
  });

  it('lists criterion weights and contributions', () => {
    const r = scoreListingAgainstWeights(a, { price: 8, size: 2 }, [a, b]);
    expect(r.factors[0]!.weight).toBeGreaterThan(0);
    expect(r.factors.every((f) => typeof f.contribution === 'number')).toBe(true);
  });
});
