# Phase 2 implementation

Date: 2026-08-05  
Scope: Legacy property inventory and first public buyer journey

## Architecture clarifications (resolved before coding)

1. **Production auth:** Supabase Auth (email + mobile OTP). Not a custom auth service. See [`DECISIONS.md`](DECISIONS.md).
2. **Database:** Drizzle against **Supabase PostgreSQL**. Local Docker PostGIS mirrors the same schema.
3. **RLS:** Implemented policies live in `packages/database/drizzle/*.sql`. Status matrix: [`RLS_IMPLEMENTATION_STATUS.md`](RLS_IMPLEMENTATION_STATUS.md).
4. **Fake OTP:** `FakeAuthProvider` / `OTP_PROVIDER=fake` only in development/test.
5. **Fail-closed:** Production rejects missing/fake OTP provider and incomplete Supabase Auth config.

## Delivered

- Normalized inventory schema (physical property ≠ listing), import runs/errors, provenance, price/status history, placeholder media, favourites
- Idempotent legacy importer for `data/legacy/barcelona_property_explorer_legacy_60.json`
- Typed services: `searchProperties`, `getPropertyDetails`, `addFavourite`, `removeFavourite`, `listFavourites`
- Localized search (cards/table), detail, favourites pages with shareable URL filters
- Guest localStorage favourites + authenticated DB favourites + merge on sign-in
- Snapshot/freshness labelling; no invented photos; no scraping
- Unit, DB integration (including double-import), Playwright journey + axe checks

## Commands

```text
pnpm db:migrate
pnpm db:seed
pnpm db:import-legacy
pnpm test:db
pnpm test:e2e
```

## Explicitly out of scope

Map distance enrichment, AI assistant, legal guidance, WhatsApp, voice, viewing appointments, agency feeds, nationwide rollout, unauthorized scraping.
