-- Phase 3 RLS: org-scoped agency/admin operations on top of Phase 1/2 policies.
-- Application code in apps/web currently queries with a trusted server-side connection
-- (documented Phase 2/3 gap — see docs/PHASE3_SECURITY_REVIEW.md "Authn/Authz requirements").
-- These policies are the defense-in-depth layer exercised by pnpm test:db under
-- `SET LOCAL ROLE authenticated` with `request.jwt.claim.sub` set to the acting user.

ALTER TABLE feed_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_permission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Reference catalogue: safe to read (keys/descriptions only, no secrets).
CREATE POLICY roles_public_read ON roles
  FOR SELECT USING (true);

-- Organization membership: a user may always read their own membership rows.
-- This is also the building block every other org-scoped policy below joins against.
CREATE POLICY organization_members_self_select ON organization_members
  FOR SELECT
  USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

-- Organizations: visible to members of that org, or platform admin/reviewer.
CREATE POLICY organizations_member_select ON organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        AND r.key IN ('platform_admin', 'listing_reviewer')
    )
  );

-- Draft/pending org listings: org members see their own org's listings regardless of
-- publication status; platform admin/reviewer see all. Public browse policy from Phase 2
-- (`property_listings_public_browse`) remains additive for anon/authenticated buyers.
CREATE POLICY property_listings_org_select ON property_listings
  FOR SELECT
  USING (
    (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = property_listings.organization_id
          AND om.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      )
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        AND r.key IN ('platform_admin', 'listing_reviewer')
    )
  );

CREATE POLICY property_listings_admin_all ON property_listings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        AND r.key IN ('platform_admin', 'listing_reviewer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        AND r.key IN ('platform_admin', 'listing_reviewer')
    )
  );

CREATE POLICY property_listings_org_update ON property_listings
  FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = property_listings.organization_id
        AND om.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = property_listings.organization_id
        AND om.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );

-- Import runs / errors / raw snapshots / feed configs: own org read, admin read+write.
CREATE POLICY import_runs_org_select ON import_runs
  FOR SELECT
  USING (
    (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = import_runs.organization_id
          AND om.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      )
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        AND r.key IN ('platform_admin', 'listing_reviewer')
    )
  );

CREATE POLICY import_runs_admin_all ON import_runs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        AND r.key IN ('platform_admin', 'listing_reviewer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        AND r.key IN ('platform_admin', 'listing_reviewer')
    )
  );

CREATE POLICY import_errors_org_select ON import_errors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM import_runs ir
      WHERE ir.id = import_errors.import_run_id
        AND ir.organization_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM organization_members om
          WHERE om.organization_id = ir.organization_id
            AND om.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        )
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        AND r.key IN ('platform_admin', 'listing_reviewer')
    )
  );

CREATE POLICY raw_snapshots_org_select ON raw_snapshots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM import_runs ir
      WHERE ir.id = raw_snapshots.import_run_id
        AND ir.organization_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM organization_members om
          WHERE om.organization_id = ir.organization_id
            AND om.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        )
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        AND r.key IN ('platform_admin', 'listing_reviewer')
    )
  );

CREATE POLICY feed_configs_org_select ON feed_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM data_sources ds
      WHERE ds.id = feed_configs.data_source_id
        AND ds.organization_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM organization_members om
          WHERE om.organization_id = ds.organization_id
            AND om.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        )
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        AND r.key IN ('platform_admin', 'listing_reviewer')
    )
  );

CREATE POLICY feed_configs_admin_all ON feed_configs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        AND r.key IN ('platform_admin', 'listing_reviewer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        AND r.key IN ('platform_admin', 'listing_reviewer')
    )
  );

-- Permission events: platform admin/reviewer only (org members never see or set these).
CREATE POLICY source_permission_events_admin_all ON source_permission_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        AND r.key IN ('platform_admin', 'listing_reviewer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        AND r.key IN ('platform_admin', 'listing_reviewer')
    )
  );

-- Audit events: append-only; own-org SELECT, admin SELECT-all. No client INSERT/UPDATE/DELETE
-- policy — writes happen only through the trusted server (service-role) connection.
CREATE POLICY audit_events_org_select ON audit_events
  FOR SELECT
  USING (
    (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = audit_events.organization_id
          AND om.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      )
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        AND r.key IN ('platform_admin', 'listing_reviewer')
    )
  );

-- Admin write access to the source registry (permission/rights changes); public read
-- policy from Phase 2 (`data_sources_public_read`) remains additive for SELECT.
CREATE POLICY data_sources_admin_write ON data_sources
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        AND r.key IN ('platform_admin', 'listing_reviewer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        AND r.key IN ('platform_admin', 'listing_reviewer')
    )
  );
