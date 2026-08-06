-- Phase 4C RLS: buyer-owned share management only.
-- Public token resolution uses the service-role path; anon receives no table privileges.

ALTER TABLE comparison_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_share_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_share_access_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON comparison_shares FROM anon;
REVOKE ALL ON comparison_share_items FROM anon;
REVOKE ALL ON comparison_share_access_events FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON comparison_shares TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON comparison_share_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON comparison_share_access_events TO authenticated;

CREATE POLICY comparison_shares_owner_select ON comparison_shares
  FOR SELECT USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY comparison_shares_owner_insert ON comparison_shares
  FOR INSERT WITH CHECK (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY comparison_shares_owner_update ON comparison_shares
  FOR UPDATE
  USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY comparison_shares_owner_delete ON comparison_shares
  FOR DELETE USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

CREATE POLICY comparison_share_items_owner_select ON comparison_share_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM comparison_shares s
      WHERE s.id = share_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY comparison_share_items_owner_insert ON comparison_share_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM comparison_shares s
      WHERE s.id = share_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY comparison_share_items_owner_update ON comparison_share_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM comparison_shares s
      WHERE s.id = share_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM comparison_shares s
      WHERE s.id = share_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY comparison_share_items_owner_delete ON comparison_share_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM comparison_shares s
      WHERE s.id = share_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );

CREATE POLICY comparison_share_access_events_owner_select ON comparison_share_access_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM comparison_shares s
      WHERE s.id = share_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY comparison_share_access_events_owner_insert ON comparison_share_access_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM comparison_shares s
      WHERE s.id = share_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY comparison_share_access_events_owner_update ON comparison_share_access_events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM comparison_shares s
      WHERE s.id = share_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM comparison_shares s
      WHERE s.id = share_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY comparison_share_access_events_owner_delete ON comparison_share_access_events
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM comparison_shares s
      WHERE s.id = share_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
