# Phase 4B — Decisions required (and locked)

Date: 2026-08-06  
Status: Planning — decisions locked for documentation; implementation awaits approval  
Parent: [`PHASE4B_PLAN.md`](PHASE4B_PLAN.md) · ADR-030b

## Already locked (do not re-open)

| ID       | Topic             | Lock                                                                                |
| -------- | ----------------- | ----------------------------------------------------------------------------------- |
| ADR-027  | Jobs              | `JOBS_PROVIDER=inline` / `InlineJobRunner` + `TestJobRunner` only; no pg-boss in 4B |
| ADR-029  | Sessions          | Verified sessions for all `/me/*`; `withAuthenticatedDb`                            |
| ADR-030  | Channels          | In-app + `TestNotificationProvider` only; no prod email/SMS/WhatsApp/push           |
| ADR-030a | 4A                | Shortlists/notes/comparison/guest cookie merge shipped                              |
| ADR-030b | 4B vs 4C          | **4B** = searches + history + in-app alerts; **4C** = comparison share links only   |
| D1       | Guest transport   | HttpOnly guest cookie + `guest_sessions` (4A)                                       |
| D2       | Default shortlist | Empty “My shortlist” on first auth (4A)                                             |
| D7       | Default delete    | No auto-promote (4A)                                                                |

## Locked in this planning slice

### D5 — History retention

- DB retention: **90 days**, overridable via `BUYER_HISTORY_RETENTION_DAYS`.
- Display / merge cap: **50** items (auth and guest local).
- Guest local history uses the same **50**-item cap until merge.
- **User-clearable:** clear one item and clear-all remain always available (no server lock that prevents clearing before retention expiry).

**Owner:** Product / Privacy — **locked**.

### D8 — Extend `PropertySearchCriteria` + storage shape

- Envelope: `criteriaVersion: 'phase4b.v1'`.
- Add: structured geo (`autonomousCommunity`, `province`, `municipality`, `districtOrLocality`), keep legacy `area` as free-text fallback; `minBathrooms` / `maxBathrooms`; `propertyType`; `listingStatuses[]`; `offPlan` (`any` \| `only` \| `exclude`); `freshness` (`any` \| `current_only`); free-text `q`; `sort`.
- **Do not persist** `page`, `pageSize`, `view`.
- Unknown future keys ignored on read; migrators bump `criteriaVersion`.
- **Storage (locked):** normalized versioned JSON in `criteria` **plus** selected denormalized indexed columns for list/filter (see D15). JSON remains the source of truth; indexed columns are derived on write.

**Owner:** Engineering — **locked**. Spec: [`SAVED_SEARCH_CRITERIA_SPEC.md`](SAVED_SEARCH_CRITERIA_SPEC.md).

### D11 — Guest merge for searches and history

- Never overwrite authenticated saved searches.
- Dedupe by `(user_id, criteria_hash)`; name clash → rename guest to `Guest — {name}`.
- Disabled guest search does **not** re-enable alerts on an existing auth search.
- Guest alert prefs apply only when **inserting** a new search row.
- History: upsert by `listing_id`; merge first/last/count; cap 50; newest-first.
- Idempotent via `guest_sessions.merged_at`.

**Owner:** Engineering — **locked**.

### D12 — History recording preference

- Auth: `notification_preferences.history_recording_enabled` boolean, default `true`.
- Guest: localStorage flag + guest payload field.
- Agencies never SELECT history / saved searches / notifications.

**Owner:** Privacy — **locked**.

### D13 — Alert inventory and dedupe

- Evaluate only authorized public-browseable listings.
- **Legacy snapshot alerts: disabled** by default. `legacy_snapshot` listings are never alert sources in production; `ALLOW_LEGACY_ALERTS_IN_TESTS=true` is test-only override.
- `dedupe_key` = hash(`userId`, `type`, `listingId` \| `savedSearchId`, `sourceEventId`).
- Physical-property fan-in: listing-scoped events; suppress sibling listings for same physical property + event type within **UTC calendar day** once one notification is delivered.

**Owner:** Engineering — **locked**.

### D14 — Job and notification providers (4B)

- Jobs: `JobRunner` interface; implement `InlineJobRunner`, `TestJobRunner` only.
- Notifications: `NotificationProvider` interface; implement `InAppNotificationProvider`, `TestNotificationProvider` only.
- Future stubs documented but not implemented: Email / SMS / WhatsApp / Push.
- **Evaluation mode (locked):** **manual** (user “Run search”) **plus test-triggered** harness initially. Define a provider-neutral **`Scheduler` / due-scan interface** (`evaluateAllDueSavedSearches`) so a durable scheduler can call the same methods later—**do not** wire production cron/pg-boss in 4B. Inline listing-mutation hooks may still generate **price/status** notifications without full saved-search re-scan automation.

**Owner:** Architecture — **locked**.

### D15 — Saved-search indexed columns

Denormalize from normalized criteria on every write (create/update/merge):

| Column                            | Source                              |
| --------------------------------- | ----------------------------------- |
| `idx_min_price` / `idx_max_price` | `minPrice` / `maxPrice`             |
| `idx_min_bedrooms`                | `minBedrooms`                       |
| `idx_municipality`                | `municipality` (or fallback `area`) |
| `idx_province`                    | `province`                          |
| `idx_property_type`               | `propertyType`                      |
| `idx_off_plan`                    | `offPlan`                           |
| `sort`                            | already planned                     |

Indexes support workspace list filters; **matching and hash always use JSON criteria**, not indexes alone.

**Owner:** Engineering — **locked**.

### D16 — Default alert type preferences

When a user enables alerts on a saved search (or on first create with alerts on):

| Type                                                                             | Default                                                                                            |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `new_match`                                                                      | **enabled**                                                                                        |
| `price_reduction`                                                                | **enabled**                                                                                        |
| `price_increase`                                                                 | **available in UI; disabled by default**                                                           |
| `status_reserved` / `status_under_offer` / `listing_withdrawn` / `listing_stale` | **enabled for properties the user has saved (saved-search last matches) or shortlisted** — see D17 |
| `saved_property_updated`                                                         | available; default off unless product enables later                                                |
| `saved_search_evaluation_failed`                                                 | system; not user-togglable                                                                         |

`alert_types` default when enabling alerts: `['new_match', 'price_reduction']` plus status/withdrawal types are evaluated via the shortlist/saved-match path (D17), not necessarily stored as search `alert_types` unless the user opts into search-scoped status alerts.

**Owner:** Product — **locked**.

### D17 — Status and withdrawal alert audience

Status and withdrawal alerts (`status_reserved`, `status_under_offer`, `listing_withdrawn`, `listing_stale`) fire for a user when the listing is:

1. In that user’s **shortlist items**, **or**
2. In `saved_search_last_matches` for any of that user’s alert-enabled saved searches

Favourites (heart) are **not** an alert audience in 4B unless later opted in (keeps ADR-030 favourites separate).

**Owner:** Product — **locked**.

## Caps (locked)

| Resource          | Auth         | Guest           |
| ----------------- | ------------ | --------------- |
| Saved searches    | 25           | 5               |
| History list      | 50           | 50              |
| History retention | 90 days      | N/A until merge |
| Save-search rate  | 20/min/user  | —               |
| Record-view rate  | 30/min/user  | —               |
| Saved search name | varchar(120) | —               |

## Still deferred (not 4B)

| Topic                                       | Target                                  |
| ------------------------------------------- | --------------------------------------- |
| Comparison share links / frozen scores (D6) | Phase 4C                                |
| Leads / viewing requests                    | Phase 4.1+                              |
| Privacy export/delete workers               | Phase 4.1+                              |
| Production email digests                    | When channels expand                    |
| Collaborators                               | Phase 6                                 |
| pg-boss                                     | Only if scale demands (ADR-027 revisit) |

## Sign-off

Phase 4B **planning** may proceed with D5, D8, D11–D17 locked (including recommended product defaults for storage, retention, alert types, and evaluation mode). Implementation requires explicit approval after docs land.
