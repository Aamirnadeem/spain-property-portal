import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const authIdentityTypeEnum = pgEnum('auth_identity_type', ['email', 'mobile']);
export const permissionStatusEnum = pgEnum('org_verification_status', [
  'pending',
  'verified',
  'rejected',
  'suspended',
]);
export const consentPurposeEnum = pgEnum('consent_purpose', [
  'essential',
  'analytics',
  'email_transactional',
  'email_marketing',
  'sms_notifications',
  'whatsapp_transactional',
  'whatsapp_marketing',
  'profiling',
  'call_recording',
]);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  displayName: varchar('display_name', { length: 200 }),
  primaryLocale: varchar('primary_locale', { length: 8 }).default('en').notNull(),
  preferredCurrency: varchar('preferred_currency', { length: 3 }).default('EUR').notNull(),
  status: varchar('status', { length: 32 }).default('active').notNull(),
  ...timestamps,
});

export const userProfiles = pgTable('user_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  bio: text('bio'),
  marketingOptIn: boolean('marketing_opt_in').default(false).notNull(),
  ...timestamps,
});

export const authIdentities = pgTable(
  'auth_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: authIdentityTypeEnum('type').notNull(),
    value: varchar('value', { length: 320 }).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('auth_identities_type_value_uidx').on(t.type, t.value)],
);

export const guestSessions = pgTable('guest_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  anonymousKey: varchar('anonymous_key', { length: 128 }).notNull().unique(),
  locale: varchar('locale', { length: 8 }).default('en'),
  payload: jsonb('payload')
    .$type<{
      favouriteListingIds: string[];
      comparisonListingIds: string[];
      recentViewListingIds: string[];
      savedSearchCriteria: unknown[];
    }>()
    .notNull()
    .default({
      favouriteListingIds: [],
      comparisonListingIds: [],
      recentViewListingIds: [],
      savedSearchCriteria: [],
    }),
  mergedIntoUserId: uuid('merged_into_user_id').references(() => users.id),
  mergedAt: timestamp('merged_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ...timestamps,
});

export const userChannelIdentities = pgTable(
  'user_channel_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: varchar('channel', { length: 32 }).notNull(),
    externalId: varchar('external_id', { length: 320 }).notNull(),
    linkedAt: timestamp('linked_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('user_channel_identities_uidx').on(t.channel, t.externalId)],
);

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  type: varchar('type', { length: 64 }).default('agency').notNull(),
  status: varchar('status', { length: 32 }).default('pending').notNull(),
  ...timestamps,
});

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 64 }).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('organization_members_uidx').on(t.organizationId, t.userId)],
);

export const organizationVerifications = pgTable('organization_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  status: permissionStatusEnum('status').default('pending').notNull(),
  notes: text('notes'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  ...timestamps,
});

export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 64 }).notNull().unique(),
  description: text('description'),
  ...timestamps,
});

export const permissions = pgTable('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 128 }).notNull().unique(),
  description: text('description'),
  ...timestamps,
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('role_permissions_uidx').on(t.roleId, t.permissionId)],
);

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('user_roles_uidx').on(t.userId, t.roleId)],
);

export const userConsents = pgTable('user_consents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  purpose: consentPurposeEnum('purpose').notNull(),
  granted: boolean('granted').notNull(),
  source: varchar('source', { length: 64 }).default('web').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  ...timestamps,
});

export const notificationPreferences = pgTable('notification_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  emailAlerts: boolean('email_alerts').default(true).notNull(),
  smsAlerts: boolean('sms_alerts').default(false).notNull(),
  whatsappAlerts: boolean('whatsapp_alerts').default(false).notNull(),
  quietHoursStart: integer('quiet_hours_start'),
  quietHoursEnd: integer('quiet_hours_end'),
  ...timestamps,
});

export const privacyRequests = pgTable('privacy_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 32 }).notNull(),
  status: varchar('status', { length: 32 }).default('pending').notNull(),
  ...timestamps,
});

export const securityEvents = pgTable('security_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  guestSessionId: uuid('guest_session_id').references(() => guestSessions.id),
  type: varchar('type', { length: 64 }).notNull(),
  ip: varchar('ip', { length: 64 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Call tables early (unused in MVP) */
export const callSessions = pgTable('call_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  channel: varchar('channel', { length: 32 }).default('phone_voice').notNull(),
  status: varchar('status', { length: 32 }).default('created').notNull(),
  ...timestamps,
});

export const callConsents = pgTable('call_consents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  callSessionId: uuid('call_session_id').references(() => callSessions.id),
  granted: boolean('granted').default(false).notNull(),
  ...timestamps,
});

export const callRecordings = pgTable('call_recordings', {
  id: uuid('id').defaultRandom().primaryKey(),
  callSessionId: uuid('call_session_id')
    .notNull()
    .references(() => callSessions.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key'),
  retentionClass: varchar('retention_class', { length: 32 }).default('call_recording'),
  ...timestamps,
});

/* Geography foundation */
export const countries = pgTable('countries', {
  id: uuid('id').defaultRandom().primaryKey(),
  iso2: varchar('iso2', { length: 2 }).notNull().unique(),
  nameEn: varchar('name_en', { length: 120 }).notNull(),
  nameLocal: varchar('name_local', { length: 120 }),
  ...timestamps,
});

export const autonomousCommunities = pgTable(
  'autonomous_communities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    countryId: uuid('country_id')
      .notNull()
      .references(() => countries.id),
    code: varchar('code', { length: 16 }),
    nameEn: varchar('name_en', { length: 120 }).notNull(),
    nameEs: varchar('name_es', { length: 120 }),
    nameCa: varchar('name_ca', { length: 120 }),
    ...timestamps,
  },
  (t) => [uniqueIndex('autonomous_communities_country_name_uidx').on(t.countryId, t.nameEn)],
);

export const provinces = pgTable(
  'provinces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    autonomousCommunityId: uuid('autonomous_community_id')
      .notNull()
      .references(() => autonomousCommunities.id),
    code: varchar('code', { length: 16 }),
    nameEn: varchar('name_en', { length: 120 }).notNull(),
    nameEs: varchar('name_es', { length: 120 }),
    ...timestamps,
  },
  (t) => [uniqueIndex('provinces_community_name_uidx').on(t.autonomousCommunityId, t.nameEn)],
);

export const municipalities = pgTable(
  'municipalities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provinceId: uuid('province_id')
      .notNull()
      .references(() => provinces.id),
    code: varchar('code', { length: 16 }),
    nameEn: varchar('name_en', { length: 120 }).notNull(),
    nameEs: varchar('name_es', { length: 120 }),
    nameCa: varchar('name_ca', { length: 120 }),
    ...timestamps,
  },
  (t) => [uniqueIndex('municipalities_province_name_uidx').on(t.provinceId, t.nameEn)],
);

export const neighborhoods = pgTable('neighborhoods', {
  id: uuid('id').defaultRandom().primaryKey(),
  municipalityId: uuid('municipality_id')
    .notNull()
    .references(() => municipalities.id),
  nameEn: varchar('name_en', { length: 120 }).notNull(),
  nameEs: varchar('name_es', { length: 120 }),
  nameCa: varchar('name_ca', { length: 120 }),
  ...timestamps,
});

export const geoAliases = pgTable('geo_aliases', {
  id: uuid('id').defaultRandom().primaryKey(),
  entityType: varchar('entity_type', { length: 64 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  alias: varchar('alias', { length: 200 }).notNull(),
  locale: varchar('locale', { length: 8 }),
  ...timestamps,
});

export const mediaAssets = pgTable('media_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  storageKey: text('storage_key').notNull(),
  contentType: varchar('content_type', { length: 128 }).notNull(),
  byteSize: integer('byte_size'),
  width: integer('width'),
  height: integer('height'),
  status: varchar('status', { length: 32 }).default('pending').notNull(),
  ...timestamps,
});

export const mediaRights = pgTable('media_rights', {
  id: uuid('id').defaultRandom().primaryKey(),
  mediaAssetId: uuid('media_asset_id')
    .notNull()
    .references(() => mediaAssets.id, { onDelete: 'cascade' })
    .unique(),
  rightsOwner: varchar('rights_owner', { length: 200 }),
  rightsBasis: varchar('rights_basis', { length: 64 }).notNull(),
  attribution: text('attribution'),
  status: varchar('status', { length: 32 }).default('pending').notNull(),
  ...timestamps,
});
