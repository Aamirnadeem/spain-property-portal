# In-app notification design

Date: 2026-08-06  
Status: Phase 4B planning  
Parent: [`PHASE4B_PLAN.md`](PHASE4B_PLAN.md) · ADR-030b · Lock D13 / D14

## Purpose

Deliver a reliable **in-app** notification centre for saved-search and listing-change events. Production email, SMS, WhatsApp, and push are **out of scope**.

## Notification types

| Type                             | Meaning                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new_match`                      | Listing newly matches an alert-enabled saved search                                                                                               |
| `price_reduction`                | Asking price decreased (source: price history)                                                                                                    |
| `price_increase`                 | Asking price increased                                                                                                                            |
| `status_reserved`                | Status → reserved                                                                                                                                 |
| `status_under_offer`             | Status → under offer                                                                                                                              |
| `listing_withdrawn`              | Listing withdrawn / unavailable                                                                                                                   |
| `listing_stale`                  | Listing marked stale                                                                                                                              |
| `saved_property_updated`         | Material update to a shortlisted/favourited listing the user watches via alert prefs (if wired); otherwise limited to matches of enabled searches |
| `saved_search_evaluation_failed` | Evaluation failed and user action may be required                                                                                                 |

## Default preferences (D16)

When the user enables alerts on a saved search, seed `alert_types` with:

- `new_match` — on
- `price_reduction` — **on by default**
- `price_increase` — **off by default** (still selectable in `AlertPreferenceControls`)

Status / withdrawal / stale notifications are driven by shortlist membership or saved-search last matches (D17), surfaced in the same notification centre.

## Records

### `in_app_notifications`

| Column                           | Notes                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `id`                             | uuid PK                                                                                       |
| `user_id`                        | FK CASCADE                                                                                    |
| `type`                           | enum/text from table above                                                                    |
| `title_key` / `body_key`         | i18n message keys (not raw user PII)                                                          |
| `payload`                        | Minimal jsonb: `{ listingId?, savedSearchId?, priceFrom?, priceTo?, statusFrom?, statusTo? }` |
| `dedupe_key`                     | UNIQUE — see below                                                                            |
| `listing_id` / `saved_search_id` | Optional FKs for deep links                                                                   |
| `source_event_id`                | Price/status history row id or evaluation-run id                                              |
| `read_at` / `archived_at`        | Null until read/dismissed                                                                     |
| `created_at`                     | Event timestamp for UI                                                                        |

### `notification_deliveries`

Provider attempt log: `notification_id`, `provider` (`in_app` \| `test`), `status`, `attempted_at`, `error_code` — keeps future email additive without schema rewrite.

## Duplicate suppression

```text
dedupe_key = SHA-256(userId | type | listingId|savedSearchId | sourceEventId)
```

- Same source event → at most one row (UNIQUE on `dedupe_key`).
- Physical-property fan-in: after delivering for listing A, suppress same `type` for sibling listings of the same `physical_property_id` within **UTC calendar day** (D13).

## Provider boundary

```typescript
interface NotificationProvider {
  deliver(input: NotificationDeliveryInput): Promise<NotificationDeliveryResult>;
}
```

| Provider                      | 4B                                                 |
| ----------------------------- | -------------------------------------------------- |
| `InAppNotificationProvider`   | **Implement** — insert notification + delivery row |
| `TestNotificationProvider`    | **Implement** — capture for unit/e2e               |
| Email / SMS / WhatsApp / Push | Document stubs only                                |

## Services / API

| Service                    | API                                                               |
| -------------------------- | ----------------------------------------------------------------- |
| `listNotifications`        | `GET /api/v1/me/notifications?status=unread\|all`                 |
| `markNotificationRead`     | `POST /api/v1/me/notifications/[id]/read`                         |
| `markAllNotificationsRead` | `POST /api/v1/me/notifications/read-all`                          |
| `dismissNotification`      | `POST /api/v1/me/notifications/[id]/dismiss` (sets `archived_at`) |

Session + CSRF + `withAppAuthenticatedDb`. Localized rendering in UI using `title_key` / `body_key` + payload.

## UI

- `/{locale}/workspace/notifications` — `NotificationCentre`
- Header `UnreadBadge` (count of `read_at IS NULL AND archived_at IS NULL`)
- Deep link: property detail or saved-search detail
- Empty / loading / error / stale states
- en / es / ca / ar + RTL

## Authorization / privacy

- Owner RLS only; agencies denied.
- Minimal payloads; no private notes in notification body.
- Delete/archive on user dismiss; account deletion CASCADE.
- Not used for agency analytics.

## Tests

Dedupe uniqueness, mark read / read-all / dismiss, deep-link targets, locale keys present, agency deny, TestNotificationProvider capture, Playwright journey notification step.
