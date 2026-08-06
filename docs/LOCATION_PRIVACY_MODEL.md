# Location privacy model

Date: 2026-08-07  
Status: Phase 5 planning  
Parent: [`PHASE5_PLAN.md`](PHASE5_PLAN.md) · ADR-031 · D30

## Purpose

Ensure the public never receives more precise location than publication policy allows — across APIs, SSR, client state, map payloads, comparison shares, and future AI tools.

## Visibility levels

| Level | Public display |
| ----- | -------------- |
| `exact` | Exact coordinates (rare; explicit policy) |
| `building_approximate` | Jittered / building-scale |
| `street_approximate` | Street or block centroid |
| `neighborhood_centroid` | Neighborhood centroid |
| `municipality_centroid` | Municipality centroid |
| `hidden` | No map pin; admin geography label only |

**Default for public browse:** **approximate** (street-scale or coarser) unless exact publication is **explicitly authorized** for that listing.

## Coordinate classes (internal)

| Class | Meaning |
| ----- | ------- |
| Exact | True point on Earth for the property |
| Approximate | Intentionally reduced precision |
| Advertiser-provided | Partner-supplied; may be exact or area |
| Geocoded | Derived from address; gated by confidence |
| Manually verified | Human-confirmed |

Internal storage may hold exact points for enrichment and agency tools under RLS. Public paths **must** call `projectPublicLocation`.

## Projection rules

1. Load listing location + `display_policy` / precision.
2. If `hidden` → omit coordinates; return area label only.
3. If not `exact` → return projected point only (never both exact and display).
4. Strip exact fields from any public JSON serializer.
5. Phase 4C `PublicComparisonDto` continues to use `areaLabel` / approved precision only — no lat/lng.

## Leakage surfaces (must test)

| Surface | Requirement |
| ------- | ----------- |
| `GET /api/v1/properties` / detail | Projected only |
| Map marker payloads | Projected only |
| SSR HTML / `__NEXT_DATA__` | No exact coords when forbidden |
| Client React state | No exact stash for anon/public |
| Phase 4C shared comparison | No exact coords |
| Future AI tools | Same projector |
| Logs | Do not log exact coords for public requests |

## Agency / admin

Partner and admin UIs may show exact coordinates for **own-org** listings when authorized. Cross-org and anon: deny.

## Properties without coordinates

- Remain in text / hierarchy search.
- Do **not** place a pin at a fake location.
- Optional map UX: “Location approximate / unavailable” in list; excluded from marker layer or shown only at coarse admin centroid if policy allows and centroid is not misleadingly labeled as exact.

## Disclosure UI

Show location-confidence indicator and short copy when approximate (i18n keys). Never imply pin precision higher than policy.
