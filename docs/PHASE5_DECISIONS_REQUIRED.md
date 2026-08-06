# Phase 5 — Decisions required (and locked)

Date: 2026-08-07  
Status: Planning — decisions locked for documentation; implementation awaits approval  
Parent: [`PHASE5_PLAN.md`](PHASE5_PLAN.md) · ADR-031

## Already locked (do not re-open)

| ID      | Topic            | Lock                                                                 |
| ------- | ---------------- | -------------------------------------------------------------------- |
| ADR-016 | Database         | Supabase PostgreSQL with PostGIS                                     |
| ADR-017 | Provider isolation | UI does not call map/geocode SDKs directly — adapters only         |
| ADR-022 | Phase 3/4 renumber | Live inventory = 3; buyer workspace = 4 (unchanged)                |
| ADR-027 | Jobs             | Inline/test runners for MVP; durable queue deferred                  |
| ADR-029 | Sessions         | Verified sessions for `/me/*`; never trust `x-user-id`               |
| ADR-030c | 4C shares       | Public comparison DTO never exposes exact/hidden coordinates         |
| Seed    | Alcaraz          | Under Castilla-La Mancha → Albacete — never Catalonia                |

## Locked in this planning slice (ADR-031)

### D25 — Phase number for maps

- Phase **5** = Map Search and Geospatial Intelligence.
- Former Phase 5 (Website AI chat) moves to **Phase 6+**.
- Omnichannel WhatsApp / voice / telephone remain later than AI chat.
- Absorbs deferred Phase 2 map UX and former Phase 6 commute/amenity enrichment into Phase 5 scope.

**Owner:** Product / Architecture — **locked**.

### D26 — Map client and tiles

- Client: **MapLibre GL JS**.
- Dev tiles: OSM/demo via tile adapter.
- Production licensed tiles: **TBD** at implementation (do not hardcode a single commercial vendor in domain code).
- Non-map list/card/table views remain fully usable without the map.
- Map marker responses use a **minimal `MapMarkerDto`**, never full property records.

**Owner:** Engineering — **locked** (client); Product ack for prod tile vendor.

### D27 — Spatial storage and distance

- **Storage:** PostGIS **`geometry`** columns with **SRID 4326** (points and multipolygons).
- **Metre-based distance / buffer / length:** compute via PostGIS **`geography`** (cast or dual column as needed) so great-circle metres are correct.
- Retain numeric lat/lng mirrors for ingestion compatibility where useful.
- **GiST** spatial indexes on geometry columns; bounding-box prefilters before expensive predicates.

**Owner:** Engineering — **locked**.

### D28 — Saved-search criteria version

- New envelope **`phase5.v1`** extends `phase4b.v1` with optional spatial block (viewport, radius, polygon, rectangle, travel-time zone, hierarchy entity IDs).
- Fail-closed matching when spatial facts are missing.
- Existing `phase4b.v1` rows remain valid (spatial absent = no spatial filter).
- **Drawn-area persistence:** store **versioned GeoJSON** in criteria jsonb **plus** a validated PostGIS `geometry(Polygon,4326)` (or equivalent) at query/validation time — never trust client GeoJSON alone.

**Owner:** Engineering — **locked**. Spec: [`SAVED_SEARCH_CRITERIA_SPEC.md`](SAVED_SEARCH_CRITERIA_SPEC.md).

### D29 — First vertical slice geography

- Focus: **Barcelona metropolitan** published listings with reliable coordinates.
- Hierarchy correctness seed (Alcaraz) retained.
- **No** fabricated coordinates for legacy snapshot rows.
- Legacy without coords: searchable by administrative geography only; never shown as false exact pins.

**Owner:** Product — **locked**.

### D30 — Location privacy defaults

- Public default display: **approximate** unless listing publication policy explicitly allows exact.
- Visibility levels: `exact` | `building_approximate` | `street_approximate` | `neighborhood_centroid` | `municipality_centroid` | `hidden`.
- Exact/hidden coordinates never appear in public APIs, SSR HTML, client state, map payloads, Phase 4C shares, or future AI tools.
- Projection via a dedicated server mapper only.

**Owner:** Privacy / Engineering — **locked**. Spec: [`LOCATION_PRIVACY_MODEL.md`](LOCATION_PRIVACY_MODEL.md).

### D31 — Draw-area limits and storage

- Max **100** vertices per polygon.
- Max geographic extent: bounding-box diagonal ≈ **50 km**.
- Bounds: Spain mainland + Balearic + Canary (documented envelope).
- Reject invalid geometry, self-intersection, wrong winding, oversized payloads.
- Persist drawn areas as **versioned GeoJSON** (criteria jsonb) **and** validate/normalize to PostGIS **`geometry(...,4326)`** before query.
- Validate with PostGIS.

**Owner:** Engineering / Security — **locked**.

### D32 — Routing / geocoding providers

- Domain uses a **provider-neutral** adapter (`RoutingProvider` / `GeocodingProvider`).
- Local and CI: **mocked** `FakeRoutingProvider` / `TestRoutingProvider` (deterministic).
- One real adapter may be stubbed behind the interface; keys **server-side only**.
- Never label straight-line distance as walking or driving.

**Owner:** Engineering — **locked**. Spec: [`ROUTING_PROVIDER_INTERFACE.md`](ROUTING_PROVIDER_INTERFACE.md).

### D33 — Environmental classifications

- **Calculated**, **explainable**, and **versioned** (algorithm version + method provenance on every row).
- Deterministic outputs for the same inputs + version.
- **Sea view** only when advertiser-declared (or equivalent authorized source) — never inferred from coast proximity alone.

**Owner:** Product / Data — **locked**. Spec: [`ENVIRONMENT_CLASSIFICATION_SPEC.md`](ENVIRONMENT_CLASSIFICATION_SPEC.md).

### D34 — Amenities and enrichment scope

- Barcelona-first enrichment batch; nationwide one-shot enrichment **out of scope**.
- Only permissioned / licensed / approved open data.
- No copying protected place catalogues without rights.

**Owner:** Legal / Data — **locked** (principle); specific licenses need product ack before populate.

### D35 — Commute profiles

- Private buyer data; **encrypted at rest and/or access-restricted** so agencies and other buyers have **no** SELECT / decrypt path.
- Guest → account merge (same pattern as Phase 4B).
- Travel-time filters use provider estimates when available; Fake / Test provider in local and CI.

**Owner:** Product / Privacy — **locked**.

### D36 — Geocoding publication

- Low-confidence or ambiguous geocodes enter **quarantine** for manual review.
- Do **not** auto-publish low-confidence results as map pins.
- Preserve original address; record geocoder source and timestamp.
- **Never invent** coordinates for legacy rows that lack them.

**Owner:** Engineering — **locked**.

### D37 — Jobs for enrichment

- Enrichment may use **inline** or scheduled seams under ADR-027 for the Barcelona slice.
- Durable queue (pg-boss etc.) remains deferred unless volume forces an ADR amendment.

**Owner:** Engineering — **locked**.

### D38 — Search-engine indexing of map queries

- Public map/search URLs use a **controlled set of canonical URLs** (hierarchy place pages, named areas, stable query shapes).
- Do **not** allow crawlers to index unlimited geometry variations (arbitrary polygons, viewports, drawn areas).
- Drawn-area and freeform spatial query pages: **`noindex`** (or equivalent) unless product later defines a curated canonical.
- Prefer `rel=canonical` toward place/hierarchy URLs when content overlaps.

**Owner:** Product / SEO / Engineering — **locked**.

## Residual product acknowledgements (not blocking planning)

| Topic | Note |
| ----- | ---- |
| Production map tile vendor | Choose before prod launch |
| Amenity / transit data licenses | Approve sources before populate |
| Real routing provider (Mapbox / Google / OpenRouteService / etc.) | Adapter behind interface; pick at impl |
| Commute UI in slice 5A vs 5B | Plan documents both; 5A can ship map+polygon+privacy first |

## Sign-off

Phase 5 **planning** may proceed with D25–D38 locked. Implementation requires explicit approval after docs land. **No application code in this planning slice.**
