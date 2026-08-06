export * from './guest-workspace';
export * from './property';
export * from './favourites';
export * from './comparison-scoring';
export * from './saved-search';

export const ORGANIZATION_ROLES = ['org_owner', 'org_admin', 'org_agent', 'org_viewer'] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const PLATFORM_ROLES = [
  'platform_admin',
  'listing_reviewer',
  'media_rights_reviewer',
  'legal_content_reviewer',
  'support_agent',
  'ai_quality_reviewer',
  'buyer',
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];
