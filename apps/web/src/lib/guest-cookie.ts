export const GUEST_TOKEN_COOKIE = 'spain_guest_token';

export function readGuestToken(request: Request): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)spain_guest_token=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function appendGuestTokenCookie(headers: Headers, token: string): void {
  headers.append(
    'Set-Cookie',
    `${GUEST_TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`,
  );
}
