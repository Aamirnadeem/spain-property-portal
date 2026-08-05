export type PartnerListingStatus = 'available' | 'reserved' | 'under_offer' | 'sold' | 'withdrawn';
export type PartnerEnvironmentType = 'city_center' | 'coastal' | 'hillside';

function toKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (á->a) for forgiving Spanish/English matching
    .replace(/\s+/g, '_');
}

/** Spain Partner CSV v1 `property_type` -> canonical `property_types.key`. */
export const PARTNER_PROPERTY_TYPE_MAP: Record<string, string> = {
  apartment: 'apartment',
  flat: 'apartment',
  piso: 'apartment',
  penthouse: 'penthouse',
  atico: 'penthouse',
  villa: 'villa',
  chalet: 'villa',
  detached_villa: 'villa',
  detached_house: 'detached_house',
  casa_independiente: 'detached_house',
  semi_detached_house: 'semi_detached_house',
  casa_pareada: 'semi_detached_house',
  townhouse: 'townhouse',
  casa_adosada: 'townhouse',
};

export function normalizePartnerPropertyType(raw: string): string | null {
  return PARTNER_PROPERTY_TYPE_MAP[toKey(raw)] ?? null;
}

/** Spain Partner CSV v1 `status` -> post-publish `listing_operational_status` subset. */
export const PARTNER_STATUS_MAP: Record<string, PartnerListingStatus> = {
  available: 'available',
  for_sale: 'available',
  activo: 'available',
  en_venta: 'available',
  reserved: 'reserved',
  reservado: 'reserved',
  under_offer: 'under_offer',
  en_oferta: 'under_offer',
  sold: 'sold',
  vendido: 'sold',
  withdrawn: 'withdrawn',
  retirado: 'withdrawn',
};

export function normalizePartnerStatus(raw: string): PartnerListingStatus | null {
  return PARTNER_STATUS_MAP[toKey(raw)] ?? null;
}

/** Optional decorative field; unmapped values are nullified with a warning, never fatal. */
export const PARTNER_ENVIRONMENT_TYPE_MAP: Record<string, PartnerEnvironmentType> = {
  city_center: 'city_center',
  city: 'city_center',
  urban: 'city_center',
  centro: 'city_center',
  coastal: 'coastal',
  beach: 'coastal',
  costa: 'coastal',
  playa: 'coastal',
  hillside: 'hillside',
  mountain: 'hillside',
  montana: 'hillside',
};

export function normalizePartnerEnvironmentType(raw: string): PartnerEnvironmentType | null {
  return PARTNER_ENVIRONMENT_TYPE_MAP[toKey(raw)] ?? null;
}

/** Statuses that must not be overwritten by a partner-controlled CSV `status` column. */
export const PRE_PUBLISH_OPERATIONAL_STATUSES = ['draft', 'pending_review', 'rejected'] as const;

export function isPrePublishStatus(status: string): boolean {
  return (PRE_PUBLISH_OPERATIONAL_STATUSES as readonly string[]).includes(status);
}

export function isBrowseableStatus(status: PartnerListingStatus): boolean {
  return status === 'available' || status === 'reserved' || status === 'under_offer';
}

export function splitListField(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[|;]/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export function computeRoundedPricePerSqm(price: number, sizeSqm: number): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(sizeSqm) || sizeSqm <= 0) return null;
  return Math.round((price / sizeSqm) * 100) / 100;
}
