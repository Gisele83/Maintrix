-- `company_config` a été créée sans tenant_id (migration 0000), comme maintenance_reports avant
-- la 0020 et iot_sensor_data avant la 0021. Elle porte pourtant ce que ces deux-là ne portaient
-- pas : l'IDENTITÉ COMMERCIALE d'une entreprise — raison sociale, adresse, numéro fiscal, logo —
-- et les seuils d'approbation des dépenses.
--
-- CE QUI FUYAIT, ET CE QUI ÉTAIT FAUX
--
--   • getCompanyConfig() n'avait AUCUN paramètre de locataire et AUCUN filtre : son seul
--     critère était `is_active = true`. Tous les locataires lisaient donc la même ligne.
--   • createCompanyConfig() désactivait les configurations existantes par
--     `UPDATE company_config SET is_active = false` — SANS clause WHERE. Le locataire qui
--     enregistrait sa configuration éteignait celle de TOUS les autres de l'instance, puis
--     devenait la seule ligne active : sa raison sociale, son adresse et son logo étaient
--     ensuite servis à tout le monde.
--   • GET et POST /api/company-config, /api/purchase-orders/document-type et les deux routes
--     PDF de bon de commande lisaient cette ligne unique. Un bon de commande — document
--     d'engagement de dépense — pouvait donc sortir à l'en-tête, à l'adresse et au numéro
--     fiscal d'une AUTRE entreprise. Ce n'est pas qu'une fuite : le document est juridiquement
--     faux.
--   • `purchase_order_threshold` et `command_letter_threshold` vivant dans la même ligne, un
--     locataire déplaçait sans le savoir le montant à partir duquel les AUTRES déclenchent une
--     validation — vers le haut comme vers le bas.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- POURQUOI LES LIGNES EXISTANTES NE SONT PAS ATTRIBUABLES
-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- Les migrations 0020 et 0021 rattrapaient par un LIEN RÉEL (equipment_id, work_order_id).
-- Ici il n'y en a aucun : `company_config` ne référence rien, et rien ne la référence. Pire,
-- deux propriétés du code fautif interdisent même de deviner :
--
--   1. DERNIER ÉCRIVAIN GAGNANT. `POST /api/company-config` relisait la ligne active et, si
--      elle existait, la METTAIT À JOUR au lieu d'en créer une. Après le premier
--      enregistrement de l'instance, tous les suivants — de n'importe quel locataire —
--      réécrivaient donc cette même ligne. Son contenu est celui du dernier à avoir cliqué.
--
--   2. MISE À JOUR PARTIELLE. `updateCompanyConfig` faisait `.set({ ...req.body })`, et les
--      deux écrans ne postent pas les mêmes champs : `threshold-configuration.tsx` renvoie
--      l'objet lu augmenté des deux seuils, `company-letterhead-config.tsx` poste son
--      formulaire d'identité. Une ligne peut donc MÉLANGER la raison sociale d'un locataire et
--      les seuils d'un autre.
--
-- Une attribution à un locataire nommé serait donc exactement le défaut qu'on corrige, commis
-- une fois de plus — et sur un contenu dont rien ne garantit la cohérence. D'où la règle
-- ci-dessous, qui ne devine jamais :
--
--   • UN SEUL locataire dans l'instance → la ligne ne peut venir que de lui. Rattachement, et
--     la configuration reste ACTIVE : c'est le cas du poste de développement et de toute
--     instance mono-entreprise, où rien n'est perdu.
--     ⚠️ Réserve assumée : « un seul locataire AUJOURD'HUI » ne prouve pas « un seul locataire
--     depuis toujours ». Un locataire supprimé depuis n'aurait rien laissé derrière lui, faute
--     de clé étrangère. Sur une instance mono-entreprise l'écart se voit immédiatement à
--     l'écran « Configuration Entreprise », ce qui est le bon endroit pour le corriger.
--
--   • PLUSIEURS locataires → rattachement à 'default-tenant' (précédent des migrations 0018,
--     0020 et 0021) ET `is_active = false`. La désactivation est le point important : laisser
--     la ligne active chez 'default-tenant' continuerait de servir à ce locataire un en-tête
--     qui n'est peut-être pas le sien — le défaut corrigé, en plus petit. Désactivée, la ligne
--     n'est servie à personne, reste consultable, et chaque locataire ressaisit sa
--     configuration. Un bon de commande émis avant ressaisie sort sans en-tête (le générateur
--     PDF omet le bloc quand la configuration est absente) : un document incomplet se voit, un
--     document faux ne se voit pas.
--
-- RÉATTRIBUTION MANUELLE, si l'exploitant SAIT à qui appartient une ligne — à faire après
-- déploiement, en connaissance de cause, jamais par une migration :
--     UPDATE "company_config" SET "tenant_id" = '<id du locataire>', "is_active" = true
--      WHERE "id" = <id de la ligne>;
--     UPDATE "company_config" SET "is_active" = false
--      WHERE "tenant_id" = '<id du locataire>' AND "id" <> <id de la ligne>;
--
-- ⚠️ SI CETTE MIGRATION ÉCHOUE, `drizzle-kit migrate` SORT EN 1 SANS DIRE POURQUOI. Mesuré le
-- 2026-10-25 : le `RAISE EXCEPTION` du bloc ci-dessous fait bien sortir la commande en code 1 —
-- un script de déploiement qui teste le code de retour s'arrête donc — mais la sortie n'affiche
-- que « applying migrations... », et le message explicatif est avalé. L'ensemble des migrations
-- en attente étant appliqué dans UNE transaction (drizzle-orm/pg-core/dialect.js, `migrate()`),
-- rien n'est resté en base : ni la colonne, ni la marque au journal. Pour LIRE la raison :
--     psql "$DATABASE_URL" -f migrations/0022_company_config_tenant_scoped.sql
-- (les `--> statement-breakpoint` sont des commentaires SQL, psql les ignore). Corriger les
-- données signalées, puis relancer `drizzle-kit migrate` — la reprise est sans risque,
-- l'annulation ayant été vérifiée complète.
--
-- PAS D'INDEX ICI, pour la raison exposée en 0021 : aucune table de ce schéma n'en déclare
-- dans shared/schema.ts, et un index posé par la seule voie `migrate` manquerait sur une base
-- construite par `push` — celle des tests. Le volume de cette table (une ligne active par
-- locataire) ne le réclame pas.

ALTER TABLE "company_config" ADD COLUMN "tenant_id" varchar(36);
--> statement-breakpoint

-- Bloc procédural plutôt qu'une suite d'UPDATE : la décision dépend du NOMBRE de locataires,
-- et elle doit être lisible dans la trace du déploiement. Les RAISE NOTICE sont là pour que
-- l'exploitant sache ce qui a été décidé sans relire ce fichier.
DO $$
DECLARE
  nb_lignes      integer;
  nb_locataires  integer;
  cible          varchar(36);
BEGIN
  SELECT count(*) INTO nb_lignes FROM "company_config" WHERE "tenant_id" IS NULL;
  IF nb_lignes = 0 THEN
    RAISE NOTICE 'company_config : aucune ligne antérieure, rien à rattacher.';
    RETURN;
  END IF;

  SELECT count(*) INTO nb_locataires FROM "tenants";

  IF nb_locataires = 0 THEN
    -- Des configurations sans aucun locataire : état incohérent qu'aucun chemin applicatif ne
    -- produit (la route est authentifiée). Échouer bruyamment vaut mieux que violer la clé
    -- étrangère trois instructions plus loin avec un message incompréhensible.
    RAISE EXCEPTION
      'company_config contient % ligne(s) alors que la table tenants est vide. '
      'Attribuez-les à la main (UPDATE company_config SET tenant_id = ...) ou supprimez-les, '
      'puis rejouez cette migration.', nb_lignes;

  ELSIF nb_locataires = 1 THEN
    SELECT "id" INTO cible FROM "tenants";
    UPDATE "company_config" SET "tenant_id" = cible WHERE "tenant_id" IS NULL;
    RAISE NOTICE
      'company_config : % ligne(s) rattachée(s) au locataire unique % — configuration conservée ACTIVE.',
      nb_lignes, cible;

  ELSE
    SELECT "id" INTO cible FROM "tenants" WHERE "id" = 'default-tenant';
    IF cible IS NULL THEN
      -- Pas de 'default-tenant' sur cette instance : on prend le plus ancien locataire, faute
      -- de mieux. La ligne étant désactivée, ce choix ne sert aucun en-tête à personne — il ne
      -- fait que satisfaire la clé étrangère tout en conservant le contenu.
      SELECT "id" INTO cible FROM "tenants" ORDER BY "created_at" NULLS LAST, "id" LIMIT 1;
    END IF;

    UPDATE "company_config" SET "tenant_id" = cible, "is_active" = false WHERE "tenant_id" IS NULL;
    RAISE NOTICE
      'company_config : % locataires dans l''instance, aucune ligne attribuable. '
      '% ligne(s) rattachée(s) à % et DÉSACTIVÉE(S). Chaque locataire doit ressaisir sa '
      'configuration dans l''onglet « Configuration Entreprise ».',
      nb_locataires, nb_lignes, cible;
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "company_config" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_config" ADD CONSTRAINT "company_config_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
