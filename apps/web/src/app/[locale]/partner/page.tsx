import { notFound } from 'next/navigation';
import Link from 'next/link';
import { isFakeDevAuthUiAllowed, readAuthRuntimeConfig } from '@spain/communications';
import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { DevIdentitySwitcher } from '@/components/DevIdentitySwitcher';

export default async function PartnerDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const messages = getMessages(locale);
  const t = messages.partner;
  const showDevSwitcher = isFakeDevAuthUiAllowed(readAuthRuntimeConfig());

  return (
    <section>
      <h1 style={{ fontFamily: 'var(--font-serif)' }}>{t.dashboardTitle}</h1>
      <p style={{ color: 'hsl(var(--muted-foreground))' }}>{t.intro}</p>
      {showDevSwitcher ? (
        <DevIdentitySwitcher
          labels={{
            signedInAs: t.signedInAs,
            notSignedIn: t.notSignedIn,
            orgOwner: t.orgOwner,
            orgAgent: t.orgAgent,
            orgViewer: 'Org viewer',
            platformAdmin: messages.admin.platformAdmin,
            listingReviewer: messages.admin.listingReviewer,
          }}
        />
      ) : null}
      <nav style={{ display: 'flex', gap: '0.75rem' }}>
        <Link href={`/${locale}/partner/listings`}>{t.listingsLink}</Link>
        <Link href={`/${locale}/partner/imports`}>{t.importsLink}</Link>
      </nav>
    </section>
  );
}
