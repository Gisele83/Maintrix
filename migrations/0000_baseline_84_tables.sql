CREATE TABLE "access_logs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"user_id" integer,
	"action" varchar(200) NOT NULL,
	"resource" varchar(200) NOT NULL,
	"result" varchar(20) NOT NULL,
	"reason" text,
	"risk_score" integer DEFAULT 0,
	"trust_score" integer DEFAULT 50,
	"ip_address" varchar(45),
	"user_agent" text,
	"device_fingerprint" varchar(32),
	"location" varchar(100),
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "access_reviews" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"user_id" integer,
	"reviewer_id" integer,
	"status" varchar(20) DEFAULT 'pending',
	"findings" jsonb,
	"recommendations" jsonb,
	"actions" jsonb,
	"review_date" timestamp DEFAULT now(),
	"due_date" timestamp,
	"completed_date" timestamp
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
CREATE TABLE "ai_models" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"model_name" varchar(100) NOT NULL,
	"model_type" varchar(50) NOT NULL,
	"algorithm_type" varchar(50) NOT NULL,
	"equipment_category" varchar(100),
	"train_data_source" jsonb NOT NULL,
	"model_parameters" jsonb DEFAULT '{}'::jsonb,
	"feature_set" jsonb DEFAULT '[]'::jsonb,
	"accuracy" real,
	"precision" real,
	"recall" real,
	"f1_score" real,
	"last_training_date" timestamp,
	"training_duration" integer,
	"is_active" boolean DEFAULT true,
	"version" varchar(20) DEFAULT '1.0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_training_jobs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"model_id" varchar(36),
	"job_type" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"data_size" integer,
	"hyper_parameters" jsonb,
	"metrics" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"resource_usage" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alerts_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
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
CREATE TABLE "allowed_domains" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"domain" varchar(100) NOT NULL,
	"is_verified" boolean DEFAULT false,
	"verification_token" varchar(64),
	"verified_at" timestamp,
	"auto_provision" boolean DEFAULT false,
	"default_role" varchar(30) DEFAULT 'viewer',
	"created_at" timestamp DEFAULT now(),
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "arbitration_weights_state" (
	"tenant_id" varchar(36) PRIMARY KEY NOT NULL,
	"risk_weight" real DEFAULT 0.4 NOT NULL,
	"cost_weight" real DEFAULT 0.35 NOT NULL,
	"availability_weight" real DEFAULT 0.25 NOT NULL,
	"economic_impact_weights" jsonb DEFAULT '{"directCost":0.16666666666666666,"downtimeCost":0.16666666666666666,"safetyCost":0.16666666666666666,"environmentalCost":0.16666666666666666,"productionLossCost":0.16666666666666666,"qualityCost":0.16666666666666666}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"user_id" integer,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" varchar(100),
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"session_id" varchar(100),
	"timestamp" timestamp DEFAULT now(),
	"success" boolean DEFAULT true,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "audit_reports" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"summary" text,
	"findings" jsonb,
	"recommendations" jsonb,
	"severity" varchar(20) DEFAULT 'low',
	"status" varchar(20) DEFAULT 'draft',
	"generated_at" timestamp DEFAULT now(),
	"generated_by" integer
);
--> statement-breakpoint
CREATE TABLE "audit_trail" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"user_id" integer,
	"action" varchar(100) NOT NULL,
	"resource" varchar(100) NOT NULL,
	"resource_id" varchar(100),
	"details" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"timestamp" timestamp DEFAULT now(),
	"severity" varchar(20) DEFAULT 'info'
);
--> statement-breakpoint
CREATE TABLE "automated_symptom_detection" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipment_id" integer,
	"device_id" integer,
	"detected_symptom" text NOT NULL,
	"symptom_code" text NOT NULL,
	"confidence" real NOT NULL,
	"sensor_data" jsonb,
	"detection_algorithm" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"triggered_at" timestamp DEFAULT now(),
	"verified_by" integer,
	"verified_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "communication_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"platform" varchar(50) NOT NULL,
	"webhook_url" text,
	"bot_token" text,
	"channel_id" varchar(255),
	"chat_id" varchar(255),
	"is_enabled" boolean DEFAULT true,
	"severity_filter" jsonb DEFAULT '["critical","warning"]'::jsonb,
	"event_filter" jsonb DEFAULT '["threshold_breach","predictive_alert","maintenance_due","work_order_update"]'::jsonb,
	"tenant_id" varchar(36),
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "companies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"industry" varchar(100),
	"country" varchar(100),
	"subscription_plan" varchar(50) DEFAULT 'starter',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"purchase_order_threshold" numeric(10, 2) DEFAULT '1500.00',
	"command_letter_threshold" numeric(10, 2) DEFAULT '1500.01',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_reports" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"framework" varchar(20) NOT NULL,
	"report_period" jsonb NOT NULL,
	"sections" jsonb NOT NULL,
	"overall_score" integer,
	"status" varchar(20) NOT NULL,
	"generated_at" timestamp DEFAULT now(),
	"generated_by" integer
);
--> statement-breakpoint
CREATE TABLE "counter_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
	"counter_id" integer,
	"previous_value" integer NOT NULL,
	"reset_reason" text NOT NULL,
	"performed_by" integer,
	"work_order_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crypto_journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"sequence_number" integer NOT NULL,
	"domain" varchar(50) NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" varchar(100) NOT NULL,
	"actor_id" integer,
	"actor_name" varchar(255) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"previous_hash" varchar(64) NOT NULL,
	"entry_hash" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crypto_journal_entries_sequence_number_unique" UNIQUE("sequence_number"),
	CONSTRAINT "crypto_journal_entries_entry_hash_unique" UNIQUE("entry_hash")
);
--> statement-breakpoint
CREATE TABLE "data_access_permissions" (
	"id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "data_access_permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer,
	"company_id" integer,
	"permission" varchar(100) NOT NULL,
	"metadata" jsonb,
	"accessed_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "data_integration_logs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"source_system" varchar(100) NOT NULL,
	"operation_type" varchar(50) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar(100),
	"record_count" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"error_count" integer DEFAULT 0,
	"status" varchar(20) NOT NULL,
	"error_details" jsonb,
	"execution_time" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_retention" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"resource_type" varchar(100) NOT NULL,
	"resource_id" varchar(100) NOT NULL,
	"retention_policy" varchar(50) NOT NULL,
	"retention_period" integer NOT NULL,
	"scheduled_deletion" timestamp,
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp,
	"gdpr_request_id" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "diagnostic_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
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
CREATE TABLE "equipment_dependency_overrides" (
	"equipment_id" integer PRIMARY KEY NOT NULL,
	"nodes" jsonb NOT NULL,
	"edges" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equipment_dependency_templates" (
	"equipment_type" varchar(100) PRIMARY KEY NOT NULL,
	"nodes" jsonb NOT NULL,
	"edges" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equipment_registry" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
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
CREATE TABLE "equipment_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
	"name" text NOT NULL,
	"name_en" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_systems" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"system_name" varchar(100) NOT NULL,
	"system_type" varchar(50) NOT NULL,
	"connection_url" varchar(500) NOT NULL,
	"auth_method" varchar(50) NOT NULL,
	"credentials" jsonb NOT NULL,
	"sync_interval" integer DEFAULT 300,
	"last_sync_at" timestamp,
	"is_active" boolean DEFAULT true,
	"config_params" jsonb DEFAULT '{}'::jsonb,
	"mapping_rules" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "failure_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
	"equipment_type" text NOT NULL,
	"symptom_signature" text NOT NULL,
	"diagnosis" text NOT NULL,
	"solution" text NOT NULL,
	"root_cause" text,
	"confirmed_count" integer DEFAULT 0,
	"invalidated_count" integer DEFAULT 0,
	"avg_resolution_time" integer,
	"last_confirmed_at" timestamp,
	"last_invalidated_at" timestamp,
	"confidence_score" real DEFAULT 0.5,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "failure_trends" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
	"equipment_type" text NOT NULL,
	"failure_code" text NOT NULL,
	"occurrences" integer DEFAULT 1,
	"first_occurrence_at" timestamp DEFAULT now(),
	"last_occurrence_at" timestamp DEFAULT now(),
	"avg_time_between_failures" integer,
	"trend_direction" text DEFAULT 'stable',
	"affected_zones" text[],
	"seasonal_pattern" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "federated_learning" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"pattern_hash" varchar(64) NOT NULL,
	"equipment_category" varchar(100) NOT NULL,
	"problem_pattern" jsonb NOT NULL,
	"solution_effectiveness" real,
	"anonymized_metrics" jsonb,
	"contribution_weight" real DEFAULT 1,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "federated_sync_state" (
	"tenant_id" varchar(36) PRIMARY KEY NOT NULL,
	"last_sent_vector" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "gdpr_requests" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"request_type" varchar(50) NOT NULL,
	"subject_email" varchar(255) NOT NULL,
	"subject_user_id" integer,
	"status" varchar(50) DEFAULT 'pending',
	"request_data" jsonb,
	"response_data" jsonb,
	"processed_by" integer,
	"request_date" timestamp DEFAULT now(),
	"processed_date" timestamp,
	"completion_date" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "integration_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
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
CREATE TABLE "invitations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(30) DEFAULT 'technician' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"invited_by" integer,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"is_revoked" boolean DEFAULT false,
	"revoked_at" timestamp,
	"revoked_by" integer,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "iot_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"equipment_id" integer,
	"device_type" text NOT NULL,
	"location" text NOT NULL,
	"battery_level" real,
	"signal_strength" real,
	"status" text DEFAULT 'active' NOT NULL,
	"installation_date" timestamp DEFAULT now(),
	"last_heartbeat" timestamp,
	"calibration_date" timestamp,
	"metadata" jsonb,
	CONSTRAINT "iot_devices_device_id_unique" UNIQUE("device_id")
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
CREATE TABLE "kpi_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
	"equipment_id" integer,
	"metric_type" varchar(50) NOT NULL,
	"metric_value" numeric(15, 6) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"calculation_date" timestamp DEFAULT now(),
	"context" jsonb
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
CREATE TABLE "license_history" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"previous_license_type" varchar(50),
	"new_license_type" varchar(50) NOT NULL,
	"user_count_at_change" integer NOT NULL,
	"reason" varchar(100) NOT NULL,
	"changed_by" integer,
	"automatic_update" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "license_types" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"min_users" integer NOT NULL,
	"max_users" integer,
	"monthly_price" numeric(10, 2),
	"yearly_price" numeric(10, 2),
	"features" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "license_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "maintenance_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"achievement_name" text NOT NULL,
	"description" text NOT NULL,
	"icon_url" text,
	"category" text NOT NULL,
	"points_awarded" integer DEFAULT 0,
	"requirements" jsonb,
	"rarity" text DEFAULT 'common' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
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
CREATE TABLE "maintenance_counters" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
	"equipment_id" integer,
	"equipment_name" text,
	"counter_type" varchar(50) NOT NULL,
	"current_value" real DEFAULT 0,
	"threshold_value" real,
	"last_reset_date" timestamp,
	"last_reset_value" real DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"maintenance_type" text,
	"description" text,
	"increment_rate" real,
	"alert_level" varchar(20) DEFAULT 'info',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"plan_id" integer,
	"interval_value" real,
	"warning_threshold_pct" real,
	"last_service_value" real,
	"alert_email_sent" boolean DEFAULT false
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
CREATE TABLE "maintenance_skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"skill_name" text NOT NULL,
	"skill_category" text NOT NULL,
	"description" text NOT NULL,
	"max_level" integer DEFAULT 10,
	"experience_multiplier" real DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "mobile_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"tenant_id" varchar(36),
	"type" varchar(50) NOT NULL,
	"severity" varchar(20) DEFAULT 'medium',
	"title" text NOT NULL,
	"body" text NOT NULL,
	"related_entity_type" varchar(50),
	"related_entity_id" integer,
	"action_url" text,
	"is_read" boolean DEFAULT false,
	"is_dismissed" boolean DEFAULT false,
	"push_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"read_at" timestamp
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
CREATE TABLE "module_catalog" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100) NOT NULL,
	"version" varchar(50) DEFAULT '1.0.0',
	"dependencies" jsonb DEFAULT '[]'::jsonb,
	"default_enabled" boolean DEFAULT false,
	"is_core" boolean DEFAULT false,
	"route_paths" jsonb DEFAULT '[]'::jsonb,
	"api_endpoints" jsonb DEFAULT '[]'::jsonb,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"configuration" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "module_catalog_key_unique" UNIQUE("key")
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
CREATE TABLE "notification_delivery_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" integer,
	"platform" varchar(50) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"title" varchar(500) NOT NULL,
	"message" text,
	"status" varchar(20) DEFAULT 'pending',
	"error_message" text,
	"response_code" integer,
	"sent_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permit_to_work" (
	"id" serial PRIMARY KEY NOT NULL,
	"permit_number" varchar(50) NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"risk_level" varchar(20) DEFAULT 'medium' NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"location" varchar(255),
	"equipment_id" integer,
	"work_order_id" integer,
	"tenant_id" varchar(36),
	"requested_by_id" integer,
	"approved_by_id" integer,
	"issued_by_id" integer,
	"closed_by_id" integer,
	"planned_start" timestamp,
	"planned_end" timestamp,
	"actual_start" timestamp,
	"actual_end" timestamp,
	"approved_at" timestamp,
	"hazards" jsonb DEFAULT '[]'::jsonb,
	"precautions" jsonb DEFAULT '[]'::jsonb,
	"safety_equipment" jsonb DEFAULT '[]'::jsonb,
	"isolation_points" jsonb DEFAULT '[]'::jsonb,
	"authorized_personnel" jsonb DEFAULT '[]'::jsonb,
	"checklist_items" jsonb DEFAULT '[]'::jsonb,
	"permit_conditions" text,
	"rejection_reason" text,
	"completion_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "permit_to_work_permit_number_unique" UNIQUE("permit_number")
);
--> statement-breakpoint
CREATE TABLE "power_bi_datasets" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar(36),
	"dataset_name" varchar(100) NOT NULL,
	"dataset_id" varchar(100) NOT NULL,
	"description" text,
	"data_source" varchar(100) NOT NULL,
	"tables" jsonb DEFAULT '[]'::jsonb,
	"refresh_mode" varchar(20) DEFAULT 'scheduled',
	"refresh_schedule" jsonb,
	"last_refreshed" timestamp,
	"next_refresh" timestamp,
	"row_count" integer,
	"size_mb" real,
	"status" varchar(20) DEFAULT 'active',
	"error_details" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "power_bi_reports" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar(36),
	"report_name" varchar(100) NOT NULL,
	"report_id" varchar(100) NOT NULL,
	"report_url" varchar(500),
	"embed_url" varchar(500),
	"dataset_id" varchar(100),
	"report_type" varchar(50),
	"description" text,
	"refresh_schedule" jsonb,
	"last_refreshed" timestamp,
	"is_public" boolean DEFAULT false,
	"permissions" jsonb,
	"custom_parameters" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "power_bi_workspaces" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"workspace_name" varchar(100) NOT NULL,
	"workspace_id" varchar(100) NOT NULL,
	"description" text,
	"power_bi_app_id" varchar(100),
	"tenant_domain" varchar(100),
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"sync_status" varchar(20) DEFAULT 'pending',
	"error_details" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "power_bi_workspaces_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "predictive_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
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
CREATE TABLE "predictive_predictions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"equipment_id" integer,
	"model_id" varchar(36),
	"prediction_type" varchar(50) NOT NULL,
	"predicted_value" real,
	"predicted_category" varchar(100),
	"confidence_score" real,
	"prediction_horizon" integer,
	"input_features" jsonb,
	"risk_level" varchar(20),
	"recommended_actions" jsonb,
	"explanation_factors" jsonb,
	"valid_until" timestamp,
	"actual_outcome" varchar(100),
	"outcome_date" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "preventive_maintenance_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
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
CREATE TABLE "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"supplier_id" integer,
	"order_type" varchar(50) NOT NULL,
	"document_type" varchar(50) DEFAULT 'purchase_order' NOT NULL,
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
	"validation_status" varchar(30) DEFAULT 'pending',
	"chef_service_validated_by" integer,
	"chef_service_validated_at" timestamp,
	"chef_service_rejection_reason" text,
	"directeur_validated_by" integer,
	"directeur_validated_at" timestamp,
	"directeur_rejection_reason" text,
	"documents_justificatifs" jsonb,
	"rejected_by" integer,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"can_print" boolean DEFAULT false,
	"printed_by" integer,
	"printed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "purchase_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"tenant_id" varchar(36),
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"device_name" varchar(200),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"last_used_at" timestamp DEFAULT now(),
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(100) NOT NULL,
	"identifier_type" varchar(20) NOT NULL,
	"endpoint" varchar(100) NOT NULL,
	"request_count" integer DEFAULT 0,
	"window_start" timestamp DEFAULT now(),
	"is_blocked" boolean DEFAULT false,
	"block_expires_at" timestamp,
	"last_request_at" timestamp DEFAULT now()
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
CREATE TABLE "repair_procedures" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
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
CREATE TABLE "reported_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
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
CREATE TABLE "reporting_schedules" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"report_type" varchar(50) NOT NULL,
	"recipient_emails" jsonb DEFAULT '[]'::jsonb,
	"report_formats" jsonb DEFAULT '["pdf"]'::jsonb,
	"include_charts" boolean DEFAULT true,
	"include_kpis" boolean DEFAULT true,
	"include_predictive_insights" boolean DEFAULT false,
	"custom_queries" jsonb,
	"schedule" jsonb NOT NULL,
	"timezone" varchar(50) DEFAULT 'UTC',
	"is_active" boolean DEFAULT true,
	"last_executed" timestamp,
	"next_execution" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scada_connections" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"connection_name" varchar(100) NOT NULL,
	"protocol" varchar(20) NOT NULL,
	"endpoint" varchar(500) NOT NULL,
	"plc_addresses" jsonb DEFAULT '[]'::jsonb,
	"tag_mappings" jsonb DEFAULT '{}'::jsonb,
	"poll_interval" integer DEFAULT 5000,
	"is_connected" boolean DEFAULT false,
	"last_heartbeat" timestamp,
	"error_count" integer DEFAULT 0,
	"configuration" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sector_templates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"enabled_modules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_workflows" jsonb DEFAULT '{}'::jsonb,
	"default_settings" jsonb DEFAULT '{}'::jsonb,
	"kpi_config" jsonb DEFAULT '{}'::jsonb,
	"role_presets" jsonb DEFAULT '[]'::jsonb,
	"document_templates" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sector_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "security_policies" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36),
	"name" varchar(200) NOT NULL,
	"description" text,
	"rules" jsonb NOT NULL,
	"enforcement" varchar(20) DEFAULT 'moderate',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sensor_thresholds" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer,
	"metric_type" text NOT NULL,
	"warning_level" real NOT NULL,
	"critical_level" real NOT NULL,
	"unit" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "skill_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_name" text NOT NULL,
	"description" text NOT NULL,
	"skill_id" integer,
	"difficulty_level" integer NOT NULL,
	"experience_reward" integer DEFAULT 50,
	"requirements" jsonb,
	"time_limit" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "smart_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_id" integer NOT NULL,
	"equipment_id" integer,
	"notification_type" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"action_required" text,
	"estimated_time_to_failure" integer,
	"related_work_order_id" integer,
	"is_read" boolean DEFAULT false,
	"is_actioned" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"dismissed_at" timestamp,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "spare_parts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
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
	"tenant_id" varchar(36),
	"spare_part_id" integer NOT NULL,
	"movement_type" varchar(20) NOT NULL,
	"quantity" integer NOT NULL,
	"previous_stock" integer NOT NULL,
	"new_stock" integer NOT NULL,
	"reason" varchar(100),
	"work_order_id" integer,
	"equipment_id" integer,
	"performed_by" integer,
	"reference" text,
	"notes" text,
	"unit_cost" numeric(10, 2),
	"total_cost" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
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
CREATE TABLE "tenants" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(100),
	"plan" varchar(50) DEFAULT 'free' NOT NULL,
	"is_active" boolean DEFAULT true,
	"max_users" integer DEFAULT 5,
	"current_users" integer DEFAULT 0,
	"data_retention_days" integer DEFAULT 365,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"encryption_enabled" boolean DEFAULT true,
	"gdpr_compliant" boolean DEFAULT true,
	"audit_logs_enabled" boolean DEFAULT true,
	"subscription_id" varchar(100),
	"trial_end_date" timestamp,
	"last_billing_date" timestamp,
	"next_billing_date" timestamp,
	"contact_email" varchar(255),
	"contact_phone" varchar(50),
	"billing_address" jsonb,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"features" jsonb DEFAULT '{}'::jsonb,
	"purchase_order_config" jsonb DEFAULT '{}'::jsonb,
	"work_order_config" jsonb DEFAULT '{}'::jsonb,
	"reporting_config" jsonb DEFAULT '{}'::jsonb,
	"license_type" varchar(50) DEFAULT 'solo',
	"licensed_users" integer DEFAULT 1,
	"license_generated_at" timestamp DEFAULT now(),
	"license_updated_at" timestamp DEFAULT now(),
	"license_key" varchar(100),
	"trial_start_date" timestamp,
	"license_status" varchar(30) DEFAULT 'trial',
	"grace_period_days" integer DEFAULT 7,
	"grace_period_end" timestamp,
	"last_license_check_at" timestamp,
	CONSTRAINT "tenants_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"achievement_id" integer,
	"unlocked_at" timestamp DEFAULT now(),
	"progress" real DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "user_challenge_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"challenge_id" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"progress" real DEFAULT 0,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"score" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
	"username" varchar(50) NOT NULL,
	"first_name" varchar(50),
	"last_name" varchar(50),
	"email" varchar(100),
	"password" varchar(255),
	"role" varchar(30) DEFAULT 'technician',
	"sector" varchar(50),
	"department" varchar(50),
	"phone_number" varchar(20),
	"preferred_language" varchar(5) DEFAULT 'fr',
	"specializations" text[],
	"experience_level" varchar(20) DEFAULT 'intermediate',
	"validation_level" integer DEFAULT 0,
	"can_validate_work_orders" boolean DEFAULT false,
	"can_validate_purchase_orders" boolean DEFAULT false,
	"max_purchase_amount" numeric(12, 2),
	"is_active" boolean DEFAULT true,
	"last_login" timestamp,
	"mfa_secret" varchar(100),
	"mfa_enabled" boolean DEFAULT false,
	"mfa_backup_codes" text,
	"must_change_password" boolean DEFAULT false,
	"is_default_credentials" boolean DEFAULT false,
	"password_expires_at" timestamp,
	"default_credentials_generated_at" timestamp,
	"default_credentials_generated_by" integer,
	"last_password_change" timestamp,
	"failed_login_attempts" integer DEFAULT 0,
	"account_locked_until" timestamp,
	"password_reset_token" varchar(128),
	"password_reset_token_expires_at" timestamp,
	"password_reset_requested_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_profiles_username_unique" UNIQUE("username"),
	CONSTRAINT "user_profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"session_token" varchar(128) NOT NULL,
	"refresh_token" varchar(128),
	"ip_address" varchar(45),
	"user_agent" text,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp NOT NULL,
	"last_activity_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"revoked_at" timestamp,
	"revoked_reason" varchar(100),
	CONSTRAINT "user_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "user_skill_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"skill_id" integer,
	"current_level" integer DEFAULT 1,
	"experience_points" integer DEFAULT 0,
	"next_level_threshold" integer DEFAULT 100,
	"achievements_unlocked" text[],
	"last_activity_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "validation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
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
CREATE TABLE "work_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
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
	"projected_cost" numeric(10, 2),
	"projected_imca_impact" real,
	"imca_at_creation" real,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "work_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "workflow_definitions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"states" jsonb NOT NULL,
	"transitions" jsonb NOT NULL,
	"role_permissions" jsonb DEFAULT '{}'::jsonb,
	"sla_config" jsonb DEFAULT '{}'::jsonb,
	"webhooks" jsonb DEFAULT '[]'::jsonb,
	"version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "workflow_tasks" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36),
	"type" varchar(20) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"assigned_to" integer,
	"data" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'active',
	"priority" varchar(10) DEFAULT 'medium',
	"due_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_reviews" ADD CONSTRAINT "access_reviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_reviews" ADD CONSTRAINT "access_reviews_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_reviews" ADD CONSTRAINT "access_reviews_reviewer_id_user_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_training_jobs" ADD CONSTRAINT "ai_training_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_training_jobs" ADD CONSTRAINT "ai_training_jobs_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts_notifications" ADD CONSTRAINT "alerts_notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts_notifications" ADD CONSTRAINT "alerts_notifications_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts_notifications" ADD CONSTRAINT "alerts_notifications_assigned_to_user_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts_notifications" ADD CONSTRAINT "alerts_notifications_acknowledged_by_user_profiles_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts_notifications" ADD CONSTRAINT "alerts_notifications_resolved_by_user_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allowed_domains" ADD CONSTRAINT "allowed_domains_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allowed_domains" ADD CONSTRAINT "allowed_domains_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arbitration_weights_state" ADD CONSTRAINT "arbitration_weights_state_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_reports" ADD CONSTRAINT "audit_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_reports" ADD CONSTRAINT "audit_reports_generated_by_user_profiles_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_trail" ADD CONSTRAINT "audit_trail_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_trail" ADD CONSTRAINT "audit_trail_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automated_symptom_detection" ADD CONSTRAINT "automated_symptom_detection_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automated_symptom_detection" ADD CONSTRAINT "automated_symptom_detection_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_channels" ADD CONSTRAINT "communication_channels_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reports" ADD CONSTRAINT "compliance_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reports" ADD CONSTRAINT "compliance_reports_generated_by_user_profiles_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counter_history" ADD CONSTRAINT "counter_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counter_history" ADD CONSTRAINT "counter_history_counter_id_maintenance_counters_id_fk" FOREIGN KEY ("counter_id") REFERENCES "public"."maintenance_counters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counter_history" ADD CONSTRAINT "counter_history_performed_by_user_profiles_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counter_history" ADD CONSTRAINT "counter_history_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_access_permissions" ADD CONSTRAINT "data_access_permissions_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_access_permissions" ADD CONSTRAINT "data_access_permissions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_integration_logs" ADD CONSTRAINT "data_integration_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_retention" ADD CONSTRAINT "data_retention_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_sessions" ADD CONSTRAINT "diagnostic_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_dependency_overrides" ADD CONSTRAINT "equipment_dependency_overrides_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_registry" ADD CONSTRAINT "equipment_registry_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_types" ADD CONSTRAINT "equipment_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_systems" ADD CONSTRAINT "erp_systems_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failure_memory" ADD CONSTRAINT "failure_memory_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failure_trends" ADD CONSTRAINT "failure_trends_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federated_learning" ADD CONSTRAINT "federated_learning_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federated_sync_state" ADD CONSTRAINT "federated_sync_state_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_sessions" ADD CONSTRAINT "feedback_sessions_session_id_diagnostic_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."diagnostic_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gdpr_requests" ADD CONSTRAINT "gdpr_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_log" ADD CONSTRAINT "integration_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_revoked_by_user_profiles_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_sensor_data" ADD CONSTRAINT "iot_sensor_data_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_metrics" ADD CONSTRAINT "kpi_metrics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_metrics" ADD CONSTRAINT "kpi_metrics_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_history" ADD CONSTRAINT "license_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_cases" ADD CONSTRAINT "maintenance_cases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_counters" ADD CONSTRAINT "maintenance_counters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_counters" ADD CONSTRAINT "maintenance_counters_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_reports" ADD CONSTRAINT "maintenance_reports_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_reports" ADD CONSTRAINT "maintenance_reports_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_notifications" ADD CONSTRAINT "mobile_notifications_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_notifications" ADD CONSTRAINT "mobile_notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_channel_id_communication_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."communication_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permit_to_work" ADD CONSTRAINT "permit_to_work_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permit_to_work" ADD CONSTRAINT "permit_to_work_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permit_to_work" ADD CONSTRAINT "permit_to_work_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permit_to_work" ADD CONSTRAINT "permit_to_work_requested_by_id_user_profiles_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permit_to_work" ADD CONSTRAINT "permit_to_work_approved_by_id_user_profiles_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permit_to_work" ADD CONSTRAINT "permit_to_work_issued_by_id_user_profiles_id_fk" FOREIGN KEY ("issued_by_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permit_to_work" ADD CONSTRAINT "permit_to_work_closed_by_id_user_profiles_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "power_bi_datasets" ADD CONSTRAINT "power_bi_datasets_workspace_id_power_bi_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."power_bi_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "power_bi_reports" ADD CONSTRAINT "power_bi_reports_workspace_id_power_bi_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."power_bi_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "power_bi_workspaces" ADD CONSTRAINT "power_bi_workspaces_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictive_analytics" ADD CONSTRAINT "predictive_analytics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictive_analytics" ADD CONSTRAINT "predictive_analytics_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictive_predictions" ADD CONSTRAINT "predictive_predictions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictive_predictions" ADD CONSTRAINT "predictive_predictions_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictive_predictions" ADD CONSTRAINT "predictive_predictions_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preventive_maintenance_plans" ADD CONSTRAINT "preventive_maintenance_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_spare_part_id_spare_parts_id_fk" FOREIGN KEY ("spare_part_id") REFERENCES "public"."spare_parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_chef_service_validated_by_user_profiles_id_fk" FOREIGN KEY ("chef_service_validated_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_directeur_validated_by_user_profiles_id_fk" FOREIGN KEY ("directeur_validated_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_rejected_by_user_profiles_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_printed_by_user_profiles_id_fk" FOREIGN KEY ("printed_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_spare_part_id_spare_parts_id_fk" FOREIGN KEY ("spare_part_id") REFERENCES "public"."spare_parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_procedures" ADD CONSTRAINT "repair_procedures_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_procedures" ADD CONSTRAINT "repair_procedures_case_id_maintenance_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."maintenance_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reported_cases" ADD CONSTRAINT "reported_cases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_schedules" ADD CONSTRAINT "reporting_schedules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scada_connections" ADD CONSTRAINT "scada_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_policies" ADD CONSTRAINT "security_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_thresholds" ADD CONSTRAINT "sensor_thresholds_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_challenges" ADD CONSTRAINT "skill_challenges_skill_id_maintenance_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."maintenance_skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_notifications" ADD CONSTRAINT "smart_notifications_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_notifications" ADD CONSTRAINT "smart_notifications_related_work_order_id_work_orders_id_fk" FOREIGN KEY ("related_work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_spare_part_id_spare_parts_id_fk" FOREIGN KEY ("spare_part_id") REFERENCES "public"."spare_parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_performed_by_user_profiles_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_maintenance_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."maintenance_achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_challenge_progress" ADD CONSTRAINT "user_challenge_progress_challenge_id_skill_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."skill_challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skill_progress" ADD CONSTRAINT "user_skill_progress_skill_id_maintenance_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."maintenance_skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_logs" ADD CONSTRAINT "validation_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_logs" ADD CONSTRAINT "validation_logs_validated_by_user_profiles_id_fk" FOREIGN KEY ("validated_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_to_user_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_requested_by_user_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_level1_validated_by_user_profiles_id_fk" FOREIGN KEY ("level1_validated_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_level2_validated_by_user_profiles_id_fk" FOREIGN KEY ("level2_validated_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_rejected_by_user_profiles_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_assigned_to_user_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;