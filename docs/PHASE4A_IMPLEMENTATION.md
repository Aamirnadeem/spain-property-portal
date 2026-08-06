# Phase 4A implementation — Core buyer workspace and explainable comparison

Date: 2026-08-06  
Status: **Implemented** (awaiting gate verification in CI/local)  
Parent plan: [`PHASE4_PLAN.md`](PHASE4_PLAN.md) · ADR-030

## Delivered

- Named shortlists (CRUD, default, items, caps)
- Private property notes + shortlist notes (never on agency/admin/public surfaces)
- Comparison selection (2–5), matrix with explicit **unavailable** cells
- Weighted priorities + `scoreListingAgainstWeights` (`phase4a.v1`)
- Guest HttpOnly token + `guest_sessions` + localStorage cache
- Transactional `mergeGuestWorkspaceIntoUser` (favourites preserved; auth notes not overwritten)
- RLS migration `0008_phase4a_rls.sql`
- UI: `/{locale}/workspace/**`, add-to-shortlist on property detail
- i18n: en / es / ca / ar (+ RTL)

## Favourites migration behaviour

Phase 2 `favourites` table **unchanged**. Hearts remain separate from shortlists (ADR-030). Merge uses `onConflictDoNothing` so existing favourites are never deleted. First login ensures empty default shortlist **“My shortlist”** without copying favourites into it.

## Deferred

- **Phase 4B** (planning done — ADR-030b): saved searches, browsing history, in-app alerts — [`PHASE4B_PLAN.md`](PHASE4B_PLAN.md)
- **Phase 4C:** comparison share links
- Production email/SMS/WhatsApp, collaboration, leads, privacy workers

## Key paths

| Area       | Path                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Schema     | `packages/database/src/schema/index.ts`                                                                                              |
| Migrations | `0007_phase4_buyer_workspace.sql`, `0008_phase4a_rls.sql`                                                                            |
| Services   | `packages/database/src/services/buyer-workspace.ts`                                                                                  |
| Scoring    | `packages/domain/src/comparison-scoring.ts`                                                                                          |
| APIs       | `apps/web/src/app/api/v1/me/**`, `guest/workspace`                                                                                   |
| UI         | `apps/web/src/app/[locale]/workspace/**`                                                                                             |
| Specs      | [`COMPARISON_SCORING_SPECIFICATION.md`](COMPARISON_SCORING_SPECIFICATION.md), [`GUEST_WORKSPACE_MERGE.md`](GUEST_WORKSPACE_MERGE.md) |
