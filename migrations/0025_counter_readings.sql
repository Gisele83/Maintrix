-- Les compteurs d'usage étaient écrits sans jamais pouvoir croître, ni être lus.
--
-- Suite de la migration 0024, qui a fermé la boucle « OT préventif clôturé → compteur remis à
-- zéro ». Ce lot ferme l'amont : sans relevé, un compteur restait à la valeur posée à sa
-- création et n'atteignait jamais son seuil, donc la remise à zéro ne servait à rien.
--
-- RECENSEMENT DU 2026-10-26, SUR LE MODULE DES COMPTEURS
--
--   • `incrementCounter()` — écrite, correcte : ZÉRO appelant. Rien n'augmentait `current_value`.
--   • `updateMaintenanceCounter()`, `deleteMaintenanceCounter()`, `getCounterHistory()`,
--     `getMaintenanceCounterById()`, `getMaintenanceCountersByEquipment()` — ZÉRO appelant.
--   • `increment_rate` — colonne jamais écrite, jamais lue.
--   • aucune route du serveur ne servait `maintenance_counters` avant ce lot.
--
-- Autrement dit : un compteur ne pouvait franchir son seuil que si quelqu'un éditait la base à
-- la main.
--
-- ═══════════════════════════════════════════════════════════════════
-- L'INCRÉMENTATION EST UN RELEVÉ, PAS UNE DÉRIVE SIMULÉE
-- ═══════════════════════════════════════════════════════════════════
-- La colonne `increment_rate` invitait à faire croître les compteurs automatiquement, à raison
-- de tant d'heures par jour. On ne le fait pas, et c'est une décision :
--
--   • une cadence nominale déclarée n'est pas une mesure. Un compteur alimenté ainsi
--     afficherait un usage INVENTÉ, et cet usage déclencherait de vraies alertes de maintenance
--     sur de vraies machines. C'est exactement la famille de défauts que cette campagne passe
--     son temps à refermer — les seuils de capteurs en dur, les indicateurs fabriqués — et le
--     dépôt a une barrière dédiée pour cela (tests/unit/aucun-chiffre-invente.test.ts) ;
--   • rien dans le système ne mesure le temps de marche réel d'un équipement. `iot_sensor_data`
--     porte des relevés de grandeurs physiques, pas un signal « en fonctionnement ».
--
-- Le relevé manuel est donc la seule source honnête, et c'est aussi la pratique : un compteur
-- horaire se lit sur la machine. Le jour où un signal de marche existera, il alimentera cette
-- même table — avec un `recorded_by` nul et une note qui dira sa provenance.
--
-- ═══════════════════════════════════════════════════════════════════
-- POURQUOI UNE TABLE, ET NON `counter_history`
-- ═══════════════════════════════════════════════════════════════════
-- `counter_history` est l'historique des REMISES À ZÉRO : `reset_reason` y est NOT NULL et
-- `previous_value` est un `integer`. L'y détourner obligerait à inventer un « motif de remise à
-- zéro » pour un geste qui n'en est pas un, et tronquerait un relevé de 12,5 h. Les deux
-- histoires restent séparées ; l'écran de suivi les présente réunies dans l'ordre chronologique.
--
-- `previous_value` et `new_value` sont stockées en plus de `usage`, comme `stock_movements` le
-- fait avec `previous_stock` / `new_stock` : une ligne doit se lire seule. Avec le seul
-- incrément, retrouver l'état du compteur à une date donnée obligerait à rejouer toute la
-- série, et un relevé perdu rendrait tous les suivants faux sans que rien ne le signale.
--
-- `tenant_id` est NOT NULL dès la création : table neuve, aucune ligne antérieure à rattraper.
-- Convention du dépôt depuis la migration 0018.

CREATE TABLE IF NOT EXISTS "counter_readings" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" varchar(36) NOT NULL,
  "counter_id" integer NOT NULL,
  "previous_value" real NOT NULL,
  "usage" real NOT NULL,
  "new_value" real NOT NULL,
  "recorded_by" integer,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "counter_readings" ADD CONSTRAINT "counter_readings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "counter_readings" ADD CONSTRAINT "counter_readings_counter_id_maintenance_counters_id_fk" FOREIGN KEY ("counter_id") REFERENCES "public"."maintenance_counters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "counter_readings" ADD CONSTRAINT "counter_readings_recorded_by_user_profiles_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;

-- PAS D'INDEX, bien que la lecture filtre sur (counter_id, created_at). Même raison qu'en 0021
-- et 0024 : aucune table de ce schéma ne déclare d'index dans shared/schema.ts, et un index posé
-- ici seulement existerait sur une base construite par `drizzle-kit migrate` et pas sur une base
-- construite par `push` — celle que les tests utilisent. Le volume attendu est de quelques
-- relevés par compteur et par mois.
