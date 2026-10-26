-- ═══════════════════════════════════════════════════════════════════
-- 0027 — Les seuils d'alarme deviennent réglables, par machine
-- ═══════════════════════════════════════════════════════════════════
--
-- CE QUI N'ALLAIT PAS
--
-- `sensor_thresholds` existait depuis la table de base et n'a JAMAIS servi.
-- Sa structure explique pourquoi : elle était rattachée à `iot_devices` — une
-- table que rien n'écrit — et ne portait ni locataire ni équipement, alors que
-- les relevés (`iot_sensor_data`) sont rattachés à l'ÉQUIPEMENT. Aucune
-- requête ne pouvait aller des relevés aux seuils : les deux moitiés du modèle
-- de supervision ne se raccordaient pas.
--
-- Faute de seuils exploitables, `server/equipment-health-routes.ts` en avait
-- codé quatre en dur, les mêmes pour toutes les installations du monde :
--
--     temperature: 75    vibration: 4.5    pressure: 4.0    current: 10
--
-- Sur une installation réelle, c'est absurde. Une chaudière vapeur travaille à
-- 9 bar, une presse hydraulique à 185, un moteur de 75 kW tire 130 A. Le score
-- de santé retranchait jusqu'à 45 points pour la pression : toute usine était
-- « critique » en permanence, non pas à cause de son état mais à cause de
-- l'échelle des unités de ses capteurs. Et comme une alerte naissait de chaque
-- RELEVÉ fautif, cela produisait des milliers d'alarmes fausses par jour.
--
-- CE QUE FAIT CETTE MIGRATION
--
-- La clé devient (locataire, équipement, grandeur). `equipment_id` NUL signifie
-- « valeur par défaut de l'organisation pour cette grandeur » : le réglage le
-- plus précis l'emporte, et l'on n'a pas à répéter le même seuil sur cent
-- machines identiques.
--
-- Le champ `sens` est ajouté parce que son absence a déjà coûté cher ailleurs :
-- les grandeurs dont la panne est la CHUTE — pression d'un circuit, débit d'une
-- pompe, niveau d'un bac — ont un seuil critique PLUS BAS que leur seuil
-- d'alerte. Comparées vers le haut, elles déclenchent une alarme critique à
-- chaque relevé normal.
--
-- SUR LES DONNÉES EXISTANTES
--
-- Vérifié avant d'écrire : aucun seed, aucun script et aucune route n'écrivent
-- dans cette table. Elle doit donc être vide. Si elle ne l'est pas, ses lignes
-- sont inexploitables — elles ne désignent aucun locataire et pointent vers un
-- registre d'appareils lui-même vide — et la migration S'ARRÊTE plutôt que de
-- les détruire en silence ou de leur inventer un propriétaire.

-- ═══════════════════════════════════════════════════════════════════
-- REJOUABLE EN TOUTE CIRCONSTANCE
-- ═══════════════════════════════════════════════════════════════════
-- La première version de ce fichier n'était pas idempotente : un simple
-- `ADD COLUMN` échouait si `drizzle-kit push` avait déjà appliqué le schéma de
-- `shared/schema.ts`, ce qui arrive dès qu'un déploiement passe AVANT les
-- migrations. C'est le défaut déjà constaté sur 0022 et 0023, et il force à
-- respecter un ordre que rien n'impose côté exploitation.
--
-- Tout est donc conditionnel ci-dessous. La migration peut être jouée avant le
-- déploiement, après, ou deux fois : le résultat est le même.

DO $$
DECLARE
  restantes bigint;
  deja_structuree boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sensor_thresholds' AND column_name = 'tenant_id'
  ) INTO deja_structuree;

  -- Si `tenant_id` existe déjà, les lignes présentes sont attribuées : elles
  -- n'ont rien d'anormal et il n'y a pas lieu de s'arrêter.
  IF deja_structuree THEN
    RETURN;
  END IF;

  SELECT count(*) INTO restantes FROM "sensor_thresholds";

  IF restantes > 0 THEN
    RAISE EXCEPTION
      'sensor_thresholds contient % ligne(s) dans son ANCIENNE structure, alors que rien '
      'dans le code ne l''écrivait. Ces lignes ne désignent aucun locataire et ne peuvent '
      'donc pas être rattachées automatiquement. Examinez-les '
      '(SELECT * FROM sensor_thresholds), puis supprimez-les explicitement '
      '(DELETE FROM sensor_thresholds) avant de rejouer cette migration.',
      restantes;
  END IF;
END $$;--> statement-breakpoint

-- `device_id` pointait vers `iot_devices`, que rien ne remplit. La contrainte
-- part avec la colonne : la garder obligerait à peupler un registre fantôme
-- pour régler un seuil.
ALTER TABLE "sensor_thresholds" DROP CONSTRAINT IF EXISTS "sensor_thresholds_device_id_iot_devices_id_fk";--> statement-breakpoint
ALTER TABLE "sensor_thresholds" DROP COLUMN IF EXISTS "device_id";--> statement-breakpoint

-- `tenant_id` en NOT NULL : possible uniquement parce que le bloc ci-dessus a
-- garanti que la table est vide dans son ancienne structure.
ALTER TABLE "sensor_thresholds" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE "sensor_thresholds" ADD COLUMN IF NOT EXISTS "equipment_id" integer;--> statement-breakpoint
ALTER TABLE "sensor_thresholds" ADD COLUMN IF NOT EXISTS "sens" varchar(12) DEFAULT 'au-dessus' NOT NULL;--> statement-breakpoint
ALTER TABLE "sensor_thresholds" ADD COLUMN IF NOT EXISTS "updated_by" integer;--> statement-breakpoint
ALTER TABLE "sensor_thresholds" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();--> statement-breakpoint

-- PostgreSQL n'a pas d'`ADD CONSTRAINT IF NOT EXISTS` : on interroge
-- `pg_constraint` plutôt que de laisser l'erreur interrompre la transaction.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sensor_thresholds_tenant_id_tenants_id_fk') THEN
    ALTER TABLE "sensor_thresholds"
      ADD CONSTRAINT "sensor_thresholds_tenant_id_tenants_id_fk"
      FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sensor_thresholds_equipment_id_equipment_registry_id_fk') THEN
    ALTER TABLE "sensor_thresholds"
      ADD CONSTRAINT "sensor_thresholds_equipment_id_equipment_registry_id_fk"
      FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE cascade;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sensor_thresholds_updated_by_user_profiles_id_fk') THEN
    ALTER TABLE "sensor_thresholds"
      ADD CONSTRAINT "sensor_thresholds_updated_by_user_profiles_id_fk"
      FOREIGN KEY ("updated_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null;
  END IF;
END $$;--> statement-breakpoint

-- Un seul réglage par (locataire, équipement, grandeur).
--
-- DEUX index et non un seul : PostgreSQL considère deux NULL comme distincts
-- dans un index unique, si bien qu'un index unique ordinaire laisserait créer
-- autant de « valeurs par défaut de l'organisation » qu'on le souhaite pour la
-- même grandeur — et la lecture en choisirait une au hasard. L'index partiel
-- sur `equipment_id IS NULL` ferme cette porte.
CREATE UNIQUE INDEX IF NOT EXISTS "sensor_thresholds_par_equipement"
  ON "sensor_thresholds" ("tenant_id", "equipment_id", "metric_type")
  WHERE "equipment_id" IS NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "sensor_thresholds_defaut_organisation"
  ON "sensor_thresholds" ("tenant_id", "metric_type")
  WHERE "equipment_id" IS NULL;--> statement-breakpoint

-- La lecture part toujours du locataire.
CREATE INDEX IF NOT EXISTS "sensor_thresholds_tenant_idx" ON "sensor_thresholds" ("tenant_id");
