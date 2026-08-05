import { describe, expect, it } from 'vitest';
import { parseSearchParams, toSearchParams } from './index';

describe('parseSearchParams', () => {
  it('parses populated query params into criteria', () => {
    const params = new URLSearchParams({
      q: 'sitges villa',
      minPrice: '300000',
      maxPrice: '900000',
      minBedrooms: '2',
      area: 'Sitges',
      environmentType: 'coastal',
      sort: 'price_asc',
      page: '2',
      pageSize: '24',
      view: 'table',
    });

    expect(parseSearchParams(params)).toEqual({
      q: 'sitges villa',
      minPrice: 300000,
      maxPrice: 900000,
      minBedrooms: 2,
      area: 'Sitges',
      environmentType: 'coastal',
      sort: 'price_asc',
      page: 2,
      pageSize: 24,
      view: 'table',
    });
  });

  it('returns defaults for an empty query string', () => {
    expect(parseSearchParams(new URLSearchParams())).toEqual({
      sort: 'newest',
      page: 1,
      pageSize: 12,
      view: 'cards',
    });
  });

  it('throws for invalid values', () => {
    expect(() => parseSearchParams(new URLSearchParams({ pageSize: '999' }))).toThrow();
  });
});

describe('toSearchParams', () => {
  it('omits default values for a clean shareable URL', () => {
    const params = toSearchParams({
      sort: 'newest',
      page: 1,
      pageSize: 12,
      view: 'cards',
      area: 'Eixample',
    });
    expect(params.toString()).toBe('area=Eixample');
  });

  it('includes non-default values', () => {
    const params = toSearchParams({
      sort: 'price_desc',
      page: 3,
      pageSize: 24,
      view: 'table',
      minBedrooms: 3,
      environmentType: 'hillside',
    });
    expect(Object.fromEntries(params.entries())).toEqual({
      minBedrooms: '3',
      environmentType: 'hillside',
      sort: 'price_desc',
      page: '3',
      pageSize: '24',
      view: 'table',
    });
  });

  it('round-trips through parseSearchParams', () => {
    const original = parseSearchParams(
      new URLSearchParams({ q: 'penthouse', maxPrice: '1200000', sort: 'size_desc' }),
    );
    const roundTripped = parseSearchParams(toSearchParams(original));
    expect(roundTripped).toEqual(original);
  });
});
