-- server/warranty-routes.ts existait depuis longtemps avec un CRUD complet (SQL brut) mais
-- interrogeait une table "warranties" qui n'a jamais été créée nulle part dans le projet.
-- tenant_id présent dès la création.

CREATE TABLE "warranties" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"warranty_number" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"equipment_id" integer,
	"equipment_name" varchar(200),
	"asset_id" integer,
	"supplier_id" integer,
	"supplier_name" varchar(200),
	"warranty_type" varchar(30) DEFAULT 'manufacturer',
	"status" varchar(20) DEFAULT 'active',
	"purchase_date" timestamp,
	"installation_date" timestamp,
	"warranty_start" timestamp NOT NULL,
	"warranty_end" timestamp NOT NULL,
	"extended_warranty_end" timestamp,
	"coverage_description" text,
	"exclusions" text,
	"max_coverage_amount" numeric(12, 2),
	"deductible" numeric(12, 2) DEFAULT '0',
	"contact_name" varchar(200),
	"contact_email" varchar(150),
	"contact_phone" varchar(50),
	"contract_number" varchar(100),
	"alert_days_before" integer DEFAULT 60,
	"notes" text,
	"claims" jsonb DEFAULT '[]'::jsonb,
	"documents" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "warranties_warranty_number_unique" UNIQUE("warranty_number")
);
--> statement-breakpoint
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_asset_id_asset_lifecycle_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset_lifecycle"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;
