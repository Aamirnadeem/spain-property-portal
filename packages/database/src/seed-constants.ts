/**
 * Deterministic Phase 3 vertical-slice seed identities.
 *
 * These UUIDs are shared by `pnpm db:seed`, `pnpm test:db`, the Phase 3 CSV import fixture,
 * and Playwright global setup so every consumer refers to the same demo agency without
 * duplicating magic strings. Never used in production beyond the synthetic demo (see
 * docs/PHASE3_DECISIONS_REQUIRED.md D-P3-001).
 */

export const DEMO_ORG_ID = '33333333-3333-4333-8333-333333333333';
export const DEMO_ORG_SLUG = 'demo-catalonia-agency';
export const DEMO_ORG_NAME = 'Demo Catalonia Agency';

export const ORG_OWNER_USER_ID = '44444444-4444-4444-8444-444444444444';
export const ORG_AGENT_USER_ID = '55555555-5555-4555-8555-555555555555';
export const PLATFORM_ADMIN_USER_ID = '66666666-6666-4666-8666-666666666666';
export const LISTING_REVIEWER_USER_ID = '77777777-7777-4777-8777-777777777777';

export const DEMO_SOURCE_KEY = 'partner-csv-demo-catalonia';
export const DEMO_SOURCE_NAME = 'Demo Catalonia Agency — Spain Partner CSV v1 feed';

export const SPAIN_PARTNER_CSV_V1_PARSER_VERSION = 'spain-partner-csv-v1@1';
