# Phase 3 plan — Live inventory and agency/admin operations

Date: 2026-08-05  
Status: **Planning complete — awaiting explicit implementation approval**  
Roadmap: ADR-022 ([`DECISIONS.md`](DECISIONS.md)) — Phase 3 = live inventory; Phase 4 = buyer workspace remainder.

Companions: [`INGESTION_ARCHITECTURE.md`](INGESTION_ARCHITECTURE.md), [`SOURCE_PERMISSION_MODEL.md`](SOURCE_PERMISSION_MODEL.md), [`AGENCY_PORTAL_DESIGN.md`](AGENCY_PORTAL_DESIGN.md), [`PHASE3_DATABASE_CHANGES.md`](PHASE3_DATABASE_CHANGES.md), [`PHASE3_SECURITY_REVIEW.md`](PHASE3_SECURITY_REVIEW.md), [`PHASE3_DECISIONS_REQUIRED.md`](PHASE3_DECISIONS_REQUIRED.md).

## Objective

Create an authorized live inventory ingestion, review and publication system for estate agencies and property developers. First vertical slice: **one cooperating agency**, **one Spain Partner CSV v1 format**, **one complete listing lifecycle**.

## Non-goals

- Unauthorized scraping, CAPTCHA bypass, access-control evasion
- Auto-merge of physical properties without human review
- Nationwide multi-partner rollout beyond the demo agency
- Buyer shortlists / alerts / leads (Phase 4)
- AI, WhatsApp, voice, map-distance enrichment

## Vertical slice (acceptance spine)

| Element      | Value                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Organization | Seeded `demo-catalonia-agency`                                                                       |
| Source key   | `partner-csv-demo-catalonia` (`approved`, `csv`)                                                     |
| Format       | Spain Partner CSV v1                                                                                 |
| Lifecycle    | `draft` → `pending_review` → `published`/`available` → `temporarily_unverified` → `withdrawn`/`sold` |
| Actors       | `org_owner` / `org_agent` + platform `listing_reviewer` / `platform_admin`                           |

## Credential vs local matrix

| Capability                         | Local / CI                                    | Needs credentials             |
| ---------------------------------- | --------------------------------------------- | ----------------------------- |
| Schema, RLS, CSV/XML/JSON fixtures | Yes                                           | —                             |
| Demo agency FakeAuth OTP           | Yes                                           | Supabase Auth for real agents |
| File upload storage                | `LocalStorageProvider`                        | Supabase Storage              |
| Jobs                               | `inline` or pg-boss on local Postgres         | Hosted Supabase Postgres      |
| Geography match to seeds           | Yes                                           | Licensed geocoder later       |
| Media malware                      | EICAR fixture                                 | ClamAV / cloud scanner        |
| Import failure email               | Fake email sink                               | Resend / SendGrid / etc.      |
| Real partner HTTP feed             | Documented blocked without written permission | Partner + approved registry   |

---

## Task catalogue

Each task lists dependencies, database changes, API/service boundaries, UI changes, security requirements, tests, and acceptance criteria.

### 1. Source and permission registry

**Dependencies:** Phase 2 `data_sources` table; ADR-016/017.

**Database:** Extend `data_sources`; add `feed_configs`, `source_permission_events`; optional `source_endpoints`. See [`PHASE3_DATABASE_CHANGES.md`](PHASE3_DATABASE_CHANGES.md).

**API/services:** `SourceRegistryService` — list/get/create/update sources; `assertSourceRunnable(sourceId)`; admin-only approve/suspend/expire.

**UI:** Admin source register list + detail; permission status badges.

**Security:** Only `platform_admin` / `listing_reviewer` may change `permission_status`. Jobs must call gate before run. Audit every status change.

**Tests:** Unit gate matrix; DB seed for demo + pending generic sources; expired permission blocks job.

**Acceptance:**

- [ ] Jobs refuse run when permission is `pending`, `expired`, `suspended`, or missing.
- [ ] Demo CSV source is `approved` in seed; generic partners remain `pending` until owners act.
- [ ] Permission changes write `source_permission_events` + `audit_events`.

---

### 2. Agency/developer organizations and role-based access

**Dependencies:** Existing `organizations`, `organization_members`, `roles` tables; AuthProvider.

**Database:** Seed demo org + members; seed `permissions` / `role_permissions` catalog; optional `organization_member_roles` if multi-role needed.

**API/services:** `OrganizationService`, `MembershipService`; middleware `requireOrgMember(orgId, permission)`, `requirePlatformRole(role)`.

**UI:** Partner shell under `/[locale]/partner/...`; admin shell `/[locale]/admin/...`. Account switcher when user has multiple orgs (Phase 3: single demo org sufficient).

**Security:** Cross-org isolation via RLS + app checks. Production memberships use Supabase Auth UUIDs as `users.id`. FakeAuth only in development/test.

**Tests:** Two-org isolation (member A cannot read org B); role denial for missing permission; FakeAuth seed path.

**Acceptance:**

- [ ] Demo org seeded with `org_owner` and `org_agent`.
- [ ] Partner APIs return 403 across orgs.
- [ ] Platform admin can list all orgs; agents cannot.

---

### 3. CSV upload

**Dependencies:** Tasks 1–2; StorageProvider; worker jobs.

**Database:** `feed_configs.mapping` for Spain Partner CSV v1; import run links to uploaded object key.

**API/services:** `POST /api/v1/partner/imports` (multipart or signed upload); creates `import_runs` + enqueues `import.run`.

**UI:** Agency “Upload CSV” with dry-run preview (mapping + sample rows) then confirm.

**Security:** Upload size/type limits; virus scan enqueue before parse when media present; only org members of owning source.

**Tests:** Fixture CSV happy path; malformed CSV quarantines rows; dry-run does not persist listings.

**Acceptance:**

- [ ] Agency can upload Spain Partner CSV v1 and receive a structured import report.
- [ ] Dry-run shows validation without writing listings.
- [ ] Re-upload identical file updates in place (no duplicate listings).

---

### 4. Generic JSON feed ingestion

**Dependencies:** Adapter interface ([`INGESTION_ARCHITECTURE.md`](INGESTION_ARCHITECTURE.md)); Task 1.

**Database:** Same persist path as CSV; `feed_configs.format = json`.

**API/services:** `JsonFeedAdapter.parse(raw) → CanonicalListingDraft[]`; fixture runner CLI/job.

**UI:** Admin “Run fixture import” for staging; partner HTTP webhook deferred until permission exists.

**Security:** Permission gate; schema validation; no remote fetch without approved endpoint.

**Tests:** Fixture JSON contract tests; idempotent reimport.

**Acceptance:**

- [ ] Fixture JSON adapter passes contract tests into the same normalize/persist pipeline.
- [ ] Live HTTP JSON feed remains blocked while source permission is `pending`.

---

### 5. Generic XML feed ingestion

**Dependencies:** Same as Task 4.

**Database:** Same persist path; `feed_configs.format = xml`.

**API/services:** `XmlFeedAdapter` with XXE-safe parser settings; fixture tests.

**UI:** Same admin fixture runner.

**Security:** Disable external entities; size limits; malicious XML fixtures rejected.

**Tests:** XXE/billion-laughs style fixtures fail closed; happy-path fixture imports.

**Acceptance:**

- [ ] XML fixtures import through the shared pipeline.
- [ ] Malicious XML fixtures are rejected without writing listings.

---

### 6. Raw import snapshot storage

**Dependencies:** Tasks 3–5; StorageProvider for large payloads optional.

**Database:** New `raw_snapshots` (hash, parser_version, retention, `import_run_id`, payload or storage_ref). Keep `property_provenance.raw_snapshot` for per-listing extract.

**API/services:** Snapshot writer in pipeline; `replaySnapshot(snapshotId, parserVersion)` admin/service only.

**UI:** Admin import-run detail shows snapshot hash + replay action (staging).

**Security:** Snapshots not publicly readable; org can read own; admin all; retention policy.

**Tests:** Replay with newer parser does not duplicate `(data_source_id, external_listing_id)`.

**Acceptance:**

- [ ] Every import run stores at least one raw snapshot (file or row payload).
- [ ] Replay is idempotent on listing identity.

---

### 7. Validation and normalization pipeline

**Dependencies:** Adapters; Phase 2 normalize patterns.

**Database:** Uses existing listing/physical tables; writes `import_errors` on failure.

**API/services:** Pipeline stages: parse → validate → normalize → geo-match → persist → media enqueue → duplicate scan. Shared `CanonicalListingDraft` type in `@spain/ingestion`.

**UI:** Error codes surfaced on import report (agency + admin).

**Security:** Never invent bathrooms/coords/images; nullify unknowns.

**Tests:** Row-level quarantine; batch continues; enum unmapped → skipped/quarantined with code.

**Acceptance:**

- [ ] Invalid rows quarantine without aborting the entire import.
- [ ] Normalized property types and environment types are stable and documented.

---

### 8. Geography matching

**Dependencies:** Seeded municipalities/neighborhoods; Task 7.

**Database:** Optional `geo_match_confidence` on listings/locations; FK to municipality/neighborhood when matched.

**API/services:** `GeographyMatcher.match({ municipality, neighborhood, lat, lng })`.

**UI:** Admin sees unmatched geo warnings; agency sees area label even when FK unmatched.

**Security:** Approximate coords never displayed as exact; no invented lat/lng.

**Tests:** Match Barcelona seed areas; unknown municipality leaves FK null with warning.

**Acceptance:**

- [ ] Known Catalonia seed names resolve to FKs with confidence.
- [ ] Missing coords are not invented; accuracy flags are stored when present.

---

### 9. Import runs, errors and quarantine

**Dependencies:** Phase 2 `import_runs` / `import_errors`; Tasks 3–7.

**Database:** Extend counters/report; add `ingestion_items` for per-row UI progress if needed.

**API/services:** `GET /api/v1/partner/imports`, `GET /api/v1/partner/imports/{id}`, admin equivalents.

**UI:** Run list + detail with error table and quarantine export.

**Security:** Org-scoped; workers use service role.

**Tests:** Report counts match Phase 2 semantics (`inserted`/`updated`/`rejected`/`skipped`).

**Acceptance:**

- [ ] Agency sees only own org runs; admin sees all.
- [ ] Structured report is stored on `import_runs.report`.

---

### 10. Physical-property versus source-listing separation

**Dependencies:** ADR-020; Phase 2 schema.

**Database:** Continue 1 listing → provisional physical on insert; no auto cross-source merge.

**API/services:** Persist layer always upserts listing by `(data_source_id, external_listing_id)`.

**UI:** Detail shows listing + “physical match” status (provisional / candidate / linked).

**Security:** Merges only via admin duplicate resolution (Task 11).

**Tests:** Two sources same address create two listings + one duplicate candidate, not one listing.

**Acceptance:**

- [ ] Multiple source listings can exist for one physical property only after explicit admin link.
- [ ] Legacy snapshot rows remain separate and labelled.

---

### 11. Duplicate candidate detection

**Dependencies:** Task 10; worker job `duplicates.scan`.

**Database:** `duplicate_candidates` (left/right listing or physical ids, score, band, status).

**API/services:** `DuplicateService.scan`, `resolve` (link / dismiss / keep separate).

**UI:** Admin duplicates queue.

**Security:** Resolve requires `listing_reviewer` or `platform_admin`; audited.

**Tests:** Exact external-id conflict within source blocked by unique constraint; fuzzy pair creates candidate.

**Acceptance:**

- [ ] Candidates preserve separate source listings until explicit link.
- [ ] Dismissed candidates do not reappear at same score without content change.

---

### 12. Listing freshness and lifecycle management

**Dependencies:** Tasks 3, 9; worker `freshness.scan`.

**Database:** Ensure status history writes; optional `missing_since` column; config thresholds.

**API/services:** Lifecycle transitions with guards; failed feed path does not mass-withdraw.

**UI:** Agency freshness badges; admin withdraw/publish controls.

**Security:** Only approved sources may set public browseable live statuses; legacy stays snapshot.

**Tests:** Full sync miss → `temporarily_unverified`; failed job → no status change; publish requires permission.

**Acceptance:**

- [ ] Missing-from-successful-full-sync enters `temporarily_unverified` first.
- [ ] Failed feed does not withdraw all listings.
- [ ] Public UI never presents partner rows as verified without review/publish rules.

---

### 13. Price and status history

**Dependencies:** Existing history tables; Task 7 persist.

**Database:** Write `listing_status_history` on transitions (Phase 2 gap); price history on amount change only.

**API/services:** Extend `getPropertyDetails` with history arrays for published listings.

**UI:** Detail price/status timeline (partner + public where appropriate).

**Security:** History immutable append-only from services.

**Tests:** Identical reimport → zero new price events; price change → exactly one event.

**Acceptance:**

- [ ] Changed price creates exactly one price event.
- [ ] Identical reimport creates no fake histories.

---

### 14. Authorized media import and rights metadata

**Dependencies:** StorageProvider; source `image_rights`; Task 3 image_urls column.

**Database:** Use `media_assets`, `media_rights`, `listing_media`; reject storage when rights insufficient.

**API/services:** `MediaIngestionService`; `POST /api/v1/partner/media/uploads`; worker `media.process`.

**UI:** Agency rights declaration; placeholder until approved; admin rights review.

**Security:** No hotlink-only download-to-store; malware fixture locally; production scanner TBD.

**Tests:** `image_rights=none` blocks asset create; EICAR rejected; authorized display path stores asset.

**Acceptance:**

- [ ] Unauthorized images are blocked.
- [ ] Public gallery shows only rights-cleared assets; otherwise placeholders.

---

### 15. Administrator review interface

**Dependencies:** Tasks 1–2, 9–14.

**Database:** Uses listings + audit; no separate CMS schema required for slice.

**API/services:** `POST /api/v1/admin/listings/{id}/publish|withdraw`, duplicates resolve, source approve.

**UI:** See [`AGENCY_PORTAL_DESIGN.md`](AGENCY_PORTAL_DESIGN.md) admin IA.

**Security:** Platform roles only; all actions audited.

**Tests:** Playwright admin publish path; unauthorized agent cannot publish.

**Acceptance:**

- [ ] Admin can review, publish, update and withdraw listings.
- [ ] Publish sets `is_public_browseable` only when permission and rights allow.

---

### 16. Agency inventory interface

**Dependencies:** Tasks 2–3, 9, 12, 14.

**API/services:** Partner listing list/filter, import create/get, media upload.

**UI:** Partner inventory table, CSV upload, import history, rights declarations.

**Security:** Org-scoped RLS + membership checks.

**Tests:** Playwright agency CSV → pending_review visible to admin.

**Acceptance:**

- [ ] Partner can manage own listings, imports and media rights declarations.
- [ ] Partner cannot see another agency’s inventory.

---

### 17. Audit logs

**Dependencies:** Tasks 1–2, 15–16.

**Database:** `audit_events` append-only.

**API/services:** `AuditService.record`; admin query; partner query filtered by org.

**UI:** Admin audit viewer; partner limited activity feed.

**Security:** No UPDATE/DELETE policies for clients; service insert only.

**Tests:** Publish writes audit row with actor and before/after.

**Acceptance:**

- [ ] Sensitive actions (permission change, publish, withdraw, duplicate resolve, media rights) are audited.
- [ ] Partners cannot read other orgs’ audit rows.

---

### 18. Background-job architecture

**Dependencies:** ADR-024; `apps/worker` placeholder.

**Database:** pg-boss schema (or vendor tables); job metadata optional in `import_runs`.

**API/services:** Job names: `import.run`, `import.continue`, `freshness.scan`, `media.process`, `duplicates.scan`. `JOBS_PROVIDER=inline|pgboss`.

**UI:** Admin job/health indicators (basic).

**Security:** Worker uses service-role DB URL; never exposes fake OTP; no scrape jobs.

**Tests:** Inline provider runs pipeline in CI; pg-boss smoke on local Postgres.

**Acceptance:**

- [ ] CSV import can complete asynchronously via worker (or inline in test).
- [ ] Freshness and duplicate scans are schedulable without blocking HTTP requests.

---

### 19. RLS and cross-agency isolation

**Dependencies:** Tasks 2, 9, 14–17; [`PHASE3_SECURITY_REVIEW.md`](PHASE3_SECURITY_REVIEW.md).

**Database:** New Phase 3 RLS migration; JWT claim helpers for org id / roles.

**API/services:** Prefer set_config JWT claims on partner requests; document service-role worker bypass.

**UI:** N/A beyond error states.

**Security:** Two-org proof; public browse unchanged for `is_public_browseable`.

**Tests:** Extend `pnpm test:db` with org A/B listing and import isolation.

**Acceptance:**

- [ ] Cross-agency isolation is tested and documented in RLS status matrix.
- [ ] Public anonymous browse still works for published listings only.

---

### 20. Integration, browser and security testing

**Dependencies:** All above.

**Database:** Fixture agency CSV under `data/fixtures/partner/` (to be added at implementation).

**API/services:** Covered by integration suites.

**UI:** Playwright partner → admin → public journey; axe on partner/admin primary screens.

**Security:** Malicious CSV/XML; expired permission; cross-org 403; unauthorized media.

**Tests:** `pnpm test`, `test:db`, `test:e2e` extended; security fixture suite.

**Acceptance:**

- [ ] Full suite green locally without live partner credentials.
- [ ] Documented credential-gated checks remain clearly labelled.

---

## Suggested implementation order

1. DB migrations + seeds (org, source, permissions, new tables)
2. RLS policies + `test:db` isolation
3. Ingestion adapter interface + CSV pipeline + raw snapshots
4. Worker job wiring (inline + pg-boss)
5. Partner + admin APIs
6. Partner + admin UI
7. JSON/XML fixtures
8. Freshness, duplicates, media rights
9. Audit + Playwright + security fixtures
10. Stop and accept Phase 3 before Phase 4 buyer workspace

## Implementation gate

**Do not write application code for Phase 3 until product/engineering explicitly approve this plan set.**
