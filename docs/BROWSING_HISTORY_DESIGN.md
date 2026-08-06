# Browsing history design

Date: 2026-08-06  
Status: **Implemented** (Phase 4B — ADR-030b)  
Parent: [`PHASE4B_PLAN.md`](PHASE4B_PLAN.md) · [`PHASE4B_IMPLEMENTATION.md`](PHASE4B_IMPLEMENTATION.md) · ADR-030b · Lock D5 / D12

## Purpose

Record property-detail views so buyers can resume recently viewed listings, with privacy controls, retention, and guest→account merge—never exposed to agencies, sources, or public share surfaces.

## Records

Table: `browsing_history` (preferred over thin `recently_viewed` name from earlier Phase 4 drafts).

| Field                  | Required | Notes                                                                                      |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `id`                   | yes      | uuid PK                                                                                    |
| `user_id`              | yes      | FK → users CASCADE; auth-only persistence                                                  |
| `listing_id`           | yes      | FK → listings CASCADE                                                                      |
| `physical_property_id` | no       | Denormalized from listing when available                                                   |
| `first_viewed_at`      | yes      | Set on insert                                                                              |
| `last_viewed_at`       | yes      | Updated on each view                                                                       |
| `view_count`           | yes      | Integer ≥ 1                                                                                |
| `channel`              | yes      | `web` \| `share` \| `alert` \| `search` \| `other` (default `web`)                         |
| `context`              | no       | jsonb: optional `{ savedSearchId?, recommendationId?, query? }` — **no PII**, bounded size |
| timestamps             | yes      | created/updated                                                                            |

Constraint: `UNIQUE (user_id, listing_id)` — repeated views **dedupe** via upsert.

## Domain rules

1. **Record** only when `history_recording_enabled` is true (auth preferences / guest flag).
2. Upsert: `view_count += 1`, `last_viewed_at = now()`, keep earliest `first_viewed_at`, refresh `channel`/`context` from latest view if provided.
3. **List** newest `last_viewed_at` first; return at most **50**.
4. **Clear one** deletes the row; **clear all** deletes all rows for user.
5. **Retention:** delete where `last_viewed_at < now() - BUYER_HISTORY_RETENTION_DAYS` (default **90**). Run via `expireOldHistory` job and opportunistic prune on list. Users may **clear one or clear all at any time** before retention expiry (user-clearable).
6. Guests: no DB rows until merge; store richer entries in guest payload / localStorage (listingId, first/last, count, channel, context), cap **50**.

## Guest → account merge

Inside `mergeGuestWorkspaceIntoUser` transaction:

- For each guest history entry: upsert auth row by `listing_id`.
- `first_viewed_at = min(guest, auth)`, `last_viewed_at = max(...)`, `view_count = guest + auth` (or max if double-count risk documented — **prefer sum** once per listing id in guest payload).
- After merge, truncate to 50 by newest `last_viewed_at`.
- Idempotent retries: `onConflict` upsert + `merged_at` guard.

## Services

`recordPropertyView`, `listRecentlyViewed`, `removeHistoryItem`, `clearBrowsingHistory`, `expireOldHistory`.

## API

| Method | Route                            | Notes                                             |
| ------ | -------------------------------- | ------------------------------------------------- |
| POST   | `/api/v1/me/history/views`       | `{ listingId, channel?, context? }` · rate 30/min |
| GET    | `/api/v1/me/history`             | Cap 50 + prune                                    |
| DELETE | `/api/v1/me/history`             | Clear all                                         |
| DELETE | `/api/v1/me/history/[listingId]` | Clear one                                         |

Session + CSRF on mutations + `withAppAuthenticatedDb`.

## UI

- Auto-record from property detail when enabled.
- `/{locale}/workspace/history` — `HistoryList` with clear one/all, empty/loading/error.
- Privacy control: toggle recording (updates `notification_preferences.history_recording_enabled`).
- Locales: en / es / ca / ar + RTL.

## Authorization / RLS / privacy

- Owner-only RLS (`user_id = jwt.sub`).
- **No** agency / partner / admin / public SELECT.
- Not included in comparison shares (4C) or audit payloads beyond actor id.
- Account deletion CASCADE.
- Export: include in Phase 4.1 privacy export design; 4B documents the obligation only.
- Not used for unauthorized buyer profiling or agency analytics.

## Tests

Retention prune, ownership, clear one/all, opt-out stops recording, merge upsert + cap, agency deny, rate limit, locale/RTL smoke.
