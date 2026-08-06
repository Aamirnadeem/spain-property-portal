# Phase 5 security review — Map / geospatial

Date: 2026-08-07  
Status: Phase 5 planning (pre-implementation threat model)  
Parent: [`PHASE5_PLAN.md`](PHASE5_PLAN.md) · [`LOCATION_PRIVACY_MODEL.md`](LOCATION_PRIVACY_MODEL.md)

## Scope

Threats specific to map search, geometry queries, routing/geocoding providers, and location privacy. Assumes Phase 3.1 sessions and Phase 4 workspace controls remain intact.

## Threat catalogue

### B-geo-01 — Expensive geometry DoS

**Risk:** Huge polygons or pathological geometries burn CPU.  
**Mitigation:** Max 100 vertices; ~50 km extent; Spain bounds; request size caps; rate limits; PostGIS validity checks; statement timeouts.  
**Residual:** Distributed slow queries — edge WAF later.

### B-geo-02 — Coordinate leakage

**Risk:** Exact coords in API, SSR, markers, shares, logs.  
**Mitigation:** Mandatory `projectPublicLocation`; allowlist DTOs; Phase 4C unchanged; leakage tests.  
**Residual:** Mis-implementation — gate with acceptance + Playwright.

### B-geo-03 — Provider key exposure

**Risk:** Tile/geocode/routing keys in client bundles.  
**Mitigation:** Server-only env; UI uses first-party APIs; ADR-017.  
**Residual:** None if adapters stay server-side.

### B-geo-04 — Unauthenticated quota abuse

**Risk:** Anon floods routing/geocode.  
**Mitigation:** Per-IP rate limits; Fake provider in tests; quota errors.  
**Residual:** Botnets — CDN/WAF later.

### B-geo-05 — Geometry injection

**Risk:** Malformed GeoJSON / SQL injection via geometry text.  
**Mitigation:** Parsed GeoJSON → parameterized PostGIS (`ST_GeomFromGeoJSON` with binds); never string-concat SQL.  
**Residual:** Parser bugs — fuzz tests recommended.

### B-geo-06 — Cross-user commute access

**Risk:** User A reads User B destinations.  
**Mitigation:** Owner RLS; destinations **encrypted or access-restricted**; session-bound APIs; integration tests.  
**Residual:** Service-role misuse — restrict to enrichment only.

### B-geo-07 — Hidden address disclosure

**Risk:** Exact address or pin when policy is hidden/approximate.  
**Mitigation:** Display policy on every public path; strip `addressText` when policy requires.  
**Residual:** Partner data quality — review tools.

### B-geo-08 — Poisoned geocoding

**Risk:** Low-confidence geocode published as exact pin.  
**Mitigation:** Quarantine + manual review; confidence thresholds; no auto-publish.  
**Residual:** Reviewer error — audit trail.

### B-geo-09 — Agency visibility into buyer commute

**Risk:** Agency SELECT / decrypt on commute tables.  
**Mitigation:** No agency policies; encryption or access restriction; deny tests.  
**Residual:** Superuser ops — operational control.

### B-geo-10 — Tile / attribution ToS breach

**Risk:** Wrong tile usage or missing attribution.  
**Mitigation:** Tile adapter + attribution UI; prod vendor ack.  
**Residual:** License change — monitor.

### B-geo-11 — CSRF on commute / save spatial search

**Risk:** Cross-site create destination.  
**Mitigation:** Same-site session + CSRF on mutations.  
**Residual:** None unique to Phase 5.

### B-geo-12 — Enumeration of exact locations via many approximate samples

**Risk:** Statistical recovery of exact points.  
**Mitigation:** Stable projection per listing (not random each request); coarse levels by default; public default approximate unless exact authorized.  
**Residual:** Inherent at exact policy — rare.

### B-geo-13 — Search-engine indexing of unlimited map geometries

**Risk:** Crawlers index infinite polygon/viewport URL variants.  
**Mitigation:** Controlled canonical URLs; `noindex` on freeform/drawn-area queries; canonical toward place hierarchy pages.  
**Residual:** Misconfigured robots — SEO checklist in acceptance.

## Residual risks (accepted for Phase 5)

1. Possession of approximate map pins reveals coarse location by design.
2. Real routing provider outages force labeled degrade or fail-closed travel-time filters.
3. Amenity data freshness depends on licensed refresh cadence.

## Pre-implementation checklist

- [ ] `projectPublicLocation` used on all public geo paths
- [ ] Polygon validation + rate limits wired
- [ ] Provider keys absent from client bundles
- [ ] Commute RLS + agency deny tests
- [ ] Playwright journey with mocked providers
- [ ] Phase 4C share payloads still exclude exact coords

## Post-implementation

Re-run catalogue after code lands; file slips in [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md).
