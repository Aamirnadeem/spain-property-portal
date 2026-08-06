export interface GuestShortlistSnapshot {
  name: string;
  isDefault?: boolean;
  listingIds: string[];
  note?: string;
}

export interface GuestPropertyNoteSnapshot {
  listingId: string;
  body: string;
  positives?: string[];
  negatives?: string[];
}

export interface GuestWorkspaceSnapshot {
  guestSessionId: string;
  favouriteListingIds: string[];
  comparisonListingIds: string[];
  recentViewListingIds: string[];
  savedSearchCriteria: unknown[];
  shortlists?: GuestShortlistSnapshot[];
  preferenceWeights?: Record<string, number>;
  propertyNotes?: GuestPropertyNoteSnapshot[];
  locale?: string;
  currency?: string;
}

export interface UserWorkspaceSnapshot {
  userId: string;
  favouriteListingIds: string[];
  comparisonListingIds: string[];
  recentViewListingIds: string[];
  savedSearchCriteria: unknown[];
  shortlistNames?: string[];
  hasActivePreferenceProfile?: boolean;
  propertyNoteListingIds?: string[];
}

export interface MergedShortlistPlan {
  name: string;
  isDefault: boolean;
  listingIds: string[];
  note?: string;
  renamedFrom?: string;
}

export interface GuestMergeResult {
  userId: string;
  favouriteListingIds: string[];
  comparisonListingIds: string[];
  recentViewListingIds: string[];
  savedSearchCriteria: unknown[];
  shortlists: MergedShortlistPlan[];
  /** Guest notes to insert — excludes listingIds that already have an auth note. */
  propertyNotesToInsert: GuestPropertyNoteSnapshot[];
  /** Guest weights applied only when user has no active profile. */
  preferenceWeightsToApply: Record<string, number> | null;
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

/** Resolve shortlist name collisions by prefixing Guest — */
export function resolveShortlistName(desired: string, existingNames: Set<string>): string {
  let name = desired.slice(0, 80);
  if (!existingNames.has(name)) return name;
  const prefixed = `Guest — ${desired}`.slice(0, 80);
  if (!existingNames.has(prefixed)) return prefixed;
  let i = 2;
  while (i < 100) {
    const candidate = `Guest — ${desired} (${i})`.slice(0, 80);
    if (!existingNames.has(candidate)) return candidate;
    i += 1;
  }
  return `Guest — ${desired} (${Date.now()})`.slice(0, 80);
}

/**
 * Merges eligible guest workspace data into a registered user account (pure plan).
 * Guest items are prepended; authenticated property notes are never overwritten.
 */
export function mergeGuestWorkspace(
  guest: GuestWorkspaceSnapshot,
  user: UserWorkspaceSnapshot,
): GuestMergeResult {
  const existingNames = new Set(user.shortlistNames ?? []);
  const authNoteIds = new Set(user.propertyNoteListingIds ?? []);

  const shortlists: MergedShortlistPlan[] = [];
  for (const sl of guest.shortlists ?? []) {
    const resolved = resolveShortlistName(sl.name, existingNames);
    existingNames.add(resolved);
    shortlists.push({
      name: resolved,
      isDefault: false, // never steal authenticated default from guest
      listingIds: uniquePreserveOrder(sl.listingIds),
      note: sl.note,
      renamedFrom: resolved !== sl.name ? sl.name : undefined,
    });
  }

  const propertyNotesToInsert = (guest.propertyNotes ?? []).filter(
    (n) => !authNoteIds.has(n.listingId),
  );

  const preferenceWeightsToApply =
    user.hasActivePreferenceProfile || !guest.preferenceWeights
      ? null
      : { ...guest.preferenceWeights };

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
    shortlists,
    propertyNotesToInsert,
    preferenceWeightsToApply,
    mergedFromGuestSessionId: guest.guestSessionId,
  };
}
