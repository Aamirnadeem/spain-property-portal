import { describe, expect, it } from 'vitest';
import { createFakeSessionCookie, sealFakeSession, verifyFakeSession } from './fake-session';

const secret = 'test-fake-session-secret-32b';

describe('FakeAuth sealed session', () => {
  it('rounds trips a valid session', () => {
    const userId = '44444444-4444-4444-8444-444444444444';
    const token = createFakeSessionCookie(userId, { secret, nowSeconds: 1_000_000 });
    expect(verifyFakeSession(token, { secret, nowSeconds: 1_000_000 })).toBe(userId);
  });

  it('rejects expired sessions', () => {
    const token = sealFakeSession('44444444-4444-4444-8444-444444444444', {
      secret,
      nowSeconds: 1_000,
      ttlSeconds: 10,
    });
    expect(verifyFakeSession(token, { secret, nowSeconds: 1_020 })).toBeNull();
  });

  it('rejects tampered payloads', () => {
    const token = sealFakeSession('44444444-4444-4444-8444-444444444444', { secret });
    const [body] = token.split('.');
    expect(verifyFakeSession(`${body}.deadbeef`, { secret })).toBeNull();
  });
});
