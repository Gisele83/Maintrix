-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "equipment_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_en" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reported_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipment_type" text NOT NULL,
	"equipment_id" text,
	"zone" text,
	"contact" text,
	"description" text NOT NULL,
	"attempted_solutions" text,
	"impact" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attachments" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "maintenance_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipment_type" text NOT NULL,
	"equipment_id" text,
	"zone" text,
	"sector" text,
	"symptoms" text NOT NULL,
	"symptoms_checked" text[],
	"diagnosis" text NOT NULL,
	"solution" text NOT NULL,
	"duration" integer,
	"resolved" boolean DEFAULT true,
	"urgency" text NOT NULL,
	"confidence" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "repair_procedures" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" integer,
	"step_number" integer NOT NULL,
	"title" text NOT NULL,
	"title_en" text NOT NULL,
	"description" text NOT NULL,
	"description_en" text NOT NULL,
	"safety_warning" text,
	"safety_warning_en" text,
	"tools_required" text[],
	"tools_required_en" text[],
	"estimated_time" integer,
	"is_completed" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "diagnostic_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipment_type" text NOT NULL,
	"equipment_id" text,
	"zone" text,
	"sector" text,
	"symptoms" text NOT NULL,
	"symptoms_checked" text[],
	"urgency" text NOT NULL,
	"results" text,
	"selected_diagnosis" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"confidence" real,
	"ml_prediction" boolean DEFAULT false,
	"session_data" text,
	"user_id" integer
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"first_name" varchar(50),
	"last_name" varchar(50),
	"email" varchar(100),
	"role" varchar(30) DEFAULT 'technician',
	"department" varchar(50),
	"phone_number" varchar(20),
	"preferred_language" varchar(5) DEFAULT 'fr',
	"specializations" text[],
	"experience_level" varchar(20) DEFAULT 'intermediate',
	"is_active" boolean DEFAULT true,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"validation_level" integer DEFAULT 0,
	"can_validate_work_orders" boolean DEFAULT false,
	"can_validate_purchase_orders" boolean DEFAULT false,
	"max_purchase_amount" numeric(12, 2),
	"password" varchar(255),
	CONSTRAINT "user_profiles_username_unique" UNIQUE("username"),
	CONSTRAINT "user_profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "adaptive_learning" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipment_type" text NOT NULL,
	"symptom_keywords" jsonb,
	"common_failures" jsonb,
	"seasonal_patterns" jsonb,
	"zone_specific_issues" jsonb,
	"learning_weight" real DEFAULT 1,
	"confidence_adjustment" real DEFAULT 0,
	"last_update" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feedback_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer,
	"user_feedback" text,
	"feedback_comment" text,
	"actual_solution" text,
	"time_to_resolution" integer,
	"was_accurate" boolean,
	"difficulty_level" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "learning_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipment_type" text NOT NULL,
	"symptom_pattern" text NOT NULL,
	"success_rate" real DEFAULT 0.75,
	"avg_confidence" real DEFAULT 0.8,
	"total_cases" integer DEFAULT 0,
	"successful_cases" integer DEFAULT 0,
	"last_updated" timestamp DEFAULT now(),
	"improvement_suggestions" jsonb
);
--> statement-breakpoint
CREATE TABLE "model_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_type" text NOT NULL,
	"equipment_type" text NOT NULL,
	"accuracy" real DEFAULT 0,
	"precision" real DEFAULT 0,
	"recall" real DEFAULT 0,
	"f1_score" real DEFAULT 0,
	"training_date" timestamp DEFAULT now(),
	"sample_size" integer DEFAULT 0,
	"cv_score" real DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "predictive_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipment_id" integer,
	"analysis_type" varchar(50) NOT NULL,
	"prediction_date" timestamp DEFAULT now(),
	"remaining_useful_life" integer,
	"failure_probability" real,
	"anomaly_score" real,
	"confidence_level" real,
	"risk_level" varchar(20) DEFAULT 'low',
	"recommendations" jsonb,
	"model_version" varchar(50),
	"input_features" jsonb,
	"alert_generated" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"system_name" varchar(100) NOT NULL,
	"operation_type" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" integer,
	"status" varchar(30) NOT NULL,
	"message" text,
	"request_data" jsonb,
	"response_data" jsonb,
	"processed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "preventive_maintenance_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_name" text NOT NULL,
	"equipment_type" text NOT NULL,
	"equipment_ids" jsonb,
	"frequency" varchar(30) NOT NULL,
	"frequency_value" integer,
	"tasks" jsonb,
	"estimated_duration" integer,
	"required_skills" text[],
	"safety_requirements" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"last_executed" timestamp,
	"next_due" timestamp
);
--> statement-breakpoint
CREATE TABLE "spare_parts" (
	"id" serial PRIMARY KEY NOT NULL,
	"part_number" varchar(100) NOT NULL,
	"part_name" text NOT NULL,
	"description" text,
	"category" varchar(50),
	"manufacturer" varchar(100),
	"supplier" varchar(100),
	"unit_price" numeric(10, 2),
	"currency" varchar(5) DEFAULT 'EUR',
	"current_stock" integer DEFAULT 0,
	"min_stock" integer DEFAULT 0,
	"max_stock" integer DEFAULT 100,
	"reorder_point" integer DEFAULT 0,
	"lead_time" integer,
	"location" text,
	"compatible_equipment" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "spare_parts_part_number_unique" UNIQUE("part_number")
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"spare_part_id" integer,
	"movement_type" varchar(20) NOT NULL,
	"quantity" integer NOT NULL,
	"reference" text,
	"reason" text,
	"performed_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_code" varchar(50) NOT NULL,
	"company_name" varchar(200) NOT NULL,
	"supplier_type" varchar(50) NOT NULL,
	"contact_person" varchar(100),
	"email" varchar(150),
	"phone" varchar(50),
	"address" text,
	"city" varchar(100),
	"country" varchar(100),
	"rating" integer DEFAULT 0,
	"payment_terms" varchar(100),
	"delivery_time" integer,
	"certifications" jsonb,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "suppliers_supplier_code_unique" UNIQUE("supplier_code")
);
--> statement-breakpoint
CREATE TABLE "reorder_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"spare_part_id" integer,
	"reorder_point" integer NOT NULL,
	"reorder_quantity" integer NOT NULL,
	"max_stock" integer,
	"supplier_id" integer,
	"is_active" boolean DEFAULT true,
	"lead_time" integer,
	"last_triggered" timestamp,
	"auto_order" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_order_id" integer,
	"spare_part_id" integer,
	"part_number" varchar(100),
	"description" text,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2),
	"total_price" numeric(12, 2),
	"expected_delivery" timestamp,
	"received" boolean DEFAULT false,
	"received_quantity" integer DEFAULT 0,
	"received_date" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"equipment_id" integer,
	"order_type" varchar(30) NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"priority" varchar(20) DEFAULT 'medium',
	"status" varchar(30) DEFAULT 'pending',
	"assigned_to" integer,
	"requested_by" integer,
	"estimated_duration" integer,
	"actual_duration" integer,
	"scheduled_start" timestamp,
	"actual_start" timestamp,
	"scheduled_end" timestamp,
	"actual_end" timestamp,
	"cost" numeric(10, 2),
	"labor_cost" numeric(10, 2),
	"material_cost" numeric(10, 2),
	"external_cost" numeric(10, 2),
	"notes" text,
	"completion_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"validation_status" varchar(30) DEFAULT 'pending',
	"level1_validated_by" integer,
	"level1_validated_at" timestamp,
	"level1_validation_notes" text,
	"level2_validated_by" integer,
	"level2_validated_at" timestamp,
	"level2_validation_notes" text,
	"rejected_by" integer,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"can_execute" boolean DEFAULT false,
	CONSTRAINT "work_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "monthly_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_number" varchar(50) NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"generated_by" varchar(100),
	"generated_at" timestamp DEFAULT now(),
	"total_equipment" integer,
	"active_equipment" integer,
	"equipment_availability" numeric(5, 2),
	"total_work_orders" integer,
	"completed_work_orders" integer,
	"preventive_work_orders" integer,
	"corrective_work_orders" integer,
	"average_completion_time" numeric(8, 2),
	"mtbf" numeric(8, 2),
	"mttr" numeric(8, 2),
	"planned_maintenance_ratio" numeric(5, 2),
	"maintenance_efficiency" numeric(5, 2),
	"total_maintenance_cost" numeric(12, 2),
	"labor_cost" numeric(12, 2),
	"parts_cost" numeric(12, 2),
	"contractor_cost" numeric(12, 2),
	"cost_per_work_order" numeric(10, 2),
	"parts_consumed" integer,
	"inventory_turnover" numeric(5, 2),
	"stockouts" integer,
	"emergency_purchases" integer,
	"total_alerts" integer,
	"critical_alerts" integer,
	"safety_incidents" integer,
	"quality_issues" integer,
	"performance_score" numeric(5, 2),
	"improvement_areas" text[],
	"recommendations" text[],
	"statistics_data" jsonb,
	"charts_data" jsonb,
	"status" varchar(30) DEFAULT 'generated' NOT NULL,
	"reviewed_by" varchar(100),
	"review_date" timestamp,
	"notes" text,
	CONSTRAINT "monthly_reports_report_number_unique" UNIQUE("report_number")
);
--> statement-breakpoint
CREATE TABLE "report_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_name" varchar(100) NOT NULL,
	"template_type" varchar(50) NOT NULL,
	"description" text,
	"sections" jsonb,
	"kpi_metrics" text[],
	"chart_types" text[],
	"format" varchar(30) DEFAULT 'pdf',
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_by" varchar(100),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "validation_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"password" varchar(255) NOT NULL,
	"matricule" varchar(20) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"department" varchar(100) NOT NULL,
	"validation_level" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"can_validate_orders" boolean DEFAULT false,
	"can_validate_work_orders" boolean DEFAULT false,
	"email" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "validation_users_username_key" UNIQUE("username"),
	CONSTRAINT "validation_users_matricule_key" UNIQUE("matricule")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_sessions_session_token_key" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"supplier_id" integer,
	"order_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"requested_by" varchar(100),
	"approved_by" varchar(100),
	"total_amount" numeric(12, 2),
	"currency" varchar(10) DEFAULT 'EUR',
	"order_date" timestamp DEFAULT now(),
	"expected_delivery" timestamp,
	"actual_delivery" timestamp,
	"delivery_address" text,
	"notes" text,
	"terms" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"validation_status" varchar(30) DEFAULT 'pending',
	"level1_validated_by" integer,
	"level1_validated_at" timestamp,
	"level1_validation_notes" text,
	"level2_validated_by" integer,
	"level2_validated_at" timestamp,
	"level2_validation_notes" text,
	"level3_validated_by" integer,
	"level3_validated_at" timestamp,
	"level3_validation_notes" text,
	"rejected_by" integer,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"can_print" boolean DEFAULT false,
	"printed_by" integer,
	"printed_at" timestamp,
	"document_type" varchar(50) DEFAULT 'purchase_order',
	"chef_service_validated_by" varchar(255),
	"chef_service_validated_at" timestamp,
	"directeur_validated_by" varchar(255),
	"directeur_validated_at" timestamp,
	"validation_notes" text,
	"chef_service_rejection_reason" text,
	"directeur_rejection_reason" text,
	"documents_justificatifs" text[],
	CONSTRAINT "purchase_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "company_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"address" text,
	"phone" varchar(50),
	"email" varchar(255),
	"website" varchar(255),
	"tax_number" varchar(100),
	"logo_url" varchar(500),
	"logo_base64" text,
	"header_template" text,
	"footer_template" text,
	"primary_color" varchar(7) DEFAULT '#0066cc',
	"secondary_color" varchar(7) DEFAULT '#f8f9fa',
	"font_family" varchar(100) DEFAULT 'Arial, sans-serif',
	"letterhead_template" text,
	"document_footer" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"purchase_order_threshold" numeric(10, 2) DEFAULT '1500.00',
	"command_letter_threshold" numeric(10, 2) DEFAULT '1500.01'
);
--> statement-breakpoint
CREATE TABLE "validation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_type" varchar(30) NOT NULL,
	"record_id" integer NOT NULL,
	"validation_level" integer NOT NULL,
	"action" varchar(20) NOT NULL,
	"validated_by" integer,
	"validation_date" timestamp DEFAULT now(),
	"comments" text,
	"previous_status" varchar(30),
	"new_status" varchar(30),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "alerts_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"alert_type" varchar(50) NOT NULL,
	"equipment_id" integer,
	"severity" varchar(20) DEFAULT 'medium',
	"title" text NOT NULL,
	"message" text NOT NULL,
	"status" varchar(20) DEFAULT 'active',
	"assigned_to" integer,
	"trigger_value" numeric(15, 6),
	"threshold_value" numeric(15, 6),
	"acknowledged_by" integer,
	"acknowledged_at" timestamp,
	"resolved_by" integer,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "iot_sensor_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipment_id" integer,
	"sensor_type" varchar(50) NOT NULL,
	"sensor_id" varchar(100) NOT NULL,
	"value" numeric(15, 6) NOT NULL,
	"unit" varchar(20) NOT NULL,
	"timestamp" timestamp DEFAULT now(),
	"quality" varchar(20) DEFAULT 'good',
	"alarm_state" varchar(20) DEFAULT 'normal',
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "equipment_registry" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipment_id" varchar(100) NOT NULL,
	"equipment_name" text NOT NULL,
	"equipment_type" text NOT NULL,
	"manufacturer" varchar(100),
	"model" varchar(100),
	"serial_number" varchar(100),
	"location" text,
	"zone" varchar(50),
	"sector" varchar(50),
	"installation_date" timestamp,
	"warranty_expiry" timestamp,
	"criticality_level" varchar(20) DEFAULT 'medium',
	"operational_state" varchar(20) DEFAULT 'operational',
	"technical_specs" jsonb,
	"manuals" text[],
	"spare_parts" jsonb,
	"maintenance_schedule" jsonb,
	"iot_sensors" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "equipment_registry_equipment_id_unique" UNIQUE("equipment_id")
);
--> statement-breakpoint
CREATE TABLE "kpi_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipment_id" integer,
	"metric_type" varchar(50) NOT NULL,
	"metric_value" numeric(15, 6) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"calculation_date" timestamp DEFAULT now(),
	"context" jsonb
);
--> statement-breakpoint
CREATE TABLE "maintenance_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_number" varchar(50) NOT NULL,
	"work_order_id" integer,
	"equipment_id" integer,
	"report_type" varchar(50) NOT NULL,
	"intervention_type" varchar(50),
	"technician" varchar(100) NOT NULL,
	"supervisor" varchar(100),
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"actual_duration" integer,
	"planned_duration" integer,
	"work_description" text NOT NULL,
	"problem_diagnosis" text,
	"actions_taken" text NOT NULL,
	"parts_used" jsonb,
	"tools_used" text[],
	"safety_incidents" text,
	"quality_check" boolean DEFAULT false,
	"quality_notes" text,
	"follow_up_required" boolean DEFAULT false,
	"follow_up_date" timestamp,
	"follow_up_notes" text,
	"total_cost" numeric(10, 2),
	"labor_cost" numeric(10, 2),
	"parts_cost" numeric(10, 2),
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"approved_by" varchar(100),
	"approval_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "maintenance_reports_report_number_unique" UNIQUE("report_number")
);
--> statement-breakpoint
ALTER TABLE "repair_procedures" ADD CONSTRAINT "repair_procedures_case_id_maintenance_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."maintenance_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_sessions" ADD CONSTRAINT "feedback_sessions_session_id_diagnostic_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."diagnostic_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictive_analytics" ADD CONSTRAINT "predictive_analytics_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_spare_part_id_spare_parts_id_fk" FOREIGN KEY ("spare_part_id") REFERENCES "public"."spare_parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_performed_by_user_profiles_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_spare_part_id_spare_parts_id_fk" FOREIGN KEY ("spare_part_id") REFERENCES "public"."spare_parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_spare_part_id_spare_parts_id_fk" FOREIGN KEY ("spare_part_id") REFERENCES "public"."spare_parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_to_user_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_requested_by_user_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_level1_validated_by_user_profiles_id_fk" FOREIGN KEY ("level1_validated_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_level2_validated_by_user_profiles_id_fk" FOREIGN KEY ("level2_validated_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_rejected_by_user_profiles_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."validation_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_level1_validated_by_user_profiles_id_fk" FOREIGN KEY ("level1_validated_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_level2_validated_by_user_profiles_id_fk" FOREIGN KEY ("level2_validated_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_level3_validated_by_user_profiles_id_fk" FOREIGN KEY ("level3_validated_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_rejected_by_user_profiles_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_printed_by_user_profiles_id_fk" FOREIGN KEY ("printed_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_logs" ADD CONSTRAINT "validation_logs_validated_by_user_profiles_id_fk" FOREIGN KEY ("validated_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts_notifications" ADD CONSTRAINT "alerts_notifications_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts_notifications" ADD CONSTRAINT "alerts_notifications_assigned_to_user_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts_notifications" ADD CONSTRAINT "alerts_notifications_acknowledged_by_user_profiles_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts_notifications" ADD CONSTRAINT "alerts_notifications_resolved_by_user_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_sensor_data" ADD CONSTRAINT "iot_sensor_data_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_metrics" ADD CONSTRAINT "kpi_metrics_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_reports" ADD CONSTRAINT "maintenance_reports_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_reports" ADD CONSTRAINT "maintenance_reports_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;
*/