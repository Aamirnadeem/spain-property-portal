import { describe, expect, it } from 'vitest';
import { mergeGuestWorkspace } from './index';

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
