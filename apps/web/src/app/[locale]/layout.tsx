import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDirection, getMessages, isLocale, locales, type Locale } from '@spain/i18n';
import '@spain/ui/styles.css';
import './phase2.css';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const messages = getMessages(locale);
  const dir = getDirection(locale);

  return (
    <html lang={locale} dir={dir}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&f[]=fraunces@500,600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="site-header">
          <div>
            <strong style={{ fontFamily: 'var(--font-serif)' }}>{messages.appName}</strong>
            <div style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>
              {messages.tagline}
            </div>
          </div>
          <nav className="site-nav">
            <Link href={`/${locale}`}>{messages.nav.home}</Link>
            <Link href={`/${locale}/search`}>{messages.nav.search}</Link>
            <Link href={`/${locale}/favourites`}>{messages.nav.favourites}</Link>
            {locales.map((l) => (
              <Link
                key={l}
                href={`/${l}/search`}
                hrefLang={l}
                style={{
                  textDecoration: l === locale ? 'underline' : 'none',
                  fontSize: '0.875rem',
                }}
              >
                {l.toUpperCase()}
              </Link>
            ))}
            <Link href={`/${locale}/account`}>{messages.nav.signIn}</Link>
          </nav>
        </header>
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
