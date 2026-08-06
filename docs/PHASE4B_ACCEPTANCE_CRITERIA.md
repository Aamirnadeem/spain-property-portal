# Phase 4B acceptance criteria

Date: 2026-08-06  
Status: **Implemented** — see [`PHASE4B_IMPLEMENTATION.md`](PHASE4B_IMPLEMENTATION.md)  
Parent: [`PHASE4B_PLAN.md`](PHASE4B_PLAN.md) · ADR-030b

## Gates (shipped in 4B; details in implementation doc)

### Saved searches

- [x] User can save current search with custom name
- [x] Rename, update criteria, delete
- [x] Enable/disable alerts; choose alert types; consent timestamp set on enable
- [x] Manual run returns match count; `last_evaluated_at` updated
- [x] Criteria persist as normalized `phase4b.v1` JSON **plus** indexed columns; pagination not stored
- [x] Duplicate `criteria_hash` rejected for same user
- [x] Cap 25 enforced
- [x] Default alert types: `new_match` + `price_reduction` on; `price_increase` off until user enables
- [x] Manual run works; automated due-scan not required for 4B acceptance (test-triggered evaluate is enough)

### Guest saved searches

- [x] Guest can save locally / guest session (cap 5)
- [x] Merge is transactional and idempotent
- [x] Duplicate criteria skipped (auth preserved)
- [x] Name clash → `Guest —` prefix
- [x] Disabled guest does not re-enable auth alerts
- [x] Alert prefs apply only to newly inserted searches
- [x] Repeated verify/merge does not duplicate rows

### Browsing history

- [x] Property detail records view (when enabled) with listing id, first/last, count, channel
- [x] Recently viewed page lists ≤ 50
- [x] Clear one / clear all
- [x] Retention prune (90 days default); user can clear one/all anytime
- [x] Deduped repeated views (upsert)
- [x] Guest merge upserts correctly
- [x] Opt-out stops recording
- [x] Agency / public cannot read history

### In-app notifications

- [x] Types listed in design are creatable by engine
- [x] Unread/read; mark one; mark all; dismiss/archive
- [x] Deep link to property or saved search
- [x] Localized rendering en/es/ca/ar
- [x] Duplicate suppression via `dedupe_key`
- [x] No production email/SMS/WhatsApp/push invoked

### Matching engine / events / jobs

- [x] Only authorized published listings; **legacy snapshot alerts disabled** (test flag only)
- [x] New match vs price/status change distinguished
- [x] Price reduction notifies by default when alerts on; price increase does not unless enabled
- [x] Status/withdrawal notifies shortlisted or saved-match listings
- [x] Evaluation runs + failures recorded
- [x] Same `source_event_id` does not notify twice
- [x] Manual + test-triggered evaluation; scheduler interface documented but not production-wired
- [x] InlineJobRunner + TestJobRunner only (no pg-boss)
- [x] InApp + Test notification providers only

### Authorization / RLS

- [x] Cross-user read/update/delete denied
- [x] Agency denied on all 4B buyer tables
- [x] Post-merge ownership = authenticated user
- [x] Policies exist in SQL migration + catalogue when implemented

### UI / i18n / a11y

- [x] Searches, history, notification centre, unread badge
- [x] Empty/loading/error/stale states
- [x] Arabic RTL smoke
- [x] Accessibility smoke on primary journey

### Playwright (required journey)

anonymous visitor  
→ searches properties  
→ saves search  
→ views several properties  
→ opens recently viewed  
→ authenticates  
→ guest search and history merge  
→ simulated property change occurs  
→ saved search is evaluated  
→ one in-app notification appears  
→ notification links to the correct property  
→ notification is marked read  
→ sign out and sign in  
→ state remains persistent

Covered by `apps/web/e2e/buyer-phase4b.spec.ts`.

### Documentation

- [x] All Phase 4B planning docs present
- [x] Status/matrix/RLS updated to **implemented** for 4B; see [`PHASE4B_IMPLEMENTATION.md`](PHASE4B_IMPLEMENTATION.md)

## Explicitly not required for 4B

Production email/SMS/WhatsApp/push; comparison share links; collaborators; leads; privacy export workers; JSON/XML; AI; maps; pg-boss.
