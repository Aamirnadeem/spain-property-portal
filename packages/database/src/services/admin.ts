import { desc, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema/index';
import { recordAuditEvent } from './audit';
import { NotFoundError } from './partner';

type Db = PostgresJsDatabase<typeof schema>;

export async function listPendingReviewListings(db: Db) {
  return db
    .select()
    .from(schema.propertyListings)
    .where(eq(schema.propertyListings.operationalStatus, 'pending_review'))
    .orderBy(desc(schema.propertyListings.importedAt));
}

export async function getListingById(db: Db, listingId: string) {
  const [row] = await db
    .select()
    .from(schema.propertyListings)
    .where(eq(schema.propertyListings.id, listingId))
    .limit(1);
  if (!row) throw new NotFoundError('listing_not_found');
  return row;
}

/**
 * Admin publish: pending_review -> available + is_public_browseable=true. Refuses when the
 * owning source's permission is not `approved` (source could have been suspended/expired
 * after the CSV import already ran).
 */
export async function publishListing(
  db: Db,
  input: { listingId: string; actorUserId: string; note?: string },
) {
  const listing = await getListingById(db, input.listingId);
  const [source] = await db
    .select()
    .from(schema.dataSources)
    .where(eq(schema.dataSources.id, listing.dataSourceId))
    .limit(1);
  if (!source || source.permissionStatus !== 'approved') {
    throw new Error('source_not_approved');
  }

  const previousStatus = listing.operationalStatus;
  const now = new Date();
  await db
    .update(schema.propertyListings)
    .set({
      operationalStatus: 'available',
      isPublicBrowseable: true,
      lastConfirmedAvailableAt: now,
      updatedAt: now,
    })
    .where(eq(schema.propertyListings.id, listing.id));

  await db.insert(schema.listingStatusHistory).values({
    listingId: listing.id,
    status: 'available',
    recordedAt: now,
    note: input.note ?? 'Published by admin review',
  });

  await recordAuditEvent(db, {
    actorUserId: input.actorUserId,
    organizationId: listing.organizationId,
    action: 'listing.publish',
    entityType: 'property_listing',
    entityId: listing.id,
    before: { operationalStatus: previousStatus, isPublicBrowseable: listing.isPublicBrowseable },
    after: { operationalStatus: 'available', isPublicBrowseable: true },
  });

  return getListingById(db, input.listingId);
}

export async function adminWithdrawListing(
  db: Db,
  input: { listingId: string; actorUserId: string; note?: string },
) {
  const listing = await getListingById(db, input.listingId);
  const previousStatus = listing.operationalStatus;
  const now = new Date();

  await db
    .update(schema.propertyListings)
    .set({ operationalStatus: 'withdrawn', isPublicBrowseable: false, updatedAt: now })
    .where(eq(schema.propertyListings.id, listing.id));

  await db.insert(schema.listingStatusHistory).values({
    listingId: listing.id,
    status: 'withdrawn',
    recordedAt: now,
    note: input.note ?? 'Withdrawn by admin',
  });

  await recordAuditEvent(db, {
    actorUserId: input.actorUserId,
    organizationId: listing.organizationId,
    action: 'listing.withdraw',
    entityType: 'property_listing',
    entityId: listing.id,
    before: { operationalStatus: previousStatus },
    after: { operationalStatus: 'withdrawn' },
  });

  return getListingById(db, input.listingId);
}

export async function listDataSourcesAdmin(db: Db) {
  return db.select().from(schema.dataSources).orderBy(schema.dataSources.sourceKey);
}

export async function updateSourcePermission(
  db: Db,
  input: {
    dataSourceId: string;
    actorUserId: string;
    toStatus: (typeof schema.sourcePermissionStatusEnum.enumValues)[number];
    toImageRights?: (typeof schema.imageRightsEnum.enumValues)[number];
    note?: string;
  },
) {
  const [source] = await db
    .select()
    .from(schema.dataSources)
    .where(eq(schema.dataSources.id, input.dataSourceId))
    .limit(1);
  if (!source) throw new NotFoundError('data_source_not_found');

  const toImageRights = input.toImageRights ?? source.imageRights;
  await db
    .update(schema.dataSources)
    .set({ permissionStatus: input.toStatus, imageRights: toImageRights, updatedAt: new Date() })
    .where(eq(schema.dataSources.id, source.id));

  await db.insert(schema.sourcePermissionEvents).values({
    dataSourceId: source.id,
    actorUserId: input.actorUserId,
    fromStatus: source.permissionStatus,
    toStatus: input.toStatus,
    fromImageRights: source.imageRights,
    toImageRights,
    note: input.note ?? null,
  });

  await recordAuditEvent(db, {
    actorUserId: input.actorUserId,
    organizationId: source.organizationId,
    action: 'source.permission_change',
    entityType: 'data_source',
    entityId: source.id,
    before: { permissionStatus: source.permissionStatus, imageRights: source.imageRights },
    after: { permissionStatus: input.toStatus, imageRights: toImageRights },
  });

  const [updated] = await db
    .select()
    .from(schema.dataSources)
    .where(eq(schema.dataSources.id, source.id))
    .limit(1);
  return updated!;
}
