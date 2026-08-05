import { z } from 'zod';

/** Spain Partner CSV v1 — see docs/IMPORT_FORMAT_CSV.md and docs/INGESTION_ARCHITECTURE.md. */
export const SPAIN_PARTNER_CSV_V1_REQUIRED_COLUMNS = [
  'external_id',
  'title',
  'price_eur',
  'property_type',
  'status',
] as const;

export const SPAIN_PARTNER_CSV_V1_OPTIONAL_COLUMNS = [
  'description',
  'currency',
  'bedrooms',
  'bathrooms',
  'built_area_sqm',
  'environment_type',
  'municipality',
  'neighborhood',
  'address_text',
  'lat',
  'lng',
  'location_accuracy',
  'source_updated_at',
  'image_urls',
  'features',
] as const;

function emptyToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

function requiredText(field: string) {
  return z.string().trim().min(1, `${field} is required`);
}

function optionalText() {
  return z.preprocess(emptyToUndefined, z.string().trim().optional());
}

function requiredPositiveNumber(field: string) {
  return z
    .string()
    .trim()
    .min(1, `${field} is required`)
    .superRefine((v, ctx) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} must be a positive number`,
        });
      }
    })
    .transform((v) => Number(v));
}

function optionalPositiveNumber(field: string) {
  return z
    .preprocess(emptyToUndefined, z.string().optional())
    .superRefine((v, ctx) => {
      if (v === undefined) return;
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} must be a positive number`,
        });
      }
    })
    .transform((v) => (v === undefined ? undefined : Number(v)));
}

function optionalNonNegativeInt(field: string) {
  return z
    .preprocess(emptyToUndefined, z.string().optional())
    .superRefine((v, ctx) => {
      if (v === undefined) return;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} must be a non-negative integer`,
        });
      }
    })
    .transform((v) => (v === undefined ? undefined : Number(v)));
}

function optionalCoordinate(field: string) {
  return z
    .preprocess(emptyToUndefined, z.string().optional())
    .superRefine((v, ctx) => {
      if (v === undefined) return;
      const n = Number(v);
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${field} must be numeric` });
      }
    })
    .transform((v) => (v === undefined ? undefined : Number(v)));
}

export const spainPartnerCsvRowSchema = z.object({
  external_id: requiredText('external_id'),
  title: requiredText('title'),
  price_eur: requiredPositiveNumber('price_eur'),
  property_type: requiredText('property_type'),
  status: requiredText('status'),
  description: optionalText(),
  currency: optionalText(),
  bedrooms: optionalNonNegativeInt('bedrooms'),
  bathrooms: optionalNonNegativeInt('bathrooms'),
  built_area_sqm: optionalPositiveNumber('built_area_sqm'),
  environment_type: optionalText(),
  municipality: optionalText(),
  neighborhood: optionalText(),
  address_text: optionalText(),
  lat: optionalCoordinate('lat'),
  lng: optionalCoordinate('lng'),
  location_accuracy: z.preprocess(
    emptyToUndefined,
    z.enum(['exact', 'approximate', 'area_only', 'unknown']).optional(),
  ),
  source_updated_at: optionalText(),
  image_urls: optionalText(),
  features: optionalText(),
});

export type SpainPartnerCsvRow = z.infer<typeof spainPartnerCsvRowSchema>;

export function missingRequiredColumns(headers: string[]): string[] {
  const present = new Set(headers.map((h) => h.trim()));
  return SPAIN_PARTNER_CSV_V1_REQUIRED_COLUMNS.filter((column) => !present.has(column));
}
