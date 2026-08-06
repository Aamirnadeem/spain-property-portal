import { notFound } from 'next/navigation';
import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { AdminSourcesClient } from '@/components/admin/AdminSourcesClient';

export default async function AdminSourcesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = getMessages(locale).admin;

  return (
    <AdminSourcesClient
      labels={{
        sourcesTitle: t.sourcesTitle,
        permissionStatus: t.permissionStatus,
        imageRights: t.imageRights,
        updatePermission: t.updatePermission,
      }}
    />
  );
}
