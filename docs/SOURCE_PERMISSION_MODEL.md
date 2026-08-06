# Source permission model — Phase 3

Date: 2026-08-05  
Status: Planning  
Related: [`EXTERNAL_SERVICES.md`](EXTERNAL_SERVICES.md) §6, [`PHASE3_PLAN.md`](PHASE3_PLAN.md), [`PHASE3_SECURITY_REVIEW.md`](PHASE3_SECURITY_REVIEW.md)

## Purpose

Every inventory byte that can become a public listing must be attributable to a **registered data source** with an explicit **permission status** and **image rights** posture. The source manager prevents jobs and publication when permission is insufficient.

## Registry entities

### `data_sources` (exists — extend)

| Field               | Role                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| `source_key`        | Stable id (`partner-csv-demo-catalonia`)                                               |
| `name`              | Human label                                                                            |
| `source_type`       | `csv` / `json` / `xml` / `api` / `manual` / `legacy_snapshot` / `authorized_crawl` / … |
| `permission_status` | `pending` / `approved` / `restricted` / `suspended` / `expired`                        |
| `image_rights`      | `none` / `hotlink_only` / `display` / `download_and_transform`                         |
| `organization_id`   | Owning agency/developer (nullable for platform legacy)                                 |
| `notes`             | Human context                                                                          |

### Planned additions

| Entity                     | Purpose                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| `feed_configs`             | Format, mapping JSON, schedule, full-vs-incremental, dry-run defaults |
| `source_endpoints`         | Optional HTTPS endpoints (never scrape); auth secret refs             |
| `source_permission_events` | Append-only history of permission/rights changes                      |
| `source_takedown_requests` | Partner/admin takedown workflow (Phase 3 schema; UI minimal)          |
| `feed_health_events`       | Success/failure metrics for dashboards                                |

## Permission statuses

| Status       | May run import job?                   | May newly publish to public browse? | Notes                                                                                                      |
| ------------ | ------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pending`    | No                                    | No                                  | Default for unnamed partners                                                                               |
| `approved`   | Yes                                   | Yes (after review rules)            | Demo CSV seed                                                                                              |
| `restricted` | Snapshot-only exception for legacy 60 | No as live                          | Legacy labelling required                                                                                  |
| `suspended`  | No                                    | No                                  | Temporary block                                                                                            |
| `expired`    | No                                    | No                                  | Prevents **new** publication; existing public rows need admin policy (default: freeze edits, queue review) |

### Gate rule (normative)

```text
assertSourceRunnable(source):
  if source.permission_status != approved:
    if source.source_key == legacy-barcelona-explorer-60 AND mode == legacy_snapshot_import:
      allow
    else deny
  if source.permission_status == expired or suspended: deny
```

## Image rights

| Rights                   | Store copy in Supabase/local storage? | Show in gallery?                                                                            |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `none`                   | No                                    | Placeholder only                                                                            |
| `hotlink_only`           | No                                    | Only if product policy allows hotlink (Phase 3 default: **no** public hotlink; placeholder) |
| `display`                | Yes (after malware scan)              | Yes when listing published                                                                  |
| `download_and_transform` | Yes + derivatives                     | Yes                                                                                         |

Partner CSV `image_urls` are ignored for storage when rights are `none` or `hotlink_only`.

## Seed / register rows (Phase 3)

| source_key                     | permission                     | Slice role                 |
| ------------------------------ | ------------------------------ | -------------------------- |
| `legacy-barcelona-explorer-60` | `restricted`                   | Unchanged Phase 2 snapshot |
| `manual-editor`                | `pending` → approve when ready | Manual entry path          |
| `partner-csv-generic`          | `pending`                      | Framework placeholder      |
| `partner-xml-json-generic`     | `pending`                      | Fixture adapters only      |
| `authorized-crawl-placeholder` | `pending`                      | **No extractor**           |
| `partner-csv-demo-catalonia`   | `approved` (seed)              | Vertical slice             |

## Approval workflow

1. Platform admin creates/edits source + feed config.
2. Legal/owner confirms written permission (recorded in notes + attachment ref outside DB if needed).
3. Admin sets `permission_status=approved` → `source_permission_events` + `audit_events`.
4. Org members may run imports for sources linked to their `organization_id`.
5. Expiry date (planned column `permission_expires_at`) triggers job denial and admin alert.

## Takedown

- Partner or admin files `source_takedown_requests`.
- On approve: withdraw affected public listings; suspend source if required; audit.

## Prohibitions

- No Idealista/Fotocasa scrapers as “sources”.
- No inventing permission from a URL found in legacy data.
- No treating `restricted` legacy rows as live inventory.

## Acceptance

- [ ] Expired/suspended/pending sources cannot publish new public listings.
- [ ] Demo CSV source runs end-to-end under `approved`.
- [ ] Every permission change is audited.
- [ ] Image pipeline respects `image_rights`.
