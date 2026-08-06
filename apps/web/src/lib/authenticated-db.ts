import { withAuthenticatedDb as withAuthenticatedDbCore } from '@spain/database';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@spain/database/schema';

type Db = PostgresJsDatabase<typeof schema>;

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required for property APIs');
  }
  return url;
}

/**
 * Partner/admin/favourites request helper: RLS claim + authenticated role.
 * CSV ingestion uses getAppDb() (service-role) after session checks — documented exception.
 */
export async function withAppAuthenticatedDb<T>(
  userId: string,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  return withAuthenticatedDbCore(getDatabaseUrl(), userId, fn);
}
