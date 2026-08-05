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

export const ORGANIZATION_ROLES = ['org_owner', 'org_admin', 'org_agent', 'org_viewer'] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const PLATFORM_ROLES = [
  'platform_admin',
  'listing_reviewer',
  'media_rights_reviewer',
  'legal_content_reviewer',
  'support_agent',
  'ai_quality_reviewer',
  'buyer',
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];
