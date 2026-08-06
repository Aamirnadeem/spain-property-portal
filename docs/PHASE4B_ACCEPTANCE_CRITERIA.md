# Phase 4B acceptance criteria

Date: 2026-08-06  
Status: Phase 4B planning  
Parent: [`PHASE4B_PLAN.md`](PHASE4B_PLAN.md) · ADR-030b

## Gates (all required for 4B “implemented”)

### Saved searches

- [ ] User can save current search with custom name
- [ ] Rename, update criteria, delete
- [ ] Enable/disable alerts; choose alert types; consent timestamp set on enable
- [ ] Manual run returns match count; `last_evaluated_at` updated
- [ ] Criteria persist as normalized `phase4b.v1` JSON **plus** indexed columns; pagination not stored
- [ ] Duplicate `criteria_hash` rejected for same user
- [ ] Cap 25 enforced
- [ ] Default alert types: `new_match` + `price_reduction` on; `price_increase` off until user enables
- [ ] Manual run works; automated due-scan not required for 4B acceptance (test-triggered evaluate is enough)

### Guest saved searches

- [ ] Guest can save locally / guest session (cap 5)
- [ ] Merge is transactional and idempotent
- [ ] Duplicate criteria skipped (auth preserved)
- [ ] Name clash → `Guest —` prefix
- [ ] Disabled guest does not re-enable auth alerts
- [ ] Alert prefs apply only to newly inserted searches
- [ ] Repeated verify/merge does not duplicate rows

### Browsing history

- [ ] Property detail records view (when enabled) with listing id, first/last, count, channel
- [ ] Recently viewed page lists ≤ 50
- [ ] Clear one / clear all
- [ ] Retention prune (90 days default); user can clear one/all anytime
- [ ] Deduped repeated views (upsert)
- [ ] Guest merge upserts correctly
- [ ] Opt-out stops recording
- [ ] Agency / public cannot read history

### In-app notifications

- [ ] Types listed in design are creatable by engine
- [ ] Unread/read; mark one; mark all; dismiss/archive
- [ ] Deep link to property or saved search
- [ ] Localized rendering en/es/ca/ar
- [ ] Duplicate suppression via `dedupe_key`
- [ ] No production email/SMS/WhatsApp/push invoked

### Matching engine / events / jobs

- [ ] Only authorized published listings; **legacy snapshot alerts disabled** (test flag only)
- [ ] New match vs price/status change distinguished
- [ ] Price reduction notifies by default when alerts on; price increase does not unless enabled
- [ ] Status/withdrawal notifies shortlisted or saved-match listings
- [ ] Evaluation runs + failures recorded
- [ ] Same `source_event_id` does not notify twice
- [ ] Manual + test-triggered evaluation; scheduler interface documented but not production-wired
- [ ] InlineJobRunner + TestJobRunner only (no pg-boss)
- [ ] InApp + Test notification providers only

### Authorization / RLS

- [ ] Cross-user read/update/delete denied
- [ ] Agency denied on all 4B buyer tables
- [ ] Post-merge ownership = authenticated user
- [ ] Policies exist in SQL migration + catalogue when implemented

### UI / i18n / a11y

- [ ] Searches, history, notification centre, unread badge
- [ ] Empty/loading/error/stale states
- [ ] Arabic RTL smoke
- [ ] Accessibility smoke on primary journey

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

### Documentation

- [ ] All Phase 4B planning docs present
- [ ] Status/matrix/RLS updated to reflect **planned** until code ships; then **implemented** only for tested policies

## Explicitly not required for 4B

Production email/SMS/WhatsApp/push; comparison share links; collaborators; leads; privacy export workers; JSON/XML; AI; maps; pg-boss.
