# Implementation decisions

Date: 2026-08-05 (updated Phase 2 gate)  
Status: Locked

This is the implementation-facing decision log. The broader planning register remains in [`DECISIONS_REQUIRED.md`](DECISIONS_REQUIRED.md).

## ADR-016 — Supabase production platform

- Supabase Auth provides production email/mobile OTP and canonical user UUIDs.
- Supabase PostgreSQL is the production database.
- Supabase Storage is the production store for authorized media.
- Drizzle owns version-controlled schema migrations and typed application queries.
- Status: locked before Phase 2.

## ADR-017 — Provider isolation

- Authentication is accessed only through `AuthProvider`.
- Media storage is accessed only through `StorageProvider`.
- Fake auth and local filesystem storage are non-persistent development/test providers.
- No UI or domain service may access fake provider maps or provider SDKs directly.
- Status: implemented in Phase 1.1.

## ADR-018 — Fail-closed production configuration

- Production rejects missing, fake, or unsupported `OTP_PROVIDER`.
- Production requires the Supabase project URL and anonymous key.
- `devCode` is prohibited outside development/test.
- Production storage rejects the local provider.
- Status: implemented and unit tested.

## ADR-019 — Migration-only database deployment

- `drizzle-kit push` is prohibited as a production deployment strategy.
- `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:seed` are the supported commands.
- SQL migrations and Drizzle journal metadata are committed and reviewed.
- Status: implemented and covered by `pnpm test:db`.

## Phase 2 gate clarifications (2026-08-05)

### Auth: Supabase Auth, not a custom auth service

- **Decision:** Production authentication uses **Supabase Auth** for email OTP and mobile SMS OTP.
- **Not chosen:** A custom authentication service, custom JWT issuer, or NextAuth-owned identity store.
- Application code talks only to `AuthProvider`. `SupabaseAuthProvider` is the production adapter; `FakeAuthProvider` is local/test only and non-persistent.
- Canonical user ID = Supabase Auth UUID = `users.id`.

### Database: Drizzle against Supabase PostgreSQL

- **Decision:** Drizzle operates against **Supabase-managed PostgreSQL** (PostGIS enabled).
- Local development and `pnpm test:db` may use Docker PostGIS with the same schema.
- **Not chosen:** A separate managed Postgres vendor for production (RDS, Neon, etc.) unless ADR-016 is explicitly reopened.

### RLS: migrations vs documentation

- Source of truth for _implemented_ policies is committed SQL under `packages/database/drizzle/` (Phase 1 `0001_phase1_rls.sql` plus Phase 2 inventory/favourites migrations).
- [`RLS_IMPLEMENTATION_STATUS.md`](RLS_IMPLEMENTATION_STATUS.md) tracks each table as implemented/tested, implemented/untested, planned only, or not applicable.
- Planning language in `SECURITY_AND_PRIVACY.md` / `DATABASE_DESIGN.md` is **not** an implemented policy until a migration exists.

### Fake OTP and fail-closed production

- `OTP_PROVIDER=fake` and `FakeAuthProvider` are allowed only when `NODE_ENV` is `development` or `test`.
- Production fails closed when `OTP_PROVIDER` is missing, `fake`, unsupported, or Supabase Auth URL/anon key is incomplete.
- `devCode` is never returned or logged outside development/test (ADR-018; unit-tested).

### Phase 2 favourites timing

- Favourites (guest local + authenticated DB + merge) are delivered in **Phase 2** for the first complete public buyer journey, ahead of the broader Phase 3 buyer-workspace slice (shortlists, comparison, alerts).

### ADR-020 — Physical property vs commercial listing

- Each imported legacy row creates one `property_listings` row and may attach to a provisional `physical_properties` row.
- Multiple future listings may share one physical property; Phase 2 does not auto-merge duplicates across sources.
- Status: locked for Phase 2.

### ADR-021 — Legacy snapshot labelling

- All rows from `barcelona_property_explorer_legacy_60.json` are marked `legacy_snapshot`.
- They must never be described as live, verified, or currently available.
- Status: locked.
