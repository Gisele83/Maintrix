-- purchase_orders a été créée sans tenant_id (migration 0000), comme maintenance_reports et
-- monthly_reports avant 0020 et iot_sensor_data avant 0021. C'est la dernière table du circuit
-- d'achat à ne pas porter son propriétaire, et la plus sensible : un bon de commande est un
-- ENGAGEMENT DE DÉPENSE, avec un montant, un fournisseur et une chaîne d'approbation nominative.
--
-- CE QUI FUYAIT, ET CE QUI ÉTAIT PIRE QU'UNE FUITE
--
-- Le lot du 2026-10-25 a refermé le circuit de validation à plusieurs niveaux (identité et niveau
-- issus de la session, quatre barrières, traçabilité réellement écrite — voir
-- server/simple-validation-routes.ts). Il a dû y laisser un trou béant, faute de cette colonne :
--
--   • `getPurchaseOrdersByStatus(status)` ne filtrait sur rien : la file d'attente de validation
--     d'un locataire contenait les bons de commande de TOUTE l'instance — numéro, montant,
--     fournisseur, demandeur, priorité ;
--   • `getPurchaseOrderById(id)` non plus : la route de validation retrouvait sans broncher un bon
--     d'une autre organisation, et les quatre barrières s'appliquaient alors correctement… au
--     profit du mauvais document. Un validateur dûment habilité du locataire A pouvait APPROUVER
--     un bon du locataire B, s'inscrire dessus comme chef de service, et le rendre imprimable ;
--   • `updatePurchaseOrder(id, data)` écrivait sur l'identifiant seul — y compris les pièces
--     justificatives (`documents_justificatifs`) et le marquage d'impression ;
--   • `getPurchaseOrders()` rendait l'instance entière à `GET /api/purchase-orders` ;
--   • le compteur de l'agent fonctionnel « approvisionnement » (server/agents/functional/
--     functional-agents.ts) comptait les bons en cours de tout le monde, et le disait en
--     commentaire : « limite connue de la table ».
--
-- Ce n'est pas qu'une lecture de trop. Une approbation portée au nom d'autrui est une SIGNATURE
-- apposée sur un engagement financier qui n'est pas le sien, et `validation_logs` l'enregistrait
-- avec le locataire de l'APPROBATEUR : la trace désignait le bon locataire pour le mauvais
-- document.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- RATTACHEMENT DIRECT, comme en 0020 et 0021
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- On ajoute la colonne plutôt que de joindre `suppliers` à chaque lecture, pour trois raisons :
--
--   • `supplier_id` est NULLABLE, et il l'est en pratique — `POST /api/purchase-orders`
--     (server/gmao-routes.ts) crée un bon sans fournisseur. Par jointure, ces bons seraient hors
--     de toute portée : invisibles à leur propre propriétaire, et jamais validables ;
--   • le locataire est déjà connu à CHAQUE point d'insertion (la session de celui qui commande,
--     ou le `tenantId` du réapprovisionnement automatique) : il n'y a rien à dériver ;
--   • une jointure laisserait le cloisonnement à la charge de chaque futur appelant — c'est
--     exactement ainsi qu'il a été oublié ici.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- RATTRAPAGE DES LIGNES EXISTANTES — EN TROIS TEMPS, ET LE TROISIÈME REFUSE
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- Un bon de commande ne porte aucun lien direct vers un locataire. Deux liens INDIRECTS existent,
-- du plus fiable au moins :
--
--   1. `supplier_id` → `suppliers.tenant_id`, NOT NULL depuis 0019. Lien le plus sûr.
--   2. `purchase_order_items.spare_part_id` → `spare_parts.tenant_id`. Second lien : il rattrape
--      les bons SANS fournisseur mais AVEC des lignes, c'est-à-dire ceux que le réapprovision-
--      nement automatique produit (`checkStockLevelsAndTriggerReorders` insère toujours une ligne
--      portant la pièce). Même construction en deux passes que 0020 (équipement, puis ordre de
--      travail).
--      Il n'est retenu que si TOUTES les lignes résolues du bon désignent UN SEUL locataire. Un
--      bon dont les pièces appartiennent à deux organisations est lui-même le symptôme d'un
--      mélange : le deviner reviendrait à en choisir une au hasard.
--
--   3. ET SI AUCUN DES DEUX NE RÉPOND : LA MIGRATION REFUSE, elle n'attribue pas.
--
-- C'est le seul écart assumé avec 0018, 0020 et 0021, qui placent dans ce cas les lignes
-- restantes chez 'default-tenant'. Cet écart est délibéré, et voici pourquoi :
--
--   • ces migrations-là rattachaient des MESURES et des AGRÉGATS — relevés d'un simulateur IoT,
--     rapports mensuels entièrement recalculables. 0020 et 0021 écrivent d'ailleurs toutes deux,
--     en garde, qu'il faut les régénérer ou les purger après déploiement ;
--   • ici, l'attribution n'est pas qu'une étiquette : elle FAIT ENTRER le bon dans la file
--     d'attente de validation du locataire choisi. Celui-ci le voit, peut l'approuver, le signer
--     de son nom et le rendre imprimable. Attribuer au hasard un engagement de dépense, c'est
--     fabriquer la faille même que cette migration vient fermer ;
--   • et rien, dans une ligne sans fournisseur ni pièce identifiable, n'indique de qui elle est.
--     Le dire franchement vaut mieux que le deviner en silence.
--
-- Sur une base NEUVE — celle de `drizzle-kit migrate`, celle des tests — la table est vide : les
-- trois passes ne touchent rien et ce refus ne se déclenche jamais. Il ne concerne qu'une
-- instance portant de vrais bons de commande antérieurs, et c'est précisément là qu'une décision
-- humaine est due. Le refus survient AVANT tout changement irréversible, et `drizzle-kit migrate`
-- applique chaque fichier dans une transaction : rien ne reste à moitié appliqué.
--
-- COMMENT L'EXPLOITANT DÉBLOQUE, s'il est dans ce cas (le message d'erreur reprend ces options) :
--
--   a) rattacher le bon à son fournisseur, quand c'est l'information qui manque — réparation
--      réelle, et le rattrapage 1 fait le reste au rejeu :
--          UPDATE purchase_orders SET supplier_id = <id> WHERE order_number = '<numéro>';
--   b) attribuer EXPLICITEMENT le reliquat à un locataire NOMMÉ, en rejouant ce fichier à la main
--      (le réglage ne vit que le temps de la session psql, et c'est l'exploitant qui désigne le
--      locataire, pas la migration) :
--          SET maintrix.locataire_bons_orphelins = '<uuid-du-locataire>';
--          \i migrations/0022_purchase_orders_tenant_scoped.sql
--   c) supprimer les bons qui n'engagent plus rien. Ce n'est PAS fait ici : supprimer des données
--      est une décision d'exploitation, pas de migration.
--
-- PAS D'INDEX, pour la raison détaillée en 0021 : aucune table de ce schéma ne déclare d'index
-- dans shared/schema.ts, et un index posé ici seulement existerait sur une base construite par
-- `migrate` et pas sur une base construite par `push` — celle des tests. L'écart serait
-- silencieux, et ce dépôt l'a déjà payé (voir scripts/verify-migrations.mjs).
--
-- purchase_order_items NE REÇOIT PAS de colonne : une ligne n'existe que par son bon
-- (`purchase_order_id`), le cloisonnement passe donc par le bon parent, en jointure. Dupliquer le
-- locataire sur la ligne ajouterait une valeur à maintenir — donc à désynchroniser — sans rien
-- rendre possible qui ne le soit déjà.

ALTER TABLE "purchase_orders" ADD COLUMN "tenant_id" varchar(36);
--> statement-breakpoint

-- ── Rattrapage 1 : par le fournisseur ───────────────────────────────────────────────────────
-- `suppliers.tenant_id` est NOT NULL depuis 0019 : dès que `supplier_id` pointe vers un
-- fournisseur existant, le locataire est connu sans ambiguïté.
UPDATE "purchase_orders" po
SET "tenant_id" = s."tenant_id"
FROM "suppliers" s
WHERE po."supplier_id" = s."id" AND po."tenant_id" IS NULL;
--> statement-breakpoint

-- ── Rattrapage 2 : par les pièces commandées ────────────────────────────────────────────────
-- Pour les bons SANS fournisseur. `COUNT(DISTINCT ...) = 1` est la condition qui empêche de
-- choisir au hasard quand les pièces d'un même bon appartiennent à plusieurs organisations.
UPDATE "purchase_orders" po
SET "tenant_id" = resolu."tenant_id"
FROM (
  SELECT poi."purchase_order_id" AS bon_id,
         MIN(sp."tenant_id") AS "tenant_id",
         COUNT(DISTINCT sp."tenant_id") AS combien
  FROM "purchase_order_items" poi
  JOIN "spare_parts" sp ON sp."id" = poi."spare_part_id"
  WHERE sp."tenant_id" IS NOT NULL
  GROUP BY poi."purchase_order_id"
) resolu
WHERE po."id" = resolu."bon_id" AND resolu.combien = 1 AND po."tenant_id" IS NULL;
--> statement-breakpoint

-- ── Reliquat : attribution explicite, ou refus ──────────────────────────────────────────────
DO $maintrix$
DECLARE
  locataire_choisi text := NULLIF(current_setting('maintrix.locataire_bons_orphelins', true), '');
  restants bigint;
  apercu text;
BEGIN
  SELECT COUNT(*) INTO restants FROM "purchase_orders" WHERE "tenant_id" IS NULL;
  IF restants = 0 THEN
    RETURN;
  END IF;

  -- Les dix premiers numéros suffisent à retrouver les lignes ; les lister toutes rendrait le
  -- message illisible sur une instance qui en compte des milliers.
  SELECT string_agg("order_number", ', ')
    INTO apercu
    FROM (SELECT "order_number" FROM "purchase_orders"
          WHERE "tenant_id" IS NULL ORDER BY "id" LIMIT 10) premiers;

  IF locataire_choisi IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM "tenants" WHERE "id" = locataire_choisi) THEN
      RAISE EXCEPTION
        'maintrix.locataire_bons_orphelins = % ne correspond a aucun locataire existant.',
        locataire_choisi
        USING HINT = 'Verifiez l''identifiant : SELECT id, name FROM tenants;';
    END IF;
    UPDATE "purchase_orders" SET "tenant_id" = locataire_choisi WHERE "tenant_id" IS NULL;
    RAISE NOTICE
      '% bon(s) de commande sans fournisseur ni piece identifiable attribue(s) a % sur decision explicite de l''exploitant.',
      restants, locataire_choisi;
    RETURN;
  END IF;

  RAISE EXCEPTION
    '% bon(s) de commande ne sont rattachables a aucun locataire : ni fournisseur, ni piece identifiable. Premiers numeros : %.',
    restants, apercu
    USING HINT =
      'A qui appartient un engagement de depense ne se devine pas. Trois issues, au choix : '
      '(a) rattacher chaque bon a son fournisseur — UPDATE purchase_orders SET supplier_id = <id> WHERE order_number = ''<numero>'' — puis rejouer ; '
      '(b) attribuer le reliquat a un locataire NOMME, en rejouant ce fichier a la main : SET maintrix.locataire_bons_orphelins = ''<uuid>''; \i migrations/0022_purchase_orders_tenant_scoped.sql ; '
      '(c) supprimer ces bons s''ils n''engagent plus rien — decision d''exploitation, que cette migration ne prend pas a votre place.';
END
$maintrix$;
--> statement-breakpoint

ALTER TABLE "purchase_orders" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
--> statement-breakpoint

-- ── Le CASCADE ci-dessus était INERTE, et il a fallu le mesurer pour le voir ──────────────────
-- `purchase_order_items.purchase_order_id` a été créée en `ON DELETE no action` (migration 0000).
-- Conséquence : supprimer un locataire ne cascadait pas, il ÉCHOUAIT —
--     ERROR: update or delete on table "purchase_orders" violates foreign key constraint
--            "purchase_order_items_purchase_order_id_purchase_orders_id_fk" on table
--            "purchase_order_items"
-- dès qu'un seul de ses bons de commande portait une ligne, c'est-à-dire presque toujours. Le
-- retrait d'une organisation s'arrêtait là, et la clause ajoutée juste au-dessus n'aurait jamais
-- servi.
--
-- Une ligne de bon de commande n'a aucune existence hors de son bon : elle le suit. La contrainte
-- est donc reposée en CASCADE — et `shared/schema.ts` reçoit le même `onDelete: "cascade"`, pour
-- que `push` et `migrate` produisent toujours le même schéma (c'est la divergence que
-- scripts/verify-migrations.mjs surveille).
ALTER TABLE "purchase_order_items" DROP CONSTRAINT IF EXISTS "purchase_order_items_purchase_order_id_purchase_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;
