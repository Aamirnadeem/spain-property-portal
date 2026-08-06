# Map search architecture

Date: 2026-08-07  
Status: Phase 5 planning  
Parent: [`PHASE5_PLAN.md`](PHASE5_PLAN.md) · ADR-031 · D26 / D28

## Purpose

Describe how MapLibre, typed backend services, and DTOs deliver synchronized map/list property discovery without exposing spatial tables to the browser.

## Client

- **MapLibre GL JS** for interactive map.
- Tile URL/style via **tile adapter** (dev: OSM/demo; prod: licensed vendor TBD).
- Views: map + list split, map fullscreen (mobile), list/card/table without map.
- Map is never required for basic property access.

### Synchronization

| User action | System response |
| ----------- | --------------- |
| Select result card | Highlight corresponding marker; pan if off-screen |
| Select marker | Highlight list item; scroll into view |
| Pan/zoom | Debounced (300 ms) optional auto-refresh or explicit “Search this area” |
| Draw polygon | Validate client-side hints; authoritative validation on server |
| Clear draw | Remove geometry filter; re-run last criteria |

### Clustering

- Prefer server-assisted clusters for dense viewports (`getMapClusters`) with client MapLibre cluster fallback for small result sets.
- Cluster click zooms or expands spider/list.

## DTOs

### `MapMarkerDto` (minimal — not full property records)

- `listingId`
- `displayLat`, `displayLng` (projected only)
- `precision` (public visibility level)
- `priceAmount` (optional badge)
- `status` / freshness cue
- **No** exact hidden coordinates, notes, buyer identity, full address, full listing payload

### `ListingCardDto`

Existing card fields + optional `environmentTags` / proximity summaries that are already public.

### `PropertyLocationContextDto`

- Displayed location label at approved precision
- Confidence / disclosure copy keys
- Nearby amenities (public)
- Transport summary
- Environmental classifications with explanation keys
- Source attribution where required

Never include raw exact coordinates when policy forbids.

## Services

Implemented in `@spain/database` / `@spain/search` (names locked in plan):

- `searchPropertiesByMap`
- `searchPropertiesWithinGeometry`
- `searchPropertiesNearPoint`
- `getMapClusters`
- `getPropertyLocationContext`
- `projectPublicLocation` (shared by map, detail, Phase 4C)

Query path: criteria → bbox prefilter → PostGIS predicate on `geometry` 4326 (metre calcs via `geography`) → privacy projection → minimal marker DTO.

## Criteria (`phase5.v1`)

Extends `phase4b.v1` with optional:

```typescript
spatial?: {
  hierarchyIds?: { autonomousCommunityId?: string; provinceId?: string; municipalityId?: string; /* … */ };
  viewport?: { west: number; south: number; east: number; north: number };
  radius?: { lat: number; lng: number; meters: number };
  polygon?: GeoJSON.Polygon;      // WGS84
  rectangle?: { west: number; south: number; east: number; north: number };
  travelTime?: { destinationId?: string; mode: 'walk'|'drive'|'transit'; maxMinutes: number };
};
```

Fail-closed when spatial filter present but listing lacks usable projected/admin geography.

## APIs

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/api/v1/properties/map` | Markers/clusters; rate-limited |
| POST | `/api/v1/properties/within` | Polygon/rectangle body |
| GET | `/api/v1/properties/{id}/location-context` | Public projection |
| GET | `/api/v1/geography/search` | Hierarchy typeahead |
| GET | `/api/v1/geography/areas/{id}` | Area metadata (no secrets) |

All mutations for commute/saved search remain under `/api/v1/me/*` with CSRF.

## Performance

| Operation | Warm p95 target |
| --------- | --------------- |
| Initial markers | &lt; 1.5 s |
| Cluster refresh (after 300 ms debounce) | &lt; 800 ms |
| Location context | &lt; 1 s |

Controls: **GiST** indexes; result limits; viewport paging; request cancellation; marker responses stay minimal DTOs (never full property records); server geometry simplification.

## Search-engine indexing (map queries)

- Index only a **controlled set of canonical URLs** (hierarchy place pages, curated named areas, stable query shapes).
- Do **not** index unlimited geometry variations (arbitrary polygons, viewports, drawn areas).
- Freeform / drawn-area result URLs: **`noindex`** (or equivalent) unless product later promotes a curated canonical.
- Prefer `rel=canonical` toward place/hierarchy URLs when content overlaps.

## Accessibility

- Full list/card/table mode without map.
- Keyboard operable draw tools where feasible; clear non-pointer path to apply geographic filters via hierarchy selectors.
- Announce loading/error via live regions.

## Locales

en / es / ca / ar with Arabic RTL layout for split view and panels.
