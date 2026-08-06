-- Phase 4C: secure, expiring, revocable comparison shares.

CREATE TABLE IF NOT EXISTS comparison_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comparison_set_id uuid REFERENCES comparison_sets(id) ON DELETE SET NULL,
  token_hash varchar(64) NOT NULL,
  public_title varchar(120),
  public_description varchar(500),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by_share_id uuid,
  manifest jsonb NOT NULL,
  include_weights boolean NOT NULL DEFAULT false,
  include_scores boolean NOT NULL DEFAULT false,
  score_model_version varchar(32),
  weight_snapshot jsonb,
  access_count integer NOT NULL DEFAULT 0,
  last_accessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comparison_shares_token_hash_uidx UNIQUE (token_hash),
  CONSTRAINT comparison_shares_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT comparison_shares_replacement_fk
    FOREIGN KEY (replaced_by_share_id) REFERENCES comparison_shares(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS comparison_shares_user_created_idx
  ON comparison_shares (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS comparison_shares_user_status_idx
  ON comparison_shares (user_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS comparison_shares_user_active_idx
  ON comparison_shares (user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS comparison_share_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES comparison_shares(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES property_listings(id) ON DELETE SET NULL,
  position smallint NOT NULL,
  physical_property_id uuid,
  CONSTRAINT comparison_share_items_share_listing_uidx UNIQUE (share_id, listing_id),
  CONSTRAINT comparison_share_items_share_position_uidx UNIQUE (share_id, position)
);

CREATE INDEX IF NOT EXISTS comparison_share_items_share_position_idx
  ON comparison_share_items (share_id, position);
CREATE INDEX IF NOT EXISTS comparison_share_items_listing_idx
  ON comparison_share_items (listing_id);

CREATE TABLE IF NOT EXISTS comparison_share_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES comparison_shares(id) ON DELETE CASCADE,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  result varchar(32) NOT NULL,
  ua_category varchar(32),
  CONSTRAINT comparison_share_access_events_result_check
    CHECK (result IN ('ok', 'not_found', 'expired', 'revoked')),
  CONSTRAINT comparison_share_access_events_ua_check
    CHECK (ua_category IS NULL OR ua_category IN ('browser', 'bot', 'preview', 'other'))
);

CREATE INDEX IF NOT EXISTS comparison_share_access_events_share_accessed_idx
  ON comparison_share_access_events (share_id, accessed_at DESC);
