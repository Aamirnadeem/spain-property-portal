import { expect, test, type Page } from '@playwright/test';
import { BUYER_DEMO_USER_ID } from '@spain/database';
import {
  FAKE_SESSION_COOKIE,
  createFakeSessionCookie,
} from '@spain/communications/auth/fake-session';

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

test.describe('Phase 4C comparison shares', () => {
  test.setTimeout(180_000);

  test('create 7-day share → anonymous view → no notes/identity → revoke → unavailable', async ({
    page,
    browser,
    baseURL,
  }) => {
    const listRes = await page.request.get('/api/v1/properties?limit=2');
    expect(listRes.ok()).toBeTruthy();
    const listBody = (await listRes.json()) as { items: Array<{ id: string }> };
    expect(listBody.items.length).toBeGreaterThanOrEqual(2);
    const id1 = listBody.items[0]!.id;
    const id2 = listBody.items[1]!.id;

    const buyerCookie = await mintSession(BUYER_DEMO_USER_ID);
    await setSessionCookie(page, buyerCookie, baseURL);

    // Private note must never appear on the public share
    await page.request.put(`/api/v1/me/notes/properties/${id1}`, {
      data: { body: 'SECRET_PRIVATE_NOTE_4C', positives: [], negatives: [] },
    });

    await page.goto(`/en/workspace/compare?id=${id1}&id=${id2}`);
    await expect(page.getByTestId('comparison-page')).toBeVisible();

    await page.getByTestId('open-share-dialog').click();
    await expect(page.getByTestId('share-dialog')).toBeVisible();
    await page.getByTestId('share-title').fill('Family shortlist');
    await page.getByTestId('share-expiry').selectOption('7d');
    await page.getByTestId('create-share').click();
    await expect(page.getByTestId('share-link')).toBeVisible({ timeout: 20_000 });
    const publicUrl = await page.getByTestId('share-link').inputValue();
    expect(publicUrl).toContain('/en/shared-comparison/');

    const sharesRes = await page.request.get('/api/v1/me/comparison-shares');
    expect(sharesRes.ok()).toBeTruthy();
    const sharesBody = (await sharesRes.json()) as { items: Array<{ id: string; status: string }> };
    const active = sharesBody.items.find((s) => s.status === 'active');
    expect(active).toBeTruthy();

    const anon = await browser.newContext();
    const anonPage = await anon.newPage();
    await anonPage.goto(publicUrl);
    await expect(anonPage.getByTestId('shared-comparison-page')).toBeVisible({ timeout: 30_000 });
    const anonText = await anonPage.getByTestId('shared-comparison-page').innerText();
    expect(anonText).not.toContain('SECRET_PRIVATE_NOTE_4C');
    expect(anonText.toLowerCase()).not.toMatch(/buyer@|@example\.com|user_id|guest_id/);
    expect(anonText).not.toMatch(/BUYER_DEMO|demo-buyer/i);

    const publicApi = await anonPage.request.get(
      `/api/v1/compare/shared/${publicUrl.split('/shared-comparison/')[1]}`,
    );
    expect(publicApi.status()).toBe(200);
    const dto = (await publicApi.json()) as Record<string, unknown>;
    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain('SECRET_PRIVATE_NOTE_4C');
    expect(serialized).not.toMatch(/"userId"|"buyerEmail"|"guestId"|"notes"/i);
    expect(dto.schemaVersion).toBe('phase4c.v1');

    await page.getByTestId(`revoke-share-${active!.id}`).click();
    const revokeRes = await page.request.post(`/api/v1/me/comparison-shares/${active!.id}/revoke`);
    expect(revokeRes.ok()).toBeTruthy();
    await expect
      .poll(async () => {
        const r = await page.request.get('/api/v1/me/comparison-shares');
        const body = (await r.json()) as { items: Array<{ id: string; status: string }> };
        return body.items.find((s) => s.id === active!.id)?.status;
      })
      .toBe('revoked');

    await anonPage.reload();
    await expect(anonPage.getByTestId('shared-comparison-unavailable')).toBeVisible({
      timeout: 20_000,
    });
    const afterRevoke = await anonPage.request.get(
      `/api/v1/compare/shared/${publicUrl.split('/shared-comparison/')[1]}`,
    );
    expect(afterRevoke.status()).toBe(404);
    expect(await afterRevoke.json()).toEqual({ error: 'unavailable' });

    await anon.close();
  });
});
