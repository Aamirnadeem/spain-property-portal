import { and, desc, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema/index';
import { recordAuditEvent } from './audit';
import { generateListingChangeNotifications, type ListingChangeEvent } from './phase4b-workspace';
import { withServiceRoleDb } from './service-role-db';

type Db = PostgresJsDatabase<typeof schema>;

/** Fan-out uses service-role so partner sessions can notify eligible buyers (B14). */
async function fanOutListingChange(event: ListingChangeEvent): Promise<void> {
  try {
    await withServiceRoleDb(process.env.DATABASE_URL, (serviceDb) =>
      generateListingChangeNotifications(serviceDb, event),
    );
  } catch (error) {
    console.error('generateListingChangeNotifications failed', error);
  }
}

export class NotFoundError extends Error {
  constructor(message = 'not_found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export async function listOrgListings(db: Db, organizationId: string) {
  return db
    .select()
    .from(schema.propertyListings)
    .where(eq(schema.propertyListings.organizationId, organizationId))
    .orderBy(desc(schema.propertyListings.updatedAt));
}

export async function getOrgListing(db: Db, organizationId: string, listingId: string) {
  const [row] = await db
    .select()
    .from(schema.propertyListings)
    .where(
      and(
        eq(schema.propertyListings.id, listingId),
        eq(schema.propertyListings.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) throw new NotFoundError('listing_not_found');
  return row;
}

/**
 * Agent-driven price update on an org-owned listing. Writes a price history row only when
 * the amount actually changes (mirrors the legacy importer's reimport-is-a-no-op rule).
 */
export async function updateOrgListingPrice(
  db: Db,
  input: { organizationId: string; listingId: string; actorUserId: string; priceAmount: number },
) {
  const listing = await getOrgListing(db, input.organizationId, input.listingId);
  const previousPrice = listing.priceAmount == null ? null : Number(listing.priceAmount);
  const now = new Date();

  await db
    .update(schema.propertyListings)
    .set({ priceAmount: String(input.priceAmount), updatedAt: now })
    .where(eq(schema.propertyListings.id, listing.id));

  if (previousPrice !== input.priceAmount) {
    const [historyRow] = await db
      .insert(schema.listingPriceHistory)
      .values({
        listingId: listing.id,
        currency: listing.currency,
        priceAmount: String(input.priceAmount),
        recordedAt: now,
        source: 'partner_update',
      })
      .returning();

    if (historyRow && previousPrice != null) {
      await fanOutListingChange({
        listingId: listing.id,
        type: input.priceAmount < previousPrice ? 'price_reduction' : 'price_increase',
        sourceEventId: historyRow.id,
        priceFrom: previousPrice,
        priceTo: input.priceAmount,
      });
    }
  }

  await recordAuditEvent(db, {
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    action: 'listing.price_update',
    entityType: 'property_listing',
    entityId: listing.id,
    before: { priceAmount: previousPrice },
    after: { priceAmount: input.priceAmount },
  });

  return getOrgListing(db, input.organizationId, input.listingId);
}

/**
 * Agent-driven withdrawal of their own org's already-published listing. Admin withdrawal
 * (any org) is a separate service in admin.ts.
 */
export async function withdrawOrgListing(
  db: Db,
  input: { organizationId: string; listingId: string; actorUserId: string; note?: string },
) {
  const listing = await getOrgListing(db, input.organizationId, input.listingId);
  const previousStatus = listing.operationalStatus;
  const now = new Date();

  // Write status history before flipping browse/status flags so the INSERT WITH CHECK
  // subquery can still see the org-owned listing under RLS.
  const [historyRow] = await db
    .insert(schema.listingStatusHistory)
    .values({
      listingId: listing.id,
      status: 'withdrawn',
      recordedAt: now,
      note: input.note ?? 'Withdrawn by agency',
    })
    .returning();

  await db
    .update(schema.propertyListings)
    .set({ operationalStatus: 'withdrawn', isPublicBrowseable: false, updatedAt: now })
    .where(eq(schema.propertyListings.id, listing.id));

  if (historyRow) {
    await fanOutListingChange({
      listingId: listing.id,
      type: 'listing_withdrawn',
      sourceEventId: historyRow.id,
      statusFrom: previousStatus,
      statusTo: 'withdrawn',
    });
  }

  await recordAuditEvent(db, {
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    action: 'listing.withdraw',
    entityType: 'property_listing',
    entityId: listing.id,
    before: { operationalStatus: previousStatus },
    after: { operationalStatus: 'withdrawn' },
  });

  return getOrgListing(db, input.organizationId, input.listingId);
}

export async function listOrgImportRuns(db: Db, organizationId: string) {
  return db
    .select()
    .from(schema.importRuns)
    .where(eq(schema.importRuns.organizationId, organizationId))
    .orderBy(desc(schema.importRuns.startedAt));
}

export async function getOrgImportRun(db: Db, organizationId: string, importRunId: string) {
  const [run] = await db
    .select()
    .from(schema.importRuns)
    .where(
      and(
        eq(schema.importRuns.id, importRunId),
        eq(schema.importRuns.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!run) throw new NotFoundError('import_run_not_found');
  const errors = await db
    .select()
    .from(schema.importErrors)
    .where(eq(schema.importErrors.importRunId, importRunId))
    .orderBy(schema.importErrors.recordIndex);
  return { run, errors };
}

export async function getOrgBySourceId(db: Db, dataSourceId: string) {
  const [source] = await db
    .select()
    .from(schema.dataSources)
    .where(eq(schema.dataSources.id, dataSourceId))
    .limit(1);
  return source ?? null;
}
