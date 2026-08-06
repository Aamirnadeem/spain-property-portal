# Authorization matrix — Phase 3.1 (+ Phase 4 + Phase 5 planned)

Date: 2026-08-07  
Status: Phase 3.1 **Implemented**; Phase 4A–4C **Implemented**; Phase 5 map/geo **Planning complete** (ADR-031; not implemented)  
Related: [`PHASE3_1_AUTH_PLAN.md`](PHASE3_1_AUTH_PLAN.md), [`PHASE4C_IMPLEMENTATION.md`](PHASE4C_IMPLEMENTATION.md), [`PHASE5_PLAN.md`](PHASE5_PLAN.md)

Legend: **Y** = allow · **N** = deny · **—** = not applicable · **S** = session required · **P** = planned Phase 5

Role keys: `anon`, `buyer` (authenticated, no org/platform role), `org_viewer`, `org_agent` (editor), `org_admin`/`org_owner` (agency admin), `listing_reviewer`, `platform_admin`.

---

## Public buyer APIs

| Route                                | anon | buyer | Notes                    |
| ------------------------------------ | ---- | ----- | ------------------------ |
| `GET /api/v1/properties`             | Y    | Y     | Browseable listings only |
| `GET /api/v1/properties/{id}`        | Y    | Y     | Browseable only          |
| `GET/POST/DELETE /api/v1/favourites` | N    | Y (S) | Owner = session user     |
| `POST /api/v1/auth/otp/request`      | Y    | Y     | Rate limited             |
| `POST /api/v1/auth/otp/verify`       | Y    | Y     | Establishes session      |
| `POST /api/v1/auth/logout`           | Y    | Y     | Clears cookies           |

### Phase 4A buyer workspace APIs (implemented)

| Route                                             | anon | buyer | org_* | Notes                              |
| ------------------------------------------------- | ---- | ----- | ----- | ---------------------------------- |
| `GET/POST/PATCH/DELETE /api/v1/me/shortlists`     | N    | Y (S) | N     | Owner only                         |
| `POST/DELETE /api/v1/me/shortlists/{id}/items`    | N    | Y (S) | N     |                                    |
| `PUT /api/v1/me/shortlists/{id}/note`             | N    | Y (S) | N     |                                    |
| `GET/PUT/DELETE /api/v1/me/notes/properties/{id}` | N    | Y (S) | N     |                                    |
| `POST /api/v1/me/comparisons` / `preview`         | N    | Y (S) | N     |                                    |
| `GET/PUT /api/v1/me/preference-profiles`          | N    | Y (S) | N     |                                    |
| `POST /api/v1/me/workspace/merge`                 | N    | Y (S) | N     | Includes 4B searches/history merge |
| `GET/PUT /api/v1/guest/workspace`                 | Y    | Y     | Y     | Cookie-scoped guest session        |

### Phase 4B buyer APIs (implemented — ADR-030b)

| Route                                                            | anon | buyer | org_* | Notes                                  |
| ---------------------------------------------------------------- | ---- | ----- | ----- | -------------------------------------- |
| `GET/POST/PATCH/DELETE /api/v1/me/saved-searches`                | N    | Y (S) | N     | Owner only; criteria never to agencies |
| `POST /api/v1/me/saved-searches/{id}/run`                        | N    | Y (S) | N     | Manual evaluation                      |
| `PATCH /api/v1/me/saved-searches/{id}/alerts`                    | N    | Y (S) | N     | Opt-in alerts                          |
| `GET/DELETE /api/v1/me/history`                                  | N    | Y (S) | N     | Browsing history                       |
| `POST /api/v1/me/history/views`                                  | N    | Y (S) | N     | Rate-limited                           |
| `DELETE /api/v1/me/history/{listingId}`                          | N    | Y (S) | N     | Clear one                              |
| `GET /api/v1/me/notifications`                                   | N    | Y (S) | N     | In-app only                            |
| `POST /api/v1/me/notifications/{id}/read` / `read-all` / dismiss | N    | Y (S) | N     |                                        |

### Phase 4C comparison shares (implemented — ADR-030c)

| Route                                            | anon | buyer | org_* | Notes                                                                |
| ------------------------------------------------ | ---- | ----- | ----- | -------------------------------------------------------------------- |
| `GET /api/v1/compare/shared/{token}`             | Y    | Y     | Y     | Public DTO allowlist only; rate-limited; generic unavailable on fail |
| `GET/POST /api/v1/me/comparison-shares`          | N    | Y (S) | N     | Owner create/list; CSRF on POST                                      |
| `GET /api/v1/me/comparison-shares/{id}`          | N    | Y (S) | N     | Metadata only; never re-returns plaintext token                      |
| `POST /api/v1/me/comparison-shares/{id}/revoke`  | N    | Y (S) | N     | CSRF                                                                 |
| `POST /api/v1/me/comparison-shares/{id}/replace` | N    | Y (S) | N     | CSRF; new token                                                      |

### Phase 5 map / geospatial (planning complete — ADR-031; not implemented)

| Route                                            | anon    | buyer       | org_* | Notes                                      |
| ------------------------------------------------ | ------- | ----------- | ----- | ------------------------------------------ |
| `GET /api/v1/geography/search`                   | Y **P** | Y **P**     | Y     | Hierarchy typeahead                        |
| `GET /api/v1/properties/map`                     | Y **P** | Y **P**     | Y     | Projected markers only; rate-limited       |
| `POST /api/v1/properties/within`                 | Y **P** | Y **P**     | Y     | Polygon validation + rate limits           |
| `GET /api/v1/properties/{id}/location-context`   | Y **P** | Y **P**     | Y     | Public precision only                      |
| `GET /api/v1/properties/{id}/nearby`             | Y **P** | Y **P**     | Y     | Straight-line / labeled routes             |
| `GET/POST /api/v1/me/commute-destinations`       | N       | Y (S) **P** | N     | Private encrypted/restricted; CSRF on POST |
| `POST /api/v1/me/commute/estimate`               | N       | Y (S) **P** | N     | Rate-limited; mocked Fake provider in tests |

---

## Partner APIs (`/api/v1/partner/*`)

All rows require **verified session** + **org membership**. Org resolved from membership (+ optional validated `organizationId` query). Role from DB only.

| Route                             | viewer | editor (`org_agent`) | agency admin | platform roles | Notes                     |
| --------------------------------- | ------ | -------------------- | ------------ | -------------- | ------------------------- |
| `GET .../listings`                | Y      | Y                    | Y            | N\*            | \*Unless also org member  |
| `GET .../listings/{id}`           | Y      | Y                    | Y            | N\*            | Own org only              |
| `PATCH .../listings/{id}` (price) | N      | Y                    | Y            | N\*            | Own org                   |
| `POST .../listings/{id}/withdraw` | N      | Y                    | Y            | N\*            | Own org                   |
| `GET .../imports`                 | Y      | Y                    | Y            | N\*            | Own org                   |
| `GET .../imports/{id}`            | Y      | Y                    | Y            | N\*            | Own org                   |
| `POST .../imports` (CSV)          | N      | Y                    | Y            | N\*            | Permission gate on source |
| `POST .../media/uploads` (future) | N      | Y                    | Y            | N\*            | Rights-checked            |

Platform admins use **/admin** routes for cross-org actions, not partner spoofing.

---

## Admin APIs (`/api/v1/admin/*`)

All require **verified session** + platform role.

| Route                                       | listing_reviewer | platform_admin | org roles | Notes                      |
| ------------------------------------------- | ---------------- | -------------- | --------- | -------------------------- |
| `GET .../listings` (review queue)           | Y                | Y              | N         | Pending review etc.        |
| `POST .../listings/{id}/publish`            | Y                | Y              | N         | Audited                    |
| `POST .../listings/{id}/withdraw`           | Y                | Y              | N         | Audited                    |
| `GET .../sources`                           | Y (read)         | Y              | N         |                            |
| `PATCH .../sources/{id}` (permission)       | N                | Y              | N         | Audited                    |
| `GET .../audit`                             | Y                | Y              | N         | Filter as product requires |
| `POST .../duplicates/{id}/resolve` (future) | Y                | Y              | N         |                            |

---

## UI route access

| UI                                         | anon            | buyer | org member              | platform              |
| ------------------------------------------ | --------------- | ----- | ----------------------- | --------------------- |
| `/{locale}/search`, property detail        | Y               | Y     | Y                       | Y                     |
| `/{locale}/favourites`                     | Y (guest local) | Y (S) | Y                       | Y                     |
| `/{locale}/workspace/**` (Phase 4)         | Y (guest local) | Y (S) | Y (own buyer data only) | Y                     |
| `/{locale}/shared-comparison/{token}` (4C) | Y               | Y     | Y                       | Y                     |
| `/{locale}/search` map mode (5)            | Y **P**         | Y     | Y                       | Y                     |
| `/{locale}/partner/**`                     | N → login       | N     | Y (S + membership)      | N\*                   |
| `/{locale}/admin/**`                       | N → login       | N     | N                       | Y (S + platform role) |
| `DevIdentitySwitcher`                      | —               | —     | Dev/fake only           | Dev/fake only         |

---

## Negative cases (must deny)

| Attack                                                  | Expected                        |
| ------------------------------------------------------- | ------------------------------- |
| Call partner API without session                        | 401                             |
| Session user, not in org, hits partner                  | 403                             |
| Org A session, org B listing UUID                       | 403 / empty                     |
| Org viewer CSV upload                                   | 403                             |
| Org editor source permission change                     | 403                             |
| `x-user-id` of admin without session (prod)             | 401 (ignored)                   |
| Body `actorUserId` spoof on audit write                 | Ignored; session actor used     |
| Role string in body/query                               | Ignored                         |
| Buyer A reads Buyer B shortlist/notes/history (Phase 4) | 403 / empty                     |
| Agency role lists another buyer’s `/me/*` (Phase 4)     | Denied                          |
| Public share returns notes or identity (Phase 4C)       | Must not                        |
| Invalid / expired / revoked share token (Phase 4C)      | Generic unavailable (identical) |
| Anon SELECT on `comparison_shares*` (Phase 4C)          | Denied (no RLS policy)          |
| Exact coords when display policy is approximate (P5)    | Must not appear in public payloads |
| Agency lists buyer commute destinations (P5)            | Denied                          |
| Oversized / invalid polygon search (P5)                 | 400 / rate limited              |

---

## Enforcement layers

1. **Session** — AuthProvider cookie verification (`spain_session` / Supabase cookies)
2. **App authorization** — membership / `user_roles` / capability checks (`partner-auth.ts`)
3. **RLS** — `request.jwt.claim.sub` via `withAuthenticatedDb` (CSV import service-role exception after API auth; 4C public resolve service-role after rate limit; Phase 5 map projection via service)
4. **Audit** — actor from session only
