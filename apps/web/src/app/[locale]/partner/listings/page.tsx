import { notFound } from 'next/navigation';
import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { PartnerListingsClient } from '@/components/partner/PartnerListingsClient';

export default async function PartnerListingsPage({
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
      <h1 style={{ fontFamily: 'var(--font-serif)' }}>{t.listingsTitle}</h1>
      <PartnerListingsClient
        labels={{
          listingsTitle: t.listingsTitle,
          listingsEmpty: t.listingsEmpty,
          status: t.status,
          price: t.price,
          newPrice: t.newPrice,
          updatePrice: t.updatePrice,
          withdraw: t.withdraw,
          withdrawConfirm: t.withdrawConfirm,
        }}
      />
    </section>
  );
}
