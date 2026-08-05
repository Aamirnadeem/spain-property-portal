import en from './messages/en.json';
import es from './messages/es.json';
import ca from './messages/ca.json';
import ar from './messages/ar.json';

export const locales = ['en', 'es', 'ca', 'ar'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function isRtl(locale: Locale): boolean {
  return locale === 'ar';
}

export type Messages = typeof en;

const catalog: Record<Locale, Messages> = { en, es, ca, ar };

export function getMessages(locale: Locale): Messages {
  return catalog[locale] ?? catalog.en;
}

export function getDirection(locale: Locale): 'ltr' | 'rtl' {
  return isRtl(locale) ? 'rtl' : 'ltr';
}
