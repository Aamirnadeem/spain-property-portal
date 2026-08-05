# Implementation status

Date: 2026-08-05 (updated Phase 3 planning)

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
- Phase 3 **planning documentation** (ADR-022 renumber; no application code yet):
  - [`PHASE3_PLAN.md`](PHASE3_PLAN.md)
  - [`INGESTION_ARCHITECTURE.md`](INGESTION_ARCHITECTURE.md)
  - [`SOURCE_PERMISSION_MODEL.md`](SOURCE_PERMISSION_MODEL.md)
  - [`AGENCY_PORTAL_DESIGN.md`](AGENCY_PORTAL_DESIGN.md)
  - [`PHASE3_DATABASE_CHANGES.md`](PHASE3_DATABASE_CHANGES.md)
  - [`PHASE3_SECURITY_REVIEW.md`](PHASE3_SECURITY_REVIEW.md)
  - [`PHASE3_DECISIONS_REQUIRED.md`](PHASE3_DECISIONS_REQUIRED.md)

## Credential-gated

- Live Supabase Auth OTP delivery/verification
- Live Supabase Storage uploads
- Hosted production database (local PostGIS used for Phase 2 verification)
- Real partner HTTP feeds (require written permission + registry approval)

## Not started (implementation)

- Phase 3 live inventory / agency-admin ops **implementation** (awaiting explicit approval of the Phase 3 plan)
- Phase 4 buyer workspace remainder (shortlists, comparison, alerts, leads beyond Phase 2 favourites)
- Phase 5+ AI assistant, WhatsApp, voice
- Map distance enrichment

**Do not begin Phase 3 application code until the Phase 3 plan is reviewed and approved.**
