# Phase 5 acceptance criteria — Map search and geospatial

Date: 2026-08-07  
Status: Phase 5 planning (gates for future implementation)  
Parent: [`PHASE5_PLAN.md`](PHASE5_PLAN.md)

## Product / map UX

- [ ] MapLibre map available on search with list/card/table alternatives
- [ ] Map ↔ list selection synchronization works
- [ ] Clustering works at city zoom; expand/zoom on cluster click
- [ ] “Search this area” applies viewport filter
- [ ] Draw polygon: create, edit, clear; combines with ordinary filters
- [ ] Drawn area can be saved and reopened via saved search (`phase5.v1`)
- [ ] Mobile fullscreen map works; desktop split view works
- [ ] Loading and error states visible
- [ ] en / es / ca / ar + Arabic RTL usable
- [ ] Basic property access works with map disabled / list-only

## Geography and coordinates

- [ ] Hierarchy filters use entity IDs / official codes, not free-text alone
- [ ] Catalan and Spanish aliases resolve (typeahead)
- [ ] Alcaraz remains under Castilla-La Mancha → Albacete
- [ ] No fabricated coordinates for legacy listings
- [ ] Listings without coords searchable by admin geography; no false exact pin

## Privacy

- [ ] Public default display is approximate unless exact publication is explicitly authorized
- [ ] Public markers respect display policy / visibility level
- [ ] Exact coords absent from public APIs, SSR, client state when forbidden
- [ ] Map marker payloads are minimal DTOs (not full property records)
- [ ] Phase 4C shares still exclude exact coordinates
- [ ] Hidden listings do not expose map pins or exact address

## Environment / amenities / distance

- [ ] Classifications are calculated, explainable, and versioned (source, method, confidence, algorithm version)
- [ ] Sea view never inferred from coast proximity alone
- [ ] Nearby transit/amenities show straight-line labeled correctly
- [ ] Routed times labeled as walking/driving/transit only when provider-backed
- [ ] Metre distances use PostGIS geography (not planar geometry metres)

## Commute

- [ ] Buyer can create destinations and apply max commute filter
- [ ] Destinations are private: encrypted and/or access-restricted; agency cannot list another user’s destinations
- [ ] Guest→auth merge preserves destinations when eligible

## Providers / geocoding

- [ ] Provider-neutral adapter with Fake/Test (mocked) providers in local, CI, and Playwright
- [ ] Low-confidence geocodes quarantine; not auto-published as pins
- [ ] Provider keys not in client bundles
- [ ] Never invent coordinates for legacy missing coords

## Storage / indexing

- [ ] Searchable shapes stored as PostGIS `geometry` SRID 4326 with GiST indexes
- [ ] Drawn areas persist as versioned GeoJSON + validated PostGIS geometry
- [ ] Map search SEO uses controlled canonical URLs; freeform geometry variants are not indexed

## Performance (warm targets)

- [ ] Initial markers p95 &lt; 1.5 s (documented environment)
- [ ] Cluster refresh after debounce p95 &lt; 800 ms
- [ ] Location context p95 &lt; 1 s

## Tests

### Unit / integration

- [ ] Point-in-polygon, radius, boundary assignment
- [ ] Coordinate precision / hidden leakage
- [ ] Polygon validation and geometry limits
- [ ] Environment classification rules (incl. sea view)
- [ ] Distance unit / label tests
- [ ] Route provider adapter + cache
- [ ] Saved geographic search serialize/parse `phase5.v1`
- [ ] Guest merge commute
- [ ] RLS owner isolation + agency deny + anon projection

### Playwright (required journey)

1. Buyer opens Barcelona search  
2. Switches to map  
3. Pans and chooses “search this area”  
4. Draws a polygon  
5. Filters to coastal or near-beach listings  
6. Selects a property  
7. Views nearby transport and amenities  
8. Creates a commute destination  
9. Applies a maximum commute filter  
10. Saves the geographic search  
11. Signs out and signs back in  
12. Saved map criteria and private commute profile persist  

Use **mocked** provider responses throughout.

## Docs / status

- [ ] Implementation updates `IMPLEMENTATION_STATUS.md` when code ships
- [ ] RLS catalogue updated when migrations land

## Current phase status

**Planning complete. Implementation not started.** No acceptance item above is claimed done until Phase 5 code ships.
