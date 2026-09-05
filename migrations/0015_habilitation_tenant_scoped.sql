-- server/habilitation-routes.ts existait depuis longtemps avec un CRUD complet (SQL brut) mais
-- interrogeait une table "technician_habilitations" qui n'a jamais été créée nulle part dans le
-- projet. tenant_id présent dès la création.

CREATE TABLE "technician_habilitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"habilitation_number" varchar(50) NOT NULL,
	"technician_name" varchar(200) NOT NULL,
	"technician_id" integer,
	"technician_email" varchar(150),
	"department" varchar(100),
	"habilitation_type" varchar(100) NOT NULL,
	"category" varchar(100),
	"level" varchar(50),
	"title" text NOT NULL,
	"issuing_body" varchar(200),
	"certificate_number" varchar(100),
	"issue_date" timestamp NOT NULL,
	"expiry_date" timestamp,
	"is_permanent" boolean DEFAULT false,
	"status" varchar(20) DEFAULT 'valid',
	"renewal_alert_days" integer DEFAULT 60,
	"training_duration_hours" numeric(6, 2),
	"training_location" varchar(200),
	"assessor" varchar(200),
	"scope" text,
	"restrictions" text,
	"renewal_history" jsonb DEFAULT '[]'::jsonb,
	"documents" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "technician_habilitations_habilitation_number_unique" UNIQUE("habilitation_number")
);
--> statement-breakpoint
ALTER TABLE "technician_habilitations" ADD CONSTRAINT "technician_habilitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "technician_habilitations" ADD CONSTRAINT "technician_habilitations_technician_id_user_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;
