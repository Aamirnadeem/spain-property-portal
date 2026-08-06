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
export * from './storage/provider';
export * from './storage/local';
export * from './storage/supabase';
export * from './storage/factory';
export * from './services/properties';
export * from './services/users';
export * from './services/organizations';
export * from './services/partner';
export * from './services/admin';
export * from './services/audit';
export * from './services/authz-roles';
export * from './auth/with-authenticated-db';
export * from './seed-constants';
