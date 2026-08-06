# Phase 4 acceptance criteria

Date: 2026-08-06  
Status: Planning — criteria for implementation approval  
Parent: [`PHASE4_PLAN.md`](PHASE4_PLAN.md)

## Gate commands (must pass before Phase 4 done)

- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm test:db`
- [ ] Playwright buyer-workspace journey (shortlists → compare → save search → history → notifications → share)
- [ ] Playwright locale + Arabic RTL smoke for workspace/compare
- [ ] Accessibility checks on compare matrix and workspace nav

## Functional

### Shortlists

- [ ] Create, rename, delete named shortlists
- [ ] Add/remove properties; maintain multiple purpose lists
- [ ] Choose exactly one default shortlist
- [ ] Caps enforced (too many lists/items → clear error)

### Notes

- [ ] Private property notes with optional pros/cons and `updated_at`
- [ ] Shortlist-level general note
- [ ] Notes never appear on public share payload

### Comparison

- [ ] Select 2–5 properties from a shortlist and view matrix
- [ ] All listed fields present; missing source data → **unavailable** (not invented)
- [ ] Buyer notes visible only to owner session

### Weights / score

- [ ] User can set weights and see score + factor explanation + missing inputs
- [ ] Changing weights updates scores
- [ ] Disclaimer visible (not valuation / not investment guarantee)
- [ ] `investment_potential` not auto-inferred from price alone

### Saved searches

- [ ] Authenticated user saves current criteria including geo, price, beds/baths, size, type, environment, status, off-plan, free-text, sort
- [ ] Re-open search from workspace
- [ ] Guest local save merges after authentication without duplicates

### Browsing history

- [ ] Recently viewed with timestamp and channel
- [ ] Clear one / clear all
- [ ] Privacy opt-out stops recording
- [ ] Retention prune works
- [ ] Agency roles cannot read buyer history

### Alerts foundation

- [ ] Subscribe to saved-search events with consent
- [ ] Price reduction / status / withdraw / new match / stale create **in-app** notifications
- [ ] `TestNotificationProvider` used in test/local
- [ ] No production email/SMS/WhatsApp send for these events

### Shareable comparisons

- [ ] Create link with unguessable token; optional title
- [ ] Expiry and revoke work
- [ ] Public page shows only selected listing facts (no identity, notes, history)
- [ ] Rate limit behaves under abuse test

### Guest merge

- [ ] Transactional merge of favourites, shortlists/items, saved searches, recent views, preference weights
- [ ] Idempotent; duplicates resolved safely
- [ ] Partial failure does not leave torn state

### Security

- [ ] Cross-user isolation tests green
- [ ] Forged `x-user-id` / `x-role` / org headers have no effect
- [ ] Session + CSRF on mutating `/me` routes
- [ ] RLS policies exist and `test:db` covers owner isolation
- [ ] Frontend has no direct DB access

## Documentation

- [ ] `PHASE4_IMPLEMENTATION.md` written after build
- [ ] `AUTHORIZATION_MATRIX.md` / `RLS_IMPLEMENTATION_STATUS.md` updated to **implemented**
- [ ] `IMPLEMENTATION_STATUS.md` marks Phase 4 complete only after gates pass

## Explicitly not required for Phase 4 acceptance

- Leads / viewing requests
- Privacy export/delete workers
- Collaborator invites
- Production email/SMS/WhatsApp alerts
- AI chat, voice, map enrichment
- Energy/school/hospital data invention

## Manual checklist (pre-release)

- [ ] Unauthenticated cannot call `/api/v1/me/*`
- [ ] Viewer/agency cannot read buyer shortlists via API
- [ ] Share revoke immediately blocks access
- [ ] Logout blocks workspace APIs
- [ ] FakeAuth still fail-closed in production config
