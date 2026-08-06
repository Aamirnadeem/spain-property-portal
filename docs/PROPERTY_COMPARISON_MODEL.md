# Property comparison model

Date: 2026-08-06  
Status: Phase 4 planning  
Parent: [`PHASE4_PLAN.md`](PHASE4_PLAN.md)

## Purpose

Define a structured, explainable side-by-side comparison of listings and a weighted preference score that never pretends to be a valuation, legal opinion or guaranteed investment recommendation.

## Selection rules

- Properties are selected from a shortlist (or an explicit listing id list the user owns via shortlist/favourite membership check).
- **Min 2 / max 5** listings per comparison (configurable constant `COMPARISON_MAX_ITEMS = 5`).
- Persisted as `comparison_sets` + `comparison_items` when sharing or saving weights snapshot; preview may be ephemeral.

## Comparison matrix fields

Each cell is `{ status: "available", value: T } | { status: "unavailable", reason: "not_in_source" | "not_applicable" }`.

| Field | Source (planned) | Notes |
| ----- | ---------------- | ----- |
| Asking price | `property_listings.price_amount` + currency | |
| Price per m² | `price_per_sqm` or computed if built area present | If neither → unavailable |
| Bedrooms | `bedrooms` | |
| Bathrooms | `bathrooms` | |
| Built area | `built_area_sqm` | |
| Usable area | `usable_area_sqm` | Often null → unavailable |
| Property type | `property_type_key` / label | |
| Condition | feature or attribute if present | Else unavailable — **do not invent** |
| Energy rating | not in Phase 2/3 schema | **unavailable** until a real column/source exists |
| Location | `area_label`, `address_text` | |
| Environmental classification | `environment_type` | city_center / coastal / hillside |
| Transport access | `nearest_transit` | |
| Estimated commute | `commute_min` | |
| Beach proximity | `beach_proximity` | |
| Park proximity | `park_proximity` | |
| School proximity | not populated | unavailable |
| Hospital proximity | not populated | unavailable |
| Listing freshness | freshness fields / `last_confirmed_available_at` | |
| Source | portal / agency attribution | |
| Off-plan status | listing flag/feature if present | unavailable if unknown |
| Known recurring expenses | if present on listing/features | unavailable if unknown |
| Buyer notes | `property_notes` | **Owner session only**; omit on public share |

### Hard rule

**Unavailable values must be shown as unavailable, not invented.** No map enrichment, scraped amenities or guessed energy labels in Phase 4.

## DTO sketch

```typescript
type CompareCell<T> =
  | { status: 'available'; value: T }
  | { status: 'unavailable'; reason: 'not_in_source' | 'not_applicable' };

interface ComparisonListingRow {
  listingId: string;
  title: string;
  cells: Record<ComparisonFieldKey, CompareCell<unknown>>;
  score?: SuitabilityScoreResult; // when weights applied
}

interface ComparisonMatrixDto {
  listings: ComparisonListingRow[];
  fields: ComparisonFieldKey[];
  disclaimerKey: 'suitability_not_valuation';
  includeBuyerNotes: boolean;
}
```

## Weighted priorities

### Allowed weight keys

`price`, `location`, `commute`, `quiet_surroundings`, `coastal_access`, `outdoor_space`, `size`, `condition`, `energy_efficiency`, `accessibility`, `investment_potential`

- Each weight: integer 0–10 (0 = ignore).
- Profile stored in `user_preference_profiles.weights` jsonb.
- Active profile used by default; compare UI may override for the session/set.

### Scoring algorithm (`scoreListingAgainstWeights`)

Pure function in `@spain/domain` (unit-tested):

1. Map each weight key → optional numeric **fact score** 0–1 derived only from available cells (see mappings below).
2. If fact unavailable → key goes to `missing[]`; **excluded** from weighted sum.
3. If sum of active available weights is 0 → return `{ score: null, factors: [], missing, reason: 'no_scorable_inputs' }`.
4. Else `score = round(100 * Σ(weight_i * fact_i) / Σ(weight_i))` over available keys only.
5. Return `factors: [{ key, weight, factScore, contribution }]` sorted by contribution descending.

### Fact mappings (conservative)

| Weight key | Uses available facts | Heuristic (document as preference fit, not appraisal) |
| ---------- | -------------------- | ---------------------------------------------------- |
| price | asking price vs user max from saved search or cohort median of compare set | Lower relative price → higher fact score within set |
| location | area label present | Binary 1 if present (weak) — prefer user-set preferred areas later |
| commute | `commute_min` | Inverse normalize within set |
| quiet_surroundings | environment / features if any | Else missing |
| coastal_access | beach proximity or environment=`coastal` | Else missing |
| outdoor_space | features (terrace/garden) if joined | Else missing |
| size | built or usable area | Normalize within set |
| condition | condition cell | Else missing |
| energy_efficiency | energy cell | Else missing until data exists |
| accessibility | feature flags if any | Else missing |
| investment_potential | **never auto-claimed** | Always `missing` unless user supplies explicit personal score later |

Investment potential must not be inferred from price alone in Phase 4.

### Disclaimer (mandatory UI + API)

> This score reflects how the selected listing matches **your stated weights** using **available listing facts only**. It is **not** a property valuation, market appraisal, legal opinion or guarantee of investment performance. Missing data is excluded from the score.

i18n key: `compare.suitabilityDisclaimer`.

## Share vs owner views

| Element | Owner compare | Public share |
| ------- | ------------- | ------------ |
| Matrix facts | Yes | Yes (selected listings only) |
| Buyer notes | Yes | No |
| Weights / score | Yes (optional) | Optional public score **without** identity; prefer omit personal weights or show anonymous snapshot baked at share time |
| Account identity | Yes | No |
| History | No | No |

Locked default: **public share includes matrix facts + optional title; excludes notes, identity, history; excludes live personal weights** (may include frozen score snapshot if user opts in at create time — decision default: **no scores on public share** unless opted in).

## API

- `getComparison({ listingIds, preferenceProfileId?, includeNotes? })`
- `updateComparisonWeights` → upsert active profile or comparison_set snapshot

## UI

- Table: rows = fields, columns = listings (or transpose for mobile).
- Unavailable cells: em dash + visually hidden “Unavailable”.
- Score chip + “Why this score?” disclosure listing factors and missing keys.
- Legacy reference: `legacy/client/src/components/ComparisonTable.tsx`.

## Tests

- Unit: full facts; all-missing → null score; partial missing excluded from denominator; investment_potential never inferred
- Integration: notes stripped for share token fetch
- Playwright: compare 3 listings, change weights, see explanation update
- a11y: disclaimer readable; table headers associated
