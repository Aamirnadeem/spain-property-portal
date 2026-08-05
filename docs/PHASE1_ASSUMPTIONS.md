# Phase 1 assumptions and unavailable credentials

Date: 2026-08-05  
Slice: Platform foundation + Phase 1.1 hardening

## Locked during Phase 1

| Decision              | Choice                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Job framework (D-002) | **`inline`** for Phase 1 — no Inngest/Trigger.dev credentials; Phase 3 planning default is **pg-boss** (ADR-024) |
| Production auth       | **Supabase Auth** for email and mobile OTP; provider user UUID is the canonical application user ID              |
| Local/test auth       | **`FakeAuthProvider`** only; process-local and non-persistent; `devCode` is local/test only                      |
| Production storage    | **Supabase Storage** for authorized media                                                                        |
| Local/test storage    | **`LocalStorageProvider`** under `.data/uploads`; non-durable and never production                               |
| Production database   | **Supabase PostgreSQL**; Drizzle versioned migrations and typed queries                                          |
| WhatsApp / voice      | Interfaces stubbed with `operational: false` — not activated                                                     |

## Unavailable credentials (not blocking Phase 1)

- Supabase project URL / anon / service role keys
- Resend / SendGrid / other transactional email
- Twilio / other SMS
- Sentry DSN / OTEL collector
- Map tile / geocoder keys
- LLM API keys
- WhatsApp Business / telephony

## Assumptions

1. `legacy/` remains read-only; no files there were modified for Phase 1 or 1.1.
2. Alcaraz is seeded under Castilla-La Mancha → Albacete when `pnpm db:seed` runs against Postgres.
3. Fast CI runs format/lint/typecheck/unit tests without Postgres; `pnpm test:db` is a separate required database job.
4. `pnpm db:generate` creates migration files; `pnpm db:migrate` applies committed migrations. `drizzle-kit push` is prohibited for production deployment.
5. `users.id` is supplied by `AuthProvider`; in production it is the persistent Supabase Auth UUID. Future favourites, shortlists and conversations must use that ID and must not depend on fake provider state.
6. The database integration suite uses only a localhost database whose name ends in `_test`; it recreates that database.

## Security notes for fake OTP

Production startup/build fails closed when `OTP_PROVIDER` is missing, fake, unsupported, or when Supabase URL/anonymous-key configuration is incomplete. `FakeAuthProvider` cannot be constructed in production. `devCode` is returned only by the fake provider in `development` or `test`, and OTP values are not logged.
