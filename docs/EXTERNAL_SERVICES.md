# Spain Property Buyer Portal — External Services

Version: 1.1  
Status: Phase 0 deliverable (updated after legacy assessment)  
Includes: provider decision matrix, credential checklist, data-source permission register template, `.env.example` outline  
Companion: [`DECISIONS_REQUIRED.md`](DECISIONS_REQUIRED.md), [`ARCHITECTURE.md`](ARCHITECTURE.md), [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md), [`LEGACY_CODE_ASSESSMENT.md`](LEGACY_CODE_ASSESSMENT.md)

---

## 1. Principle

All external providers are accessed through **typed adapter interfaces** in `packages/communications`, `packages/ingestion`, map/geocode clients and the AI provider client. Domain logic must not hardwire vendor SDKs.

When a provider is unavailable: implement the interface, a **test fake**, and a setup guide. **Do not claim the integration is live.**

---

## 2. Provider decision matrix

| Capability | MVP need | Locked / candidate | Adapter package | Fake for local/CI | Activation phase |
|------------|----------|--------------------|-----------------|-------------------|------------------|
| Postgres + PostGIS | Required | **Supabase** (default) | `packages/database` | Local Postgres/Supabase CLI | 1 |
| Auth OTP email/SMS transport | Required | Supabase Auth + SMS vendor TBD | Auth + `communications` | Log OTP to console / fixed test codes | 1 |
| Object storage | Required | Supabase Storage or S3-compatible | Storage client | Local disk/MinIO | 1–2 |
| Transactional email | Required | Resend / SendGrid / Postmark (TBD) | `communications/email` | In-memory/outbox fake | 1 / 3 |
| SMS OTP / SMS notify | OTP required | Twilio / MessageBird / Vonage (TBD) | `communications/sms` | Fake SMS sink | 1 |
| Background jobs | Required | Inngest **or** Trigger.dev **or** pg-boss (pick in Phase 1) | `apps/worker` | Synchronous/inline runner | 1 |
| Maps tiles | Required for map UX | MapLibre + licensed tiles (TBD vendor) | Map config | OSM demo tiles with attribution limits | 2 |
| Geocoding | Required for enrichment | Licensed geocoder (TBD) | Geo client | Fixture geocodes | 2 / 4 |
| LLM | Required for live AI | Provider TBD (OpenAI/Anthropic/etc.) | `apps/ai-service` | Mock LLM for evals/CI | 5 |
| Embeddings / vector | Guidance RAG | **pgvector** default | Knowledge store | Fixture embeddings | 5 |
| Error tracking | Required before prod | Sentry | `observability` | Console transport | 1 |
| Tracing metrics | Required before prod | OpenTelemetry → TBD backend | `observability` | No-op exporter | 1 |
| WhatsApp Business | Not MVP | Meta Cloud API or BSP (Twilio/etc.) TBD | `communications/whatsapp` | Fake webhook fixtures | 7 |
| STT / TTS | Not MVP | Browser APIs first; cloud vendors TBD | `communications/speech` | Fake transcripts | 8a |
| Telephony | Not MVP | Twilio / Vonage / etc. TBD | `communications/telephony` | Fake call events | 8b |
| Malware scan | Media pipeline | ClamAV or cloud scanner TBD | Worker media pipeline | EICAR fixture harness | 4 |
| CDN | Prod | TBD with hosting | — | — | Prod |

---

## 3. Credential checklist

### 3.1 Present in repository today

**None.** No `.env`, no cloud projects, no API keys.

### 3.2 Required eventually (by phase)

| Credential / config | Phase blocked if missing for *live* use | Local workaround |
|---------------------|------------------------------------------|------------------|
| `DATABASE_URL` / Supabase URL + anon + service keys | 1 prod | Local Postgres |
| Supabase JWT secret / Auth settings | 1 prod | Local Auth / fake OTP |
| Email provider API key | 3 live alerts / prod OTP email | Fake email adapter |
| SMS provider API key + sender | 1 prod mobile OTP | Fake SMS |
| Storage credentials | 2 prod media | Local/MinIO |
| Map tile API key | 2 prod map | Dev tiles |
| Geocoding API key | 4 enrichment | Fixtures |
| LLM API key | 5 live chat | Mock LLM |
| Sentry DSN | Prod MVP gate | Disabled/local |
| OTEL endpoint | Prod | No-op |
| WhatsApp token + verify token + app secret | 7 | Fake adapter |
| Telephony + STT/TTS keys | 8 | Fake adapters |
| Job framework keys (if SaaS) | 1 prod | Inline runner |

### 3.3 Non-credential blockers (legal/commercial)

| Blocker | Effect |
|---------|--------|
| Written partner/source permission + media rights | Blocks live Phase 4 partner adapter and public “live” claims |
| Legacy 60 rights/freshness review (D-019) | Blocks removing `legacy_snapshot` labelling / claiming live inventory |
| WhatsApp Business account + approved templates | Blocks Phase 7 activation |
| Recording consent policy finalized | Blocks Phase 8 recording |
| EU region / DPA decisions | Blocks production personal-data hosting choice |

---

## 4. Communication adapter interfaces (required)

Define TypeScript interfaces (names illustrative; implement in Phase 1/6):

```text
EmailAdapter.sendTransactional(message)
SmsAdapter.sendOtp / sendNotification
WhatsAppAdapter.sendTemplate / sendSessionMessage / parseInboundWebhook
SpeechToTextAdapter.transcribe
TextToSpeechAdapter.synthesize
TelephonyAdapter.createSession / transferToHuman / parseWebhook
HumanAgentRouter.assign / notify
```

Shared concerns:

- Idempotency keys
- Delivery status → `communication_deliveries`
- Consent basis checked before send
- Quiet hours for non-transactional messages
- Cost/rate limits
- Provider error taxonomy (retryable vs fatal)

---

## 5. Ingestion external dependencies

| Dependency | Use | Constraint |
|------------|-----|------------|
| Partner API/webhook | Live inventory | Permission registry approved |
| Partner CSV/XML/JSON | Imports | Mapping preview + dry run |
| Authorized partner website | Crawl only with written auth | Path/schedule/rights recorded |
| Official/open geo datasets | Enrichment | Licence recorded |
| Image CDN/origin | Media fetch | Rights `download_and_transform` or approved hotlink |

**Prohibited integrations:** scrapers for major portals without licence; CAPTCHA bypass services; residential proxy pools intended to evade blocks; unlicensed image mirrors.

---

## 6. Data-source permission register (template)

**Status:** placeholder register — no live sources approved yet.  
**Legacy 60 records:** snapshot/demo only; not a live permitted feed.

Copy new rows into operations tracking (spreadsheet or `data_sources` + `source_permissions` tables once implemented).

### 6.1 Register fields (mandatory)

```text
source_id
organization_id
source_name
domain
source_type: api | webhook | xml | json | csv | manual | authorized_crawl | legacy_snapshot
permission_status: pending | approved | restricted | suspended | expired
permission_document_reference
permitted_paths_or_endpoints
allowed_fields
image_rights: none | hotlink_only | display | download_and_transform
attribution_requirements
update_frequency
rate_limit
robots_reviewed_at
terms_reviewed_at
legal/commercial contact
technical contact
retention restrictions
takedown procedure
active_from / active_until
notes
```

### 6.2 Initial rows

| source_id | source_name | source_type | permission_status | image_rights | notes |
|-----------|-------------|-------------|-------------------|--------------|-------|
| `legacy-barcelona-explorer-60` | Barcelona Property Explorer legacy snapshot | `legacy_snapshot` | `restricted` | `none` (no images in file; URLs only; no republication of portal media) | File **present** at `data/legacy/barcelona_property_explorer_legacy_60.json`. Identical to `legacy/client/src/data/properties.json`. 60 rows. Portals include Engel & Völkers, Coldwell Banker, Lucas Fox, Fotocasa, Idealista — **not** a live licence (ADR-015). Some Idealista/Fotocasa URLs are search pages. Importer allowed as snapshot only; **no scrape**. |
| `manual-editor` | Internal / partner manual entry | `manual` | `pending` | per-upload declaration | First operational path after org verification |
| `partner-csv-generic` | Generic partner CSV | `csv` | `pending` | per agreement | Framework in Phase 4; no partner attached |
| `partner-xml-json-generic` | Generic CRM XML/JSON | `xml`/`json` | `pending` | per agreement | Interface + fixtures only until partner named |
| `authorized-crawl-placeholder` | Partner site crawl | `authorized_crawl` | `pending` | per agreement | **Do not implement extractor** until written authorization for that exact domain exists |

### 6.3 Gate rule

The source manager **must prevent jobs** when `permission_status` is missing, `pending`, `expired` or `suspended`. Expired permission prevents **new publication**.

Exception for `legacy-barcelona-explorer-60`: one-shot / idempotent **snapshot import** is allowed while `restricted`, provided UI and provenance mark `legacy_snapshot` and no media download from portal URLs is performed.

---

## 7. Legacy inventory dependency

| Item | Value |
|------|--------|
| Expected file | `data/legacy/barcelona_property_explorer_legacy_60.json` |
| Repository status | **Present** (60 records) |
| Reference app | `legacy/` (frozen; do not modify) |
| Assessment | [`LEGACY_CODE_ASSESSMENT.md`](LEGACY_CODE_ASSESSMENT.md) |
| Treatment | Demo/snapshot only until freshness and media rights are verified (D-019) |
| Engineering action | Phase 2 importer per [`DATABASE_DESIGN.md`](DATABASE_DESIGN.md) §13; preserve source URLs; no invented images; no portal scrape |
| Product action | Assign rights/freshness review owner |

---

## 8. `.env.example` outline (no secrets)

To be created as a real file in Phase 1 scaffolding. Documented variable groups:

```bash
# App
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_LOCALE=en

# Database (Supabase / Postgres)
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Auth / OTP
OTP_PROVIDER=fake
# EMAIL_PROVIDER=fake|resend|...
# SMS_PROVIDER=fake|twilio|...
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_FROM_NUMBER=
# RESEND_API_KEY=

# Storage
STORAGE_PROVIDER=local
# S3_ENDPOINT=
# S3_BUCKET=
# S3_ACCESS_KEY=
# S3_SECRET_KEY=

# Maps
NEXT_PUBLIC_MAP_STYLE_URL=
GEOCODER_PROVIDER=fake
# GEOCODER_API_KEY=

# AI
AI_PROVIDER=fake
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
AI_DAILY_TOKEN_BUDGET=

# Jobs
JOBS_PROVIDER=inline
# INNGEST_EVENT_KEY=
# TRIGGER_SECRET_KEY=

# Observability
SENTRY_DSN=
OTEL_EXPORTER_OTLP_ENDPOINT=
LOG_LEVEL=info

# WhatsApp (Phase 7 — leave unset)
# WHATSAPP_PROVIDER=
# WHATSAPP_VERIFY_TOKEN=
# WHATSAPP_ACCESS_TOKEN=
# WHATSAPP_APP_SECRET=

# Telephony / voice (Phase 8 — leave unset)
# TELEPHONY_PROVIDER=
# STT_PROVIDER=
# TTS_PROVIDER=

# Feature flags
FEATURE_WHATSAPP=false
FEATURE_WEB_VOICE=false
FEATURE_PHONE_VOICE=false
FEATURE_CALL_RECORDING=false
```

---

## 9. Webhook endpoints (provider-facing)

```text
POST /webhooks/auth/{provider}
POST /webhooks/email/{provider}
POST /webhooks/sms/{provider}
POST /webhooks/whatsapp/{provider}
POST /webhooks/telephony/{provider}
POST /webhooks/feeds/{partnerId}
```

Requirements: signature verification, replay rejection, idempotency, minimal raw payload retention.

---

## 10. Cost and abuse monitoring (provider-related)

Track and alert on:

- SMS OTP volume and cost (pumping)
- Email bounce/complaint rates
- LLM token spend vs budget
- Map/geocode QPS and spend
- WhatsApp conversation/template costs (Phase 7)
- Telephony minutes (Phase 8)
- Feed fetch rate-limit responses

---

## 11. Setup guides (placeholders)

Create under `docs/operations/` during Phase 1+:

- `setup-supabase.md`
- `setup-email-adapter.md`
- `setup-sms-adapter.md`
- `setup-maps.md`
- `setup-llm.md`
- `setup-whatsapp.md` (Phase 7)
- `setup-telephony.md` (Phase 8)

Each guide must list credentials, sandbox vs prod, rotation steps and how to run with the fake adapter.
