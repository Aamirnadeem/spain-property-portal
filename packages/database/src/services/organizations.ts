import { and, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema/index';

type Db = PostgresJsDatabase<typeof schema>;

export const PLATFORM_ADMIN_ROLE_KEYS = ['platform_admin', 'listing_reviewer'] as const;

export interface OrgMembership {
  organizationId: string;
  userId: string;
  role: string;
}

/** Returns the caller's membership row for `organizationId`, or null if not a member. */
export async function getOrgMembership(
  db: Db,
  userId: string,
  organizationId: string,
): Promise<OrgMembership | null> {
  const [row] = await db
    .select()
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.userId, userId),
        eq(schema.organizationMembers.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) return null;
  return { organizationId: row.organizationId, userId: row.userId, role: row.role };
}

/** Returns every organization the user belongs to (Phase 3 slice: usually zero or one). */
export async function listUserOrganizations(
  db: Db,
  userId: string,
): Promise<Array<{ organizationId: string; role: string; name: string; slug: string }>> {
  const rows = await db
    .select({
      organizationId: schema.organizationMembers.organizationId,
      role: schema.organizationMembers.role,
      name: schema.organizations.name,
      slug: schema.organizations.slug,
    })
    .from(schema.organizationMembers)
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.organizationMembers.organizationId),
    )
    .where(eq(schema.organizationMembers.userId, userId));
  return rows;
}

export async function getUserPlatformRoleKeys(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ key: schema.roles.key })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .where(eq(schema.userRoles.userId, userId));
  return rows.map((r) => r.key);
}

export async function hasPlatformRole(
  db: Db,
  userId: string,
  allowedRoleKeys: readonly string[] = PLATFORM_ADMIN_ROLE_KEYS,
): Promise<boolean> {
  const roleKeys = await getUserPlatformRoleKeys(db, userId);
  return roleKeys.some((key) => allowedRoleKeys.includes(key));
}

export class ForbiddenError extends Error {
  constructor(message = 'forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Phase 3 vertical slice simplification: partner routes do not require an explicit
 * organizationId parameter because the seeded demo agency has exactly one org per user.
 * A multi-org account switcher is out of scope for this slice (see AGENCY_PORTAL_DESIGN.md).
 */
export async function requireSoleOrganization(db: Db, userId: string): Promise<OrgMembership> {
  const orgs = await listUserOrganizations(db, userId);
  if (orgs.length === 0) throw new ForbiddenError('not_an_org_member');
  const first = orgs[0]!;
  return { organizationId: first.organizationId, userId, role: first.role };
}

/** Throws ForbiddenError unless the user is a member of the organization. */
export async function requireOrgMember(
  db: Db,
  userId: string,
  organizationId: string,
): Promise<OrgMembership> {
  const membership = await getOrgMembership(db, userId, organizationId);
  if (!membership) throw new ForbiddenError('not_an_org_member');
  return membership;
}

/** Throws ForbiddenError unless the user holds one of the given platform roles. */
export async function requirePlatformRole(
  db: Db,
  userId: string,
  allowedRoleKeys: readonly string[] = PLATFORM_ADMIN_ROLE_KEYS,
): Promise<void> {
  const ok = await hasPlatformRole(db, userId, allowedRoleKeys);
  if (!ok) throw new ForbiddenError('platform_role_required');
}
