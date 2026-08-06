import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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

/** Guest workspace JSON stored on guest_sessions (Phase 4A + 4B). */
export type GuestWorkspacePayload = {
  favouriteListingIds: string[];
  comparisonListingIds: string[];
  recentViewListingIds: string[];
  savedSearchCriteria: unknown[];
  shortlists?: Array<{
    name: string;
    isDefault?: boolean;
    listingIds: string[];
    note?: string;
  }>;
  preferenceWeights?: Record<string, number>;
  propertyNotes?: Array<{
    listingId: string;
    body: string;
    positives?: string[];
    negatives?: string[];
  }>;
  savedSearches?: Array<{
    name: string;
    criteria?: unknown;
    criteriaHash?: string;
    alertsEnabled?: boolean;
    alertTypes?: string[];
    disabled?: boolean;
  }>;
  browsingHistory?: Array<{
    listingId: string;
    physicalPropertyId?: string;
    firstViewedAt: string;
    lastViewedAt: string;
    viewCount: number;
    channel?: string;
    context?: Record<string, unknown>;
  }>;
  historyRecordingEnabled?: boolean;
};

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
  payload: jsonb('payload').$type<GuestWorkspacePayload>().notNull().default({
    favouriteListingIds: [],
    comparisonListingIds: [],
    recentViewListingIds: [],
    savedSearchCriteria: [],
    shortlists: [],
    preferenceWeights: {},
    propertyNotes: [],
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
  historyRecordingEnabled: boolean('history_recording_enabled').default(true).notNull(),
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

/* ─── Phase 4A buyer workspace ─────────────────────────────────────────── */

export const shortlists = pgTable(
  'shortlists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex('shortlists_user_name_uidx').on(t.userId, t.name)],
);

export const shortlistItems = pgTable(
  'shortlist_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shortlistId: uuid('shortlist_id')
      .notNull()
      .references(() => shortlists.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => propertyListings.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex('shortlist_items_shortlist_listing_uidx').on(t.shortlistId, t.listingId)],
);

export const propertyNotes = pgTable(
  'property_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => propertyListings.id, { onDelete: 'cascade' }),
    body: text('body').notNull().default(''),
    positives: jsonb('positives').$type<string[]>().notNull().default([]),
    negatives: jsonb('negatives').$type<string[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [uniqueIndex('property_notes_user_listing_uidx').on(t.userId, t.listingId)],
);

export const shortlistNotes = pgTable('shortlist_notes', {
  shortlistId: uuid('shortlist_id')
    .primaryKey()
    .references(() => shortlists.id, { onDelete: 'cascade' }),
  body: text('body').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userPreferenceProfiles = pgTable('user_preference_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 80 }).notNull().default('Default'),
  weights: jsonb('weights').$type<Record<string, number>>().notNull().default({}),
  isActive: boolean('is_active').notNull().default(false),
  ...timestamps,
});

export const comparisonSets = pgTable('comparison_sets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  shortlistId: uuid('shortlist_id').references(() => shortlists.id, { onDelete: 'set null' }),
  weightSnapshot: jsonb('weight_snapshot').$type<Record<string, number> | null>(),
  ...timestamps,
});

export const comparisonItems = pgTable(
  'comparison_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    comparisonSetId: uuid('comparison_set_id')
      .notNull()
      .references(() => comparisonSets.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => propertyListings.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex('comparison_items_set_listing_uidx').on(t.comparisonSetId, t.listingId)],
);

/* ─── Phase 4B saved searches, history, notifications ──────────────────── */

export const savedSearches = pgTable(
  'saved_searches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    criteria: jsonb('criteria').$type<Record<string, unknown>>().notNull(),
    criteriaVersion: varchar('criteria_version', { length: 32 }).notNull(),
    criteriaHash: varchar('criteria_hash', { length: 64 }).notNull(),
    sort: varchar('sort', { length: 64 }).notNull().default('newest'),
    idxMinPrice: numeric('idx_min_price', { precision: 14, scale: 2 }),
    idxMaxPrice: numeric('idx_max_price', { precision: 14, scale: 2 }),
    idxMinBedrooms: integer('idx_min_bedrooms'),
    idxMunicipality: varchar('idx_municipality', { length: 120 }),
    idxProvince: varchar('idx_province', { length: 120 }),
    idxPropertyType: varchar('idx_property_type', { length: 64 }),
    idxOffPlan: varchar('idx_off_plan', { length: 16 }),
    alertsEnabled: boolean('alerts_enabled').notNull().default(false),
    alertTypes: text('alert_types').array().notNull().default([]),
    consentedAt: timestamp('consented_at', { withTimezone: true }),
    lastEvaluatedAt: timestamp('last_evaluated_at', { withTimezone: true }),
    lastMatchCount: integer('last_match_count'),
    lastEvaluationStatus: varchar('last_evaluation_status', { length: 32 }),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('saved_searches_user_hash_uidx').on(t.userId, t.criteriaHash)],
);

export const savedSearchEvaluationRuns = pgTable('saved_search_evaluation_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  savedSearchId: uuid('saved_search_id')
    .notNull()
    .references(() => savedSearches.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: varchar('status', { length: 32 }).notNull(),
  matchCount: integer('match_count'),
  errorCode: varchar('error_code', { length: 64 }),
  trigger: varchar('trigger', { length: 32 }).notNull(),
});

export const savedSearchLastMatches = pgTable(
  'saved_search_last_matches',
  {
    savedSearchId: uuid('saved_search_id')
      .notNull()
      .references(() => savedSearches.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => propertyListings.id, { onDelete: 'cascade' }),
    firstMatchedAt: timestamp('first_matched_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('saved_search_last_matches_uidx').on(t.savedSearchId, t.listingId)],
);

export const browsingHistory = pgTable(
  'browsing_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => propertyListings.id, { onDelete: 'cascade' }),
    physicalPropertyId: uuid('physical_property_id'),
    firstViewedAt: timestamp('first_viewed_at', { withTimezone: true }).defaultNow().notNull(),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }).defaultNow().notNull(),
    viewCount: integer('view_count').notNull().default(1),
    channel: varchar('channel', { length: 32 }).notNull().default('web'),
    context: jsonb('context').$type<Record<string, unknown> | null>(),
    ...timestamps,
  },
  (t) => [uniqueIndex('browsing_history_user_listing_uidx').on(t.userId, t.listingId)],
);

export const inAppNotifications = pgTable(
  'in_app_notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 64 }).notNull(),
    titleKey: varchar('title_key', { length: 128 }).notNull(),
    bodyKey: varchar('body_key', { length: 128 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    dedupeKey: varchar('dedupe_key', { length: 64 }).notNull(),
    listingId: uuid('listing_id').references(() => propertyListings.id, { onDelete: 'set null' }),
    savedSearchId: uuid('saved_search_id').references(() => savedSearches.id, {
      onDelete: 'set null',
    }),
    sourceEventId: uuid('source_event_id'),
    readAt: timestamp('read_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('in_app_notifications_dedupe_uidx').on(t.dedupeKey)],
);

export const notificationDeliveries = pgTable('notification_deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  notificationId: uuid('notification_id')
    .notNull()
    .references(() => inAppNotifications.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 32 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  errorCode: varchar('error_code', { length: 64 }),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).defaultNow().notNull(),
});

/* ─── Phase 4C secure comparison sharing ───────────────────────────────── */

export const comparisonShares = pgTable(
  'comparison_shares',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    comparisonSetId: uuid('comparison_set_id').references(() => comparisonSets.id, {
      onDelete: 'set null',
    }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    publicTitle: varchar('public_title', { length: 120 }),
    publicDescription: varchar('public_description', { length: 500 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedByShareId: uuid('replaced_by_share_id').references(
      (): AnyPgColumn => comparisonShares.id,
      { onDelete: 'set null' },
    ),
    manifest: jsonb('manifest').$type<Record<string, unknown>>().notNull(),
    includeWeights: boolean('include_weights').notNull().default(false),
    includeScores: boolean('include_scores').notNull().default(false),
    scoreModelVersion: varchar('score_model_version', { length: 32 }),
    weightSnapshot: jsonb('weight_snapshot').$type<Record<string, number> | null>(),
    accessCount: integer('access_count').notNull().default(0),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('comparison_shares_token_hash_uidx').on(t.tokenHash),
    index('comparison_shares_user_created_idx').on(t.userId, t.createdAt),
    index('comparison_shares_user_status_idx').on(t.userId, t.revokedAt, t.expiresAt),
    index('comparison_shares_user_active_idx')
      .on(t.userId, t.expiresAt)
      .where(sql`${t.revokedAt} IS NULL`),
    check('comparison_shares_expiry_check', sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);

export const comparisonShareItems = pgTable(
  'comparison_share_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shareId: uuid('share_id')
      .notNull()
      .references(() => comparisonShares.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id').references(() => propertyListings.id, {
      onDelete: 'set null',
    }),
    position: smallint('position').notNull(),
    physicalPropertyId: uuid('physical_property_id'),
  },
  (t) => [
    uniqueIndex('comparison_share_items_share_listing_uidx').on(t.shareId, t.listingId),
    uniqueIndex('comparison_share_items_share_position_uidx').on(t.shareId, t.position),
    index('comparison_share_items_share_position_idx').on(t.shareId, t.position),
    index('comparison_share_items_listing_idx').on(t.listingId),
  ],
);

export const comparisonShareAccessEvents = pgTable(
  'comparison_share_access_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shareId: uuid('share_id')
      .notNull()
      .references(() => comparisonShares.id, { onDelete: 'cascade' }),
    accessedAt: timestamp('accessed_at', { withTimezone: true }).defaultNow().notNull(),
    result: varchar('result', { length: 32 }).notNull(),
    uaCategory: varchar('ua_category', { length: 32 }),
  },
  (t) => [
    index('comparison_share_access_events_share_accessed_idx').on(t.shareId, t.accessedAt),
    check(
      'comparison_share_access_events_result_check',
      sql`${t.result} IN ('ok', 'not_found', 'expired', 'revoked')`,
    ),
    check(
      'comparison_share_access_events_ua_check',
      sql`${t.uaCategory} IS NULL OR ${t.uaCategory} IN ('browser', 'bot', 'preview', 'other')`,
    ),
  ],
);
