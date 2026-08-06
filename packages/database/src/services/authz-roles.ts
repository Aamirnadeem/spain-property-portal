/** Org role keys stored on organization_members.role (product → storage mapping). */
export const ORG_ADMIN_ROLES = ['org_owner', 'org_admin'] as const;
export const ORG_EDITOR_ROLES = ['org_agent'] as const;
export const ORG_VIEWER_ROLES = ['org_viewer'] as const;
export const ORG_MUTATOR_ROLES = [...ORG_ADMIN_ROLES, ...ORG_EDITOR_ROLES] as const;

export const PLATFORM_ADMIN_ONLY_ROLE_KEYS = ['platform_admin'] as const;
export const PLATFORM_REVIEWER_ROLE_KEYS = ['platform_admin', 'listing_reviewer'] as const;

export function canReadOrgInventory(orgRole: string): boolean {
  return (
    (ORG_ADMIN_ROLES as readonly string[]).includes(orgRole) ||
    (ORG_EDITOR_ROLES as readonly string[]).includes(orgRole) ||
    (ORG_VIEWER_ROLES as readonly string[]).includes(orgRole)
  );
}

export function canMutateOrgInventory(orgRole: string): boolean {
  return (ORG_MUTATOR_ROLES as readonly string[]).includes(orgRole);
}

export function isOrgAdminRole(orgRole: string): boolean {
  return (ORG_ADMIN_ROLES as readonly string[]).includes(orgRole);
}
