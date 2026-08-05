/**
 * Client-safe mirror of packages/database/src/seed-constants.ts demo user IDs.
 * Kept as plain string literals (not imported from @spain/database) so this file can be
 * used from 'use client' components without pulling in server-only deps (postgres, drizzle).
 * These are non-secret, fixed demo UUIDs seeded by `pnpm db:seed` for local development only.
 */
export const DEMO_IDENTITIES = [
  { id: '44444444-4444-4444-8444-444444444444', labelKey: 'orgOwner' as const },
  { id: '55555555-5555-4555-8555-555555555555', labelKey: 'orgAgent' as const },
  { id: '66666666-6666-4666-8666-666666666666', labelKey: 'platformAdmin' as const },
  { id: '77777777-7777-4777-8777-777777777777', labelKey: 'listingReviewer' as const },
] as const;

export function readSpainUserId(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('spain_user_id='));
  return match ? decodeURIComponent(match.split('=')[1] ?? '') : null;
}

export function setSpainUserId(userId: string): void {
  document.cookie = `spain_user_id=${userId}; path=/; SameSite=Lax`;
}
