# Known issues

Date: 2026-08-06 (Phase 2 + Phase 3 + Phase 3.1 + Phase 4A + Phase 4B)

## Phase 2

1. **No authorized listing photographs.** Legacy JSON has no images and no republication rights. UI uses placeholders only.
2. **Bathrooms unavailable** in the legacy dataset; detail pages show an explicit “not provided” state rather than inventing values.
3. **Some source URLs are portal search pages** (Idealista/Fotocasa). Stored as-is; weak listing identity flagged via snapshot provenance.
4. **Fake auth user rows** are created lazily when favourites are persisted; production will use Supabase Auth UUIDs as `users.id`.
5. ~~**Playwright e2e** requires a manually migrated/seeded/imported local database~~ — **Resolved in Phase 3.1**: `pnpm test:e2e` provisions its own `spain_properties_e2e` database via `globalSetup` (`pnpm db:reset:e2e`) and serves the app on port 3100, so it never reads or resets a developer's `spain_properties`.
6. **Map view** is deferred (not required for this Phase 2 slice); card and table views are implemented.
7. ~~**Favourites authorization** via browser `x-user-id`~~ — **Resolved in Phase 3.1**: favourites use verified session cookies; guest local favourites remain for anonymous users.

## Phase 3 vertical slice

8. ~~**Partner/admin routes trust `x-user-id`/`spain_user_id`~~ — **Resolved in Phase 3.1** (ADR-029): verified FakeAuth/Supabase sessions; org membership and platform roles from DB. Residual: multi-org UI still defaults via `requireSoleOrganization` when the user has exactly one membership (query `organizationId` supported when multiple).
9. ~~**`DevIdentitySwitcher` sets client cookie identity**~~ — **Narrowed in Phase 3.1**: gated to development/test + FakeAuth; calls `/api/v1/auth/dev-session` to mint HttpOnly sealed sessions. Still a local demo aid, not a production login UI.
10. **No background job runner (`JOBS_PROVIDER=inline` only, ADR-027).** `runSpainPartnerCsvImport` runs synchronously inside the API request handler; large CSVs will block the request thread and there is no retry/backoff. Acceptable for this slice's seeded volumes; revisit (pg-boss or similar) before larger files or more partners are onboarded.
11. **`image_urls` in the CSV are parsed but never persisted as real media.** Every listing gets a single placeholder `listing_media` row regardless of the source's `image_rights`. There is no rights-checked media pipeline (download/verify/store) in this slice — see `docs/IMPORT_FORMAT_CSV.md` "Images".
12. **One data source per organization is assumed.** Partner import route picks "the org's data source" without a picker; an org with two feeds would need explicit source selection, not built here.
13. **No physical-property matching/merge across sources.** Every partner CSV row creates its own `physical_properties` row (ADR-025), even if it plausibly duplicates an existing legacy snapshot or another partner's listing. Deduplication/matching is out of scope for this slice.
14. **JSON/XML partner adapters are not implemented.** Only Spain Partner CSV v1 ships (ADR-023); `INGESTION_ARCHITECTURE.md`'s multi-format `FeedAdapter` interface exists conceptually but has one concrete implementation.
15. ~~**Playwright e2e for the agency journey requires its own migrated/seeded (but _not_ partner-fixture-imported) database**~~ — **Resolved in Phase 3.1**: `pnpm db:reset:e2e` recreates `spain_properties_e2e` from migrations + seed + legacy import only, and Playwright's `globalSetup` runs it before every suite. The journey therefore always exercises a genuine first-time CSV insert (`pending_review`), and repeated runs no longer inherit listings a previous run published (a reimport of an already-published listing applies the CSV status directly, per ADR-026). Set `E2E_SKIP_DB_RESET=true` to opt out when iterating locally.

## Phase 3.1 residual

16. ~~**Guest merge still accepts client `guestPayload`**~~ — **Narrowed in Phase 4A**: HttpOnly `spain_guest_token` + `guest_sessions` is preferred; bounded `guestPayload` remains a fallback on OTP verify / merge. localStorage still used as a cache for shortlists/favourites.
17. **CSV import uses service-role DB** after session + mutator checks (intentional ingestion exception; listing price/withdraw/admin/favourites use `withAuthenticatedDb`).
18. **Live Supabase cookie SSR path** is wired for access-token cookies from OTP verify; full `@supabase/ssr` refresh-cookie rotation against a live project remains credential-gated.
19. ~~**`pnpm format:check` fails on Windows checkouts** for ~100 files no phase touched~~ — **Resolved**: `.prettierrc.json` now sets `endOfLine: "auto"`, so Prettier accepts the platform's checked-out line endings (Windows `core.autocrlf=true` produces CRLF working trees while the repository stores LF) and still enforces consistency within each file. Chosen over `.gitattributes` + renormalization because it fixes the gate without a repository-wide line-ending-only diff; Git continues to normalize to LF on commit, so committed content is unchanged.
20. **FakeAuth logout is cookie-clear only.** FakeAuth sessions are stateless HMAC tokens, so logout does not revoke a copied token before its eight-hour expiry. This provider is restricted to local/test use; production Supabase session revocation remains provider-managed.

## Phase 4A residual

21. **Energy / condition / outdoor / accessibility / investment** comparison criteria remain unavailable or always-missing until real inventory fields exist — UI shows unavailable; scoring excludes them.
22. **Guest comparison** uses client-side `scoreComparisonSet` for anonymous users; authenticated users use `/api/v1/me/comparisons/preview`. Notes are never included for guests.
23. ~~Phase 4B/4C not started~~ — **Resolved for 4B:** Phase **4B implemented** (ADR-030b) — see [`PHASE4B_IMPLEMENTATION.md`](PHASE4B_IMPLEMENTATION.md). Phase **4C** = comparison share links only (not started).
24. ~~**Phase 4A buyer journey fails on a cold Playwright run**~~ — **Resolved**: on a genuinely cold run (`apps/web/.next` deleted) `expect(getByTestId('property-detail'))` failed inside the default 5s budget because `next dev` still had to compile two chained routes after the click — `/[locale]/properties/[listingId]` (measured 3776 ms) and the `/api/v1/properties/[listingId]` call its client component awaits (4119 ms), ~7.9s in total versus ~0.6s warm. Playwright's `webServer.url` gate only proved `/api/health` had compiled, so nothing guaranteed application readiness. Fixed with an `app-ready` setup project (`apps/web/e2e/app-ready.setup.ts`) that polls `/api/health`, polls `/api/v1/properties?limit=1` until a seeded listing is queryable (proving migrations + seed + property API), and warms every route the journeys visit; the journey now waits for the property-detail response to complete before asserting; and server-startup (120s), readiness (180s) and per-assertion (15s, measured from warm behaviour) budgets are separated. No sleeps, no weakened assertions, retries still `0` everywhere so a first-run failure can never be masked. Verified with 5 consecutive clean cold runs plus 2 warm runs (7/7 pass) and a cold full suite (16 passed) — details and residual limitations in `docs/PHASE4A_ACCEPTANCE_REVIEW.md`.

## Phase 4B residual

25. ~~**Guest merge still drops `savedSearchCriteria` / `recentViewListingIds` at DB persist**~~ — **Resolved in Phase 4B**: `mergeGuestWorkspaceIntoUser` persists saved searches (hash skip / `Guest —` rename) and browsing history upserts.
26. ~~**`PropertySearchCriteria` lacks bathrooms / type / status / off-plan / structured geo**~~ — **Resolved in Phase 4B**: `phase4b.v1` criteria envelope + indexed columns; matching fail-closed on missing facts.
27. **No production scheduler** for `evaluateAllDueSavedSearches` — function is a scheduler seam only; 4B evaluation is manual / test-triggered (`InlineJobRunner` / `TestJobRunner`). Durable queue deferred (ADR-027).
28. **No production email digests** — `InAppNotificationProvider` + `TestNotificationProvider` only; email/SMS/WhatsApp/push remain out of scope.
29. **Sibling physical-property suppression** (one notify / type / UTC day / `physical_property_id`) is designed in D13 but **not fully enforced** in the listing-change fan-out path; unique `dedupe_key` + `source_event_id` still prevent same-event duplicates.
30. Inline alert fan-out on large partner/admin mutations may add request latency — accepted under ADR-027; durable queue deferred.
