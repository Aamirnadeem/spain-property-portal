-- Phase 1 foundation migration (M00-M04)
-- Apply with: pnpm db:migrate (requires DATABASE_URL + PostGIS)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- pgvector optional for Phase 5; install when available
-- CREATE EXTENSION IF NOT EXISTS vector;
