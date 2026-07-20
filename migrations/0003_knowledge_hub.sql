CREATE TABLE "knowledge_hub_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"document_type" varchar(30) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"content" text,
	"tags" text[],
	"equipment_type" varchar(100),
	"file_url" text,
	"file_type" varchar(100),
	"embedding" jsonb,
	"uploaded_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "knowledge_hub_documents" ADD CONSTRAINT "knowledge_hub_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_hub_documents" ADD CONSTRAINT "knowledge_hub_documents_uploaded_by_user_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;