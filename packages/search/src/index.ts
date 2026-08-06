import {
  PROPERTY_SEARCH_CRITERIA_KEYS,
  propertySearchCriteriaSchema,
  type PropertySearchCriteria,
} from './criteria';

export * from './criteria';

const DEFAULTS: Pick<PropertySearchCriteria, 'sort' | 'page' | 'pageSize' | 'view'> = {
  sort: 'newest',
  page: 1,
  pageSize: 12,
  view: 'cards',
};

/** Parses shareable search URL query params into validated, defaulted criteria. */
export function parseSearchParams(params: URLSearchParams): PropertySearchCriteria {
  const raw: Record<string, string> = {};
  for (const key of PROPERTY_SEARCH_CRITERIA_KEYS) {
    const value = params.get(key);
    if (value !== null) raw[key] = value;
  }
  return propertySearchCriteriaSchema.parse(raw);
}

/** Serializes criteria back into shareable URL query params, omitting default values. */
export function toSearchParams(criteria: PropertySearchCriteria): URLSearchParams {
  const parsed = propertySearchCriteriaSchema.parse(criteria);
  const params = new URLSearchParams();
  for (const key of PROPERTY_SEARCH_CRITERIA_KEYS) {
    const value = parsed[key];
    if (value === undefined) continue;
    if (key in DEFAULTS && DEFAULTS[key as keyof typeof DEFAULTS] === value) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      params.set(key, value.join(','));
      continue;
    }
    params.set(key, String(value));
  }
  return params;
}
