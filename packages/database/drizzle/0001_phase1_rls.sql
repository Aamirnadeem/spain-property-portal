CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_channel_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_rights ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self_select ON users
  FOR SELECT
  USING (id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY users_self_insert ON users
  FOR INSERT
  WITH CHECK (id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY users_self_update ON users
  FOR UPDATE
  USING (id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

CREATE POLICY user_profiles_self_all ON user_profiles
  FOR ALL
  USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

CREATE POLICY auth_identities_self_select ON auth_identities
  FOR SELECT
  USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

CREATE POLICY guest_sessions_by_hash_select ON guest_sessions
  FOR SELECT
  USING (
    anonymous_key_hash = NULLIF(current_setting('app.guest_key_hash', true), '')
    AND merged_at IS NULL
    AND expires_at > now()
  );
CREATE POLICY guest_sessions_by_hash_insert ON guest_sessions
  FOR INSERT
  WITH CHECK (
    anonymous_key_hash = NULLIF(current_setting('app.guest_key_hash', true), '')
    AND merged_into_user_id IS NULL
    AND merged_at IS NULL
  );
CREATE POLICY guest_sessions_by_hash_update ON guest_sessions
  FOR UPDATE
  USING (
    anonymous_key_hash = NULLIF(current_setting('app.guest_key_hash', true), '')
    AND merged_at IS NULL
  )
  WITH CHECK (
    anonymous_key_hash = NULLIF(current_setting('app.guest_key_hash', true), '')
  );
CREATE POLICY guest_sessions_by_hash_delete ON guest_sessions
  FOR DELETE
  USING (
    anonymous_key_hash = NULLIF(current_setting('app.guest_key_hash', true), '')
  );

CREATE POLICY user_channel_identities_self_select ON user_channel_identities
  FOR SELECT
  USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

CREATE POLICY user_roles_self_select ON user_roles
  FOR SELECT
  USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

CREATE POLICY user_consents_self_all ON user_consents
  FOR ALL
  USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

CREATE POLICY notification_preferences_self_all ON notification_preferences
  FOR ALL
  USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

CREATE POLICY privacy_requests_self_select ON privacy_requests
  FOR SELECT
  USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);
CREATE POLICY privacy_requests_self_insert ON privacy_requests
  FOR INSERT
  WITH CHECK (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);