-- server/oee-routes.ts existait depuis longtemps avec un CRUD complet (SQL brut) mais interrogeait
-- une table "oee_records" qui n'a jamais été créée nulle part dans le projet — même situation que
-- rca_analyses/fmea_analyses/budget_plans avant elle. tenant_id présent dès la création.

CREATE TABLE "oee_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"equipment_id" integer NOT NULL,
	"equipment_name" text,
	"record_date" timestamp NOT NULL,
	"shift" varchar(20) NOT NULL DEFAULT 'day',
	"planned_time" numeric(10, 2) DEFAULT '480',
	"downtime" numeric(10, 2) DEFAULT '0',
	"speed_loss" numeric(10, 2) DEFAULT '0',
	"planned_production" integer DEFAULT 0,
	"actual_production" integer DEFAULT 0,
	"defective_units" integer DEFAULT 0,
	"availability" numeric(6, 4),
	"performance" numeric(6, 4),
	"quality" numeric(6, 4),
	"oee" numeric(6, 4),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "oee_records" ADD CONSTRAINT "oee_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oee_records" ADD CONSTRAINT "oee_records_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE CASCADE;
