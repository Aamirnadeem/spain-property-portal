# RLS implementation status

Date: 2026-08-05 (updated Phase 3 vertical slice implementation)
Migrations: `0001_phase1_rls.sql`, `0003_phase2_rls.sql`, `0005_phase3_rls.sql`

Status meanings:

- **Implemented in migration / tested** — policy exists and `pnpm test:db` exercises it.
- **Implemented in migration / not yet tested** — policy exists; dedicated case pending.
- **Planned only** — RLS enabled, no permissive client policy (deny by default), or design not yet migrated.
- **Not applicable** — public/reference data.

## Identity, guest, consent

- `users`, `auth_identities`, `guest_sessions`, `user_consents`: implemented / tested
- `user_profiles`, `notification_preferences`, `privacy_requests`, `user_channel_identities`: implemented / not yet tested
- `user_roles`, `roles`: implemented / tested (`roles_public_read`, and `pnpm test:db` exercises `user_roles` via `requirePlatformRole`)

## Phase 2 inventory and favourites

- `property_listings` public browse (`is_public_browseable`): implemented / tested
- Related public reads (`listing_price_history`, `listing_status_history`, `property_features`, `source_claims`, `property_provenance`, `listing_media`, physical/address/location, `data_sources`, `property_types`, `features`): implemented / browse covered via listing count
- `favourites` owner select/insert/delete: implemented / tested

## Phase 3 (implemented in `0005_phase3_rls.sql`, tested in `pnpm test:db`)

- `organization_members` self-select, `organizations` member-or-admin select: implemented / tested (`requireOrgMember`/`requirePlatformRole` cross-org assertions in `database.integration.ts`)
- `property_listings_org_select` / `property_listings_org_update` / `property_listings_admin_all` — org members see/update their own org's listings (any status), platform admin/reviewer see/act on all: implemented / tested
- `import_runs_org_select` / `import_runs_admin_all`, `import_errors_org_select`, `raw_snapshots_org_select`: implemented / tested (cross-org isolation: an unrelated user sees zero rows for another org's import runs)
- `feed_configs_org_select` / `feed_configs_admin_all`: implemented / not yet tested (no dedicated `pnpm test:db` case reads `feed_configs` directly, though the seed creates one and the pipeline reads it via the trusted server connection)
- `source_permission_events_admin_all`: implemented / tested indirectly (a `source_permission_events` row is asserted after `updateSourcePermission`, via the trusted connection; no dedicated admin-vs-non-admin RLS read case)
- `audit_events_org_select` (no client insert/update/delete policy — audit writes are server/service-role only, by design): implemented / tested (`listAuditEventsForOrganization` after publish/price-update/withdraw/permission-change)
- `data_sources_admin_write` (public read already existed from Phase 2; this adds admin-only update): implemented / tested (`updateSourcePermission` flow)

## Authorization / deferred

- Call tables, privacy export worker paths: planned for Phase 4+ buyer/privacy work
- Media malware scanner integration / rights-checked media pipeline: not built in Phase 3 (placeholders only; see `KNOWN_ISSUES.md`)
- JSON/XML `duplicate_candidates` / physical-property matching tables: not built (no cross-source matching in this slice, see `KNOWN_ISSUES.md`)

## Not applicable

- Geography reference tables remain public seed data without owner RLS in Phase 1.1; inventory public browse is separate.

## Known gap (documented, not an RLS defect)

Application code in `apps/web` queries Postgres through a single trusted server-side connection (service-role equivalent), not per-request `SET LOCAL ROLE authenticated` + JWT claims. The RLS policies above are the defense-in-depth layer exercised by `pnpm test:db`; the actual authorization boundary enforced by the running Next.js app today is the service-layer `requireOrgMember`/`requirePlatformRole` checks in `apps/web/src/lib/partner-auth.ts`, gated by the same non-verified `x-user-id`/cookie wiring as Phase 2 (`KNOWN_ISSUES.md` #7–8). Wiring real per-request Postgres roles (or an equivalent Supabase `auth.uid()` session) through the app is required before RLS becomes the primary enforcement path in production.
