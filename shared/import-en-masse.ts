import { auMoins, type RoleLocataire } from "./roles";

/**
 * Le niveau exigé pour CHARGER un fichier dans le parc.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI UN SEUIL, ET POURQUOI CELUI-LÀ
 * ═══════════════════════════════════════════════════════════════════
 * La création directe d'un ordre de travail vient d'être restreinte à
 * `team_leader` (voir docs/DEMANDES_INTERVENTION.md). Or DEUX chemins d'import
 * écrivent dans `work_orders` :
 *
 *   • `/api/data-import-export/import` avec `type=maintenance-history`
 *     (server/data-import-export.ts, `insert(workOrders)`) ;
 *   • `/api/import/user-historical-data` (server/excel-processor.ts,
 *     `gmaoStorage.createWorkOrder`).
 *
 * Les laisser ouverts à tous rendait cette restriction COSMÉTIQUE : il
 * suffisait d'un tableur pour fabriquer les ordres que le formulaire refusait.
 * Le plancher est donc `team_leader` — c'est une conséquence, pas un choix.
 *
 * Le seuil retenu est pourtant PLUS HAUT, à `maintenance_manager`, pour une
 * raison propre à l'import : il écrit en masse et **aucune annulation en masse
 * n'existe**. Chaque ligne créée (équipement, cas, gamme, ordre) doit ensuite
 * être supprimée une par une, et certaines suppressions sont réservées au
 * `technical_director`. Le dépôt portait déjà ce constat dans ses propres
 * tests : tests/integration/csrf.test.ts qualifie cet import d'« écriture
 * volumineuse et difficilement réversible ».
 *
 * Le seuil reste SOUS `technical_director` (5), que ce dépôt réserve aux actes
 * destructeurs (supprimer un équipement, un plan, un compteur). Un import
 * n'efface rien : il ajoute. Le placer au-dessus de la suppression aurait été
 * incohérent.
 *
 * `maintenance_manager` (4) laisse donc dehors `technician` (1),
 * `team_leader` (2) et `procurement` (3) — et les tests d'intégration vérifient
 * les trois, pour que « au-dessus de team_leader » ne soit pas confondu avec
 * « au moins team_leader ».
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI DANS `shared/`
 * ═══════════════════════════════════════════════════════════════════
 * Le serveur refuse, l'interface explique. Si les deux côtés portaient chacun
 * leur copie du seuil, ils pouvaient se désaccorder sans que rien ne le
 * signale : un bouton offert à quelqu'un que le serveur refuse, ou masqué à
 * quelqu'un qui en a le droit. Une seule valeur, lue des deux côtés.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CE SEUIL N'EST PAS
 * ═══════════════════════════════════════════════════════════════════
 * Ce n'est pas une interdiction de créer des données : `POST /api/equipment`
 * n'a aucune garde de rôle, donc un technicien peut toujours créer un
 * équipement — un par un. La restriction porte sur le VOLUME et son
 * irréversibilité, pas sur le geste. Cet écart est assumé et documenté
 * (docs/IMPORT_EN_MASSE.md) ; le refermer demanderait une décision de politique
 * sur la création unitaire, qui n'a pas été prise.
 */
export const NIVEAU_IMPORT_MASSE: RoleLocataire = "maintenance_manager";

/**
 * Vrai si ce rôle peut charger un fichier.
 *
 * Passe par `auMoins`, donc normalise les orthographes présentes en base
 * (`responsable_maintenance`, `directeur_technique`…) et raisonne par niveau :
 * `admin` (6) et `owner` (7) sont au-dessus sans être nommés. Un rôle inconnu,
 * ou l'absence de rôle, donne faux — le contrôle échoue fermé.
 */
export function peutImporterEnMasse(role: unknown): boolean {
  return auMoins(role, NIVEAU_IMPORT_MASSE);
}

/**
 * Ce qui reste permis sans le niveau, nommé pour que le refus soit utile.
 *
 * `POST /api/data-import-export/validate` N'ÉCRIT RIEN : il compte les lignes
 * et signale les erreurs de format. Préparer et vérifier le fichier reste donc
 * le travail de celui qui connaît le parc ; seul le CHARGEMENT demande le
 * niveau. Un refus qui se contente d'interdire pousse à contourner ; un refus
 * qui désigne l'étape utile fait travailler.
 */
export const ROUTE_VALIDATION_SANS_ECRITURE = "/api/data-import-export/validate";
