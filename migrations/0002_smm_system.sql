CREATE TABLE "smm_audits" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"audit_number" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"audit_type" varchar(20) DEFAULT 'interne' NOT NULL,
	"scope" text,
	"auditor_id" integer,
	"equipment_id" integer,
	"checklist_id" integer,
	"status" varchar(20) DEFAULT 'planned' NOT NULL,
	"score" real,
	"findings" jsonb DEFAULT '[]'::jsonb,
	"scheduled_date" timestamp,
	"completed_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "smm_audits_audit_number_unique" UNIQUE("audit_number")
);
--> statement-breakpoint
CREATE TABLE "smm_checklists" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"equipment_type" varchar(100),
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" varchar(20) DEFAULT '1.0' NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "smm_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"document_type" varchar(30) NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"version" varchar(20) DEFAULT '1.0' NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"equipment_type" varchar(100),
	"attachment_url" text,
	"created_by" integer,
	"approved_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "smm_improvement_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"non_conformity_id" integer,
	"title" text NOT NULL,
	"description" text,
	"action_type" varchar(20) DEFAULT 'corrective' NOT NULL,
	"responsible_id" integer,
	"due_date" timestamp,
	"status" varchar(20) DEFAULT 'a_faire' NOT NULL,
	"effectiveness_check" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "smm_non_conformities" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"nc_number" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" varchar(20) DEFAULT 'mineure' NOT NULL,
	"source" varchar(30) DEFAULT 'autre' NOT NULL,
	"source_audit_id" integer,
	"source_intervention_step_id" integer,
	"equipment_id" integer,
	"status" varchar(20) DEFAULT 'ouverte' NOT NULL,
	"detected_by" integer,
	"detected_at" timestamp DEFAULT now(),
	"root_cause" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "smm_non_conformities_nc_number_unique" UNIQUE("nc_number")
);
--> statement-breakpoint
ALTER TABLE "smm_audits" ADD CONSTRAINT "smm_audits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smm_audits" ADD CONSTRAINT "smm_audits_auditor_id_user_profiles_id_fk" FOREIGN KEY ("auditor_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smm_audits" ADD CONSTRAINT "smm_audits_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smm_audits" ADD CONSTRAINT "smm_audits_checklist_id_smm_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."smm_checklists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smm_checklists" ADD CONSTRAINT "smm_checklists_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smm_checklists" ADD CONSTRAINT "smm_checklists_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smm_documents" ADD CONSTRAINT "smm_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smm_documents" ADD CONSTRAINT "smm_documents_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smm_documents" ADD CONSTRAINT "smm_documents_approved_by_user_profiles_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smm_improvement_actions" ADD CONSTRAINT "smm_improvement_actions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smm_improvement_actions" ADD CONSTRAINT "smm_improvement_actions_non_conformity_id_smm_non_conformities_id_fk" FOREIGN KEY ("non_conformity_id") REFERENCES "public"."smm_non_conformities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smm_improvement_actions" ADD CONSTRAINT "smm_improvement_actions_responsible_id_user_profiles_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smm_non_conformities" ADD CONSTRAINT "smm_non_conformities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smm_non_conformities" ADD CONSTRAINT "smm_non_conformities_source_audit_id_smm_audits_id_fk" FOREIGN KEY ("source_audit_id") REFERENCES "public"."smm_audits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smm_non_conformities" ADD CONSTRAINT "smm_non_conformities_source_intervention_step_id_intervention_steps_id_fk" FOREIGN KEY ("source_intervention_step_id") REFERENCES "public"."intervention_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smm_non_conformities" ADD CONSTRAINT "smm_non_conformities_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smm_non_conformities" ADD CONSTRAINT "smm_non_conformities_detected_by_user_profiles_id_fk" FOREIGN KEY ("detected_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;