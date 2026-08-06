import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { notFound } from 'next/navigation';
import { ShortlistDetailClient } from '@/components/WorkspaceCompareClients';

export default async function ShortlistDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const w = getMessages(locale).workspace;
  return <ShortlistDetailClient locale={locale} shortlistKey={id} labels={{ ...w }} />;
}
