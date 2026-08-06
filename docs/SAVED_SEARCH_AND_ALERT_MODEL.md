# Saved search and alert model

Date: 2026-08-06  
Status: Phase 4 planning — **superseded for implementation detail by Phase 4B docs** ([`PHASE4B_IMPLEMENTATION.md`](PHASE4B_IMPLEMENTATION.md), [`SAVED_SEARCH_CRITERIA_SPEC.md`](SAVED_SEARCH_CRITERIA_SPEC.md), [`IN_APP_NOTIFICATION_DESIGN.md`](IN_APP_NOTIFICATION_DESIGN.md), [`ALERT_MATCHING_ENGINE.md`](ALERT_MATCHING_ENGINE.md)). Kept as historical parent overview.  
Parent: [`PHASE4_PLAN.md`](PHASE4_PLAN.md)

## Purpose

Persist buyer search criteria, allow guests to keep local saved searches until sign-in, and provide an **alerts foundation** delivered only through an in-app notification centre and a **test** notification provider. Production email, SMS and WhatsApp are out of scope for Phase 4.

## Saved searches

### Criteria payload

Reuse `@spain/search` `PropertySearchCriteria` (and extensions as needed):

- Free-text `q`
- Geographic / area filters
- Price range, bedrooms, bathrooms, size
- Property type (when criteria supports it)
- Environmental categories (`environmentType`)
- Listing status / operational status filter (extend schema if missing today)
- Off-plan preference (extend criteria if missing)
- Sort order (`sort`)
- Pagination is **not** stored (always re-open at page 1)

### Persistence

| Actor         | Storage                                                    |
| ------------- | ---------------------------------------------------------- |
| Guest         | `localStorage` array + guest payload `savedSearchCriteria` |
| Authenticated | `saved_searches` table                                     |

Columns (planned): `id`, `user_id`, `name`, `criteria` jsonb, `sort`, `criteria_hash`, `last_run_at`, timestamps.

- `criteria_hash` = stable hash of normalized criteria + sort for dedupe on merge and optional unique `(user_id, criteria_hash)`.
- Max saved searches / user: **25** (guest: **5**).

### Domain / API

- `saveSearch`, `listSavedSearches`, update name, delete
- Re-run = navigate to `/{locale}/search?` + `toSearchParams(criteria)`
- Routes under `/api/v1/me/saved-searches`

### Guest merge

- Prepend guest searches; skip duplicates by `criteria_hash`
- Truncate to cap after merge

---

## Alert subscriptions

### Events (Phase 4)

| Event type          | Trigger                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `new_match`         | New/published listing matches saved criteria                        |
| `price_reduction`   | Asking price decreases for a previously matching or watched listing |
| `status_change`     | Operational status changes (e.g. reserved, available)               |
| `listing_withdrawn` | Listing withdrawn / unavailable                                     |
| `stale_listing`     | Freshness crosses stale threshold for a matching listing            |

Out of scope for Phase 4 delivery channels: media/document change, off-plan completion-date change (may be added later as event types only if data exists).

### Tables

- `alert_subscriptions` — `saved_search_id`, `event_types` text[], `enabled`, `consented_at`, timestamps
- `in_app_notifications` — `user_id`, `type`, `title`, `body`, `payload` jsonb (listingId, savedSearchId, …), `read_at`, `created_at`

### Consent

- Enabling alerts requires explicit opt-in (`consented_at` set). Even in-app alerts are preference-sensitive.
- Disabling clears `enabled` but retains history of notifications unless user deletes.

### Evaluation strategy (no pg-boss)

Per ADR-027 / ADR-030:

1. After agency/admin listing **publish**, **price update**, **status update**, **withdraw** — call inline `evaluateAlertsForListing(listingId)`.
2. Match against enabled subscriptions whose criteria match (reuse search predicate helpers where possible).
3. Insert `in_app_notifications` (dedupe key: user+listing+event+day to limit spam).
4. Invoke `TestNotificationProvider.notify(...)` in non-production / when `NOTIFICATION_PROVIDER=test`.
5. Optional periodic helper script for `stale_listing` (inline or pnpm script)—not a production email worker.

**Production email adapter must not send** for these events in Phase 4 even if configured; channel allowlist = `in_app` + `test` only.

### Notification provider boundary

```typescript
interface NotificationProvider {
  notify(input: {
    userId: string;
    channel: 'in_app' | 'test';
    type: AlertEventType;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

class TestNotificationProvider implements NotificationProvider {
  /* records for tests */
}
```

WhatsApp / SMS / production email providers: **not wired**.

### API

- `listNotifications`, mark read / mark all read
- Attach/detach alert subscription on saved search
- Routes: `/api/v1/me/notifications`, `/api/v1/me/saved-searches/{id}/alerts`

### UI

- Bell / badge on workspace nav
- `/{locale}/workspace/notifications`
- Saved search row: “Alert me” toggle (consent modal first time)

---

## Security notes

- Subscriptions and notifications are owner-scoped RLS.
- Agencies cannot list buyer notifications.
- Payload must not include other users’ PII.
- Rate-limit subscription create and notification list if needed.

## Tests

- Save/list/delete search; criteria round-trip through URL
- Guest merge dedupe by hash
- Price reduction → in-app notification for subscriber; non-matching user silent
- `TestNotificationProvider` assertion in unit/integration
- Assert production path does not call email/SMS/WhatsApp adapters for alert events
- Cross-user cannot read notifications

## Explicit non-goals

- Instant/daily/weekly email digests
- SMS / WhatsApp delivery
- Background job runner (pg-boss)
- Marketing blast email
