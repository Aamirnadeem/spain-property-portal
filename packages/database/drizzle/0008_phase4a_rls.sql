-- Phase 4A RLS: owner-scoped buyer workspace. Agencies have no SELECT policies.

ALTER TABLE shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shortlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shortlist_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preference_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_items ENABLE ROW LEVEL SECURITY;

-- shortlists
CREATE POLICY shortlists_owner_select ON shortlists
  FOR SELECT USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY shortlists_owner_insert ON shortlists
  FOR INSERT WITH CHECK (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY shortlists_owner_update ON shortlists
  FOR UPDATE USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY shortlists_owner_delete ON shortlists
  FOR DELETE USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

-- shortlist_items via parent ownership
CREATE POLICY shortlist_items_owner_select ON shortlist_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shortlists s
      WHERE s.id = shortlist_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY shortlist_items_owner_insert ON shortlist_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM shortlists s
      WHERE s.id = shortlist_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY shortlist_items_owner_update ON shortlist_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM shortlists s
      WHERE s.id = shortlist_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY shortlist_items_owner_delete ON shortlist_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM shortlists s
      WHERE s.id = shortlist_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );

-- property_notes
CREATE POLICY property_notes_owner_select ON property_notes
  FOR SELECT USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY property_notes_owner_insert ON property_notes
  FOR INSERT WITH CHECK (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY property_notes_owner_update ON property_notes
  FOR UPDATE USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY property_notes_owner_delete ON property_notes
  FOR DELETE USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

-- shortlist_notes via parent
CREATE POLICY shortlist_notes_owner_select ON shortlist_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shortlists s
      WHERE s.id = shortlist_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY shortlist_notes_owner_insert ON shortlist_notes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM shortlists s
      WHERE s.id = shortlist_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY shortlist_notes_owner_update ON shortlist_notes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM shortlists s
      WHERE s.id = shortlist_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY shortlist_notes_owner_delete ON shortlist_notes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM shortlists s
      WHERE s.id = shortlist_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );

-- preference profiles
CREATE POLICY user_preference_profiles_owner_select ON user_preference_profiles
  FOR SELECT USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY user_preference_profiles_owner_insert ON user_preference_profiles
  FOR INSERT WITH CHECK (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY user_preference_profiles_owner_update ON user_preference_profiles
  FOR UPDATE USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY user_preference_profiles_owner_delete ON user_preference_profiles
  FOR DELETE USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

-- comparison_sets
CREATE POLICY comparison_sets_owner_select ON comparison_sets
  FOR SELECT USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY comparison_sets_owner_insert ON comparison_sets
  FOR INSERT WITH CHECK (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY comparison_sets_owner_update ON comparison_sets
  FOR UPDATE USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY comparison_sets_owner_delete ON comparison_sets
  FOR DELETE USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

-- comparison_items via parent
CREATE POLICY comparison_items_owner_select ON comparison_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM comparison_sets c
      WHERE c.id = comparison_set_id
        AND c.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY comparison_items_owner_insert ON comparison_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM comparison_sets c
      WHERE c.id = comparison_set_id
        AND c.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY comparison_items_owner_update ON comparison_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM comparison_sets c
      WHERE c.id = comparison_set_id
        AND c.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY comparison_items_owner_delete ON comparison_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM comparison_sets c
      WHERE c.id = comparison_set_id
        AND c.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );

-- Grants for authenticated role (mirrors Phase 3.1 pattern)
GRANT SELECT, INSERT, UPDATE, DELETE ON shortlists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON shortlist_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON property_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON shortlist_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_preference_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON comparison_sets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON comparison_items TO authenticated;
