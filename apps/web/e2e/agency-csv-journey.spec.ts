import path from 'node:path';
import { test, expect } from '@playwright/test';
import {
  FAKE_SESSION_COOKIE,
  createFakeSessionCookie,
} from '@spain/communications/auth/fake-session';

const FIXTURE_CSV = path.resolve(
  __dirname,
  '../../../data/fixtures/partner/spain-partner-v1-valid.csv',
);

const ORG_AGENT = '55555555-5555-4555-8555-555555555555';
const PLATFORM_ADMIN = '66666666-6666-4666-8666-666666666666';

/**
 * Partner/admin HTML routes require a verified session (Phase 3.1 page gate).
 * Mint a FakeAuth cookie before navigation instead of relying on DevIdentitySwitcher
 * while unauthenticated (that path redirects to account).
 */
async function signInAs(
  page: import('@playwright/test').Page,
  path: string,
  userId: string,
  baseURL: string | undefined,
): Promise<void> {
  const value = createFakeSessionCookie(userId, {
    secret: process.env.FAKE_SESSION_SECRET ?? 'dev-only-fake-session-secret',
  });
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
  await page.goto(path);
  await expect(page).not.toHaveURL(/\/account/);
}

test.describe('Phase 3 agency CSV → admin publish → public search', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test('agency uploads CSV, admin publishes, buyer finds it, agency updates price and withdraws', async ({
    page,
    baseURL,
  }) => {
    // 1. Agency signs in (FakeAuth sealed session) and uploads CSV.
    await signInAs(page, '/en/partner', ORG_AGENT, baseURL);
    await page.goto('/en/partner/imports');
    await page.getByTestId('partner-csv-input').setInputFiles(FIXTURE_CSV);
    await page.getByTestId('partner-run-import').click();
    await expect(page.getByTestId('partner-import-report')).toBeVisible({ timeout: 20_000 });

    // 2. New listings land in the agency's own inventory as pending review (not public yet).
    await page.goto('/en/partner/listings');
    await expect(page.getByTestId('partner-listing-row-DEMO-1001')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('partner-listing-row-DEMO-1001')).toContainText(
      'pending_review',
      { timeout: 20_000 },
    );

    // 3. A buyer cannot find the unpublished listing yet.
    await page.goto('/en/search');
    await page.getByTestId('search-query').fill('Sagrada Familia');
    await page.getByRole('button', { name: /Apply/i }).click();
    await expect(page.getByTestId('search-empty')).toBeVisible({ timeout: 20_000 });

    // 4. Admin reviews the queue and publishes it.
    await signInAs(page, '/en/admin', PLATFORM_ADMIN, baseURL);
    await page.goto('/en/admin/review');
    await expect(page.getByTestId('admin-review-row-DEMO-1001')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('admin-publish-DEMO-1001').click();
    await expect(page.getByTestId('admin-review-row-DEMO-1001')).not.toBeVisible({
      timeout: 20_000,
    });

    // 5. The buyer now finds the published listing via public search.
    await page.goto('/en/search');
    await page.getByTestId('search-query').fill('Sagrada Familia');
    await page.getByRole('button', { name: /Apply/i }).click();
    await expect(page.locator('.property-card a').first()).toBeVisible({ timeout: 20_000 });

    // 6. Agency self-service: update the price on the now-published listing.
    await signInAs(page, '/en/partner', ORG_AGENT, baseURL);
    await page.goto('/en/partner/listings');
    await expect(page.getByTestId('partner-listing-row-DEMO-1001')).toContainText('available', {
      timeout: 20_000,
    });
    await page.getByTestId('partner-price-input-DEMO-1001').fill('399000');
    await page.getByTestId('partner-update-price-DEMO-1001').click();
    await expect(page.getByTestId('partner-listing-row-DEMO-1001')).toContainText('399,000', {
      timeout: 20_000,
    });

    // 7. Agency withdraws the listing.
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('partner-withdraw-DEMO-1001').click();
    await expect(page.getByTestId('partner-listing-row-DEMO-1001')).toContainText('withdrawn', {
      timeout: 20_000,
    });

    // 8. The buyer can no longer find the withdrawn listing.
    await page.goto('/en/search');
    await page.getByTestId('search-query').fill('Sagrada Familia');
    await page.getByRole('button', { name: /Apply/i }).click();
    await expect(page.getByTestId('search-empty')).toBeVisible({ timeout: 20_000 });
  });
});
