# Phase 4C implementation — Secure comparison sharing

Date: 2026-08-06  
Status: **Implemented**  
ADR: [`ADR-030c`](DECISIONS.md) · Plan: [`PHASE4C_PLAN.md`](PHASE4C_PLAN.md)

## Delivered

- Migrations `0011_phase4c_comparison_shares.sql` / `0012_phase4c_comparison_shares_rls.sql`
- Tables: `comparison_shares`, `comparison_share_items`, `comparison_share_access_events`
- Services: `packages/database/src/services/phase4c-comparison-shares.ts`
- Domain: `packages/domain/src/public-comparison.ts` (`phase4c.v1`)
- Owner APIs: `/api/v1/me/comparison-shares` (+ revoke/replace)
- Public API: `GET /api/v1/compare/shared/{token}` (rate-limited; service-role resolve)
- UI: share dialog on compare page; public `/{locale}/shared-comparison/[token]`
- Playwright: `apps/web/e2e/buyer-phase4c.spec.ts`

## Security locks verified in tests

- Tokens stored as SHA-256 hashes only; plaintext returned once at create
- Public DTO allowlist excludes notes, buyer identity, history, searches
- Expired / revoked / invalid → identical generic unavailable
- No anon RLS SELECT on share tables; owner isolation; agency deny
- Rate limits on create/replace/revoke/public resolve

## Out of scope (unchanged)

Collaborative editing, permanent links, lead capture, email/SMS/WhatsApp, Phase 5+.
