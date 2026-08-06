import { expect, test as setup } from '@playwright/test';

/**
 * Playwright's `webServer.url` gate only proves that `/api/health` answers. In `next dev` every
 * other route is still compiled on demand, so the first navigation of the suite pays a multi-second
 * compile that no UI assertion timeout should have to absorb. This setup project runs after the
 * database reset in global-setup and before any spec, and turns "the server responded once" into
 * "every route the journeys touch is compiled and serving real data".
 */

// Cold compilation is a server-startup cost, deliberately kept separate from the per-assertion
// `expect` timeout so a slow first compile can never be mistaken for a broken page.
const READINESS_TIMEOUT_MS = 180_000;

const STATIC_ROUTES = [
  '/en/search',
  '/en/workspace',
  '/en/workspace/shortlists',
  '/en/workspace/compare',
  '/ar/workspace',
];

setup('application and database are ready', async ({ request, baseURL }) => {
  setup.setTimeout(READINESS_TIMEOUT_MS + 60_000);

  await expect
    .poll(async () => (await request.get('/api/health')).status(), {
      message: `application did not become healthy at ${baseURL}`,
      timeout: READINESS_TIMEOUT_MS,
    })
    .toBe(200);

  // Proves migrations, seed and the property API are all live: a healthy app with an empty or
  // unmigrated database would answer here with a non-200 or an empty page of results.
  let listingId: string | null = null;
  await expect
    .poll(
      async () => {
        const response = await request.get('/api/v1/properties?limit=1', {
          timeout: READINESS_TIMEOUT_MS,
        });
        if (!response.ok()) return null;
        const body = (await response.json()) as { items?: Array<{ id?: string }> };
        listingId = body.items?.[0]?.id ?? null;
        return listingId;
      },
      {
        message: 'seeded listings were not queryable through /api/v1/properties',
        timeout: READINESS_TIMEOUT_MS,
      },
    )
    .not.toBeNull();

  const routes = [
    ...STATIC_ROUTES,
    `/en/properties/${listingId}`,
    `/api/v1/properties/${listingId}`,
  ];

  for (const route of routes) {
    const response = await request.get(route, { timeout: READINESS_TIMEOUT_MS });
    expect(response.status(), `warm-up request for ${route} failed`).toBe(200);
  }
});
