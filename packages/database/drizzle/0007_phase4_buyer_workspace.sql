-- Phase 4A: buyer workspace tables (shortlists, notes, comparison, preference profiles).
-- Favourites table is intentionally unchanged (ADR-030).

CREATE TABLE IF NOT EXISTS "shortlists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" varchar(80) NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shortlists_user_name_uidx" ON "shortlists" ("user_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shortlists_one_default_uidx" ON "shortlists" ("user_id") WHERE "is_default" = true;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "shortlist_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shortlist_id" uuid NOT NULL REFERENCES "shortlists"("id") ON DELETE cascade,
  "listing_id" uuid NOT NULL REFERENCES "property_listings"("id") ON DELETE cascade,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shortlist_items_shortlist_listing_uidx" ON "shortlist_items" ("shortlist_id","listing_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_items_shortlist_position_idx" ON "shortlist_items" ("shortlist_id","position");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "property_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "listing_id" uuid NOT NULL REFERENCES "property_listings"("id") ON DELETE cascade,
  "body" text DEFAULT '' NOT NULL,
  "positives" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "negatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "property_notes_user_listing_uidx" ON "property_notes" ("user_id","listing_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "shortlist_notes" (
  "shortlist_id" uuid PRIMARY KEY REFERENCES "shortlists"("id") ON DELETE cascade,
  "body" text DEFAULT '' NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_preference_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" varchar(80) DEFAULT 'Default' NOT NULL,
  "weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_active" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_preference_profiles_one_active_uidx" ON "user_preference_profiles" ("user_id") WHERE "is_active" = true;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "comparison_sets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "shortlist_id" uuid REFERENCES "shortlists"("id") ON DELETE set null,
  "weight_snapshot" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "comparison_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "comparison_set_id" uuid NOT NULL REFERENCES "comparison_sets"("id") ON DELETE cascade,
  "listing_id" uuid NOT NULL REFERENCES "property_listings"("id") ON DELETE cascade,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "comparison_items_set_listing_uidx" ON "comparison_items" ("comparison_set_id","listing_id");
