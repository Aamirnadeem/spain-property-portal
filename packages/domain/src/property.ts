export type EnvironmentType = 'city_center' | 'coastal' | 'hillside';

export interface ListingCardDto {
  id: string;
  title: string;
  priceAmount: number | null;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  builtAreaSqm: number | null;
  pricePerSqm: number | null;
  areaLabel: string | null;
  environmentType: string | null;
  propertyTypeKey: string | null;
  isLegacySnapshot: boolean;
  freshnessMethod: string;
  operationalStatus: string;
  lastConfirmedAvailableAt: string | null;
  hasAuthorizedImage: boolean;
  thumbnailUrl: string | null;
}

export interface ListingDetailDto extends ListingCardDto {
  description: string | null;
  addressText: string | null;
  nearestTransit: string | null;
  commuteMin: number | null;
  beachProximity: string | null;
  parkProximity: string | null;
  sourceUrl: string | null;
  portalName: string | null;
  importedAt: string | null;
  features: Array<{ key: string; label: string; valueText: string | null }>;
  freshnessWarning: string;
  sourceAttribution: string;
  mediaUrls: string[];
}

export function formatPriceEur(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return 'Price on request';
  }
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function computePricePerSqm(
  priceAmount: number | null | undefined,
  builtAreaSqm: number | null | undefined,
): number | null {
  if (!priceAmount || !builtAreaSqm || priceAmount <= 0 || builtAreaSqm <= 0) {
    return null;
  }
  return Math.round(priceAmount / builtAreaSqm);
}

export function legacyFreshnessWarning(): string {
  return 'This listing is a historical snapshot. It is not confirmed live, verified, or currently available.';
}
