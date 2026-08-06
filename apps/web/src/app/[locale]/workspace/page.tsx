import { getMessages, isLocale, type Locale } from '@spain/i18n';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { WorkspaceShortlistsClient } from '@/components/WorkspaceShortlistsClient';

export default async function WorkspacePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const messages = getMessages(locale);
  const w = messages.workspace;

  return (
    <div>
      <h1>{w.title}</h1>
      <p>{w.intro}</p>
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <Link href={`/${locale}/workspace/shortlists`}>{w.shortlists}</Link>
        <Link href={`/${locale}/workspace/compare`}>{w.compare}</Link>
        <Link href={`/${locale}/workspace/searches`}>{w.searches}</Link>
        <Link href={`/${locale}/workspace/history`}>{w.history}</Link>
        <Link href={`/${locale}/workspace/notifications`}>{w.notifications}</Link>
      </nav>
      <WorkspaceShortlistsClient locale={locale} labels={{ ...w, signInBanner: w.signInBanner }} />
    </div>
  );
}
