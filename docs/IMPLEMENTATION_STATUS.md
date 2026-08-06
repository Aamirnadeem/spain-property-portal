# Implementation status

Date: 2026-08-06 (Phase 3.1 authentication hardening complete)

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
- Phase 3 planning documentation (ADR-022 renumber)
- **Phase 3 vertical slice implementation** — authorized agency CSV upload → validation → normalization → admin review → publication → price/status update → withdrawal. See [`PHASE3_IMPLEMENTATION.md`](PHASE3_IMPLEMENTATION.md) and [`IMPORT_FORMAT_CSV.md`](IMPORT_FORMAT_CSV.md)
- **Phase 3.1 verified session auth (ADR-029)** — FakeAuth sealed / Supabase sessions replace `x-user-id`; org/platform roles from DB; `withAuthenticatedDb` RLS claim wiring. See [`PHASE3_1_IMPLEMENTATION.md`](PHASE3_1_IMPLEMENTATION.md)

## Credential-gated

- Live Supabase Auth OTP delivery/verification
- Live Supabase Storage uploads
- Hosted production database (local PostGIS used for Phase 2/3/3.1 verification)
- Real partner HTTP feeds (require written permission + registry approval)

## Not started (implementation)

- JSON/XML partner adapters (Spain Partner CSV v1 only in Phase 3 slice)
- pg-boss / background job runner
- Rights-checked media pipeline / authorized listing photographs
- Multi-partner / nationwide rollout
- Phase 4 buyer workspace remainder (shortlists, comparison, alerts, leads beyond Phase 2 favourites)
- Phase 5+ AI assistant, WhatsApp, voice
- Map distance enrichment

**Phase 4 has not been started.**
