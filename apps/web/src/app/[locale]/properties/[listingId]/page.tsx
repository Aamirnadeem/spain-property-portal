import { notFound } from 'next/navigation';
import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { PropertyDetailClient } from '@/components/PropertyDetailClient';

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; listingId: string }>;
}) {
  const { locale: raw, listingId } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const messages = getMessages(locale);

  return <PropertyDetailClient locale={locale} listingId={listingId} labels={messages.property} />;
}
