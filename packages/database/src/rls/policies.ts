/**
 * SQL policy statements applied after schema migrate.
 * Tests assert expected policy names and that buyer isolation rules are defined.
 */
export const rlsPolicyStatements = [
  `ALTER TABLE users ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE auth_identities ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE organizations ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE privacy_requests ENABLE ROW LEVEL SECURITY`,
  // Public read for geography
  `ALTER TABLE countries ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE autonomous_communities ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE provinces ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE municipalities ENABLE ROW LEVEL SECURITY`,
  `CREATE POLICY users_self_select ON users FOR SELECT USING (id = NULLIF(current_setting('app.user_id', true), '')::uuid)`,
  `CREATE POLICY users_self_update ON users FOR UPDATE USING (id = NULLIF(current_setting('app.user_id', true), '')::uuid)`,
  `CREATE POLICY guest_sessions_by_key ON guest_sessions FOR SELECT USING (anonymous_key = current_setting('app.guest_key', true))`,
  `CREATE POLICY auth_identities_self ON auth_identities FOR SELECT USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)`,
  `CREATE POLICY org_members_self ON organization_members FOR SELECT USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)`,
  `CREATE POLICY consents_self ON user_consents FOR SELECT USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)`,
  `CREATE POLICY privacy_self ON privacy_requests FOR SELECT USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)`,
  `CREATE POLICY countries_public_read ON countries FOR SELECT USING (true)`,
  `CREATE POLICY ac_public_read ON autonomous_communities FOR SELECT USING (true)`,
  `CREATE POLICY provinces_public_read ON provinces FOR SELECT USING (true)`,
  `CREATE POLICY municipalities_public_read ON municipalities FOR SELECT USING (true)`,
] as const;

export const expectedRlsTables = [
  'users',
  'guest_sessions',
  'auth_identities',
  'organizations',
  'organization_members',
  'user_consents',
  'privacy_requests',
  'countries',
] as const;
