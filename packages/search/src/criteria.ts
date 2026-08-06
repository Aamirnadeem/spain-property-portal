import { z } from 'zod';

export const ENVIRONMENT_TYPES = ['city_center', 'coastal', 'hillside'] as const;

export type EnvironmentType = (typeof ENVIRONMENT_TYPES)[number];

/** Legacy/lifestyle category labels as they appear in source data and UI copy. */
export const ENVIRONMENT_TYPE_LABELS: Record<EnvironmentType, string> = {
  city_center: 'City Center',
  coastal: 'Coastal',
  hillside: 'Hillside',
};

const LABEL_TO_ENVIRONMENT_TYPE: Record<string, EnvironmentType> = Object.fromEntries(
  Object.entries(ENVIRONMENT_TYPE_LABELS).map(([key, label]) => [label, key as EnvironmentType]),
);

export function environmentTypeFromLabel(label: string): EnvironmentType | undefined {
  return LABEL_TO_ENVIRONMENT_TYPE[label];
}

export const SEARCH_SORT_OPTIONS = ['price_asc', 'price_desc', 'size_desc', 'newest'] as const;

export type SearchSortOption = (typeof SEARCH_SORT_OPTIONS)[number];

export const SEARCH_VIEW_MODES = ['cards', 'table'] as const;

export type SearchViewMode = (typeof SEARCH_VIEW_MODES)[number];

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 48;

const optionalTrimmedString = z.string().trim().min(1).optional();

const optionalNonNegativeNumber = z.coerce.number().nonnegative().finite().optional();

const optionalNonNegativeInt = z.coerce.number().int().nonnegative().optional();

export const propertySearchCriteriaSchema = z
  .object({
    q: optionalTrimmedString,
    minPrice: optionalNonNegativeNumber,
    maxPrice: optionalNonNegativeNumber,
    minBedrooms: optionalNonNegativeInt,
    maxBedrooms: optionalNonNegativeInt,
    minSizeSqm: optionalNonNegativeNumber,
    maxSizeSqm: optionalNonNegativeNumber,
    area: optionalTrimmedString,
    environmentType: z.enum(ENVIRONMENT_TYPES).optional(),
    sort: z.enum(SEARCH_SORT_OPTIONS).default('newest'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    view: z.enum(SEARCH_VIEW_MODES).default('cards'),
  })
  .superRefine((value, ctx) => {
    if (
      value.minPrice !== undefined &&
      value.maxPrice !== undefined &&
      value.minPrice > value.maxPrice
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minPrice must not exceed maxPrice',
        path: ['minPrice'],
      });
    }
    if (
      value.minBedrooms !== undefined &&
      value.maxBedrooms !== undefined &&
      value.minBedrooms > value.maxBedrooms
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minBedrooms must not exceed maxBedrooms',
        path: ['minBedrooms'],
      });
    }
    if (
      value.minSizeSqm !== undefined &&
      value.maxSizeSqm !== undefined &&
      value.minSizeSqm > value.maxSizeSqm
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minSizeSqm must not exceed maxSizeSqm',
        path: ['minSizeSqm'],
      });
    }
  });

export type PropertySearchCriteria = z.infer<typeof propertySearchCriteriaSchema>;

export const PROPERTY_SEARCH_CRITERIA_KEYS = [
  'q',
  'minPrice',
  'maxPrice',
  'minBedrooms',
  'maxBedrooms',
  'minSizeSqm',
  'maxSizeSqm',
  'area',
  'environmentType',
  'sort',
  'page',
  'pageSize',
  'view',
] as const satisfies readonly (keyof PropertySearchCriteria)[];
