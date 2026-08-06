# Phase 5 database changes — Geospatial / map search

Date: 2026-08-07  
Status: Phase 5 planning (migrations not applied)  
Parent: [`PHASE5_PLAN.md`](PHASE5_PLAN.md) · After Phase 4C migrations `0011` / `0012`

## Migration naming (illustrative)

| Migration | Purpose |
| --------- | ------- |
| `0013_phase5_geospatial_core.sql` | Geometry (4326) columns, GiST indexes, property location enrichment |
| `0014_phase5_amenities_env.sql` | Amenities, transit, classifications, proximity |
| `0015_phase5_commute_rls.sql` | Commute tables + RLS |

Exact filenames follow package migrator convention at implementation time.

## Extend existing geography

- Add `boundary geometry(MultiPolygon,4326)`, `centroid geometry(Point,4326)`, `official_code`, `source`, `dataset_version` to AC/province/municipality/neighborhood as needed.
- New optional: `comarcas`, `districts`, `postal_codes`.
- Populate / use `geo_aliases` (locale, alias, entity FK).
- `geo_dataset_versions` for import provenance.
- Metre distances: `geom::geography` (or equivalent) in queries — not planar geometry metres.

## `property_locations` (extend)

| Column / concept | Notes |
| ---------------- | ----- |
| `geom` | `geometry(Point,4326)` exact/internal |
| `display_geom` | optional stored projection `geometry(Point,4326)` |
| `latitude` / `longitude` | retain numeric mirrors |
| `coordinate_source` | advertiser / geocoded / manual / … |
| `confidence` | numeric or enum |
| `precision_category` | visibility-related |
| `display_policy` | existing + align to privacy levels; public default **approximate** unless exact authorized |
| `last_verified_at` | timestamptz |
| `geocode_status` | pending / approved / quarantined / rejected |
| Admin FKs | municipality, neighborhood, postal_code, … |

**GiST** indexes on `geom` / `display_geom`.
## New tables (illustrative)

### `environmental_classifications`

physical_property_id, code, origin, source, method, distance_m, confidence, algorithm_version, calculated_at.

### `amenities` / `transport_stops`

external_source_id, category, name, geom, source, freshness, license_ref.

### `property_place_distances`

property/listing link, place_id, straight_line_distance_m, travel_mode nullable, travel_duration_s nullable, algorithm_version, calculated_at.

### `geocode_jobs` / `geocode_reviews`

address snapshot, provider results jsonb, confidence, status, reviewer_id, timestamps.

### `commute_destinations`

user_id, label, kind, `geometry(Point,4326)` or encrypted/restricted payload for sensitive destinations, precision, mode defaults, soft-delete.  
**Private:** owner RLS **and** encryption at rest **or** equivalent access restriction so agencies and other buyers cannot read destinations.

### `commute_profiles` (optional)

user_id, name, destination_ids[], is_default. Same privacy class as destinations.

### Spatial criteria on saved searches

Criteria jsonb holds `phase5.v1` including **versioned GeoJSON** for drawn areas; query path validates and materializes PostGIS `geometry(...,4326)`. Optional generated columns later for indexed viewport hashes — deferred unless needed.

## RLS catalogue (planned)

| Policy theme | Rule |
| ------------ | ---- |
| Geography reference | Public read for published hierarchy metadata |
| `property_locations` exact | Not anon-readable as raw exact; public via projected views/service |
| Amenities / stops | Public read of non-sensitive place catalogues |
| Classifications | Public read of published classification rows |
| `commute_destinations` / profiles | Owner only; encrypted or access-restricted; **no agency** |
| `geocode_reviews` | Platform roles only |
| Agency exact address | Org-scoped as today for partner inventory |

Service-role: enrichment workers, geocode queue, after API auth for public map resolve (same class as property browse).

## Grants

- Anon/authenticated: SELECT on public geography and projected listing location paths only.
- No anon SELECT of raw exact `property_locations.geom` when policy is approximate/hidden — enforce via view or service-role projection.

## Relation to sketches

Supersedes vague M05 “schema; data later” with Phase 5 Barcelona-first populate plan. Does not invent legacy coordinates.
