# Implementation status

Date: 2026-08-05

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

## Credential-gated

- Live Supabase Auth OTP delivery/verification
- Live Supabase Storage uploads
- Hosted production database (local PostGIS used for Phase 2 verification)

## Not started

- Phase 3 shortlists, comparison, alerts, leads (beyond Phase 2 favourites)
- Phase 4 live agency feeds
- Map distance enrichment, AI assistant, WhatsApp, voice

Phase 3 must not begin automatically.
