import { auMoins, type RoleLocataire } from "./roles";

/**
 * Le niveau exigé pour INSCRIRE un équipement au référentiel du parc.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI UN SEUIL, ET POURQUOI CELUI-LÀ
 * ═══════════════════════════════════════════════════════════════════
 * En posant la restriction de l'import en masse, l'écart suivant avait été
 * assumé et documenté : « la restriction porte sur le VOLUME et son
 * irréversibilité, pas sur le geste — un technicien peut toujours créer un
 * équipement, un par un ». Cet écart est fermé sur décision de l'utilisateur.
 *
 * La raison tient à un fait vérifié, pas supposé : **il n'existe AUCUNE route
 * de suppression d'équipement.** Ni `DELETE /api/equipment/:id`, ni
 * `deleteEquipment` dans le stockage, ni suppression dans `equipment_registry`.
 * Un équipement inscrit par erreur est donc **définitif** du point de vue de
 * l'API — et il est immédiatement référencé par les ordres de travail, les
 * plans préventifs, les compteurs d'usage et les relevés de capteurs.
 *
 * L'argument est donc PLUS FORT que pour l'import, et non plus faible :
 * l'import n'a pas d'annulation en masse, la création unitaire n'a aucune
 * annulation du tout.
 *
 * Le seuil est le même que celui de l'import en masse — `maintenance_manager`
 * (4) — et ce n'est pas une coïncidence : c'est le même acte, inscrire au
 * référentiel, à des volumes différents. Deux seuils distincts auraient produit
 * l'absurdité de rendre l'ajout d'une machine plus difficile que celui de cent.
 *
 * Il reste SOUS `technical_director` (5), que ce dépôt réserve aux actes
 * destructeurs : un responsable maintenance doit pouvoir inscrire une machine
 * qui arrive dans l'atelier sans dépendre du directeur technique.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI UNE CONSTANTE DISTINCTE DE CELLE DE L'IMPORT
 * ═══════════════════════════════════════════════════════════════════
 * Les deux valent `maintenance_manager` aujourd'hui, mais ce sont DEUX
 * décisions : « qui peut charger un fichier » et « qui peut inscrire une
 * machine ». Les confondre dans une seule constante ferait qu'abaisser l'une
 * abaisserait l'autre en silence. Elles sont donc nommées séparément, et ce
 * commentaire dit qu'elles sont égales et pourquoi.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI DANS `shared/`
 * ═══════════════════════════════════════════════════════════════════
 * Le serveur refuse, l'interface explique. Deux copies du seuil pouvaient se
 * désaccorder sans que rien ne le signale : un bouton offert à quelqu'un que le
 * serveur refuse, ou masqué à quelqu'un qui en a le droit.
 */
export const NIVEAU_CREATION_EQUIPEMENT: RoleLocataire = "maintenance_manager";

/**
 * Vrai si ce rôle peut inscrire un équipement au référentiel.
 *
 * Passe par `auMoins`, donc normalise les orthographes présentes en base
 * (`responsable_maintenance`…) et raisonne par niveau : `admin` (6) et `owner`
 * (7) sont au-dessus sans être nommés. Un rôle inconnu, ou l'absence de rôle,
 * donne faux — le contrôle échoue fermé.
 */
export function peutCreerEquipement(role: unknown): boolean {
  return auMoins(role, NIVEAU_CREATION_EQUIPEMENT);
}
