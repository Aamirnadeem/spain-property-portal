# Phase 4A acceptance review

Date: 2026-08-06
Scope: acceptance review of Phase 4A (core buyer workspace + explainable comparison), and the
cold-start hardening of the anonymous-to-authenticated Playwright journey.

## 1. Acceptance findings

| Acceptance question                                            | Verdict          | Evidence                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comparison scores are genuinely explainable                    | Pass             | `scoreListingAgainstWeights` returns `score`, `factors[]` (`key`, `weight`, `factScore`, `contribution`, `sourceValue`), `missing[]`, `explanation`, `scoreModelVersion` (`phase4a.v1`); rendered per listing by `WorkspaceCompareClients.tsx`                             |
| Missing data neither inflates nor deflates scores              | Pass             | Missing criteria are excluded from both `weightSum` and `weightedFactSum`; no zero-fill; all-missing yields `score: null` with `reason: 'no_scorable_inputs'`; covered in `comparison-scoring.test.ts`                                                                     |
| Guest merge cannot duplicate or overwrite records              | Pass             | `mergeGuestWorkspaceIntoUser` runs in one transaction with `onConflictDoNothing`; authenticated property notes win; clashing shortlist names become `Guest — <name>`; guest weights apply only when no active profile; `guest_sessions.merged_at` makes retries idempotent |
| Private notes excluded from agency and public responses        | Pass             | Notes are only reachable under `/api/v1/me/*` behind a verified session; no partner/admin/public route references `property_notes` or `shortlist_notes`; owner-only RLS policies with no agency `SELECT`                                                                   |
| RLS implemented in migrations, not documentation only          | Pass             | `packages/database/drizzle/0008_phase4a_rls.sql` enables RLS and creates owner policies for all seven Phase 4A tables; mirrored in `rls/policies.ts` and asserted by integration tests                                                                                     |
| Existing favourites survive migration                          | Pass             | Neither `0007_phase4_buyer_workspace.sql` nor `0008_phase4a_rls.sql` alters or drops `favourites`; hearts stay separate from shortlists (ADR-030); merge only inserts with conflict-do-nothing                                                                             |
| Full anonymous-to-authenticated Playwright journey passes cold | Pass (after fix) | Was failing on a genuinely cold run before this change; now 5/5 consecutive cold runs plus 2 warm runs green — see below                                                                                                                                                   |

## 2. Cold-start failure: root cause

### Symptom (before fix)

A genuinely cold run (`apps/web/.next` deleted, no dev server running) failed deterministically:

```
Error: expect(locator).toBeVisible() failed
Locator: getByTestId('property-detail')
Expected: visible
Timeout: 5000ms
Error: element(s) not found
  at e2e/buyer-workspace.spec.ts:26
```

The `Arabic workspace RTL` test passed in the same run (11.5s), because by then the workspace routes
had already been compiled.

### Root cause

**Next.js on-demand route compilation in `next dev`, unguarded by any application-readiness gate,
measured against Playwright's default 5s `expect` timeout.**

Playwright's `webServer.url` gate is `/api/health`, which deliberately touches neither Postgres nor
any application route. "Server ready" therefore only proved that _one trivial route_ had compiled.
Immediately after the click on a search result, the run had to pay two chained first-compiles before
`data-testid="property-detail"` could ever exist:

1. the `/[locale]/properties/[listingId]` page segment, and
2. the `/api/v1/properties/[listingId]` route that `PropertyDetailClient` fetches in `useEffect`
   (the page renders `Loading…` until that response arrives).

Measured cold-start probe against a freshly started dev server (fresh `.next`, e2e database already
migrated and seeded):

| First request                    | Cold    | Warm repeat |
| -------------------------------- | ------- | ----------- |
| `GET /api/health`                | 5427 ms | —           |
| `GET /en/search`                 | 8784 ms | —           |
| `GET /en/properties/[id]` (HTML) | 3776 ms | 353 ms      |
| `GET /api/v1/properties/[id]`    | 4119 ms | 241 ms      |
| `GET /en/workspace/shortlists`   | 2824 ms | —           |
| `GET /en/workspace/compare`      | 2918 ms | —           |
| `GET /ar/workspace`              | 3294 ms | —           |

The click-to-visible path therefore cost **~7.9s cold** (3776 + 4119) against a **5000 ms** default
assertion timeout, versus **~0.6s warm**. The failure was a genuine readiness gap, not flakiness.

### Ruled out

| Candidate                    | Ruled out because                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Playwright `webServer` start | `/api/health` answered in 5.4s against a 120s budget; the server was up long before the failure                       |
| PostgreSQL startup           | `db:reset:e2e` completed successfully before Playwright started; Postgres runs as a pre-existing local service        |
| Migrations / seeding         | `[reset-e2e-db] ready (migrated + seeded + legacy snapshot)` printed before the run; the search page rendered results |
| Property API logic           | Same request returned 200 in 241 ms once compiled; no query, connection or serialization defect                       |
| Navigation timing            | The navigation itself completed; the page was rendering its own `Loading…` state, i.e. correct app behaviour          |
| Application defect           | None found; warm behaviour is correct and fast                                                                        |

The only contributing test-side factor was the **default 5s `expect` timeout** applied to a step
whose cold cost is dominated by dev-server compilation.

## 3. Exact fix

No sleeps were introduced, and no assertion was weakened or removed.

1. **New `app-ready` setup project** — `apps/web/e2e/app-ready.setup.ts`, wired as a project
   dependency of `chromium` in `apps/web/playwright.config.ts`. It runs after `globalSetup`
   (database reset) and before every spec, and turns "the server answered once" into "every route
   the journeys touch is compiled and serving real data":
   - polls `/api/health` until HTTP 200 (application readiness);
   - polls `/api/v1/properties?limit=1` until it returns a real seeded listing id, which proves
     migrations, seed and the property API are all live (an empty or unmigrated database fails here
     instead of surfacing later as a UI timeout);
   - issues a warm-up request for `/en/search`, `/en/workspace`, `/en/workspace/shortlists`,
     `/en/workspace/compare`, `/ar/workspace`, `/en/properties/{id}` and
     `/api/v1/properties/{id}`, asserting HTTP 200 for each.
2. **Deterministic readiness inside the journey** — `openPropertyDetail()` in
   `buyer-workspace.spec.ts` now waits for the `/api/v1/properties/{id}` response to complete
   (`page.waitForResponse`, status 200) as part of the click, then asserts
   `getByTestId('property-detail')` is visible. The assertion is unchanged; it is simply no longer
   racing an in-flight fetch.
3. **Separated timeout budgets** in `playwright.config.ts`:
   - `webServer.timeout: 120_000` — server startup only;
   - `app-ready` readiness/warm-up budget: `180_000` per readiness poll and warm-up request, sized
     from the measured cold compiles above;
   - `expect: { timeout: 15_000 }` — per-assertion budget for an already-compiled application,
     justified by measured warm behaviour (~0.6s for the slowest step) rather than by cold
     compilation. Per-assertion `{ timeout: 15_000 }` overrides in the spec were removed as
     redundant.
4. **Retries stay at `0`, including CI.** With on-demand compilation, a retry would repeat a _warm_
   run and could mask a consistently failing first run, so the readiness gate — not a retry —
   absorbs cold start.

## 4. Cold-start timings, before and after

| Measurement                                                          | Before                                       | After                                 |
| -------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------- |
| Cold `buyer-workspace.spec.ts` result                                | 1 failed, 1 passed                           | 2 passed                              |
| Failing step                                                         | `property-detail` not visible within 5000 ms | n/a                                   |
| Click-to-visible cost on first property detail                       | ~7.9 s vs 5 s budget                         | paid once in `app-ready`, then ~0.6 s |
| Cold wall-clock for the spec (incl. db reset, server start, warm-up) | 88.9 s (failing)                             | 95.9 s – 104.9 s (passing)            |
| `Arabic workspace RTL` duration                                      | 11.5 s                                       | 2.7 s – 5.1 s                         |
| `app-ready` setup duration (cold)                                    | n/a                                          | 25.8 s – 31.9 s                       |

## 5. Runs performed

Retries disabled (`retries: 0`) for every run below. "Cold" means `apps/web/.next` deleted and no
dev server running; every run also recreates the e2e database via `globalSetup`.

| Run                                | Result    | Wall clock |
| ---------------------------------- | --------- | ---------- |
| cold 1                             | pass      | 97.4 s     |
| cold 2                             | pass      | 95.9 s     |
| cold 3                             | pass      | 103.9 s    |
| cold 4                             | pass      | 104.9 s    |
| cold 5                             | pass      | 96.7 s     |
| warm 1                             | pass      | 95.1 s     |
| warm 2                             | pass      | 109.4 s    |
| full suite (`pnpm test:e2e`), cold | 16 passed | 215.6 s    |

**Five consecutive clean cold-start executions of the Phase 4A buyer journey passed, with zero
failures across all seven journey runs.**

Other gates, all passing: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm test:db`.

## 6. Remaining limitations

1. The suite runs against `next dev`, so first-request compilation cost is inherent; it is now paid
   inside an explicit readiness step instead of inside an assertion. A production-build e2e mode
   (`next build && next start`) would remove the cost entirely and is not part of Phase 4A.
2. The `app-ready` warm-up covers the routes the current journeys visit. A new route added to a spec
   without being added to `STATIC_ROUTES` would again pay its first compile inside an assertion,
   though the 15s assertion budget now absorbs a single ~3s page compile.
3. `expect.timeout` is 15s, above Playwright's 5s default. It is justified by measured warm timings
   and paired with deterministic readiness, but it does slow down the reporting of a genuinely
   broken locator.
4. Retries remain disabled everywhere. Real infrastructure flakiness (for example a port collision)
   will fail the run rather than being retried — a deliberate trade to keep first-run failures
   visible.
5. Timings were measured on one Windows developer machine; absolute numbers will differ on CI, which
   is why readiness is expressed as polling with generous budgets rather than fixed waits.
