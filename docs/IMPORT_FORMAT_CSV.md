# Spain Partner CSV v1 — import format

Date: 2026-08-05
Implements: [`INGESTION_ARCHITECTURE.md`](INGESTION_ARCHITECTURE.md), [`PHASE3_PLAN.md`](PHASE3_PLAN.md)
Code: `packages/ingestion/src/partner/{csv,schema,normalize,permission-gate,pipeline}.ts`

## Who can upload

Only a **source that already has an `approved`, non-expired** `data_sources.permission_status` may be imported (`assertSourceRunnable`, `docs/SOURCE_PERMISSION_MODEL.md`). The Phase 3 slice seeds exactly one such source: `partner-csv-demo-catalonia`, owned by the demo organization `demo-catalonia-agency`. The partner UI (`/[locale]/partner/imports`) and the `/api/v1/partner/imports` API resolve the calling user's organization and its single data source automatically; there is no multi-source picker in this slice.

## File shape

- UTF-8 CSV, comma-separated, RFC4180-ish (double-quoted fields, `""` escaping, embedded newlines inside quotes). Parser: `packages/ingestion/src/partner/csv.ts`.
- One row = one listing. The natural key is `(data_source_id, external_id)` — reimporting the same `external_id` **updates** the existing listing; it never creates a duplicate.
- Max upload size enforced by the API route: 5 MB.

## Columns

### Required

| Column          | Type            | Notes                                                   |
| --------------- | --------------- | ------------------------------------------------------- |
| `external_id`   | text            | Agency's own stable listing ID. Never invented.         |
| `title`         | text            |                                                         |
| `price_eur`     | positive number | Stored as `property_listings.price_amount` (EUR).       |
| `property_type` | text            | Mapped through `PARTNER_PROPERTY_TYPE_MAP` (see below). |
| `status`        | text            | Mapped through `PARTNER_STATUS_MAP` (see below).        |

A CSV missing any required **column** (header) fails the whole run with `missing_required_columns` — no rows are attempted. A row missing a required **value** is quarantined into `import_errors` (`validation_error`) and the rest of the batch continues.

### Optional

| Column              | Type                                                 | Notes                                                                                            |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `description`       | text                                                 |                                                                                                  |
| `currency`          | text                                                 | Defaults to `EUR` when blank.                                                                    |
| `bedrooms`          | non-negative integer                                 |                                                                                                  |
| `bathrooms`         | non-negative integer                                 |                                                                                                  |
| `built_area_sqm`    | positive number                                      | Also drives a recomputed `price_per_sqm`.                                                        |
| `environment_type`  | text                                                 | Mapped through `PARTNER_ENVIRONMENT_TYPE_MAP`; unmapped → warning, never fatal, field left null. |
| `municipality`      | text                                                 |                                                                                                  |
| `neighborhood`      | text                                                 |                                                                                                  |
| `address_text`      | text                                                 | Free text only; no invented coordinates.                                                         |
| `lat`, `lng`        | numeric                                              | Optional; stored as approximate unless `location_accuracy=exact`.                                |
| `location_accuracy` | `exact` \| `approximate` \| `area_only` \| `unknown` |                                                                                                  |
| `source_updated_at` | ISO 8601 timestamp                                   |                                                                                                  |
| `image_urls`        | `\|` or `;` separated URLs                           | See "Images" below — **not stored as authorized media in this slice.**                           |
| `features`          | `\|` or `;` separated tags                           |                                                                                                  |

### `property_type` mapping (case/accent-insensitive)

`apartment`/`flat`/`piso` → `apartment` · `penthouse`/`atico` → `penthouse` · `villa`/`chalet`/`detached_villa` → `villa` · `detached_house`/`casa_independiente` → `detached_house` · `semi_detached_house`/`casa_pareada` → `semi_detached_house` · `townhouse`/`casa_adosada` → `townhouse`. Any other value **quarantines the row** (`unmapped_property_type`).

### `status` mapping (case/accent-insensitive)

`available`/`for_sale`/`activo`/`en_venta` → `available` · `reserved`/`reservado` → `reserved` · `under_offer`/`en_oferta` → `under_offer` · `sold`/`vendido` → `sold` · `withdrawn`/`retirado` → `withdrawn`. Any other value **quarantines the row** (`unmapped_status`).

## What happens on import (see `INGESTION_ARCHITECTURE.md` for the full pipeline)

1. **Permission gate** — refuses to run unless the source is `approved` and unexpired.
2. **Snapshot** — the raw parsed rows are stored verbatim in `raw_snapshots` (sha256-addressed) before any transformation, linked to the `import_runs` row, for provenance/replay.
3. **Validate** (Zod) → **normalize** (property type / status / environment) → **persist**.
4. **New `external_id`**: inserted with `operational_status = 'pending_review'`, `is_public_browseable = false`, regardless of the CSV's own `status` column. A physical property, address, location, provenance row, one price-history entry, one status-history entry, and a placeholder media row are created. **An administrator must publish it** (`POST /api/v1/admin/listings/:id/publish`) before it is buyer-visible.
5. **Existing `external_id`, still pending admin review**: fields are refreshed, but the operational status stays `pending_review` — the CSV `status` column cannot bypass the first admin gate.
6. **Existing `external_id`, already published at least once**: the agency's own re-upload becomes self-service — the CSV's `status` column is applied directly (e.g. re-uploading with `status=sold` withdraws it from public browse; `available`/`reserved`/`under_offer` keep it browseable). A new price-history row is written only when the price actually changed.

## Quarantine / error codes (`import_errors.code`)

| Code                        | Meaning                                                  | Fatal to the row?                  |
| --------------------------- | -------------------------------------------------------- | ---------------------------------- |
| `missing_required_columns`  | CSV header is missing a required column                  | Fails the whole run                |
| `validation_error`          | Zod validation failed (missing/malformed required value) | Yes                                |
| `unmapped_property_type`    | `property_type` value not in the mapping table           | Yes                                |
| `unmapped_status`           | `status` value not in the mapping table                  | Yes                                |
| `unmapped_environment_type` | `environment_type` value not in the mapping table        | No — warning only, field left null |
| `persist_error`             | Unexpected DB error while writing a validated row        | Yes                                |

## Images

`image_urls` is parsed and currently **not persisted as authorized media** — the pipeline always writes a single `listing_media` placeholder row (`is_placeholder = true`). Publishing a listing does not grant hotlink/display rights to third-party URLs; see `docs/SOURCE_PERMISSION_MODEL.md` (`image_rights`) and [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md). No image is ever rendered in the buyer UI unless a future phase implements a rights-checked media pipeline.

## Fixtures and CLI

- `data/fixtures/partner/spain-partner-v1-valid.csv` — 6 valid demo listings (`DEMO-1001`..`DEMO-1006`).
- `data/fixtures/partner/spain-partner-v1-with-errors.csv` — a mix of valid and invalid rows exercising every quarantine code above.
- `pnpm db:import-partner-fixture` (env: `PARTNER_IMPORT_FILE`, `PARTNER_IMPORT_MODE` = `dry_run` \| `confirm`, `PARTNER_IMPORT_SOURCE_KEY`) runs the pipeline from the command line against the seeded demo source.

## Example row

```csv
external_id,title,price_eur,property_type,status,description,currency,bedrooms,bathrooms,built_area_sqm,environment_type,municipality,neighborhood,address_text,lat,lng,location_accuracy,source_updated_at,image_urls,features
DEMO-1001,Bright two-bedroom flat near Sagrada Familia,415000,apartment,available,Renovated apartment with balcony and lift.,EUR,2,1,72,city_center,Barcelona,Eixample,"Carrer de Mallorca, 401",41.4036,2.1744,approximate,2026-07-01T09:00:00Z,https://example.com/img/demo-1001-a.jpg|https://example.com/img/demo-1001-b.jpg,lift|balcony|air_conditioning
```
