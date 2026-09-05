CREATE TABLE "equipment_lifecycle_transitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"equipment_id" integer NOT NULL,
	"from_stage" varchar(30) NOT NULL,
	"to_stage" varchar(30) NOT NULL,
	"reason" text,
	"triggered_by" integer,
	"related_work_order_id" integer,
	"transitioned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "equipment_registry" ADD COLUMN "lifecycle_stage" varchar(30) DEFAULT 'exploitation' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_registry" ADD COLUMN "lifecycle_stage_since" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "equipment_lifecycle_transitions" ADD CONSTRAINT "equipment_lifecycle_transitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_lifecycle_transitions" ADD CONSTRAINT "equipment_lifecycle_transitions_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_lifecycle_transitions" ADD CONSTRAINT "equipment_lifecycle_transitions_triggered_by_user_profiles_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_lifecycle_transitions" ADD CONSTRAINT "equipment_lifecycle_transitions_related_work_order_id_work_orders_id_fk" FOREIGN KEY ("related_work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;