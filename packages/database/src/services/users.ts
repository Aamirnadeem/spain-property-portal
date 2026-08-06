import { eq } from 'drizzle-orm';
import * as schema from '../schema/index';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

type Db = PostgresJsDatabase<typeof schema>;

export async function ensureUserRow(db: Db, userId: string): Promise<void> {
  const existing = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (existing[0]) return;
  await db.insert(schema.users).values({ id: userId });
}
