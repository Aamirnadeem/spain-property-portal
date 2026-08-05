import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { PropertySearchClient } from '@/components/PropertySearchClient';

export default async function SearchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const messages = getMessages(locale);

  return (
    <section>
      <h1 style={{ fontFamily: 'var(--font-serif)' }}>{messages.search.title}</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <PropertySearchClient locale={locale} labels={messages.search} />
      </Suspense>
    </section>
  );
}
