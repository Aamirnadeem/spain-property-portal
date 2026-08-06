import { describe, expect, it } from 'vitest';
import {
  computeRoundedPricePerSqm,
  isBrowseableStatus,
  isPrePublishStatus,
  normalizePartnerEnvironmentType,
  normalizePartnerPropertyType,
  normalizePartnerStatus,
  splitListField,
} from './normalize';

describe('normalizePartnerPropertyType', () => {
  it('maps known English and Spanish labels', () => {
    expect(normalizePartnerPropertyType('apartment')).toBe('apartment');
    expect(normalizePartnerPropertyType('Piso')).toBe('apartment');
    expect(normalizePartnerPropertyType('Chalet')).toBe('villa');
    expect(normalizePartnerPropertyType('Casa Adosada')).toBe('townhouse');
  });

  it('returns null for unmapped values', () => {
    expect(normalizePartnerPropertyType('castle')).toBeNull();
  });
});

describe('normalizePartnerStatus', () => {
  it('maps known statuses', () => {
    expect(normalizePartnerStatus('available')).toBe('available');
    expect(normalizePartnerStatus('Vendido')).toBe('sold');
    expect(normalizePartnerStatus('Withdrawn')).toBe('withdrawn');
  });

  it('returns null for unmapped values', () => {
    expect(normalizePartnerStatus('being_painted')).toBeNull();
  });
});

describe('normalizePartnerEnvironmentType', () => {
  it('maps known environment labels including accented Spanish', () => {
    expect(normalizePartnerEnvironmentType('coastal')).toBe('coastal');
    expect(normalizePartnerEnvironmentType('Montaña')).toBe('hillside');
  });

  it('returns null for unmapped values', () => {
    expect(normalizePartnerEnvironmentType('desert')).toBeNull();
  });
});

describe('isPrePublishStatus / isBrowseableStatus', () => {
  it('treats draft/pending_review/rejected as pre-publish', () => {
    expect(isPrePublishStatus('pending_review')).toBe(true);
    expect(isPrePublishStatus('available')).toBe(false);
  });

  it('treats available/reserved/under_offer as browseable', () => {
    expect(isBrowseableStatus('available')).toBe(true);
    expect(isBrowseableStatus('reserved')).toBe(true);
    expect(isBrowseableStatus('sold')).toBe(false);
    expect(isBrowseableStatus('withdrawn')).toBe(false);
  });
});

describe('splitListField', () => {
  it('splits on pipe and semicolon and trims values', () => {
    expect(splitListField('a|b; c')).toEqual(['a', 'b', 'c']);
    expect(splitListField(undefined)).toEqual([]);
    expect(splitListField('')).toEqual([]);
  });
});

describe('computeRoundedPricePerSqm', () => {
  it('rounds to two decimals', () => {
    expect(computeRoundedPricePerSqm(415000, 72)).toBeCloseTo(5763.89, 2);
  });

  it('returns null for zero or invalid size', () => {
    expect(computeRoundedPricePerSqm(100, 0)).toBeNull();
  });
});
