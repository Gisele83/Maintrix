-- iot_sensor_data a été créée sans tenant_id (migration 0000), comme maintenance_reports et
-- monthly_reports avant la migration 0020. Celle-ci avait rapiécé son unique export par une
-- jointure interne sur equipment_registry, en signalant dans le code que la colonne restait à
-- faire. Le recensement complet de ses lectures a montré un défaut plus large que l'isolation.
--
-- CE QUI FUYAIT, ET CE QUI ÉTAIT FAUX
--
--   • /api/jsd/equipment/:id et /api/stochastic-rul/equipment/:id recevaient un identifiant
--     d'équipement, le renvoyaient dans leur réponse, et ne s'en servaient JAMAIS dans la
--     requête : leur seule condition était une fenêtre temporelle. La dérive et le RUL affichés
--     étaient donc calculés sur les relevés mêlés de tout le parc de toute l'instance, puis
--     étiquetés du nom d'un équipement. Ce n'était pas qu'une fuite : le nombre ne mesurait rien.
--   • /api/jsd/global-status lisait de même toute l'instance.
--   • POST /api/equipment/:equipmentId/predict et POST /api/advanced-diagnostic prenaient
--     l'équipement de la requête sans vérifier à qui il appartient.
--   • getIotSensorData(equipmentId?) avait un équipement FACULTATIF ; GET /api/iot-data l'appelait
--     sans lui et rendait toute l'instance.
--   • /api/system/health comptait les lignes de cette table sans condition, seul compteur non
--     cloisonné d'un relevé qui l'était partout ailleurs.
--
-- RATTACHEMENT DIRECT, comme en 0020 : equipment_id est NULLABLE, et une jointure rendrait les
-- relevés sans équipement invisibles à leur propre propriétaire au lieu de les cloisonner. À
-- l'ingestion, le connecteur IoT ne connaît que l'équipement : il résout le locataire une fois, à
-- l'écriture, plutôt que de laisser chaque lecture le redériver — c'est ce redérivage oublié qui
-- a produit les défauts ci-dessus.

ALTER TABLE "iot_sensor_data" ADD COLUMN "tenant_id" varchar(36);
--> statement-breakpoint

-- Rattrapage depuis l'équipement : c'est le seul lien dont dispose cette table.
UPDATE "iot_sensor_data" isd
SET "tenant_id" = er."tenant_id"
FROM "equipment_registry" er
WHERE isd."equipment_id" = er."id" AND isd."tenant_id" IS NULL;
--> statement-breakpoint

-- Un relevé sans équipement n'est rattachable à personne : contrairement à maintenance_reports,
-- il n'existe aucun second lien (pas d'ordre de travail) pour le retrouver. Ces lignes vont chez
-- 'default-tenant', comme les migrations 0018 et 0020 l'ont fait dans le même cas.
--
-- ⚠️ À SAVOIR AVANT DÉPLOIEMENT : ces relevés sont ceux du simulateur IoT, qui insère en continu
-- depuis le démarrage du serveur (AdvancedIoTConnector). Sur une instance de démonstration ils
-- peuvent être nombreux, et les attribuer à 'default-tenant' les y rend visibles. Ce sont des
-- mesures simulées, sans valeur d'exploitation : la purge est sans risque et reste une décision
-- d'exploitation, pas de migration —
--     DELETE FROM "iot_sensor_data" WHERE "tenant_id" = 'default-tenant' AND "equipment_id" IS NULL;
UPDATE "iot_sensor_data" SET "tenant_id" = 'default-tenant' WHERE "tenant_id" IS NULL;
--> statement-breakpoint

ALTER TABLE "iot_sensor_data" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "iot_sensor_data" ADD CONSTRAINT "iot_sensor_data_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

-- PAS D'INDEX ICI, bien que les lectures filtrent maintenant toutes sur
-- (tenant_id, equipment_id, timestamp) et que cette table soit la plus volumineuse du schéma —
-- le simulateur y insère en continu. Aucune table de ce schéma ne déclare d'index dans
-- shared/schema.ts, et aucune migration n'en crée : un index posé ici seulement existerait sur une
-- base construite par `drizzle-kit migrate` et pas sur une base construite par `push`, celle que
-- les tests utilisent. Ce dépôt a déjà payé ce genre d'écart silencieux (voir
-- scripts/verify-migrations.mjs, écrit après qu'un déploiement par `migrate` eut produit une base
-- à laquelle il manquait neuf migrations de cloisonnement). L'index se posera quand il sera
-- déclaré des deux côtés, ce qui demande d'ajouter le troisième argument de `pgTable` — un
-- changement de forme à faire pour toutes les tables à la fois, pas en passant.
