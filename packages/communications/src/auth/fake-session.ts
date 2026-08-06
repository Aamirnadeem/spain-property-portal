import { createHmac, timingSafeEqual } from 'crypto';

export const FAKE_SESSION_COOKIE = 'spain_session';
export const FAKE_SESSION_TTL_SECONDS = 8 * 60 * 60;
export const FAKE_SESSION_VERSION = 1;

export interface FakeSessionPayload {
  sub: string;
  exp: number;
  v: number;
}

export class FakeSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FakeSessionError';
  }
}

function requireSecret(secret: string | undefined): string {
  const resolved =
    secret ??
    process.env.FAKE_SESSION_SECRET ??
    (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
      ? 'dev-only-fake-session-secret'
      : undefined);
  if (!resolved || resolved.length < 16) {
    throw new FakeSessionError('FAKE_SESSION_SECRET must be at least 16 characters');
  }
  return resolved;
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

function encodePayload(payload: FakeSessionPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePayload(encoded: string): FakeSessionPayload {
  const json = Buffer.from(encoded, 'base64url').toString('utf8');
  const parsed = JSON.parse(json) as FakeSessionPayload;
  if (
    typeof parsed.sub !== 'string' ||
    typeof parsed.exp !== 'number' ||
    typeof parsed.v !== 'number'
  ) {
    throw new FakeSessionError('invalid_session_payload');
  }
  return parsed;
}

/** Mint a sealed FakeAuth session cookie value for local/test only. */
export function sealFakeSession(
  userId: string,
  options: { secret?: string; nowSeconds?: number; ttlSeconds?: number } = {},
): string {
  const secret = requireSecret(options.secret ?? process.env.FAKE_SESSION_SECRET);
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ttl = options.ttlSeconds ?? FAKE_SESSION_TTL_SECONDS;
  const payload: FakeSessionPayload = {
    sub: userId,
    exp: now + ttl,
    v: FAKE_SESSION_VERSION,
  };
  const body = encodePayload(payload);
  return `${body}.${sign(body, secret)}`;
}

/** Verify a sealed FakeAuth session cookie; returns user id or null if invalid/expired. */
export function verifyFakeSession(
  token: string | null | undefined,
  options: { secret?: string; nowSeconds?: number } = {},
): string | null {
  if (!token) return null;
  const secret = requireSecret(options.secret ?? process.env.FAKE_SESSION_SECRET);
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, mac] = parts;
  const expected = sign(body, secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = decodePayload(body);
    if (payload.v !== FAKE_SESSION_VERSION) return null;
    if (!/^[0-9a-f-]{36}$/i.test(payload.sub)) return null;
    const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/** Playwright / unit helper: build Set-Cookie-ready sealed value for a seed user. */
export function createFakeSessionCookie(
  userId: string,
  options: { secret?: string; nowSeconds?: number; ttlSeconds?: number } = {},
): string {
  return sealFakeSession(userId, options);
}
