import { notFound } from 'next/navigation';
import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { FavouritesClient } from '@/components/FavouritesClient';

export default async function FavouritesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const messages = getMessages(locale);
  return <FavouritesClient locale={locale} labels={messages.favourites} />;
}
