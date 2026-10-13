/**
 * Point de commande et stock de sécurité.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Maintrix stockait un `reorderPoint` et un `minStock` par référence, et
 * alertait sur eux — mais ne les CALCULAIT nulle part. Ils étaient saisis à la
 * main ou importés, sans lien avec la consommation réelle ni avec le délai
 * d'approvisionnement, alors que `stock_movements` enregistre chaque sortie et
 * que `lead_time` figure sur chaque référence.
 *
 * Trois conséquences, constatées le 2026-10-13 :
 *
 * 1. Le `leadTime` n'intervenait QUE pour estimer une date de livraison. Il
 *    n'entrait dans aucun seuil, alors que c'est lui qui détermine à partir de
 *    quel niveau il faut commander : une pièce livrée en huit semaines doit
 *    être commandée bien plus tôt qu'une pièce disponible le lendemain.
 *
 * 2. L'import des données confond `SafetyStock` et `minStock` — deux notions
 *    distinctes. Le stock de sécurité couvre la VARIABILITÉ de la consommation
 *    pendant le délai ; le stock minimum est un plancher d'exploitation. Les
 *    confondre fait disparaître la notion de risque de rupture.
 *
 * 3. Deux écrans alertaient sur deux seuils différents — l'un sur `minStock`,
 *    l'autre sur `reorderPoint` — et affichaient donc deux nombres différents
 *    d'« alertes stock » pour le même magasin.
 *
 * ═══════════════════════════════════════════════════════════════════
 * LA FORMULE
 * ═══════════════════════════════════════════════════════════════════
 *     Point de commande = consommation moyenne pendant le délai
 *                       + stock de sécurité
 *
 *     Stock de sécurité = z × écart-type de la consommation sur le délai
 *
 * `z` est le quantile normal correspondant au taux de service visé : 1,65 pour
 * 95 %, 2,33 pour 99 %. L'hypothèse de normalité est une approximation
 * courante, acceptable quand les sorties sont nombreuses et régulières ; elle
 * l'est beaucoup moins pour une pièce sortie trois fois par an. D'où le seuil
 * minimal d'observations ci-dessous, sous lequel aucune suggestion n'est faite.
 */

/** Quantiles de la loi normale, pour les taux de service usuels. */
export const Z_PAR_TAUX_DE_SERVICE: Record<number, number> = {
  90: 1.28,
  95: 1.65,
  98: 2.05,
  99: 2.33,
};

/**
 * Nombre minimal de sorties exigé avant de suggérer un seuil.
 *
 * En dessous, l'écart-type n'a aucun sens statistique et la suggestion serait
 * une opinion déguisée en calcul.
 */
export const SORTIES_MINIMALES = 6;

export interface SortieStock {
  /** Date de la sortie. */
  date: Date | string;
  /** Quantité sortie, positive. */
  quantite: number;
}

export interface SuggestionReapprovisionnement {
  /** Consommation moyenne par jour, sur la période observée. */
  consommationJournaliere: number;
  /** Écart-type de la consommation journalière. */
  ecartTypeJournalier: number;
  /** Stock de sécurité, arrondi à l'unité supérieure. */
  stockDeSecurite: number;
  /** Point de commande suggéré, arrondi à l'unité supérieure. */
  pointDeCommande: number;
  /** Sur quoi repose le calcul — à afficher, jamais à taire. */
  base: {
    sortiesObservees: number;
    joursObserves: number;
    delaiJours: number;
    tauxDeService: number;
  };
}

/**
 * Suggère un point de commande à partir des sorties réellement enregistrées.
 *
 * Renvoie `undefined` — et non une valeur par défaut — quand les données sont
 * insuffisantes. Un seuil inventé provoque soit une rupture, soit une
 * immobilisation de trésorerie, et dans les deux cas personne ne remonte au
 * calcul.
 */
export function suggererPointDeCommande(
  sorties: SortieStock[],
  delaiJours: number,
  tauxDeService = 95,
): SuggestionReapprovisionnement | undefined {
  if (!Number.isFinite(delaiJours) || delaiJours <= 0) return undefined;

  const evenements = sorties
    .map((s) => ({ date: s.date instanceof Date ? s.date : new Date(s.date), quantite: Number(s.quantite) }))
    .filter((s) => !Number.isNaN(s.date.getTime()) && Number.isFinite(s.quantite) && s.quantite > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (evenements.length < SORTIES_MINIMALES) return undefined;

  const premier = evenements[0].date.getTime();
  const dernier = evenements[evenements.length - 1].date.getTime();
  const joursObserves = Math.max(1, (dernier - premier) / 86_400_000);

  // Consommation journalière moyenne sur la période réellement observée.
  const total = evenements.reduce((s, e) => s + e.quantite, 0);
  const consommationJournaliere = total / joursObserves;

  // Écart-type des quantités journalières. On agrège par jour : deux sorties
  // le même jour constituent une seule journée de consommation.
  const parJour = new Map<string, number>();
  for (const e of evenements) {
    const cle = e.date.toISOString().slice(0, 10);
    parJour.set(cle, (parJour.get(cle) ?? 0) + e.quantite);
  }
  // Les journées SANS sortie comptent : les ignorer surestimerait la
  // consommation moyenne et sous-estimerait sa variabilité.
  const sequence: number[] = [];
  for (let j = 0; j < Math.round(joursObserves); j += 1) {
    const d = new Date(premier + j * 86_400_000).toISOString().slice(0, 10);
    sequence.push(parJour.get(d) ?? 0);
  }
  const moyenne = sequence.reduce((s, v) => s + v, 0) / sequence.length;
  const variance = sequence.reduce((s, v) => s + (v - moyenne) ** 2, 0) / sequence.length;
  const ecartTypeJournalier = Math.sqrt(variance);

  const z = Z_PAR_TAUX_DE_SERVICE[tauxDeService] ?? Z_PAR_TAUX_DE_SERVICE[95];

  // La variance s'additionne sur la durée du délai : l'écart-type croît en
  // racine du délai, et non proportionnellement.
  const stockDeSecurite = Math.ceil(z * ecartTypeJournalier * Math.sqrt(delaiJours));
  const pointDeCommande = Math.ceil(moyenne * delaiJours) + stockDeSecurite;

  return {
    consommationJournaliere: Math.round(moyenne * 1000) / 1000,
    ecartTypeJournalier: Math.round(ecartTypeJournalier * 1000) / 1000,
    stockDeSecurite,
    pointDeCommande,
    base: {
      sortiesObservees: evenements.length,
      joursObserves: Math.round(joursObserves),
      delaiJours,
      tauxDeService,
    },
  };
}

/** L'état d'une référence vis-à-vis de ses seuils. */
export type EtatStock = 'rupture' | 'sous_minimum' | 'a_commander' | 'normal';

/**
 * Qualifie une référence. Les trois états sont DISTINCTS et ne doivent pas
 * être fondus dans une seule « alerte stock » : une rupture arrête une
 * intervention, un passage sous le point de commande demande seulement de
 * passer commande.
 */
export function etatDuStock(
  stockActuel: number,
  pointDeCommande: number | null | undefined,
  stockMinimum: number | null | undefined,
): EtatStock {
  if (stockActuel <= 0) return 'rupture';
  if (stockMinimum != null && stockActuel <= stockMinimum) return 'sous_minimum';
  if (pointDeCommande != null && stockActuel <= pointDeCommande) return 'a_commander';
  return 'normal';
}
