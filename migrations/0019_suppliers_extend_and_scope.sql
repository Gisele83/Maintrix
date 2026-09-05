-- server/supplier-routes.ts (Portail Fournisseurs) ciblait des colonnes (name, contact_name,
-- contact_email, siret, contrat, assurance, KPI de performance...) qui n'existaient pas sur la
-- vraie table "suppliers" (déjà utilisée par purchase_orders/reorder_rules) — chaque requête
-- échouait donc en base. Plutôt que de dupliquer la table, on étend la table réelle avec les
-- colonnes manquantes ; server/supplier-routes.ts est corrigé en parallèle pour cibler les
-- colonnes déjà existantes (company_name, contact_person, email, phone...) au lieu d'en
-- réinventer des équivalents. tenant_id, déjà présent mais nullable, devient obligatoire —
-- aucune ligne existante dans cet environnement (table vide), pas de rattrapage nécessaire.

ALTER TABLE "suppliers" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "suppliers" ADD COLUMN "siret" varchar(50);
ALTER TABLE "suppliers" ADD COLUMN "vat_number" varchar(50);
ALTER TABLE "suppliers" ADD COLUMN "website" varchar(255);
ALTER TABLE "suppliers" ADD COLUMN "payment_terms_days" integer DEFAULT 30;
ALTER TABLE "suppliers" ADD COLUMN "currency" varchar(10) DEFAULT 'EUR';
ALTER TABLE "suppliers" ADD COLUMN "specialties" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "suppliers" ADD COLUMN "contract_start" timestamp;
ALTER TABLE "suppliers" ADD COLUMN "contract_end" timestamp;
ALTER TABLE "suppliers" ADD COLUMN "contract_number" varchar(100);
ALTER TABLE "suppliers" ADD COLUMN "insurance_expiry" timestamp;
ALTER TABLE "suppliers" ADD COLUMN "insurance_amount" numeric(12, 2);
ALTER TABLE "suppliers" ADD COLUMN "status" varchar(30) DEFAULT 'active';
ALTER TABLE "suppliers" ADD COLUMN "on_time_delivery_pct" numeric(5, 2);
ALTER TABLE "suppliers" ADD COLUMN "quality_score" numeric(5, 2);
ALTER TABLE "suppliers" ADD COLUMN "total_orders" integer DEFAULT 0;
ALTER TABLE "suppliers" ADD COLUMN "total_spend" numeric(12, 2) DEFAULT '0';
ALTER TABLE "suppliers" ADD COLUMN "last_order_date" timestamp;
ALTER TABLE "suppliers" ADD COLUMN "documents" jsonb DEFAULT '[]'::jsonb;
