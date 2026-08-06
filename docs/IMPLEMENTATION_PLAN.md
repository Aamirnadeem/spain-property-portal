# Spain Property Buyer Portal — Implementation Plan

Version: 1.1  
Status: Phase 0 deliverable (planning complete + legacy assessment; application scaffolding not started)  
Authoritative source: [`spain_property_portal_build_plan_and_master_prompt_v2.md`](spain_property_portal_build_plan_and_master_prompt_v2.md)  
Related docs: [`ARCHITECTURE.md`](ARCHITECTURE.md), [`DATABASE_DESIGN.md`](DATABASE_DESIGN.md), [`SECURITY_AND_PRIVACY.md`](SECURITY_AND_PRIVACY.md), [`EXTERNAL_SERVICES.md`](EXTERNAL_SERVICES.md), [`DECISIONS_REQUIRED.md`](DECISIONS_REQUIRED.md), [`LEGACY_CODE_ASSESSMENT.md`](LEGACY_CODE_ASSESSMENT.md)

---

## 1. Repository audit

### 1.1 Verdict

**Greenfield production app + frozen legacy reference.** There is still no production monorepo (Next.js / Supabase / workers). The repository now includes an **editable** Vite/React Barcelona Property Explorer under [`legacy/`](../legacy/) and the canonical 60-record snapshot at [`data/legacy/barcelona_property_explorer_legacy_60.json`](../data/legacy/barcelona_property_explorer_legacy_60.json). Full findings: [`LEGACY_CODE_ASSESSMENT.md`](LEGACY_CODE_ASSESSMENT.md).

### 1.2 Present today

| Asset                                                           | Status                                                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `docs/spain_property_portal_build_plan_and_master_prompt_v2.md` | Authoritative merged build pack                                                     |
| Phase 0 planning docs                                           | Present (this file and companions)                                                  |
| `legacy/` Barcelona Property Explorer                           | **Editable** Vite + React + Express scaffold; frozen reference only — do not modify |
| `data/legacy/barcelona_property_explorer_legacy_60.json`        | **Present** (60 records; identical to `legacy/client/src/data/properties.json`)     |
| Production monorepo (`apps/`, `packages/`)                      | Absent — Phase 1 not started                                                        |
| Modular pack files (`01_PROJECT_SPEC.md`, etc.)                 | Content merged into v2; not present as separate files                               |
| Credentials / `.env`                                            | Absent                                                                              |
| Production backend, AI, ingestion, or CI                        | Absent                                                                              |

### 1.3 Implications

- Build the production monorepo from scratch when Phase 1 is explicitly approved; **do not** lift `legacy/` into `apps/web`.
- Inherit visual language and UX patterns from the legacy explorer (see §2.1 preserve checklist); rebuild on Next.js + Postgres/PostGIS.
- Phase 2 legacy importer is **unblocked for file presence**; still mark rows `legacy_snapshot` until rights/freshness are reviewed; do not invent images; do not scrape portal URLs.
- Use typed provider adapters and fakes so engineering can proceed without production credentials.

---

## 2. Product architecture (summary)

A **modular monolith** multilingual portal for buying property throughout Spain, with Catalonia (Barcelona, Girona, Lleida, Tarragona) as the first commercial focus. The data model supports all Spain from day one. Alcaraz (Albacete, Castilla-La Mancha) must never be placed under Catalonia.

**Buyer journey:** landing/search → cards/list/table/map → property detail → AI or refine → favourites/shortlists → compare → cost estimate → enquire/viewing → human handoff. Anonymous browsing remains useful; registration unlocks persistence.

**Channels:** day-one architecture is website chat + WhatsApp-ready + voice-ready. MVP activates website text chat only. WhatsApp is the first commercial upgrade. Browser voice, then telephone voice, follow proven demand. All channels share one identity, consent, conversation, search preferences, shortlists, leads and handoff model.

**Inventory policy:** direct agency/developer feeds, licensed APIs, partner CSV/XML/JSON, manual entry, or explicitly authorized crawling. Unauthorized mass scraping, CAPTCHA bypass, access-control evasion and unlicensed image copying are prohibited.

**Differentiation:** provenance-aware inventory, explainable comparison, buyer education with citations, document readiness indicators, and a tool-bound AI that never invents listings.

Full architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md).

### 2.1 UI patterns to preserve from legacy (rebuild, do not copy)

Documented in detail in [`LEGACY_CODE_ASSESSMENT.md`](LEGACY_CODE_ASSESSMENT.md) §3:

- Sticky header, brand lockup, dark/light Mediterranean theme (teal / sand / terracotta; General Sans, Fraunces, JetBrains Mono)
- Desktop filter sidebar + mobile collapsible filters
- Cards vs comparison-table toggle; KPI strip on filtered results
- Category badges (City Center / Coastal / Hillside), price formatters, empty states, `data-testid` conventions
- Add in rebuild: URL-backed search state, list + map views, in-app detail, provenance/freshness, i18n/RTL, tiny-sample KPI caution; do not default-hide homes under 2 bedrooms

---

## 3. Locked engineering defaults

Recorded in [`DECISIONS_REQUIRED.md`](DECISIONS_REQUIRED.md). Reversible unless marked irreversible.

| Decision      | Default                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| Monorepo      | pnpm workspaces + Turborepo                                                   |
| Web           | Next.js App Router, React, TypeScript, Tailwind, accessible component library |
| Database      | PostgreSQL + PostGIS via Supabase                                             |
| ORM           | Drizzle only (no Prisma)                                                      |
| Auth          | Supabase Auth: email OTP + mobile SMS OTP                                     |
| Storage       | Supabase Storage / S3-compatible with CDN and signed uploads                  |
| Search MVP    | PostgreSQL FTS, unaccent, pg_trgm, PostGIS                                    |
| Map           | MapLibre GL JS + licensed tile/geocoding providers                            |
| AI service    | TypeScript service with typed OpenAPI contracts                               |
| Retrieval     | PostgreSQL + pgvector (approved knowledge only)                               |
| Jobs          | One framework — final pick in Phase 1 (Inngest vs Trigger.dev vs pg-boss)     |
| API hosting   | Prefer Next.js route handlers initially; extract `apps/api` if needed         |
| Observability | Sentry + OpenTelemetry-compatible traces + structured logs                    |

---

## 4. Proposed monorepo structure

```text
apps/
  web/                    # public portal, account, admin, partner UI
  api/                    # domain API/BFF if not fully in Next.js
  ai-service/             # orchestration, RAG, evaluations
  worker/                 # ingestion, media, enrichment, alerts, freshness
packages/
  database/               # schema, migrations, RLS, seeds
  domain/                 # entities, policies, scoring, status machines
  search/                 # typed search model and adapters
  ingestion/              # source contracts, normalization, deduplication
  communications/         # email/SMS/WhatsApp/voice interfaces and adapters
  ai-tools/               # property and guidance tool contracts
  ui/                     # shared design system
  i18n/                   # dictionaries, locale routing, formatting (en, es, ca, ar)
  observability/          # logging, traces, metrics
  config/                 # env validation, lint, TypeScript configs
data/
  legacy/                 # barcelona_property_explorer_legacy_60.json (present)
  fixtures/               # CI edge-case fixtures
legacy/                   # FROZEN reference SPA — do not modify; see LEGACY_CODE_ASSESSMENT.md
docs/
  (this pack and operational docs)
```

---

## 5. MVP vs later channel upgrades

### 5.1 In MVP (Phases 0–6 core)

- Anonymous browse with card, list, table and map views
- Email and mobile OTP (fakes locally; real providers when credentials exist)
- Favourites, named shortlists, comparison, saved searches, email alerts
- Enquiries and viewing requests; partner and admin operations
- At least one permitted import path (manual + CSV; live partner when rights exist)
- Provenance, freshness, media rights, price/status history
- Multilingual UI: English, Spanish, Catalan, Arabic (RTL)
- Website multilingual AI text chat with typed tools and grounded guidance
- Channel-neutral conversation schema, consent model, adapter **interfaces**, webhook framework
- Call tables created early but unused
- Privacy export and deletion
- WCAG 2.2 AA target

### 5.2 Not MVP — WhatsApp (Phase 7)

Activate only after dependable inventory, lead operations, approved WhatsApp Business account/templates, consent/opt-out, and cost monitoring exist.

Capabilities retained from the spec: inbound text/location/voice notes; property cards with authorized images; identity linking; viewing/handoff; transactional vs marketing consent separation; website conversation continuity; delivery/read/failure handling. No unsolicited marketing.

### 5.3 Not MVP — Voice (Phase 8)

- **8a:** browser speech input/output after text chat is stable
- **8b:** full telephone voice after demand is proven

Capabilities retained: AI/recording disclosure; STT/TTS; same tools; numeric confirmation; human transfer; transcript/summary; recording consent/retention; no cold calling; never confirm viewing/availability without agency confirmation.

### 5.4 Explicit non-goals for first release

Nationwide coverage without dependable inventory; unlicensed portal copying; autonomous legal advice; binding valuations; automatic offer submission; mortgage approval decisions; full telephone voice; unsolicited WhatsApp campaigns; complex native mobile apps before responsive web validation.

---

## 6. Phased vertical-slice delivery

Relative complexity: S = small, M = medium, L = large, XL = extra-large.

### Phase 0 — Planning foundation (S) — **current**

**Deliver**

- This file and companion architecture, database, security, external-services and decisions docs
- [`LEGACY_CODE_ASSESSMENT.md`](LEGACY_CODE_ASSESSMENT.md) after legacy app + JSON were added
- Data-source permission register template (in [`EXTERNAL_SERVICES.md`](EXTERNAL_SERVICES.md))
- Threat model (in [`SECURITY_AND_PRIVACY.md`](SECURITY_AND_PRIVACY.md))
- Provider decision matrix and credential checklist
- Local development outline

**Acceptance criteria**

- [x] Repository audit complete; legacy reference + dataset status stated
- [x] Legacy assessment complete (editable source, UX preserve list, dataset quality, migration path)
- [x] Scope, rights gaps and credentials checklist explicit
- [x] Vertical-slice sequence and MVP vs channel upgrades defined
- [x] No production application code claimed as started; `legacy/` not modified for product work
- [x] Ready to begin Phase 1 only after explicit approval

---

### Phase 1 — Platform foundation / Slice 1 (M)

**Status:** Implemented in monorepo (2026-08-05). See [`PHASE1_ASSUMPTIONS.md`](PHASE1_ASSUMPTIONS.md) and root `README.md`.

**Deliver**

- Monorepo, CI (format, lint, typecheck, migrations, tests)
- PostgreSQL/PostGIS schema baseline, Drizzle migrations, RLS tests
- Geography seed foundation (Spain hierarchy extensible)
- Email and mobile OTP with local/test adapters
- Guest sessions and guest-to-account merge
- Roles and organization model
- Storage and media foundations (signed uploads)
- i18n routing for `en`, `es`, `ca`, `ar` with Arabic RTL
- Observability stubs (structured logs, health endpoints, error reporting hooks)

**Acceptance criteria**

- [x] Reproducible local setup documented
- [x] CI green for format, lint, typecheck, migrations, unit tests
- [x] RLS authorization tests pass (policy catalogue unit tests; live Postgres optional)
- [x] Email and SMS OTP pass e2e against fakes; resend cooldowns and rate limits exist
- [x] Guest session migrates eligible data after verification
- [x] Locale routes work including Arabic RTL shell
- [x] Health endpoints respond; secrets not in source control
- [x] `.env.example` documents required variables with no secrets

**Can proceed without external credentials:** yes (local Postgres/Supabase local, fake OTP adapters).

---

### Phase 2 — Geography, inventory and public search / Slices 2–3 (L)

**Deliver**

- Nationwide geographic hierarchy with official codes, multilingual names, aliases, exact/approximate coordinates and accuracy levels
- Physical property vs commercial listing separation; developments and units schema
- Source, provenance, permission, freshness, price/status history and media-rights tables
- Deterministic importer for [`data/legacy/barcelona_property_explorer_legacy_60.json`](../data/legacy/barcelona_property_explorer_legacy_60.json) (file **present**); field mapping in [`DATABASE_DESIGN.md`](DATABASE_DESIGN.md); synthetic fixtures for CI edge cases
- Imported records marked `legacy_snapshot`; original source URLs preserved; normalize inconsistent `property_type` while keeping source claims; no invented images; do not scrape Idealista/Fotocasa/etc. from stored URLs
- Manual listing workflow and authorized media upload
- Responsive card, list, table and map views with URL-backed search state — **map view deferred from Phase 2 slice; planned under Phase 5 (ADR-031)**
- Rebuild (not lift) legacy UX: filter sidebar, cards/compare toggle, KPI strip, Mediterranean tokens — plus list + map + in-app detail
- Filters: geography, price, beds, area, property type, lifestyle classifications (advertiser vs derived provenance); City Center / Coastal / Hillside as lifestyle/derived, not admin geography
- Synchronized map/list and accessible non-map alternative — **Phase 5**
- Property detail: gallery when rights exist, source, freshness, price history, verification explanations, energy fields
- KPI summaries that avoid misleading averages on tiny samples (improve on legacy means-only strip)
- SEO metadata, canonical/localized routes, structured data where appropriate
- Do not carry `maximum-scale=1` or default `bedroomsMin: 2` as hard product defaults

**Acceptance criteria**

- [x] Anonymous users can browse legacy-marked inventory; images only when rights-cleared (legacy 60 has none — text-first / non-photo placeholders only)
- [ ] List, card, table and map views work responsively — **cards/table done; map → Phase 5**
- [x] Location and lifestyle filters work (text/area + environment); richer hierarchy/map filters → Phase 5
- [x] Property pages show source, rights, freshness and energy-state fields
- [x] All 60 legacy records import idempotently and are visibly marked as snapshots until verified
- [x] Alcaraz seeded under Castilla-La Mancha / Albacete, not Catalonia (not present in the 60 JSON; still required in geography seeds)
- [ ] Approximate locations are not displayed as exact — **enforced when map/coords ship (Phase 5)**
- [x] Accessibility: keyboard access, focus management; map alternative (list) exists; pinch-zoom allowed
- [x] No invented property images; no unauthorized portal scraping

**Can proceed without external credentials:** mostly yes (legacy JSON + fixtures, OSM-dev or mock map tiles). Licensed production tiles need keys later.

**Unblocked:** real 60-record file is present. **Still restricted:** treat as snapshot/demo until rights/freshness review; Idealista/Fotocasa URLs are not a live-licence path. **Map UX:** see Phase 5 (ADR-031).

---

### Phase 3 — Live inventory and agency/admin operations / Slice 5 (XL)

> **Renumber (ADR-022):** Live inventory is Phase 3. Buyer workspace (beyond Phase 2 favourites) is Phase 4. Planning docs: [`PHASE3_PLAN.md`](PHASE3_PLAN.md), [`INGESTION_ARCHITECTURE.md`](INGESTION_ARCHITECTURE.md). **Do not implement until Phase 3 plan is explicitly approved.**

**First vertical slice:** one cooperating demo agency, one Spain Partner CSV v1 format, one complete listing lifecycle, admin review + agency inventory UI. JSON/XML adapters with fixtures in the same phase; E2E acceptance is CSV-first. No unauthorized scraping.

**Deliver (exact sequence)**

1. Source registry and permission model
2. Agency/developer organizations and role-based access
3. Manual listing and rights-cleared media upload (if not already complete)
4. Generic CSV importer with mapping preview and dry run (demo agency end-to-end)
5. XML/JSON adapter interface and fixture tests
6. One real partner feed or authorized site adapter (when permission exists; otherwise register documents the block)
7. Raw snapshot storage and idempotent upsert
8. Normalization and geography matching
9. Image processing and rights records
10. Price/status history
11. Missing/stale workflow
12. Duplicate-candidate engine
13. Source-health and moderation dashboards (admin + agency portals)

Also: partner onboarding; API/webhook interfaces; authorized-crawl framework (no unauthorized third-party extractors); feed health events; takedown requests; audit logs; pg-boss (or approved job provider) worker jobs.

**Acceptance criteria (ingestion)**

- [ ] Reimporting identical source data creates no duplicates or fake histories
- [ ] A changed price creates exactly one price event
- [ ] A failed feed does not withdraw all listings
- [ ] A property missing from one successful full sync enters `temporarily_unverified` first
- [ ] Expired source permission prevents new publication
- [ ] Unauthorized images are blocked
- [ ] Malicious image/XML fixtures are rejected
- [ ] Exact and approximate coordinates obey display policy
- [ ] Duplicate candidates preserve separate source listings
- [ ] Raw snapshots can be replayed with a newer parser
- [ ] Every public listing exposes source and freshness
- [ ] Legacy records remain visibly marked until verified
- [ ] At least one permitted live import path works end to end **or** the data-source register documents the block with owner and next action
- [ ] Admin can create, review, publish, update and withdraw listings
- [ ] Partner can manage listings, imports, media rights declarations and leads
- [ ] Cross-agency RLS isolation is tested (two orgs)

**Can proceed without external credentials:** CSV/XML fixtures, manual entry, fake media pipeline, FakeAuth demo org, local Postgres + pg-boss/inline. Live partner HTTP adapter and production media blocked without written permission, Supabase Auth/Storage credentials, and media rights.

---

### Phase 4 — Buyer workspace / Slice 4 (M)

> Favourites already shipped in Phase 2. **Planning:** [`PHASE4_PLAN.md`](PHASE4_PLAN.md) (ADR-030). **Phase 4A implemented** ([`PHASE4A_IMPLEMENTATION.md`](PHASE4A_IMPLEMENTATION.md)). **Phase 4B implemented** ([`PHASE4B_IMPLEMENTATION.md`](PHASE4B_IMPLEMENTATION.md), ADR-030b). **Phase 4C implemented** ([`PHASE4C_IMPLEMENTATION.md`](PHASE4C_IMPLEMENTATION.md), ADR-030c).

**Deliver (Phase 4 scope lock)**

- Multiple named shortlists; property and shortlist notes; default shortlist — **4A done**
- Comparison matrix with explainable weighted suitability scores — **4A done**
- Recently viewed / browsing history with privacy controls — **4B done**
- Saved searches; guest local → merge on auth — **4B done**
- Alerts **foundation**: in-app notification centre + TestNotificationProvider only (inline evaluation; no production email/SMS/WhatsApp) — **4B done** (ADR-030b; no longer deferred to 4C)
- Secure shareable comparison links (expire/revoke) — **4C done**
- Transactional guest→account merge for favourites, shortlists, searches, history, weights — 4A done for workspace; **4B done** for searches/history
- Owner RLS + cross-user isolation tests

**Deferred to Phase 4.1+ / Phase 6 (not Phase 4)**

- Leads and viewing requests
- Privacy export and deletion workers
- Production email/SMS/WhatsApp alert delivery and digests
- Shortlist collaborator invites (Phase 6)
- Purchase-stage labels / full collaborator export

**Acceptance criteria**

- [x] Registered users can shortlist, compare, note (favourites already in Phase 2) — **4A**
- [x] Registered users can save searches and review history — **4B**
- [x] Guest shortlists/views/saved searches/weights merge after registration when eligible — **4A/4B**
- [x] One user cannot access another user’s shortlists, notes or history — **4A/4B**
- [x] In-app notifications fire for subscribed alert events via test provider; no prod email/SMS/WhatsApp — **4B**
- [x] Share links hide identity, notes and history; expire and revoke work — **4C**
- [x] Suitability score shows calculation explanation and disclaimer — **4A**
- See: [`PHASE4_ACCEPTANCE_CRITERIA.md`](PHASE4_ACCEPTANCE_CRITERIA.md), [`PHASE4B_ACCEPTANCE_CRITERIA.md`](PHASE4B_ACCEPTANCE_CRITERIA.md), [`PHASE4C_ACCEPTANCE_CRITERIA.md`](PHASE4C_ACCEPTANCE_CRITERIA.md)

**Can proceed without external credentials:** yes with FakeAuth + TestNotificationProvider.

---

### Phase 5 — Map search and geospatial intelligence (ADR-031)

> **Renumber (ADR-031):** Phase **5** is Map Search / Geospatial (absorbs deferred Phase 2 map UX and former Phase 6 commute/amenity enrichment). Website AI chat moves to **Phase 6+**. Planning: [`PHASE5_PLAN.md`](PHASE5_PLAN.md). **Planning complete; implementation not started.**

**Deliver**

- Geographic hierarchy with official codes, multilingual aliases, boundaries/centroids (`geometry` 4326 + GiST), dataset provenance
- Property coordinates with source/confidence/precision; no invented coordinates
- Location privacy: public **approximate unless exact publication authorized**; projection to map/APIs/shares
- MapLibre GL JS map/list synchronization, clustering, viewport search, draw-polygon, accessible non-map alternative; **minimal map marker DTO**
- Geographic filters + `phase5.v1` saved-search spatial envelope (versioned GeoJSON + validated PostGIS geometry)
- Environmental classifications calculated / explainable / versioned (sea view advertiser-declared only)
- Amenities/transit proximity (Barcelona-first; permissioned data); metre distances via geography
- Private commute destinations (encrypted or access-restricted) + guest merge; provider-neutral routing with mocked local/test providers
- Geocoding quarantine for low confidence; enrichment pipeline with provenance
- Controlled canonical URLs for map/search SEO (no indexing of unlimited geometry variants)
- Typed map search services; security/RLS; Playwright journey

**First vertical slice:** Barcelona published markers → map/list sync → viewport search → one polygon → nearby transit/beach/park straight-line → privacy → save geographic search.

**Acceptance criteria:** see [`PHASE5_ACCEPTANCE_CRITERIA.md`](PHASE5_ACCEPTANCE_CRITERIA.md).

**Can proceed without external credentials:** yes with Fake routing/geocode providers + OSM/demo tiles. Licensed tiles, amenity licenses, and live routing need keys/acks later.

---

### Phase 6 — Website AI chat MVP (was Phase 5; ADR-031)

**Deliver**

- Chat UI and conversation persistence (registered history; restricted anonymous retention)
- Channel-neutral conversation domain used by website chat
- Typed natural-language → `PropertySearchCriteria`; hard constraints vs preferences; criteria confirmation UI
- Property cards in chat; compare/save/request-viewing actions
- Approved-source buyer guidance with citations, jurisdiction, review date, assumptions, disclaimer, professional escalation
- Human handoff
- Rate limits, token/cost budgets, prompt-injection isolation, PII minimization
- AI evaluation suite: hallucinated facts, citations, jurisdiction, safe escalation
- Uses Phase 5 `get_location_context` / map tools where applicable — must respect location privacy projection

**Required typed tools (all must exist)**

`search_properties`, `get_property_details`, `get_property_freshness`, `compare_properties`, `find_similar_properties`, `get_price_history`, `get_location_context`, `calculate_estimated_purchase_cost`, `create_or_update_shortlist`, `save_property`, `save_search`, `request_viewing`, `create_lead`, `request_human_agent`, `get_general_buying_guidance`, `get_document_checklist`

**Acceptance criteria**

- [ ] Website AI returns only database/tool-result properties; never invents listing facts
- [ ] No unrestricted SQL, arbitrary internet access or direct user-table writes for the model
- [ ] Guidance answers include jurisdiction, citation/review date, disclaimer and escalation
- [ ] Writes (save/shortlist/lead/viewing) require user intent and authorization
- [ ] Anonymous rate limits and cost budgets enforced
- [ ] Evaluation suite passes critical cases
- [ ] Visible AI identity and limitations in UI
- [ ] Human handoff creates assignable handoff records
- [ ] Location tools never return exact coordinates when policy forbids

**Can proceed without external credentials:** orchestration, tool contracts, eval harness with mocked LLM. Live chat quality needs LLM API keys.

---

### Phase 7 — Buyer intelligence + omnichannel foundations (was Phase 6; ADR-031)

> Commute profiles and amenity/terrain derivation moved to **Phase 5**. This phase retains cost rules, checklists, risk overlays, off-plan workflows, collaborative shortlists, and omnichannel **interfaces**.

**Deliver — buyer intelligence**

- Versioned regional acquisition-cost rules engine (no single hardcoded Spain percentage)
- Document-readiness checklist templates (never claim to prove title/compliance)
- Selected authoritative risk overlays (beyond Phase 5 Barcelona amenity slice)
- Off-plan development/unit workflows with auditable evidence states
- Collaborative shortlists and export

**Deliver — omnichannel foundations (interfaces only)**

- Channel-neutral conversations/messages/participants
- Channel identity links; communication consent and preferences
- Delivery records; agent handoffs and summaries
- Typed adapter contracts for email, SMS, WhatsApp, speech and telephony
- Provider fakes for tests
- Webhook signature verification, replay rejection, idempotency framework
- Call tables present; recording/telephony **not** enabled

**Acceptance criteria**

- [ ] Cost calculations store rule version and timestamp; show ranges, assumptions, professional-review warning
- [ ] Document readiness states are specific and auditable
- [ ] Off-plan verification badges are never green merely because a field was supplied
- [ ] Adapter interfaces and fakes tested; WhatsApp/voice not claimed operational
- [ ] Webhook replay rejected; signatures verified in framework tests
- [ ] Collaborative shortlists enforce view/comment permissions

**Can proceed without external credentials:** yes for rules, checklists, adapters/fakes.

---

### Phase 8 — WhatsApp commercial upgrade (was Phase 7; ADR-031)

**Prerequisites (all required)**

- Dependable inventory
- Lead response operation
- Approved business account and message templates
- Clear consent and opt-out process
- Cost controls and monitoring

**Deliver**

- Inbound webhook adapter; identity-linking flow
- Text, location and authorized image/property-card support
- Optional voice-note transcription
- Viewing and human-handoff actions
- Transactional alerts and opted-in marketing separation
- Conversation continuity with website
- Delivery/read/failure status handling
- Template governance

**Acceptance criteria**

- [ ] Identity linking only after deliberate verification and consent
- [ ] No unsolicited marketing; transactional vs marketing consent separated
- [ ] Property cards use authorized images and deep links only
- [ ] Opt-out processed; provider template/session rules respected
- [ ] Website and WhatsApp share conversation continuity
- [ ] End-to-end tests against configured provider (or documented staging sandbox)

**Can proceed without credentials:** adapter stubs only. Activation blocked without WABA and consent ops.

---

### Phase 9 — Voice upgrade (was Phase 8; ADR-031)

**9a Browser voice** after text chat stable.  
**9b Telephony** after demand validation.

**Deliver**

- Speech adapters; explicit AI and recording disclosure
- Numeric confirmation and error recovery for prices, dates, phones, addresses
- Phone call sessions (9b); human transfer
- Transcript, summary and lead attachment
- Send selected properties through opted-in email/WhatsApp
- Recording retention and deletion
- Multilingual quality tests
- No cold calling; outbound only on explicit request or legally valid consent

**Acceptance criteria**

- [ ] AI identity disclosed; recording consent captured before recording
- [ ] System never states viewing/availability confirmed without agency confirmation
- [ ] Same typed tools as text channels
- [ ] Retention/deletion jobs for recordings tested
- [ ] Multilingual routing and fallback quality tests pass

**Can proceed without credentials:** browser Web Speech prototypes with fakes. Telephony blocked without vendor credentials.

---

### Phase 10 — Scale and expansion (was Phase 9; ADR-031)

- Additional regions and partners
- Typesense/OpenSearch only when measurements justify it
- Mobile app only if usage supports it
- Performance and load testing
- Disaster recovery drills
- Partner billing/lead plans
- Advanced analytics and experimentation

**Acceptance criteria**

- [ ] Search scale adapter introduced only with measured justification
- [ ] DR restore tested on documented cadence
- [ ] Expansion does not drop provenance, rights or freshness requirements

---

## 7. MVP acceptance gate

The MVP is accepted only when all of the following are true (spec §13):

- Anonymous users can browse legitimate inventory with authorized images
- List, card, table and map views work responsively
- Location and lifestyle filters work
- Property pages show source, rights, freshness and energy-state fields
- Email and phone OTP pass e2e and abuse tests
- Registered users can favourite, shortlist, compare, note, save searches and review history
- Email alerts are produced by background jobs
- Admin can create, review, publish, update and withdraw listings
- At least one permitted live import path works end to end
- Stale/missing listings and price changes are handled
- English, Spanish, Catalan and Arabic work, including RTL
- Website AI chat returns only database properties and provides grounded guidance
- Privacy export and deletion workflows exist
- Critical security, accessibility, data-quality and browser tests pass
- Deployment, monitoring, backups and restore are documented

WhatsApp and telephone voice are **not** MVP acceptance requirements, but shared data contracts, consent model and adapter interfaces must exist.

---

## 8. Testing requirements (every slice)

Each slice must add relevant:

- Unit tests
- Schema/migration tests
- Authorization/RLS tests
- API integration tests
- Browser end-to-end tests (Playwright)
- Accessibility checks (WCAG 2.2 AA target)
- Data-quality and importer fixture tests
- Security/abuse tests
- AI evaluation tests (from Phase 5)

**Critical required cases (never drop)**

- Guest data merges correctly after OTP
- One user cannot access another user’s shortlists/conversations
- Identical reimport is idempotent
- Changed price creates one history event
- Failed feed does not withdraw inventory
- Expired permission blocks publication
- Unauthorized images are rejected
- Approximate locations are not exposed as exact
- AI returns no listing absent from the tool result
- AI legal guidance has jurisdiction, citation/review date, disclaimer and escalation
- Provider webhook replays are rejected
- Arabic RTL and core flows pass browser tests

**Definition of done:** implementation + migrations + authorization; loading/empty/error/permission states; monitoring; tests pass; localized copy or explicit fallback; env docs updated; no critical TODO presented as production.

---

## 9. Security, GDPR, observability, deployment, backup

See [`SECURITY_AND_PRIVACY.md`](SECURITY_AND_PRIVACY.md) for full threat model and GDPR.

| Area          | Requirement                                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security      | RLS; signed uploads; media re-encode/scan; HTML sanitize; SSRF/XXE controls; webhook signatures; CSP; secret manager; audit logs                           |
| GDPR          | Purpose-based consent; retention by type/channel; export/delete including AI-derived data; cookie consent; separate marketing/recording/profiling consents |
| Observability | Sentry; OTEL traces; structured logs; provider-cost metrics; ingestion health dashboards                                                                   |
| Deployment    | Preview + staging + production; migrations in CI/CD; never manual production schema edits; EU residency decision required                                  |
| Backup        | Automated Postgres + object storage backups; documented restore test cadence                                                                               |

---

## 10. Work that can proceed without external credentials

| Work                                                    | Notes                         |
| ------------------------------------------------------- | ----------------------------- |
| Phase 0 documentation                                   | Done in this deliverable      |
| Monorepo, CI, lint, typecheck                           | No cloud required             |
| Full schema, migrations, RLS, seeds, fixtures           | Local Postgres/PostGIS        |
| Domain + search query builder                           | Against local PostGIS         |
| Public and workspace UI against fixtures                | Mock/map-dev tiles acceptable |
| OTP/email/SMS/WhatsApp/voice adapter interfaces + fakes | Do not claim live integration |
| Ingestion with fixture CSV/XML and fake media           | No live partner needed        |
| AI orchestrator + eval harness with mocked LLM          | Live chat needs LLM key       |
| Playwright e2e against local stack                      | —                             |
| Admin/partner UI with test users                        | Local auth                    |

### Blocked without credentials or permissions

- Production OTP delivery (email/SMS vendors)
- Licensed production map tiles/geocoding
- Live LLM responses
- Real transactional email/SMS
- First live partner feed (needs written permission + media rights)
- WhatsApp Business activation
- Telephony / production STT-TTS vendors
- Production deploy, Sentry and backup backends

---

## 11. Local development outline (Phase 1)

1. Install Node LTS, pnpm, Docker (Postgres/PostGIS or Supabase CLI).
2. Clone repo; `pnpm install`.
3. Copy `.env.example` → `.env.local` (no secrets committed).
4. Start database; run migrations and seeds.
5. Start `apps/web` (and `ai-service` / `worker` as they appear).
6. Use fake OTP codes printed to logs in development.
7. Run `pnpm lint && pnpm typecheck && pnpm test` before claiming a slice done.
8. Run Playwright against local URLs for UI slices.

Detailed commands will be added when the monorepo is scaffolded (Phase 1 approval).

---

## 12. Legacy data and application status

| Item                  | Status                                                                               |
| --------------------- | ------------------------------------------------------------------------------------ |
| Application path      | `legacy/` (alias: barcelona-property-explorer-preview)                               |
| Application type      | Editable Vite/React/Express source — **frozen reference**                            |
| Dataset path          | `data/legacy/barcelona_property_explorer_legacy_60.json`                             |
| Dataset in repository | **Yes** (60 records; identical to embedded `legacy/client/src/data/properties.json`) |
| Assessment            | [`LEGACY_CODE_ASSESSMENT.md`](LEGACY_CODE_ASSESSMENT.md)                             |
| Importer design       | Required in Phase 2; mapping in [`DATABASE_DESIGN.md`](DATABASE_DESIGN.md)           |
| CI supplement         | `data/fixtures/` for edge cases beyond the 60                                        |
| Publication label     | `legacy_snapshot` until freshness and media rights verified                          |
| Images                | None in dataset; do not invent; preserve source URLs only                            |
| Portal URL caution    | Includes Idealista/Fotocasa/agency URLs — not a republication licence; no scrape     |

**Remaining owner action:** rights/freshness review before describing rows as live/verified. File supply (former D-016) is complete.

---

## 13. Risks

| Risk                                                 | Mitigation                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| No partner permission for live inventory             | CSV/manual path + explicit register block; do not scrape                         |
| Legacy snapshot mistaken for live licensed inventory | Keep `legacy_snapshot` label; no scrape; need permitted live source for MVP gate |
| Idealista/Fotocasa URL quality (some search pages)   | Store as supplied; flag weak listing identity in provenance                      |
| SMS pumping / OTP abuse                              | Cooldowns, per-IP/identity limits, CAPTCHA escalation, fake adapters in dev      |
| AI hallucination                                     | Tool-only property facts; eval suite; citations for guidance                     |
| Premature WhatsApp/voice                             | Interfaces only until prerequisites met                                          |
| Scope creep nationwide                               | One region, one dependable source, one complete buyer journey first              |
| Media rights violations                              | Rights records mandatory; block publish without basis                            |

---

## 14. Engineering working method

- Inspect before modifying; maintain this plan and [`DECISIONS_REQUIRED.md`](DECISIONS_REQUIRED.md)
- Build one complete vertical slice at a time
- Use migrations only; never edit production schema manually
- Add tests with each slice; fix failures before claiming completion
- Record reversible assumptions; stop for missing credentials, missing source permission, or irreversible legal/business decisions
- When a provider is unavailable: typed adapter + test fake + setup guide — do not pretend it is integrated
- Prefer one working end-to-end journey over many static screens

---

## 15. Next gate

**Phase 0 documentation is complete**, including the legacy assessment addendum.  
**Do not scaffold the monorepo or begin Phase 1 until explicitly approved.**  
**Do not modify files under `legacy/`.**

When approved, start Slice 1 (foundation) and mark Phase 0 acceptance item “Ready to begin Phase 1” complete.
