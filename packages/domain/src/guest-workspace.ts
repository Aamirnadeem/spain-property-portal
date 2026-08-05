export interface GuestWorkspaceSnapshot {
  guestSessionId: string;
  favouriteListingIds: string[];
  comparisonListingIds: string[];
  recentViewListingIds: string[];
  savedSearchCriteria: unknown[];
  locale?: string;
  currency?: string;
}

export interface UserWorkspaceSnapshot {
  userId: string;
  favouriteListingIds: string[];
  comparisonListingIds: string[];
  recentViewListingIds: string[];
  savedSearchCriteria: unknown[];
}

export interface GuestMergeResult {
  userId: string;
  favouriteListingIds: string[];
  comparisonListingIds: string[];
  recentViewListingIds: string[];
  savedSearchCriteria: unknown[];
  mergedFromGuestSessionId: string;
}

function uniquePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Merges eligible guest workspace data into a registered user account.
 * Guest items are prepended (most recent guest activity first), then existing user items.
 */
export function mergeGuestWorkspace(
  guest: GuestWorkspaceSnapshot,
  user: UserWorkspaceSnapshot,
): GuestMergeResult {
  return {
    userId: user.userId,
    favouriteListingIds: uniquePreserveOrder([
      ...guest.favouriteListingIds,
      ...user.favouriteListingIds,
    ]),
    comparisonListingIds: uniquePreserveOrder([
      ...guest.comparisonListingIds,
      ...user.comparisonListingIds,
    ]),
    recentViewListingIds: uniquePreserveOrder([
      ...guest.recentViewListingIds,
      ...user.recentViewListingIds,
    ]).slice(0, 50),
    savedSearchCriteria: [...guest.savedSearchCriteria, ...user.savedSearchCriteria],
    mergedFromGuestSessionId: guest.guestSessionId,
  };
}
