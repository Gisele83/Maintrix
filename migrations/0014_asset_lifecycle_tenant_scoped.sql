-- server/asset-lifecycle-routes.ts existait depuis longtemps avec un CRUD complet (SQL brut) mais
-- interrogeait une table "asset_lifecycle" qui n'a jamais été créée nulle part dans le projet.
-- Distinct de equipment_registry.lifecycle_stage (machine à états ISO 55000 déjà fonctionnelle) :
-- ce module trace la valeur financière (amortissement), le MTBF/MTTR par actif et le journal
-- d'événements (achat, mise en service, incidents...), pas seulement l'étape de cycle de vie.
-- tenant_id présent dès la création.

CREATE TABLE "asset_lifecycle" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"asset_tag" varchar(50) NOT NULL,
	"name" text NOT NULL,
	"category" varchar(100),
	"manufacturer" varchar(100),
	"model" varchar(100),
	"serial_number" varchar(100),
	"equipment_id" integer,
	"lifecycle_stage" varchar(30) NOT NULL DEFAULT 'operation',
	"purchase_date" timestamp,
	"commissioning_date" timestamp,
	"planned_replacement_date" timestamp,
	"actual_disposal_date" timestamp,
	"useful_life_years" numeric(6, 2),
	"purchase_cost" numeric(12, 2),
	"salvage_value" numeric(12, 2),
	"depreciation_method" varchar(30) DEFAULT 'linear',
	"location" varchar(200),
	"criticality" varchar(20) DEFAULT 'medium',
	"notes" text,
	"lifecycle_events" jsonb DEFAULT '[]'::jsonb,
	"documents" jsonb DEFAULT '[]'::jsonb,
	"condition_score" integer,
	"mtbf_hours" numeric(10, 2),
	"mttr_hours" numeric(10, 2),
	"failure_count" integer DEFAULT 0,
	"maintenance_count" integer DEFAULT 0,
	"total_maintenance_cost" numeric(12, 2) DEFAULT '0',
	"total_downtime_hours" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "asset_lifecycle_asset_tag_unique" UNIQUE("asset_tag")
);
--> statement-breakpoint
ALTER TABLE "asset_lifecycle" ADD CONSTRAINT "asset_lifecycle_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "asset_lifecycle" ADD CONSTRAINT "asset_lifecycle_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE SET NULL;
