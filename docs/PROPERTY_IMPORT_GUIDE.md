# Property import guide — legacy Barcelona 60

## Source

- File: `data/legacy/barcelona_property_explorer_legacy_60.json`
- Registry key: `legacy-barcelona-explorer-60`
- Type: `legacy_snapshot`
- Permission: `restricted`
- Image rights: `none`

## How to run

```bash
docker compose up -d db
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/spain_properties
pnpm db:migrate
pnpm db:seed
pnpm db:import-legacy
```

The importer is idempotent: a second run updates existing rows keyed by `(data_source_id, external_listing_id)` and does not create duplicates.

Invalid records are quarantined into `import_errors` without aborting the batch. A structured report is stored on `import_runs.report` and printed by the CLI.

## Field mapping

| Legacy field      | Stored as                               | Notes                                   |
| ----------------- | --------------------------------------- | --------------------------------------- |
| `id`              | `property_listings.external_listing_id` | String form                             |
| `title`           | listing title + source claim            |                                         |
| `url`             | `source_url` + provenance               | Preserved exactly; may be a search page |
| `portal`          | `portal_name` + claim                   | Not a partnership                       |
| `area`            | `area_label` / location label           | No invented coordinates                 |
| `price`           | `price_amount` + price history          | EUR                                     |
| `bedrooms`        | listing + provisional physical          |                                         |
| `size_sqm`        | `built_area_sqm`                        |                                         |
| `price_per_sqm`   | `price_per_sqm`                         | Also recomputed for QA                  |
| `address`         | address free text                       | Approximate                             |
| `nearest_transit` | claim / listing text                    | Not a stop FK                           |
| `commute_min`     | listing field                           | Nullable                                |
| `beach_proximity` | listing; `N/A` → null                   |                                         |
| `park_proximity`  | listing text                            |                                         |
| `property_type`   | raw + normalized key                    | See mapping table in importer           |
| `category`        | `environment_type`                      | city_center / coastal / hillside        |

## Unavailable (not invented)

- Bathrooms
- Authorized photographs / media assets
- Exact coordinates
- Energy rating
- Live availability / sold status
- Agency partnership or media republication rights

## Why `legacy_snapshot`

These rows are a frozen demo extract. They must not be described as live, verified, or currently available. UI shows a snapshot badge and freshness warning. `last_confirmed_available_at` remains null.

## Future live agency feed

A permitted partner feed will register a new `data_sources` row with approved permission and image rights. New listings upsert under that source. Matching engines may later attach multiple listings to one `physical_properties` row. Snapshot rows remain labelled until rights/freshness review (D-019) explicitly clears them or they are superseded/withdrawn.
