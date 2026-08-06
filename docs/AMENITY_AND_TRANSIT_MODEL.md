# Amenity and transit model

Date: 2026-08-07  
Status: Phase 5 planning  
Parent: [`PHASE5_PLAN.md`](PHASE5_PLAN.md) · ADR-031 · D34

## Purpose

Model nearby amenities and transit stops for proximity search and property location context — using only permissioned data.

## Categories

### Transit

- metro
- FGC
- Rodalies / regional rail
- railway station
- bus stop
- airport

### Amenities

- hospital
- health centre
- school
- university
- supermarket
- park
- beach
- marina
- golf course
- town centre

## Place record

| Field | Notes |
| ----- | ----- |
| `external_source_id` | Stable ID from source system |
| `category` | Enum above |
| `name` | Display name (locale variants via aliases if needed) |
| `coordinates` | PostGIS `geometry(Point,4326)`; metre distance via geography cast |
| `source` | Dataset / provider |
| `freshness` / `last_seen_at` | Staleness tracking |
| `license_ref` | Permission reference |

## Property proximity

Derived rows (or on-read computation for slice 5A small volumes):

| Field | Notes |
| ----- | ----- |
| `listing_id` / `physical_property_id` | Link |
| `place_id` | Amenity/stop |
| `straight_line_distance_m` | PostGIS |
| `travel_mode` | Optional; only when routed |
| `travel_duration_s` | Optional; provider |
| `algorithm_version` | e.g. `prox.v1` |
| `calculated_at` | |

## Distance labeling

- Straight-line: label as **straight-line** / “as the crow flies”.
- Walking / driving / transit: only when produced by routing provider.
- Never present straight-line as walking or driving time.

## Data rights

- Avoid copying protected place catalogues without written permission.
- Barcelona-first open/licensed extracts only for Phase 5A.
- Nationwide amenity load is incremental and out of 5A one-shot scope.

## Denormalized listing columns

Existing `nearest_transit`, `beach_proximity`, `park_proximity`, `commute_min` may remain as cache/summary fields updated by enrichment — not as the system of record.

## Public API

`getNearbyAmenities` / location-context return public names, categories, straight-line distances (and routed times if available), never internal exact property coordinates beyond display policy.
