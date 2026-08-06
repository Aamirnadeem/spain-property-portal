import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession, type AppSession } from './session';

/** Require a verified session before rendering a protected HTML route. */
export async function requirePageSession(locale: string): Promise<AppSession> {
  const requestHeaders = await headers();
  const session = await getSession(
    new Request('http://localhost', {
      headers: new Headers(requestHeaders),
    }),
  );

  if (!session) {
    redirect(`/${locale}/account`);
  }

  return session;
}
