import { redirect } from 'next/navigation';
import { defaultLocale } from '@spain/i18n';

export default function RootPage() {
  redirect(`/${defaultLocale}`);
}
