import { notFound } from 'next/navigation';
import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { AdminReviewClient } from '@/components/admin/AdminReviewClient';

export default async function AdminReviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = getMessages(locale).admin;

  return (
    <AdminReviewClient
      labels={{
        reviewTitle: t.reviewTitle,
        reviewEmpty: t.reviewEmpty,
        publish: t.publish,
        withdraw: t.withdraw,
      }}
    />
  );
}
