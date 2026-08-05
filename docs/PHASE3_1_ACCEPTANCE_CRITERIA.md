# Phase 3.1 acceptance criteria

Date: 2026-08-06  
Status: Planning — criteria for implementation approval gate  
Related: [`PHASE3_1_AUTH_PLAN.md`](PHASE3_1_AUTH_PLAN.md), [`AUTHORIZATION_MATRIX.md`](AUTHORIZATION_MATRIX.md)

## Scope gate

Phase 3.1 is **accepted** only when all items below pass and Phase 4 / JSON-XML / WhatsApp / voice / AI were **not** started.

---

## A. Session and fail-closed

- [ ] OTP verify establishes a server-verified session (Supabase cookies in prod config; FakeAuth sealed cookie in local/test)
- [ ] Production boot rejects `OTP_PROVIDER=fake` and `ALLOW_HEADER_AUTH`
- [ ] `devCode` never returned when `NODE_ENV=production`
- [ ] `POST /api/v1/auth/logout` clears session; subsequent partner/admin calls return 401
- [ ] Expired FakeAuth / invalid Supabase session returns 401

## B. Removal of client identity authority

- [ ] Production partner/admin/favourites routes do **not** authorize via `x-user-id`
- [ ] Production routes do **not** authorize via client-writable `spain_user_id`
- [ ] Partner/admin/favourites browser clients do not send `x-user-id` (cookies only)
- [ ] `DevIdentitySwitcher` absent or hard-gated to development + FakeAuth
- [ ] No `x-organization-id` / `x-role` authority headers introduced

## C. Organization and platform authorization

- [ ] Partner context uses session user + DB membership (validated org id when multi-org)
- [ ] `org_viewer` can read org listings/imports; cannot upload CSV or mutate price/withdraw
- [ ] `org_agent` / agency admin can upload CSV and mutate own-org listings per matrix
- [ ] Non-member session receives 403 on partner routes
- [ ] `listing_reviewer` / `platform_admin` can publish; non-platform cannot
- [ ] Only `platform_admin` can change source `permission_status`

## D. Audit actor

- [ ] Publish / price update / withdraw / permission change write `audit_events.actor_user_id` = session user
- [ ] Spoofed body `actorUserId` does not override session actor

## E. RLS alignment

- [ ] Partner/admin/favourites request path uses `withAuthenticatedDb` setting `request.jwt.claim.sub`
- [ ] `pnpm test:db` proves cross-org isolation under `SET LOCAL ROLE authenticated` + claim (not only service-role app filters)
- [ ] Workers/CLI remain documented service-role exception

## F. Cross-agency isolation

- [ ] Org A session cannot list or mutate org B listings/imports (API + RLS tests)
- [ ] Known listing UUID from org B returns 403/empty for org A session
- [ ] Forged session cookie rejected

## G. CSRF / cookie security

- [ ] Session cookies are HttpOnly; Secure in production
- [ ] Mutating partner/admin routes reject disallowed Origin
- [ ] No header-auth bypass around CSRF checks in production

## H. Buyer favourites regression

- [ ] Authenticated favourites add/list/remove work with session cookie (no `x-user-id`)
- [ ] Guest local favourites still function for anonymous users
- [ ] Guest→account merge still runs on verify (with documented trust bounds)

## I. Phase 3 data compatibility

- [ ] Existing seeded demo org, members, roles, listings, imports, audit rows remain valid without id rewrite
- [ ] Spain Partner CSV vertical slice still works end-to-end under session auth
- [ ] Migrations additive only (no destructive auth table resets)

## J. Automated suite

- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test` (includes session/authz unit tests)
- [ ] `pnpm test:db` (includes Phase 3.1 RLS/session claim cases)
- [ ] `pnpm test:e2e` (includes unauthenticated partner denial, org isolation, editor vs viewer, admin publish, logout, favourites session)

## K. Documentation

- [ ] [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) marks Phase 3.1 implementation complete when shipped
- [ ] [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) retires or narrows issues #7–#9 regarding `x-user-id` / DevIdentitySwitcher
- [ ] ADR-029 marked implemented in [`DECISIONS.md`](DECISIONS.md)

## Explicit non-acceptance

Phase 3.1 is **not** accepted if:

- Client-supplied UUID headers still authorize production routes
- RLS claim wiring was skipped with only app-layer checks
- Phase 4 / AI / WhatsApp / JSON-XML feed work was bundled in
