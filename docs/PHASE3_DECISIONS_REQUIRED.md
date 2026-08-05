# Phase 3 decisions required

Date: 2026-08-05  
Status: Open items blocking or shaping Phase 3 **implementation** (planning docs are otherwise complete)  
Related: [`DECISIONS.md`](DECISIONS.md) ADR-022–024, [`PHASE3_PLAN.md`](PHASE3_PLAN.md)

## Already locked (do not reopen without ADR)

| ID          | Decision                                                                      |
| ----------- | ----------------------------------------------------------------------------- |
| ADR-016–019 | Supabase platform, provider isolation, fail-closed OTP, migration-only deploy |
| ADR-020–021 | Physical vs listing; legacy snapshot labelling                                |
| ADR-022     | Phase 3 = live inventory; Phase 4 = buyer workspace remainder                 |
| ADR-023     | One demo agency + Spain Partner CSV v1 vertical slice                         |
| ADR-024     | pg-boss planning default; inline for tests                                    |

## Open decisions

### D-P3-001 — Confirm real cooperating agency identity

- **Question:** Is `demo-catalonia-agency` only a synthetic seed, or will a named real agency supply the first CSV under NDA?
- **Impact:** Legal text, seed data, whether `partner-csv-demo-catalonia` stays `approved` in production.
- **Default if unanswered:** Synthetic demo only; production source remains `pending` until owners approve a named partner.

### D-P3-002 — Finalize Spain Partner CSV v1 column set

- **Question:** Confirm required/optional columns in [`INGESTION_ARCHITECTURE.md`](INGESTION_ARCHITECTURE.md) (especially bathrooms, image_urls, lat/lng).
- **Impact:** Adapter Zod schema and agency template file.
- **Default if unanswered:** Use the draft column set in the ingestion architecture doc.

### D-P3-003 — Confirm job runner for production

- **Question:** Stay with **pg-boss** (ADR-024) or switch to Inngest/Trigger.dev?
- **Impact:** `apps/worker` implementation, ops, cost.
- **Default if unanswered:** pg-boss on Supabase/local Postgres.

### D-P3-004 — Malware scanner vendor

- **Question:** ClamAV sidecar vs cloud AV API?
- **Impact:** Media pipeline, credentials, CI strategy.
- **Default if unanswered:** EICAR fixture harness locally; block production binary ingest until scanner chosen.

### D-P3-005 — Hotlink policy

- **Question:** Allow public hotlink display when `image_rights=hotlink_only`, or always placeholder?
- **Impact:** Gallery UX and abuse risk.
- **Default if unanswered:** Placeholder only (no public hotlinks) in Phase 3.

### D-P3-006 — Partner/admin session wiring timeline

- **Question:** Must verified Supabase session replace `x-user-id` **before** any partner UI is reachable on shared environments?
- **Impact:** Security launch gate ([`PHASE3_SECURITY_REVIEW.md`](PHASE3_SECURITY_REVIEW.md)).
- **Default if unanswered:** **Yes** — privileged routes require verified session before non-local deploy.

### D-P3-007 — Freshness thresholds

- **Question:** Hours/days from `temporarily_unverified` → `stale` → `withdrawn`?
- **Impact:** `freshness.scan` config.
- **Default if unanswered:** 72h → temporarily_unverified grace already applied on miss; 7d → stale; 30d → withdrawn (document in feed config).

### D-P3-008 — Duplicate auto-link

- **Question:** May reviewers auto-link high-band duplicates to one physical property in Phase 3, or suggestions only?
- **Impact:** Admin UX; ADR-020 remains no automatic merge.
- **Default if unanswered:** Suggestions only; explicit admin link action required.

### D-P3-009 — Transactional email for import failures

- **Question:** Notify org_owner on `completed_with_errors` / `failed` in Phase 3?
- **Impact:** Email adapter activation; credentials.
- **Default if unanswered:** In-app only for Phase 3 slice; fake email in tests; real email deferred unless credentials supplied.

### D-P3-010 — Written permission artifact storage

- **Question:** Store permission PDFs in Supabase Storage vs external GDrive link in `notes`?
- **Impact:** Storage buckets and admin UI.
- **Default if unanswered:** `notes` + external URL reference in Phase 3; formal artifact bucket later.

## Credential checklist (implementation)

| Need                              | Required for                   |
| --------------------------------- | ------------------------------ |
| Local Postgres/PostGIS            | All Phase 3 local acceptance   |
| FakeAuth                          | Demo agency CI                 |
| Supabase Auth                     | Real agency users              |
| Supabase Storage                  | Production media + uploads     |
| Job runner (pg-boss on hosted DB) | Async imports in staging/prod  |
| Malware scanner                   | Production image ingest        |
| Email provider                    | Optional failure notifications |
| Named partner written permission  | Live HTTP/feed beyond fixtures |

## Exit criteria for this register

Phase 3 implementation may start when:

1. Product explicitly approves [`PHASE3_PLAN.md`](PHASE3_PLAN.md) and companions.
2. D-P3-001 and D-P3-006 are answered (or defaults explicitly accepted).
3. No instruction to implement Phase 4 buyer workspace yet.
