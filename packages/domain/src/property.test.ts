import { describe, expect, it } from 'vitest';
import { computePricePerSqm, formatPriceEur } from './property';

describe('formatPriceEur', () => {
  it('formats a price using EUR currency', () => {
    expect(formatPriceEur(1350000)).toContain('1');
    expect(formatPriceEur(1350000)).toContain('350');
  });

  it('returns a fallback for null or undefined', () => {
    expect(formatPriceEur(null)).toBe('Price on request');
    expect(formatPriceEur(undefined)).toBe('Price on request');
  });
});

describe('computePricePerSqm', () => {
  it('divides price by built area', () => {
    expect(computePricePerSqm(1350000, 129)).toBe(10465);
  });

  it('returns null when price is missing', () => {
    expect(computePricePerSqm(null, 129)).toBeNull();
  });

  it('returns null when built area is missing or zero', () => {
    expect(computePricePerSqm(1350000, null)).toBeNull();
    expect(computePricePerSqm(1350000, 0)).toBeNull();
  });
});
