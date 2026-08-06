# RLS implementation status

Date: 2026-08-06 (Phase 4 policies **planned** — not migrated)  
Migrations: `0001_phase1_rls.sql`, `0003_phase2_rls.sql`, `0005_phase3_rls.sql`, `0006_phase3_1_rls.sql`  
Planned: `0007_phase4_buyer_workspace.sql`, `0008_phase4_rls.sql` ([`PHASE4_DATABASE_CHANGES.md`](PHASE4_DATABASE_CHANGES.md))

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

- `organization_members` self-select, `organizations` member-or-admin select: implemented / tested
- `property_listings_org_select` / `property_listings_org_update` / `property_listings_admin_all`: implemented / tested
- `import_runs_org_select` / `import_runs_admin_all`, `import_errors_org_select`, `raw_snapshots_org_select`: implemented / tested
- `feed_configs_org_select` / `feed_configs_admin_all`: implemented / not yet tested (dedicated case pending)
- `source_permission_events_admin_all`: implemented / tested indirectly
- `audit_events_org_select` (no client insert/update/delete until 0006): implemented / tested
- `data_sources_admin_write`: implemented / tested

## Phase 3.1 (implemented — ADR-029)

- Runtime `withAuthenticatedDb(session)` setting `SET LOCAL ROLE authenticated` + `request.jwt.claim.sub` on partner/admin/favourites request paths: **implemented**
- `0006_phase3_1_rls.sql`: `audit_events_authenticated_insert`, `listing_price_history_org_or_admin_insert`, `listing_status_history_org_or_admin_insert` + authenticated role grants: **implemented / tested** via `withAuthenticatedDb` price update in `pnpm test:db`
- Client `x-user-id` / `spain_user_id` authority retired (FakeAuth sealed cookie / Supabase session): **implemented**
- CSV partner import POST remains **service-role after API session + mutator checks** (ingestion exception, same class as workers/CLI)
- Workers/CLI remain service-role exceptions (documented)

## Phase 4 buyer workspace (Phase 4A implemented — ADR-030a)

Owner-scoped policies via `request.jwt.claim.sub` + `withAuthenticatedDb` on `/api/v1/me/*`. Agencies have **no** SELECT on these tables.

| Table                                  | Status                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `shortlists`                           | **Implemented / tested** (`0008_phase4a_rls.sql`, `test:db`)            |
| `shortlist_items`                      | **Implemented / tested**                                                |
| `shortlist_notes`                      | **Implemented / tested** (catalogue + grants)                           |
| `property_notes`                       | **Implemented / tested**                                                |
| `user_preference_profiles`             | **Implemented** (migration + grants; profile path covered via services) |
| `comparison_sets` / `comparison_items` | **Implemented** (migration + grants)                                    |

Phase 4B/4C tables (`saved_searches`, `recently_viewed`, alerts, `comparison_shares`): **Planned only**.

## Authorization / deferred

- Privacy export worker paths: Phase 4.1+
- Call tables: later phases
- Media malware scanner integration / rights-checked media pipeline: not built in Phase 3
- JSON/XML `duplicate_candidates` / physical-property matching tables: not built
- Leads / viewing requests RLS: Phase 4.1+

## Not applicable

- Geography reference tables remain public seed data without owner RLS in Phase 1.1; inventory public browse is separate.
