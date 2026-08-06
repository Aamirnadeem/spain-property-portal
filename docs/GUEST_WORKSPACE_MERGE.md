# Guest workspace merge (Phase 4A + 4B)

## Identity

- Opaque HttpOnly cookie `spain_guest_token` (32+ bytes)
- Server stores `SHA-256(token)` on `guest_sessions.anonymousKeyHash`
- localStorage keys (`spain_guest_shortlists`, `spain_guest_favourites`) are a client cache; server guest session is preferred authority

## Transactional merge (`mergeGuestWorkspaceIntoUser`)

Single DB transaction:

1. Load guest session by token (or bounded fallback payload)
2. If already `merged_into_user_id = user` → idempotent return
3. Plan via `mergeGuestWorkspace` (domain)
4. Insert favourites with `onConflictDoNothing`
5. Ensure default shortlist “My shortlist”
6. Insert guest shortlists; on name clash rename to `Guest — …`
7. Insert items with `onConflictDoNothing`
8. Insert property notes **only** for listing IDs without an authenticated note
9. Apply guest weights only if user has no active preference profile
10. Optionally create comparison set from guest comparison ids
11. Insert saved searches with `onConflictDoNothing` on `(user_id, criteria_hash)`; rename on name clash (`Guest —`); never overwrite auth rows or re-enable alerts from a disabled guest search
12. Upsert `browsing_history` by listing (merge first/last/count); truncate to 50
13. Mark guest session merged

## Conflict rules

| Conflict                    | Rule                                    |
| --------------------------- | --------------------------------------- |
| Identical shortlist names   | Prefix `Guest —`                        |
| Same property in shortlist  | Unique constraint / onConflictDoNothing |
| Existing auth property note | **Keep auth; skip guest**               |
| Existing default shortlist  | Guest lists never steal default         |
| Duplicate saved-search hash | **Skip guest** (auth preserved)         |
| Saved-search name clash     | Prefix `Guest —`                        |
| Guest disabled alerts       | Do not re-enable auth alerts            |
| Repeated verify/merge       | Idempotent via `merged_at` / onConflict |
| Partial prior merge         | Retry safe; favourites/items de-duped   |

## Triggers

- `POST /api/v1/auth/otp/verify` after session mint
- `POST /api/v1/me/workspace/merge`

## Privacy

Guest payloads are size-bounded. Notes never appear in agency/admin APIs, public listing APIs, or audit event bodies.

## Phase 4B extension (implemented — ADR-030b)

Steps 11–12 above ship in Phase 4B. See [`PHASE4B_IMPLEMENTATION.md`](PHASE4B_IMPLEMENTATION.md) and [`PHASE4B_DECISIONS_REQUIRED.md`](PHASE4B_DECISIONS_REQUIRED.md) D11.
