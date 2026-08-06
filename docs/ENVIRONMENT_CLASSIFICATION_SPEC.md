# Environment classification specification

Date: 2026-08-07  
Status: Phase 5 planning  
Parent: [`PHASE5_PLAN.md`](PHASE5_PLAN.md) · ADR-031 · D33

## Purpose

Define **calculated**, **explainable**, and **versioned** environmental classifications for Spanish property discovery. Every value carries provenance, an algorithm version, and a human-readable explanation key.

## Taxonomy (initial)

| Code | Notes |
| ---- | ----- |
| `coastal` | Within configured distance of coastline layer |
| `beachfront` | Stricter coastal / beach adjacency threshold |
| `sea_view` | **Advertiser-declared only** — never inferred from coast proximity |
| `near_beach` | Distance-to-beach amenity threshold |
| `mountain` | Terrain / elevation layer rules |
| `hillside` | Slope / terrain class |
| `mountain_top` | Only when evidence supports (elevation + relief rules) |
| `valley` | Terrain class |
| `river` / `lake` / `forest` | Proximity to respective layers |
| `rural` / `village` / `town` / `urban_centre` | Settlement classification |
| `marina` / `golf` / `island` | Proximity or admin flags |
| `protected_natural_area` | Proximity to protected polygons |

Existing listing `environment_type` (`city_center` \| `coastal` \| `hillside`) remains a coarse denormalized signal; Phase 5 classifications are richer and provenance-backed.

## Record shape

For each classification on a physical property / listing:

| Field | Required |
| ----- | -------- |
| `value` / code | Yes |
| `source` | Yes (dataset or advertiser) |
| `calculation_method` | Yes |
| `distance_m` or threshold | When applicable |
| `confidence` | Yes (0–1 or enum) |
| `calculated_at` | Yes |
| `algorithm_version` | Yes (e.g. `env.v1`) |
| `origin` | `advertiser_declared` \| `platform_calculated` |

## Sea view rule (hard)

- Do **not** set `sea_view` merely because a property is coastal or near a beach.
- Accept only advertiser-declared / authorized listing attributes (or future verified photo review — out of 5A).

## Algorithm versioning

- Bump `env.vN` when thresholds or layers change.
- Re-enrichment jobs stamp new version; UI may show “method updated” if product requires.

## Explainability

Public UI shows human-readable explanation keys (distance threshold, layer name) without exposing internal exact coordinates beyond policy.

## Out of scope

Inferring lifestyle tags via AI; publishing classifications without a version stamp.
