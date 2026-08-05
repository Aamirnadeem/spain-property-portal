import { describe, expect, it } from 'vitest';
import { missingRequiredColumns, spainPartnerCsvRowSchema } from './schema';

const validRow = {
  external_id: 'DEMO-1',
  title: 'Bright apartment',
  price_eur: '415000',
  property_type: 'apartment',
  status: 'available',
  bedrooms: '2',
  bathrooms: '1',
  built_area_sqm: '72',
  lat: '41.4036',
  lng: '2.1744',
};

describe('spainPartnerCsvRowSchema', () => {
  it('accepts a well-formed row and coerces numeric fields', () => {
    const parsed = spainPartnerCsvRowSchema.parse(validRow);
    expect(parsed.price_eur).toBe(415000);
    expect(parsed.bedrooms).toBe(2);
    expect(parsed.lat).toBeCloseTo(41.4036);
  });

  it('treats empty optional strings as undefined', () => {
    const parsed = spainPartnerCsvRowSchema.parse({ ...validRow, description: '', bedrooms: '' });
    expect(parsed.description).toBeUndefined();
    expect(parsed.bedrooms).toBeUndefined();
  });

  it('rejects a missing required field', () => {
    const { price_eur: _price, ...withoutPrice } = validRow;
    expect(() => spainPartnerCsvRowSchema.parse(withoutPrice)).toThrow();
  });

  it('rejects a non-positive price', () => {
    expect(() => spainPartnerCsvRowSchema.parse({ ...validRow, price_eur: '0' })).toThrow();
  });

  it('rejects a non-numeric bedrooms value', () => {
    expect(() => spainPartnerCsvRowSchema.parse({ ...validRow, bedrooms: 'two' })).toThrow();
  });

  it('rejects an invalid location_accuracy enum value', () => {
    expect(() =>
      spainPartnerCsvRowSchema.parse({ ...validRow, location_accuracy: 'very_exact' }),
    ).toThrow();
  });
});

describe('missingRequiredColumns', () => {
  it('returns an empty array when all required columns are present', () => {
    expect(
      missingRequiredColumns(['external_id', 'title', 'price_eur', 'property_type', 'status']),
    ).toEqual([]);
  });

  it('lists missing required columns', () => {
    expect(missingRequiredColumns(['external_id', 'title'])).toEqual([
      'price_eur',
      'property_type',
      'status',
    ]);
  });
});
