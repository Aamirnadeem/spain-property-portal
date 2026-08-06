# Routing provider interface

Date: 2026-08-07  
Status: Phase 5 planning  
Parent: [`PHASE5_PLAN.md`](PHASE5_PLAN.md) · ADR-031 · D32 / D36

## Purpose

Isolate geocoding and routing behind a provider-neutral port so domain and UI never hardcode a single vendor. Keys stay server-side.

## Ports

```typescript
interface GeocodingProvider {
  geocode(req: GeocodeRequest): Promise<GeocodeResult[]>;
  reverseGeocode(req: ReverseGeocodeRequest): Promise<GeocodeResult | null>;
}

interface RoutingProvider {
  route(req: RouteRequest): Promise<RouteResult>;
  matrix(req: MatrixRequest): Promise<MatrixResult>;
  isochrone?(req: IsochroneRequest): Promise<IsochroneResult>; // optional capability
}
```

### Normalized types (sketch)

- `GeocodeRequest`: `{ query, countryBias?: 'ES', language? }`
- `GeocodeResult`: `{ lat, lng, label, confidence, providerPlaceId?, components? }`
- `RouteRequest`: `{ from, to, mode: 'walk'|'drive'|'transit', departAt? }`
- `RouteResult`: `{ distanceM, durationS, mode, provider, attribution }`
- Distances/durations always include `mode` and `metricKind: 'routed'`.

Straight-line helpers live in PostGIS/domain — **not** on `RoutingProvider`.

## Adapters

| Adapter | Role |
| ------- | ---- |
| `FakeGeocodingProvider` / `FakeRoutingProvider` | **Mocked** deterministic local / CI |
| `TestRoutingProvider` | Fixture routes for Playwright / unit tests |
| `TestRoutingProvider` | Injectable fixtures for Playwright |
| `HttpRoutingProvider` (stub) | Real vendor behind env config |

Production vendor choice is a residual product ack (Mapbox, Google, OpenRouteService, etc.) — not locked in domain code.

## Cross-cutting

| Concern | Policy |
| ------- | ------ |
| Caching | Cache geocode/route by normalized key + TTL; do not cache forbidden PII longer than retention |
| Rate limiting | Per-user and per-IP on estimate/geocode endpoints |
| Quotas | Surface `quota_exceeded`; degrade to straight-line with explicit label or fail closed for travel-time filters |
| Retry | Bounded exponential backoff on 429/5xx; no infinite loops |
| Attribution | Pass through provider attribution to UI when required |
| Retention | Follow provider ToS; minimize stored destination precision for private commute points |
| Failure | Prefer graceful degrade with labeled fallback; never silently substitute routed for straight-line |

## Geocoding workflow

```text
source address normalize
  → enqueue geocode job
  → provider geocode
  → confidence threshold
  → ambiguous / low → quarantine + manual review
  → high → attach as geocoded coordinate (not auto-exact public)
  → preserve original address + geocoder source + timestamp
  → re-geocode policy on address change or stale age
```

**Do not** automatically publish low-confidence results as public map pins.

## Security

- API keys only in server env.
- UI calls `/api/v1/...` only — never vendor SDKs directly (ADR-017).
- Log provider errors without echoing full addresses when avoidable.

## Tests

Adapter contract tests; Fake matrix/isochrone fixtures; Playwright uses mocked providers only.
