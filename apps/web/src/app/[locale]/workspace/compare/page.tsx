import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { notFound } from 'next/navigation';
import { ComparisonClient } from '@/components/WorkspaceCompareClients';

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const sp = await searchParams;
  const ids = Array.isArray(sp.id) ? sp.id : sp.id ? [sp.id] : [];
  const w = getMessages(locale).workspace;
  return (
    <div>
      <h1>{w.compare}</h1>
      <ComparisonClient locale={locale} initialIds={ids} labels={{ ...w }} />
    </div>
  );
}
