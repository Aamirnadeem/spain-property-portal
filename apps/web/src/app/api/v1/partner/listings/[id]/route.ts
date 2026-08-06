import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOrgListing, NotFoundError, updateOrgListingPrice } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { getSession } from '@/lib/session';
import { isErrorResponse, resolvePartnerContext } from '@/lib/partner-auth';

const patchSchema = z.object({
  priceAmount: z.number().positive(),
  actorUserId: z.string().uuid().optional(), // ignored — session actor only
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return withAppAuthenticatedDb(session.userId, async (db) => {
    const ctx = await resolvePartnerContext(request, db);
    if (isErrorResponse(ctx)) return ctx;
    const { id } = await context.params;
    try {
      const listing = await getOrgListing(db, ctx.organizationId, id);
      return NextResponse.json({ listing });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      throw error;
    }
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return withAppAuthenticatedDb(session.userId, async (db) => {
    const ctx = await resolvePartnerContext(request, db, { mutate: true });
    if (isErrorResponse(ctx)) return ctx;
    const { id } = await context.params;
    const body = patchSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json(
        { error: 'invalid_body', issues: body.error.issues },
        { status: 400 },
      );
    }
    try {
      const listing = await updateOrgListingPrice(db, {
        organizationId: ctx.organizationId,
        listingId: id,
        actorUserId: ctx.userId,
        priceAmount: body.data.priceAmount,
      });
      return NextResponse.json({ listing });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      throw error;
    }
  });
}
