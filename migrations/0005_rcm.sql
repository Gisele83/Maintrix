CREATE TABLE "rcm_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"equipment_id" integer,
	"function_description" text NOT NULL,
	"functional_failure" text NOT NULL,
	"failure_mode" text NOT NULL,
	"failure_effect" text,
	"evident" boolean NOT NULL,
	"safety_or_environmental" boolean DEFAULT false NOT NULL,
	"operational_impact" boolean DEFAULT false NOT NULL,
	"condition_monitoring_possible" boolean DEFAULT false NOT NULL,
	"consequence_category" varchar(30),
	"recommended_task_type" varchar(30),
	"reasoning" text,
	"task_description" text,
	"interval_suggestion" varchar(100),
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "rcm_analyses" ADD CONSTRAINT "rcm_analyses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rcm_analyses" ADD CONSTRAINT "rcm_analyses_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rcm_analyses" ADD CONSTRAINT "rcm_analyses_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;