export const GUEST_SAVED_SEARCHES_KEY = 'spain_guest_saved_searches';
export const GUEST_BROWSING_HISTORY_KEY = 'spain_guest_browsing_history';

export type GuestSavedSearchLocal = {
  id: string;
  name: string;
  criteria: Record<string, unknown>;
  criteriaVersion?: string;
  criteriaHash?: string;
  alertsEnabled?: boolean;
  alertTypes?: string[];
  disabled?: boolean;
  lastEvaluatedAt?: string | null;
  lastMatchCount?: number | null;
  lastEvaluationStatus?: string | null;
};

export type GuestBrowsingHistoryLocal = {
  listingId: string;
  physicalPropertyId?: string;
  firstViewedAt: string;
  lastViewedAt: string;
  viewCount: number;
  channel?: string;
  context?: Record<string, unknown>;
};

export function readGuestSavedSearches(): GuestSavedSearchLocal[] {
  try {
    return JSON.parse(
      window.localStorage.getItem(GUEST_SAVED_SEARCHES_KEY) ?? '[]',
    ) as GuestSavedSearchLocal[];
  } catch {
    return [];
  }
}

export function writeGuestSavedSearches(items: GuestSavedSearchLocal[]) {
  window.localStorage.setItem(GUEST_SAVED_SEARCHES_KEY, JSON.stringify(items.slice(0, 5)));
}

export function readGuestBrowsingHistory(): GuestBrowsingHistoryLocal[] {
  try {
    return JSON.parse(
      window.localStorage.getItem(GUEST_BROWSING_HISTORY_KEY) ?? '[]',
    ) as GuestBrowsingHistoryLocal[];
  } catch {
    return [];
  }
}

export function writeGuestBrowsingHistory(items: GuestBrowsingHistoryLocal[]) {
  window.localStorage.setItem(GUEST_BROWSING_HISTORY_KEY, JSON.stringify(items.slice(0, 50)));
}

/** Strip pagination/view fields before persisting search criteria. */
export function criteriaForSave(criteria: Record<string, unknown>): Record<string, unknown> {
  const next = { ...criteria };
  delete next.page;
  delete next.pageSize;
  delete next.view;
  return next;
}

async function fetchGuestPayload(): Promise<Record<string, unknown>> {
  try {
    const res = await fetch('/api/v1/guest/workspace', { credentials: 'same-origin' });
    if (!res.ok) return {};
    const data = (await res.json()) as { payload?: Record<string, unknown> };
    return data.payload ?? {};
  } catch {
    return {};
  }
}

/** Merge local Phase 4B fields into guest workspace without wiping other payload keys. */
export async function syncGuestPhase4bToServer(options?: {
  savedSearches?: GuestSavedSearchLocal[];
  browsingHistory?: GuestBrowsingHistoryLocal[];
}) {
  const existing = await fetchGuestPayload();
  const savedSearches = options?.savedSearches ?? readGuestSavedSearches();
  const browsingHistory = options?.browsingHistory ?? readGuestBrowsingHistory();

  await fetch('/api/v1/guest/workspace', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      favouriteListingIds: existing.favouriteListingIds ?? [],
      comparisonListingIds: existing.comparisonListingIds ?? [],
      recentViewListingIds:
        browsingHistory.length > 0
          ? browsingHistory.map((h) => h.listingId).slice(0, 100)
          : ((existing.recentViewListingIds as string[] | undefined) ?? []),
      savedSearchCriteria: savedSearches.map((s) => s.criteria),
      shortlists: existing.shortlists ?? [],
      preferenceWeights: existing.preferenceWeights ?? {},
      propertyNotes: existing.propertyNotes ?? [],
      savedSearches: savedSearches.map((s) => ({
        name: s.name,
        criteria: s.criteria,
        criteriaHash: s.criteriaHash,
        alertsEnabled: s.alertsEnabled,
        alertTypes: s.alertTypes,
        disabled: s.disabled,
      })),
      browsingHistory: browsingHistory.map((h) => ({
        listingId: h.listingId,
        physicalPropertyId: h.physicalPropertyId,
        firstViewedAt: h.firstViewedAt,
        lastViewedAt: h.lastViewedAt,
        viewCount: h.viewCount,
        channel: h.channel ?? 'web',
        context: h.context,
      })),
      historyRecordingEnabled: existing.historyRecordingEnabled,
    }),
  });
}

export function recordGuestPropertyView(
  listingId: string,
  options?: { title?: string; physicalPropertyId?: string },
): GuestBrowsingHistoryLocal[] {
  const now = new Date().toISOString();
  const current = readGuestBrowsingHistory();
  const existing = current.find((h) => h.listingId === listingId);
  let next: GuestBrowsingHistoryLocal[];
  if (existing) {
    next = [
      {
        ...existing,
        lastViewedAt: now,
        viewCount: existing.viewCount + 1,
        context: {
          ...existing.context,
          ...(options?.title ? { title: options.title } : {}),
        },
      },
      ...current.filter((h) => h.listingId !== listingId),
    ];
  } else {
    next = [
      {
        listingId,
        physicalPropertyId: options?.physicalPropertyId,
        firstViewedAt: now,
        lastViewedAt: now,
        viewCount: 1,
        channel: 'web',
        context: options?.title ? { title: options.title } : undefined,
      },
      ...current,
    ].slice(0, 50);
  }
  writeGuestBrowsingHistory(next);
  return next;
}

export async function hasSession(): Promise<boolean> {
  const res = await fetch('/api/v1/auth/session', { credentials: 'same-origin' });
  if (!res.ok) return false;
  const data = (await res.json()) as { userId?: string | null };
  return Boolean(data.userId);
}
