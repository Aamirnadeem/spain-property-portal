# Phase 4B implementation — Saved searches, browsing history, in-app alerts

Date: 2026-08-06  
Status: **Implemented**  
Parent plan: [`PHASE4B_PLAN.md`](PHASE4B_PLAN.md) · ADR-030b

## Delivered

- Migrations `0009_phase4b_saved_searches_history_alerts.sql` and `0010_phase4b_rls.sql`
- Tables: `saved_searches`, `saved_search_evaluation_runs`, `saved_search_last_matches`, `browsing_history`, `in_app_notifications`, `notification_deliveries`; column `notification_preferences.history_recording_enabled`
- Criteria version `phase4b.v1` + denormalized indexed columns (`idx_*`) on write
- First evaluation seeds `saved_search_last_matches` without emitting `new_match` for every pre-existing result
- Deduplication via unique `dedupe_key` + `source_event_id`
- Guest merge extension: idempotent, criteria-hash skip, `Guest —` name prefix, non-destructive to auth rows
- History retention **90 days**, list cap **50**, `expireOldHistory` helper (opportunistic prune on list)
- Providers: `InAppNotificationProvider` + `TestNotificationProvider` only (no email/SMS/WhatsApp/push)
- Jobs: `InlineJobRunner` + `TestJobRunner`; `evaluateAllDueSavedSearches` is a **scheduler seam only** (not production-wired)
- Service-role fan-out for listing-change notifications after partner/admin mutations (`withServiceRoleDb` → `generateListingChangeNotifications`)
- APIs under `/api/v1/me/saved-searches`, `/api/v1/me/history`, `/api/v1/me/notifications`
- UI: `/{locale}/workspace/searches`, `history`, `notifications` (+ i18n en/es/ca/ar)
- Playwright journey: `apps/web/e2e/buyer-phase4b.spec.ts`

## First evaluation / new match

When `last_evaluated_at` is null, evaluation writes the current match set into `saved_search_last_matches` and records the run, but does **not** notify for those baseline listings. Subsequent runs emit `new_match` only for listings newly entering the set (when alerts include `new_match`).

## Explicitly not in 4B

- **Phase 4C** comparison share links
- Durable job queue (pg-boss / Inngest / Trigger.dev)
- Production email / SMS / WhatsApp / push digests
- Production cron wiring for `evaluateAllDueSavedSearches`

## Key paths

| Area       | Path                                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Schema     | `packages/database/src/schema/index.ts`                                                                                                                                                                                                                |
| Migrations | `0009_phase4b_saved_searches_history_alerts.sql`, `0010_phase4b_rls.sql`                                                                                                                                                                               |
| Services   | `packages/database/src/services/phase4b-workspace.ts`, guest merge in `buyer-workspace.ts`                                                                                                                                                             |
| Jobs       | `packages/database/src/jobs/index.ts`                                                                                                                                                                                                                  |
| Matching   | `@spain/domain` / `@spain/search` `phase4b.v1` criteria                                                                                                                                                                                                |
| APIs       | `apps/web/src/app/api/v1/me/saved-searches/**`, `history/**`, `notifications/**`                                                                                                                                                                       |
| UI         | `apps/web/src/app/[locale]/workspace/{searches,history,notifications}`                                                                                                                                                                                 |
| E2E        | `apps/web/e2e/buyer-phase4b.spec.ts`                                                                                                                                                                                                                   |
| Specs      | [`SAVED_SEARCH_CRITERIA_SPEC.md`](SAVED_SEARCH_CRITERIA_SPEC.md), [`ALERT_MATCHING_ENGINE.md`](ALERT_MATCHING_ENGINE.md), [`BROWSING_HISTORY_DESIGN.md`](BROWSING_HISTORY_DESIGN.md), [`IN_APP_NOTIFICATION_DESIGN.md`](IN_APP_NOTIFICATION_DESIGN.md) |
