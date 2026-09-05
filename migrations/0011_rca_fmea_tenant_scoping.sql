-- rca_analyses et fmea_analyses (migration 0006) ont été créées sans tenant_id, contrairement à
-- toutes les autres tables métier du projet — server/rca-routes.ts et server/fmea-routes.ts
-- interrogeaient donc ces tables sans aucun filtre de tenant (WHERE 1=1), exposant les analyses
-- RCA/FMEA de tous les tenants à n'importe quel utilisateur authentifié (lecture, modification,
-- suppression). Toute ligne existante est rattachée à 'default-tenant' (seul tenant de cet
-- environnement de développement) avant de rendre la colonne obligatoire.

ALTER TABLE "rca_analyses" ADD COLUMN "tenant_id" varchar(36);
UPDATE "rca_analyses" SET "tenant_id" = 'default-tenant' WHERE "tenant_id" IS NULL;
ALTER TABLE "rca_analyses" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "rca_analyses" ADD CONSTRAINT "rca_analyses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "fmea_analyses" ADD COLUMN "tenant_id" varchar(36);
UPDATE "fmea_analyses" SET "tenant_id" = 'default-tenant' WHERE "tenant_id" IS NULL;
ALTER TABLE "fmea_analyses" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "fmea_analyses" ADD CONSTRAINT "fmea_analyses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
