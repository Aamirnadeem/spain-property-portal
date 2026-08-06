import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { notFound } from 'next/navigation';
import { WorkspaceSearchesClient } from '@/components/WorkspaceSearchesClient';

export default async function SavedSearchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const w = getMessages(locale).workspace;
  return (
    <div>
      <h1>{w.searches}</h1>
      <WorkspaceSearchesClient locale={locale} labels={{ ...w }} />
    </div>
  );
}
