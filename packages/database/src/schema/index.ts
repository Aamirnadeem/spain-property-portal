import {
  boolean,
  integer,
  jsonb,
  numeric,
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
  /** Supabase Auth user UUID; never generate a second application identity. */
  id: uuid('id').primaryKey(),
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
  /** SHA-256 hash of the opaque guest token; plaintext tokens are never stored. */
  anonymousKeyHash: varchar('anonymous_key_hash', { length: 64 }).notNull().unique(),
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

/* Phase 2 inventory */
export const listingOperationalStatusEnum = pgEnum('listing_operational_status', [
  'draft',
  'pending_review',
  'published',
  'available',
  'reserved',
  'under_offer',
  'sold',
  'temporarily_unverified',
  'stale',
  'withdrawn',
  'rejected',
  'legacy_snapshot',
]);

export const freshnessMethodEnum = pgEnum('freshness_method', [
  'legacy_snapshot',
  'partner_feed',
  'manual',
  'authorized_crawl',
  'unknown',
]);

export const sourceTypeEnum = pgEnum('data_source_type', [
  'api',
  'webhook',
  'xml',
  'json',
  'csv',
  'manual',
  'authorized_crawl',
  'legacy_snapshot',
]);

export const sourcePermissionStatusEnum = pgEnum('source_permission_status', [
  'pending',
  'approved',
  'restricted',
  'suspended',
  'expired',
]);

export const imageRightsEnum = pgEnum('image_rights', [
  'none',
  'hotlink_only',
  'display',
  'download_and_transform',
]);

export const importRunStatusEnum = pgEnum('import_run_status', [
  'running',
  'completed',
  'completed_with_errors',
  'failed',
]);

export const dataSources = pgTable('data_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceKey: varchar('source_key', { length: 120 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  sourceType: sourceTypeEnum('source_type').notNull(),
  permissionStatus: sourcePermissionStatusEnum('permission_status').notNull(),
  imageRights: imageRightsEnum('image_rights').default('none').notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  /** Gate uses expiry: jobs must refuse to run once past this timestamp. */
  permissionExpiresAt: timestamp('permission_expires_at', { withTimezone: true }),
  notes: text('notes'),
  ...timestamps,
});

/** Format + column mapping for a data source's feed (Spain Partner CSV v1 in the Phase 3 slice). */
export const feedConfigs = pgTable('feed_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  dataSourceId: uuid('data_source_id')
    .notNull()
    .references(() => dataSources.id, { onDelete: 'cascade' }),
  format: sourceTypeEnum('format').notNull(),
  mapping: jsonb('mapping').$type<Record<string, unknown>>().default({}),
  scheduleCron: varchar('schedule_cron', { length: 64 }),
  isActive: boolean('is_active').default(true).notNull(),
  ...timestamps,
});

/** Append-only history of permission_status / image_rights changes (audited, admin-only). */
export const sourcePermissionEvents = pgTable('source_permission_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  dataSourceId: uuid('data_source_id')
    .notNull()
    .references(() => dataSources.id, { onDelete: 'cascade' }),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  fromStatus: sourcePermissionStatusEnum('from_status'),
  toStatus: sourcePermissionStatusEnum('to_status').notNull(),
  fromImageRights: imageRightsEnum('from_image_rights'),
  toImageRights: imageRightsEnum('to_image_rights'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const propertyTypes = pgTable('property_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 64 }).notNull().unique(),
  labelEn: varchar('label_en', { length: 120 }).notNull(),
  ...timestamps,
});

export const features = pgTable('features', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 64 }).notNull().unique(),
  labelEn: varchar('label_en', { length: 120 }).notNull(),
  category: varchar('category', { length: 64 }),
  ...timestamps,
});

export const physicalProperties = pgTable('physical_properties', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyTypeId: uuid('property_type_id').references(() => propertyTypes.id),
  bedrooms: integer('bedrooms'),
  bathrooms: integer('bathrooms'),
  builtAreaSqm: numeric('built_area_sqm', { precision: 12, scale: 2 }),
  usableAreaSqm: numeric('usable_area_sqm', { precision: 12, scale: 2 }),
  confidence: varchar('confidence', { length: 32 }).default('provisional').notNull(),
  ...timestamps,
});

export const propertyAddresses = pgTable('property_addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  physicalPropertyId: uuid('physical_property_id')
    .notNull()
    .references(() => physicalProperties.id, { onDelete: 'cascade' }),
  freeText: text('free_text'),
  street: varchar('street', { length: 200 }),
  locality: varchar('locality', { length: 120 }),
  postalCode: varchar('postal_code', { length: 16 }),
  countryCode: varchar('country_code', { length: 2 }).default('ES'),
  accuracy: varchar('accuracy', { length: 32 }).default('approximate').notNull(),
  ...timestamps,
});

export const propertyLocations = pgTable('property_locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  physicalPropertyId: uuid('physical_property_id')
    .notNull()
    .references(() => physicalProperties.id, { onDelete: 'cascade' }),
  municipalityId: uuid('municipality_id').references(() => municipalities.id),
  neighborhoodId: uuid('neighborhood_id').references(() => neighborhoods.id),
  areaLabel: varchar('area_label', { length: 120 }),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  accuracy: varchar('accuracy', { length: 32 }).default('unknown').notNull(),
  displayPolicy: varchar('display_policy', { length: 32 }).default('approximate').notNull(),
  ...timestamps,
});

export const propertyListings = pgTable(
  'property_listings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dataSourceId: uuid('data_source_id')
      .notNull()
      .references(() => dataSources.id),
    externalListingId: varchar('external_listing_id', { length: 120 }).notNull(),
    physicalPropertyId: uuid('physical_property_id').references(() => physicalProperties.id),
    organizationId: uuid('organization_id').references(() => organizations.id),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description'),
    sourceUrl: text('source_url'),
    portalName: varchar('portal_name', { length: 120 }),
    currency: varchar('currency', { length: 3 }).default('EUR').notNull(),
    priceAmount: numeric('price_amount', { precision: 14, scale: 2 }),
    bedrooms: integer('bedrooms'),
    bathrooms: integer('bathrooms'),
    builtAreaSqm: numeric('built_area_sqm', { precision: 12, scale: 2 }),
    pricePerSqm: numeric('price_per_sqm', { precision: 14, scale: 2 }),
    propertyTypeRaw: varchar('property_type_raw', { length: 120 }),
    propertyTypeKey: varchar('property_type_key', { length: 64 }),
    environmentType: varchar('environment_type', { length: 64 }),
    areaLabel: varchar('area_label', { length: 120 }),
    addressText: text('address_text'),
    nearestTransit: text('nearest_transit'),
    commuteMin: integer('commute_min'),
    beachProximity: varchar('beach_proximity', { length: 200 }),
    parkProximity: varchar('park_proximity', { length: 200 }),
    operationalStatus: listingOperationalStatusEnum('operational_status')
      .default('legacy_snapshot')
      .notNull(),
    freshnessMethod: freshnessMethodEnum('freshness_method').default('legacy_snapshot').notNull(),
    isLegacySnapshot: boolean('is_legacy_snapshot').default(false).notNull(),
    isPublicBrowseable: boolean('is_public_browseable').default(false).notNull(),
    sourceCreatedAt: timestamp('source_created_at', { withTimezone: true }),
    sourceUpdatedAt: timestamp('source_updated_at', { withTimezone: true }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    lastContentChangeAt: timestamp('last_content_change_at', { withTimezone: true }),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    lastConfirmedAvailableAt: timestamp('last_confirmed_available_at', {
      withTimezone: true,
    }),
    importedAt: timestamp('imported_at', { withTimezone: true }),
    searchDocument: text('search_document'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('property_listings_source_external_uidx').on(t.dataSourceId, t.externalListingId),
  ],
);

export const listingPriceHistory = pgTable('listing_price_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => propertyListings.id, { onDelete: 'cascade' }),
  currency: varchar('currency', { length: 3 }).default('EUR').notNull(),
  priceAmount: numeric('price_amount', { precision: 14, scale: 2 }).notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  source: varchar('source', { length: 64 }).default('import').notNull(),
});

export const listingStatusHistory = pgTable('listing_status_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => propertyListings.id, { onDelete: 'cascade' }),
  status: listingOperationalStatusEnum('status').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  note: text('note'),
});

export const propertyFeatures = pgTable(
  'property_features',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => propertyListings.id, { onDelete: 'cascade' }),
    featureId: uuid('feature_id')
      .notNull()
      .references(() => features.id, { onDelete: 'cascade' }),
    valueText: varchar('value_text', { length: 200 }),
    provenance: varchar('provenance', { length: 64 }).default('source_claim').notNull(),
  },
  (t) => [uniqueIndex('property_features_listing_feature_uidx').on(t.listingId, t.featureId)],
);

export const sourceClaims = pgTable('source_claims', {
  id: uuid('id').defaultRandom().primaryKey(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => propertyListings.id, { onDelete: 'cascade' }),
  fieldName: varchar('field_name', { length: 120 }).notNull(),
  rawValue: text('raw_value'),
  normalizedValue: text('normalized_value'),
  claimSource: varchar('claim_source', { length: 64 }).default('legacy_json').notNull(),
  ...timestamps,
});

export const propertyProvenance = pgTable('property_provenance', {
  id: uuid('id').defaultRandom().primaryKey(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => propertyListings.id, { onDelete: 'cascade' })
    .unique(),
  dataSourceId: uuid('data_source_id')
    .notNull()
    .references(() => dataSources.id),
  externalListingId: varchar('external_listing_id', { length: 120 }).notNull(),
  sourceUrl: text('source_url'),
  importMethod: freshnessMethodEnum('import_method').notNull(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull(),
  rawSnapshot: jsonb('raw_snapshot').$type<Record<string, unknown>>(),
  notes: text('notes'),
  ...timestamps,
});

export const listingMedia = pgTable('listing_media', {
  id: uuid('id').defaultRandom().primaryKey(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => propertyListings.id, { onDelete: 'cascade' }),
  mediaAssetId: uuid('media_asset_id').references(() => mediaAssets.id),
  sortOrder: integer('sort_order').default(0).notNull(),
  isPlaceholder: boolean('is_placeholder').default(true).notNull(),
  caption: varchar('caption', { length: 200 }),
  ...timestamps,
});

export const importRunModeEnum = pgEnum('import_run_mode', ['dry_run', 'full', 'incremental']);

export const importRuns = pgTable('import_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  dataSourceId: uuid('data_source_id')
    .notNull()
    .references(() => dataSources.id),
  /** Denormalized from data_sources.organization_id for RLS and partner queries. */
  organizationId: uuid('organization_id').references(() => organizations.id),
  feedConfigId: uuid('feed_config_id').references(() => feedConfigs.id),
  rawSnapshotId: uuid('raw_snapshot_id'),
  mode: importRunModeEnum('mode').default('full').notNull(),
  parserVersion: varchar('parser_version', { length: 32 }),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  status: importRunStatusEnum('status').default('running').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  totalRecords: integer('total_records').default(0).notNull(),
  insertedCount: integer('inserted_count').default(0).notNull(),
  updatedCount: integer('updated_count').default(0).notNull(),
  skippedCount: integer('skipped_count').default(0).notNull(),
  rejectedCount: integer('rejected_count').default(0).notNull(),
  report: jsonb('report').$type<Record<string, unknown>>().default({}),
  ...timestamps,
});

export const importErrors = pgTable('import_errors', {
  id: uuid('id').defaultRandom().primaryKey(),
  importRunId: uuid('import_run_id')
    .notNull()
    .references(() => importRuns.id, { onDelete: 'cascade' }),
  externalListingId: varchar('external_listing_id', { length: 120 }),
  recordIndex: integer('record_index'),
  code: varchar('code', { length: 64 }).notNull(),
  message: text('message').notNull(),
  rawRecord: jsonb('raw_record').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Immutable pre-parse payload for replay and audit (sha256 dedupe, not a business record). */
export const rawSnapshots = pgTable('raw_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  importRunId: uuid('import_run_id')
    .notNull()
    .references(() => importRuns.id, { onDelete: 'cascade' }),
  dataSourceId: uuid('data_source_id')
    .notNull()
    .references(() => dataSources.id),
  contentSha256: varchar('content_sha256', { length: 64 }).notNull(),
  parserVersion: varchar('parser_version', { length: 32 }).notNull(),
  byteSize: integer('byte_size').notNull(),
  /** Row-level fixtures fit inline; larger payloads should move to StorageProvider by storage_ref (future work). */
  payload: jsonb('payload').$type<Record<string, unknown> | unknown[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Append-only audit trail for sensitive actions (publish, withdraw, permission change, price/status update). */
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  organizationId: uuid('organization_id').references(() => organizations.id),
  action: varchar('action', { length: 120 }).notNull(),
  entityType: varchar('entity_type', { length: 64 }).notNull(),
  entityId: uuid('entity_id'),
  before: jsonb('before').$type<Record<string, unknown> | null>(),
  after: jsonb('after').$type<Record<string, unknown> | null>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const favourites = pgTable(
  'favourites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => propertyListings.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [uniqueIndex('favourites_user_listing_uidx').on(t.userId, t.listingId)],
);
