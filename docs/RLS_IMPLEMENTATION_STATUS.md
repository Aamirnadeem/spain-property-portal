# RLS implementation status

Date: 2026-08-05 (updated Phase 3 planning)  
Migrations: `0001_phase1_rls.sql`, `0003_phase2_rls.sql`  
Phase 3 policies: **planned only** until implementation migrations land (see [`PHASE3_SECURITY_REVIEW.md`](PHASE3_SECURITY_REVIEW.md)).

Status meanings:

- **Implemented in migration / tested** — policy exists and `pnpm test:db` exercises it.
- **Implemented in migration / not yet tested** — policy exists; dedicated case pending.
- **Planned only** — RLS enabled, no permissive client policy (deny by default), or Phase 3 design not yet migrated.
- **Not applicable** — public/reference data.

## Identity, guest, consent

- `users`, `auth_identities`, `guest_sessions`, `user_consents`: implemented / tested
- `user_profiles`, `notification_preferences`, `privacy_requests`, `user_channel_identities`, `user_roles`: implemented / not yet tested

## Phase 2 inventory and favourites

- `property_listings` public browse (`is_public_browseable`): implemented / tested
- Related public reads (`listing_price_history`, `listing_status_history`, `property_features`, `source_claims`, `property_provenance`, `listing_media`, physical/address/location, `data_sources`, `property_types`, `features`): implemented / browse covered via listing count
- `favourites` owner select/insert/delete: implemented / tested
- `import_runs`, `import_errors`: planned only (RLS on, no client policies — server/service only) — Phase 3 will add org-scoped partner policies

## Phase 3 planned (not migrated yet)

- `organizations`, `organization_members`, `organization_verifications`: planned — member read own org; platform admin full
- Org-scoped `property_listings` write/update for members; public browse unchanged
- `feed_configs`, `raw_snapshots`, `ingestion_items`, `duplicate_candidates`, `audit_events`, `source_permission_events`, `feed_health_events`: planned — org or admin only
- `media_assets` / `media_rights` writes: planned — org upload + admin approve; public read only when listing browseable and rights allow
- Partner import run/error SELECT for own `organization_id`
- Cross-agency isolation tests required before Phase 3 acceptance

## Authorization / deferred

- Call tables, privacy export worker paths: planned for Phase 4+ buyer/privacy work
- Media malware scanner integration: Phase 3 implementation dependency (fixture locally)

## Not applicable

- Geography reference tables remain public seed data without owner RLS in Phase 1.1; inventory public browse is separate.
