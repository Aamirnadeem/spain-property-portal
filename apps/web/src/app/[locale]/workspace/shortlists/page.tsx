import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { notFound } from 'next/navigation';
import { WorkspaceShortlistsClient } from '@/components/WorkspaceShortlistsClient';

export default async function ShortlistsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const w = getMessages(locale).workspace;
  return (
    <div>
      <h1>{w.shortlists}</h1>
      <WorkspaceShortlistsClient locale={locale} labels={{ ...w }} />
    </div>
  );
}
