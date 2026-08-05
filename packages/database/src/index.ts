import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to create a database client');
  }
  const client = postgres(connectionString, { max: 5 });
  return { db: drizzle(client, { schema }), client };
}

export * from './schema/index';
export * from './rls/policies';
export * from './storage/local';
