# Phase 3 database changes

Date: 2026-08-05  
Status: Planning (no migrations applied yet)  
Baseline: Phase 2 schema in `packages/database/src/schema/index.ts` and drizzle `0000`–`0003`.

## Goals

1. Support partner CSV/JSON/XML ingestion with raw snapshots and feed configs.
2. Activate organization tenancy on listings and imports.
3. Add duplicate candidates, audit events, permission events, freshness helpers.
4. Keep physical vs listing separation (ADR-020); no automatic cross-source merge.

## Existing tables to reuse (no drop)

| Table                                                                 | Phase 3 use                             |
| --------------------------------------------------------------------- | --------------------------------------- |
| `data_sources`                                                        | Registry; add columns below             |
| `organizations`, `organization_members`, `organization_verifications` | Seed demo agency; RLS policies          |
| `roles`, `permissions`, `role_permissions`, `user_roles`              | Seed permission catalog                 |
| `physical_properties`, `property_addresses`, `property_locations`     | Persist path                            |
| `property_listings`                                                   | Partner upsert; set `organization_id`   |
| `listing_price_history`, `listing_status_history`                     | Enforce writes on change                |
| `property_provenance`, `source_claims`, `property_features`           | Provenance                              |
| `media_assets`, `media_rights`, `listing_media`                       | Authorized media                        |
| `import_runs`, `import_errors`                                        | Partner/admin visibility; extend fields |
| `features`, `property_types`                                          | Normalization targets                   |

## Columns to add

### `data_sources`

| Column                     | Type                 | Notes                  |
| -------------------------- | -------------------- | ---------------------- |
| `permission_expires_at`    | timestamptz nullable | Gate uses expiry       |
| `default_freshness_method` | freshness_method     | Default `partner_feed` |
| `is_full_sync_capable`     | boolean              | Freshness miss logic   |

### `property_listings`

| Column                 | Type                 | Notes                                |
| ---------------------- | -------------------- | ------------------------------------ |
| `missing_since`        | timestamptz nullable | Full-sync miss tracking              |
| `geo_match_confidence` | text/enum nullable   | `exact_name` / `fuzzy` / `unmatched` |
| `municipality_id`      | uuid FK nullable     | When matched                         |
| `neighborhood_id`      | uuid FK nullable     | When matched                         |
| `parser_version`       | text nullable        | Last writer                          |

### `import_runs`

| Column            | Type             | Notes                              |
| ----------------- | ---------------- | ---------------------------------- |
| `organization_id` | uuid FK nullable | Denormalized for RLS               |
| `feed_config_id`  | uuid FK nullable |                                    |
| `raw_snapshot_id` | uuid FK nullable | Primary snapshot                   |
| `parser_version`  | text             |                                    |
| `mode`            | text             | `dry_run` / `full` / `incremental` |
| `job_id`          | text nullable    | pg-boss job id                     |

## New tables

### `feed_configs`

- `id`, `data_source_id`, `format` (`csv`/`json`/`xml`), `mapping` jsonb, `schedule_cron` nullable, `is_active`, `created_at`, `updated_at`

### `source_endpoints` (optional in first migration)

- `id`, `data_source_id`, `url`, `auth_secret_ref`, `http_method`, `enabled`
- No scrape URLs; HTTPS partner APIs only when approved

### `source_permission_events`

- `id`, `data_source_id`, `actor_user_id`, `from_status`, `to_status`, `from_image_rights`, `to_image_rights`, `note`, `created_at`

### `raw_snapshots`

- `id`, `import_run_id`, `data_source_id`, `content_sha256`, `parser_version`, `storage_ref` nullable, `payload` jsonb nullable (small), `byte_size`, `retained_until`, `created_at`

### `ingestion_items` (optional for UI progress)

- `id`, `import_run_id`, `record_index`, `external_listing_id`, `status` (`pending`/`ok`/`rejected`/`skipped`), `listing_id` nullable, `message` nullable

### `duplicate_candidates`

- `id`, `listing_id_a`, `listing_id_b`, `score`, `band` (`exact`/`high`/`medium`), `status` (`open`/`linked`/`dismissed`), `resolver_user_id` nullable, `created_at`, `resolved_at`
- Unique pair constraint (ordered ids)

### `audit_events`

- `id`, `actor_user_id` nullable, `organization_id` nullable, `action`, `entity_type`, `entity_id`, `before` jsonb, `after` jsonb, `request_id` nullable, `created_at`
- No updated_at; append-only

### `feed_health_events`

- `id`, `data_source_id`, `import_run_id` nullable, `status`, `message`, `metrics` jsonb, `created_at`

### `source_takedown_requests`

- `id`, `data_source_id`, `listing_id` nullable, `requested_by`, `reason`, `status`, `resolved_by`, timestamps

## Enums

Reuse existing: `source_permission_status`, `image_rights`, `data_source_type`, `listing_operational_status`, `freshness_method`, `import_run_status`.

Add if needed: `geo_match_confidence`, `duplicate_band`, `duplicate_resolution_status`, `audit` via text + check, or dedicated enums in migration.

## Seeds (Phase 3)

1. Organization `demo-catalonia-agency` (slug)
2. Users + memberships for `org_owner` / `org_agent` (deterministic UUIDs for tests)
3. Platform `listing_reviewer` / `platform_admin` role bindings for test admin
4. Permission catalog rows and `role_permissions`
5. `data_sources` row `partner-csv-demo-catalonia` approved + `feed_configs` Spain Partner CSV v1 mapping
6. Keep legacy source restricted

## RLS (see security review)

- Enable policies for org-scoped partner access on listings, imports, snapshots, media writes
- Public browse policies unchanged
- Audit: admin all; partner SELECT where `organization_id` matches

## Migration plan

| Migration                   | Content                     |
| --------------------------- | --------------------------- |
| `0004_phase3_ingestion.sql` | New tables + column alters  |
| `0005_phase3_rls.sql`       | Org/admin policies          |
| Seed update                 | Demo org/source/permissions |

Commands remain `pnpm db:generate` / `db:migrate` / `db:seed` (ADR-019). **No `drizzle-kit push`.**

## Compatibility

- Legacy importer continues to work; does not require `organization_id`.
- Public search continues to filter `is_public_browseable`.
- Favourites remain listing-scoped; drafts not browseable ⇒ not favouritable via public APIs.

## Acceptance for schema work

- [ ] Fresh `test:db` migrate+seed creates demo org and approved CSV source.
- [ ] Unique `(data_source_id, external_listing_id)` still enforced.
- [ ] Two-org RLS tests pass after `0005`.
