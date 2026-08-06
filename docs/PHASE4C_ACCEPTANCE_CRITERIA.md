# Phase 4C acceptance criteria — Comparison shares

Date: 2026-08-06  
Status: Phase 4C planning (gates for future implementation)  
Parent: [`PHASE4C_PLAN.md`](PHASE4C_PLAN.md)

## Product

- [ ] Authenticated buyer can create a share from the compare workspace with 2–5 selected properties
- [ ] Default expiry is **7 days**; presets 24h / 7d / 30d / custom date work
- [ ] Custom expiry cannot exceed **90 days** from creation; permanent links unavailable
- [ ] Optional public title and description length-capped and stored
- [ ] Score and weight inclusion default **off**; when on, frozen snapshot is used on public page
- [ ] Owner receives plaintext token / public URL **once** at create (and once at replace)
- [ ] Owner can list active, expired, and revoked shares with property count and dates
- [ ] Owner can revoke a share; subsequent public opens show generic unavailable
- [ ] Owner can replace a share; old token invalid; new token issued; `replaced_by_share_id` linked
- [ ] Public page route is `/{locale}/shared-comparison/{token}` with en/es/ca/ar and Arabic RTL
- [ ] Public page is read-only, no workspace chrome, `noindex`, restrictive cache/referrer headers
- [ ] Listing change warnings appear without substituting another listing
- [ ] Source attribution visible on public comparison

## Privacy / security

- [ ] Private notes (all kinds) never appear on public page or public API
- [ ] Buyer identity / contact never appear
- [ ] History, saved searches, notifications never appear
- [ ] Exact / hidden address never appear; location uses approved precision only
- [ ] Unauthorized images never served
- [ ] Token stored as SHA-256 hash only; plaintext not in DB
- [ ] Invalid / expired / revoked responses are identical (generic unavailable)
- [ ] Full tokens never logged
- [ ] Public resolve rate-limited (60/min/IP); create rate-limited (10/min/user)
- [ ] Anon role cannot SELECT share tables via RLS
- [ ] Agency users cannot list or manage another buyer’s shares
- [ ] Owner mutations require verified session + CSRF

## Data / API

- [ ] `POST/GET /api/v1/me/comparison-shares` and revoke/replace endpoints behave as planned
- [ ] `GET /api/v1/compare/shared/{token}` returns PublicComparisonDto or generic unavailable
- [ ] Share items are explicit; changing shortlist after create does not expand the share
- [ ] Manifest schema version `phase4c.v1` persisted
- [ ] Access aggregates update on successful resolve; optional event rows privacy-minimal

## Tests

### Unit

- [ ] Token generation entropy / encoding
- [ ] Hash storage / round-trip resolve
- [ ] Allowlist exclusions (notes, identity, history keys absent)
- [ ] Expiry, revoke, replace state machine
- [ ] Listing warning mapping (withdrawn, stale, merge — no substitution)

### Integration / RLS

- [ ] Owner isolation across users
- [ ] Agency deny on share tables
- [ ] Anon cannot SELECT `comparison_shares` / items / access events
- [ ] Service-role resolve path returns DTO only after valid token

### Playwright (required journey)

1. Authenticated buyer opens comparison
2. Selects two properties
3. Creates a 7-day share link
4. Copies the link
5. Anonymous browser context opens the link
6. Sees only approved public information
7. Does **not** see private notes or buyer identity
8. Owner revokes the share
9. Anonymous reload shows generic unavailable

## Docs / status

- [ ] Implementation updates `IMPLEMENTATION_STATUS.md` when code ships
- [ ] RLS catalogue updated when migrations land
- [ ] This checklist marked complete only after green CI gates

## Current phase status

**Planning complete. Implementation not started.** No acceptance item above is claimed done until Phase 4C code ships.
