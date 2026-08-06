# Phase 4B database changes

Date: 2026-08-06  
Status: Phase 4B planning (not applied)  
Parent: [`PHASE4B_PLAN.md`](PHASE4B_PLAN.md) · ADR-030b

## Migration files (illustrative)

| File                                                                       | Contents                                                   |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/database/drizzle/0009_phase4b_saved_searches_history_alerts.sql` | Tables + indexes + FKs + `notification_preferences` column |
| `packages/database/drizzle/0010_phase4b_rls.sql`                           | ENABLE RLS + owner policies; grants to `authenticated`     |

Do **not** reuse `0007`/`0008` — those are Phase 4A (`0008_phase4a_rls.sql` shipped).

Favourites table: **no ALTER** (ADR-030 preserve-in-place).

---

## Tables

### `saved_searches`

| Column                      | Type                              | Notes                                                 |
| --------------------------- | --------------------------------- | ----------------------------------------------------- |
| `id`                        | uuid PK                           |                                                       |
| `user_id`                   | uuid FK → users ON DELETE CASCADE |                                                       |
| `name`                      | varchar(120) NOT NULL             |                                                       |
| `criteria`                  | jsonb NOT NULL                    | `phase4b.v1` envelope (source of truth)               |
| `criteria_version`          | varchar(32) NOT NULL              | e.g. `phase4b.v1`                                     |
| `criteria_hash`             | varchar(64) NOT NULL              |                                                       |
| `sort`                      | varchar(64) NOT NULL              | denormalized from criteria for listing                |
| `idx_min_price`             | numeric(14,2) NULL                | denormalized indexed column (D15)                     |
| `idx_max_price`             | numeric(14,2) NULL                |                                                       |
| `idx_min_bedrooms`          | int NULL                          |                                                       |
| `idx_municipality`          | varchar(120) NULL                 |                                                       |
| `idx_province`              | varchar(120) NULL                 |                                                       |
| `idx_property_type`         | varchar(64) NULL                  |                                                       |
| `idx_off_plan`              | varchar(16) NULL                  | `any` \| `only` \| `exclude`                          |
| `alerts_enabled`            | boolean NOT NULL DEFAULT false    |                                                       |
| `alert_types`               | text[] NOT NULL DEFAULT '{}'      | on enable default `new_match`,`price_reduction` (D16) |
| `consented_at`              | timestamptz NULL                  | set when alerts first enabled                         |
| `last_evaluated_at`         | timestamptz NULL                  |                                                       |
| `last_match_count`          | int NULL                          |                                                       |
| `last_evaluation_status`    | varchar(32) NULL                  | `succeeded` \| `failed`                               |
| `disabled_at`               | timestamptz NULL                  | soft-disable search without delete                    |
| `created_at` / `updated_at` | timestamptz                       |                                                       |

Constraints: `UNIQUE (user_id, criteria_hash)`.  
Indexes: `(user_id, updated_at DESC)`, `(alerts_enabled)` partial where enabled, `(user_id, idx_municipality)`, `(user_id, idx_min_price, idx_max_price)`, `(user_id, idx_property_type)`.  
**Write path:** normalize JSON → hash → derive `idx_*` columns in the same transaction.

### `saved_search_evaluation_runs`

| Column                       | Type                 | Notes                                                                                       |
| ---------------------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| `id`                         | uuid PK              |                                                                                             |
| `saved_search_id`            | uuid FK CASCADE      |                                                                                             |
| `started_at` / `finished_at` | timestamptz          |                                                                                             |
| `status`                     | varchar(32)          |                                                                                             |
| `match_count`                | int NULL             |                                                                                             |
| `error_code`                 | varchar(64) NULL     |                                                                                             |
| `trigger`                    | varchar(32) NOT NULL | `manual` \| `test` \| `inline_mutation` \| `scheduled` (`scheduled` reserved; unused in 4B) |

### `saved_search_last_matches`

| Column             | Type                 |
| ------------------ | -------------------- |
| `saved_search_id`  | uuid FK CASCADE      |
| `listing_id`       | uuid FK CASCADE      |
| `first_matched_at` | timestamptz NOT NULL |

PK / UNIQUE `(saved_search_id, listing_id)`.

### `browsing_history`

| Column                               | Type                               |
| ------------------------------------ | ---------------------------------- |
| `id`                                 | uuid PK                            |
| `user_id`                            | uuid FK CASCADE                    |
| `listing_id`                         | uuid FK CASCADE                    |
| `physical_property_id`               | uuid NULL                          |
| `first_viewed_at` / `last_viewed_at` | timestamptz NOT NULL               |
| `view_count`                         | int NOT NULL DEFAULT 1             |
| `channel`                            | varchar(32) NOT NULL DEFAULT 'web' |
| `context`                            | jsonb NULL                         |
| `created_at` / `updated_at`          | timestamptz                        |

`UNIQUE (user_id, listing_id)`; index `(user_id, last_viewed_at DESC)`.

### `in_app_notifications`

| Column                    | Type                        |
| ------------------------- | --------------------------- |
| `id`                      | uuid PK                     |
| `user_id`                 | uuid FK CASCADE             |
| `type`                    | varchar(64) NOT NULL        |
| `title_key` / `body_key`  | varchar(128) NOT NULL       |
| `payload`                 | jsonb NOT NULL DEFAULT '{}' |
| `dedupe_key`              | varchar(64) NOT NULL UNIQUE |
| `listing_id`              | uuid NULL                   |
| `saved_search_id`         | uuid NULL                   |
| `source_event_id`         | uuid NULL                   |
| `read_at` / `archived_at` | timestamptz NULL            |
| `created_at`              | timestamptz NOT NULL        |

Indexes: `(user_id, created_at DESC)`, partial unread `(user_id) WHERE read_at IS NULL AND archived_at IS NULL`.

### `notification_deliveries`

| Column            | Type                 |
| ----------------- | -------------------- |
| `id`              | uuid PK              |
| `notification_id` | uuid FK CASCADE      |
| `provider`        | varchar(32) NOT NULL |
| `status`          | varchar(32) NOT NULL |
| `error_code`      | varchar(64) NULL     |
| `attempted_at`    | timestamptz NOT NULL |

### Alter `notification_preferences`

Add `history_recording_enabled boolean NOT NULL DEFAULT true`.

### Guest payload (Drizzle type only; no separate guest tables)

Extend `GuestWorkspacePayload`:

```typescript
savedSearches?: Array<{
  name: string;
  criteria: unknown;
  criteriaHash?: string;
  alertsEnabled?: boolean;
  alertTypes?: string[];
  disabled?: boolean;
}>;
browsingHistory?: Array<{
  listingId: string;
  physicalPropertyId?: string;
  firstViewedAt: string;
  lastViewedAt: string;
  viewCount: number;
  channel?: string;
  context?: Record<string, unknown>;
}>;
// Keep legacy savedSearchCriteria / recentViewListingIds as read-fallback during migration
```

---

## RLS (0010)

For each buyer table: `ENABLE ROW LEVEL SECURITY`; policies `*_owner_select|insert|update|delete` with `user_id = current_setting('request.jwt.claim.sub', true)::uuid`.

Child tables (`evaluation_runs`, `last_matches`, `notification_deliveries`): ownership via `EXISTS` parent.

**No** organization/agency SELECT policies.

Service-role: evaluation jobs / expire jobs use existing service DB path (document exception; not buyer `/me` routes).

Catalogue: update [`packages/database/src/rls/policies.ts`](../packages/database/src/rls/policies.ts) when implementing.

---

## Out of this migration

- `comparison_shares` (Phase 4C)
- Privacy export tables / workers (4.1+)
- Email delivery provider tables beyond `notification_deliveries` stub rows
- ALTER favourites
