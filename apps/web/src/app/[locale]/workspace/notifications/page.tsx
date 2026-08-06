import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { notFound } from 'next/navigation';
import { WorkspaceNotificationsClient } from '@/components/WorkspaceNotificationsClient';

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const messages = getMessages(locale);
  const w = messages.workspace;
  return (
    <div>
      <h1>{w.notifications}</h1>
      <WorkspaceNotificationsClient
        locale={locale}
        labels={{ ...w }}
        notificationLabels={messages.notifications}
      />
    </div>
  );
}
