# Spain Property Portal — Phase 1 local setup

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

Fake OTP: request a code on `/en/account` — `devCode` is returned in the API response when `OTP_PROVIDER=fake`.

## Database (optional for unit tests)

```bash
docker compose up -d db
# set DATABASE_URL in .env.local
pnpm db:migrate
pnpm db:seed
```

Unit tests for schema/RLS catalogues and OTP/guest-merge do **not** require Postgres.

## Phase 1 scope

Monorepo foundation, locales, health, fake email/SMS OTP, guest merge, identity/org/geography schema + RLS policy catalogue, media table foundations, observability stubs.

**Not in Phase 1:** property search UI, legacy JSON import, WhatsApp, voice, AI legal guidance, nationwide scraping.

See [docs/PHASE1_ASSUMPTIONS.md](docs/PHASE1_ASSUMPTIONS.md).
