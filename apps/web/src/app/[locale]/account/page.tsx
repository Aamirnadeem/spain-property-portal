import { notFound } from 'next/navigation';
import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { AuthPanel } from '@/components/AuthPanel';

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const messages = getMessages(locale);

  return (
    <section>
      <h1 style={{ fontFamily: 'var(--font-serif)' }}>{messages.nav.signIn}</h1>
      <p style={{ color: 'hsl(var(--muted-foreground))' }}>
        Phase 1 uses fake email/SMS OTP adapters (codes appear in API responses and logs).
      </p>
      <AuthPanel
        locale={locale}
        labels={{
          emailOtp: messages.auth.emailOtp,
          mobileOtp: messages.auth.mobileOtp,
          sendCode: messages.auth.sendCode,
          verifyCode: messages.auth.verifyCode,
          codeSent: messages.auth.codeSent,
          guestMerged: messages.auth.guestMerged,
        }}
      />
    </section>
  );
}
