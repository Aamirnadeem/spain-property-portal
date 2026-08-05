import { describe, expect, it } from 'vitest';
import { getDirection, getMessages, isLocale, isRtl, locales } from './index';

describe('i18n', () => {
  it('supports four launch locales', () => {
    expect(locales).toEqual(['en', 'es', 'ca', 'ar']);
  });

  it('marks Arabic as RTL', () => {
    expect(isRtl('ar')).toBe(true);
    expect(getDirection('ar')).toBe('rtl');
    expect(getDirection('en')).toBe('ltr');
  });

  it('loads messages per locale', () => {
    expect(isLocale('ca')).toBe(true);
    expect(getMessages('es').nav.home).toBeTruthy();
    expect(getMessages('ar').appName).toBeTruthy();
  });
});
