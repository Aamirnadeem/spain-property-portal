# Public comparison DTO

Date: 2026-08-06  
Status: Phase 4C planning  
Parent: [`PHASE4C_PLAN.md`](PHASE4C_PLAN.md) · ADR-030c · Locks D6 / D20 / D21

## Purpose

Define the only payload returned to anonymous viewers of a comparison share. Mapping is explicit and allowlisted. Internal database entities must never be serialized directly.

## Schema version

- Share manifest: `phase4c.v1`
- Score model (when included): `phase4a.v1` (reuse Phase 4A scoring; frozen at create)

## Snapshot vs live

### Frozen at share creation

Stored on `comparison_shares` / `manifest` / `comparison_share_items`:

- Ordered listing IDs (and optional `physical_property_id` snapshot)
- Allowed public field keys
- `include_weights`, `include_scores`
- Optional `weight_snapshot` and frozen score/explanation blob when scores enabled
- `score_model_version` when scores enabled
- `public_title`, `public_description`
- `created_at`, `expires_at`, schema version

These values define **what** may appear. Later shortlist/compare edits cannot add listings or private fields.

### Resolved live at public open

For each frozen listing ID, load current **public-browseable** listing facts and map through the allowlist:

- Asking price, €/m², status, freshness labels/warnings
- Authorized images only
- Source attribution and public source link
- Location at approved precision (`areaLabel`), beds/baths/areas when present
- Environment, transport/proximity, public features

If scores were opted in: render the **frozen** score snapshot (do not re-score with the owner’s live preference profile).

## Type sketch

```typescript
interface PublicComparisonDto {
  schemaVersion: 'phase4c.v1';
  publicTitle: string | null;
  publicDescription: string | null;
  createdAt: string;
  expiresAt: string;
  includeScores: boolean;
  includeWeights: boolean;
  scoreModelVersion: 'phase4a.v1' | null;
  disclaimerKey: 'suitability_not_valuation' | null; // required when includeScores
  fields: PublicComparisonFieldKey[];
  listings: PublicComparisonListingRow[];
  unavailableReason?: never; // use HTTP/generic page for whole-share failures
}

type PublicComparisonFieldKey =
  | 'title'
  | 'asking_price'
  | 'price_per_sqm'
  | 'location_precision'
  | 'bedrooms'
  | 'bathrooms'
  | 'built_area'
  | 'usable_area'
  | 'authorized_images'
  | 'public_features'
  | 'environment'
  | 'transport_proximity'
  | 'freshness'
  | 'listing_status'
  | 'source_attribution'
  | 'source_link'
  | 'frozen_score'
  | 'frozen_score_explanation';

interface PublicComparisonListingRow {
  listingId: string;
  position: number;
  slotStatus: 'available' | 'warning' | 'unavailable';
  warnings: PublicListingWarningCode[];
  cells: Record<string, PublicCell>;
  frozenScore?: FrozenScoreSnapshot | null;
}

type PublicListingWarningCode =
  | 'price_changed'
  | 'status_reserved'
  | 'status_under_offer'
  | 'listing_withdrawn'
  | 'listing_stale'
  | 'listing_deleted'
  | 'image_authorization_lost'
  | 'physical_property_merged'
  | 'listing_replaced'
  | 'not_publicly_browseable';
```

## Allowlist (potentially included)

| Field | Notes |
| ----- | ----- |
| Public property title | From listing |
| Asking price / €/m² | Live |
| Approved location precision | `areaLabel` / coarse locality — not exact address |
| Bedrooms / bathrooms | When available |
| Built / usable area | When available |
| Authorized images | Rights-checked URLs only; else empty |
| Public features | Public feature catalogue only |
| Environment classification | When present |
| Transport / proximity | When present |
| Freshness / status | Live + warning codes |
| Source attribution / public source link | Required transparency |
| Frozen scores / explanations | Only if `include_scores` |
| Frozen weights | Only if `include_weights` (display of priorities, not live profile) |

## Always exclude

- Private property notes, shortlist notes, positives/negatives
- Buyer name, email, telephone, account ID, guest ID
- Browsing history, saved searches, notifications
- Live preference profiles (unless frozen snapshot explicitly enabled)
- Hidden or exact address text
- Unauthorized images / media binaries
- Agency-private fields, import errors, ingestion diagnostics
- Internal duplicate-detection / auth / session data

## Listing-change behaviour

| Event | `slotStatus` / warnings | Substitution |
| ----- | ----------------------- | ------------ |
| Price change | `available` + optional `price_changed` | None |
| Reserved / under offer | `warning` + status code | None |
| Withdrawn / not browseable | `unavailable` or `warning` + `listing_withdrawn` / `not_publicly_browseable` | None |
| Stale | `warning` + `listing_stale` | None |
| Deleted | `unavailable` + `listing_deleted` | None |
| Image rights lost | keep row; strip images + `image_authorization_lost` | None |
| Physical property merge | `warning` + `physical_property_merged` | **Never** swap listing |
| Different agency listing replaces marketing | `warning` + `listing_replaced` if detectable | **Never** auto-replace id |

Whole-share failures (bad token, expired, revoked) do not return a DTO — generic unavailable page/API body only.

## Mapper rules

1. Start from empty DTO.
2. Copy only allowlisted keys present in the share’s frozen field list.
3. Strip any note-related structures even if present on internal comparison helpers.
4. When `include_scores` is false, omit score fields entirely.
5. Unit tests assert absence of excluded keys on sample payloads.

## Relation to owner comparison API

Owner `getComparison` / preview may include notes when `includeNotes: true`. Public resolve must **not** call that path with notes enabled. Prefer a dedicated `toPublicComparisonDto(share, liveListings)` mapper in `@spain/database` or `@spain/domain`.
