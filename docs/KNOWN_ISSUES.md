# Known issues

Date: 2026-08-05 (Phase 2 + Phase 3 vertical slice)

## Phase 2

1. **No authorized listing photographs.** Legacy JSON has no images and no republication rights. UI uses placeholders only.
2. **Bathrooms unavailable** in the legacy dataset; detail pages show an explicit “not provided” state rather than inventing values.
3. **Some source URLs are portal search pages** (Idealista/Fotocasa). Stored as-is; weak listing identity flagged via snapshot provenance.
4. **Fake auth user rows** are created lazily when favourites are persisted; production will use Supabase Auth UUIDs as `users.id`.
5. **Playwright e2e** requires a migrated/seeded/imported local database and `DATABASE_URL` for the Next.js server.
6. **Map view** is deferred (not required for this Phase 2 slice); card and table views are implemented.
7. **Favourites authorization** is enforced in API + RLS; browser `x-user-id` header is a temporary Phase 1/2 wiring aid until full Supabase session cookies are configured.

## Phase 3 vertical slice

8. **Partner/admin routes trust the same `x-user-id`/`spain_user_id` wiring as Phase 2 favourites (issue 7), not a verified session.** `apps/web/src/lib/partner-auth.ts` resolves org membership / platform role from that header/cookie. This is acceptable for local development (ADR-028; `PHASE3_DECISIONS_REQUIRED.md` explicitly allows FakeAuth + seed locally) but **must not be exposed on a non-local deployment** until real Supabase session verification (and probably a real "which org am I acting as" UI, not `requireSoleOrganization`) is implemented.
9. **`DevIdentitySwitcher` is a local-only dev aid**, not a login UI. It hardcodes the four seeded demo user UUIDs from `packages/database/src/seed-constants.ts` (duplicated as plain strings in `apps/web/src/lib/demo-identities.ts` to avoid pulling server-only DB deps into a client bundle). It must be removed or gated out before any non-local deployment.
10. **No background job runner (`JOBS_PROVIDER=inline` only, ADR-027).** `runSpainPartnerCsvImport` runs synchronously inside the API request handler; large CSVs will block the request thread and there is no retry/backoff. Acceptable for this slice's seeded volumes; revisit (pg-boss or similar) before larger files or more partners are onboarded.
11. **`image_urls` in the CSV are parsed but never persisted as real media.** Every listing gets a single placeholder `listing_media` row regardless of the source's `image_rights`. There is no rights-checked media pipeline (download/verify/store) in this slice — see `docs/IMPORT_FORMAT_CSV.md` "Images".
12. **One data source per organization is assumed.** `requireSoleOrganization` and the partner import route both pick "the org's data source" without a picker; an org with two feeds would need explicit source selection, not built here.
13. **No physical-property matching/merge across sources.** Every partner CSV row creates its own `physical_properties` row (ADR-025), even if it plausibly duplicates an existing legacy snapshot or another partner's listing. Deduplication/matching is out of scope for this slice.
14. **JSON/XML partner adapters are not implemented.** Only Spain Partner CSV v1 ships (ADR-023); `INGESTION_ARCHITECTURE.md`'s multi-format `FeedAdapter` interface exists conceptually but has one concrete implementation.
15. **Playwright e2e for the agency journey requires its own migrated/seeded (but _not_ partner-fixture-imported) database** so the test can exercise a genuine first-time CSV insert; reusing a database that already has `partner-csv-demo-catalonia` listings pre-imported via `pnpm db:import-partner-fixture` would make some of the test's "starts pending_review" assertions inaccurate (a reimport of an already-published listing applies the CSV status directly, per ADR-026).
