# Session security design — Phase 3.1

Date: 2026-08-06  
Status: **Implemented**  
Related: [`PHASE3_1_AUTH_PLAN.md`](PHASE3_1_AUTH_PLAN.md), [`SECURITY_AND_PRIVACY.md`](SECURITY_AND_PRIVACY.md)

## Goals

1. Browser identity is a **server-verified session**, not a client-supplied UUID.
2. Production uses **Supabase Auth** cookie sessions via `AuthProvider`.
3. Local/CI uses **FakeAuth** sealed HttpOnly cookies only when `OTP_PROVIDER=fake`.
4. Fail closed when production config is incomplete or header-auth is enabled.

## Session establishment

### Production (Supabase)

1. `POST /api/v1/auth/otp/request` → `SupabaseAuthProvider.requestOtp`
2. `POST /api/v1/auth/otp/verify` → `verifyOtp` → ensure `users` / `auth_identities` rows
3. Set Supabase auth cookies through official SSR cookie adapter (HttpOnly, Secure, appropriate Domain/Path)
4. Subsequent requests: `getSession(request)` reads cookies and validates with Supabase (`getUser`)

### Local / test (FakeAuth)

1. Same OTP routes with `FakeAuthProvider`
2. On verify: mint sealed cookie `spain_session`:
   - Payload: `{ sub: userId, exp: unix, v: 1 }`
   - MAC: HMAC-SHA256 with `FAKE_SESSION_SECRET` (required when fake sessions enabled)
3. `getSession` verifies MAC + expiry; rejects tampering
4. Playwright helper: `createFakeSessionCookie(userId)` sets cookie on context

### Forbidden authority cookies

- `spain_user_id` (client-writable) must **not** authorize API access after Phase 3.1
- May be cleared on login/logout for compatibility; never read as authority in production

## Cookie attributes

| Attribute        | Production              | Local HTTP                                  |
| ---------------- | ----------------------- | ------------------------------------------- |
| HttpOnly         | Yes                     | Yes                                         |
| Secure           | Yes                     | Optional (false on localhost)               |
| SameSite         | `Lax`                   | `Lax`                                       |
| Path             | `/`                     | `/`                                         |
| Max-Age / Expiry | Provider refresh policy | FakeAuth absolute **8h** (planning default) |

Partner portal may later prefer `SameSite=Strict` if cross-site embeds are not required.

## CSRF

Cookie-authenticated mutating requests (`POST`/`PATCH`/`DELETE` on partner, admin, favourites, logout):

1. Require same-origin: `Origin` (or `Referer`) matches this deployment's own origin, derived from the request URL and `Host` / `X-Forwarded-Host` + `X-Forwarded-Proto`, plus `APP_ORIGIN` when a proxy presents a different public origin. Deriving from the request rather than a hard-coded host/port keeps the check correct on any dev port, preview URL or proxied deployment.
2. Reject cross-site origins with 403 (`csrf_origin_rejected`). A cross-site attacker controls `Origin`/`Referer` but never the `Host` of a request the victim's browser sends to us.
3. Do **not** provide an `x-user-id` fallback that bypasses Origin checks.
4. Prefer same-site form/fetch from Next.js app; no wildcard CORS for credentialed partner APIs.

GET requests remain safe under SameSite=Lax for top-level navigations; sensitive GETs that mutate must not exist.

## Logout

- `POST /api/v1/auth/logout`
  - Supabase: `signOut` + clear auth cookies
  - FakeAuth: clear `spain_session`
  - Clear any legacy `spain_user_id`
- Idempotent: always 204/200 even if already logged out

## Expiry and refresh

| Provider | Behaviour                                                                       |
| -------- | ------------------------------------------------------------------------------- |
| Supabase | Access token short-lived; refresh via SDK cookie helpers; invalid refresh → 401 |
| FakeAuth | Absolute TTL 8h; optional idle timeout later; no refresh — re-OTP               |

## Fail-closed production boot

On application start (or first auth request) when `NODE_ENV=production`:

1. Run `assertAuthRuntimeSafety` (OTP_PROVIDER=supabase, URL + anon key present)
2. Reject `OTP_PROVIDER=fake`
3. Reject `ALLOW_HEADER_AUTH=true` (treat as config error)
4. Do not expose `devCode`

Partner/admin route modules should refuse to resolve context if session provider is unavailable.

## Header auth sunset (local only)

| Condition                                                       | `x-user-id` / client `spain_user_id` authority                          |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Production                                                      | **Never**                                                               |
| Development/test, FakeAuth cookie working                       | **Off** (default)                                                       |
| Development/test, `ALLOW_HEADER_AUTH=true`, `OTP_PROVIDER=fake` | Temporary escape hatch only; document removal after Playwright migrates |

## DevIdentitySwitcher

- Allowed only when `NODE_ENV=development` **and** `OTP_PROVIDER=fake`
- Must not render in production builds
- Preferred end state: remove UI; use FakeAuth OTP as seeded demo users

## Guest merge hardening (buyer)

Phase 3.1 minimum: continue guest merge but treat `guestPayload` as **untrusted input** bounded by schema size limits; prefer server-side guest session keyed by HttpOnly guest cookie in a fast follow if not already present. Document as related buyer-auth debt; do not block agency session work.

## IP / rate limits

Prefer platform-forwarded client IP (trusted proxy) over raw spoofable `x-forwarded-for` where the host provides it; document Vercel/Cloudflare behaviour at implementation time.

## Threat summary

| Threat               | Mitigation                                                        |
| -------------------- | ----------------------------------------------------------------- |
| Spoof `x-user-id`    | Ignored in prod; session only                                     |
| Steal session cookie | HttpOnly + Secure + short TTL/refresh; HTTPS                      |
| CSRF                 | SameSite + Origin check                                           |
| FakeAuth in prod     | Fail-closed boot                                                  |
| Session fixation     | New session on OTP verify; invalidate old where provider supports |
