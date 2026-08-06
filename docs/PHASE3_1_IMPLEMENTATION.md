# Phase 3.1 implementation — Authenticated agency and administrator sessions

Date: 2026-08-06  
Status: **Implemented** on `cursor/phase2-legacy-inventory-buyer-journey`  
Plan companions: [`PHASE3_1_AUTH_PLAN.md`](PHASE3_1_AUTH_PLAN.md), [`AUTHORIZATION_MATRIX.md`](AUTHORIZATION_MATRIX.md), [`SESSION_SECURITY_DESIGN.md`](SESSION_SECURITY_DESIGN.md), [`PHASE3_1_ACCEPTANCE_CRITERIA.md`](PHASE3_1_ACCEPTANCE_CRITERIA.md)

## What shipped

1. **Verified sessions** — `getSession` / FakeAuth sealed HttpOnly `spain_session` (local/test); Supabase access/refresh cookies (production path). OTP verify establishes the session; `POST /api/v1/auth/logout` clears it.
2. **No client identity authority** — Production and default local paths ignore `x-user-id` / client-writable `spain_user_id`. Optional `ALLOW_HEADER_AUTH=true` only when `OTP_PROVIDER=fake` and non-production; forbidden in production boot.
3. **Org + platform authz from DB** — Partner context resolves membership/role from `organization_members`; admin from `user_roles`. Roles: `org_owner`/`org_admin` (agency admin), `org_agent` (editor), `org_viewer` (viewer), `platform_admin`, `listing_reviewer`.
4. **`withAuthenticatedDb`** — Partner/admin/favourites request paths set `SET LOCAL ROLE authenticated` + `request.jwt.claim.sub`. CSV ingestion remains service-role after session checks (documented exception).
5. **CSRF** — Mutating cookie-auth routes require `Origin`/`Referer` to match the deployment's own origin, derived from the request URL and `Host`/`X-Forwarded-Host` (an attacker controls neither), plus optional `APP_ORIGIN` for proxied public origins. No fixed port or host allowlist.
6. **Audit actor** — Always `session.userId`; body `actorUserId` ignored.
7. **DevIdentitySwitcher** — Gated to development/test + FakeAuth; mints sealed sessions via `/api/v1/auth/dev-session` (not `spain_user_id`).

## Key files

| Area                            | Path                                                                    |
| ------------------------------- | ----------------------------------------------------------------------- |
| Fake session seal               | `packages/communications/src/auth/fake-session.ts`                      |
| Fail-closed + header-auth gates | `packages/communications/src/auth/provider.ts`                          |
| `withAuthenticatedDb`           | `packages/database/src/auth/with-authenticated-db.ts`                   |
| Write RLS                       | `packages/database/drizzle/0006_phase3_1_rls.sql`                       |
| Session / CSRF / partner-auth   | `apps/web/src/lib/session.ts`, `csrf.ts`, `partner-auth.ts`             |
| Auth routes                     | `apps/web/src/app/api/v1/auth/{otp/verify,logout,session,dev-session}`  |
| e2e isolation                   | `apps/web/e2e/global-setup.ts`, `packages/database/src/reset-e2e-db.ts` |

## Test isolation for Playwright

`pnpm test:e2e` owns its environment end to end: `globalSetup` runs `pnpm db:reset:e2e`, which recreates
`spain_properties_e2e` (migrations + seed + legacy snapshot, deliberately **without** the partner CSV
fixture), and the suite serves the app on port 3100 against that database. A developer's own
`pnpm dev` session on port 3000 and its `spain_properties` database are never reused or reset.
`E2E_DATABASE_URL` (must be localhost and end in `_e2e`), `PLAYWRIGHT_PORT` and `E2E_SKIP_DB_RESET=true`
are the available overrides.

## Non-goals (unchanged)

Phase 4 buyer workspace, JSON/XML adapters, background jobs, WhatsApp/voice/AI.
