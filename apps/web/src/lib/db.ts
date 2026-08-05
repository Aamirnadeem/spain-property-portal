import { createDb } from '@spain/database';

export function getAppDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required for property APIs');
  }
  return createDb(url);
}

export function readUserId(request: Request): string | null {
  const header = request.headers.get('x-user-id');
  if (header && /^[0-9a-f-]{36}$/i.test(header)) return header;
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)spain_user_id=([^;]+)/);
  if (match?.[1] && /^[0-9a-f-]{36}$/i.test(match[1])) return match[1];
  return null;
}
