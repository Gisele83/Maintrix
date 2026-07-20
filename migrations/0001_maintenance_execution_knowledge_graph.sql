CREATE TABLE "intervention_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"step_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"uploaded_by" integer,
	"tenant_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "intervention_executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_order_id" integer NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"equipment_id" integer NOT NULL,
	"current_step" varchar(30) DEFAULT 'reception' NOT NULL,
	"overall_status" varchar(20) DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "intervention_measurements" (
	"id" serial PRIMARY KEY NOT NULL,
	"step_id" integer NOT NULL,
	"measurement_type" varchar(50) NOT NULL,
	"value" real NOT NULL,
	"unit" varchar(20),
	"expected_min" real,
	"expected_max" real,
	"within_tolerance" boolean,
	"tenant_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "intervention_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"execution_id" integer NOT NULL,
	"step_type" varchar(30) NOT NULL,
	"sequence_order" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"technician_id" integer,
	"diagnostic_session_id" integer,
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration_minutes" integer,
	"notes" text,
	"structured_data" jsonb,
	"rejection_reason" text,
	"tenant_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kg_edges" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_node_id" integer NOT NULL,
	"to_node_id" integer NOT NULL,
	"relation_type" varchar(40) NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"last_reinforced_at" timestamp DEFAULT now(),
	"tenant_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kg_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"node_type" varchar(30) NOT NULL,
	"ref_table" varchar(50),
	"ref_id" varchar(50),
	"label" text NOT NULL,
	"metadata" jsonb,
	"tenant_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "intervention_attachments" ADD CONSTRAINT "intervention_attachments_step_id_intervention_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."intervention_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intervention_attachments" ADD CONSTRAINT "intervention_attachments_uploaded_by_user_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intervention_attachments" ADD CONSTRAINT "intervention_attachments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intervention_executions" ADD CONSTRAINT "intervention_executions_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intervention_executions" ADD CONSTRAINT "intervention_executions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intervention_executions" ADD CONSTRAINT "intervention_executions_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intervention_measurements" ADD CONSTRAINT "intervention_measurements_step_id_intervention_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."intervention_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intervention_measurements" ADD CONSTRAINT "intervention_measurements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intervention_steps" ADD CONSTRAINT "intervention_steps_execution_id_intervention_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."intervention_executions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intervention_steps" ADD CONSTRAINT "intervention_steps_technician_id_user_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intervention_steps" ADD CONSTRAINT "intervention_steps_diagnostic_session_id_diagnostic_sessions_id_fk" FOREIGN KEY ("diagnostic_session_id") REFERENCES "public"."diagnostic_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intervention_steps" ADD CONSTRAINT "intervention_steps_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kg_edges" ADD CONSTRAINT "kg_edges_from_node_id_kg_nodes_id_fk" FOREIGN KEY ("from_node_id") REFERENCES "public"."kg_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kg_edges" ADD CONSTRAINT "kg_edges_to_node_id_kg_nodes_id_fk" FOREIGN KEY ("to_node_id") REFERENCES "public"."kg_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kg_edges" ADD CONSTRAINT "kg_edges_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kg_nodes" ADD CONSTRAINT "kg_nodes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;