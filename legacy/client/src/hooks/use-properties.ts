import { useMemo, useState } from 'react';
import properties from '@/data/properties.json';
import type { Property, Filters } from '@/lib/types';

const allProperties = properties as Property[];

export const PRICE_BOUNDS: [number, number] = [
  Math.min(...allProperties.map((p) => p.price)),
  Math.max(...allProperties.map((p) => p.price)),
];

export const SIZE_BOUNDS: [number, number] = [
  Math.min(...allProperties.map((p) => p.size_sqm)),
  Math.max(...allProperties.map((p) => p.size_sqm)),
];

export const COMMUTE_BOUNDS: [number, number] = [
  Math.min(...allProperties.map((p) => p.commute_min)),
  Math.max(...allProperties.map((p) => p.commute_min)),
];

export const ALL_AREAS = Array.from(new Set(allProperties.map((p) => p.area))).sort();
export const ALL_CATEGORIES = ['City Center', 'Coastal', 'Hillside'];

export function defaultFilters(): Filters {
  return {
    categories: [],
    areas: [],
    priceMin: PRICE_BOUNDS[0],
    priceMax: PRICE_BOUNDS[1],
    sizeMin: SIZE_BOUNDS[0],
    sizeMax: SIZE_BOUNDS[1],
    commuteMax: COMMUTE_BOUNDS[1],
    bedroomsMin: 2,
    search: '',
  };
}

export function useProperties() {
  const [filters, setFilters] = useState<Filters>(defaultFilters());

  const filtered = useMemo(() => {
    return allProperties.filter((p) => {
      if (filters.categories.length > 0 && !filters.categories.includes(p.category)) return false;
      if (filters.areas.length > 0 && !filters.areas.includes(p.area)) return false;
      if (p.price < filters.priceMin || p.price > filters.priceMax) return false;
      if (p.size_sqm < filters.sizeMin || p.size_sqm > filters.sizeMax) return false;
      if (p.commute_min > filters.commuteMax) return false;
      if (p.bedrooms < filters.bedroomsMin) return false;
      if (filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        if (
          !p.title.toLowerCase().includes(q) &&
          !p.area.toLowerCase().includes(q) &&
          !p.address.toLowerCase().includes(q) &&
          !p.portal.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [filters]);

  return { properties: filtered, allProperties, filters, setFilters };
}
