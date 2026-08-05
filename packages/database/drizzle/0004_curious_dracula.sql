CREATE TYPE "public"."import_run_mode" AS ENUM('dry_run', 'full', 'incremental');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"organization_id" uuid,
	"action" varchar(120) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" uuid NOT NULL,
	"format" "data_source_type" NOT NULL,
	"mapping" jsonb DEFAULT '{}'::jsonb,
	"schedule_cron" varchar(64),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_run_id" uuid NOT NULL,
	"data_source_id" uuid NOT NULL,
	"content_sha256" varchar(64) NOT NULL,
	"parser_version" varchar(32) NOT NULL,
	"byte_size" integer NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_permission_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"from_status" "source_permission_status",
	"to_status" "source_permission_status" NOT NULL,
	"from_image_rights" "image_rights",
	"to_image_rights" "image_rights",
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "data_sources" ADD COLUMN "permission_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "import_runs" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "import_runs" ADD COLUMN "feed_config_id" uuid;--> statement-breakpoint
ALTER TABLE "import_runs" ADD COLUMN "raw_snapshot_id" uuid;--> statement-breakpoint
ALTER TABLE "import_runs" ADD COLUMN "mode" "import_run_mode" DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "import_runs" ADD COLUMN "parser_version" varchar(32);--> statement-breakpoint
ALTER TABLE "import_runs" ADD COLUMN "actor_user_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_configs" ADD CONSTRAINT "feed_configs_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_snapshots" ADD CONSTRAINT "raw_snapshots_import_run_id_import_runs_id_fk" FOREIGN KEY ("import_run_id") REFERENCES "public"."import_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_snapshots" ADD CONSTRAINT "raw_snapshots_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_permission_events" ADD CONSTRAINT "source_permission_events_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_permission_events" ADD CONSTRAINT "source_permission_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_feed_config_id_feed_configs_id_fk" FOREIGN KEY ("feed_config_id") REFERENCES "public"."feed_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;