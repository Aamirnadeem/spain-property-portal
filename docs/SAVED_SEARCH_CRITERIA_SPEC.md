# Saved search criteria specification (`phase4b.v1`)

Date: 2026-08-06  
Status: **Implemented** (Phase 4B — ADR-030b)  
Parent: [`PHASE4B_PLAN.md`](PHASE4B_PLAN.md) · [`PHASE4B_IMPLEMENTATION.md`](PHASE4B_IMPLEMENTATION.md) · ADR-030b · Locks D8

## Purpose

Define a **versioned**, normalized criteria envelope for persisted saved searches so future filter changes can migrate safely without breaking stored rows or guest merge hashes.

## Persistence model

**Locked (D8 / D15):** each saved search stores:

1. **Normalized versioned JSON** in `criteria` (`phase4b.v1`) — source of truth for matching, hashing, and reopen.
2. **Selected indexed columns** derived on write (`idx_min_price`, `idx_max_price`, `idx_min_bedrooms`, `idx_municipality`, `idx_province`, `idx_property_type`, `idx_off_plan`, plus `sort`) for workspace list filtering.

Matching and `criteria_hash` **always** use the JSON envelope, never indexes alone.

## Version envelope

```typescript
type SavedSearchCriteriaV1 = {
  criteriaVersion: 'phase4b.v1';
  // filter fields below — omit absent filters rather than null
};
```

- Stored in `saved_searches.criteria` (jsonb) and mirrored in `criteria_version` column for indexing/migrations.
- Readers: accept known version; ignore unknown keys; reject unsupported versions until a migrator runs.
- Writers: always emit `phase4b.v1` in Phase 4B; derive `idx_*` columns in the same write.

## Fields

| Field                           | Type                                                   | Notes                                                              |
| ------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| `criteriaVersion`               | `'phase4b.v1'`                                         | Required                                                           |
| `q`                             | string?                                                | Free-text terms                                                    |
| `autonomousCommunity`           | string?                                                | Structured geo                                                     |
| `province`                      | string?                                                | Structured geo                                                     |
| `municipality`                  | string?                                                | Structured geo                                                     |
| `districtOrLocality`            | string?                                                | Structured geo                                                     |
| `area`                          | string?                                                | Legacy free-text geo fallback (existing search UI)                 |
| `minPrice` / `maxPrice`         | number?                                                | Non-negative; min ≤ max                                            |
| `minBedrooms` / `maxBedrooms`   | int?                                                   | Non-negative; min ≤ max                                            |
| `minBathrooms` / `maxBathrooms` | int?                                                   | Non-negative; min ≤ max                                            |
| `minSizeSqm` / `maxSizeSqm`     | number?                                                | Built-area range; min ≤ max                                        |
| `propertyType`                  | string?                                                | Controlled vocabulary when inventory supports it                   |
| `environmentType`               | `city_center` \| `coastal` \| `hillside`?              | Existing                                                           |
| `listingStatuses`               | string[]?                                              | Operational statuses to include                                    |
| `offPlan`                       | `'any'` \| `'only'` \| `'exclude'`                     | Default treat missing as `'any'`                                   |
| `freshness`                     | `'any'` \| `'current_only'`                            | `current_only` excludes stale/withdrawn as defined by browse rules |
| `sort`                          | `price_asc` \| `price_desc` \| `size_desc` \| `newest` | Required at persist (default `newest`)                             |

### Never persisted

`page`, `pageSize`, `view` — reopen always at page 1 with default page size / current UI view preference.

## Normalization rules

`normalizeCriteria(input)` must:

1. Strip pagination/view fields.
2. Trim strings; drop empty strings.
3. Coerce numbers; reject non-finite / negatives.
4. Sort `listingStatuses` lexicographically for stable hashing.
5. Default `offPlan` / `freshness` only when hashing if explicitly stored; omit defaults from hash payload when equal to `'any'` to avoid duplicate rows for equivalent searches.
6. Output canonical key order (sorted object keys at each level).

## Hashing

```text
criteria_hash = SHA-256(canonical_json(normalizeCriteria(criteria) + { sort }))
```

- Hex or base64url (document one; recommend lowercase hex).
- Unique constraint: `(user_id, criteria_hash)`.
- Guest merge dedupe uses the same hash.

## Mapping to live search

- Extend [`packages/search/src/criteria.ts`](../packages/search/src/criteria.ts) Zod schema to accept the new fields.
- `toSearchParams` / `parseSearchParams` round-trip all persisted fields that the public search API supports.
- Fields not yet filterable in `searchProperties` must either: (a) be implemented in the same 4B implementation slice, or (b) be stored and shown as “not yet applied” in UI — **planning preference: implement filters in `@spain/database` `buildFilters` for bathrooms, type, status, off-plan, freshness, and structured geo where columns exist; otherwise fail closed in matching (no match) rather than invent data.**

## Matching semantics (summary)

See [`ALERT_MATCHING_ENGINE.md`](ALERT_MATCHING_ENGINE.md):

- Omitted filter = no constraint.
- Present filter vs missing listing fact = **no match** (fail closed), except free-text `q` which uses existing search semantics.
- Legacy snapshots excluded from live alerts unless test flag.

## Migration path

| From                       | To           | Action                                                          |
| -------------------------- | ------------ | --------------------------------------------------------------- |
| Guest opaque `{ q }` blobs | `phase4b.v1` | Best-effort wrap; hash after normalize                          |
| Future `phase4b.v2`        | —            | Batch migrator updates `criteria` + `criteria_version` + rehash |

## Caps

- Name length ≤ 120.
- Max 25 searches / authenticated user; 5 guest.
- Rate limit save/update: 20/min/user.

## Phase 5 extension — `phase5.v1` spatial envelope (planned)

Status: **Planning complete / not implemented** (ADR-031). See [`PHASE5_PLAN.md`](PHASE5_PLAN.md) · [`MAP_SEARCH_ARCHITECTURE.md`](MAP_SEARCH_ARCHITECTURE.md).

`phase5.v1` **extends** `phase4b.v1`: all 4B fields remain valid. Optional `spatial` block:

| Field | Type | Notes |
| ----- | ---- | ----- |
| `criteriaVersion` | `'phase5.v1'` | When spatial present, writers emit 5.v1; readers accept 4b.v1 without spatial |
| `spatial.hierarchyIds` | object? | Official entity UUIDs (AC, province, municipality, …) |
| `spatial.viewport` | bbox? | west/south/east/north |
| `spatial.radius` | `{ lat, lng, meters }`? | Point + metres; metre distance via PostGIS geography |
| `spatial.polygon` | Versioned GeoJSON Polygon? | Max 100 vertices; stored in criteria jsonb; validated/normalized to PostGIS `geometry(Polygon,4326)` before query |
| `spatial.rectangle` | bbox? | Axis-aligned; same validation path |
| `spatial.travelTime` | `{ destinationId?, mode, maxMinutes }`? | Commute filter |

Matching: fail closed when spatial filter present but listing lacks usable projected/admin geography. Drawn areas: **versioned GeoJSON + validated PostGIS geometry** — never trust client GeoJSON alone; never invent coordinates for unmatched listings.

Hash includes the spatial block when present (canonical GeoJSON coordinate precision documented at impl).

## Tests required

- Equal criteria → equal hash (determinism)
- Key order independence
- Pagination stripped
- Invalid ranges rejected
- Version unknown rejected or migrated
- Duplicate `(user_id, criteria_hash)` rejected on create
- Phase 5: polygon vertex/extent rejection; spatial hash stability (when implemented)
