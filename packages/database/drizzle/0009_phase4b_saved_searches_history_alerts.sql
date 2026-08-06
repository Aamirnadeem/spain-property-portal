-- Phase 4B: saved searches, browsing history, in-app notifications

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS history_recording_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  criteria jsonb NOT NULL,
  criteria_version varchar(32) NOT NULL,
  criteria_hash varchar(64) NOT NULL,
  sort varchar(64) NOT NULL DEFAULT 'newest',
  idx_min_price numeric(14, 2),
  idx_max_price numeric(14, 2),
  idx_min_bedrooms integer,
  idx_municipality varchar(120),
  idx_province varchar(120),
  idx_property_type varchar(64),
  idx_off_plan varchar(16),
  alerts_enabled boolean NOT NULL DEFAULT false,
  alert_types text[] NOT NULL DEFAULT '{}',
  consented_at timestamptz,
  last_evaluated_at timestamptz,
  last_match_count integer,
  last_evaluation_status varchar(32),
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_searches_user_hash_uidx UNIQUE (user_id, criteria_hash)
);

CREATE INDEX IF NOT EXISTS saved_searches_user_updated_idx ON saved_searches (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS saved_searches_alerts_enabled_idx ON saved_searches (user_id) WHERE alerts_enabled = true;
CREATE INDEX IF NOT EXISTS saved_searches_user_municipality_idx ON saved_searches (user_id, idx_municipality);
CREATE INDEX IF NOT EXISTS saved_searches_user_price_idx ON saved_searches (user_id, idx_min_price, idx_max_price);
CREATE INDEX IF NOT EXISTS saved_searches_user_property_type_idx ON saved_searches (user_id, idx_property_type);

CREATE TABLE IF NOT EXISTS saved_search_evaluation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_search_id uuid NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status varchar(32) NOT NULL,
  match_count integer,
  error_code varchar(64),
  trigger varchar(32) NOT NULL
);

CREATE INDEX IF NOT EXISTS saved_search_evaluation_runs_search_idx
  ON saved_search_evaluation_runs (saved_search_id, started_at DESC);

CREATE TABLE IF NOT EXISTS saved_search_last_matches (
  saved_search_id uuid NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES property_listings(id) ON DELETE CASCADE,
  first_matched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (saved_search_id, listing_id)
);

CREATE TABLE IF NOT EXISTS browsing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES property_listings(id) ON DELETE CASCADE,
  physical_property_id uuid,
  first_viewed_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  view_count integer NOT NULL DEFAULT 1,
  channel varchar(32) NOT NULL DEFAULT 'web',
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT browsing_history_user_listing_uidx UNIQUE (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS browsing_history_user_last_viewed_idx
  ON browsing_history (user_id, last_viewed_at DESC);

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type varchar(64) NOT NULL,
  title_key varchar(128) NOT NULL,
  body_key varchar(128) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  dedupe_key varchar(64) NOT NULL,
  listing_id uuid REFERENCES property_listings(id) ON DELETE SET NULL,
  saved_search_id uuid REFERENCES saved_searches(id) ON DELETE SET NULL,
  source_event_id uuid,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT in_app_notifications_dedupe_uidx UNIQUE (dedupe_key)
);

CREATE INDEX IF NOT EXISTS in_app_notifications_user_created_idx
  ON in_app_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS in_app_notifications_user_unread_idx
  ON in_app_notifications (user_id)
  WHERE read_at IS NULL AND archived_at IS NULL;

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES in_app_notifications(id) ON DELETE CASCADE,
  provider varchar(32) NOT NULL,
  status varchar(32) NOT NULL,
  error_code varchar(64),
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_deliveries_notification_idx
  ON notification_deliveries (notification_id, attempted_at DESC);
