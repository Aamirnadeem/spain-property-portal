import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema/index';

type Db = PostgresJsDatabase<typeof schema>;

/**
 * Open a short-lived connection, set `authenticated` + JWT sub claim, run `fn`, then
 * commit/rollback. Used on partner/admin/favourites request paths so Phase 3 RLS applies.
 *
 * CSV ingestion and CLI workers retain the service-role `createDb()` connection
 * (documented exception) after API-layer session checks.
 */
export async function withAuthenticatedDb<T>(
  connectionString: string,
  userId: string,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    throw new Error('withAuthenticatedDb requires a UUID user id');
  }
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });
  try {
    await client.unsafe('BEGIN');
    await client.unsafe('SET LOCAL ROLE authenticated');
    await client`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`;
    const result = await fn(db);
    await client.unsafe('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.unsafe('ROLLBACK');
    } catch {
      // ignore rollback errors after a failed BEGIN/SET
    }
    throw error;
  } finally {
    await client.end({ timeout: 5 });
  }
}
