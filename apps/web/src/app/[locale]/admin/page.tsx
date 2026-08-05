import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { DevIdentitySwitcher } from '@/components/DevIdentitySwitcher';

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const messages = getMessages(locale);
  const t = messages.admin;

  return (
    <section>
      <h1 style={{ fontFamily: 'var(--font-serif)' }}>{t.dashboardTitle}</h1>
      <p style={{ color: 'hsl(var(--muted-foreground))' }}>{t.intro}</p>
      <DevIdentitySwitcher
        labels={{
          signedInAs: t.signedInAs,
          notSignedIn: t.notSignedIn,
          orgOwner: messages.partner.orgOwner,
          orgAgent: messages.partner.orgAgent,
          platformAdmin: t.platformAdmin,
          listingReviewer: t.listingReviewer,
        }}
      />
      <nav style={{ display: 'flex', gap: '0.75rem' }}>
        <Link href={`/${locale}/admin/review`}>{t.reviewLink}</Link>
        <Link href={`/${locale}/admin/sources`}>{t.sourcesLink}</Link>
        <Link href={`/${locale}/admin/audit`}>{t.auditLink}</Link>
      </nav>
    </section>
  );
}
