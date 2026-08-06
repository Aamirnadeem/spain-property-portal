-- Phase 3.1: authenticated-role write policies so withAuthenticatedDb request paths
-- can mutate org listings / write audit rows under RLS (not only service-role).
-- CSV ingestion remains a service-role exception after API session checks.

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

CREATE POLICY audit_events_authenticated_insert ON audit_events
  FOR INSERT
  WITH CHECK (
    actor_user_id IS NOT NULL
    AND actor_user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
  );

CREATE POLICY listing_price_history_org_or_admin_insert ON listing_price_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM property_listings pl
      WHERE pl.id = listing_price_history.listing_id
        AND (
          (
            pl.organization_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM organization_members om
              WHERE om.organization_id = pl.organization_id
                AND om.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
            )
          )
          OR EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
              AND r.key IN ('platform_admin', 'listing_reviewer')
          )
        )
    )
  );

CREATE POLICY listing_status_history_org_or_admin_insert ON listing_status_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM property_listings pl
      WHERE pl.id = listing_status_history.listing_id
        AND (
          (
            pl.organization_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM organization_members om
              WHERE om.organization_id = pl.organization_id
                AND om.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
            )
          )
          OR EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
              AND r.key IN ('platform_admin', 'listing_reviewer')
          )
        )
    )
  );
