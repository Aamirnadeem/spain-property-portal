import { NextResponse } from 'next/server';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@spain/database/schema';
import {
  canMutateOrgInventory,
  canReadOrgInventory,
  getOrgMembership,
  getUserPlatformRoleKeys,
  listUserOrganizations,
  PLATFORM_ADMIN_ONLY_ROLE_KEYS,
  PLATFORM_REVIEWER_ROLE_KEYS,
  requirePlatformRole,
  requireSoleOrganization,
} from '@spain/database';
import { assertSameOrigin } from './csrf';
import { getSession, type AppSession } from './session';

type Db = PostgresJsDatabase<typeof schema>;

export interface PartnerContext {
  userId: string;
  organizationId: string;
  orgRole: string;
  session: AppSession;
}

export interface AdminContext {
  userId: string;
  session: AppSession;
  platformRoleKeys: string[];
}

function readRequestedOrganizationId(request: Request): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get('organizationId');
  if (fromQuery && /^[0-9a-f-]{36}$/i.test(fromQuery)) return fromQuery;
  return null;
}

/**
 * Verified session + DB membership. Never trusts browser-supplied role/org as authority:
 * organizationId from query is validated via getOrgMembership; role always comes from DB.
 */
export async function resolvePartnerContext(
  request: Request,
  db: Db,
  options: { mutate?: boolean } = {},
): Promise<PartnerContext | NextResponse> {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });

  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const requestedOrgId = readRequestedOrganizationId(request);
  try {
    let membership;
    if (requestedOrgId) {
      membership = await getOrgMembership(db, session.userId, requestedOrgId);
      if (!membership) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
    } else {
      const orgs = await listUserOrganizations(db, session.userId);
      if (orgs.length === 0) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      if (orgs.length === 1) {
        membership = await requireSoleOrganization(db, session.userId);
      } else {
        return NextResponse.json({ error: 'organization_id_required' }, { status: 400 });
      }
    }

    if (!canReadOrgInventory(membership.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (options.mutate && !canMutateOrgInventory(membership.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    return {
      userId: session.userId,
      organizationId: membership.organizationId,
      orgRole: membership.role,
      session,
    };
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
}

export async function resolveAdminContext(
  request: Request,
  db: Db,
  options: { platformAdminOnly?: boolean } = {},
): Promise<AdminContext | NextResponse> {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });

  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const allowed = options.platformAdminOnly
    ? PLATFORM_ADMIN_ONLY_ROLE_KEYS
    : PLATFORM_REVIEWER_ROLE_KEYS;

  try {
    await requirePlatformRole(db, session.userId, allowed);
    const platformRoleKeys = await getUserPlatformRoleKeys(db, session.userId);
    return { userId: session.userId, session, platformRoleKeys };
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
}

export function isErrorResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
