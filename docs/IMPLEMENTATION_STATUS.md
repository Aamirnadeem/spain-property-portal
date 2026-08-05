# Implementation status

Date: 2026-08-05 (updated Phase 3 vertical slice implementation)

## Completed

- Phase 0 planning and legacy assessment
- Phase 1 platform foundation
- Phase 1.1 architecture hardening
- Phase 2 legacy inventory + public buyer journey:
  - property data model and RLS
  - idempotent legacy importer
  - search / detail / favourites UI + APIs
  - guest and authenticated favourites with merge
  - DB integration and Playwright journey tests
- Phase 3 planning documentation (ADR-022 renumber):
  - [`PHASE3_PLAN.md`](PHASE3_PLAN.md)
  - [`INGESTION_ARCHITECTURE.md`](INGESTION_ARCHITECTURE.md)
  - [`SOURCE_PERMISSION_MODEL.md`](SOURCE_PERMISSION_MODEL.md)
  - [`AGENCY_PORTAL_DESIGN.md`](AGENCY_PORTAL_DESIGN.md)
  - [`PHASE3_DATABASE_CHANGES.md`](PHASE3_DATABASE_CHANGES.md)
  - [`PHASE3_SECURITY_REVIEW.md`](PHASE3_SECURITY_REVIEW.md)
  - [`PHASE3_DECISIONS_REQUIRED.md`](PHASE3_DECISIONS_REQUIRED.md)
- **Phase 3 vertical slice implementation** — authorized agency CSV upload → validation → normalization → admin review → publication → price/status update → withdrawal. See [`PHASE3_IMPLEMENTATION.md`](PHASE3_IMPLEMENTATION.md) and [`IMPORT_FORMAT_CSV.md`](IMPORT_FORMAT_CSV.md):
  - Schema/migrations for `feed_configs`, `source_permission_events`, `raw_snapshots`, `audit_events`, and org-scoped fields on `data_sources`/`import_runs`
  - Org-scoped RLS (`0005_phase3_rls.sql`) — see [`RLS_IMPLEMENTATION_STATUS.md`](RLS_IMPLEMENTATION_STATUS.md)
  - Demo org + `partner-csv-demo-catalonia` seed
  - Spain Partner CSV v1 adapter/pipeline: idempotent upsert, quarantine, raw-snapshot provenance, source permission gate
  - Partner + admin database services, `/api/v1/partner/*` and `/api/v1/admin/*` APIs
  - Partner UI (dashboard, listings, CSV upload + dry run, import history/detail) and admin UI (review queue, sources, audit log)
  - Unit tests (CSV/schema/normalize/permission-gate), `pnpm test:db` Phase 3 assertions, Playwright agency→admin→public→update→withdraw journey

## Credential-gated

- Live Supabase Auth OTP delivery/verification
- Live Supabase Storage uploads
- Hosted production database (local PostGIS used for Phase 2/3 verification)
- Real partner HTTP feeds (require written permission + registry approval) — the Phase 3 slice ships CSV upload only, no outbound feed polling

## Not started (implementation)

- JSON/XML partner adapters (Spain Partner CSV v1 only in this slice, per ADR-023)
- pg-boss / background job runner (Phase 3 slice runs ingestion inline; see [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md))
- Rights-checked media pipeline / authorized listing photographs (placeholders only)
- Multi-partner / nationwide rollout
- Phase 4 buyer workspace remainder (shortlists, comparison, alerts, leads beyond Phase 2 favourites)
- Phase 5+ AI assistant, WhatsApp, voice
- Map distance enrichment

**Phase 4 (buyer workspace) has not been started.**
