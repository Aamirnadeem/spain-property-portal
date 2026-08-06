import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXPIRY_DAYS,
  MAX_EXPIRY_DAYS,
  calculateComparisonShareExpiry,
} from './public-comparison';

describe('comparison share expiry', () => {
  const now = new Date('2026-08-06T12:00:00.000Z');

  it('defaults to seven days', () => {
    const expiry = calculateComparisonShareExpiry({}, now);
    expect(expiry.getTime() - now.getTime()).toBe(DEFAULT_EXPIRY_DAYS * 86_400_000);
  });

  it('accepts the 90 day boundary and rejects anything later', () => {
    const maximum = new Date(now.getTime() + MAX_EXPIRY_DAYS * 86_400_000);
    expect(calculateComparisonShareExpiry({ expiresAt: maximum }, now)).toEqual(maximum);
    expect(() =>
      calculateComparisonShareExpiry({ expiresAt: new Date(maximum.getTime() + 1) }, now),
    ).toThrow('expiry_too_far');
  });

  it('rejects permanent or elapsed expiry values', () => {
    expect(() => calculateComparisonShareExpiry({ expiresAt: now }, now)).toThrow('invalid_expiry');
  });
});
