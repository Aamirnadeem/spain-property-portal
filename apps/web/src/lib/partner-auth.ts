import { NextResponse } from 'next/server';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@spain/database/schema';
import { requirePlatformRole, requireSoleOrganization } from '@spain/database';
import { readUserId } from './db';

type Db = PostgresJsDatabase<typeof schema>;

export interface PartnerContext {
  userId: string;
  organizationId: string;
}

export interface AdminContext {
  userId: string;
}

/**
 * Phase 2/3 known gap (see docs/PHASE3_SECURITY_REVIEW.md "Authn/Authz requirements"):
 * these partner/admin routes trust the `x-user-id` header / `spain_user_id` cookie the same
 * way the Phase 2 favourites API does. A verified Supabase session must replace this before
 * any non-local deployment exposes `/api/v1/partner/*` or `/api/v1/admin/*`.
 */
export async function resolvePartnerContext(
  request: Request,
  db: Db,
): Promise<PartnerContext | NextResponse> {
  const userId = readUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const membership = await requireSoleOrganization(db, userId);
    return { userId, organizationId: membership.organizationId };
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
}

export async function resolveAdminContext(
  request: Request,
  db: Db,
): Promise<AdminContext | NextResponse> {
  const userId = readUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    await requirePlatformRole(db, userId);
    return { userId };
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
}

export function isErrorResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
