# Geospatial data model

Date: 2026-08-07  
Status: Phase 5 planning  
Parent: [`PHASE5_PLAN.md`](PHASE5_PLAN.md) · ADR-031 · D27 / D29

## Purpose

Define Spain’s administrative and place geography for search, map display, enrichment, and provenance — without using free-text names as the sole key.

## Hierarchy

```text
Spain (country)
 └─ autonomous community
     └─ province
         └─ comarca (where applicable; optional FK)
             └─ municipality
                 └─ district (optional)
                     └─ neighborhood / locality
                         └─ postal code (may span areas)
                             └─ development / building (inventory-linked, optional)
```

### Rules

- Preserve **official geographic identifiers** (INE / IGN / equivalent) where available.
- Distinguish city vs municipality vs province vs autonomous community in UI and filters.
- Support **Catalan and Spanish** (and English display aliases) via `geo_aliases`.
- **Alcaraz** must remain under Castilla-La Mancha → Albacete (never Catalonia).
- Free-text labels are aliases or denormalized display fields only.

## Entity sketch

| Entity | Key fields |
| ------ | ---------- |
| `countries` | iso2, name |
| `autonomous_communities` | official_code, name, boundary, centroid, source, version |
| `provinces` | official_code, parent AC, boundary, centroid, source, version |
| `comarcas` | optional; parent province; boundary |
| `municipalities` | official_code, parent, boundary, centroid |
| `districts` | parent municipality; boundary optional |
| `neighborhoods` / localities | parent; boundary/centroid |
| `postal_codes` | code; optional multipolygon |
| `geo_aliases` | entity_type, entity_id, locale, alias, is_preferred |
| `geo_dataset_versions` | source, version, imported_at, notes |

Existing Phase 1/2 tables (`countries`, `autonomous_communities`, `provinces`, `municipalities`, `neighborhoods`, `geo_aliases`) are extended — not replaced.

## Geometry

- **Store** boundaries and points as PostGIS **`geometry`** with **SRID 4326** (`geometry(MultiPolygon,4326)`, `geometry(Point,4326)`).
- **GiST** spatial indexes on those columns.
- **Metre-based** distance, buffer, and length: cast to / compute with PostGIS **`geography`** (do not treat planar geometry metres as ground truth).
- Record `source` and `dataset_version` on every geometry-bearing row.
- Server-side simplification for large polygons served to the client (tolerance documented at impl).

## Property location link

`property_locations` (extended in Phase 5):

| Concept | Storage |
| ------- | ------- |
| Exact coordinates | Internal `geometry(Point,4326)`; never public unless policy = exact |
| Approximate / projected | Derived or stored display `geometry(Point,4326)` |
| Advertiser-provided | Source flag + raw point |
| Geocoded | Source = geocoder; confidence; quarantine until approved |
| Manually verified | Reviewer + timestamp |
| Admin FKs | municipality_id, neighborhood_id, postal_code_id, … |
| Precision / display_policy | Enums per [`LOCATION_PRIVACY_MODEL.md`](LOCATION_PRIVACY_MODEL.md) |
| last_verified_at | timestamptz |

**Do not invent coordinates.** Listings without reliable coords remain findable via administrative FKs / labels only.

## Places (generic)

Optional `places` table for named points/polygons used in commute destinations and amenity linking (category, name, `geometry` 4326, confidence, source).
## Provenance

Every geographic import records:

- provider / dataset name
- version or extract date
- license / permission reference
- import job id

## Seed and slice scope

- Retain existing Catalonia + Alcaraz seed correctness.
- Phase 5 first slice deepens **Barcelona metro** boundaries, aliases, and postal coverage as data rights allow.
- Nationwide full-resolution boundaries may land incrementally — not a single batch requirement for 5A.

## Out of scope

Fabricating legacy lat/lng; unlicensed boundary redistribution; treating `area_label` text as a stable geographic identity.
