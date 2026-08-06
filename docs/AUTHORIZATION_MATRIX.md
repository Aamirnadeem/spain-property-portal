# Authorization matrix — Phase 3.1

Date: 2026-08-06  
Status: **Implemented**  
Related: [`PHASE3_1_AUTH_PLAN.md`](PHASE3_1_AUTH_PLAN.md), [`SESSION_SECURITY_DESIGN.md`](SESSION_SECURITY_DESIGN.md), [`PHASE3_1_IMPLEMENTATION.md`](PHASE3_1_IMPLEMENTATION.md)

Legend: **Y** = allow · **N** = deny · **—** = not applicable · **S** = session required

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

| UI                                  | anon            | buyer | org member         | platform              |
| ----------------------------------- | --------------- | ----- | ------------------ | --------------------- |
| `/{locale}/search`, property detail | Y               | Y     | Y                  | Y                     |
| `/{locale}/favourites`              | Y (guest local) | Y (S) | Y                  | Y                     |
| `/{locale}/partner/**`              | N → login       | N     | Y (S + membership) | N\*                   |
| `/{locale}/admin/**`                | N → login       | N     | N                  | Y (S + platform role) |
| `DevIdentitySwitcher`               | —               | —     | Dev/fake only      | Dev/fake only         |

---

## Negative cases (must deny)

| Attack                                      | Expected                    |
| ------------------------------------------- | --------------------------- |
| Call partner API without session            | 401                         |
| Session user, not in org, hits partner      | 403                         |
| Org A session, org B listing UUID           | 403 / empty                 |
| Org viewer CSV upload                       | 403                         |
| Org editor source permission change         | 403                         |
| `x-user-id` of admin without session (prod) | 401 (ignored)               |
| Body `actorUserId` spoof on audit write     | Ignored; session actor used |
| Role string in body/query                   | Ignored                     |

---

## Enforcement layers

1. **Session** — AuthProvider cookie verification (`spain_session` / Supabase cookies)
2. **App authorization** — membership / `user_roles` / capability checks (`partner-auth.ts`)
3. **RLS** — `request.jwt.claim.sub` via `withAuthenticatedDb` (CSV import service-role exception after API auth)
4. **Audit** — actor from session only
