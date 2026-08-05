-- Phase 2 RLS: public browse of snapshot/published listings; owner-only favourites.

ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE physical_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE favourites ENABLE ROW LEVEL SECURITY;

-- Reference catalogues: public read
CREATE POLICY property_types_public_read ON property_types
  FOR SELECT USING (true);
CREATE POLICY features_public_read ON features
  FOR SELECT USING (true);

-- Public can read browseable listings (legacy snapshots included with UI labelling)
CREATE POLICY property_listings_public_browse ON property_listings
  FOR SELECT
  USING (is_public_browseable = true);

CREATE POLICY listing_price_history_public_read ON listing_price_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM property_listings pl
      WHERE pl.id = listing_id AND pl.is_public_browseable = true
    )
  );

CREATE POLICY listing_status_history_public_read ON listing_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM property_listings pl
      WHERE pl.id = listing_id AND pl.is_public_browseable = true
    )
  );

CREATE POLICY property_features_public_read ON property_features
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM property_listings pl
      WHERE pl.id = listing_id AND pl.is_public_browseable = true
    )
  );

CREATE POLICY source_claims_public_read ON source_claims
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM property_listings pl
      WHERE pl.id = listing_id AND pl.is_public_browseable = true
    )
  );

CREATE POLICY property_provenance_public_read ON property_provenance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM property_listings pl
      WHERE pl.id = listing_id AND pl.is_public_browseable = true
    )
  );

CREATE POLICY listing_media_public_read ON listing_media
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM property_listings pl
      WHERE pl.id = listing_id AND pl.is_public_browseable = true
    )
  );

CREATE POLICY physical_properties_public_read ON physical_properties
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM property_listings pl
      WHERE pl.physical_property_id = id AND pl.is_public_browseable = true
    )
  );

CREATE POLICY property_addresses_public_read ON property_addresses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM property_listings pl
      WHERE pl.physical_property_id = physical_property_id
        AND pl.is_public_browseable = true
    )
  );

CREATE POLICY property_locations_public_read ON property_locations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM property_listings pl
      WHERE pl.physical_property_id = physical_property_id
        AND pl.is_public_browseable = true
    )
  );

CREATE POLICY data_sources_public_read ON data_sources
  FOR SELECT
  USING (true);

-- Favourites: owner only
CREATE POLICY favourites_owner_select ON favourites
  FOR SELECT
  USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

CREATE POLICY favourites_owner_insert ON favourites
  FOR INSERT
  WITH CHECK (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

CREATE POLICY favourites_owner_delete ON favourites
  FOR DELETE
  USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

-- Import runs/errors: no client policies (service role / server only) — deny by default
