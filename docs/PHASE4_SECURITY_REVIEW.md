# Phase 4 security review

Date: 2026-08-06  
Status: Planning  
Parent: [`PHASE4_PLAN.md`](PHASE4_PLAN.md)  
Builds on: [`SECURITY_AND_PRIVACY.md`](SECURITY_AND_PRIVACY.md), ADR-029, [`SESSION_SECURITY_DESIGN.md`](SESSION_SECURITY_DESIGN.md)

## Threat model (buyer workspace)

| ID  | Threat                                         | Mitigation                                                                 |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| B1  | Enumerate another user’s shortlist by ID       | Owner RLS + API ownership check; 404 not 403 for items if preferred        |
| B2  | Read another user’s notes / history            | Owner RLS; no agency SELECT                                                |
| B3  | Forge `x-user-id` to attach shortlists         | ADR-029 sessions only; headers ignored in production                       |
| B4  | Guest merge forgery via huge/malicious payload | Schema bounds, size limits, untrusted input; prefer HttpOnly guest session |
| B5  | Guess share tokens                             | 32+ byte token; store hash; rate-limit public GET                          |
| B6  | Share link leaks notes / identity / history    | DTO allowlist; tests assert absence                                        |
| B7  | Revoked/expired share still works              | Check `revoked_at` / `expires_at` server-side                              |
| B8  | Alert spam / enumeration                       | Dedupe keys; rate limits; consent required                                 |
| B9  | Agency staff sees buyer browsing history       | No partner/admin queries; RLS deny                                         |
| B10 | CSRF on workspace mutations                    | Origin/Referer allowlist (Phase 3.1 pattern)                               |
| B11 | Score presented as valuation                   | Mandatory disclaimer; copy review                                          |
| B12 | Account deletion leaves private data           | CASCADE FKs; revoke shares                                                 |

## RLS and authorization

- All Phase 4 buyer tables: owner-scoped policies; `withAuthenticatedDb` on `/api/v1/me/*`.
- Public share: **not** “RLS anon read of shares table”. Resolve token in server code with hashed lookup; return comparison DTO only.
- API checks **complement** RLS; they do not replace it (same rule as Phase 3.1).
- Platform admin: no Phase 4 requirement to browse arbitrary buyer notes.

## Share-token security

1. Generate `token = randomBytes(32).toString('base64url')`.
2. Store `sha256(token)` as `token_hash`.
3. URL: `/{locale}/compare/shared/{token}` (token only in path once; prefer no referrer leakage — `Referrer-Policy`).
4. On GET: hash incoming token; lookup; if missing/expired/revoked → 404.
5. Rate limit by IP + token prefix (e.g. 60/min).
6. Audit: `comparison_share.created` / `.revoked` with session actor.

## Rate limits (planned)

| Endpoint                       | Limit       |
| ------------------------------ | ----------- |
| Public share GET               | 60/min/IP   |
| `recordPropertyView`           | 30/min/user |
| Save search / create shortlist | 20/min/user |
| Create share                   | 10/min/user |
| Guest merge                    | 5/min/user  |

## History retention and privacy

- Default retention **90 days** (`BUYER_HISTORY_RETENTION_DAYS`).
- User can clear one or all.
- Opt-out of recording.
- Not visible to agencies.
- Not included in comparison shares.

## Account deletion behaviour

When user deleted (future privacy worker or admin):

- CASCADE workspace tables
- Shares deleted or hard-revoked
- Notifications deleted
- Favourites already CASCADE
- Guest sessions merged into user remain historical hashes only

Phase 4 implements schema cascades; full privacy export/delete **workflow** remains deferred (Phase 4.1+).

## Consent

- Alert subscriptions require `consented_at`.
- Copy must state Phase 4 alerts are **in-app only** (no email/SMS/WhatsApp yet).
- Marketing flags on `user_profiles.marketingOptIn` stay separate from saved-search alerts.

## Audit requirements

| Action                 | Audit?                                                    |
| ---------------------- | --------------------------------------------------------- |
| Share create / revoke  | Yes — actor = session user                                |
| Alert enable / disable | Yes (lightweight)                                         |
| Shortlist CRUD         | Optional (prefer application logs); not mandatory Phase 4 |
| Record view            | No (volume)                                               |

Actor identity always from verified session—never from body `actorUserId`.

## Guest security follow-ups

Documented debt (KNOWN_ISSUES / decisions):

- Prefer HttpOnly guest cookie + server `guest_sessions` over client `guestPayload`
- Unify localStorage keys
- Transactional merge

## Cross-user test matrix (required)

| Case                                      | Expect                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| User A GET User B shortlist               | 404/403                                                                                 |
| User A PATCH User B note                  | 404/403                                                                                 |
| User A list B history                     | empty/403                                                                               |
| User A read B notification                | 403                                                                                     |
| Agency agent GET `/me/shortlists` as self | only if they also have buyer data as that user—org role must not bypass to other buyers |
| Forged headers                            | ignored                                                                                 |
| Share token for set with notes            | notes absent                                                                            |
| Expired token                             | 404                                                                                     |

## Residual risks

- Stateless FakeAuth logout replay until expiry (known Phase 3.1 limitation).
- Inline alert evaluation can miss events if mutation path forgets to call evaluator—checklist in implementation.
- Public share still reveals that listings were compared (inherent).
