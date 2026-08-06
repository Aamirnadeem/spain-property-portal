import {
  hashSavedSearchCriteria,
  MAX_BROWSING_HISTORY,
  MAX_SAVED_SEARCHES_PER_USER,
  normalizeSavedSearchCriteria,
  resolveSavedSearchName,
} from './saved-search';

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

export interface GuestSavedSearchSnapshot {
  name: string;
  criteria?: unknown;
  criteriaHash?: string;
  alertsEnabled?: boolean;
  alertTypes?: string[];
  disabled?: boolean;
}

export interface GuestBrowsingHistorySnapshot {
  listingId: string;
  physicalPropertyId?: string;
  firstViewedAt: string;
  lastViewedAt: string;
  viewCount: number;
  channel?: string;
  context?: Record<string, unknown>;
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
  savedSearches?: GuestSavedSearchSnapshot[];
  browsingHistory?: GuestBrowsingHistorySnapshot[];
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
  /** Existing auth criteria hashes — guest duplicates are skipped. */
  savedSearchHashes?: string[];
  savedSearchNames?: string[];
  browsingHistory?: GuestBrowsingHistorySnapshot[];
}

export interface MergedShortlistPlan {
  name: string;
  isDefault: boolean;
  listingIds: string[];
  note?: string;
  renamedFrom?: string;
}

export interface MergedSavedSearchPlan {
  name: string;
  criteria: Record<string, unknown>;
  criteriaHash: string;
  alertsEnabled: boolean;
  alertTypes: string[];
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
  /** New saved searches to insert (auth duplicates by hash skipped). */
  savedSearchesToInsert: MergedSavedSearchPlan[];
  /** Merged browsing history rows (cap 50). */
  browsingHistoryMerged: GuestBrowsingHistorySnapshot[];
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

function guestSavedSearchEntries(guest: GuestWorkspaceSnapshot): GuestSavedSearchSnapshot[] {
  if (guest.savedSearches && guest.savedSearches.length > 0) return guest.savedSearches;
  return (guest.savedSearchCriteria ?? []).map((criteria, i) => ({
    name: `Saved search ${i + 1}`,
    criteria,
  }));
}

function guestHistoryEntries(guest: GuestWorkspaceSnapshot): GuestBrowsingHistorySnapshot[] {
  if (guest.browsingHistory && guest.browsingHistory.length > 0) return guest.browsingHistory;
  const now = new Date().toISOString();
  return (guest.recentViewListingIds ?? []).map((listingId) => ({
    listingId,
    firstViewedAt: now,
    lastViewedAt: now,
    viewCount: 1,
    channel: 'web',
  }));
}

function mergeHistory(
  guestRows: GuestBrowsingHistorySnapshot[],
  userRows: GuestBrowsingHistorySnapshot[],
): GuestBrowsingHistorySnapshot[] {
  const byListing = new Map<string, GuestBrowsingHistorySnapshot>();
  for (const row of [...guestRows, ...userRows]) {
    const existing = byListing.get(row.listingId);
    if (!existing) {
      byListing.set(row.listingId, { ...row });
      continue;
    }
    const first =
      new Date(row.firstViewedAt).getTime() < new Date(existing.firstViewedAt).getTime()
        ? row.firstViewedAt
        : existing.firstViewedAt;
    const last =
      new Date(row.lastViewedAt).getTime() > new Date(existing.lastViewedAt).getTime()
        ? row.lastViewedAt
        : existing.lastViewedAt;
    byListing.set(row.listingId, {
      listingId: row.listingId,
      physicalPropertyId: row.physicalPropertyId ?? existing.physicalPropertyId,
      firstViewedAt: first,
      lastViewedAt: last,
      viewCount: existing.viewCount + row.viewCount,
      channel: row.channel ?? existing.channel,
      context: row.context ?? existing.context,
    });
  }
  return [...byListing.values()]
    .sort((a, b) => new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime())
    .slice(0, MAX_BROWSING_HISTORY);
}

/**
 * Merges eligible guest workspace data into a registered user account (pure plan).
 * Guest items are prepended; authenticated property notes and saved searches are never overwritten.
 */
export function mergeGuestWorkspace(
  guest: GuestWorkspaceSnapshot,
  user: UserWorkspaceSnapshot,
): GuestMergeResult {
  const existingNames = new Set(user.shortlistNames ?? []);
  const authNoteIds = new Set(user.propertyNoteListingIds ?? []);
  const existingHashes = new Set(user.savedSearchHashes ?? []);
  const savedSearchNames = new Set((user.savedSearchNames ?? []).map((n) => n.toLowerCase()));

  const shortlists: MergedShortlistPlan[] = [];
  for (const sl of guest.shortlists ?? []) {
    const resolved = resolveShortlistName(sl.name, existingNames);
    existingNames.add(resolved);
    shortlists.push({
      name: resolved,
      isDefault: false,
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

  const savedSearchesToInsert: MergedSavedSearchPlan[] = [];
  for (const entry of guestSavedSearchEntries(guest)) {
    if (entry.disabled) continue;
    let normalized;
    let hash: string;
    try {
      normalized = normalizeSavedSearchCriteria(entry.criteria);
      hash = entry.criteriaHash ?? hashSavedSearchCriteria(normalized);
    } catch {
      continue;
    }
    if (existingHashes.has(hash)) continue;
    existingHashes.add(hash);
    const name = resolveSavedSearchName(entry.name, savedSearchNames);
    savedSearchNames.add(name.toLowerCase());
    savedSearchesToInsert.push({
      name,
      criteria: normalized as unknown as Record<string, unknown>,
      criteriaHash: hash,
      // Alert prefs apply only on newly inserted rows; disabled guest never re-enables auth
      alertsEnabled: Boolean(entry.alertsEnabled),
      alertTypes: entry.alertTypes ?? [],
      renamedFrom: name !== entry.name ? entry.name : undefined,
    });
    if (savedSearchesToInsert.length >= MAX_SAVED_SEARCHES_PER_USER) break;
  }

  const browsingHistoryMerged = mergeHistory(
    guestHistoryEntries(guest),
    user.browsingHistory ?? [],
  );

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
    ]).slice(0, MAX_BROWSING_HISTORY),
    savedSearchCriteria: [...guest.savedSearchCriteria, ...user.savedSearchCriteria].slice(
      0,
      MAX_SAVED_SEARCHES_PER_USER,
    ),
    shortlists,
    propertyNotesToInsert,
    preferenceWeightsToApply,
    savedSearchesToInsert,
    browsingHistoryMerged,
    mergedFromGuestSessionId: guest.guestSessionId,
  };
}
