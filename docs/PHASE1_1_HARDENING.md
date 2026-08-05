# Phase 1.1 architecture hardening

Date: 2026-08-05  
Scope: production boundaries and database authorization only

## Delivered

1. `AuthProvider` with non-persistent `FakeAuthProvider` and configuration-gated `SupabaseAuthProvider`.
2. Production fail-closed validation for missing/fake OTP provider and incomplete Supabase Auth configuration.
3. Fake OTP codes restricted to development/test responses and excluded from logs.
4. `StorageProvider` with non-persistent `LocalStorageProvider` and configuration-gated `SupabaseStorageProvider`.
5. Supabase Auth UUID established as the canonical production `users.id`.
6. Version-controlled Drizzle migration workflow; `drizzle-kit push` removed from deployment.
7. RLS migration for Phase 1 identity, guest, consent, preferences, and privacy data.
8. Guest session tokens stored as hashes and isolated by transaction-local hash context.
9. Separate localhost PostgreSQL integration suite for clean migration, seed, RLS isolation, unique constraints, and foreign keys.

## Commands

```text
pnpm db:generate  # generate reviewable migrations after schema changes
pnpm db:migrate   # apply committed migration journal
pnpm db:seed      # idempotent reference seed
pnpm test:db      # recreate localhost spain_properties_test and run DB checks
```

`DATABASE_TEST_URL` may override the test URL, but safety checks require localhost and a database name ending in `_test`.

## Production configuration

```text
NODE_ENV=production
OTP_PROVIDER=supabase
STORAGE_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=authorized-media
DATABASE_URL=...
```

## Explicit exclusions

No property search, property import, property-image ingestion, WhatsApp, voice, scraping, or production legal guidance was implemented. `legacy/` remains unchanged.

## Credential-limited validation

Unit tests validate adapter configuration and fail-closed behavior without secrets. Live Supabase Auth OTP and Storage calls require project credentials and remain untested until supplied.
