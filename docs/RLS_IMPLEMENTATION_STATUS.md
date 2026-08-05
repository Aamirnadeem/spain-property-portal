# RLS implementation status

Date: 2026-08-05  
Migrations: `0001_phase1_rls.sql`, `0003_phase2_rls.sql`

Status meanings:

- **Implemented in migration / tested** — policy exists and `pnpm test:db` exercises it.
- **Implemented in migration / not yet tested** — policy exists; dedicated case pending.
- **Planned only** — RLS enabled, no permissive client policy (deny by default).
- **Not applicable** — public/reference data.

## Identity, guest, consent

- `users`, `auth_identities`, `guest_sessions`, `user_consents`: implemented / tested
- `user_profiles`, `notification_preferences`, `privacy_requests`, `user_channel_identities`, `user_roles`: implemented / not yet tested

## Phase 2 inventory and favourites

- `property_listings` public browse (`is_public_browseable`): implemented / tested
- Related public reads (`listing_price_history`, `listing_status_history`, `property_features`, `source_claims`, `property_provenance`, `listing_media`, physical/address/location, `data_sources`, `property_types`, `features`): implemented / browse covered via listing count
- `favourites` owner select/insert/delete: implemented / tested
- `import_runs`, `import_errors`: planned only (RLS on, no client policies — server/service only)

## Authorization / deferred

- Org/role/admin tables, call tables, media rights writes: planned only or Phase 1 deny-by-default as previously recorded

## Not applicable

- Geography reference tables remain public seed data without owner RLS in Phase 1.1; inventory public browse is separate.
