-- maintenance_plans (migration 0009) a été créée sans tenant_id, en reproduisant sciemment le
-- même défaut que rca_analyses/fmea_analyses avant leur propre correctif (voir 0011). Toute ligne
-- existante est rattachée à 'default-tenant' (seul tenant de cet environnement de développement)
-- avant de rendre la colonne obligatoire.

ALTER TABLE "maintenance_plans" ADD COLUMN "tenant_id" varchar(36);
UPDATE "maintenance_plans" SET "tenant_id" = 'default-tenant' WHERE "tenant_id" IS NULL;
ALTER TABLE "maintenance_plans" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
