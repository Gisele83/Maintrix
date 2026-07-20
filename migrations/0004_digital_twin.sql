CREATE TABLE "digital_twins" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"equipment_id" integer NOT NULL,
	"calibration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_calibrated" boolean DEFAULT false NOT NULL,
	"last_result" jsonb,
	"last_remaining_useful_life" real,
	"last_computed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "digital_twins_equipment_id_unique" UNIQUE("equipment_id")
);
--> statement-breakpoint
ALTER TABLE "digital_twins" ADD CONSTRAINT "digital_twins_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_twins" ADD CONSTRAINT "digital_twins_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;