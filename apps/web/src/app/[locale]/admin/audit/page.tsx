import { notFound } from 'next/navigation';
import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { AdminAuditClient } from '@/components/admin/AdminAuditClient';

export default async function AdminAuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = getMessages(locale).admin;

  return (
    <AdminAuditClient
      labels={{
        auditTitle: t.auditTitle,
        action: t.action,
        entity: t.entity,
        actor: t.actor,
        when: t.when,
        auditEmpty: t.auditEmpty,
      }}
    />
  );
}
