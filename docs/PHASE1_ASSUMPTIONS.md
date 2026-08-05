# Phase 1 assumptions and unavailable credentials

Date: 2026-08-05  
Slice: Platform foundation only

## Locked during Phase 1

| Decision              | Choice                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Job framework (D-002) | **`inline`** for Phase 1 — no Inngest/Trigger.dev credentials; revisit before worker-heavy Phase 4                                          |
| OTP / email / SMS     | **`fake`** adapters — codes logged / returned as `devCode` in local/CI                                                                      |
| Storage               | **`local`** filesystem foundation (`.data/uploads`) — Supabase Storage keys unavailable                                                     |
| Auth persistence      | In-memory OTP + user map in `apps/web` for the vertical slice demo; Drizzle tables ready for Supabase Auth wiring in a later hardening pass |
| WhatsApp / voice      | Interfaces stubbed with `operational: false` — not activated                                                                                |

## Unavailable credentials (not blocking Phase 1)

- Supabase project URL / anon / service role keys
- Resend / SendGrid / other transactional email
- Twilio / other SMS
- Sentry DSN / OTEL collector
- Map tile / geocoder keys
- LLM API keys
- WhatsApp Business / telephony

## Assumptions

1. `legacy/` remains read-only; no files there were modified for Phase 1.
2. Alcaraz is seeded under Castilla-La Mancha → Albacete when `pnpm db:seed` runs against Postgres.
3. CI runs format/lint/typecheck/unit tests without Docker Postgres.
4. `drizzle-kit push` during `pnpm db:migrate` requires a reachable `DATABASE_URL`.
5. Production Supabase Auth OTP will replace the in-memory store before public launch (tracked as follow-up; schema already supports identities/guests/consents).

## Security notes for fake OTP

`devCode` is returned only when `OTP_PROVIDER` is unset or `fake`. Never enable this in production.
