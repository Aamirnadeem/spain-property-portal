import {
  isHeaderAuthAllowed,
  readAuthRuntimeConfig,
  SupabaseAuthProvider,
  type ProviderSessionTokens,
} from '@spain/communications';
import {
  FAKE_SESSION_COOKIE,
  FAKE_SESSION_TTL_SECONDS,
  sealFakeSession,
  verifyFakeSession,
} from '@spain/communications/auth/fake-session';
import { authProvider } from './auth-runtime';

export const LEGACY_USER_ID_COOKIE = 'spain_user_id';
export const SUPABASE_ACCESS_COOKIE = 'spain_sb_access';
export const SUPABASE_REFRESH_COOKIE = 'spain_sb_refresh';

export interface AppSession {
  userId: string;
  provider: 'fake' | 'supabase' | 'header_escape';
}

function cookieMap(request: Request): Map<string, string> {
  const header = request.headers.get('cookie') ?? '';
  const map = new Map<string, string>();
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq);
    const value = decodeURIComponent(trimmed.slice(eq + 1));
    map.set(name, value);
  }
  return map;
}

function isSecureCookie(): boolean {
  return process.env.NODE_ENV === 'production';
}

function sessionCookieOptions(maxAgeSeconds: number): string {
  const secure = isSecureCookie() ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

function clearCookieOptions(): string {
  const secure = isSecureCookie() ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

/** Read a verified session from AuthProvider cookies (or local header escape hatch). */
export async function getSession(request: Request): Promise<AppSession | null> {
  const cookies = cookieMap(request);
  const config = readAuthRuntimeConfig();
  const providerName = authProvider.name;

  if (providerName === 'fake') {
    try {
      const userId = verifyFakeSession(cookies.get(FAKE_SESSION_COOKIE));
      if (userId) return { userId, provider: 'fake' };
    } catch {
      // Misconfigured secret → treat as no session (fail closed for protected routes).
      return null;
    }
  }

  if (providerName === 'supabase') {
    const access = cookies.get(SUPABASE_ACCESS_COOKIE);
    if (access && authProvider instanceof SupabaseAuthProvider) {
      const user = await authProvider.getUserFromAccessToken(access);
      if (user) return { userId: user.id, provider: 'supabase' };
    }
  }

  if (isHeaderAuthAllowed(config)) {
    const header = request.headers.get('x-user-id');
    if (header && /^[0-9a-f-]{36}$/i.test(header)) {
      return { userId: header, provider: 'header_escape' };
    }
    const legacy = cookies.get(LEGACY_USER_ID_COOKIE);
    if (legacy && /^[0-9a-f-]{36}$/i.test(legacy)) {
      return { userId: legacy, provider: 'header_escape' };
    }
  }

  return null;
}

/** Append FakeAuth session Set-Cookie headers to a NextResponse-like headers bag. */
export function appendFakeSessionCookie(headers: Headers, userId: string): void {
  const value = sealFakeSession(userId);
  headers.append(
    'Set-Cookie',
    `${FAKE_SESSION_COOKIE}=${encodeURIComponent(value)}; ${sessionCookieOptions(FAKE_SESSION_TTL_SECONDS)}`,
  );
  // Clear non-authoritative legacy cookie if present.
  headers.append('Set-Cookie', `${LEGACY_USER_ID_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`);
}

export function appendSupabaseSessionCookies(
  headers: Headers,
  tokens: ProviderSessionTokens,
): void {
  const maxAge = tokens.expiresAt
    ? Math.max(60, tokens.expiresAt - Math.floor(Date.now() / 1000))
    : 60 * 60;
  headers.append(
    'Set-Cookie',
    `${SUPABASE_ACCESS_COOKIE}=${encodeURIComponent(tokens.accessToken)}; ${sessionCookieOptions(maxAge)}`,
  );
  headers.append(
    'Set-Cookie',
    `${SUPABASE_REFRESH_COOKIE}=${encodeURIComponent(tokens.refreshToken)}; ${sessionCookieOptions(60 * 60 * 24 * 30)}`,
  );
  headers.append('Set-Cookie', `${LEGACY_USER_ID_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`);
}

export function appendClearSessionCookies(headers: Headers): void {
  headers.append('Set-Cookie', `${FAKE_SESSION_COOKIE}=; ${clearCookieOptions()}`);
  headers.append('Set-Cookie', `${SUPABASE_ACCESS_COOKIE}=; ${clearCookieOptions()}`);
  headers.append('Set-Cookie', `${SUPABASE_REFRESH_COOKIE}=; ${clearCookieOptions()}`);
  headers.append('Set-Cookie', `${LEGACY_USER_ID_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`);
}

export { FAKE_SESSION_COOKIE };
