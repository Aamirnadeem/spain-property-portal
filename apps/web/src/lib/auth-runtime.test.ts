import { describe, expect, it } from 'vitest';
import { mergeGuestWorkspace } from '@spain/domain';

describe('account merge wiring', () => {
  it('uses domain merge helper for guest favourites', () => {
    const merged = mergeGuestWorkspace(
      {
        guestSessionId: 'g',
        favouriteListingIds: ['x'],
        comparisonListingIds: [],
        recentViewListingIds: [],
        savedSearchCriteria: [],
      },
      {
        userId: 'u',
        favouriteListingIds: [],
        comparisonListingIds: [],
        recentViewListingIds: [],
        savedSearchCriteria: [],
      },
    );
    expect(merged.favouriteListingIds).toEqual(['x']);
  });
});
