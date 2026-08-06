# Phase 4C — Decisions required (and locked)

Date: 2026-08-06  
Status: Planning — decisions locked for documentation; implementation awaits approval  
Parent: [`PHASE4C_PLAN.md`](PHASE4C_PLAN.md) · ADR-030c

## Already locked (do not re-open)

| ID       | Topic           | Lock                                                                              |
| -------- | --------------- | --------------------------------------------------------------------------------- |
| ADR-027  | Jobs            | No durable queue required for 4C (share create/resolve are request-path)          |
| ADR-029  | Sessions        | Verified sessions for all owner `/me/*` mutations; never trust `x-user-id` headers |
| ADR-030  | Phase 4 scope   | Shareable comparisons in Phase 4; no prod email/SMS/WhatsApp for shares           |
| ADR-030a | 4A              | Shortlists/notes/comparison `phase4a.v1` / guest merge shipped                    |
| ADR-030b | 4B vs 4C        | **4C** = comparison share links only                                              |
| D4       | Max listings    | **5** max / **2** min per comparison (and per share)                              |
| 4A notes | Privacy         | Private notes never appear on public shares                                       |

## Locked in this planning slice (ADR-030c)

### D6 — Public share scores and weights

- **Default:** public share does **not** include scores or buyer weights.
- **Opt-in at create:** owner may enable frozen weight snapshot and/or frozen score/explanation snapshot.
- Live personal preference profiles are never read for anonymous viewers.
- Disclaimer `suitability_not_valuation` is mandatory whenever scores are shown.

**Owner:** Product — **locked** (closes prior open D6).

### D18 — Expiry

- Default: **7 days**.
- Presets: **24 hours**, **7 days**, **30 days**, or **custom calendar date**.
- Maximum: **90 days** from creation.
- Permanent public links: **disabled**.

**Owner:** Product / Privacy — **locked**.

### D19 — Token construction

- Entropy: ≥ **256 bits** (`crypto.randomBytes(32)` → base64url plaintext).
- Storage: **SHA-256** hex of plaintext only; plaintext returned **once** at create.
- Never derived from user, comparison, or listing IDs.
- Constant-time compare of hashes at resolve.
- Never log full plaintext tokens.

**Owner:** Engineering / Security — **locked**.

### D20 — Selection and manifest

- Share owns an explicit `comparison_share_items` set (2–5 listing IDs) captured at create.
- Optional `comparison_set_id` is provenance only — later compare/shortlist edits must **not** expand the public set.
- Versioned manifest envelope `phase4c.v1` records allowed fields, score/weight flags, and timestamps.

**Owner:** Engineering — **locked**. Spec: [`PUBLIC_COMPARISON_DTO.md`](PUBLIC_COMPARISON_DTO.md).

### D21 — Snapshot vs live resolution

- **Frozen at create:** selected IDs, field allowlist, title/description, score/weight flags, optional weight/score snapshots, model version, expiry.
- **Live at resolve:** current public listing facts for those IDs only (price, status, freshness, authorized images, attribution) via PublicComparisonDto.
- Listing withdrawn/deleted/unauthorized-image/stale/merged → explicit warning for that slot; **never** substitute another listing.

**Owner:** Product / Engineering — **locked**.

### D22 — Public route and indexing

- Route: `/{locale}/shared-comparison/{token}`.
- API: `GET /api/v1/compare/shared/{token}`.
- `noindex`, restrictive `Cache-Control` and `Referrer-Policy`.
- Invalid / expired / revoked → **identical generic unavailable** response (no existence leak).

**Owner:** Engineering — **locked**.

### D23 — Access records

- Store aggregate `access_count` / `last_accessed_at` on the share.
- Optional event rows: share id, timestamp, result category, coarse UA category.
- **No** recipient identity, full IP, or fingerprinting exposed to the buyer.
- Truncated/hashed network identifiers deferred unless abuse requires them (document then).

**Owner:** Privacy — **locked**.

### D24 — Public resolution privilege

- Anonymous users have **no** RLS SELECT on share tables.
- Resolve via narrowly scoped server service using service-role (or equivalent) **after** rate limiting — same documented exception pattern as public property reads / 4B fan-out.

**Owner:** Security — **locked**.

## Rate limits (app-level)

| Action                         | Limit        |
| ------------------------------ | ------------ |
| Create / replace share         | 10/min/user  |
| Revoke                         | 30/min/user  |
| Public resolve                 | 60/min/IP    |

## Explicitly deferred

| Topic                                      | Where                          |
| ------------------------------------------ | ------------------------------ |
| Collaborator invites                       | Phase 6                        |
| Recipient accounts / comments              | Later                          |
| Lead capture from share                    | Phase 4.1+                     |
| Email delivery of share links              | Later                          |
| Searchable public comparison directory     | Never in 4C                    |
| Permanent profile pages                    | Never in 4C                    |
| Privacy export workers for shares          | Phase 4.1+ (CASCADE at delete) |

## Sign-off

Phase 4C **planning** may proceed with D6 and D18–D24 locked. Implementation requires explicit approval after docs land.
