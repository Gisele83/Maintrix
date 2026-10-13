/**
 * Pronostic de défaillance — passer d'un taux à une probabilité.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Le moteur prédictif écrivait :
 *
 *     const baseProbability = pattern.frequency / 10;
 *     // Convert annual frequency to probability
 *
 * Ce n'est pas une conversion. Diviser un taux annuel (2,5 défaillances par an)
 * par 10 donne 0,25, et le commentaire affirme qu'il s'agit d'une probabilité.
 * Le choix de 10 ne repose sur rien, et le résultat ne dépend d'aucun horizon :
 * la « probabilité » était la même à 7 jours qu'à 6 mois.
 *
 * Conséquence directe : pour un roulement moteur de taux 2,5/an, la probabilité
 * de base valait 0,25, soit AU-DESSUS du seuil de 0,2 au-delà duquel une
 * prédiction était émise. Un équipement ne présentant AUCUN symptôme déclenchait
 * donc une alerte, assortie d'une échéance de rupture à dix jours. Un système
 * qui crie au loup sur du matériel sain est abandonné en trois semaines, et
 * c'est l'alerte juste qu'on cesse alors de croire.
 *
 * Constaté le 2026-10-13.
 *
 * ═══════════════════════════════════════════════════════════════════
 * LA LOI RETENUE
 * ═══════════════════════════════════════════════════════════════════
 * Processus de Poisson homogène : pour un taux λ de défaillances par an et un
 * horizon t exprimé en années, la probabilité d'au moins une défaillance vaut
 *
 *     P = 1 − exp(−λ·t)
 *
 * Hypothèse assumée : taux constant dans le temps, c'est-à-dire la partie plate
 * de la courbe en baignoire. Elle ne vaut ni en période de rodage, ni en fin de
 * vie par usure — où une loi de Weibull serait nécessaire. Cette limite est
 * énoncée ici plutôt que dissimulée dans une division.
 */

/** Jours dans une année, pour les conversions d'horizon. */
const JOURS_PAR_AN = 365.25;

/**
 * Probabilité d'au moins une défaillance sur l'horizon donné.
 *
 * @param tauxAnnuel λ — nombre moyen de défaillances par an. Doit être positif.
 * @param horizonJours durée d'observation, en jours.
 * @returns probabilité dans [0, 1), ou `undefined` si les entrées n'ont pas de sens.
 */
export function probabiliteDefaillance(
  tauxAnnuel: number | undefined,
  horizonJours: number,
): number | undefined {
  if (tauxAnnuel === undefined || !Number.isFinite(tauxAnnuel) || tauxAnnuel <= 0) return undefined;
  if (!Number.isFinite(horizonJours) || horizonJours <= 0) return undefined;

  const t = horizonJours / JOURS_PAR_AN;
  return 1 - Math.exp(-tauxAnnuel * t);
}

/**
 * Combine une probabilité de base (ce que l'on sait du parc en général) avec
 * l'évidence relevée sur CETTE machine (la proportion de symptômes présents).
 *
 * ⚠️ L'ancienne formule additionnait : `base + ratio × 0,6`. Une somme de
 * probabilités n'est pas une probabilité — elle pouvait dépasser 1, d'où le
 * plafonnement arbitraire à 0,95 qui masquait le défaut.
 *
 * On emploie une mise à jour par cotes (odds), qui reste dans [0, 1) par
 * construction : chaque symptôme présent multiplie la cote par un facteur de
 * vraisemblance. C'est la forme la plus simple qui soit défendable, et elle se
 * ramène à une règle de Bayes à symptômes indépendants — indépendance qui est
 * une approximation, et qui doit être dite.
 *
 * @param base probabilité a priori, issue du taux de défaillance.
 * @param ratioSymptomes proportion de symptômes observés, dans [0, 1].
 * @param forceSymptome facteur de vraisemblance à ratio plein. 9 signifie
 *   qu'une machine présentant tous les symptômes est neuf fois plus
 *   susceptible d'être en défaillance qu'une machine quelconque.
 */
export function combinerAvecSymptomes(
  base: number,
  ratioSymptomes: number,
  forceSymptome = 9,
): number {
  if (base <= 0) return 0;
  if (base >= 1) return 1;
  if (ratioSymptomes <= 0) return base;

  const cotes = base / (1 - base);
  // Le facteur croît continûment de 1 (aucun symptôme) à `forceSymptome`.
  const facteur = forceSymptome ** Math.min(Math.max(ratioSymptomes, 0), 1);
  const cotesApres = cotes * facteur;
  return cotesApres / (1 + cotesApres);
}

/**
 * Temps restant estimé avant défaillance, en jours.
 *
 * ⚠️ L'ancienne formule valait `leadTime × (1 − probabilité)`, ce qui mêlait
 * une durée de développement à une probabilité. Elle annonçait une rupture à
 * dix jours pour une machine sans aucun symptôme, du seul fait de sa
 * probabilité de base.
 *
 * `delaiDeveloppement` est le temps que met le mode de défaillance à passer des
 * PREMIERS symptômes à la rupture. Le temps restant se déduit donc de
 * l'avancement des symptômes, et non de la probabilité : à mi-parcours des
 * symptômes, il reste la moitié du délai.
 *
 * `undefined` tant qu'aucun symptôme n'est observé : sans premier signe, rien
 * n'a commencé, et aucune échéance ne peut être annoncée.
 */
export function joursAvantDefaillance(
  delaiDeveloppementJours: number,
  ratioSymptomes: number,
): number | undefined {
  if (ratioSymptomes <= 0) return undefined;
  if (!Number.isFinite(delaiDeveloppementJours) || delaiDeveloppementJours <= 0) return undefined;
  const restant = delaiDeveloppementJours * (1 - Math.min(ratioSymptomes, 1));
  return Math.max(0, Math.round(restant));
}
