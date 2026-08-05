CREATE TYPE "public"."freshness_method" AS ENUM('legacy_snapshot', 'partner_feed', 'manual', 'authorized_crawl', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."image_rights" AS ENUM('none', 'hotlink_only', 'display', 'download_and_transform');--> statement-breakpoint
CREATE TYPE "public"."import_run_status" AS ENUM('running', 'completed', 'completed_with_errors', 'failed');--> statement-breakpoint
CREATE TYPE "public"."listing_operational_status" AS ENUM('draft', 'pending_review', 'published', 'available', 'reserved', 'under_offer', 'sold', 'temporarily_unverified', 'stale', 'withdrawn', 'rejected', 'legacy_snapshot');--> statement-breakpoint
CREATE TYPE "public"."source_permission_status" AS ENUM('pending', 'approved', 'restricted', 'suspended', 'expired');--> statement-breakpoint
CREATE TYPE "public"."data_source_type" AS ENUM('api', 'webhook', 'xml', 'json', 'csv', 'manual', 'authorized_crawl', 'legacy_snapshot');--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_key" varchar(120) NOT NULL,
	"name" varchar(200) NOT NULL,
	"source_type" "data_source_type" NOT NULL,
	"permission_status" "source_permission_status" NOT NULL,
	"image_rights" "image_rights" DEFAULT 'none' NOT NULL,
	"organization_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_sources_source_key_unique" UNIQUE("source_key")
);
--> statement-breakpoint
CREATE TABLE "favourites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"label_en" varchar(120) NOT NULL,
	"category" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "features_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "import_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_run_id" uuid NOT NULL,
	"external_listing_id" varchar(120),
	"record_index" integer,
	"code" varchar(64) NOT NULL,
	"message" text NOT NULL,
	"raw_record" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" uuid NOT NULL,
	"status" "import_run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"total_records" integer DEFAULT 0 NOT NULL,
	"inserted_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"report" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"media_asset_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_placeholder" boolean DEFAULT true NOT NULL,
	"caption" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"price_amount" numeric(14, 2) NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" varchar(64) DEFAULT 'import' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"status" "listing_operational_status" NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "physical_properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_type_id" uuid,
	"bedrooms" integer,
	"bathrooms" integer,
	"built_area_sqm" numeric(12, 2),
	"usable_area_sqm" numeric(12, 2),
	"confidence" varchar(32) DEFAULT 'provisional' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"physical_property_id" uuid NOT NULL,
	"free_text" text,
	"street" varchar(200),
	"locality" varchar(120),
	"postal_code" varchar(16),
	"country_code" varchar(2) DEFAULT 'ES',
	"accuracy" varchar(32) DEFAULT 'approximate' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"feature_id" uuid NOT NULL,
	"value_text" varchar(200),
	"provenance" varchar(64) DEFAULT 'source_claim' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" uuid NOT NULL,
	"external_listing_id" varchar(120) NOT NULL,
	"physical_property_id" uuid,
	"organization_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"source_url" text,
	"portal_name" varchar(120),
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"price_amount" numeric(14, 2),
	"bedrooms" integer,
	"bathrooms" integer,
	"built_area_sqm" numeric(12, 2),
	"price_per_sqm" numeric(14, 2),
	"property_type_raw" varchar(120),
	"property_type_key" varchar(64),
	"environment_type" varchar(64),
	"area_label" varchar(120),
	"address_text" text,
	"nearest_transit" text,
	"commute_min" integer,
	"beach_proximity" varchar(200),
	"park_proximity" varchar(200),
	"operational_status" "listing_operational_status" DEFAULT 'legacy_snapshot' NOT NULL,
	"freshness_method" "freshness_method" DEFAULT 'legacy_snapshot' NOT NULL,
	"is_legacy_snapshot" boolean DEFAULT false NOT NULL,
	"is_public_browseable" boolean DEFAULT false NOT NULL,
	"source_created_at" timestamp with time zone,
	"source_updated_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"last_content_change_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"last_confirmed_available_at" timestamp with time zone,
	"imported_at" timestamp with time zone,
	"search_document" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"physical_property_id" uuid NOT NULL,
	"municipality_id" uuid,
	"neighborhood_id" uuid,
	"area_label" varchar(120),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"accuracy" varchar(32) DEFAULT 'unknown' NOT NULL,
	"display_policy" varchar(32) DEFAULT 'approximate' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"data_source_id" uuid NOT NULL,
	"external_listing_id" varchar(120) NOT NULL,
	"source_url" text,
	"import_method" "freshness_method" NOT NULL,
	"imported_at" timestamp with time zone NOT NULL,
	"raw_snapshot" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_provenance_listing_id_unique" UNIQUE("listing_id")
);
--> statement-breakpoint
CREATE TABLE "property_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"label_en" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_types_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "source_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"field_name" varchar(120) NOT NULL,
	"raw_value" text,
	"normalized_value" text,
	"claim_source" varchar(64) DEFAULT 'legacy_json' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_listing_id_property_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."property_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_errors" ADD CONSTRAINT "import_errors_import_run_id_import_runs_id_fk" FOREIGN KEY ("import_run_id") REFERENCES "public"."import_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_listing_id_property_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."property_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_price_history" ADD CONSTRAINT "listing_price_history_listing_id_property_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."property_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_status_history" ADD CONSTRAINT "listing_status_history_listing_id_property_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."property_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physical_properties" ADD CONSTRAINT "physical_properties_property_type_id_property_types_id_fk" FOREIGN KEY ("property_type_id") REFERENCES "public"."property_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_addresses" ADD CONSTRAINT "property_addresses_physical_property_id_physical_properties_id_fk" FOREIGN KEY ("physical_property_id") REFERENCES "public"."physical_properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_features" ADD CONSTRAINT "property_features_listing_id_property_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."property_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_features" ADD CONSTRAINT "property_features_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_listings" ADD CONSTRAINT "property_listings_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_listings" ADD CONSTRAINT "property_listings_physical_property_id_physical_properties_id_fk" FOREIGN KEY ("physical_property_id") REFERENCES "public"."physical_properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_listings" ADD CONSTRAINT "property_listings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_locations" ADD CONSTRAINT "property_locations_physical_property_id_physical_properties_id_fk" FOREIGN KEY ("physical_property_id") REFERENCES "public"."physical_properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_locations" ADD CONSTRAINT "property_locations_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_locations" ADD CONSTRAINT "property_locations_neighborhood_id_neighborhoods_id_fk" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."neighborhoods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_provenance" ADD CONSTRAINT "property_provenance_listing_id_property_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."property_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_provenance" ADD CONSTRAINT "property_provenance_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_claims" ADD CONSTRAINT "source_claims_listing_id_property_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."property_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "favourites_user_listing_uidx" ON "favourites" USING btree ("user_id","listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_features_listing_feature_uidx" ON "property_features" USING btree ("listing_id","feature_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_listings_source_external_uidx" ON "property_listings" USING btree ("data_source_id","external_listing_id");