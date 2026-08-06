import { notFound } from 'next/navigation';
import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { PartnerImportsClient } from '@/components/partner/PartnerImportsClient';

export default async function PartnerImportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = getMessages(locale).partner;

  return (
    <section>
      <h1 style={{ fontFamily: 'var(--font-serif)' }}>{t.importsTitle}</h1>
      <PartnerImportsClient
        locale={locale}
        labels={{
          uploadTitle: t.uploadTitle,
          uploadHint: t.uploadHint,
          chooseFile: t.chooseFile,
          runDryRun: t.runDryRun,
          runImport: t.runImport,
          importHistory: t.importHistory,
          viewDetail: t.viewDetail,
          rowsTotal: t.rowsTotal,
          rowsInserted: t.rowsInserted,
          rowsUpdated: t.rowsUpdated,
          rowsRejected: t.rowsRejected,
          rowsSkipped: t.rowsSkipped,
          previewTitle: t.previewTitle,
          errorsTitle: t.errorsTitle,
          noErrors: t.noErrors,
        }}
      />
    </section>
  );
}
