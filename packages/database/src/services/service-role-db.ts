import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema/index';

type Db = PostgresJsDatabase<typeof schema>;

/**
 * Short-lived connection as the DB owner / service role (no `SET LOCAL ROLE authenticated`).
 * Used for Phase 4B job fan-out that must insert notifications for many buyers after an
 * agency/admin mutation — owner RLS would otherwise block the acting partner session.
 *
 * Callers must already have passed API-layer authorization for the triggering mutation.
 */
export async function withServiceRoleDb<T>(
  connectionString: string | undefined,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for service-role notification fan-out');
  }
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });
  try {
    return await fn(db);
  } finally {
    await client.end({ timeout: 5 });
  }
}
