-- La demande d'intervention n'existait pas, et l'alerte ne menait à rien.
--
-- Deux boucles de l'audit du 25 octobre 2026 (docs/AUDIT_FONCTIONNEL.md, section 1) :
--
--   « Demande d'intervention → OT | absente | aucune table de demande ; la DI est confondue
--     avec l'OT »
--   « Alerte → OT | ouverte | aucune création d'OT depuis une alerte »
--
-- ═══════════════════════════════════════════════════════════════════
-- CE QUE L'ABSENCE DE DI COÛTAIT
-- ═══════════════════════════════════════════════════════════════════
-- La séparation DI / OT est structurante en GMAO : l'exploitant SIGNALE, la maintenance
-- ARBITRE et convertit — ou refuse en motivant. Les confondre avait trois effets, tous
-- constatés par l'audit :
--
--   1. n'importe qui devait créer directement un ordre de travail, c'est-à-dire engager la
--      planification et le budget ;
--   2. le refus motivé n'existait pas, donc la charge non traitée n'était pas mesurable — un
--      signalement écarté ne laissait aucune trace, et personne ne pouvait dire combien de
--      demandes avaient été refusées ni pourquoi ;
--   3. le dispositif de validation a dû être greffé APRÈS COUP sur l'ordre de travail, ce qui
--      explique sa forme bancale.
--
-- ═══════════════════════════════════════════════════════════════════
-- LES DEUX ÉCHELLES QU'IL FALLAIT SÉPARER
-- ═══════════════════════════════════════════════════════════════════
-- `urgency` est l'urgence PERÇUE PAR LE DEMANDEUR. La priorité de l'ordre de travail est
-- DÉCIDÉE PAR LA MAINTENANCE à l'arbitrage, et les deux sont stockées séparément. C'est la
-- raison d'être de cette table : sans elle, celui qui signale fixe la priorité d'un travail
-- qu'il ne planifie pas.
--
-- Le vocabulaire est celui des priorités d'ordre de travail (low, medium, high, urgent) et non
-- une seconde échelle. Deux échelles à traduire l'une dans l'autre produiraient des
-- correspondances arbitraires, et ce dépôt a déjà payé la coexistence de deux vocabulaires
-- pour une même notion — les fréquences de plan préventif, dont il a fallu reconnaître les
-- deux jeux de valeurs au lot de la clôture.
--
-- ═══════════════════════════════════════════════════════════════════
-- POURQUOI L'ALERTE PASSE PAR LA DEMANDE, ET NON DIRECTEMENT PAR L'OT
-- ═══════════════════════════════════════════════════════════════════
-- `alert_id` relie une demande à l'alerte qui l'a provoquée. La boucle « alerte → OT » se
-- ferme donc PAR L'ARBITRAGE, et c'est délibéré :
--
--   • une alerte est un SYMPTÔME, pas une décision. Elle peut être un faux positif, un doublon,
--     ou un phénomène déjà connu. Créer un ordre de travail directement depuis une alerte
--     fabriquerait du travail dans le dos de la maintenance — exactement le reproche que
--     l'audit fait à l'absence de DI ;
--   • à l'inverse d'un compteur, dont le seuil EST une décision d'ingénierie déjà prise (c'est
--     pourquoi le franchissement d'un compteur crée bien un OT directement, voir migration
--     0025) ;
--   • et le volume : avec un flux MQTT réel, le connecteur IoT produit des alertes en continu.
--     Les convertir automatiquement en ordres de travail reproduirait le noyage que cette
--     plateforme a déjà corrigé une fois sur les seuils de capteurs.
--
-- La création d'une demande depuis une alerte est donc un GESTE HUMAIN, et `alert_id` sert de
-- garde : une alerte déjà signalée se reconnaît, pour qu'on ne la signale pas deux fois.
--
-- ═══════════════════════════════════════════════════════════════════
-- CHOIX DE COLONNES
-- ═══════════════════════════════════════════════════════════════════
-- `equipment_id` NULLABLE : un exploitant signale parfois un lieu ou un symptôme avant d'avoir
-- identifié la machine au référentiel, d'où `reported_location` en repli. Exiger l'équipement
-- transformerait la demande en formulaire d'expert, et c'est ce qu'on veut éviter — la DI doit
-- être le geste le plus simple du produit.
--
-- `rejection_reason` est NULLABLE en base mais OBLIGATOIRE au refus, contrainte portée par la
-- route. Aucune table de ce schéma ne déclare de contrainte `CHECK` : en introduire une ici
-- seulement créerait un écart entre la base construite par `drizzle-kit migrate` et celle
-- construite par `push` — celle que les tests utilisent. Le dépôt a déjà payé ce genre d'écart
-- silencieux (voir scripts/verify-migrations.mjs).
--
-- `work_order_id` porte la traçabilité de la chaîne. Le lien n'est posé QUE de ce côté : une
-- colonne `request_id` sur `work_orders` serait la même information en double, et un ordre
-- retrouve sa demande par une seule requête.
--
-- `tenant_id` NOT NULL dès la création : table neuve, aucune ligne antérieure à rattraper.
-- Convention du dépôt depuis la migration 0018.

CREATE TABLE IF NOT EXISTS "intervention_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" varchar(36) NOT NULL,
  "request_number" varchar(50) NOT NULL,
  "equipment_id" integer,
  "alert_id" integer,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "urgency" varchar(20) DEFAULT 'medium' NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "requested_by" integer,
  "reported_location" text,
  "reviewed_by" integer,
  "reviewed_at" timestamp,
  "rejection_reason" text,
  "review_notes" text,
  "work_order_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "intervention_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
ALTER TABLE "intervention_requests" ADD CONSTRAINT "intervention_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "intervention_requests" ADD CONSTRAINT "intervention_requests_equipment_id_equipment_registry_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_registry"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "intervention_requests" ADD CONSTRAINT "intervention_requests_alert_id_alerts_notifications_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts_notifications"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "intervention_requests" ADD CONSTRAINT "intervention_requests_requested_by_user_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "intervention_requests" ADD CONSTRAINT "intervention_requests_reviewed_by_user_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "intervention_requests" ADD CONSTRAINT "intervention_requests_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;

-- PAS D'INDEX, bien que la liste filtre sur (tenant_id, status) et que la garde « alerte déjà
-- signalée » lise par alert_id. Même raison qu'en 0021, 0024 et 0025 : aucune table de ce schéma
-- ne déclare d'index dans shared/schema.ts, et un index posé ici seulement existerait sur une
-- base construite par `migrate` et pas sur une base construite par `push`.
