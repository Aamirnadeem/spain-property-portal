import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOrgListing, NotFoundError, updateOrgListingPrice } from '@spain/database';
import { getAppDb } from '@/lib/db';
import { isErrorResponse, resolvePartnerContext } from '@/lib/partner-auth';

const patchSchema = z.object({
  priceAmount: z.number().positive(),
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { db, client } = getAppDb();
  try {
    const ctx = await resolvePartnerContext(request, db);
    if (isErrorResponse(ctx)) return ctx;
    const { id } = await context.params;
    const listing = await getOrgListing(db, ctx.organizationId, id);
    return NextResponse.json({ listing });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    throw error;
  } finally {
    await client.end({ timeout: 5 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { db, client } = getAppDb();
  try {
    const ctx = await resolvePartnerContext(request, db);
    if (isErrorResponse(ctx)) return ctx;
    const { id } = await context.params;
    const body = patchSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json(
        { error: 'invalid_body', issues: body.error.issues },
        { status: 400 },
      );
    }
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
  } finally {
    await client.end({ timeout: 5 });
  }
}
