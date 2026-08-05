import { describe, expect, it } from 'vitest';
import { legacyPropertyRecordSchema } from './schema';

const validRecord = {
  id: 1,
  title: 'Exceptional brand new apartment with six balconies in Eixample',
  url: 'https://www.engelvoelkers.com/es/en/exposes/cebb3839-1d03-50f7-969a-ee581971d3a2',
  portal: 'Engel & Völkers',
  area: 'Eixample',
  price: 1350000,
  bedrooms: 4,
  size_sqm: 129,
  price_per_sqm: 10465,
  address: 'Carrer de la Diputació, Eixample Esquerra',
  nearest_transit: 'Universitat (Metro L1/L2), ~2 min walk',
  commute_min: 7,
  beach_proximity: 'N/A',
  park_proximity: 'Jardins de la Universitat, ~2 min walk',
  property_type: 'apartment',
  category: 'City Center',
};

describe('legacyPropertyRecordSchema', () => {
  it('accepts a well-formed legacy record', () => {
    expect(legacyPropertyRecordSchema.parse(validRecord)).toEqual(validRecord);
  });

  it('accepts a null commute_min', () => {
    expect(() =>
      legacyPropertyRecordSchema.parse({ ...validRecord, commute_min: null }),
    ).not.toThrow();
  });

  it('rejects an invented bathrooms field', () => {
    expect(() =>
      legacyPropertyRecordSchema.parse({ ...validRecord, bathrooms: 2 }),
    ).toThrow();
  });

  it('rejects a missing required field', () => {
    const { price, ...withoutPrice } = validRecord;
    expect(() => legacyPropertyRecordSchema.parse(withoutPrice)).toThrow();
  });

  it('rejects a non-numeric id', () => {
    expect(() => legacyPropertyRecordSchema.parse({ ...validRecord, id: '1' })).toThrow();
  });

  it('rejects a non-URL url field', () => {
    expect(() => legacyPropertyRecordSchema.parse({ ...validRecord, url: 'not-a-url' })).toThrow();
  });
});
