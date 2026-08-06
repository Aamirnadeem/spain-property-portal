import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  ALERT_TYPE_OPTIONS,
  DEFAULT_HISTORY_RETENTION_DAYS,
  MAX_BROWSING_HISTORY,
  MAX_SAVED_SEARCHES_PER_USER,
  SAVED_SEARCH_CRITERIA_VERSION,
  defaultAlertTypesOnEnable,
  hashSavedSearchCriteria,
  indexedColumnsFromCriteria,
  matchesListing,
  normalizeSavedSearchCriteria,
  notificationDedupeKey,
  type AlertType,
  type ListingMatchFacts,
  type SavedSearchCriteriaV1,
} from '@spain/domain';
import * as schema from '../schema/index';
import { BuyerWorkspaceError } from './buyer-workspace';

type Db = PostgresJsDatabase<typeof schema>;

/** Test-only override so fixtures can exercise legacy-snapshot alert paths (D13). */
function allowLegacyAlerts(): boolean {
  return process.env.ALLOW_LEGACY_ALERTS_IN_TESTS === 'true';
}

function historyRetentionDays(): number {
  const raw = Number(process.env.BUYER_HISTORY_RETENTION_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_HISTORY_RETENTION_DAYS;
}

function listingRowToMatchFacts(
  row: typeof schema.propertyListings.$inferSelect,
): ListingMatchFacts {
  const price = row.priceAmount == null ? null : Number(row.priceAmount);
  const size = row.builtAreaSqm == null ? null : Number(row.builtAreaSqm);
  return {
    id: row.id,
    priceAmount: Number.isFinite(price as number) ? price : null,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    builtAreaSqm: Number.isFinite(size as number) ? size : null,
    areaLabel: row.areaLabel,
    addressText: row.addressText,
    environmentType: row.environmentType,
    propertyTypeKey: row.propertyTypeKey,
    operationalStatus: row.operationalStatus,
    isPublicBrowseable: row.isPublicBrowseable,
    isLegacySnapshot: row.isLegacySnapshot,
    title: row.title,
  };
}

/* ───────────────────────────── Notification providers ─────────────────────────── */

export interface NotificationDeliveryInput {
  userId: string;
  type: string;
  titleKey: string;
  bodyKey: string;
  payload: Record<string, unknown>;
  dedupeKey: string;
  listingId?: string | null;
  savedSearchId?: string | null;
  sourceEventId?: string | null;
}

export interface NotificationDeliveryResult {
  delivered: boolean;
  notificationId?: string;
  skippedReason?: 'duplicate';
}

export interface NotificationProvider {
  deliver(db: Db, input: NotificationDeliveryInput): Promise<NotificationDeliveryResult>;
}

/** Owner-scoped, dedupe-safe insert — the row of record for every 4B notification. */
export async function createInAppNotification(
  db: Db,
  input: NotificationDeliveryInput,
): Promise<typeof schema.inAppNotifications.$inferSelect | null> {
  const [row] = await db
    .insert(schema.inAppNotifications)
    .values({
      userId: input.userId,
      type: input.type,
      titleKey: input.titleKey,
      bodyKey: input.bodyKey,
      payload: input.payload ?? {},
      dedupeKey: input.dedupeKey,
      listingId: input.listingId ?? null,
      savedSearchId: input.savedSearchId ?? null,
      sourceEventId: input.sourceEventId ?? null,
    })
    .onConflictDoNothing({ target: schema.inAppNotifications.dedupeKey })
    .returning();
  return row ?? null;
}

/** Production/dev boundary (ADR-030): writes the notification + a delivery attempt row. */
export class InAppNotificationProvider implements NotificationProvider {
  async deliver(db: Db, input: NotificationDeliveryInput): Promise<NotificationDeliveryResult> {
    const row = await createInAppNotification(db, input);
    if (!row) return { delivered: false, skippedReason: 'duplicate' };
    await db.insert(schema.notificationDeliveries).values({
      notificationId: row.id,
      provider: 'in_app',
      status: 'delivered',
    });
    return { delivered: true, notificationId: row.id };
  }
}

/** Test-only capture provider — no DB writes, just records what would have been delivered. */
export class TestNotificationProvider implements NotificationProvider {
  delivered: NotificationDeliveryInput[] = [];

  async deliver(_db: Db, input: NotificationDeliveryInput): Promise<NotificationDeliveryResult> {
    this.delivered.push(input);
    return { delivered: true };
  }
}

/* ───────────────────────────── Saved searches ─────────────────────────── */

function toIndexedValues(criteria: SavedSearchCriteriaV1) {
  const idx = indexedColumnsFromCriteria(criteria);
  return {
    sort: criteria.sort,
    idxMinPrice: idx.idxMinPrice,
    idxMaxPrice: idx.idxMaxPrice,
    idxMinBedrooms: idx.idxMinBedrooms,
    idxMunicipality: idx.idxMunicipality,
    idxProvince: idx.idxProvince,
    idxPropertyType: idx.idxPropertyType,
    idxOffPlan: idx.idxOffPlan,
  };
}

export async function listSavedSearches(db: Db, userId: string) {
  return db
    .select()
    .from(schema.savedSearches)
    .where(eq(schema.savedSearches.userId, userId))
    .orderBy(desc(schema.savedSearches.updatedAt));
}

export async function getSavedSearch(db: Db, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(schema.savedSearches)
    .where(and(eq(schema.savedSearches.id, id), eq(schema.savedSearches.userId, userId)))
    .limit(1);
  if (!row) throw new BuyerWorkspaceError('not_found', 'not_found', 404);
  return row;
}

export async function createSavedSearch(
  db: Db,
  userId: string,
  input: { name: string; criteria?: unknown },
) {
  const name = input.name.trim().slice(0, 120) || 'Saved search';
  const normalized = normalizeSavedSearchCriteria(input.criteria);
  const hash = hashSavedSearchCriteria(normalized);

  const existing = await db
    .select({ id: schema.savedSearches.id })
    .from(schema.savedSearches)
    .where(eq(schema.savedSearches.userId, userId));
  if (existing.length >= MAX_SAVED_SEARCHES_PER_USER) {
    throw new BuyerWorkspaceError('saved_search_limit', 'saved_search_limit', 400);
  }

  try {
    const [row] = await db
      .insert(schema.savedSearches)
      .values({
        userId,
        name,
        criteria: normalized,
        criteriaVersion: SAVED_SEARCH_CRITERIA_VERSION,
        criteriaHash: hash,
        ...toIndexedValues(normalized),
      })
      .returning();
    return row!;
  } catch {
    throw new BuyerWorkspaceError('duplicate_criteria', 'duplicate_criteria', 409);
  }
}

export async function updateSavedSearch(
  db: Db,
  userId: string,
  id: string,
  input: { name?: string; criteria?: unknown },
) {
  await getSavedSearch(db, userId, id);

  const patch: Partial<typeof schema.savedSearches.$inferInsert> = { updatedAt: new Date() };
  if (input.name != null) {
    const name = input.name.trim().slice(0, 120);
    if (!name) throw new BuyerWorkspaceError('name_required', 'name_required');
    patch.name = name;
  }
  if (input.criteria !== undefined) {
    const normalized = normalizeSavedSearchCriteria(input.criteria);
    patch.criteria = normalized;
    patch.criteriaVersion = SAVED_SEARCH_CRITERIA_VERSION;
    patch.criteriaHash = hashSavedSearchCriteria(normalized);
    Object.assign(patch, toIndexedValues(normalized));
  }

  try {
    const [row] = await db
      .update(schema.savedSearches)
      .set(patch)
      .where(eq(schema.savedSearches.id, id))
      .returning();
    return row!;
  } catch {
    throw new BuyerWorkspaceError('duplicate_criteria', 'duplicate_criteria', 409);
  }
}

export async function deleteSavedSearch(db: Db, userId: string, id: string) {
  const deleted = await db
    .delete(schema.savedSearches)
    .where(and(eq(schema.savedSearches.id, id), eq(schema.savedSearches.userId, userId)))
    .returning();
  if (!deleted[0]) throw new BuyerWorkspaceError('not_found', 'not_found', 404);
  return deleted[0];
}

const VALID_ALERT_TYPES = new Set<string>(ALERT_TYPE_OPTIONS);

export async function setSavedSearchAlerts(
  db: Db,
  userId: string,
  id: string,
  input: { enabled: boolean; alertTypes?: string[] },
) {
  const owned = await getSavedSearch(db, userId, id);
  const now = new Date();

  if (!input.enabled) {
    const [row] = await db
      .update(schema.savedSearches)
      .set({ alertsEnabled: false, disabledAt: now, updatedAt: now })
      .where(eq(schema.savedSearches.id, id))
      .returning();
    return row!;
  }

  const requested = (input.alertTypes ?? []).filter((t) => VALID_ALERT_TYPES.has(t));
  const alertTypes = requested.length > 0 ? requested : defaultAlertTypesOnEnable();
  const [row] = await db
    .update(schema.savedSearches)
    .set({
      alertsEnabled: true,
      alertTypes: alertTypes as AlertType[] as unknown as string[],
      consentedAt: owned.consentedAt ?? now,
      disabledAt: null,
      updatedAt: now,
    })
    .where(eq(schema.savedSearches.id, id))
    .returning();
  return row!;
}

export interface SavedSearchEvaluationResult {
  matchCount: number;
  newMatchCount: number;
  status: 'completed' | 'failed';
}

/**
 * Manual/test-triggered evaluation (D14). Loads public-browseable listings, applies the
 * deterministic domain matcher, diffs against `saved_search_last_matches`, and emits `new_match`
 * notifications only for genuinely new listings — the first-ever evaluation seeds the baseline
 * without notifying (avoids "discovering" every pre-existing result as new).
 */
export async function evaluateSavedSearch(
  db: Db,
  userId: string,
  savedSearchId: string,
  trigger: 'manual' | 'test',
  provider: NotificationProvider = new InAppNotificationProvider(),
): Promise<SavedSearchEvaluationResult> {
  const search = await getSavedSearch(db, userId, savedSearchId);

  const [{ id: runId }] = await db
    .insert(schema.savedSearchEvaluationRuns)
    .values({ savedSearchId, status: 'running', trigger })
    .returning({ id: schema.savedSearchEvaluationRuns.id });

  try {
    const criteria = normalizeSavedSearchCriteria(search.criteria);
    const listings = await db
      .select()
      .from(schema.propertyListings)
      .where(eq(schema.propertyListings.isPublicBrowseable, true));
    const matched = listings
      .filter((l) =>
        matchesListing(criteria, listingRowToMatchFacts(l), { allowLegacy: allowLegacyAlerts() }),
      )
      .map((l) => l.id);
    const matchedSet = new Set(matched);

    const existingMatches = await db
      .select()
      .from(schema.savedSearchLastMatches)
      .where(eq(schema.savedSearchLastMatches.savedSearchId, savedSearchId));
    const existingIds = new Set(existingMatches.map((m) => m.listingId));
    const isFirstRun = search.lastEvaluatedAt == null;
    const newIds = matched.filter((id) => !existingIds.has(id));

    for (const id of newIds) {
      await db
        .insert(schema.savedSearchLastMatches)
        .values({ savedSearchId, listingId: id })
        .onConflictDoNothing();
    }
    for (const existing of existingMatches) {
      if (!matchedSet.has(existing.listingId)) {
        await db
          .delete(schema.savedSearchLastMatches)
          .where(
            and(
              eq(schema.savedSearchLastMatches.savedSearchId, savedSearchId),
              eq(schema.savedSearchLastMatches.listingId, existing.listingId),
            ),
          );
      }
    }

    let newMatchCount = 0;
    const shouldNotifyNewMatch =
      !isFirstRun && search.alertsEnabled && search.alertTypes.includes('new_match');
    if (shouldNotifyNewMatch) {
      for (const listingId of newIds) {
        const dedupeKey = notificationDedupeKey({
          userId,
          type: 'new_match',
          listingId,
          sourceEventId: runId,
        });
        const result = await provider.deliver(db, {
          userId,
          type: 'new_match',
          titleKey: 'notifications.new_match.title',
          bodyKey: 'notifications.new_match.body',
          payload: { listingId, savedSearchId },
          dedupeKey,
          listingId,
          savedSearchId,
          sourceEventId: runId,
        });
        if (result.delivered) newMatchCount += 1;
      }
    }

    const now = new Date();
    await db
      .update(schema.savedSearchEvaluationRuns)
      .set({ finishedAt: now, status: 'completed', matchCount: matched.length })
      .where(eq(schema.savedSearchEvaluationRuns.id, runId));
    await db
      .update(schema.savedSearches)
      .set({
        lastEvaluatedAt: now,
        lastMatchCount: matched.length,
        lastEvaluationStatus: 'completed',
        updatedAt: now,
      })
      .where(eq(schema.savedSearches.id, savedSearchId));

    return { matchCount: matched.length, newMatchCount, status: 'completed' };
  } catch (error) {
    const now = new Date();
    await db
      .update(schema.savedSearchEvaluationRuns)
      .set({ finishedAt: now, status: 'failed', errorCode: 'evaluation_error' })
      .where(eq(schema.savedSearchEvaluationRuns.id, runId));
    await db
      .update(schema.savedSearches)
      .set({ lastEvaluationStatus: 'failed', updatedAt: now })
      .where(eq(schema.savedSearches.id, savedSearchId));
    throw error;
  }
}

/** Alias kept for API-route readability; identical semantics to `evaluateSavedSearch`. */
export async function runSavedSearch(
  db: Db,
  userId: string,
  savedSearchId: string,
  provider?: NotificationProvider,
): Promise<SavedSearchEvaluationResult> {
  return evaluateSavedSearch(db, userId, savedSearchId, 'manual', provider);
}

/**
 * Scheduler seam (D14): evaluates every alert-enabled saved search. Not wired to production
 * cron/pg-boss in 4B — exercised only via `InlineJobRunner` / `TestJobRunner` and tests.
 */
export async function evaluateAllDueSavedSearches(
  db: Db,
  provider: NotificationProvider = new InAppNotificationProvider(),
): Promise<{ evaluated: number }> {
  const due = await db
    .select({ id: schema.savedSearches.id, userId: schema.savedSearches.userId })
    .from(schema.savedSearches)
    .where(eq(schema.savedSearches.alertsEnabled, true));
  let evaluated = 0;
  for (const row of due) {
    await evaluateSavedSearch(db, row.userId, row.id, 'test', provider);
    evaluated += 1;
  }
  return { evaluated };
}

/* ───────────────────────────── Browsing history ─────────────────────────── */

export async function recordPropertyView(
  db: Db,
  userId: string,
  input: {
    listingId: string;
    physicalPropertyId?: string | null;
    channel?: string;
    context?: Record<string, unknown> | null;
  },
): Promise<typeof schema.browsingHistory.$inferSelect | null> {
  const [prefs] = await db
    .select()
    .from(schema.notificationPreferences)
    .where(eq(schema.notificationPreferences.userId, userId))
    .limit(1);
  if (prefs && !prefs.historyRecordingEnabled) return null;

  const now = new Date();
  const [row] = await db
    .insert(schema.browsingHistory)
    .values({
      userId,
      listingId: input.listingId,
      physicalPropertyId: input.physicalPropertyId ?? null,
      firstViewedAt: now,
      lastViewedAt: now,
      viewCount: 1,
      channel: input.channel ?? 'web',
      context: input.context ?? null,
    })
    .onConflictDoUpdate({
      target: [schema.browsingHistory.userId, schema.browsingHistory.listingId],
      set: {
        lastViewedAt: now,
        viewCount: sql`${schema.browsingHistory.viewCount} + 1`,
        updatedAt: now,
      },
    })
    .returning();
  return row ?? null;
}

export interface RecentlyViewedItem {
  listingId: string;
  title: string;
  priceAmount: number | null;
  currency: string;
  bedrooms: number | null;
  builtAreaSqm: number | null;
  areaLabel: string | null;
  isLegacySnapshot: boolean;
  operationalStatus: string;
  firstViewedAt: string;
  lastViewedAt: string;
  viewCount: number;
}

export async function listRecentlyViewed(db: Db, userId: string): Promise<RecentlyViewedItem[]> {
  await expireOldHistory(db, { userId });
  const rows = await db
    .select({ history: schema.browsingHistory, listing: schema.propertyListings })
    .from(schema.browsingHistory)
    .innerJoin(
      schema.propertyListings,
      eq(schema.browsingHistory.listingId, schema.propertyListings.id),
    )
    .where(eq(schema.browsingHistory.userId, userId))
    .orderBy(desc(schema.browsingHistory.lastViewedAt))
    .limit(MAX_BROWSING_HISTORY);

  return rows.map((r) => ({
    listingId: r.listing.id,
    title: r.listing.title,
    priceAmount: r.listing.priceAmount == null ? null : Number(r.listing.priceAmount),
    currency: r.listing.currency,
    bedrooms: r.listing.bedrooms,
    builtAreaSqm: r.listing.builtAreaSqm == null ? null : Number(r.listing.builtAreaSqm),
    areaLabel: r.listing.areaLabel,
    isLegacySnapshot: r.listing.isLegacySnapshot,
    operationalStatus: r.listing.operationalStatus,
    firstViewedAt: r.history.firstViewedAt.toISOString(),
    lastViewedAt: r.history.lastViewedAt.toISOString(),
    viewCount: r.history.viewCount,
  }));
}

export async function removeHistoryItem(db: Db, userId: string, listingId: string): Promise<void> {
  await db
    .delete(schema.browsingHistory)
    .where(
      and(
        eq(schema.browsingHistory.userId, userId),
        eq(schema.browsingHistory.listingId, listingId),
      ),
    );
}

export async function clearBrowsingHistory(db: Db, userId: string): Promise<void> {
  await db.delete(schema.browsingHistory).where(eq(schema.browsingHistory.userId, userId));
}

/** Retention prune (D5, default 90 days, `BUYER_HISTORY_RETENTION_DAYS`). Always user-clearable. */
export async function expireOldHistory(
  db: Db,
  options?: { userId?: string; retentionDays?: number },
): Promise<number> {
  const retentionDays = options?.retentionDays ?? historyRetentionDays();
  const cutoffIso = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const where = options?.userId
    ? and(
        eq(schema.browsingHistory.userId, options.userId),
        sql`${schema.browsingHistory.lastViewedAt} < ${cutoffIso}::timestamptz`,
      )
    : sql`${schema.browsingHistory.lastViewedAt} < ${cutoffIso}::timestamptz`;
  const deleted = await db
    .delete(schema.browsingHistory)
    .where(where)
    .returning({ id: schema.browsingHistory.id });
  return deleted.length;
}

/* ───────────────────────────── In-app notifications ─────────────────────────── */

export async function listNotifications(
  db: Db,
  userId: string,
  options?: { includeArchived?: boolean },
) {
  const where = options?.includeArchived
    ? eq(schema.inAppNotifications.userId, userId)
    : and(
        eq(schema.inAppNotifications.userId, userId),
        sql`${schema.inAppNotifications.archivedAt} IS NULL`,
      );
  return db
    .select()
    .from(schema.inAppNotifications)
    .where(where)
    .orderBy(desc(schema.inAppNotifications.createdAt))
    .limit(100);
}

export async function unreadCount(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.inAppNotifications)
    .where(
      and(
        eq(schema.inAppNotifications.userId, userId),
        sql`${schema.inAppNotifications.readAt} IS NULL`,
        sql`${schema.inAppNotifications.archivedAt} IS NULL`,
      ),
    );
  return row?.c ?? 0;
}

export async function markNotificationRead(db: Db, userId: string, id: string) {
  const [row] = await db
    .update(schema.inAppNotifications)
    .set({ readAt: new Date() })
    .where(and(eq(schema.inAppNotifications.id, id), eq(schema.inAppNotifications.userId, userId)))
    .returning();
  if (!row) throw new BuyerWorkspaceError('not_found', 'not_found', 404);
  return row;
}

export async function markAllNotificationsRead(db: Db, userId: string): Promise<number> {
  const rows = await db
    .update(schema.inAppNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.inAppNotifications.userId, userId),
        sql`${schema.inAppNotifications.readAt} IS NULL`,
      ),
    )
    .returning({ id: schema.inAppNotifications.id });
  return rows.length;
}

export async function dismissNotification(db: Db, userId: string, id: string) {
  const [row] = await db
    .update(schema.inAppNotifications)
    .set({ archivedAt: new Date() })
    .where(and(eq(schema.inAppNotifications.id, id), eq(schema.inAppNotifications.userId, userId)))
    .returning();
  if (!row) throw new BuyerWorkspaceError('not_found', 'not_found', 404);
  return row;
}

/** Optional archive purge — deletes already-dismissed notifications past retention. */
export async function cleanExpiredNotifications(
  db: Db,
  options?: { retentionDays?: number },
): Promise<number> {
  const retentionDays = options?.retentionDays ?? 180;
  const cutoffIso = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const deleted = await db
    .delete(schema.inAppNotifications)
    .where(
      and(
        isNotNull(schema.inAppNotifications.archivedAt),
        sql`${schema.inAppNotifications.archivedAt} < ${cutoffIso}::timestamptz`,
      ),
    )
    .returning({ id: schema.inAppNotifications.id });
  return deleted.length;
}

/* ───────────────────────────── Listing change fan-out ─────────────────────────── */

export type ListingChangeType =
  | 'price_reduction'
  | 'price_increase'
  | 'status_reserved'
  | 'status_under_offer'
  | 'listing_withdrawn'
  | 'listing_stale';

export interface ListingChangeEvent {
  listingId: string;
  type: ListingChangeType;
  sourceEventId: string;
  priceFrom?: number | null;
  priceTo?: number | null;
  statusFrom?: string | null;
  statusTo?: string | null;
}

const PRICE_EVENT_TYPES = new Set<ListingChangeType>(['price_reduction', 'price_increase']);

/**
 * Fan-out from a listing price/status event (Feature 6). `sourceEventId` is the originating
 * `listing_price_history` / `listing_status_history` row id so re-running the same mutation
 * (e.g. a retried admin action) never double-notifies (`notificationDedupeKey`).
 */
export async function generateListingChangeNotifications(
  db: Db,
  event: ListingChangeEvent,
  provider: NotificationProvider = new InAppNotificationProvider(),
): Promise<{ notified: number }> {
  const [listing] = await db
    .select()
    .from(schema.propertyListings)
    .where(eq(schema.propertyListings.id, event.listingId))
    .limit(1);
  if (!listing) return { notified: 0 };
  if (listing.isLegacySnapshot || listing.operationalStatus === 'legacy_snapshot') {
    return { notified: 0 };
  }

  const userIds = new Set<string>();

  if (PRICE_EVENT_TYPES.has(event.type)) {
    const searches = await db
      .select()
      .from(schema.savedSearches)
      .where(eq(schema.savedSearches.alertsEnabled, true));
    for (const search of searches) {
      if (!search.alertTypes.includes(event.type)) continue;
      const [lastMatch] = await db
        .select()
        .from(schema.savedSearchLastMatches)
        .where(
          and(
            eq(schema.savedSearchLastMatches.savedSearchId, search.id),
            eq(schema.savedSearchLastMatches.listingId, event.listingId),
          ),
        )
        .limit(1);
      let matches = Boolean(lastMatch);
      if (!matches) {
        try {
          const criteria = normalizeSavedSearchCriteria(search.criteria);
          matches = matchesListing(criteria, listingRowToMatchFacts(listing));
        } catch {
          matches = false;
        }
      }
      if (matches) userIds.add(search.userId);
    }
  } else {
    const shortlisted = await db
      .select({ userId: schema.shortlists.userId })
      .from(schema.shortlistItems)
      .innerJoin(schema.shortlists, eq(schema.shortlistItems.shortlistId, schema.shortlists.id))
      .where(eq(schema.shortlistItems.listingId, event.listingId));
    for (const row of shortlisted) userIds.add(row.userId);

    const lastMatched = await db
      .select({ userId: schema.savedSearches.userId })
      .from(schema.savedSearchLastMatches)
      .innerJoin(
        schema.savedSearches,
        eq(schema.savedSearchLastMatches.savedSearchId, schema.savedSearches.id),
      )
      .where(eq(schema.savedSearchLastMatches.listingId, event.listingId));
    for (const row of lastMatched) userIds.add(row.userId);
  }

  let notified = 0;
  for (const userId of userIds) {
    const dedupeKey = notificationDedupeKey({
      userId,
      type: event.type,
      listingId: event.listingId,
      sourceEventId: event.sourceEventId,
    });
    const result = await provider.deliver(db, {
      userId,
      type: event.type,
      titleKey: `notifications.${event.type}.title`,
      bodyKey: `notifications.${event.type}.body`,
      payload: {
        listingId: event.listingId,
        priceFrom: event.priceFrom ?? null,
        priceTo: event.priceTo ?? null,
        statusFrom: event.statusFrom ?? null,
        statusTo: event.statusTo ?? null,
      },
      dedupeKey,
      listingId: event.listingId,
      sourceEventId: event.sourceEventId,
    });
    if (result.delivered) notified += 1;
  }

  return { notified };
}
