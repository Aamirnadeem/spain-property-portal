import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMessages, isLocale, type Locale } from '@spain/i18n';

export default async function LocaleHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const messages = getMessages(locale);

  return (
    <section>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '0.5rem' }}>
        {messages.home.title}
      </h1>
      <p style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.6 }}>{messages.home.body}</p>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <Link
          href={`/${locale}/search`}
          style={{
            background: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            padding: '0.65rem 1rem',
            borderRadius: 'var(--radius)',
            textDecoration: 'none',
          }}
        >
          {messages.home.cta}
        </Link>
        <Link
          href={`/${locale}/favourites`}
          style={{
            border: '1px solid hsl(var(--border))',
            padding: '0.65rem 1rem',
            borderRadius: 'var(--radius)',
            textDecoration: 'none',
            color: 'hsl(var(--foreground))',
          }}
        >
          {messages.nav.favourites}
        </Link>
      </div>
    </section>
  );
}
