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
