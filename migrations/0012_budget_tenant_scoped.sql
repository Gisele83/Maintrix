-- server/budget-routes.ts existe depuis longtemps avec un CRUD complet (SQL brut) mais interroge
-- des tables "budget_plans" et "budget_transactions" qui n'ont jamais été créées nulle part dans
-- le projet — même situation que rca_analyses/fmea_analyses avant elle (migration 0006). Créées
-- ici directement avec tenant_id (pas en rattrapage) : ces tables portent des données financières,
-- le cloisonnement par tenant est non négociable dès la première ligne.

CREATE TABLE "budget_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"budget_number" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"fiscal_year" integer NOT NULL,
	"department" varchar(100),
	"budget_type" varchar(20) NOT NULL DEFAULT 'maintenance',
	"total_allocated" numeric(12, 2) DEFAULT '0',
	"total_spent" numeric(12, 2) DEFAULT '0',
	"total_committed" numeric(12, 2) DEFAULT '0',
	"contingency_pct" numeric(5, 2) DEFAULT '10',
	"currency" varchar(10) DEFAULT 'EUR',
	"start_date" timestamp,
	"end_date" timestamp,
	"lines" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"status" varchar(20) NOT NULL DEFAULT 'draft',
	"approved_by" varchar(100),
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "budget_plans_budget_number_unique" UNIQUE("budget_number")
);
--> statement-breakpoint
CREATE TABLE "budget_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"budget_id" integer NOT NULL,
	"budget_line_id" varchar(50),
	"transaction_type" varchar(20) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"reference" varchar(100),
	"supplier_name" varchar(200),
	"work_order_id" integer,
	"transaction_date" timestamp NOT NULL,
	"category" varchar(100),
	"status" varchar(20) DEFAULT 'posted',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "budget_plans" ADD CONSTRAINT "budget_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "budget_transactions" ADD CONSTRAINT "budget_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "budget_transactions" ADD CONSTRAINT "budget_transactions_budget_id_budget_plans_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budget_plans"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "budget_transactions" ADD CONSTRAINT "budget_transactions_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL;
