import { notFound } from 'next/navigation';
import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { PartnerImportDetailClient } from '@/components/partner/PartnerImportDetailClient';

export default async function PartnerImportDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = getMessages(locale).partner;

  return (
    <PartnerImportDetailClient
      locale={locale}
      importRunId={id}
      labels={{
        runDetail: t.runDetail,
        backToImports: t.backToImports,
        rowsTotal: t.rowsTotal,
        rowsInserted: t.rowsInserted,
        rowsUpdated: t.rowsUpdated,
        rowsRejected: t.rowsRejected,
        rowsSkipped: t.rowsSkipped,
        errorsTitle: t.errorsTitle,
        noErrors: t.noErrors,
        mode: t.mode,
        startedAt: t.startedAt,
        finishedAt: t.finishedAt,
        runStatus: t.runStatus,
      }}
    />
  );
}
