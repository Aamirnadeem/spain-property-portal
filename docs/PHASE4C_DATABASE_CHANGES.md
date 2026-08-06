# Phase 4C database changes — Comparison shares

Date: 2026-08-06  
Status: Phase 4C planning (migrations not applied)  
Parent: [`PHASE4C_PLAN.md`](PHASE4C_PLAN.md) · Builds on Phase 4B migrations `0009` / `0010`

## Migration naming (illustrative)

Apply after 4B:

| Migration | Purpose |
| --------- | ------- |
| `0011_phase4c_comparison_shares.sql` | Tables, indexes, FKs |
| `0012_phase4c_comparison_shares_rls.sql` | RLS policies + grants |

Exact filenames follow the package migrator convention at implementation time.

## Tables

### `comparison_shares`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | uuid PK | Default `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | Owner; FK `users(id)` ON DELETE CASCADE |
| `comparison_set_id` | uuid NULL | Optional provenance; FK `comparison_sets(id)` ON DELETE SET NULL |
| `token_hash` | varchar(64) NOT NULL UNIQUE | SHA-256 hex of plaintext token |
| `public_title` | varchar(120) NULL | Length-capped |
| `public_description` | varchar(500) NULL | Neutral copy only |
| `expires_at` | timestamptz NOT NULL | ≤ created_at + 90 days |
| `revoked_at` | timestamptz NULL | Set on revoke/replace-of-old |
| `replaced_by_share_id` | uuid NULL | Self-FK to successor share |
| `manifest` | jsonb NOT NULL | `phase4c.v1` envelope |
| `include_weights` | boolean NOT NULL DEFAULT false | |
| `include_scores` | boolean NOT NULL DEFAULT false | |
| `score_model_version` | varchar(32) NULL | e.g. `phase4a.v1` when scores included |
| `weight_snapshot` | jsonb NULL | Frozen when weights/scores included |
| `access_count` | integer NOT NULL DEFAULT 0 | Aggregate |
| `last_accessed_at` | timestamptz NULL | Aggregate |
| `created_at` | timestamptz NOT NULL | |
| `updated_at` | timestamptz NOT NULL | |

Constraints:

- CHECK `expires_at > created_at`
- Application enforces max 90-day window and presets
- Self-FK: `replaced_by_share_id` → `comparison_shares(id)` ON DELETE SET NULL

Indexes:

- UNIQUE `token_hash`
- `(user_id, created_at DESC)`
- `(user_id, revoked_at, expires_at)` for owner status lists
- Optional partial index on active shares: `WHERE revoked_at IS NULL`

### `comparison_share_items`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | uuid PK | |
| `share_id` | uuid NOT NULL | FK CASCADE → `comparison_shares` |
| `listing_id` | uuid NOT NULL | FK → listings (ON DELETE behaviour: prefer RESTRICT or SET NULL + service warning — document at impl: **keep row, allow listing hard-delete only if FK SET NULL**; recommended: FK without CASCADE delete of share; on listing delete keep item with warning via nullable FK or soft status) |
| `position` | smallint NOT NULL | 0-based or 1-based; consistent with 4A |
| `physical_property_id` | uuid NULL | Snapshot for merge/withdraw diagnostics |

Constraints:

- UNIQUE `(share_id, listing_id)`
- UNIQUE `(share_id, position)` recommended
- Service enforces 2–5 items per share

Indexes:

- `(share_id, position)`
- `(listing_id)` for admin diagnostics only (no agency product path in 4C)

**Recommended FK for `listing_id`:** `ON DELETE RESTRICT` during normal ops; withdrawn listings remain rows with live resolve warnings. If hard-delete of listings is required by platform policy, use `ON DELETE SET NULL` and treat null listing as `listing_deleted` warning — choose one at migration and document in ADR amendment if needed.

### `comparison_share_access_events`

Privacy-minimal optional audit of resolve attempts for **known** share rows (lookup succeeded by hash).

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | uuid PK | |
| `share_id` | uuid NOT NULL | FK CASCADE |
| `accessed_at` | timestamptz NOT NULL DEFAULT now() | |
| `result` | text/enum NOT NULL | `ok` \| `not_found` \| `expired` \| `revoked` — for rows that resolved to a share id; pure unknown tokens may skip insert |
| `ua_category` | text NULL | `browser` \| `bot` \| `preview` \| `other` |

**Deferred (D23):** truncated/hashed network identifier — not in 4C schema unless abuse evidence requires an ADR amendment.

Indexes:

- `(share_id, accessed_at DESC)`
- Optional retention job later (out of 4C scope) to prune old events

## Manifest envelope (`phase4c.v1`)

```json
{
  "schemaVersion": "phase4c.v1",
  "fields": ["title", "asking_price", "..."],
  "listingIds": ["uuid", "..."],
  "includeWeights": false,
  "includeScores": false,
  "scoreModelVersion": null,
  "createdAt": "ISO-8601",
  "expiresAt": "ISO-8601"
}
```

Canonical listing membership also lives in `comparison_share_items` (source of truth for positions). Manifest must not disagree with items; service writes both atomically.

## Selection model

- Share stores **its own** items (explicit IDs at create).
- `comparison_set_id` is optional provenance only.
- Future shortlist/compare edits must **not** expand the public set.

## RLS catalogue (policy names)

Enable RLS; revoke broad anon grants.

| Policy (illustrative) | Table | Role | Rule |
| --------------------- | ----- | ---- | ---- |
| `comparison_shares_owner_select` | comparison_shares | authenticated | `user_id = request.jwt.claim.sub` |
| `comparison_shares_owner_insert` | comparison_shares | authenticated | same + insert check |
| `comparison_shares_owner_update` | comparison_shares | authenticated | same (revoke/replace metadata) |
| `comparison_shares_owner_delete` | comparison_shares | authenticated | same (optional; soft revoke preferred) |
| `comparison_share_items_owner_*` | comparison_share_items | authenticated | via parent share ownership |
| `comparison_share_access_events_owner_select` | events | authenticated | via parent share ownership (aggregates preferred for UI) |
| *(none)* | all three | anon | **No SELECT/INSERT/UPDATE/DELETE** |

Service-role connection used only for:

1. `resolvePublicComparisonShare` after rate limit
2. `recordShareAccess` increments / event inserts from that path

Document exception in [`RLS_IMPLEMENTATION_STATUS.md`](RLS_IMPLEMENTATION_STATUS.md) and [`COMPARISON_SHARE_SECURITY_MODEL.md`](COMPARISON_SHARE_SECURITY_MODEL.md).

## Grants

- Authenticated: SELECT/INSERT/UPDATE on owner-scoped tables as policies allow
- Anon: no privileges on share tables
- Service role: as required for resolve path (same pattern as 4B notification fan-out)

## Data retention (product)

- Shares expire by `expires_at`; soft state via `revoked_at`
- Hard delete of expired shares: optional future job (out of 4C MVP)
- Access events: retain for abuse review; prune policy deferred

## Relation to Phase 4 sketches

This document **supersedes** older `comparison_shares` sketches in [`PHASE4_DATABASE_CHANGES.md`](PHASE4_DATABASE_CHANGES.md) for Phase 4C implementation (90-day max, manifest, share items, access events, route rename).
