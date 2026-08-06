import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  addFavourite,
  listFavourites,
  mergeGuestFavouritesIntoUser,
  removeFavourite,
} from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { assertSameOrigin } from '@/lib/csrf';
import { ensureUserRow } from '@/lib/ensure-user';
import { getSession } from '@/lib/session';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return withAppAuthenticatedDb(session.userId, async (db) => {
    const items = await listFavourites(db, session.userId);
    return NextResponse.json({ items });
  });
}

const bodySchema = z.object({
  listingId: z.string().uuid(),
  guestListingIds: z.array(z.string().uuid()).optional(),
});

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });

  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = bodySchema.parse(await request.json());
  return withAppAuthenticatedDb(session.userId, async (db) => {
    await ensureUserRow(db, session.userId);
    if (body.guestListingIds?.length) {
      const ids = await mergeGuestFavouritesIntoUser(db, session.userId, [
        ...body.guestListingIds,
        body.listingId,
      ]);
      return NextResponse.json({ ok: true, favouriteListingIds: ids });
    }
    await addFavourite(db, session.userId, body.listingId);
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return NextResponse.json(await csrf.json(), { status: csrf.status });

  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const listingId = url.searchParams.get('listingId');
  if (!listingId) {
    return NextResponse.json({ error: 'listingId_required' }, { status: 400 });
  }
  return withAppAuthenticatedDb(session.userId, async (db) => {
    await removeFavourite(db, session.userId, listingId);
    return NextResponse.json({ ok: true });
  });
}
