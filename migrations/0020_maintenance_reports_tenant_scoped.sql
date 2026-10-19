-- maintenance_reports et monthly_reports ont été créées sans tenant_id (migration 0000), alors que
-- la quasi-totalité des autres tables le portent. Conséquences mesurées avant correctif :
--
--   • GET /api/maintenance-reports ne demandait aucun locataire et n'en transmettait aucun : la
--     liste affichée par client/src/components/maintenance-reports.tsx contenait les interventions
--     de TOUS les locataires de l'instance (technicien, description, coût total) ;
--   • GET /api/monthly-reports, même absence de contrôle, sur des données plus condensées encore :
--     coûts de maintenance agrégés du mois ;
--   • /pdf/monthly-reports/:id n'exigeait RIEN — ni session, ni locataire — et servait ces agrégats
--     à un appelant anonyme qui devinait un identifiant séquentiel ;
--   • generateMonthlyReport() restreignait correctement le parc, les ordres de travail et les
--     alertes à son tenantId, mais lisait les rapports d'intervention SANS locataire :
--     total_maintenance_cost, labor_cost, parts_cost et cost_per_work_order additionnaient donc
--     les dépenses de tout le monde, et le coût par intervention — somme globale divisée par les
--     seules interventions du locataire — ne voulait rien dire.
--
-- RATTACHEMENT DIRECT PLUTÔT QUE PAR JOINTURE. On ajoute la colonne au lieu de joindre
-- equipment_registry à chaque lecture, pour deux raisons :
--   • equipment_id est NULLABLE : un rapport né d'un ordre de travail sans équipement serait, par
--     jointure, hors de toute portée — invisible à son propre propriétaire et absent de ses coûts ;
--   • le locataire est déjà connu au seul point d'insertion (generateMaintenanceReport reçoit un
--     tenantId et relit l'ordre de travail avec), il n'y a donc rien à dériver.
-- Une jointure aurait en outre laissé le cloisonnement à la charge de chaque futur appelant —
-- c'est précisément ainsi que celui-ci a été oublié.

-- ── maintenance_reports ──────────────────────────────────────────────────────────────────────
ALTER TABLE "maintenance_reports" ADD COLUMN "tenant_id" varchar(36);
--> statement-breakpoint

-- Rattrapage en trois temps, du plus fiable au dernier recours. L'équipement d'abord : c'est le
-- lien demandé, et le plus précis.
UPDATE "maintenance_reports" mr
SET "tenant_id" = er."tenant_id"
FROM "equipment_registry" er
WHERE mr."equipment_id" = er."id" AND mr."tenant_id" IS NULL;
--> statement-breakpoint

-- Puis l'ordre de travail, pour les rapports SANS équipement — ceux qui resteraient orphelins si
-- l'on s'arrêtait à equipment_registry. work_orders.tenant_id est NOT NULL, et work_order_id est
-- renseigné à chaque insertion (generateMaintenanceReport en fait son premier paramètre) : ce
-- second passage ferme le trou que la colonne nullable laissait ouvert.
UPDATE "maintenance_reports" mr
SET "tenant_id" = wo."tenant_id"
FROM "work_orders" wo
WHERE mr."work_order_id" = wo."id" AND mr."tenant_id" IS NULL;
--> statement-breakpoint

-- Dernier recours : un rapport sans équipement NI ordre de travail n'est rattachable à personne.
-- Aucun chemin de code applicatif ne peut en produire, mais la base l'autorise (les deux colonnes
-- sont nullables), et rendre tenant_id obligatoire échouerait sur une telle ligne. On la place
-- chez 'default-tenant', comme la migration 0018 l'a fait pour maintenance_plans.
UPDATE "maintenance_reports" SET "tenant_id" = 'default-tenant' WHERE "tenant_id" IS NULL;
--> statement-breakpoint

ALTER TABLE "maintenance_reports" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "maintenance_reports" ADD CONSTRAINT "maintenance_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
--> statement-breakpoint

-- ── monthly_reports ─────────────────────────────────────────────────────────────────────────
-- Aucun rattrapage possible ici, et il faut le dire : un rapport mensuel ne référence ni
-- équipement ni ordre de travail. C'est un instantané agrégé, et rien dans la ligne n'indique de
-- qui. Les lignes existantes vont donc chez 'default-tenant'.
--
-- ⚠️ À SAVOIR AVANT DÉPLOIEMENT : ces lignes portent des coûts calculés par le code fautif, donc
-- la somme de plusieurs locataires. Les rattacher les rend cloisonnées, pas justes. Un rapport
-- mensuel étant entièrement recalculable depuis les tables sources, le plus sain est de les
-- régénérer après déploiement (POST /api/monthly-reports pour chaque mois utile), ou de purger
-- celles d'avant correctif :
--     DELETE FROM "monthly_reports" WHERE "tenant_id" = 'default-tenant';
-- Cette purge n'est PAS faite ici : supprimer des données est une décision d'exploitation, pas de
-- migration.
ALTER TABLE "monthly_reports" ADD COLUMN "tenant_id" varchar(36);
--> statement-breakpoint
UPDATE "monthly_reports" SET "tenant_id" = 'default-tenant' WHERE "tenant_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "monthly_reports" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "monthly_reports" ADD CONSTRAINT "monthly_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
