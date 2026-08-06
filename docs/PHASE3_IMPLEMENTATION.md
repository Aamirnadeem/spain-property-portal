# Phase 3 implementation — vertical slice

Date: 2026-08-05
Scope: **One** authorized agency, **one** CSV format, one complete listing lifecycle — CSV upload → validation → normalization → admin review → publication → price/status update → withdrawal. See [`PHASE3_PLAN.md`](PHASE3_PLAN.md) for the approved plan and [`DECISIONS.md`](DECISIONS.md) ADR-022–028 for locked decisions.

## What shipped

### Schema + migrations

- `packages/database/drizzle/0004_curious_dracula.sql` (generated) — `feed_configs`, `source_permission_events`, `raw_snapshots`, `audit_events` tables; `data_sources.permission_expires_at`; `import_runs.{organization_id,feed_config_id,raw_snapshot_id,mode,parser_version,actor_user_id}`.
- `packages/database/drizzle/0005_phase3_rls.sql` (hand-written) — org-scoped RLS for all of the above plus tightened `property_listings`/`import_runs`/`import_errors` policies. See [`RLS_IMPLEMENTATION_STATUS.md`](RLS_IMPLEMENTATION_STATUS.md).

### Seed

- `packages/database/src/seed-constants.ts` — deterministic demo IDs (`demo-catalonia-agency` org; `org_owner`/`org_agent`/`platform_admin`/`listing_reviewer` demo users; `partner-csv-demo-catalonia` data source).
- `packages/database/src/seed.ts` — seeds the org, memberships, platform roles, the approved data source (with a recorded `source_permission_events` row), and its `feed_configs` (Spain Partner CSV v1 column mapping).

### Ingestion

- `packages/ingestion/src/partner/{csv,schema,normalize,permission-gate,pipeline}.ts` — parser, Zod row schema, property-type/status/environment normalization, source permission gate, and the idempotent upsert pipeline (raw snapshot → validate → normalize → persist/quarantine). Full column and behavior reference: [`IMPORT_FORMAT_CSV.md`](IMPORT_FORMAT_CSV.md).
- `packages/ingestion/src/cli-partner.ts` (`pnpm db:import-partner-fixture`) and fixtures under `data/fixtures/partner/`.
- Physical property vs. listing separation (ADR-020) is preserved: each new `external_id` gets its own provisional `physical_properties` row; there is no cross-source auto-merge in this slice.

### Database services (`packages/database/src/services/`)

- `organizations.ts` — `requireOrgMember`, `requirePlatformRole`, `requireSoleOrganization`, `ForbiddenError`.
- `partner.ts` — org-scoped listing/import-run reads, `updateOrgListingPrice`, `withdrawOrgListing` (agency self-service on their own org's listings).
- `admin.ts` — `listPendingReviewListings`, `publishListing` (refuses if the owning source's permission is no longer `approved`), `adminWithdrawListing`, `listDataSourcesAdmin`, `updateSourcePermission`.
- `audit.ts` — `recordAuditEvent` / `listAuditEventsForOrganization` / `listAllAuditEvents`. Every publish, price update, withdraw, and permission change writes an `audit_events` row.

### APIs

- `apps/web/src/app/api/v1/partner/{imports,listings}/**` — CSV upload (`dry_run` \| `confirm`), import history/detail, listing list/detail, price `PATCH`, `withdraw` `POST`.
- `apps/web/src/app/api/v1/admin/{listings,sources,audit}/**` — pending-review queue, publish/withdraw, source permission `PATCH`, audit log.
- `apps/web/src/lib/partner-auth.ts` — shared authz resolution (`resolvePartnerContext`, `resolveAdminContext`) on top of the Phase 1/2 `x-user-id`/cookie wiring (known gap, see below).

### UI

- `apps/web/src/app/[locale]/partner/{,listings,imports,imports/[id]}/page.tsx` — agency dashboard, listings table (price update + withdraw), CSV upload with dry-run preview, import history + run detail with row-level errors.
- `apps/web/src/app/[locale]/admin/{,review,sources,audit}/page.tsx` — admin dashboard, review queue (publish/withdraw), data source permission management, audit log.
- `apps/web/src/components/DevIdentitySwitcher.tsx` — local-only "sign in as" affordance over the four seeded demo users (see "FakeAuth + seed" below).
- i18n: `partner.*` / `admin.*` message namespaces added to all four locales (`en`, `es`, `ca`, `ar`); nav links added to the locale layout.

### Jobs

No background job runner was introduced. All ingestion runs synchronously inside the API request (`runSpainPartnerCsvImport` is awaited directly), i.e. **`JOBS_PROVIDER=inline`** for this slice — pg-boss was judged unnecessary complexity for one small CSV per request. See [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md).

## Authorization model for this slice

- **Partner routes** (`/api/v1/partner/*`) resolve the caller's organization via `requireSoleOrganization` — the seeded demo agency has exactly one org per user, so there is no org switcher. Agents/owners act on their own org's listings only (enforced in both the service layer and RLS).
- **Admin routes** (`/api/v1/admin/*`) require `platform_admin` or `listing_reviewer` (`requirePlatformRole`).
- **FakeAuth + seed is intentionally acceptable for local/dev** per `PHASE3_DECISIONS_REQUIRED.md`'s default. The `DevIdentitySwitcher` component sets the same `spain_user_id` cookie the Phase 2 `AuthPanel` OTP flow sets, just pointed at one of the four fixed seed UUIDs, so the same header-based dev wiring from Phase 2 (`apps/web/src/lib/db.ts#readUserId`) carries the identity through to the partner/admin APIs. **A verified Supabase session must replace this before any non-local deployment** — this is a carried-over Phase 2 gap, not new in Phase 3 (see `KNOWN_ISSUES.md`).
  - **Superseded by Phase 3.1 (ADR-029):** header/client-cookie identity is gone; the switcher now mints sealed HttpOnly sessions server-side and authorization comes from verified sessions plus DB membership. See [`PHASE3_1_IMPLEMENTATION.md`](PHASE3_1_IMPLEMENTATION.md).

## Commands

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:import-legacy
pnpm db:import-partner-fixture   # optional: seed demo agency inventory via CLI instead of the UI
pnpm test:db
pnpm test:e2e                    # since Phase 3.1: provisions its own spain_properties_e2e database
```

## Verification results (this change)

- `pnpm format:check` — pass
- `pnpm lint` (all workspaces) — pass
- `pnpm typecheck` (all workspaces) — pass
- `pnpm test` (all workspaces, unit) — pass
- `pnpm test:db` — pass, including new Phase 3 assertions (partner CSV idempotency, org-scoped RLS isolation, admin publish/withdraw, agency price update + self-withdraw, source permission gate, audit trail)
- `pnpm test:e2e` — pass, including the new agency CSV → admin publish → public search → agency price update → withdraw → delisted journey

## Explicitly out of scope (unchanged from the approved plan)

- Nationwide/multi-partner rollout, unauthorized crawling, WhatsApp, voice, AI buyer guidance.
- Phase 4 buyer workspace (shortlists, comparison, alerts, leads).
- JSON/XML partner adapters (planned in `INGESTION_ARCHITECTURE.md`, not built in this slice — CSV-only acceptance per ADR-023).
- Real image storage/rights-checked media pipeline (placeholders only; see `KNOWN_ISSUES.md`).
- pg-boss / background job runner (inline processing only; see `KNOWN_ISSUES.md`).
