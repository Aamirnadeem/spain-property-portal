export interface Property {
  id: number;
  title: string;
  url: string;
  portal: string;
  area: string;
  category: 'City Center' | 'Coastal' | 'Hillside';
  price: number;
  bedrooms: number;
  size_sqm: number;
  price_per_sqm: number;
  address: string;
  nearest_transit: string;
  commute_min: number;
  beach_proximity: string;
  park_proximity: string;
  property_type: string;
}

export interface Filters {
  categories: string[];
  areas: string[];
  priceMin: number;
  priceMax: number;
  sizeMin: number;
  sizeMax: number;
  commuteMax: number;
  bedroomsMin: number;
  search: string;
}

export const CATEGORY_INFO: Record<string, { label: string; description: string; color: string }> = {
  'City Center': {
    label: 'City Center',
    description: 'Eixample, Sant Gervasi',
    color: 'chart-1',
  },
  Coastal: {
    label: 'Coastal',
    description: 'Gavà Mar, Sitges, Maresme',
    color: 'chart-2',
  },
  Hillside: {
    label: 'Hillside',
    description: 'Vallvidrera',
    color: 'chart-3',
  },
};
