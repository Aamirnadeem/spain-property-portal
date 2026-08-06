import { describe, expect, it } from 'vitest';
import { assertFavouriteOwner, FavouriteOwnershipError, mergeGuestFavourites } from './favourites';

describe('assertFavouriteOwner', () => {
  it('does not throw when the acting user owns the favourite', () => {
    expect(() => assertFavouriteOwner('u1', 'u1')).not.toThrow();
  });

  it('throws FavouriteOwnershipError on mismatch', () => {
    expect(() => assertFavouriteOwner('u1', 'u2')).toThrow(FavouriteOwnershipError);
  });
});

describe('mergeGuestFavourites', () => {
  it('merges and de-duplicates favourite listing ids, guest-first', () => {
    const result = mergeGuestFavourites(
      {
        guestSessionId: 'g1',
        favouriteListingIds: ['a', 'b'],
        comparisonListingIds: [],
        recentViewListingIds: [],
        savedSearchCriteria: [],
      },
      {
        userId: 'u1',
        favouriteListingIds: ['b', 'c'],
        comparisonListingIds: [],
        recentViewListingIds: [],
        savedSearchCriteria: [],
      },
    );
    expect(result).toEqual(['a', 'b', 'c']);
  });
});
