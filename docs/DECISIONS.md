# Implementation decisions

Date: 2026-08-06 (updated Phase 3.1 auth planning)
Status: Locked

This is the implementation-facing decision log. The broader planning register remains in [`DECISIONS_REQUIRED.md`](DECISIONS_REQUIRED.md). Phase 3 open items: [`PHASE3_DECISIONS_REQUIRED.md`](PHASE3_DECISIONS_REQUIRED.md). Phase 3.1: [`PHASE3_1_AUTH_PLAN.md`](PHASE3_1_AUTH_PLAN.md).

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

- Favourites (guest local + authenticated DB + merge) are delivered in **Phase 2** for the first complete public buyer journey, ahead of the broader buyer-workspace slice (shortlists, comparison, alerts) now scheduled as **Phase 4** (ADR-022).

### ADR-020 — Physical property vs commercial listing

- Each imported legacy row creates one `property_listings` row and may attach to a provisional `physical_properties` row.
- Multiple future listings may share one physical property; Phase 2 does not auto-merge duplicates across sources.
- Status: locked for Phase 2.

### ADR-021 — Legacy snapshot labelling

- All rows from `barcelona_property_explorer_legacy_60.json` are marked `legacy_snapshot`.
- They must never be described as live, verified, or currently available.
- Status: locked.

## Phase 3 planning (2026-08-05)

### ADR-022 — Roadmap renumber: live inventory is Phase 3

- **Decision:** **Phase 3** = Live Property Inventory and Agency/Admin Operations.
- **Phase 4** = Buyer workspace remainder (shortlists, comparison, alerts, leads, privacy workflows) beyond Phase 2 favourites.
- Former documentation that labelled live inventory as Phase 4 and buyer workspace as Phase 3 is superseded by this ADR and [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md).
- Phase 5+ (AI chat, etc.) keep their phase numbers.
- **Status:** implemented — see [`PHASE3_IMPLEMENTATION.md`](PHASE3_IMPLEMENTATION.md). Phase 4 **planning** complete ([`PHASE4_PLAN.md`](PHASE4_PLAN.md)); Phase 4A **implemented**; Phase 4B **implemented** ([`PHASE4B_IMPLEMENTATION.md`](PHASE4B_IMPLEMENTATION.md), ADR-030b); Phase 4C **planning complete** (ADR-030c); 4C implementation not started.

### ADR-023 — Phase 3 first vertical slice

- One seeded cooperating agency (`demo-catalonia-agency`), one **Spain Partner CSV v1** format, one complete listing lifecycle through admin publish.
- JSON and XML adapters ship with fixtures in Phase 3; end-to-end acceptance is CSV-first.
- No unauthorized scraping or CAPTCHA/access-control bypass.
- **Status:** implemented as scoped — CSV-only; JSON/XML adapters remain planned (`INGESTION_ARCHITECTURE.md`), not built.

### ADR-024 — Background jobs default (planning)

- Planning default for Phase 3 workers: **pg-boss** on the application Postgres, with `JOBS_PROVIDER=inline` for unit/CI tests.
- Inngest / Trigger.dev remain alternatives recorded in [`PHASE3_DECISIONS_REQUIRED.md`](PHASE3_DECISIONS_REQUIRED.md) if owners prefer a SaaS runner.
- **Status:** superseded for this slice by ADR-027 (`JOBS_PROVIDER=inline` only — pg-boss not introduced; single small CSV per request did not justify a worker).

## Phase 3 implementation (2026-08-05)

### ADR-025 — Physical property vs. listing separation carries into partner feeds

- Each new `(data_source_id, external_id)` from a partner CSV creates its own provisional `physical_properties` row, exactly like the legacy importer (ADR-020).
- No cross-source or cross-listing auto-merge/matching is implemented in this slice, even when two listings plausibly describe the same building.
- **Status:** implemented; see `packages/ingestion/src/partner/pipeline.ts`.

### ADR-026 — First-publish gate, then agency self-service

- A brand-new `external_id` always lands as `operational_status = 'pending_review'`, `is_public_browseable = false`, regardless of the CSV's own `status` column — an administrator must publish it once (`publishListing`).
- After a listing has been published at least once, the **owning agency's own re-upload** may change price and status directly (including withdrawing it) without a second admin gate. This mirrors "the agency vouched for it once; the agency drives updates thereafter."
- Admin publish additionally re-checks the owning source's permission status at publish time (not just at import time) and refuses to publish if it is no longer `approved`.
- **Status:** implemented; see `upsertPartnerListing` in `packages/ingestion/src/partner/pipeline.ts` and `publishListing` in `packages/database/src/services/admin.ts`.

### ADR-027 — Inline job processing for the Phase 3 slice

- **Decision:** `runSpainPartnerCsvImport` executes synchronously inside the API request. No pg-boss (or other) job runner was introduced.
- **Rationale:** a single small CSV upload per request does not need async processing for this slice's seeded volumes (≤ a few hundred rows); adding pg-boss would add operational surface (schema, worker process, retry/backoff policy) without a corresponding requirement here.
- **Not chosen:** pg-boss, Inngest, Trigger.dev (all remain valid choices for a future multi-partner/larger-file phase; see [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md)).
- **Status:** locked for this slice; revisit if file sizes or partner count grow.

### ADR-028 — FakeAuth + seeded demo identities for partner/admin UI (local only)

- The Phase 3 partner/admin UI reuses the Phase 2 `spain_user_id` cookie / `x-user-id` header wiring (`PHASE3_DECISIONS_REQUIRED.md` default: "FakeAuth + seed OK for local").
- A `DevIdentitySwitcher` component lets a developer set that cookie to one of the four fixed seed UUIDs (`org_owner`, `org_agent`, `platform_admin`, `listing_reviewer`) instead of running the OTP flow, since those seed users are never created through `ensureUserRow`/OTP verification.
- **Not chosen:** a real session-based auth check for partner/admin routes in this slice.
- **Status:** implemented for local/dev only. **Superseded by ADR-029** (Phase 3.1 verified sessions). DevIdentitySwitcher now mints FakeAuth sealed cookies via `/api/v1/auth/dev-session` when FakeAuth is enabled; it no longer sets authoritative `spain_user_id`.

## Phase 3.1 planning (2026-08-06)

### ADR-029 — Verified AuthProvider sessions replace client identity headers

- **Decision:** Production and non-local deployments authorize buyers, agency users, and platform admins only via **server-verified AuthProvider sessions** (Supabase Auth cookies in production; sealed FakeAuth HttpOnly cookie in local/test).
- **Not chosen:** `x-user-id`, client-writable `spain_user_id`, `x-organization-id`, or `x-role` as production authority.
- Org membership and platform roles continue to come from Postgres (`organization_members`, `user_roles`) after session user resolution.
- Partner/admin/favourites request DB access sets `request.jwt.claim.sub` via `withAuthenticatedDb` so Phase 3 RLS is enforced on the request path (CSV ingestion remains a service-role exception after API auth).
- Role product names map to existing keys: agency-admin → `org_owner`/`org_admin`; agency-editor → `org_agent`; agency-viewer → `org_viewer`.
- Planning docs: [`PHASE3_1_AUTH_PLAN.md`](PHASE3_1_AUTH_PLAN.md), [`AUTHORIZATION_MATRIX.md`](AUTHORIZATION_MATRIX.md), [`SESSION_SECURITY_DESIGN.md`](SESSION_SECURITY_DESIGN.md), [`PHASE3_1_ACCEPTANCE_CRITERIA.md`](PHASE3_1_ACCEPTANCE_CRITERIA.md).
- Implementation: [`PHASE3_1_IMPLEMENTATION.md`](PHASE3_1_IMPLEMENTATION.md).
- **Status:** **implemented** (2026-08-06).

## Phase 4 planning (2026-08-06)

### ADR-030 — Phase 4 buyer workspace scope lock

- **Decision:** Phase 4 implements shortlists, notes, structured comparison with explainable weights, saved searches, browsing history, in-app alerts foundation (TestNotificationProvider only), shareable comparisons, and transactional guest merge—reusing Phase 2 favourites and ADR-029 sessions.
- **Not in Phase 4:** production email/SMS/WhatsApp alerts; leads/viewing requests; privacy export/delete workers; collaborator invites; AI/WhatsApp/voice; inventing missing listing facts.
- Favourites remain a separate Phase 2 heart bookmark; named shortlists do not auto-sync from favourites.
- Alert evaluation uses **inline** hooks (ADR-027); no pg-boss required for Phase 4.
- Planning docs: [`PHASE4_PLAN.md`](PHASE4_PLAN.md), [`BUYER_WORKSPACE_DESIGN.md`](BUYER_WORKSPACE_DESIGN.md), [`PROPERTY_COMPARISON_MODEL.md`](PROPERTY_COMPARISON_MODEL.md), [`SAVED_SEARCH_AND_ALERT_MODEL.md`](SAVED_SEARCH_AND_ALERT_MODEL.md), [`PHASE4_DATABASE_CHANGES.md`](PHASE4_DATABASE_CHANGES.md), [`PHASE4_SECURITY_REVIEW.md`](PHASE4_SECURITY_REVIEW.md), [`PHASE4_ACCEPTANCE_CRITERIA.md`](PHASE4_ACCEPTANCE_CRITERIA.md), [`PHASE4_DECISIONS_REQUIRED.md`](PHASE4_DECISIONS_REQUIRED.md).
- **Status:** **planning complete** — Phase 4A implemented (ADR-030a); Phase 4B implemented (ADR-030b); Phase 4C planning complete (ADR-030c); implementation of 4C awaits approval.

### ADR-030a — Phase 4A vertical slice shipped

- **Decision:** Phase 4A delivers shortlists, notes, explainable comparison (`phase4a.v1`), guest cookie + transactional merge; favourites remain separate (preserve-in-place).
- Implementation: [`PHASE4A_IMPLEMENTATION.md`](PHASE4A_IMPLEMENTATION.md), [`COMPARISON_SCORING_SPECIFICATION.md`](COMPARISON_SCORING_SPECIFICATION.md), [`GUEST_WORKSPACE_MERGE.md`](GUEST_WORKSPACE_MERGE.md).
- **Status:** **implemented** (2026-08-06).

### ADR-030b — Phase 4B scope: saved searches, browsing history, in-app alerts

- **Decision:** Phase **4B** implements saved searches (auth + guest merge), browsing history, in-app notification centre, alert matching engine, price/status event derivation, and provider-neutral job + notification interfaces (`InlineJobRunner` / `TestJobRunner`; `InAppNotificationProvider` / `TestNotificationProvider` only).
- **Phase 4C** is narrowed to **comparison share links** only (collaborators remain Phase 6 / 4.1+ as before).
- **Supersedes** the earlier `IMPLEMENTATION_STATUS.md` split that placed in-app alerts under 4C.
- Channel lock from ADR-030 unchanged: **no** production email/SMS/WhatsApp/push in 4B.
- Jobs lock from ADR-027 unchanged: **no** pg-boss / Inngest / Trigger.dev in 4B; inline + test runners only.
- Criteria: extend `@spain/search` with versioned envelope `criteriaVersion: 'phase4b.v1'`; persist **normalized JSON + selected indexed columns** (D8/D15).
- History retention: **90 days**, **user-clearable** (D5).
- Alert defaults: legacy snapshots **disabled**; `price_reduction` **on**; `price_increase` **off**; status/withdrawal for **shortlisted or saved-match** listings (D13/D16/D17).
- Evaluation: **manual + test-triggered** initially; provider-neutral scheduler seam for later automation (D14).
- Planning docs: [`PHASE4B_PLAN.md`](PHASE4B_PLAN.md), [`SAVED_SEARCH_CRITERIA_SPEC.md`](SAVED_SEARCH_CRITERIA_SPEC.md), [`BROWSING_HISTORY_DESIGN.md`](BROWSING_HISTORY_DESIGN.md), [`IN_APP_NOTIFICATION_DESIGN.md`](IN_APP_NOTIFICATION_DESIGN.md), [`ALERT_MATCHING_ENGINE.md`](ALERT_MATCHING_ENGINE.md), [`PHASE4B_DATABASE_CHANGES.md`](PHASE4B_DATABASE_CHANGES.md), [`PHASE4B_SECURITY_REVIEW.md`](PHASE4B_SECURITY_REVIEW.md), [`PHASE4B_ACCEPTANCE_CRITERIA.md`](PHASE4B_ACCEPTANCE_CRITERIA.md), [`PHASE4B_DECISIONS_REQUIRED.md`](PHASE4B_DECISIONS_REQUIRED.md).
- Implementation: [`PHASE4B_IMPLEMENTATION.md`](PHASE4B_IMPLEMENTATION.md).
- **Status:** **implemented** (2026-08-06).

### ADR-030c — Phase 4C scope: secure comparison share links

- **Decision:** Phase **4C** implements secure, expiring, revocable **read-only** public comparison share links for authenticated buyers. Recipients need no account. Payload is an explicit public DTO allowlist only.
- **Locks:** default expiry **7 days**; max **90 days**; permanent links **disabled**; token ≥ **256-bit** entropy; store **SHA-256** hash only; scores/weights **off by default** (opt-in frozen snapshot — closes D6); private notes and buyer identity **never** shared; public route `/{locale}/shared-comparison/{token}`; no anon RLS SELECT on share tables.
- Selection is frozen on the share (`comparison_share_items`); later workspace edits must not expand the public set.
- Live resolve refreshes public listing facts for selected IDs only; never silently substitutes another property.
- Planning docs: [`PHASE4C_PLAN.md`](PHASE4C_PLAN.md), [`COMPARISON_SHARE_SECURITY_MODEL.md`](COMPARISON_SHARE_SECURITY_MODEL.md), [`PUBLIC_COMPARISON_DTO.md`](PUBLIC_COMPARISON_DTO.md), [`PHASE4C_DATABASE_CHANGES.md`](PHASE4C_DATABASE_CHANGES.md), [`PHASE4C_SECURITY_REVIEW.md`](PHASE4C_SECURITY_REVIEW.md), [`PHASE4C_ACCEPTANCE_CRITERIA.md`](PHASE4C_ACCEPTANCE_CRITERIA.md), [`PHASE4C_DECISIONS_REQUIRED.md`](PHASE4C_DECISIONS_REQUIRED.md).
- **Status:** **planning complete** — implementation not started.
