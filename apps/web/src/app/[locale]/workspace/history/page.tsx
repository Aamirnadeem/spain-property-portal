import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { notFound } from 'next/navigation';
import { WorkspaceHistoryClient } from '@/components/WorkspaceHistoryClient';

export default async function HistoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const w = getMessages(locale).workspace;
  return (
    <div>
      <h1>{w.history}</h1>
      <p>{w.recentlyViewed}</p>
      <WorkspaceHistoryClient locale={locale} labels={{ ...w }} />
    </div>
  );
}
