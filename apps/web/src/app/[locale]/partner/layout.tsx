import type { ReactNode } from 'react';
import { requirePageSession } from '@/lib/require-page-session';

export default async function PartnerLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requirePageSession(locale);

  return children;
}
