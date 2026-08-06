# Guest workspace merge (Phase 4A)

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
11. Mark guest session merged

## Conflict rules

| Conflict                    | Rule                                    |
| --------------------------- | --------------------------------------- |
| Identical shortlist names   | Prefix `Guest —`                        |
| Same property in shortlist  | Unique constraint / onConflictDoNothing |
| Existing auth property note | **Keep auth; skip guest**               |
| Existing default shortlist  | Guest lists never steal default         |
| Repeated verify/merge       | Idempotent via `merged_at` / onConflict |
| Partial prior merge         | Retry safe; favourites/items de-duped   |

## Triggers

- `POST /api/v1/auth/otp/verify` after session mint
- `POST /api/v1/me/workspace/merge`

## Privacy

Guest payloads are size-bounded. Notes never appear in agency/admin APIs, public listing APIs, or audit event bodies.
