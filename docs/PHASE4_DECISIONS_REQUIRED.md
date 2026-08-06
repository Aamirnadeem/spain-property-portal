# Phase 4 decisions required

Date: 2026-08-06  
Status: Open questions before or during implementation  
Parent: [`PHASE4_PLAN.md`](PHASE4_PLAN.md)

Resolved planning locks are in ADR-030 ([`DECISIONS.md`](DECISIONS.md)). This file lists remaining product/engineering choices.

## Already locked (do not re-open without ADR)

| Topic                 | Lock                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Phase number          | Phase 4 = buyer workspace remainder (ADR-022)                                                |
| Favourites            | Keep Phase 2 table; shortlists are separate; no auto-sync hearts → shortlists                |
| Alerts channels       | In-app + TestNotificationProvider only; no prod email/SMS/WhatsApp                           |
| Jobs                  | Inline evaluation (ADR-027); no pg-boss in Phase 4                                           |
| Missing facts         | Show unavailable; no enrichment invention                                                    |
| Score                 | Preference fit with disclaimer; not valuation                                                |
| Deferred from Slice 4 | Leads, viewing requests, privacy export/delete workers, collaborators → Phase 4.1+ / Phase 6 |

## Open decisions

### D1 — Guest session transport

**Options:** (a) Continue client `guestPayload` on OTP verify with stricter bounds; (b) HttpOnly guest cookie + `guest_sessions` server persistence.

**Recommendation:** (b) as Phase 4 implementation goal; (a) acceptable interim if schedule-bound.

**Owner:** Engineering

### D2 — Default shortlist on first login

**Options:** (a) No automatic shortlist; (b) Create “Favourites” or “My list” default empty; (c) Create default and copy existing favourites into it once.

**Recommendation:** (b) empty default named “My shortlist” — keeps favourites independent.

**Owner:** Product

### D3 — Unauthenticated `/workspace` HTML

**Options:** (a) Guest-capable UI with local data + sign-in banner; (b) Redirect to account like partner/admin gates.

**Recommendation:** (a) for buyer UX; APIs remain session-protected.

**Owner:** Product

### D4 — Comparison max items

Locked default **5** in plan. Confirm if product wants 4 or 6.

**Owner:** Product

### D5 — History retention days

**Locked in ADR-030b / [`PHASE4B_DECISIONS_REQUIRED.md`](PHASE4B_DECISIONS_REQUIRED.md):** 90 days (`BUYER_HISTORY_RETENTION_DAYS`); guest local same **50**-item cap.

**Owner:** Product / Privacy — **locked**.

### D6 — Public share includes frozen scores?

Plan default: **no** scores on public share unless user opts in at creation. (**Phase 4C**)

**Owner:** Product

### D7 — Promote new default when default shortlist deleted

Plan default: **do not** auto-promote. Confirm.

**Owner:** Product — **locked in 4A**

### D8 — Extend `PropertySearchCriteria` for status / off-plan

**Locked in ADR-030b:** versioned `phase4b.v1` envelope including bathrooms, property type, listing statuses, off-plan, freshness, structured geo — see [`SAVED_SEARCH_CRITERIA_SPEC.md`](SAVED_SEARCH_CRITERIA_SPEC.md).

**Owner:** Engineering — **locked**.

### D9 — Phase 4.1 backlog naming

Confirm label for deferred Slice 4 remainder (leads, privacy workflows, email digests): **Phase 4.1** vs fold into Phase 6.

**Recommendation:** Phase 4.1 for leads + privacy workers; email digests when notification channels expand; collaborators stay Phase 6.

**Owner:** Product

### D10 — `investment_potential` weight

Plan: always missing unless future personal score. Confirm weight remains in UI as “coming soon” vs hidden.

**Recommendation:** Show in UI but disable / explain data not available.

**Owner:** Product

## Implementation blockers (external)

| Blocker                                | Impact                                                |
| -------------------------------------- | ----------------------------------------------------- |
| None for local FakeAuth + PostGIS      | Phase 4 can proceed without live Supabase credentials |
| Live email                             | Not needed (test provider only)                       |
| Energy / school / hospital source data | Fields stay unavailable until real ingestion exists   |

## Sign-off

Phase 4 **implementation** must not start until:

1. This plan set is reviewed
2. Critical opens D2, D3, D6 acknowledged (defaults OK if silent approval)
3. Explicit user approval to implement
