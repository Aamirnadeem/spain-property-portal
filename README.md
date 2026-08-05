# Spain Property Portal — Phase 1.1 local setup

## Prerequisites

- Node.js 22+
- pnpm 9+
- Docker (optional, for PostGIS)

## Quick start (no cloud credentials)

```bash
pnpm install
cp .env.example .env.local
pnpm test
pnpm --filter @spain/web dev
```

Open http://localhost:3000/en (also `/es`, `/ca`, `/ar` with RTL).

Fake OTP: request a code on `/en/account` — `devCode` is returned only in development/test when `OTP_PROVIDER=fake`.

## Database (optional for unit tests)

```bash
docker compose up -d db
# set DATABASE_URL in the shell or environment loader
pnpm db:generate # only after intentional schema changes; review generated SQL
pnpm db:migrate
pnpm db:seed
pnpm test:db
```

Unit tests remain fast and do not require Postgres. `pnpm test:db` recreates the local `spain_properties_test` database and validates migration, seed, RLS, uniqueness, and foreign keys. Never use `drizzle-kit push` for production deployment.

## Phase 1 scope

Monorepo foundation, locales, provider-neutral auth/storage, production-gated Supabase adapters, guest merge, versioned identity/org/geography migrations, Phase 1 RLS, media table foundations, and observability stubs.

**Not in Phase 1:** property search UI, legacy JSON import, WhatsApp, voice, AI legal guidance, nationwide scraping.

See [docs/PHASE1_ASSUMPTIONS.md](docs/PHASE1_ASSUMPTIONS.md).
