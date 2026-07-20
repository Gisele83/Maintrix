CREATE TABLE "training_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"work_order_id" integer,
	"technician_id" integer NOT NULL,
	"equipment_type" text NOT NULL,
	"gap_reason" text NOT NULL,
	"status" varchar(20) DEFAULT 'detected' NOT NULL,
	"techlearn_tp_id" varchar(100),
	"techlearn_tp_title" text,
	"techlearn_tp_url" text,
	"techlearn_score" real,
	"requested_by" integer,
	"requested_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "training_requests" ADD CONSTRAINT "training_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_requests" ADD CONSTRAINT "training_requests_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_requests" ADD CONSTRAINT "training_requests_technician_id_user_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_requests" ADD CONSTRAINT "training_requests_requested_by_user_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;