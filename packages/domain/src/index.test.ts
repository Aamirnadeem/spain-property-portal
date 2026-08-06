import { describe, expect, it } from 'vitest';
import {
  assertFavouriteOwner,
  FavouriteAuthorizationError,
  formatPriceEur,
  mergeFavouriteIds,
  mergeGuestWorkspace,
} from './index';

describe('mergeGuestWorkspace', () => {
  it('merges favourites without duplicates and preserves guest-first order', () => {
    const result = mergeGuestWorkspace(
      {
        guestSessionId: 'g1',
        favouriteListingIds: ['a', 'b'],
        comparisonListingIds: ['c'],
        recentViewListingIds: ['a'],
        savedSearchCriteria: [{ q: 'sitges' }],
      },
      {
        userId: 'u1',
        favouriteListingIds: ['b', 'd'],
        comparisonListingIds: [],
        recentViewListingIds: ['d'],
        savedSearchCriteria: [],
      },
    );
    expect(result.favouriteListingIds).toEqual(['a', 'b', 'd']);
    expect(result.comparisonListingIds).toEqual(['c']);
    expect(result.mergedFromGuestSessionId).toBe('g1');
    expect(result.savedSearchCriteria).toHaveLength(1);
  });

  it('skips duplicate saved-search hashes and merges browsing history', () => {
    const result = mergeGuestWorkspace(
      {
        guestSessionId: 'g2',
        favouriteListingIds: [],
        comparisonListingIds: [],
        recentViewListingIds: [],
        savedSearchCriteria: [],
        savedSearches: [
          {
            name: 'Sitges',
            criteria: { q: 'sitges', sort: 'newest' },
            alertsEnabled: true,
            alertTypes: ['price_reduction'],
          },
          {
            name: 'Sitges duplicate',
            criteria: { sort: 'newest', q: 'sitges' },
            alertsEnabled: false,
          },
        ],
        browsingHistory: [
          {
            listingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            firstViewedAt: '2026-01-01T00:00:00.000Z',
            lastViewedAt: '2026-01-02T00:00:00.000Z',
            viewCount: 2,
          },
        ],
      },
      {
        userId: 'u1',
        favouriteListingIds: [],
        comparisonListingIds: [],
        recentViewListingIds: [],
        savedSearchCriteria: [],
        savedSearchHashes: [],
        browsingHistory: [
          {
            listingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            firstViewedAt: '2026-01-01T12:00:00.000Z',
            lastViewedAt: '2026-01-03T00:00:00.000Z',
            viewCount: 1,
          },
        ],
      },
    );
    expect(result.savedSearchesToInsert).toHaveLength(1);
    expect(result.savedSearchesToInsert[0]?.alertsEnabled).toBe(true);
    expect(result.browsingHistoryMerged).toHaveLength(1);
    expect(result.browsingHistoryMerged[0]?.viewCount).toBe(3);
    expect(result.browsingHistoryMerged[0]?.lastViewedAt).toBe('2026-01-03T00:00:00.000Z');
  });

  it('does not re-insert when auth already has the criteria hash', () => {
    const guestCriteria = { q: 'sitges', sort: 'newest' as const };
    const first = mergeGuestWorkspace(
      {
        guestSessionId: 'g3',
        favouriteListingIds: [],
        comparisonListingIds: [],
        recentViewListingIds: [],
        savedSearchCriteria: [],
        savedSearches: [{ name: 'A', criteria: guestCriteria }],
      },
      {
        userId: 'u1',
        favouriteListingIds: [],
        comparisonListingIds: [],
        recentViewListingIds: [],
        savedSearchCriteria: [],
      },
    );
    const hash = first.savedSearchesToInsert[0]!.criteriaHash;
    const second = mergeGuestWorkspace(
      {
        guestSessionId: 'g3',
        favouriteListingIds: [],
        comparisonListingIds: [],
        recentViewListingIds: [],
        savedSearchCriteria: [],
        savedSearches: [{ name: 'A', criteria: guestCriteria, alertsEnabled: true }],
      },
      {
        userId: 'u1',
        favouriteListingIds: [],
        comparisonListingIds: [],
        recentViewListingIds: [],
        savedSearchCriteria: [],
        savedSearchHashes: [hash],
      },
    );
    expect(second.savedSearchesToInsert).toHaveLength(0);
  });
});

describe('favourites authorization', () => {
  it('blocks cross-user access', () => {
    expect(() => assertFavouriteOwner('u1', 'u2')).toThrow(FavouriteAuthorizationError);
    expect(mergeFavouriteIds(['a'], ['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('property helpers', () => {
  it('formats EUR prices', () => {
    expect(formatPriceEur(1350000)).toContain('1');
    expect(formatPriceEur(null)).toBe('Price on request');
  });
});
