import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  addFavourite,
  listFavourites,
  mergeGuestFavouritesIntoUser,
  removeFavourite,
} from '@spain/database';
import { getAppDb, readUserId } from '@/lib/db';
import { ensureUserRow } from '@/lib/ensure-user';

export async function GET(request: Request) {
  const userId = readUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { db, client } = getAppDb();
  try {
    const items = await listFavourites(db, userId);
    return NextResponse.json({ items });
  } finally {
    await client.end({ timeout: 5 });
  }
}

const bodySchema = z.object({
  listingId: z.string().uuid(),
  guestListingIds: z.array(z.string().uuid()).optional(),
});

export async function POST(request: Request) {
  const userId = readUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = bodySchema.parse(await request.json());
  const { db, client } = getAppDb();
  try {
    await ensureUserRow(db, userId);
    if (body.guestListingIds?.length) {
      const ids = await mergeGuestFavouritesIntoUser(db, userId, [
        ...body.guestListingIds,
        body.listingId,
      ]);
      return NextResponse.json({ ok: true, favouriteListingIds: ids });
    }
    await addFavourite(db, userId, body.listingId);
    return NextResponse.json({ ok: true });
  } finally {
    await client.end({ timeout: 5 });
  }
}

export async function DELETE(request: Request) {
  const userId = readUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const listingId = url.searchParams.get('listingId');
  if (!listingId) {
    return NextResponse.json({ error: 'listingId_required' }, { status: 400 });
  }
  const { db, client } = getAppDb();
  try {
    await removeFavourite(db, userId, listingId);
    return NextResponse.json({ ok: true });
  } finally {
    await client.end({ timeout: 5 });
  }
}
