# Phase 4 database changes

Date: 2026-08-06  
Status: Planning — **not migrated**  
Parent: [`PHASE4_PLAN.md`](PHASE4_PLAN.md)  
Related: [`DATABASE_DESIGN.md`](DATABASE_DESIGN.md) M10/M11

## Overview

Introduce buyer-workspace tables (M10 subset) and alert/notification foundation (M11 subset) without collaborator invites, leads or privacy workers.

Planned migrations (names illustrative):

1. `0007_phase4_buyer_workspace.sql` — tables, indexes, FKs  
2. `0008_phase4_rls.sql` — RLS policies  
3. Seed: buyer demo user in `seed-constants.ts` / `seed.ts`

Favourites table **unchanged**.

## New tables

### shortlists

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | default random |
| user_id | uuid FK → users ON DELETE CASCADE | owner |
| name | varchar(80) | |
| is_default | boolean NOT NULL DEFAULT false | |
| created_at / updated_at | timestamptz | |

Constraints:

- `UNIQUE (user_id, name)`
- Partial unique index: one default per user — `UNIQUE (user_id) WHERE is_default`

### shortlist_items

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| shortlist_id | uuid FK → shortlists CASCADE | |
| listing_id | uuid FK → property_listings CASCADE | |
| position | int NOT NULL DEFAULT 0 | |
| created_at / updated_at | timestamptz | |

- `UNIQUE (shortlist_id, listing_id)`
- Index `(shortlist_id, position)`

### property_notes

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| user_id | uuid FK → users CASCADE | |
| listing_id | uuid FK → property_listings CASCADE | |
| body | text NOT NULL DEFAULT '' | max enforced in app |
| positives | jsonb NOT NULL DEFAULT '[]' | string[] |
| negatives | jsonb NOT NULL DEFAULT '[]' | string[] |
| created_at / updated_at | timestamptz | |

- `UNIQUE (user_id, listing_id)`

### shortlist_notes

| Column | Type | Notes |
| ------ | ---- | ----- |
| shortlist_id | uuid PK FK → shortlists CASCADE | 1:1 |
| body | text NOT NULL DEFAULT '' | |
| updated_at | timestamptz | |

### user_preference_profiles

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| user_id | uuid FK → users CASCADE | |
| name | varchar(80) | e.g. “Default” |
| weights | jsonb NOT NULL | map of criterion → 0–10 |
| is_active | boolean NOT NULL DEFAULT false | |
| created_at / updated_at | timestamptz | |

- Partial unique: one active profile per user

### comparison_sets

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| user_id | uuid FK → users CASCADE | |
| shortlist_id | uuid NULL FK | optional origin |
| weight_snapshot | jsonb NULL | frozen weights |
| created_at / updated_at | timestamptz | |

### comparison_items

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| comparison_set_id | uuid FK CASCADE | |
| listing_id | uuid FK → property_listings | |
| position | int | |

- `UNIQUE (comparison_set_id, listing_id)`
- App enforces max 5 items

### comparison_shares

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| comparison_set_id | uuid FK CASCADE | |
| created_by | uuid FK → users CASCADE | |
| token_hash | varchar(64) UNIQUE | SHA-256 hex |
| public_title | varchar(120) NULL | |
| expires_at | timestamptz NOT NULL | |
| revoked_at | timestamptz NULL | |
| created_at | timestamptz | |

- Plaintext token never stored
- Public read uses service role lookup by hash after rate limit (or SECURITY DEFINER function)—document choice in implementation; RLS: owner manage; anon no direct table select

### saved_searches

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| user_id | uuid FK CASCADE | |
| name | varchar(120) | |
| criteria | jsonb NOT NULL | PropertySearchCriteria |
| sort | varchar(64) | |
| criteria_hash | varchar(64) NOT NULL | |
| last_run_at | timestamptz NULL | |
| timestamps | | |

- `UNIQUE (user_id, criteria_hash)`

### recently_viewed

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| user_id | uuid FK CASCADE | |
| listing_id | uuid FK CASCADE | |
| viewed_at | timestamptz NOT NULL | |
| channel | varchar(32) NOT NULL DEFAULT 'web' | |

- Index `(user_id, viewed_at DESC)`
- Optional `UNIQUE (user_id, listing_id)` with upsert updating `viewed_at`

### alert_subscriptions

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| saved_search_id | uuid FK CASCADE | |
| user_id | uuid FK CASCADE | denormalized owner for RLS |
| event_types | text[] NOT NULL | |
| enabled | boolean NOT NULL DEFAULT true | |
| consented_at | timestamptz NOT NULL | |
| timestamps | | |

- `UNIQUE (saved_search_id)` one subscription row per search (event_types array)

### in_app_notifications

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| user_id | uuid FK CASCADE | |
| type | varchar(64) | AlertEventType |
| title | text | |
| body | text | |
| payload | jsonb | |
| dedupe_key | varchar(128) NULL | spam control |
| read_at | timestamptz NULL | |
| created_at | timestamptz | |

- Unique partial index on `(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL`

## guest_sessions.payload extension

```typescript
payload: {
  favouriteListingIds: string[];
  comparisonListingIds: string[];
  recentViewListingIds: string[];
  savedSearchCriteria: unknown[];
  shortlists?: Array<{
    name: string;
    isDefault?: boolean;
    listingIds: string[];
    note?: string;
  }>;
  preferenceWeights?: Record<string, number>;
  propertyNotes?: Array<{
    listingId: string;
    body: string;
    positives?: string[];
    negatives?: string[];
  }>;
}
```

Size limits enforced in API (reject oversized payloads).

## RLS outline (`0008_phase4_rls.sql`)

Enable RLS on all new tables. Pattern:

- Owner tables: `user_id = (current_setting('request.jwt.claim.sub', true))::uuid`
- `shortlist_items` / `shortlist_notes`: via shortlist ownership EXISTS subquery
- `comparison_items`: via comparison_set ownership
- `alert_subscriptions` / `in_app_notifications`: owner `user_id`
- `comparison_shares`: owner `created_by` for select/insert/update (revoke); **no** anon policy on base table—public token resolution via controlled server path (service role after hash) or definer function returning share DTO only

**Deny** `org_*` / agency policies on these tables (no grants beyond authenticated owner).

Agencies must not gain SELECT on `recently_viewed`, notes, shortlists, saved_searches, notifications.

## Seed

Add `BUYER_DEMO_USER_ID` (deterministic UUID) with role `buyer` for Playwright authenticated workspace flows. Do not grant org membership.

## Comparison fact columns (existing)

Document mapping only—no new listing columns required for Phase 4 MVP. Optional later: energy_rating, school/hospital proximity columns when real sources exist.

## Account deletion

FK `ON DELETE CASCADE` from `users` clears workspace. Shares revoked/deleted with user. Guest sessions already reference `merged_into_user_id`.

## Out of migration scope

- `shortlist_collaborators`
- Leads / viewing requests
- `privacy_requests` worker columns
- `alert_deliveries` email log (optional stub table deferred)
- Search run analytics (`search_runs`) — optional; Phase 4 uses `recently_viewed` only
