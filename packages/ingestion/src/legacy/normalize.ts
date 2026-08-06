export type EnvironmentType = 'city_center' | 'coastal' | 'hillside';

/**
 * Legacy `property_type` -> canonical key mapping (see docs/DATABASE_DESIGN.md §13.2).
 * `House/Chalet` and `Detached Villa` both map to `villa`, since a Spanish "chalet" is a
 * standalone villa-style house and this dataset does not distinguish it from `Detached House`.
 */
export const LEGACY_PROPERTY_TYPE_MAP: Record<string, string> = {
  apartment: 'apartment',
  Flat: 'apartment',
  'Ground Floor Flat': 'apartment',
  'New Build Apartment': 'apartment',
  penthouse: 'penthouse',
  Penthouse: 'penthouse',
  villa: 'villa',
  'Detached Villa': 'villa',
  'House/Chalet': 'villa',
  'Detached House': 'detached_house',
  'Semi-detached House': 'semi_detached_house',
  townhouse: 'townhouse',
};

export class UnmappedLegacyValueError extends Error {
  constructor(
    public readonly field: string,
    public readonly rawValue: string,
  ) {
    super(`Unmapped legacy ${field}: "${rawValue}"`);
    this.name = 'UnmappedLegacyValueError';
  }
}

export function normalizePropertyType(rawPropertyType: string): string {
  const mapped = LEGACY_PROPERTY_TYPE_MAP[rawPropertyType];
  if (!mapped) {
    throw new UnmappedLegacyValueError('property_type', rawPropertyType);
  }
  return mapped;
}

/** Legacy `category` -> `environment_type` mapping (see docs/DATABASE_DESIGN.md §13.1). */
export const LEGACY_CATEGORY_TO_ENVIRONMENT_TYPE: Record<string, EnvironmentType> = {
  'City Center': 'city_center',
  Coastal: 'coastal',
  Hillside: 'hillside',
};

export function normalizeEnvironmentType(rawCategory: string): EnvironmentType {
  const mapped = LEGACY_CATEGORY_TO_ENVIRONMENT_TYPE[rawCategory];
  if (!mapped) {
    throw new UnmappedLegacyValueError('category', rawCategory);
  }
  return mapped;
}

/** Nullifies advertiser-declared lifestyle proximity text of "N/A" (case-insensitive). */
export function nullifyNotApplicable(rawValue: string): string | null {
  return rawValue.trim().toUpperCase() === 'N/A' ? null : rawValue;
}
