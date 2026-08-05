# Spain Property Buyer Portal — Decisions Required

Version: 1.0  
Status: Phase 0 deliverable  
Format: ADR-style locked defaults + open decisions  
Authoritative product intent: [`spain_property_portal_build_plan_and_master_prompt_v2.md`](spain_property_portal_build_plan_and_master_prompt_v2.md)

When implementation choices conflict with the product spec, record the decision here and preserve user-facing intent.

---

## 1. How to use this document

- **Locked defaults** may be used without re-asking unless an irreversible legal/business conflict appears.
- **Open decisions** block only the phase noted; engineering may build adapters/fakes meanwhile.
- **Irreversible / legal stops** require an explicit human decision before proceeding.

---

## 2. Locked defaults (reversible engineering)

### ADR-001 — Monorepo tooling

- **Date:** 2026-08-05  
- **Decision:** pnpm workspaces + Turborepo  
- **Why:** Spec recommendation; single CI graph for apps/packages  
- **Status:** Locked for Phase 1  

### ADR-002 — Web stack

- **Date:** 2026-08-05  
- **Decision:** Next.js App Router, React, TypeScript, Tailwind, accessible component library, Zod, React Hook Form for complex forms  
- **Status:** Locked  

### ADR-003 — Database and ORM

- **Date:** 2026-08-05  
- **Decision:** PostgreSQL + PostGIS via Supabase; **Drizzle ORM only** (no Prisma)  
- **Why:** Spec preference; greenfield repo has no Prisma foundation  
- **Status:** Locked  

### ADR-004 — Auth

- **Date:** 2026-08-05  
- **Decision:** Supabase Auth with email OTP and mobile SMS OTP; guest merge after verification  
- **Status:** Locked for MVP; WhatsApp auth explicitly out  

### ADR-005 — AI service language

- **Date:** 2026-08-05  
- **Decision:** TypeScript AI service with OpenAPI contracts (not Python FastAPI for v1)  
- **Why:** Monorepo cohesion with shared Zod/tool types  
- **Status:** Locked; revisit only if team skill constraint appears  

### ADR-006 — Search MVP

- **Date:** 2026-08-05  
- **Decision:** PostgreSQL FTS + unaccent + pg_trgm + PostGIS; Typesense/OpenSearch only when measured need exists  
- **Status:** Locked  

### ADR-007 — Retrieval store

- **Date:** 2026-08-05  
- **Decision:** PostgreSQL + pgvector for approved knowledge chunks  
- **Status:** Locked for MVP  

### ADR-008 — Maps

- **Date:** 2026-08-05  
- **Decision:** MapLibre GL JS; licensed tile/geocoding vendors selected later  
- **Status:** Client locked; vendor open (D-005)  

### ADR-009 — API hosting

- **Date:** 2026-08-05  
- **Decision:** Prefer Next.js route handlers for domain API initially; keep `apps/api` package path available if extraction needed  
- **Status:** Locked as default direction  

### ADR-010 — Legacy data handling while file missing

- **Date:** 2026-08-05  
- **Decision:** Implement importer + synthetic CI fixtures matching expected shape; mark real 60-record import **blocked** until `data/legacy/barcelona_property_explorer_legacy_60.json` is supplied; never invent images  
- **Status:** Locked  
- **Tracking:** See §4  

### ADR-011 — Job framework shortlist

- **Date:** 2026-08-05  
- **Decision:** Use exactly one of Inngest, Trigger.dev, or pg-boss; final pick in Phase 1 scaffolding (D-002)  
- **Status:** Constrained choice  

### ADR-012 — Documentation set naming

- **Date:** 2026-08-05  
- **Decision:** Deliver user-requested docs (`IMPLEMENTATION_PLAN`, `ARCHITECTURE`, `DATABASE_DESIGN`, `SECURITY_AND_PRIVACY`, `EXTERNAL_SERVICES`, `DECISIONS_REQUIRED`). Threat model lives in `SECURITY_AND_PRIVACY.md`. Data-source register template lives in `EXTERNAL_SERVICES.md`. Spec aliases `DECISIONS.md` / `THREAT_MODEL.md` / `DATA_SOURCE_REGISTER.md` are satisfied by these locations.  
- **Status:** Locked  

### ADR-013 — Channel activation policy

- **Date:** 2026-08-05  
- **Decision:** MVP = website text chat + email alerts path; WhatsApp Phase 7; browser voice Phase 8a; telephone Phase 8b; schema/adapters earlier  
- **Status:** Locked (matches product decisions already made)  

---

## 3. Open decisions (need human input)

| ID | Decision | Options / notes | Blocks | Owner needed |
|----|----------|-----------------|--------|--------------|
| D-001 | Cloud region / EU personal-data residency | Prefer EU Supabase/Vercel regions; confirm DPAs | Production deploy of personal data | Legal + ops |
| D-002 | Exact job framework | Inngest vs Trigger.dev vs pg-boss | Phase 1 worker wiring (fakes OK before pick) | Engineering lead |
| D-003 | Transactional email vendor | Resend / SendGrid / Postmark / other | Live email OTP/alerts | Engineering + cost |
| D-004 | SMS OTP vendor | Twilio / MessageBird / Vonage / other | Live mobile OTP | Engineering + cost/abuse |
| D-005 | Map tile + geocoding vendor and licence | Mapbox / MapTiler / Google / other — must record attribution | Production map/enrichment | Engineering + legal |
| D-006 | LLM provider and model tiers | OpenAI / Anthropic / Azure / other; separate cheap vs quality tiers | Live AI chat quality | Product + engineering |
| D-007 | Provider training / data-use policy for prompts | Zero retention vs contractual defaults; disclose in privacy notice | Production AI | Legal |
| D-008 | Production hosting | Vercel + Supabase vs alternatives | Prod MVP | Ops |
| D-009 | First live inventory partner | Named agency/developer/API; contract + media rights | Phase 4 live import acceptance | Business development + legal |
| D-010 | Malware scanning approach | ClamAV self-host vs cloud scanner | Hardening media pipeline for prod | Security |
| D-011 | Analytics vendor | Privacy-friendly analytics vs none | Cookie banner content | Product + legal |
| D-012 | WhatsApp BSP | Meta Cloud API vs Twilio/etc. | Phase 7 | Business + engineering |
| D-013 | STT/TTS and telephony vendors | Browser-only first; then cloud/telephony | Phase 8 | Engineering |
| D-014 | Exact GDPR retention durations | Configure per data class | Final privacy policy + jobs | Legal |
| D-015 | Whether professional partners (lawyers, mortgage advisers) are in commercial scope | Spec allows “subject to future commercial policy” | Partner portal roles beyond agencies/developers | Business |
| D-016 | Supply of legacy 60 JSON (+ optional modular pack / preview) | Path into `data/legacy/` | Real legacy import | Product/data owner |
| D-017 | Brand, domain name, production URL | Affects SEO, WhatsApp, email from-domains | Soft launch | Business |
| D-018 | Support/human-agent staffing model | Internal desk vs partner-only | Handoff SLAs | Operations |

---

## 4. Legacy data tracking (ADR-010 operational status)

| Field | Value |
|-------|--------|
| Expected path | `data/legacy/barcelona_property_explorer_legacy_60.json` |
| Present in repo | **No** |
| Permission status in register | `restricted` / snapshot-demo |
| Importer | To be built in Phase 2/4; CI uses `data/fixtures/` |
| Images | Do not invent; no rights assumed |
| Unblock criteria | File supplied + rights/freshness review owner assigned + records remain labelled until verified |

---

## 5. Irreversible / hard-stop conditions

Stop implementation of the affected slice and escalate when:

1. **Missing permission** to use a property data source or images for republication  
2. **Missing credentials** truly required to test an external *production* provider (continue with fakes otherwise)  
3. **Legal/business choice** that cannot be reversed cheaply (e.g. non-EU hosting of EU personal data without DPA; enabling call recording without consent policy; WhatsApp marketing without opt-in model)  
4. Pressure to implement **unauthorized scraping**, CAPTCHA bypass, access-control evasion or unlicensed image copying — refuse and record here  

---

## 6. Assumptions (explicit, not silently accepted as facts)

| ID | Assumption | Reality check |
|----|------------|---------------|
| A-001 | No partner feed is approved yet | Confirmed empty register |
| A-002 | Legacy 60 will arrive before Phase 4 acceptance | May slip; fixtures keep CI green; MVP live-import may use manual/CSV partner instead |
| A-003 | Catalonia is first commercial focus | Data model still Spain-wide |
| A-004 | Alcaraz is not in Catalonia | Enforced in seeds/tests |
| A-005 | AI guidance is educational only | Disclaimers + escalation mandatory |
| A-006 | Calculators are estimates | Versioned rules + warnings |
| A-007 | `robots.txt` ≠ republication licence | Source permission required |
| A-008 | Supabase + Drizzle + TS AI is acceptable to stakeholders | Escalate if rejected (reopen ADR-003/005) |

---

## 7. Spec contradictions / reconciliations

| Tension | Resolution |
|---------|------------|
| Master prompt asks for `DECISIONS.md`, `THREAT_MODEL.md`, `DATA_SOURCE_REGISTER.md` vs user-requested filenames | ADR-012: content delivered under user filenames with sections covering threat model and register |
| “Don’t repeatedly ask” vs “don’t silently remove requirements” | Lock reversible ADRs; keep full requirement surface; hard-stop only on §5 |
| MVP needs live import + no partner yet | Phase 4 builds CSV/manual + fixtures; live partner adapter gated on D-009; acceptance allows documented register block only as interim with explicit owner — MVP gate still requires one permitted live path before commercial MVP sign-off |
| Modular pack preferred vs merged v2 only in repo | Treat merged v2 as authoritative; optional split into `docs/product/` etc. later without changing intent |

---

## 8. Decision log (append-only)

| Date | ID | Change |
|------|-----|--------|
| 2026-08-05 | ADR-001…013 | Initial locked defaults from Phase 0 planning |
| 2026-08-05 | D-001…018 | Open decisions catalogued |
| 2026-08-05 | A-001…008 | Assumptions recorded |
| 2026-08-05 | Legacy | File confirmed missing; ADR-010 applied |

---

## 9. Phase 1 gate

Phase 1 scaffolding may begin only after **explicit approval**. Before Phase 1 starts, preferably resolve:

- D-002 (job framework) — or temporarily use `inline` fake per `.env.example` outline  
- Confirm ADR-003/005 stack acceptance  

D-001, D-009, D-016 and vendor keys are **not** required to begin local foundation work with fakes.
