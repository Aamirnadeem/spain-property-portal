import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  COMPARISON_MAX_ITEMS,
  COMPARISON_MIN_ITEMS,
  MAX_ITEMS_PER_SHORTLIST,
  MAX_SHORTLISTS_PER_USER,
  SAVED_SEARCH_CRITERIA_VERSION,
  SCORE_MODEL_VERSION,
  defaultAlertTypesOnEnable,
  indexedColumnsFromCriteria,
  mergeGuestWorkspace,
  normalizeSavedSearchCriteria,
  scoreComparisonSet,
  validateComparisonWeights,
  type ComparisonListingFacts,
  type ComparisonWeights,
  type GuestWorkspaceSnapshot,
  type SuitabilityScoreResult,
} from '@spain/domain';
import { createHash, randomBytes } from 'node:crypto';
import * as schema from '../schema/index';
import type { GuestWorkspacePayload } from '../schema/index';

type Db = PostgresJsDatabase<typeof schema>;

export const DEFAULT_SHORTLIST_NAME = 'My shortlist';

export class BuyerWorkspaceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'BuyerWorkspaceError';
  }
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function ensureDefaultShortlist(db: Db, userId: string) {
  const existing = await db
    .select()
    .from(schema.shortlists)
    .where(eq(schema.shortlists.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0];
  const [row] = await db
    .insert(schema.shortlists)
    .values({ userId, name: DEFAULT_SHORTLIST_NAME, isDefault: true })
    .returning();
  return row!;
}

export async function listShortlists(db: Db, userId: string) {
  const lists = await db
    .select()
    .from(schema.shortlists)
    .where(eq(schema.shortlists.userId, userId))
    .orderBy(desc(schema.shortlists.isDefault), asc(schema.shortlists.name));

  const result = [];
  for (const list of lists) {
    const items = await db
      .select()
      .from(schema.shortlistItems)
      .where(eq(schema.shortlistItems.shortlistId, list.id))
      .orderBy(asc(schema.shortlistItems.position));
    const [note] = await db
      .select()
      .from(schema.shortlistNotes)
      .where(eq(schema.shortlistNotes.shortlistId, list.id))
      .limit(1);
    result.push({
      ...list,
      itemCount: items.length,
      listingIds: items.map((i) => i.listingId),
      note: note?.body ?? null,
      noteUpdatedAt: note?.updatedAt?.toISOString() ?? null,
    });
  }
  return result;
}

export async function createShortlist(
  db: Db,
  userId: string,
  input: { name: string; isDefault?: boolean },
) {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new BuyerWorkspaceError('name_required', 'name_required');

  const existing = await db
    .select({ id: schema.shortlists.id })
    .from(schema.shortlists)
    .where(eq(schema.shortlists.userId, userId));
  if (existing.length >= MAX_SHORTLISTS_PER_USER) {
    throw new BuyerWorkspaceError('shortlist_limit', 'shortlist_limit', 400);
  }

  const makeDefault = Boolean(input.isDefault) || existing.length === 0;

  return await db.transaction(async (tx) => {
    if (makeDefault) {
      await tx
        .update(schema.shortlists)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(schema.shortlists.userId, userId));
    }
    try {
      const [row] = await tx
        .insert(schema.shortlists)
        .values({ userId, name, isDefault: makeDefault })
        .returning();
      return row!;
    } catch {
      throw new BuyerWorkspaceError('name_taken', 'name_taken', 409);
    }
  });
}

export async function updateShortlist(
  db: Db,
  userId: string,
  shortlistId: string,
  input: { name?: string },
) {
  const [owned] = await db
    .select()
    .from(schema.shortlists)
    .where(and(eq(schema.shortlists.id, shortlistId), eq(schema.shortlists.userId, userId)))
    .limit(1);
  if (!owned) throw new BuyerWorkspaceError('not_found', 'not_found', 404);

  const name = input.name?.trim().slice(0, 80);
  if (name != null && !name) throw new BuyerWorkspaceError('name_required', 'name_required');

  try {
    const [row] = await db
      .update(schema.shortlists)
      .set({
        ...(name != null ? { name } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.shortlists.id, shortlistId))
      .returning();
    return row!;
  } catch {
    throw new BuyerWorkspaceError('name_taken', 'name_taken', 409);
  }
}

export async function setDefaultShortlist(db: Db, userId: string, shortlistId: string) {
  return await db.transaction(async (tx) => {
    const [owned] = await tx
      .select()
      .from(schema.shortlists)
      .where(and(eq(schema.shortlists.id, shortlistId), eq(schema.shortlists.userId, userId)))
      .limit(1);
    if (!owned) throw new BuyerWorkspaceError('not_found', 'not_found', 404);

    await tx
      .update(schema.shortlists)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(schema.shortlists.userId, userId));
    const [row] = await tx
      .update(schema.shortlists)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(schema.shortlists.id, shortlistId))
      .returning();
    return row!;
  });
}

export async function deleteShortlist(db: Db, userId: string, shortlistId: string) {
  const deleted = await db
    .delete(schema.shortlists)
    .where(and(eq(schema.shortlists.id, shortlistId), eq(schema.shortlists.userId, userId)))
    .returning();
  if (!deleted[0]) throw new BuyerWorkspaceError('not_found', 'not_found', 404);
  return deleted[0];
}

export async function addPropertyToShortlist(
  db: Db,
  userId: string,
  shortlistId: string,
  listingId: string,
) {
  const [owned] = await db
    .select()
    .from(schema.shortlists)
    .where(and(eq(schema.shortlists.id, shortlistId), eq(schema.shortlists.userId, userId)))
    .limit(1);
  if (!owned) throw new BuyerWorkspaceError('not_found', 'not_found', 404);

  const [listing] = await db
    .select({ id: schema.propertyListings.id })
    .from(schema.propertyListings)
    .where(eq(schema.propertyListings.id, listingId))
    .limit(1);
  if (!listing) throw new BuyerWorkspaceError('listing_not_found', 'listing_not_found', 404);

  const countRows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.shortlistItems)
    .where(eq(schema.shortlistItems.shortlistId, shortlistId));
  if ((countRows[0]?.c ?? 0) >= MAX_ITEMS_PER_SHORTLIST) {
    throw new BuyerWorkspaceError('item_limit', 'item_limit', 400);
  }

  await db
    .insert(schema.shortlistItems)
    .values({ shortlistId, listingId, position: countRows[0]?.c ?? 0 })
    .onConflictDoNothing();
}

export async function removePropertyFromShortlist(
  db: Db,
  userId: string,
  shortlistId: string,
  listingId: string,
) {
  const [owned] = await db
    .select()
    .from(schema.shortlists)
    .where(and(eq(schema.shortlists.id, shortlistId), eq(schema.shortlists.userId, userId)))
    .limit(1);
  if (!owned) throw new BuyerWorkspaceError('not_found', 'not_found', 404);

  await db
    .delete(schema.shortlistItems)
    .where(
      and(
        eq(schema.shortlistItems.shortlistId, shortlistId),
        eq(schema.shortlistItems.listingId, listingId),
      ),
    );
}

export async function updateShortlistNote(
  db: Db,
  userId: string,
  shortlistId: string,
  body: string,
) {
  const [owned] = await db
    .select()
    .from(schema.shortlists)
    .where(and(eq(schema.shortlists.id, shortlistId), eq(schema.shortlists.userId, userId)))
    .limit(1);
  if (!owned) throw new BuyerWorkspaceError('not_found', 'not_found', 404);

  const trimmed = body.slice(0, 4000);
  const [row] = await db
    .insert(schema.shortlistNotes)
    .values({ shortlistId, body: trimmed, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.shortlistNotes.shortlistId,
      set: { body: trimmed, updatedAt: new Date() },
    })
    .returning();
  return row!;
}

export async function updatePropertyNote(
  db: Db,
  userId: string,
  listingId: string,
  input: { body: string; positives?: string[]; negatives?: string[] },
) {
  const body = input.body.slice(0, 4000);
  const positives = (input.positives ?? []).slice(0, 10).map((s) => s.slice(0, 200));
  const negatives = (input.negatives ?? []).slice(0, 10).map((s) => s.slice(0, 200));

  const [row] = await db
    .insert(schema.propertyNotes)
    .values({ userId, listingId, body, positives, negatives })
    .onConflictDoUpdate({
      target: [schema.propertyNotes.userId, schema.propertyNotes.listingId],
      set: { body, positives, negatives, updatedAt: new Date() },
    })
    .returning();
  return row!;
}

export async function getPropertyNote(db: Db, userId: string, listingId: string) {
  const [row] = await db
    .select()
    .from(schema.propertyNotes)
    .where(
      and(eq(schema.propertyNotes.userId, userId), eq(schema.propertyNotes.listingId, listingId)),
    )
    .limit(1);
  return row ?? null;
}

export async function deletePropertyNote(db: Db, userId: string, listingId: string) {
  await db
    .delete(schema.propertyNotes)
    .where(
      and(eq(schema.propertyNotes.userId, userId), eq(schema.propertyNotes.listingId, listingId)),
    );
}

export async function updateComparisonWeights(
  db: Db,
  userId: string,
  weights: Record<string, unknown>,
) {
  const validated = validateComparisonWeights(weights);
  return await db.transaction(async (tx) => {
    await tx
      .update(schema.userPreferenceProfiles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.userPreferenceProfiles.userId, userId));

    const existing = await tx
      .select()
      .from(schema.userPreferenceProfiles)
      .where(eq(schema.userPreferenceProfiles.userId, userId))
      .limit(1);

    if (existing[0]) {
      const [row] = await tx
        .update(schema.userPreferenceProfiles)
        .set({
          weights: validated,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.userPreferenceProfiles.id, existing[0].id))
        .returning();
      return row!;
    }

    const [row] = await tx
      .insert(schema.userPreferenceProfiles)
      .values({
        userId,
        name: 'Default',
        weights: validated,
        isActive: true,
      })
      .returning();
    return row!;
  });
}

export async function getActivePreferenceProfile(db: Db, userId: string) {
  const [row] = await db
    .select()
    .from(schema.userPreferenceProfiles)
    .where(
      and(
        eq(schema.userPreferenceProfiles.userId, userId),
        eq(schema.userPreferenceProfiles.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

function listingToFacts(row: typeof schema.propertyListings.$inferSelect): ComparisonListingFacts {
  return {
    listingId: row.id,
    priceAmount: toNumber(row.priceAmount),
    pricePerSqm: toNumber(row.pricePerSqm),
    builtAreaSqm: toNumber(row.builtAreaSqm),
    usableAreaSqm: null,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    areaLabel: row.areaLabel,
    environmentType: row.environmentType,
    commuteMin: row.commuteMin,
    beachProximity: row.beachProximity,
    parkProximity: row.parkProximity,
    condition: null,
    energyRating: null,
    hasOutdoorSpace: null,
    accessibilityFeature: null,
    lastConfirmedAvailableAt: row.lastConfirmedAvailableAt?.toISOString() ?? null,
  };
}

function cell<T>(value: T | null | undefined): {
  status: 'available' | 'unavailable';
  value?: T;
  reason?: 'not_in_source';
} {
  if (value == null || value === '') {
    return { status: 'unavailable', reason: 'not_in_source' };
  }
  return { status: 'available', value };
}

export async function getComparison(
  db: Db,
  userId: string,
  input: {
    listingIds: string[];
    includeNotes?: boolean;
    weights?: ComparisonWeights;
    comparisonSetId?: string;
  },
) {
  const listingIds = [...new Set(input.listingIds)];
  if (listingIds.length < COMPARISON_MIN_ITEMS || listingIds.length > COMPARISON_MAX_ITEMS) {
    throw new BuyerWorkspaceError('comparison_size', 'comparison_size', 400);
  }

  const listings = await db
    .select()
    .from(schema.propertyListings)
    .where(inArray(schema.propertyListings.id, listingIds));

  if (listings.length !== listingIds.length) {
    throw new BuyerWorkspaceError('listing_not_found', 'listing_not_found', 404);
  }

  const ordered = listingIds.map((id) => listings.find((l) => l.id === id)!).filter(Boolean);

  const facts = ordered.map(listingToFacts);
  let weights = input.weights;
  if (!weights) {
    const profile = await getActivePreferenceProfile(db, userId);
    weights = (profile?.weights as ComparisonWeights) ?? { price: 5, size: 5, location: 5 };
  } else {
    weights = validateComparisonWeights(weights as Record<string, unknown>);
  }

  const scores = scoreComparisonSet(facts, weights);
  const scoreById = new Map(scores.map((s) => [s.listingId, s]));

  const notesByListing = new Map<
    string,
    { body: string; positives: string[]; negatives: string[] }
  >();
  if (input.includeNotes) {
    const notes = await db
      .select()
      .from(schema.propertyNotes)
      .where(eq(schema.propertyNotes.userId, userId));
    for (const n of notes) {
      if (listingIds.includes(n.listingId)) {
        notesByListing.set(n.listingId, {
          body: n.body,
          positives: n.positives ?? [],
          negatives: n.negatives ?? [],
        });
      }
    }
  }

  return {
    scoreModelVersion: SCORE_MODEL_VERSION,
    disclaimerKey: 'suitability_not_valuation' as const,
    weights,
    listings: ordered.map((row) => {
      const note = notesByListing.get(row.id);
      return {
        listingId: row.id,
        title: row.title,
        cells: {
          askingPrice: cell(toNumber(row.priceAmount)),
          pricePerSqm: cell(toNumber(row.pricePerSqm)),
          bedrooms: cell(row.bedrooms),
          bathrooms: cell(row.bathrooms),
          builtAreaSqm: cell(toNumber(row.builtAreaSqm)),
          usableAreaSqm: cell(null),
          propertyType: cell(row.propertyTypeKey),
          condition: cell(null),
          energyRating: cell(null),
          location: cell(row.areaLabel ?? row.addressText),
          environmentType: cell(row.environmentType),
          transport: cell(row.nearestTransit),
          commuteMin: cell(row.commuteMin),
          beachProximity: cell(row.beachProximity),
          parkProximity: cell(row.parkProximity),
          schoolProximity: cell(null),
          hospitalProximity: cell(null),
          freshness: cell(row.lastConfirmedAvailableAt?.toISOString() ?? row.freshnessMethod),
          source: cell(row.portalName),
          offPlan: cell(null),
          recurringExpenses: cell(null),
          buyerNotes: input.includeNotes
            ? note
              ? { status: 'available' as const, value: note }
              : { status: 'unavailable' as const, reason: 'not_in_source' as const }
            : { status: 'unavailable' as const, reason: 'not_applicable' as const },
        },
        score: scoreById.get(row.id) as SuitabilityScoreResult,
      };
    }),
  };
}

export async function createComparison(
  db: Db,
  userId: string,
  input: { listingIds: string[]; shortlistId?: string | null; weights?: ComparisonWeights },
) {
  const listingIds = [...new Set(input.listingIds)];
  if (listingIds.length < COMPARISON_MIN_ITEMS || listingIds.length > COMPARISON_MAX_ITEMS) {
    throw new BuyerWorkspaceError('comparison_size', 'comparison_size', 400);
  }

  const weightSnapshot = input.weights
    ? validateComparisonWeights(input.weights as Record<string, unknown>)
    : ((await getActivePreferenceProfile(db, userId))?.weights ?? null);

  return await db.transaction(async (tx) => {
    const [set] = await tx
      .insert(schema.comparisonSets)
      .values({
        userId,
        shortlistId: input.shortlistId ?? null,
        weightSnapshot,
      })
      .returning();

    await tx.insert(schema.comparisonItems).values(
      listingIds.map((listingId, position) => ({
        comparisonSetId: set!.id,
        listingId,
        position,
      })),
    );

    return set!;
  });
}

export async function updateComparisonSelection(
  db: Db,
  userId: string,
  comparisonSetId: string,
  listingIds: string[],
) {
  const ids = [...new Set(listingIds)];
  if (ids.length < COMPARISON_MIN_ITEMS || ids.length > COMPARISON_MAX_ITEMS) {
    throw new BuyerWorkspaceError('comparison_size', 'comparison_size', 400);
  }

  const [owned] = await db
    .select()
    .from(schema.comparisonSets)
    .where(
      and(eq(schema.comparisonSets.id, comparisonSetId), eq(schema.comparisonSets.userId, userId)),
    )
    .limit(1);
  if (!owned) throw new BuyerWorkspaceError('not_found', 'not_found', 404);

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.comparisonItems)
      .where(eq(schema.comparisonItems.comparisonSetId, comparisonSetId));
    await tx.insert(schema.comparisonItems).values(
      ids.map((listingId, position) => ({
        comparisonSetId,
        listingId,
        position,
      })),
    );
    await tx
      .update(schema.comparisonSets)
      .set({ updatedAt: new Date() })
      .where(eq(schema.comparisonSets.id, comparisonSetId));
  });
}

export function hashGuestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function mintGuestToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function getOrCreateGuestSession(
  db: Db,
  token: string,
  locale = 'en',
): Promise<{ session: typeof schema.guestSessions.$inferSelect; token: string }> {
  const hash = hashGuestToken(token);
  const [existing] = await db
    .select()
    .from(schema.guestSessions)
    .where(eq(schema.guestSessions.anonymousKeyHash, hash))
    .limit(1);
  if (existing) return { session: existing, token };

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  const [session] = await db
    .insert(schema.guestSessions)
    .values({
      anonymousKeyHash: hash,
      locale,
      expiresAt,
      payload: {
        favouriteListingIds: [],
        comparisonListingIds: [],
        recentViewListingIds: [],
        savedSearchCriteria: [],
        shortlists: [],
        preferenceWeights: {},
        propertyNotes: [],
      },
    })
    .returning();
  return { session: session!, token };
}

export async function updateGuestPayload(
  db: Db,
  token: string,
  payload: GuestWorkspacePayload,
): Promise<typeof schema.guestSessions.$inferSelect> {
  const hash = hashGuestToken(token);
  const [row] = await db
    .update(schema.guestSessions)
    .set({ payload, updatedAt: new Date() })
    .where(eq(schema.guestSessions.anonymousKeyHash, hash))
    .returning();
  if (!row) throw new BuyerWorkspaceError('guest_not_found', 'guest_not_found', 404);
  return row;
}

/**
 * Transactional, idempotent guest → account merge.
 * Favourites preserved via onConflictDoNothing. Auth notes never overwritten.
 */
export async function mergeGuestWorkspaceIntoUser(
  db: Db,
  userId: string,
  input: {
    guestToken?: string | null;
    guestSessionId?: string | null;
    fallbackPayload?: GuestWorkspacePayload | null;
  },
) {
  return await db.transaction(async (tx) => {
    let guestRow: typeof schema.guestSessions.$inferSelect | null = null;
    if (input.guestToken) {
      const hash = hashGuestToken(input.guestToken);
      const [row] = await tx
        .select()
        .from(schema.guestSessions)
        .where(eq(schema.guestSessions.anonymousKeyHash, hash))
        .limit(1);
      guestRow = row ?? null;
      if (guestRow?.mergedIntoUserId === userId && guestRow.mergedAt) {
        await ensureDefaultShortlist(tx as unknown as Db, userId);
        return { alreadyMerged: true as const, guestSessionId: guestRow.id };
      }
    }

    const payload: GuestWorkspacePayload = guestRow?.payload ??
      input.fallbackPayload ?? {
        favouriteListingIds: [],
        comparisonListingIds: [],
        recentViewListingIds: [],
        savedSearchCriteria: [],
        shortlists: [],
        preferenceWeights: {},
        propertyNotes: [],
      };

    const favRows = await tx
      .select({ listingId: schema.favourites.listingId })
      .from(schema.favourites)
      .where(eq(schema.favourites.userId, userId));
    const shortlistRows = await tx
      .select()
      .from(schema.shortlists)
      .where(eq(schema.shortlists.userId, userId));
    const noteRows = await tx
      .select({ listingId: schema.propertyNotes.listingId })
      .from(schema.propertyNotes)
      .where(eq(schema.propertyNotes.userId, userId));
    const [activeProfile] = await tx
      .select()
      .from(schema.userPreferenceProfiles)
      .where(
        and(
          eq(schema.userPreferenceProfiles.userId, userId),
          eq(schema.userPreferenceProfiles.isActive, true),
        ),
      )
      .limit(1);
    const savedSearchRows = await tx
      .select()
      .from(schema.savedSearches)
      .where(eq(schema.savedSearches.userId, userId));
    const historyRows = await tx
      .select()
      .from(schema.browsingHistory)
      .where(eq(schema.browsingHistory.userId, userId));

    const guestSnap: GuestWorkspaceSnapshot = {
      guestSessionId: guestRow?.id ?? input.guestSessionId ?? 'client-fallback',
      favouriteListingIds: payload.favouriteListingIds ?? [],
      comparisonListingIds: payload.comparisonListingIds ?? [],
      recentViewListingIds: payload.recentViewListingIds ?? [],
      savedSearchCriteria: payload.savedSearchCriteria ?? [],
      shortlists: payload.shortlists,
      preferenceWeights: payload.preferenceWeights,
      propertyNotes: payload.propertyNotes,
      savedSearches: payload.savedSearches,
      browsingHistory: payload.browsingHistory,
    };

    const plan = mergeGuestWorkspace(guestSnap, {
      userId,
      favouriteListingIds: favRows.map((r) => r.listingId),
      comparisonListingIds: [],
      recentViewListingIds: [],
      savedSearchCriteria: [],
      shortlistNames: shortlistRows.map((s) => s.name),
      hasActivePreferenceProfile: Boolean(activeProfile),
      propertyNoteListingIds: noteRows.map((n) => n.listingId),
      savedSearchHashes: savedSearchRows.map((s) => s.criteriaHash),
      savedSearchNames: savedSearchRows.map((s) => s.name),
      browsingHistory: historyRows.map((h) => ({
        listingId: h.listingId,
        physicalPropertyId: h.physicalPropertyId ?? undefined,
        firstViewedAt: h.firstViewedAt.toISOString(),
        lastViewedAt: h.lastViewedAt.toISOString(),
        viewCount: h.viewCount,
        channel: h.channel,
        context: h.context ?? undefined,
      })),
    });

    for (const listingId of plan.favouriteListingIds) {
      await tx.insert(schema.favourites).values({ userId, listingId }).onConflictDoNothing();
    }

    await ensureDefaultShortlist(tx as unknown as Db, userId);

    for (const sl of plan.shortlists) {
      const [created] = await tx
        .insert(schema.shortlists)
        .values({ userId, name: sl.name, isDefault: false })
        .onConflictDoNothing()
        .returning();

      let shortlistId = created?.id;
      if (!shortlistId) {
        const [found] = await tx
          .select()
          .from(schema.shortlists)
          .where(and(eq(schema.shortlists.userId, userId), eq(schema.shortlists.name, sl.name)))
          .limit(1);
        shortlistId = found?.id;
      }
      if (!shortlistId) continue;

      for (const [position, listingId] of sl.listingIds.entries()) {
        await tx
          .insert(schema.shortlistItems)
          .values({ shortlistId, listingId, position })
          .onConflictDoNothing();
      }
      if (sl.note) {
        await tx
          .insert(schema.shortlistNotes)
          .values({ shortlistId, body: sl.note.slice(0, 4000), updatedAt: new Date() })
          .onConflictDoNothing();
      }
    }

    for (const note of plan.propertyNotesToInsert) {
      await tx
        .insert(schema.propertyNotes)
        .values({
          userId,
          listingId: note.listingId,
          body: note.body.slice(0, 4000),
          positives: (note.positives ?? []).slice(0, 10),
          negatives: (note.negatives ?? []).slice(0, 10),
        })
        .onConflictDoNothing();
    }

    if (plan.preferenceWeightsToApply) {
      try {
        const validated = validateComparisonWeights(plan.preferenceWeightsToApply);
        await tx.insert(schema.userPreferenceProfiles).values({
          userId,
          name: 'Default',
          weights: validated,
          isActive: true,
        });
      } catch {
        /* ignore invalid guest weights */
      }
    }

    if (plan.comparisonListingIds.length >= COMPARISON_MIN_ITEMS) {
      const ids = plan.comparisonListingIds.slice(0, COMPARISON_MAX_ITEMS);
      const [set] = await tx
        .insert(schema.comparisonSets)
        .values({ userId, weightSnapshot: plan.preferenceWeightsToApply })
        .returning();
      if (set) {
        await tx.insert(schema.comparisonItems).values(
          ids.map((listingId, position) => ({
            comparisonSetId: set.id,
            listingId,
            position,
          })),
        );
      }
    }

    for (const entry of plan.savedSearchesToInsert) {
      const normalized = normalizeSavedSearchCriteria(entry.criteria);
      const idx = indexedColumnsFromCriteria(normalized);
      const alertTypes =
        entry.alertsEnabled && entry.alertTypes.length === 0
          ? defaultAlertTypesOnEnable()
          : entry.alertTypes;
      await tx
        .insert(schema.savedSearches)
        .values({
          userId,
          name: entry.name,
          criteria: normalized,
          criteriaVersion: SAVED_SEARCH_CRITERIA_VERSION,
          criteriaHash: entry.criteriaHash,
          sort: normalized.sort,
          idxMinPrice: idx.idxMinPrice,
          idxMaxPrice: idx.idxMaxPrice,
          idxMinBedrooms: idx.idxMinBedrooms,
          idxMunicipality: idx.idxMunicipality,
          idxProvince: idx.idxProvince,
          idxPropertyType: idx.idxPropertyType,
          idxOffPlan: idx.idxOffPlan,
          alertsEnabled: entry.alertsEnabled,
          alertTypes,
          consentedAt: entry.alertsEnabled ? new Date() : null,
        })
        .onConflictDoNothing();
    }

    for (const h of plan.browsingHistoryMerged) {
      const firstIso = new Date(h.firstViewedAt).toISOString();
      const lastIso = new Date(h.lastViewedAt).toISOString();
      await tx
        .insert(schema.browsingHistory)
        .values({
          userId,
          listingId: h.listingId,
          physicalPropertyId: h.physicalPropertyId ?? null,
          firstViewedAt: new Date(firstIso),
          lastViewedAt: new Date(lastIso),
          viewCount: h.viewCount,
          channel: h.channel ?? 'web',
          context: h.context ?? null,
        })
        .onConflictDoUpdate({
          target: [schema.browsingHistory.userId, schema.browsingHistory.listingId],
          set: {
            firstViewedAt: sql`LEAST(${schema.browsingHistory.firstViewedAt}, ${firstIso}::timestamptz)`,
            lastViewedAt: sql`GREATEST(${schema.browsingHistory.lastViewedAt}, ${lastIso}::timestamptz)`,
            viewCount: h.viewCount,
            updatedAt: new Date(),
          },
        });
    }

    if (guestRow) {
      await tx
        .update(schema.guestSessions)
        .set({
          mergedIntoUserId: userId,
          mergedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.guestSessions.id, guestRow.id));
    }

    return {
      alreadyMerged: false as const,
      guestSessionId: guestRow?.id ?? null,
      favouriteCount: plan.favouriteListingIds.length,
      shortlistsMerged: plan.shortlists.length,
      savedSearchesMerged: plan.savedSearchesToInsert.length,
      browsingHistoryMerged: plan.browsingHistoryMerged.length,
    };
  });
}
