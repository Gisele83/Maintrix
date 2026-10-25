-- reorder_rules a été créée sans tenant_id (migration 0000). C'est la dernière table de la
-- chaîne achats à ne pas porter son propriétaire : 0019 a cloisonné suppliers, 0023
-- purchase_orders et purchase_order_items, et celle-ci restait.
--
-- CE QUI FUYAIT
--
-- `getReorderRules()` ne filtrait sur rien, et DEUX routes la servent :
-- `GET /api/reorder-rules` dans server/gmao-routes.ts et `GET /reorder-rules` dans
-- server/procurement-routes.ts. Le tableau de bord « Stocks & Achats »
-- (client/src/components/procurement-dashboard.tsx) affichait donc à chaque client les règles
-- de TOUS les autres : seuil de déclenchement, quantité à commander, stock maximum, délai
-- d'approvisionnement, fournisseur retenu, et le drapeau de commande automatique.
--
-- Ce n'est pas une donnée anodine. Un seuil de réapprovisionnement et une quantité de
-- commande disent à quel rythme une entreprise consomme une pièce et combien elle immobilise
-- en stock — sa politique d'approvisionnement, lisible par ses concurrents sur la même
-- instance. `PUT /reorder-rules/:id` agissait de son côté sur un identifiant nu, sans
-- vérifier à qui la règle appartenait.
--
-- CE QUI NE FUYAIT PAS, ET POURQUOI IL FAUT LE DIRE
--
-- Le DÉCLENCHEMENT automatique, lui, était accidentellement protégé.
-- `checkStockLevelsAndTriggerReorders(tenantId)` lit toutes les règles, mais résout ensuite
-- la pièce par `getSparePartById(rule.spare_part_id, tenantId)` et passe à la suivante quand
-- elle n'est pas dans la portée (`if (!part) continue`). Une règle d'une autre organisation
-- ne pouvait donc pas créer de commande ici. La fuite était en LECTURE, et en écriture par
-- la route de mise à jour — pas en création de commandes croisées.
--
-- Cette distinction n'est pas un détail de rédaction : elle dit où chercher si quelque chose
-- a mal tourné en exploitation, et elle évite d'annoncer aux clients un incident qui n'a pas
-- eu lieu.
--
-- POURQUOI UNE COLONNE ICI, ET PAS UNE JOINTURE
--
-- 0023 a laissé purchase_order_items sans colonne propre, cloisonnée par son bon parent en
-- jointure, parce qu'une ligne de commande n'existe jamais seule. Une règle de
-- réapprovisionnement, elle, est consultée et modifiée POUR ELLE-MÊME : `getReorderRules()`
-- la rend sans passer par la pièce, et la route de mise à jour l'atteint par son seul
-- identifiant. Lui donner son propriétaire est donc ce qui permet de filtrer à la lecture et
-- de garder la mise à jour, sans jointure à chaque appel.
--
-- `spare_part_id` et `supplier_id` sont tous deux NULLABLE sur cette table : le rattrapage ne
-- peut donc pas se contenter d'un seul chemin.

-- `IF NOT EXISTS`, et la contrainte reposée plus bas de la même façon : ce
-- fichier doit pouvoir être REJOUÉ, parce que son propre message de refus le
-- demande. Éprouvé : sous `psql -f`, chaque instruction est validée séparément,
-- donc un refus du bloc de reliquat laisse la colonne derrière lui. Sans ces
-- gardes, le rejeu après correction des données échouerait sur « column already
-- exists » — un message qui n'aurait plus rien à voir avec le vrai sujet.
-- (`drizzle-kit migrate`, lui, enveloppe le fichier dans une transaction et
-- annule tout : les gardes n'y changent rien.)
ALTER TABLE "reorder_rules" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(36);
--> statement-breakpoint

-- ── Rattrapage 1 : par la pièce ─────────────────────────────────────────────────────────────
-- Chemin le plus sûr : une règle porte sur UNE pièce, et `spare_parts.tenant_id` est renseigné
-- depuis la campagne de cloisonnement du magasin. La condition sur IS NOT NULL est nécessaire —
-- cette colonne-là est nullable, et une pièce sans propriétaire ne peut pas en désigner un.
UPDATE "reorder_rules" rr
SET "tenant_id" = sp."tenant_id"
FROM "spare_parts" sp
WHERE rr."spare_part_id" = sp."id"
  AND sp."tenant_id" IS NOT NULL
  AND rr."tenant_id" IS NULL;
--> statement-breakpoint

-- ── Rattrapage 2 : par le fournisseur ───────────────────────────────────────────────────────
-- Pour les règles sans pièce, ou dont la pièce n'a pas de propriétaire.
-- `suppliers.tenant_id` est NOT NULL depuis 0019.
UPDATE "reorder_rules" rr
SET "tenant_id" = s."tenant_id"
FROM "suppliers" s
WHERE rr."supplier_id" = s."id" AND rr."tenant_id" IS NULL;
--> statement-breakpoint

-- ── Reliquat : attribution explicite, ou refus ──────────────────────────────────────────────
DO $maintrix$
DECLARE
  locataire_choisi text := NULLIF(current_setting('maintrix.locataire_regles_orphelines', true), '');
  restants bigint;
  apercu text;
BEGIN
  SELECT COUNT(*) INTO restants FROM "reorder_rules" WHERE "tenant_id" IS NULL;
  IF restants = 0 THEN
    RETURN;
  END IF;

  -- Une règle n'a pas de numéro lisible : on identifie par son id et la pièce visée, ce qui
  -- suffit à la retrouver. Dix lignes au plus, pour que le message reste lisible.
  SELECT string_agg(format('#%s (piece %s)', "id", COALESCE("spare_part_id"::text, 'aucune')), ', ')
    INTO apercu
    FROM (SELECT "id", "spare_part_id" FROM "reorder_rules"
          WHERE "tenant_id" IS NULL ORDER BY "id" LIMIT 10) premieres;

  IF locataire_choisi IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM "tenants" WHERE "id" = locataire_choisi) THEN
      RAISE EXCEPTION
        'maintrix.locataire_regles_orphelines = % ne correspond a aucun locataire existant.',
        locataire_choisi
        USING HINT = 'Verifiez l''identifiant : SELECT id, name FROM tenants;';
    END IF;
    UPDATE "reorder_rules" SET "tenant_id" = locataire_choisi WHERE "tenant_id" IS NULL;
    RAISE NOTICE
      '% regle(s) de reapprovisionnement sans piece ni fournisseur identifiable attribuee(s) a % sur decision explicite de l''exploitant.',
      restants, locataire_choisi;
    RETURN;
  END IF;

  RAISE EXCEPTION
    '% regle(s) de reapprovisionnement ne sont rattachables a aucun locataire : ni piece, ni fournisseur identifiable. Premieres : %.',
    restants, apercu
    USING HINT =
      'Une regle attribuee se met a commander pour le locataire choisi : cela ne se devine pas. Trois issues, au choix : '
      '(a) rattacher chaque regle a sa piece — UPDATE reorder_rules SET spare_part_id = <id> WHERE id = <id> — puis rejouer ; '
      '(b) attribuer le reliquat a un locataire NOMME, en rejouant ce fichier a la main : SET maintrix.locataire_regles_orphelines = ''<uuid>''; \i migrations/0024_reorder_rules_tenant_scoped.sql ; '
      '(c) desactiver ou supprimer ces regles si elles ne pilotent plus rien — decision d''exploitation, que cette migration ne prend pas a votre place.';
END
$maintrix$;
--> statement-breakpoint

ALTER TABLE "reorder_rules" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "reorder_rules" DROP CONSTRAINT IF EXISTS "reorder_rules_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
--> statement-breakpoint

-- Index sur le locataire : toutes les lectures filtrent désormais dessus, et la table est
-- parcourue à chaque passage du contrôle de stock.
CREATE INDEX IF NOT EXISTS "reorder_rules_tenant_id_idx" ON "reorder_rules" ("tenant_id");
