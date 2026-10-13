/**
 * Les grandeurs de fiabilité — une seule définition, une seule unité.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Maintrix portait TROIS définitions incompatibles du MTBF, dans deux unités,
 * dont deux fabriquaient une valeur quand les données manquaient :
 *
 *   • `gmao-report-kpi-service` : intervalle moyen entre déclenchements d'OT
 *     correctifs, en HEURES, `undefined` sous deux pannes. Correct et documenté.
 *
 *   • `gmao-storage` : `(30 × 24 × nombreÉquipements) / nombreCorrectifs`. Trois
 *     fautes dans une seule ligne. La période est supposée de 30 jours alors que
 *     l'appelant fournit `periodStart` et `periodEnd` — un rapport trimestriel
 *     était donc faux d'un facteur 3, un rapport annuel d'un facteur 12. Le
 *     temps retenu est le temps CALENDAIRE de tout le parc, équipements à
 *     l'arrêt ou réformés compris, et non leur temps de fonctionnement. Et sans
 *     aucun correctif, elle rendait `0` : un MTBF nul signifie « tombe en panne
 *     en permanence », exactement l'inverse de la réalité.
 *
 *   • `maintenance-recommendations` : intervalle moyen en JOURS, et surtout
 *     `return 365` sous deux pannes — un an inventé, qui alimentait ensuite le
 *     calcul de risque de défaillance et les recommandations faites aux
 *     équipes.
 *
 * Une grandeur de fiabilité fausse ne se voit jamais : elle décale des
 * échéances, change des priorités, et personne ne remonte au calcul.
 * Constaté le 2026-10-13.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CONVENTIONS RETENUES
 * ═══════════════════════════════════════════════════════════════════
 * Unité unique : l'HEURE. Les affichages convertissent, les calculs non.
 *
 * MTBF — Mean Time Between Failures : moyenne des intervalles entre
 * DÉCLENCHEMENTS consécutifs de pannes. Cette convention inclut le temps de
 * réparation, ce qui est l'usage courant pour un système réparable. Elle exige
 * au moins deux pannes datées : avec une seule, il n'existe aucun intervalle.
 *
 * MUT — Mean Up Time : moyenne des temps de BON FONCTIONNEMENT, de la fin d'une
 * réparation au déclenchement de la panne suivante. C'est le MTBF diminué du
 * temps de réparation. Les deux sont exposés séparément, car les confondre
 * surestime la fiabilité d'autant que les réparations sont longues.
 *
 * MTTR — Mean Time To Repair : durée moyenne des réparations effectivement
 * closes. Les interventions préventives en sont exclues : entretenir et réparer
 * ne se mesurent pas ensemble.
 *
 * `undefined` signifie « non calculable », JAMAIS zéro ni une valeur par
 * défaut. C'est à l'affichage de dire l'absence.
 */

/** Une panne datée : début constaté, et fin de réparation si elle est close. */
export interface EvenementPanne {
  /** Déclenchement de la panne. Sans cette date, l'événement est inutilisable. */
  debut: Date | string | null | undefined;
  /** Fin de la réparation. Absente tant que l'intervention n'est pas close. */
  fin?: Date | string | null;
}

const HEURE_MS = 3_600_000;

function enDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function moyenne(valeurs: number[]): number | undefined {
  if (!valeurs.length) return undefined;
  return valeurs.reduce((s, v) => s + v, 0) / valeurs.length;
}

/** Les pannes réellement datées, par ordre chronologique de déclenchement. */
export function pannesDatees(evenements: EvenementPanne[]): Array<{ debut: Date; fin: Date | null }> {
  return evenements
    .map((e) => ({ debut: enDate(e.debut), fin: enDate(e.fin ?? null) }))
    .filter((e): e is { debut: Date; fin: Date | null } => e.debut !== null)
    .sort((a, b) => a.debut.getTime() - b.debut.getTime());
}

/**
 * MTBF en heures — moyenne des intervalles entre déclenchements consécutifs.
 * `undefined` tant qu'il n'y a pas au moins deux pannes datées.
 */
export function mtbfHeures(evenements: EvenementPanne[]): number | undefined {
  const pannes = pannesDatees(evenements);
  if (pannes.length < 2) return undefined;

  const intervalles: number[] = [];
  for (let i = 1; i < pannes.length; i += 1) {
    intervalles.push((pannes[i].debut.getTime() - pannes[i - 1].debut.getTime()) / HEURE_MS);
  }
  return moyenne(intervalles);
}

/**
 * MUT en heures — moyenne des temps de bon fonctionnement, fin de réparation →
 * panne suivante. Exige des réparations closes : une panne dont on ignore la
 * fin ne borne aucun temps de marche.
 *
 * Un intervalle négatif signale un chevauchement (la panne suivante a commencé
 * avant la fin de la réparation précédente). Il est écarté plutôt que de tirer
 * la moyenne vers le bas : deux pannes simultanées sur des organes différents
 * ne raccourcissent pas le temps de marche.
 */
export function mutHeures(evenements: EvenementPanne[]): number | undefined {
  const pannes = pannesDatees(evenements);
  if (pannes.length < 2) return undefined;

  const marches: number[] = [];
  for (let i = 1; i < pannes.length; i += 1) {
    const finPrecedente = pannes[i - 1].fin;
    if (!finPrecedente) continue;
    const heures = (pannes[i].debut.getTime() - finPrecedente.getTime()) / HEURE_MS;
    if (heures >= 0) marches.push(heures);
  }
  return moyenne(marches);
}

/**
 * MTTR en heures — durée moyenne des réparations closes.
 * Seules les pannes dont le début ET la fin sont connus comptent.
 */
export function mttrHeures(evenements: EvenementPanne[]): number | undefined {
  const durees = pannesDatees(evenements)
    .filter((p) => p.fin !== null)
    .map((p) => (p.fin!.getTime() - p.debut.getTime()) / HEURE_MS)
    .filter((h) => h >= 0);
  return moyenne(durees);
}

/**
 * Disponibilité intrinsèque, en pourcentage : MTBF / (MTBF + MTTR).
 *
 * ⚠️ Ce n'est PAS la disponibilité opérationnelle, qui tiendrait compte des
 * attentes de pièces, de main-d'œuvre et des arrêts planifiés. Elle ne se
 * calcule que si les deux grandeurs existent ; sinon elle n'existe pas.
 */
export function disponibiliteIntrinseque(evenements: EvenementPanne[]): number | undefined {
  const mut = mutHeures(evenements);
  const mttr = mttrHeures(evenements);
  if (mut === undefined || mttr === undefined) return undefined;
  const total = mut + mttr;
  if (total <= 0) return undefined;
  return (mut / total) * 100;
}

/** Conversion d'affichage. `undefined` traverse sans devenir un nombre. */
export function enJours(heures: number | undefined): number | undefined {
  return heures === undefined ? undefined : heures / 24;
}

/** Arrondi d'affichage, qui préserve l'absence. */
export function arrondir(valeur: number | undefined, decimales = 1): number | undefined {
  if (valeur === undefined) return undefined;
  const f = 10 ** decimales;
  return Math.round(valeur * f) / f;
}
