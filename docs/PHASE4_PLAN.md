# Phase 4 plan — Buyer workspace, shortlists and property comparison

Date: 2026-08-06  
Status: **Planning complete — not implemented**  
Branch baseline: `cursor/phase2-legacy-inventory-buyer-journey` @ Phase 3.1 (`eea69ea`)  
Companions:

- [`BUYER_WORKSPACE_DESIGN.md`](BUYER_WORKSPACE_DESIGN.md)
- [`PROPERTY_COMPARISON_MODEL.md`](PROPERTY_COMPARISON_MODEL.md)
- [`SAVED_SEARCH_AND_ALERT_MODEL.md`](SAVED_SEARCH_AND_ALERT_MODEL.md)
- [`PHASE4_DATABASE_CHANGES.md`](PHASE4_DATABASE_CHANGES.md)
- [`PHASE4_SECURITY_REVIEW.md`](PHASE4_SECURITY_REVIEW.md)
- [`PHASE4_ACCEPTANCE_CRITERIA.md`](PHASE4_ACCEPTANCE_CRITERIA.md)
- [`PHASE4_DECISIONS_REQUIRED.md`](PHASE4_DECISIONS_REQUIRED.md)

## Objective

Create a persistent buyer workspace so guests and authenticated buyers can organize, compare and monitor properties—without AI chat, WhatsApp, voice, production email/SMS, JSON/XML ingestion, scraping, map enrichment, legal advice or mortgages.

**Authoritative phase number:** ADR-022 — Phase 4 = buyer workspace remainder (favourites already in Phase 2).

## Non-goals

- AI chat, WhatsApp, voice
- Production email, SMS or WhatsApp alert delivery
- Leads / viewing requests (deferred — see [`PHASE4_DECISIONS_REQUIRED.md`](PHASE4_DECISIONS_REQUIRED.md))
- Full privacy export/delete workers (deferred; schema stub exists)
- Shortlist collaborator invites (Phase 6 foundations)
- JSON/XML partner adapters; unauthorized crawling; map enrichment
- Inventing missing listing facts (energy, school/hospital proximity, expenses)

## Foundations to reuse

| Area | Reuse |
| ---- | ----- |
| Favourites | `favourites` table, `/api/v1/favourites`, owner RLS |
| Guest merge domain | `mergeGuestWorkspace` in `@spain/domain` — extend + persist |
| Guest sessions | `guest_sessions.payload` shape — extend for shortlists/weights |
| Search | `PropertySearchCriteria` + `@spain/search` URL helpers |
| Listing facts | `ListingCardDto` / `ListingDetailDto` / `property_listings` |
| Auth | ADR-029 sessions, CSRF Origin, `withAuthenticatedDb` |
| Legacy UX | `legacy/.../ComparisonTable.tsx` (read-only inspiration) |

## Locked product decisions

1. **Favourites stay** as Phase 2 heart bookmarks; **named shortlists** are separate. One shortlist may be `is_default` per user. Favourites do **not** auto-sync into shortlists (optional sync is a deferred decision).
2. Missing comparison fields render as **unavailable**, never invented.
3. Suitability score is **explainable preference fit**, never a valuation or investment recommendation.
4. Alerts in Phase 4 = **in-app notification centre** + **TestNotificationProvider** only; evaluation via **inline** hooks (ADR-027).
5. Share links expose only deliberately selected listing facts + optional public title—not identity, notes or history.
6. Frontend never talks to Postgres directly; typed services behind `/api/v1/me/*` and public share GET.

---

## Feature 1 — Multiple named shortlists

### Database

- `shortlists` (user_id, name, is_default, timestamps)
- `shortlist_items` (shortlist_id, listing_id, position, timestamps)
- Constraints: unique `(user_id, name)`; at most one `is_default` per user; unique `(shortlist_id, listing_id)`
- Cap: max shortlists per user and max items per shortlist (defaults in `PHASE4_DATABASE_CHANGES.md`)

### Domain rules

- Create / rename / delete shortlist (soft-delete optional; hard-delete cascades items + shortlist note)
- Add / remove property; reorder by `position`
- Setting `is_default=true` clears prior default in same transaction
- Deleting default promotes oldest remaining shortlist or leaves none
- Listing must exist; withdrawn listings may remain on shortlist with status badge

### API

- `createShortlist`, `updateShortlist`, `deleteShortlist`
- `addPropertyToShortlist`, `removePropertyFromShortlist`
- Routes: `GET/POST /api/v1/me/shortlists`, `PATCH/DELETE /api/v1/me/shortlists/{id}`, `POST/DELETE /api/v1/me/shortlists/{id}/items`

### UI

- `/{locale}/workspace` hub
- `/{locale}/workspace/shortlists`, `/{locale}/workspace/shortlists/[id]`
- Detail/search actions: “Add to shortlist” picker
- Keep `/{locale}/favourites` for Phase 2 hearts

### RLS / auth

- Owner-only via `user_id = auth.uid()` / JWT sub; agencies cannot read
- Session + CSRF on mutations

### Guest / authenticated

- Guest: shortlists in localStorage (bounded); no server write until auth
- Authenticated: DB persistence; merge guest shortlists on sign-in

### Tests / acceptance

- CRUD + default uniqueness; cross-user 403/empty; guest merge dedupe by name+listing
- AC: user can maintain several purpose-named shortlists and choose a default

---

## Feature 2 — Buyer notes

### Database

- `property_notes` — unique `(user_id, listing_id)`; `body`, `positives` jsonb[], `negatives` jsonb[], `updated_at`
- `shortlist_notes` — `shortlist_id` PK/FK, `body`, `updated_at`

### Domain rules

- Private; owner-only; last-edited timestamp always updated on write
- Pros/cons optional string arrays (length-capped)
- Never included in comparison share payloads

### API

- `addPropertyNote` (upsert), get/delete property note
- Shortlist note via `updateShortlist` note field or dedicated endpoints
- Routes: `GET/PUT/DELETE /api/v1/me/notes/properties/{listingId}`, `PUT /api/v1/me/shortlists/{id}/note`

### UI

- Property detail + shortlist detail note panels; show `updated_at`

### RLS / guest / auth

- Owner RLS; guests may keep ephemeral notes in localStorage (merge on auth if present)
- Authenticated only for server persistence of notes (recommended default)

### Tests / acceptance

- Isolation; upsert; share link excludes notes; timestamps advance

---

## Feature 3 — Structured comparison

### Database

- `comparison_sets` / `comparison_items` for persisted selections (share + weights snapshot)
- Comparison **matrix** assembled at read time from listing columns (see [`PROPERTY_COMPARISON_MODEL.md`](PROPERTY_COMPARISON_MODEL.md))

### Domain rules

- Select properties from a shortlist (cap 2–6; default max 5)
- Columns: asking price, €/m², beds, baths, built/usable area, type, condition, energy, location, environment, transport, commute, beach/park/school/hospital proximity, freshness, source, off-plan, recurring expenses, buyer notes (owner only, not on public share)
- Unavailable → explicit `unavailable` sentinel; never fabricate

### API

- `getComparison({ listingIds | shortlistId+selectedIds, includeNotes? })`
- Route: `POST /api/v1/me/comparisons/preview` (auth) and reuse for share creation input

### UI

- `/{locale}/workspace/compare` — matrix table; RTL-safe; sticky first column

### Tests / acceptance

- Missing fields show unavailable; notes only for owner session; locale labels

---

## Feature 4 — Weighted buyer priorities

### Database

- `user_preference_profiles` — weights jsonb, `is_active`, name
- Optional weight snapshot on `comparison_sets`

### Domain rules

- Criteria weights: price, location, commute, quiet, coastal, outdoor, size, condition, energy, accessibility, investment_potential
- `scoreListingAgainstWeights(facts, weights)` → score 0–100, `factors[]`, `missing[]`
- Only available facts affect score; missing criteria listed separately
- Mandatory disclaimer copy (i18n)

### API

- `updateComparisonWeights` / profile CRUD under `/api/v1/me/preference-profiles`
- Comparison response includes per-listing score explanation when weights provided

### UI

- Weight sliders on compare page; explanation drawer per listing

### Tests / acceptance

- Scoring unit tests with full and sparse facts; disclaimer present; user can change weights and rescore

---

## Feature 5 — Saved searches

### Database

- `saved_searches` — criteria jsonb (`PropertySearchCriteria`), sort, name, `last_run_at`, optional `criteria_hash` unique per user

### Domain rules

- Persist geographic, price, beds, baths, size, type, environment, status, off-plan, free-text, sort
- Dedupe on merge by `criteria_hash`
- Authenticated CRUD; guest localStorage only

### API

- `saveSearch`, `listSavedSearches`, update, delete
- Routes: `GET/POST /api/v1/me/saved-searches`, `PATCH/DELETE /api/v1/me/saved-searches/{id}`

### UI

- “Save search” on search page; `/{locale}/workspace/searches` list → reopen via URL params

### Tests / acceptance

- Round-trip criteria; guest merge; cross-user isolation

---

## Feature 6 — Browsing history

### Database

- `recently_viewed` — user_id, listing_id, viewed_at, channel (`web` | `share` | `alert` | …)
- Retention index; purge job or on-read prune (default **90 days**, env-configurable)

### Domain rules

- `recordPropertyView`, `listRecentlyViewed`, clear one, clear all
- **Never** exposed to agency/partner APIs or roles
- Cap list length (e.g. 50) mirroring domain merge

### API

- `recordPropertyView`, `listRecentlyViewed`, `clearBrowsingHistory`
- Routes: `POST /api/v1/me/history/views`, `GET /api/v1/me/history`, `DELETE /api/v1/me/history`, `DELETE /api/v1/me/history/{listingId}`

### UI

- Auto-record on property detail (auth + guest local)
- `/{locale}/workspace/history` with clear controls + privacy copy

### Privacy

- Preference to disable recording (user profile / local flag)
- Account deletion cascades history

### Tests / acceptance

- Agency session cannot read buyer history; retention prune; guest merge

---

## Feature 7 — Alerts foundation

### Database

- `alert_subscriptions` — saved_search_id, event_types[], enabled, consented_at
- `in_app_notifications` — user_id, type, payload, read_at

### Domain rules

- Event types: `new_match`, `price_reduction`, `status_change`, `listing_withdrawn`, `stale_listing`
- Inline evaluation after listing mutations (publish/price/status/withdraw) and optional stale sweep helper
- Deliver via `TestNotificationProvider` + insert `in_app_notifications`
- No production email/SMS/WhatsApp in Phase 4

### API

- `listNotifications`, mark read; subscribe/unsubscribe on saved search
- Internal: `evaluateAlertsForListing`
- Routes: `GET/PATCH /api/v1/me/notifications`, `POST/DELETE /api/v1/me/saved-searches/{id}/alerts`

### UI

- `/{locale}/workspace/notifications` + nav badge

### Tests / acceptance

- Price drop creates in-app notification for matching subscriber; test provider invoked; no email send in prod config

---

## Feature 8 — Shareable comparisons

### Database

- `comparison_shares` — created_by, comparison_set_id or listing_ids, `token_hash`, expires_at, revoked_at, public_title

### Domain rules

- Unguessable token (32+ bytes); store SHA-256 hash only
- Expiry default 7–30 days; revoke sets `revoked_at`
- Public payload: title + listing comparison facts **without** notes, history, identity, weights private notes

### API

- `createComparisonShare`, `revokeComparisonShare`
- `GET /api/v1/compare/shared/{token}` — public, rate-limited
- Owner routes under `/api/v1/me/comparison-shares`

### UI

- Share button on compare → copy link; `/{locale}/compare/shared/[token]`

### Tests / acceptance

- Guessable ID rejected; expired/revoked 404; notes absent; rate limit

---

## Feature 9 — Guest-to-account merge

### Database / domain

- Extend `guest_sessions.payload` + transactional `mergeGuestWorkspaceIntoUser`
- Merge: favourites, shortlists/items, saved searches, recent views, preference weights, comparison selection ids
- Idempotent; set `merged_into_user_id` / `merged_at`
- Fix Phase 2 non-transactional favourites loop

### API

- Trigger on OTP verify + optional explicit `POST /api/v1/me/workspace/merge`
- Prefer HttpOnly guest cookie / server guest session (see decisions)

### Tests / acceptance

- Partial failure rolls back; duplicate listings once; shortlist name collisions rename (`Guest — …`)

---

## Feature 10 — Security and privacy

See [`PHASE4_SECURITY_REVIEW.md`](PHASE4_SECURITY_REVIEW.md).

Highlights: owner RLS; share-token security; rate limits; history retention; account deletion cascade; alert consent; audit share create/revoke; cross-user isolation tests; agencies cannot see buyer private data.

---

## Feature 11 — API and service boundaries

Frontend → Next.js route handlers only. Typed services (names required):

| Service | Package |
| ------- | ------- |
| `createShortlist` / `updateShortlist` / `deleteShortlist` | `@spain/database` |
| `addPropertyToShortlist` / `removePropertyFromShortlist` | `@spain/database` |
| `addPropertyNote` | `@spain/database` |
| `getComparison` | `@spain/database` + `@spain/domain` |
| `updateComparisonWeights` | `@spain/database` |
| `saveSearch` / `listSavedSearches` | `@spain/database` |
| `recordPropertyView` / `listRecentlyViewed` / `clearBrowsingHistory` | `@spain/database` |
| `listNotifications` | `@spain/database` |
| `createComparisonShare` / `revokeComparisonShare` | `@spain/database` |
| `scoreListingAgainstWeights` | `@spain/domain` |
| `mergeGuestWorkspaceIntoUser` | `@spain/database` (uses domain merge) |
| `evaluateAlertsForListing` | `@spain/database` / communications test provider |

All authenticated paths use `getSession` + `withAuthenticatedDb` + CSRF on mutations.

---

## Feature 12 — Tests

| Layer | Coverage |
| ----- | -------- |
| Unit | Scoring (full + missing), merge, token hash, criteria hash, caps |
| DB integration | CRUD + RLS cross-user; agency role denial on buyer tables |
| Guest merge | Transactional idempotent merge suite |
| Share-token | Create/fetch/expire/revoke/rate-limit |
| Locale / RTL | ar direction on workspace + compare |
| Playwright | Buyer journey: shortlist → note → compare → weights → save search → history → notification (test) → share → logout |
| A11y | Compare table + workspace nav |

Gates: `pnpm format:check`, `lint`, `typecheck`, `test`, `test:db`, applicable Playwright.

---

## Implementation order (when approved)

1. Migrations + RLS + seed buyer user  
2. Shortlists + notes services/APIs/UI  
3. Comparison matrix + weights  
4. Saved searches + history  
5. Alerts foundation + notifications UI  
6. Share links  
7. Transactional guest merge + guest session hardening  
8. Full test suite + docs `PHASE4_IMPLEMENTATION.md`

**Do not implement until this plan is explicitly approved.**

## Related roadmap updates

ADR-030 records Phase 4 scope lock (in-app alerts only; leads/privacy deferred). Slice 4 in [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) split into Phase 4 (this plan) and Phase 4.1+ backlog.
