import {
  mergeGuestWorkspace,
  type GuestWorkspaceSnapshot,
  type UserWorkspaceSnapshot,
} from './guest-workspace';

export class FavouriteOwnershipError extends Error {
  constructor(
    public readonly userId: string,
    public readonly favouriteUserId: string,
  ) {
    super(`User "${userId}" is not the owner of favourite belonging to "${favouriteUserId}"`);
    this.name = 'FavouriteOwnershipError';
  }
}

/** Throws FavouriteOwnershipError when the acting user does not own the favourite. */
export function assertFavouriteOwner(userId: string, favouriteUserId: string): void {
  if (userId !== favouriteUserId) {
    throw new FavouriteOwnershipError(userId, favouriteUserId);
  }
}

export { FavouriteOwnershipError as FavouriteAuthorizationError };

export function mergeFavouriteIds(guestIds: string[], accountIds: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...guestIds, ...accountIds]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Merges a guest's favourited listings into a user's, preserving guest-first order and de-duplicating. */
export function mergeGuestFavourites(
  guest: GuestWorkspaceSnapshot,
  user: UserWorkspaceSnapshot,
): string[] {
  return mergeGuestWorkspace(guest, user).favouriteListingIds;
}
