import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE_CSV = path.resolve(
  __dirname,
  '../../../data/fixtures/partner/spain-partner-v1-valid.csv',
);

/**
 * Signs in as a seeded demo identity through the dev switcher, which mints a sealed HttpOnly
 * FakeAuth session server-side. The switcher only wires up its click handler once React has
 * hydrated, and its mount-time /api/v1/auth/session request is the observable proof of that,
 * so wait for it before clicking instead of racing dev-mode compilation.
 */
async function signInAs(
  page: import('@playwright/test').Page,
  path: string,
  identityTestId: string,
  expectedUserIdFragment: string,
): Promise<void> {
  const hydrated = page.waitForResponse((res) => res.url().includes('/api/v1/auth/session'), {
    timeout: 60_000,
  });
  await page.goto(path);
  await hydrated;
  await page.getByTestId(identityTestId).click();
  await expect(page.getByTestId('dev-identity-switcher')).toContainText(expectedUserIdFragment, {
    timeout: 20_000,
  });
}

test.describe('Phase 3 agency CSV → admin publish → public search', () => {
  test.describe.configure({ mode: 'serial' });

  test('agency uploads CSV, admin publishes, buyer finds it, agency updates price and withdraws', async ({
    page,
  }) => {
    // 1. Agency signs in (FakeAuth sealed session via DevIdentitySwitcher) and uploads CSV.
    await signInAs(page, '/en/partner', 'dev-identity-orgAgent', '55555555');
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
    await signInAs(page, '/en/admin', 'dev-identity-platformAdmin', '66666666');
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
    await signInAs(page, '/en/partner', 'dev-identity-orgAgent', '55555555');
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
