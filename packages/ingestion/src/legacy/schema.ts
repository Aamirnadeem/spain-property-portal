import { z } from 'zod';

/**
 * Strict schema for `data/legacy/barcelona_property_explorer_legacy_60.json` records.
 * `.strict()` rejects any unrecognized field (e.g. bathrooms), which the source dataset
 * never provides and which must never be invented during import.
 */
export const legacyPropertyRecordSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().trim().min(1),
    url: z.string().url(),
    portal: z.string().trim().min(1),
    area: z.string().trim().min(1),
    price: z.number().positive(),
    bedrooms: z.number().int().nonnegative(),
    size_sqm: z.number().positive(),
    price_per_sqm: z.number().positive(),
    address: z.string().trim().min(1),
    nearest_transit: z.string().trim().min(1),
    commute_min: z.number().int().nonnegative().nullable(),
    beach_proximity: z.string().trim().min(1),
    park_proximity: z.string().trim().min(1),
    property_type: z.string().trim().min(1),
    category: z.string().trim().min(1),
  })
  .strict();

export type LegacyPropertyRecord = z.infer<typeof legacyPropertyRecordSchema>;

export const legacyPropertyRecordsFileSchema = z.array(z.unknown());
