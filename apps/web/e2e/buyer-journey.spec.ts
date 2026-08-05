import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Phase 2 buyer journey', () => {
  test('search → detail → favourite, with RTL locale shell', async ({ page }) => {
    await page.goto('/en/search');
    await expect(page.getByTestId('property-search')).toBeVisible();
    await expect(page.locator('.property-card a').first()).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('search-query').fill('Eixample');
    await page.getByRole('button', { name: /Apply/i }).click();
    await expect(page).toHaveURL(/q=Eixample/);
    const firstCard = page.locator('.property-card a').first();
    await expect(firstCard).toBeVisible({ timeout: 30_000 });
    await Promise.all([page.waitForURL(/\/en\/properties\//), firstCard.click()]);
    await expect(page.getByTestId('property-detail')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.freshness-warning')).toContainText(/historical snapshot/i);
    await expect(page.getByText('Legacy snapshot')).toBeVisible();
    await page.getByTestId('favourite-toggle').click();
    await page.goto('/en/favourites');
    await expect(page.getByTestId('favourites-page')).toBeVisible();
    await expect(page.locator('.property-card a').first()).toBeVisible({ timeout: 15_000 });

    await page.goto('/ar/search');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('primary journey has no critical accessibility violations', async ({ page }) => {
    await page.goto('/en/search');
    await expect(page.getByTestId('property-search')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toEqual([]);
  });
});
