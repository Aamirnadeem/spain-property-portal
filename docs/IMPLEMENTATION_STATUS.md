# Implementation status

Date: 2026-08-06 (Phase 4B planning complete — ADR-030b)

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
- **Phase 4 planning documentation (ADR-030)** — see [`PHASE4_PLAN.md`](PHASE4_PLAN.md)
- **Phase 4A implementation** — shortlists, notes, explainable comparison, guest merge. See [`PHASE4A_IMPLEMENTATION.md`](PHASE4A_IMPLEMENTATION.md)
- **Phase 4B planning documentation (ADR-030b)** — saved searches, browsing history, in-app alerts. See [`PHASE4B_PLAN.md`](PHASE4B_PLAN.md)

## Credential-gated

- Live Supabase Auth OTP delivery/verification
- Live Supabase Storage uploads
- Hosted production database (local PostGIS used for Phase 2/3/3.1/4A verification)
- Real partner HTTP feeds (require written permission + registry approval)

## Not started (implementation)

- JSON/XML partner adapters (Spain Partner CSV v1 only in Phase 3 slice)
- pg-boss / background job runner
- Rights-checked media pipeline / authorized listing photographs
- Multi-partner / nationwide rollout
- **Phase 4B implementation** — saved searches, browsing history, in-app alerts / matching engine (planning done; code not started)
- **Phase 4C** — comparison share links only
- Phase 4.1+ — leads, privacy export/delete workers, production email digests
- Phase 5+ AI assistant, WhatsApp, voice
- Map distance enrichment

**Phase 4B/4C implementation has not been started.** Phase 4B planning is complete under ADR-030b (alerts moved into 4B; 4C narrowed to share links).
