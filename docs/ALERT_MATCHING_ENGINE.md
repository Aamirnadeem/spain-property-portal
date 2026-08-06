# Alert matching engine

Date: 2026-08-06  
Status: Phase 4B planning  
Parent: [`PHASE4B_PLAN.md`](PHASE4B_PLAN.md) · ADR-030b · Lock D13 / D14

## Purpose

Deterministically match saved-search criteria to authorized published listings, distinguish **new** matches from previously known matches, and drive idempotent in-app notifications from listing change events.

## Inventory filter

Evaluate only listings that are:

- Authorized for public browse (`is_public_browseable` / existing browse gate used by `searchProperties`)
- **Not** `legacy_snapshot` — legacy snapshot alerts are **disabled** in production. `ALLOW_LEGACY_ALERTS_IN_TESTS=true` is a test-only override.

## Default alert behaviour (D16 / D17)

| Event                       | Default                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `new_match`                 | Enabled when search alerts are on                                                       |
| `price_reduction`           | **Enabled** by default in `alert_types`                                                 |
| `price_increase`            | Available in UI; **disabled** by default                                                |
| Status / withdrawal / stale | Enabled for listings in user **shortlists** or `saved_search_last_matches` (not hearts) |

## Core functions

| Function                                                     | Role                                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `matchesListing(criteria, listingFacts)`                     | Pure domain; fail closed on missing facts when filter present                           |
| `evaluateSavedSearch(savedSearchId, trigger)`                | Run match set; write evaluation run; update counts; diff last matches; emit `new_match` |
| `generateListingChangeNotifications(listingId, sourceEvent)` | Fan-out price/status events to relevant users/searches/shortlists                       |
| `evaluateAllDueSavedSearches()`                              | Batch enabled searches — **scheduler seam**; test-triggered in 4B                       |

## New match vs changed match

Table `saved_search_last_matches (saved_search_id, listing_id, first_matched_at)`:

1. Compute current match set M.
2. Insert rows in M \ last_matches → candidates for `new_match`.
3. Remove last_matches \ M (listing left the set) — no “left set” notification in 4B unless product adds later.
4. Price/status events use history rows even if listing was already in last_matches → `price_*` / `status_*` types (not another `new_match`).

## Evaluation runs

`saved_search_evaluation_runs`: `trigger` ∈ `manual` \| `test` \| `inline_mutation` \| `scheduled`; `status` ∈ `succeeded` \| `failed`; `match_count`; `error_code`; timestamps.

- **4B production path:** **manual** (user Run) and **test** harness only for full saved-search evaluation.
- `scheduled` is reserved for a future provider-neutral scheduler calling `evaluateAllDueSavedSearches` — **not wired** in 4B.
- `inline_mutation` may record price/status fan-out side effects when listing history rows are written.
- Failures may emit `saved_search_evaluation_failed` when user action may help (e.g. criteria version unsupported) — rate-limit / dedupe per search per day.

## Price and status events

| Change                                    | Source                          | Notification type                      | Default audience                                 |
| ----------------------------------------- | ------------------------------- | -------------------------------------- | ------------------------------------------------ |
| Asking price ↓                            | new `listing_price_history` row | `price_reduction`                      | Alert-enabled searches with type on (default on) |
| Asking price ↑                            | same                            | `price_increase`                       | Only if user enabled type (default off)          |
| Status → reserved                         | `listing_status_history`        | `status_reserved`                      | Shortlisted **or** last-matched (D17)            |
| Status → under_offer                      | same                            | `status_under_offer`                   | Same                                             |
| Withdrawn                                 | same                            | `listing_withdrawn`                    | Same                                             |
| Stale                                     | same                            | `listing_stale`                        | Same                                             |
| Source reappears / republish              | publish + match diff            | `new_match` if newly matching          | Alert-enabled search                             |
| Multiple listings / one physical property | sibling suppression             | One notify / type / UTC day / property | —                                                |

`source_event_id` = history row UUID (or publish audit id). **Do not** notify twice for the same source event (`dedupe_key`).

### Who receives listing-change alerts

**Price events:** users with an alert-enabled saved search whose `alert_types` include the event and that currently matches (or last-matched) the listing.

**Status / withdrawal / stale:** users who **shortlisted** the listing **or** have it in `saved_search_last_matches` for an alert-enabled search (D17). Favourites hearts are not an audience in 4B.

For withdrawal/stale after a listing leaves the public browse set, still notify if the listing remains in `saved_search_last_matches` or shortlist items so users are not blind.

## Job hooks (4B)

- **Manual / test:** `evaluateSavedSearch` / `evaluateAllDueSavedSearches` via UI API and Playwright harness.
- **Inline mutation (optional fan-out):** after admin/partner/ingest writes price or status history, call `generateListingChangeNotifications` (does **not** require a full automated due-scan of all saved searches).
- **Scheduler:** provider-neutral interface only; **not** production-wired in 4B.

No durable queue in 4B. Playwright uses FakeAuth + explicit evaluate after seeding a price/status change.

## Idempotency / retry safety

- Unique `dedupe_key` on notifications
- Unique `(saved_search_id, listing_id)` on last_matches
- Evaluation runs append-only
- Job methods must tolerate double-invocation after partial success

## Tests

- Equal weights of criteria → stable match
- Missing listing field vs required filter → no match
- New match only once; price event separate
- Legacy excluded; test flag includes
- Sibling physical-property suppression
- Failed evaluation recorded
- Idempotent re-run
