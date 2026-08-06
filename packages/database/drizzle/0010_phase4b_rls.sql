-- Phase 4B RLS: owner-scoped saved searches, browsing history, notifications.
-- Agencies have no SELECT policies on these tables.

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_search_evaluation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_search_last_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE browsing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON saved_searches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_search_evaluation_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_search_last_matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON browsing_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON in_app_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_deliveries TO authenticated;

-- saved_searches
CREATE POLICY saved_searches_owner_select ON saved_searches
  FOR SELECT USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY saved_searches_owner_insert ON saved_searches
  FOR INSERT WITH CHECK (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY saved_searches_owner_update ON saved_searches
  FOR UPDATE USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY saved_searches_owner_delete ON saved_searches
  FOR DELETE USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

-- evaluation runs via parent
CREATE POLICY saved_search_evaluation_runs_owner_select ON saved_search_evaluation_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM saved_searches s
      WHERE s.id = saved_search_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY saved_search_evaluation_runs_owner_insert ON saved_search_evaluation_runs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM saved_searches s
      WHERE s.id = saved_search_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY saved_search_evaluation_runs_owner_update ON saved_search_evaluation_runs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM saved_searches s
      WHERE s.id = saved_search_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY saved_search_evaluation_runs_owner_delete ON saved_search_evaluation_runs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM saved_searches s
      WHERE s.id = saved_search_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );

-- last matches via parent
CREATE POLICY saved_search_last_matches_owner_select ON saved_search_last_matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM saved_searches s
      WHERE s.id = saved_search_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY saved_search_last_matches_owner_insert ON saved_search_last_matches
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM saved_searches s
      WHERE s.id = saved_search_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY saved_search_last_matches_owner_update ON saved_search_last_matches
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM saved_searches s
      WHERE s.id = saved_search_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY saved_search_last_matches_owner_delete ON saved_search_last_matches
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM saved_searches s
      WHERE s.id = saved_search_id
        AND s.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );

-- browsing_history
CREATE POLICY browsing_history_owner_select ON browsing_history
  FOR SELECT USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY browsing_history_owner_insert ON browsing_history
  FOR INSERT WITH CHECK (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY browsing_history_owner_update ON browsing_history
  FOR UPDATE USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY browsing_history_owner_delete ON browsing_history
  FOR DELETE USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

-- in_app_notifications
CREATE POLICY in_app_notifications_owner_select ON in_app_notifications
  FOR SELECT USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY in_app_notifications_owner_insert ON in_app_notifications
  FOR INSERT WITH CHECK (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY in_app_notifications_owner_update ON in_app_notifications
  FOR UPDATE USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY in_app_notifications_owner_delete ON in_app_notifications
  FOR DELETE USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

-- notification_deliveries via parent notification ownership
CREATE POLICY notification_deliveries_owner_select ON notification_deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM in_app_notifications n
      WHERE n.id = notification_id
        AND n.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY notification_deliveries_owner_insert ON notification_deliveries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM in_app_notifications n
      WHERE n.id = notification_id
        AND n.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY notification_deliveries_owner_update ON notification_deliveries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM in_app_notifications n
      WHERE n.id = notification_id
        AND n.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
CREATE POLICY notification_deliveries_owner_delete ON notification_deliveries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM in_app_notifications n
      WHERE n.id = notification_id
        AND n.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
