-- server/calibration-routes.ts existait depuis longtemps avec un CRUD complet (SQL brut) mais
-- interrogeait une table "calibration_records" qui n'a jamais été créée nulle part dans le projet.
-- tenant_id présent dès la création.

CREATE TABLE "calibration_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"calibration_number" varchar(50) NOT NULL,
	"instrument_name" varchar(200) NOT NULL,
	"instrument_tag" varchar(100),
	"equipment_id" integer,
	"equipment_name" varchar(200),
	"instrument_type" varchar(100),
	"manufacturer" varchar(100),
	"model" varchar(100),
	"serial_number" varchar(100),
	"location" varchar(200),
	"calibration_date" timestamp NOT NULL,
	"next_calibration_date" timestamp NOT NULL,
	"calibration_interval_days" integer DEFAULT 365,
	"performed_by" varchar(200),
	"external_lab" varchar(200),
	"certificate_number" varchar(100),
	"standard_used" varchar(200),
	"method" varchar(200),
	"temperature_c" numeric(5, 2),
	"humidity_pct" numeric(5, 2),
	"result" varchar(20) DEFAULT 'pass',
	"tolerance_pct" numeric(6, 2),
	"as_found" jsonb DEFAULT '[]'::jsonb,
	"as_left" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"corrective_action" text,
	"out_of_service" boolean DEFAULT false,
	"status" varchar(20) DEFAULT 'compliant',
	"history" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "calibration_records_calibration_number_unique" UNIQUE("calibration_number")
);
--> statement-breakpoint
ALTER TABLE "calibration_records" ADD CONSTRAINT "calibration_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "calibration_records" ADD CONSTRAINT "calibration_records_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE SET NULL;
