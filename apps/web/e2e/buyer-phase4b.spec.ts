import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { BUYER_DEMO_USER_ID, ORG_AGENT_USER_ID, PLATFORM_ADMIN_USER_ID } from '@spain/database';
import {
  FAKE_SESSION_COOKIE,
  createFakeSessionCookie,
} from '@spain/communications/auth/fake-session';

const PROPERTY_DETAIL_API = /\/api\/v1\/properties\/[0-9a-f-]{36}$/i;
const FIXTURE_CSV = path.resolve(
  __dirname,
  '../../../data/fixtures/partner/spain-partner-v1-valid.csv',
);

async function mintSession(userId: string): Promise<string> {
  return createFakeSessionCookie(userId, {
    secret: process.env.FAKE_SESSION_SECRET ?? 'dev-only-fake-session-secret',
  });
}

async function setSessionCookie(
  page: Page,
  value: string,
  baseURL: string | undefined,
): Promise<void> {
  const host = new URL(baseURL ?? 'http://127.0.0.1:3100').hostname;
  await page.context().addCookies([
    {
      name: FAKE_SESSION_COOKIE,
      value,
      domain: host,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

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

test.describe('Phase 4B saved searches / history / alerts', () => {
  test.setTimeout(180_000);

  test('anonymous → save → history → auth merge → listing change → one notification → persist', async ({
    page,
    context,
    baseURL,
  }) => {
    // Authorized non-legacy listing for price-change alerts
    const agentCookie = await mintSession(ORG_AGENT_USER_ID);
    await setSessionCookie(page, agentCookie, baseURL);
    await page.goto('/en/partner/imports');
    await page.getByTestId('partner-csv-input').setInputFiles(FIXTURE_CSV);
    await page.getByTestId('partner-run-import').click();
    await expect(page.getByTestId('partner-import-report')).toBeVisible({ timeout: 20_000 });

    const adminCookie = await mintSession(PLATFORM_ADMIN_USER_ID);
    await context.clearCookies();
    await setSessionCookie(page, adminCookie, baseURL);
    await page.goto('/en/admin/review');
    const publishBtn = page.getByTestId('admin-publish-DEMO-1001');
    if (await publishBtn.isVisible().catch(() => false)) {
      await publishBtn.click();
      await expect(page.getByTestId('admin-review-row-DEMO-1001')).not.toBeVisible({
        timeout: 20_000,
      });
    }

    await context.clearCookies();

    // Anonymous: search + save
    await page.goto('/en/search');
    await expect(page.getByTestId('property-search')).toBeVisible();
    await page.getByTestId('search-query').fill('Sagrada Familia');
    await page.getByRole('button', { name: /Apply/i }).click();
    await expect(page.locator('.property-card a').first()).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('save-search-button').click();
    await page.getByTestId('save-search-name').fill('Sagrada watch');
    await page.getByTestId('save-search-confirm').click();
    await expect(page.getByRole('status').filter({ hasText: /saved/i })).toBeVisible();

    // View two properties
    await page.goto('/en/search');
    await openPropertyDetail(page, 0);
    await page.goto('/en/search');
    await openPropertyDetail(page, 1);

    await page.goto('/en/workspace/history');
    await expect(page.getByTestId('workspace-history')).toBeVisible();
    await expect(page.getByTestId('history-item').first()).toBeVisible();
    expect(await page.getByTestId('history-item').count()).toBeGreaterThanOrEqual(2);

    // Authenticate + merge
    const buyerCookie = await mintSession(BUYER_DEMO_USER_ID);
    await setSessionCookie(page, buyerCookie, baseURL);
    const guestSearches = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('spain_guest_saved_searches') ?? '[]'),
    );
    const guestHistory = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('spain_guest_browsing_history') ?? '[]'),
    );
    const mergeRes = await page.request.post('/api/v1/me/workspace/merge', {
      data: {
        favouriteListingIds: [],
        comparisonListingIds: [],
        recentViewListingIds: [],
        savedSearchCriteria: [],
        savedSearches: guestSearches.map(
          (s: {
            name: string;
            criteria: unknown;
            alertsEnabled?: boolean;
            alertTypes?: string[];
          }) => ({
            name: s.name,
            criteria: s.criteria,
            alertsEnabled: s.alertsEnabled ?? false,
            alertTypes: s.alertTypes ?? [],
          }),
        ),
        browsingHistory: guestHistory,
      },
    });
    expect(mergeRes.ok()).toBeTruthy();

    const listRes = await page.request.get('/api/v1/me/saved-searches');
    expect(listRes.ok()).toBeTruthy();
    const listData = (await listRes.json()) as { items: Array<{ id: string; name: string }> };
    expect(listData.items.length).toBeGreaterThanOrEqual(1);
    const searchId = listData.items[0]!.id;

    await page.goto(`/en/workspace/searches/${searchId}`);
    await expect(page.getByTestId('saved-search-detail')).toBeVisible();
    await page.getByTestId('enable-alerts').click();
    await expect(page.getByTestId('enable-alerts')).toBeChecked({ timeout: 15_000 });
    await page.getByTestId('run-evaluation').click();
    await expect(page.getByTestId('evaluation-result')).toBeVisible({ timeout: 20_000 });

    // Authorized price reduction → exactly one in-app notification
    await context.clearCookies();
    await setSessionCookie(page, agentCookie, baseURL);
    await page.goto('/en/partner/listings');
    await expect(page.getByTestId('partner-listing-row-DEMO-1001')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('partner-price-input-DEMO-1001').fill('350000');
    await page.getByTestId('partner-update-price-DEMO-1001').click();
    await expect(page.getByTestId('partner-listing-row-DEMO-1001')).toContainText('350,000', {
      timeout: 20_000,
    });

    await context.clearCookies();
    await setSessionCookie(page, buyerCookie, baseURL);
    await page.goto('/en/workspace/notifications');
    await expect(page.getByTestId('workspace-notifications')).toBeVisible();
    await expect(page.getByTestId('notification-item')).toHaveCount(1, { timeout: 20_000 });

    await page.getByTestId('notification-link').first().click();
    await expect(page.getByTestId('property-detail')).toBeVisible({ timeout: 20_000 });

    await page.goto('/en/workspace/notifications');
    await page.getByTestId('mark-read').first().click();
    await expect(page.getByTestId('notification-item').first()).toHaveAttribute(
      'data-read',
      'true',
    );

    // Sign out / sign back in — persistence
    await page.request.post('/api/v1/auth/logout');
    await context.clearCookies();
    await setSessionCookie(page, buyerCookie, baseURL);

    await page.goto('/en/workspace/searches');
    await expect(page.getByTestId('saved-search-link').first()).toBeVisible();
    await page.goto('/en/workspace/history');
    await expect(page.getByTestId('history-item').first()).toBeVisible();
    await page.goto('/en/workspace/notifications');
    await expect(page.getByTestId('notification-item')).toHaveCount(1);
    await expect(page.getByTestId('notification-item').first()).toHaveAttribute(
      'data-read',
      'true',
    );
  });

  test('Arabic workspace RTL for Phase 4B pages', async ({ page }) => {
    await page.goto('/ar/workspace/searches');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('workspace-searches')).toBeVisible();
    await page.goto('/ar/workspace/history');
    await expect(page.getByTestId('workspace-history')).toBeVisible();
    await page.goto('/ar/workspace/notifications');
    await expect(page.getByTestId('workspace-notifications')).toBeVisible();
  });
});
