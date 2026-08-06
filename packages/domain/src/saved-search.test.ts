import { describe, expect, it } from 'vitest';
import {
  hashSavedSearchCriteria,
  matchesListing,
  normalizeSavedSearchCriteria,
  notificationDedupeKey,
  SAVED_SEARCH_CRITERIA_VERSION,
} from './saved-search';

const baseListing = {
  id: '11111111-1111-4111-8111-111111111111',
  priceAmount: 300000,
  bedrooms: 3,
  bathrooms: 2,
  builtAreaSqm: 110,
  areaLabel: 'Sitges, Barcelona',
  addressText: 'Sitges',
  environmentType: 'coastal',
  propertyTypeKey: 'apartment',
  operationalStatus: 'available',
  isPublicBrowseable: true,
  isLegacySnapshot: false,
  title: 'Sea view flat',
};

describe('saved-search criteria', () => {
  it('normalizes and hashes deterministically regardless of key order', () => {
    const a = normalizeSavedSearchCriteria({
      maxPrice: 400000,
      q: 'sitges',
      minPrice: 200000,
      sort: 'newest',
    });
    const b = normalizeSavedSearchCriteria({
      sort: 'newest',
      q: 'sitges',
      minPrice: 200000,
      maxPrice: 400000,
      page: 3,
      pageSize: 24,
      view: 'table',
    });
    expect(a.criteriaVersion).toBe(SAVED_SEARCH_CRITERIA_VERSION);
    expect(hashSavedSearchCriteria(a)).toBe(hashSavedSearchCriteria(b));
  });

  it('rejects invalid price ranges', () => {
    expect(() => normalizeSavedSearchCriteria({ minPrice: 500000, maxPrice: 100000 })).toThrow();
  });

  it('matches listings and excludes legacy by default', () => {
    const criteria = normalizeSavedSearchCriteria({
      q: 'sitges',
      minBedrooms: 2,
      maxPrice: 350000,
    });
    expect(matchesListing(criteria, baseListing)).toBe(true);
    expect(
      matchesListing(criteria, {
        ...baseListing,
        isLegacySnapshot: true,
        operationalStatus: 'legacy_snapshot',
      }),
    ).toBe(false);
    expect(
      matchesListing(
        criteria,
        { ...baseListing, isLegacySnapshot: true, operationalStatus: 'legacy_snapshot' },
        { allowLegacy: true },
      ),
    ).toBe(true);
  });

  it('fails closed on missing bathrooms when filter present', () => {
    const criteria = normalizeSavedSearchCriteria({ minBathrooms: 2 });
    expect(matchesListing(criteria, { ...baseListing, bathrooms: null })).toBe(false);
  });

  it('fails closed for offPlan only/exclude without inventory field', () => {
    const only = normalizeSavedSearchCriteria({ offPlan: 'only' });
    expect(matchesListing(only, baseListing)).toBe(false);
  });

  it('builds stable notification dedupe keys', () => {
    const a = notificationDedupeKey({
      userId: 'u1',
      type: 'price_reduction',
      listingId: 'l1',
      sourceEventId: 'e1',
    });
    const b = notificationDedupeKey({
      userId: 'u1',
      type: 'price_reduction',
      listingId: 'l1',
      sourceEventId: 'e1',
    });
    const c = notificationDedupeKey({
      userId: 'u1',
      type: 'price_reduction',
      listingId: 'l1',
      sourceEventId: 'e2',
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
