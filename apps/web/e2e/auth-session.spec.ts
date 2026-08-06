import { test, expect } from '@playwright/test';
import {
  FAKE_SESSION_COOKIE,
  createFakeSessionCookie,
} from '@spain/communications/auth/fake-session';

const ORG_AGENT = '55555555-5555-4555-8555-555555555555';
const ORG_VIEWER = '88888888-8888-4888-8888-888888888888';
const PLATFORM_ADMIN = '66666666-6666-4666-8666-666666666666';
const FOREIGN_USER = '11111111-1111-4111-8111-111111111111';

async function setFakeSession(
  page: import('@playwright/test').Page,
  userId: string,
  baseURL: string | undefined,
): Promise<void> {
  const value = createFakeSessionCookie(userId, {
    secret: process.env.FAKE_SESSION_SECRET ?? 'dev-only-fake-session-secret',
  });
  await page.context().addCookies([
    {
      name: FAKE_SESSION_COOKIE,
      value,
      domain: new URL(baseURL ?? 'http://127.0.0.1:3100').hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

test.describe('Phase 3.1 session authz', () => {
  test('unauthenticated partner and admin pages redirect to locale login', async ({ request }) => {
    const protectedPages = [
      '/en/partner',
      '/en/partner/listings',
      '/en/admin',
      '/en/admin/review',
      '/en/admin/audit',
    ];

    for (const path of protectedPages) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(307);
      expect(res.headers().location, path).toBe('/en/account');
    }
  });

  test('unauthenticated partner API returns 401', async ({ request }) => {
    const res = await request.get('/api/v1/partner/listings');
    expect(res.status()).toBe(401);
  });

  test('forged session cookie is rejected', async ({ request }) => {
    const res = await request.get('/api/v1/partner/listings', {
      headers: { cookie: `${FAKE_SESSION_COOKIE}=not-a-valid-seal` },
    });
    expect(res.status()).toBe(401);
  });

  test('x-user-id alone does not authorize without ALLOW_HEADER_AUTH', async ({ request }) => {
    const res = await request.get('/api/v1/partner/listings', {
      headers: { 'x-user-id': PLATFORM_ADMIN },
    });
    expect(res.status()).toBe(401);
  });

  test('non-member session receives 403 on partner routes', async ({ page, baseURL }) => {
    await setFakeSession(page, FOREIGN_USER, baseURL);
    const res = await page.request.get('/api/v1/partner/listings');
    expect(res.status()).toBe(403);
  });

  test('org viewer can read but not mutate', async ({ page, baseURL }) => {
    await setFakeSession(page, ORG_VIEWER, baseURL);
    const list = await page.request.get('/api/v1/partner/listings');
    expect(list.status()).toBe(200);

    const mutate = await page.request.post('/api/v1/partner/imports', {
      multipart: {
        mode: 'dry_run',
        file: {
          name: 'empty.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from('external_id,title,price_eur,property_type,status\n'),
        },
      },
    });
    expect(mutate.status()).toBe(403);
  });

  test('org agent can read partner listings', async ({ page, baseURL }) => {
    await setFakeSession(page, ORG_AGENT, baseURL);
    const list = await page.request.get('/api/v1/partner/listings');
    expect(list.status()).toBe(200);
  });

  test('logout clears session', async ({ page, baseURL }) => {
    await setFakeSession(page, ORG_AGENT, baseURL);
    const before = await page.request.get('/api/v1/partner/listings');
    expect(before.status()).toBe(200);

    const logout = await page.request.post('/api/v1/auth/logout');
    expect(logout.status()).toBe(204);

    const after = await page.request.get('/api/v1/partner/listings');
    expect(after.status()).toBe(401);
  });

  test('platform admin can open review queue', async ({ page, baseURL }) => {
    await setFakeSession(page, PLATFORM_ADMIN, baseURL);
    const res = await page.request.get('/api/v1/admin/listings');
    expect(res.status()).toBe(200);
  });

  test('org agent cannot call admin publish routes', async ({ page, baseURL }) => {
    await setFakeSession(page, ORG_AGENT, baseURL);
    const res = await page.request.post(
      '/api/v1/admin/listings/11111111-1111-4111-8111-111111111111/publish',
    );
    expect(res.status()).toBe(403);
  });
});
