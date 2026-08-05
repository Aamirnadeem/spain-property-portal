import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDirection, getMessages, isLocale, locales, type Locale } from '@spain/i18n';

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
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid hsl(var(--border))',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <strong style={{ fontFamily: 'var(--font-serif)' }}>{messages.appName}</strong>
            <div style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>
              {messages.tagline}
            </div>
          </div>
          <nav style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {locales.map((l) => (
              <Link
                key={l}
                href={`/${l}`}
                hrefLang={l}
                style={{
                  textDecoration: l === locale ? 'underline' : 'none',
                  color: 'hsl(var(--foreground))',
                  fontSize: '0.875rem',
                }}
              >
                {l.toUpperCase()}
              </Link>
            ))}
            <Link href={`/${locale}/account`} style={{ fontSize: '0.875rem' }}>
              {messages.nav.signIn}
            </Link>
          </nav>
        </header>
        <main style={{ padding: '1.5rem 1.25rem', maxWidth: 960, margin: '0 auto' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
