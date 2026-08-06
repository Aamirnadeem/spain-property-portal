import { expect, test, type Page } from '@playwright/test';
import { BUYER_DEMO_USER_ID } from '@spain/database';
import {
  FAKE_SESSION_COOKIE,
  createFakeSessionCookie,
} from '@spain/communications/auth/fake-session';

const PROPERTY_DETAIL_API = /\/api\/v1\/properties\/[0-9a-f-]{36}$/i;

/**
 * The detail page renders "Loading…" until its client component has fetched the listing, so the
 * only meaningful readiness signal is that request completing. Waiting on it (rather than on a
 * locator timeout) keeps the assertion below deterministic.
 */
async function openPropertyDetail(page: Page, linkIndex: number): Promise<string> {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        PROPERTY_DETAIL_API.test(new URL(response.url()).pathname) && response.status() === 200,
    ),
    page.locator('a[href*="/properties/"]').nth(linkIndex).click(),
  ]);
  await expect(page.getByTestId('property-detail')).toBeVisible();
  return page.url().split('/properties/')[1]!.split('?')[0]!;
}

test.describe('Phase 4A buyer workspace journey', () => {
  test.setTimeout(120_000);

  test('guest shortlist → compare → auth merge → persistence', async ({
    page,
    context,
    baseURL,
  }) => {
    // Create shortlist first via workspace UI
    await page.goto('/en/workspace/shortlists');
    await page.getByTestId('shortlist-name-input').fill('Barcelona apartments');
    await page.getByTestId('create-shortlist').click();
    await expect(page.getByTestId('shortlist-link').first()).toBeVisible();

    await page.goto('/en/search');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const id1 = await openPropertyDetail(page, 0);
    await page.getByTestId('add-to-shortlist').click();
    await page.getByTestId('shortlist-picker').getByRole('button').first().click();

    await page.goto('/en/search');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const id2 = await openPropertyDetail(page, 1);
    await page.getByTestId('add-to-shortlist').click();
    await page.getByTestId('shortlist-picker').getByRole('button').first().click();

    // Open comparison directly with selected listing ids (guest matrix + weights)
    await page.goto(`/en/workspace/compare?id=${id1}&id=${id2}`);
    await expect(page.getByTestId('comparison-page')).toBeVisible();
    await page.getByTestId('weight-price').fill('10');
    await page.getByTestId('weight-size').fill('2');
    await page.getByTestId('run-compare').click();
    await expect(page.getByTestId('comparison-table')).toBeVisible();
    await expect(page.getByTestId('score-disclaimer')).toBeVisible();

    // Notes on shortlist detail
    await page.goto('/en/workspace/shortlists');
    await page.getByTestId('shortlist-link').first().click();
    await expect(page.getByTestId('shortlist-detail')).toBeVisible();
    await page.getByTestId('shortlist-note').fill('Final family shortlist');
    const noteBoxes = page.locator('[data-testid^="property-note-"]');
    if ((await noteBoxes.count()) > 0) {
      await noteBoxes.first().fill('Bright rooms');
    }

    const value = createFakeSessionCookie(BUYER_DEMO_USER_ID, {
      secret: process.env.FAKE_SESSION_SECRET ?? 'dev-only-fake-session-secret',
    });
    const host = new URL(baseURL ?? 'http://127.0.0.1:3100').hostname;
    await context.addCookies([
      {
        name: FAKE_SESSION_COOKIE,
        value,
        domain: host,
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    const mergeRes = await page.request.post('/api/v1/me/workspace/merge', {
      data: {
        favouriteListingIds: [id1, id2],
        shortlists: [
          {
            name: 'Barcelona apartments',
            listingIds: [id1, id2],
            note: 'Final family shortlist',
          },
        ],
        propertyNotes: [{ listingId: id1, body: 'Bright rooms' }],
        comparisonListingIds: [id1, id2],
        recentViewListingIds: [],
        savedSearchCriteria: [],
      },
    });
    expect(mergeRes.ok()).toBeTruthy();

    await page.goto('/en/workspace/shortlists');
    await expect(page.getByTestId('workspace-shortlists')).toBeVisible();
    await expect(page.getByTestId('shortlist-link').first()).toBeVisible();

    await page.request.post('/api/v1/auth/logout');
    await context.clearCookies();

    await context.addCookies([
      {
        name: FAKE_SESSION_COOKIE,
        value,
        domain: host,
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    await page.goto('/en/workspace/shortlists');
    await expect(page.getByTestId('shortlist-link').first()).toBeVisible();
  });

  test('Arabic workspace RTL', async ({ page }) => {
    await page.goto('/ar/workspace');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('workspace-shortlists')).toBeVisible();
  });
});
