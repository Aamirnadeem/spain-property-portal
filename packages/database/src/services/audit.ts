import { desc, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema/index';

type Db = PostgresJsDatabase<typeof schema>;

export interface RecordAuditEventInput {
  actorUserId: string | null;
  organizationId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/** Append-only audit trail (no update/delete client policy — see 0005_phase3_rls.sql). */
export async function recordAuditEvent(db: Db, input: RecordAuditEventInput): Promise<void> {
  await db.insert(schema.auditEvents).values({
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
  });
}

export async function listAuditEventsForOrganization(db: Db, organizationId: string) {
  return db
    .select()
    .from(schema.auditEvents)
    .where(eq(schema.auditEvents.organizationId, organizationId))
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(200);
}

export async function listAllAuditEvents(db: Db) {
  return db
    .select()
    .from(schema.auditEvents)
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(200);
}
