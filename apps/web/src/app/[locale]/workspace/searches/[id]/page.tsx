import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { notFound } from 'next/navigation';
import { WorkspaceSearchDetailClient } from '@/components/WorkspaceSearchDetailClient';

export default async function SavedSearchDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const w = getMessages(locale).workspace;
  return <WorkspaceSearchDetailClient locale={locale} searchId={id} labels={{ ...w }} />;
}
