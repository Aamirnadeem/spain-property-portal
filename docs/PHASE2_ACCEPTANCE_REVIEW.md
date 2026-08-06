# Phase 2 acceptance review

Date: 2026-08-05  
Branch: `cursor/phase2-legacy-inventory-buyer-journey`  
Reviewer: automated acceptance pass (no application code changes)  
Scope reference: approved Phase 2 gate (legacy inventory + first public buyer journey), plus cross-check against `IMPLEMENTATION_PLAN.md` Phase 2 acceptance checklist.

## Overall verdict

**CONDITIONAL PASS** for the approved Phase 2 gate (items 1–11 and the scoped buyer journey).

Not a clean unconditional pass against the full `IMPLEMENTATION_PLAN.md` Phase 2 checklist: map view, manual listing workflow, energy fields, claim-vs-derived provenance UI, KPI strip, SEO/structured data, and wired dark-mode appearance remain incomplete or out of the executed Phase 2 slice. Favourites merge is idempotent but not transactional.

**Do not start Phase 3** until product owners accept this review (or the PARTIAL remediations below).

## Test suite executed (this review)

| Command             | Result                                                           |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm format:check` | PASS                                                             |
| `pnpm lint`         | PASS                                                             |
| `pnpm typecheck`    | PASS                                                             |
| `pnpm test`         | PASS                                                             |
| `pnpm test:db`      | PASS (migrate, seed, double legacy import, RLS, uniqueness, FKs) |
| `pnpm test:e2e`     | PASS (search → detail → favourite + axe critical=0)              |

## Legacy import counts (verified)

Evidence sources:

- `pnpm test:db` asserts `COUNT(*) = 60` for `property_listings WHERE is_legacy_snapshot = true` after two consecutive imports.
- Live re-import against `spain_properties_test` during this review printed:

```json
{
  "inserted": 0,
  "updated": 60,
  "rejected": 0,
  "skipped": 0,
  "errors": []
}
```

Interpretation for the canonical 60-record file:

| Metric                        | Count | Notes                                                                 |
| ----------------------------- | ----: | --------------------------------------------------------------------- |
| Handled records               |    60 | All rows in `data/legacy/barcelona_property_explorer_legacy_60.json`  |
| Inserted (first clean import) |    60 | Established by empty-DB import path in `test:db`                      |
| Updated (re-import)           |    60 | Observed this review; no duplicates                                   |
| Rejected / quarantined        |     0 | Valid file; invalid rows would go to `import_errors` without aborting |
| Skipped (unmapped enum/type)  |     0 |                                                                       |

Quarantine path exists (`import_errors` + `rejected` / `skipped` counters on `import_runs.report`) but was not exercised by the clean 60-record dataset in this run.

---

## Verification matrix (requested items 1–12)

### 1. All 60 legacy records handled; imported / rejected / quarantined counts

**PASS**

- Clean file yields **60 imported / updated**, **0 rejected**, **0 quarantined**, **0 skipped**.
- Structured report persisted on `import_runs` and printed by CLI (`pnpm db:import-legacy`).

### 2. Re-running the importer cannot create duplicates

**PASS**

- Upsert key: `(data_source_id, external_listing_id)`.
- `test:db` runs `db:import-legacy` twice and still asserts exactly 60 snapshot listings.
- Live second run updated 60 / inserted 0.

### 3. Every legacy listing marked as snapshot; never live or verified

**PASS**

- Importer sets `operational_status = legacy_snapshot`, `freshness_method = legacy_snapshot`, `is_legacy_snapshot = true`.
- `last_confirmed_available_at` remains null for these rows.
- UI shows “Legacy snapshot” badge and historical freshness warning (`legacyFreshnessWarning()`).
- Source attribution uses snapshot wording.

### 4. Original source URLs preserved

**PASS**

- Legacy `url` mapped to `property_listings.source_url` and provenance without rewriting to invented listing IDs.
- Documented that some URLs are portal search pages and are stored as-is (`PROPERTY_IMPORT_GUIDE.md`, `KNOWN_ISSUES.md`).

### 5. No property images invented or copied without authorization

**PASS**

- Data source image rights: `none`.
- Importer writes `listing_media` placeholders only (`media_asset_id = null`, `is_placeholder = true`).
- Detail UI uses placeholder block; no scrape/generate path.
- Playwright journey does not assert fake photos.

### 6. Search / filter / pagination / detail / favourites via service/API boundaries

**PASS**

- Client components call `/api/v1/properties`, `/api/v1/properties/[listingId]`, `/api/v1/favourites` only.
- Route handlers call typed services: `searchProperties`, `getPropertyDetails`, `addFavourite`, `removeFavourite`, `listFavourites`, `mergeGuestFavouritesIntoUser`.
- No direct Drizzle/SQL usage in React client components.

### 7. Guest-to-account favourite merging transactional and idempotent

**PARTIAL**

- **Idempotent:** `addFavourite` / merge use `onConflictDoNothing` on `(user_id, listing_id)`; domain merge de-duplicates IDs.
- **Not transactional:** `mergeGuestFavouritesIntoUser` loops per-ID inserts without `db.transaction(...)`. A mid-loop failure can leave a partial merge.
- AuthPanel posts `guestListingIds` after OTP verify; guest localStorage key `spain_guest_favourites` is separate from older `spain_guest_payload` demo merge path — workable but dual-path.

**Remediation**

1. Wrap `mergeGuestFavouritesIntoUser` in a single DB transaction (bulk insert + `onConflictDoNothing`).
2. Add a DB integration test that asserts atomic merge (force failure mid-batch → zero partial rows, or use transaction rollback).
3. Unify guest favourite storage onto one key before merge.

### 8. Cross-user favourite access blocked and tested

**PASS** (with residual identity-wiring risk documented)

- Service queries always scope by `userId`.
- `test:db` proves favourites RLS: authenticated user A sees only A’s rows.
- Domain unit tests cover `assertFavouriteOwner`.
- Residual: HTTP APIs currently trust `x-user-id` / cookie rather than verified Supabase session JWT on the DB role (`KNOWN_ISSUES.md` #7). That is identity spoofing risk until session wiring lands — not a row-leak when the claimed user id is correct.

**Optional hardening (not blocking this PASS)**

- Wire Supabase session → `SET LOCAL ROLE` / JWT claim on DB connections used by favourites APIs.
- Add HTTP-level test that user A’s token cannot list B’s favourites.

### 9. Production cannot use fake OTP

**PASS**

- `assertProductionAuthConfig` rejects missing / `fake` / incomplete Supabase config when `nodeEnv === 'production'`.
- `FakeAuthProvider` refuses production construction.
- Covered by `packages/communications/src/auth/provider.test.ts`.

### 10. Actual PostgreSQL migrations and RLS policies tested

**PASS**

- `pnpm test:db` recreates `spain_properties_test`, runs real migrations + seed + import.
- Exercises Phase 1 identity RLS and Phase 2 listing browse + favourites owner policies.
- Matrix in `RLS_IMPLEMENTATION_STATUS.md` matches code; import tables remain deny-by-default (planned-only client access).

### 11. Playwright artifacts ignored by Git

**PASS**

- `.gitignore` contains `**/test-results/` and `**/playwright-report/`.
- `git check-ignore` resolves `apps/web/test-results/.last-run.json` to that rule.
- `.prettierignore` also excludes those paths.

### 12. All documented Phase 2 acceptance criteria satisfied

**PARTIAL**

Relative to the **approved Phase 2 execution scope** (legacy inventory + public buyer journey with favourites pulled forward per `DECISIONS.md`): core criteria are met.

Relative to the **full `IMPLEMENTATION_PLAN.md` Phase 2 acceptance checklist** and broader master-prompt Phase 2 deliverables, several items remain open or deferred:

| Plan criterion                                                 | Status                       | Remediation                                                                                                                                                             |
| -------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous browse of legacy-marked inventory; placeholders only | PASS                         | —                                                                                                                                                                       |
| Card + table views responsive                                  | PASS                         | —                                                                                                                                                                       |
| Map view                                                       | FAIL / deferred              | Implement map (or formally amend plan to defer map to a later phase). Documented in `KNOWN_ISSUES.md` #6.                                                               |
| Separate list view (beyond cards)                              | PARTIAL                      | Cards cover browse; dedicated list layout not shipped. Add list view or amend plan wording.                                                                             |
| Location + lifestyle filters                                   | PASS                         | Price, beds, size, area, environment, free text, pagination, URL state.                                                                                                 |
| Provenance labels distinguish claim vs derived                 | PARTIAL                      | Source claims stored; UI does not clearly distinguish advertiser claim vs derived lifestyle labels. Surface claim/derived badges on detail/search.                      |
| Detail: source, rights, freshness, energy                      | PARTIAL                      | Source + freshness yes; energy fields absent (unavailable in legacy JSON — show explicit “not provided” energy state). Rights messaging is minimal.                     |
| 60-record idempotent snapshot import                           | PASS                         | —                                                                                                                                                                       |
| Alcaraz under Castilla-La Mancha / Albacete                    | PASS                         | Asserted in `test:db`.                                                                                                                                                  |
| Approximate locations not shown as exact                       | PASS                         | No invented coordinates; address free text.                                                                                                                             |
| Accessibility (keyboard, focus, map alternative, pinch-zoom)   | PARTIAL                      | Axe critical=0 on search; viewport allows zoom; no map so map-alternative N/A. Expand keyboard/focus e2e coverage.                                                      |
| No invented images / no unauthorized scrape                    | PASS                         | —                                                                                                                                                                       |
| Manual listing workflow (master prompt Phase 2)                | FAIL / out of executed scope | Explicitly deferred; amend plan or schedule as Phase 2.1 / Phase 4 ops.                                                                                                 |
| Dark and light appearance (Phase 2 user scope)                 | PARTIAL                      | `.dark` tokens exist in `@spain/ui/styles.css`, but layout never applies `.dark` or `prefers-color-scheme`. Wire theme class or media query + toggle/system preference. |
| KPI strip / SEO / structured data (plan deliver)               | FAIL / deferred              | Not delivered in this slice; schedule or amend plan.                                                                                                                    |

**Remediation for item 12 overall**

1. Product decision: either (a) accept CONDITIONAL PASS for the narrowed Phase 2 gate and move open plan items to Phase 2.1 / later phases in `IMPLEMENTATION_PLAN.md`, or (b) remediate PARTIAL/FAIL rows above before calling Phase 2 complete against the long-form checklist.
2. Prefer updating `IMPLEMENTATION_PLAN.md` Phase 2 acceptance checkboxes to match the approved gate if (a) is chosen.

---

## Cross-cutting notes

- Favourites were intentionally delivered in Phase 2 (ahead of Phase 3 workspace) per `DECISIONS.md`.
- Live Supabase Auth OTP delivery and Storage remain credential-gated (`IMPLEMENTATION_STATUS.md`).
- `packages/ingestion` Vitest integration file is skipped unless `DATABASE_URL` is set in that package’s test env; real DB coverage for import is provided by `pnpm test:db` / CLI.

## Recommendation

1. Accept Phase 2 as **CONDITIONAL PASS** for the approved buyer-journey gate.
2. Before Phase 3, either close the PARTIAL favourites-merge transaction gap (#7) and dark-mode wiring, or explicitly backlog them with owners.
3. Update `IMPLEMENTATION_PLAN.md` Phase 2 checkboxes to reflect deferred map / manual listing / SEO / KPI items so Phase 3 does not inherit ambiguous “Phase 2 incomplete” debt.
4. **Do not begin Phase 3 automatically.**
