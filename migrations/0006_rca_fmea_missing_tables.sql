CREATE TABLE "fmea_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"fmea_number" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"scope" text,
	"equipment_id" integer,
	"equipment_name" text,
	"process_step" text,
	"entries" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1,
	"reviewed_by_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "fmea_analyses_fmea_number_unique" UNIQUE("fmea_number")
);
--> statement-breakpoint
CREATE TABLE "rca_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"rca_number" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"methodology" varchar(20) DEFAULT '5_whys' NOT NULL,
	"severity" varchar(20) DEFAULT 'medium' NOT NULL,
	"failure_date" timestamp,
	"detection_date" timestamp,
	"equipment_id" integer,
	"work_order_id" integer,
	"failure_mode" text,
	"estimated_loss" numeric(12, 2),
	"currency" varchar(10) DEFAULT 'EUR',
	"why_chain" jsonb DEFAULT '[]'::jsonb,
	"fishbone" jsonb DEFAULT '{}'::jsonb,
	"contributing_factors" jsonb DEFAULT '[]'::jsonb,
	"action_plans" jsonb DEFAULT '[]'::jsonb,
	"immediate_cause" text,
	"root_cause" text,
	"lessons_learned" text,
	"preventive_measures" text,
	"recurrence_risk" text,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "rca_analyses_rca_number_unique" UNIQUE("rca_number")
);
--> statement-breakpoint
ALTER TABLE "fmea_analyses" ADD CONSTRAINT "fmea_analyses_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fmea_analyses" ADD CONSTRAINT "fmea_analyses_reviewed_by_id_user_profiles_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rca_analyses" ADD CONSTRAINT "rca_analyses_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rca_analyses" ADD CONSTRAINT "rca_analyses_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;