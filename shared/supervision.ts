/**
 * Évaluation de l'état d'un capteur — par rapport à SON PROPRE historique.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * `server/equipment-health-routes.ts` jugeait tous les capteurs de toutes les
 * installations contre quatre constantes universelles :
 *
 *     temperature: 75    vibration: 4.5    pressure: 4.0    current: 10
 *
 * Ces nombres n'ont de sens pour aucune installation en particulier. Une
 * chaudière vapeur travaille à 9 bar, une presse hydraulique à 185 bar, un
 * moteur de 75 kW tire 130 A. Le score de santé retranchait jusqu'à 45 points
 * pour la pression et 30 pour le courant : toute usine réelle était donc
 * « critique » en permanence, non pas à cause de son état, mais à cause de
 * l'échelle des unités de ses capteurs.
 *
 * C'est le mécanisme bien connu du noyage d'alarmes : des seuils faux
 * produisent des alarmes permanentes, les opérateurs apprennent à les ignorer,
 * et la vraie alarme passe inaperçue au milieu du bruit. Une supervision qui
 * crie tout le temps est pire qu'une supervision muette, parce qu'elle inspire
 * une vigilance qu'elle ne mérite pas.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QU'ON FAIT À LA PLACE
 * ═══════════════════════════════════════════════════════════════════
 * La table `sensor_thresholds` existe pour porter des seuils réglés par
 * ingénieur, par machine. Elle est aujourd'hui MORTE : rattachée à
 * `iot_devices`, que rien ne remplit, et sans lien vers l'équipement, alors que
 * les relevés, eux, sont rattachés à l'équipement. Les deux moitiés du modèle
 * ne se raccordent pas. Tant que ce n'est pas repris, aucun seuil absolu n'est
 * disponible, et en inventer un serait répéter la faute.
 *
 * On juge donc chaque capteur contre lui-même, par maîtrise statistique du
 * procédé (carte de Shewhart) : on établit une référence sur la partie ancienne
 * de l'historique, on compare la partie récente à cette référence, et on
 * exprime l'écart en nombre d'écarts-types.
 *
 *     |z| ≥ 3  →  anomalie      (0,3 % de chances d'être du bruit)
 *     |z| ≥ 2  →  surveillance  (4,6 %)
 *
 * Deux propriétés importantes :
 *
 *   • aucun paramétrage n'est nécessaire — la machine fournit sa propre
 *     référence, quelle que soit l'unité et quel que soit son régime normal ;
 *   • la référence est construite sur la partie ANCIENNE de la série, jamais
 *     sur la totalité. Une dégradation lente qui entrerait dans sa propre
 *     référence s'y dissoudrait et deviendrait invisible — exactement le
 *     défaut qu'on cherche à détecter.
 *
 * Ce que cette méthode ne fait PAS, et qu'il faut savoir : elle détecte un
 * CHANGEMENT, pas un dépassement. Une machine mauvaise depuis toujours sera
 * jugée « normale », parce que son mauvais état est sa référence. Seuls des
 * seuils réglés par un ingénieur répondent à cette question-là. D'où la
 * nécessité de rétablir `sensor_thresholds`, dont ce module est le palliatif
 * honnête, pas le remplaçant.
 */

/** Un relevé de capteur, horodaté. */
export interface ReleveCapteur {
  valeur: number;
  horodatage: Date | string;
}

/**
 * Nombre de relevés en dessous duquel aucune référence n'est calculable.
 *
 * Il faut assez de points pour que l'écart-type ait un sens : en dessous, la
 * dispersion observée est du hasard, et comparer à cette dispersion revient à
 * tirer au sort l'état de la machine.
 */
export const POINTS_MINIMUM = 12;

/** Part de l'historique consacrée à la référence (la plus ancienne). */
const PART_REFERENCE = 2 / 3;

/** Seuils d'écart réduit, en nombre d'écarts-types. */
export const Z_SURVEILLANCE = 2;
export const Z_ANOMALIE = 3;

export type EtatCapteur = 'normal' | 'surveillance' | 'anomalie' | 'non_evalue';

export interface EvaluationCapteur {
  typeCapteur: string;
  /** Unité telle qu'ENREGISTRÉE avec le relevé, jamais devinée d'après le type. */
  unite?: string;
  /** Dernière valeur mesurée. `undefined` si aucun relevé. */
  valeurCourante?: number;
  /** Référence établie sur la partie ancienne de l'historique. */
  reference?: { moyenne: number; ecartType: number; points: number };
  /** Moyenne de la partie récente, comparée à la référence. */
  moyenneRecente?: number;
  /** Écart réduit : de combien d'écarts-types la période récente s'écarte. */
  ecartReduit?: number;
  etat: EtatCapteur;
  /** Pourquoi l'état vaut `non_evalue`. À afficher, jamais à taire. */
  motif?: string;
}

function moyenne(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function ecartType(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  // Estimateur non biaisé (n−1) : avec peu de points, diviser par n
  // sous-estime la dispersion et déclenche des alarmes pour du bruit.
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

/**
 * Évalue un capteur à partir de ses relevés.
 *
 * Renvoie toujours un objet : l'état `non_evalue` assorti d'un motif vaut
 * mieux qu'une absence de réponse, parce que l'interface doit pouvoir dire
 * POURQUOI elle ne sait pas.
 */
export function evaluerCapteur(
  typeCapteur: string,
  releves: ReleveCapteur[],
  unite?: string,
): EvaluationCapteur {
  const points = releves
    .map((r) => ({
      valeur: Number(r.valeur),
      t: r.horodatage instanceof Date ? r.horodatage.getTime() : new Date(r.horodatage).getTime(),
    }))
    .filter((p) => Number.isFinite(p.valeur) && Number.isFinite(p.t))
    // Ordre chronologique : la référence est le PASSÉ, l'évaluation le présent.
    // Les relevés arrivent du stockage en ordre décroissant ; s'y fier serait
    // inverser référence et évaluation, donc comparer le passé au futur.
    .sort((a, b) => a.t - b.t);

  if (points.length === 0) {
    return { typeCapteur, unite, etat: 'non_evalue', motif: 'aucun relevé' };
  }

  const valeurCourante = points[points.length - 1].valeur;

  if (points.length < POINTS_MINIMUM) {
    return {
      typeCapteur,
      unite,
      valeurCourante,
      etat: 'non_evalue',
      motif: `${points.length} relevé${points.length > 1 ? 's' : ''} sur les ${POINTS_MINIMUM} nécessaires`,
    };
  }

  const coupure = Math.floor(points.length * PART_REFERENCE);
  const reference = points.slice(0, coupure).map((p) => p.valeur);
  const recent = points.slice(coupure).map((p) => p.valeur);

  const mRef = moyenne(reference);
  const sRef = ecartType(reference, mRef);
  const mRec = moyenne(recent);

  // Plancher RELATIF sur l'écart-type, jamais absolu.
  //
  // Un capteur très stable a un écart-type proche de zéro ; diviser par lui
  // ferait exploser l'écart réduit et déclencherait une anomalie sur une
  // variation insignifiante. Un plancher absolu, lui, dépendrait de l'unité :
  // 0,1 est énorme pour une vibration et négligeable pour une pression en bar.
  // On prend donc 1 % de l'échelle de la grandeur elle-même — même raisonnement
  // que la régularisation de l'IMCA.
  const plancher = Math.max(Math.abs(mRef) * 0.01, Number.EPSILON);
  const sigma = Math.max(sRef, plancher);

  const ecartReduit = (mRec - mRef) / sigma;
  const amplitude = Math.abs(ecartReduit);

  let etat: EtatCapteur = 'normal';
  if (amplitude >= Z_ANOMALIE) etat = 'anomalie';
  else if (amplitude >= Z_SURVEILLANCE) etat = 'surveillance';

  return {
    typeCapteur,
    unite,
    valeurCourante,
    reference: { moyenne: mRef, ecartType: sRef, points: reference.length },
    moyenneRecente: mRec,
    ecartReduit,
    etat,
  };
}

/**
 * Score de santé d'un équipement, de 0 à 100.
 *
 * `undefined` — et NON 85 — quand aucun capteur n'est évaluable. Le code
 * précédent renvoyait 85 en l'absence totale de données : une machine qu'on ne
 * surveille pas était donc présentée comme saine à 85 %, ce qui est
 * exactement l'inverse de ce qu'il faut dire à un exploitant.
 */
export function scoreDeSante(evaluations: EvaluationCapteur[]): number | undefined {
  const evaluables = evaluations.filter((e) => e.etat !== 'non_evalue' && e.ecartReduit !== undefined);
  if (evaluables.length === 0) return undefined;

  // Pénalité par capteur : nulle tant qu'on reste sous le seuil de
  // surveillance, puis croissante, plafonnée pour qu'un seul capteur affolé
  // n'écrase pas à lui seul le diagnostic de toute la machine.
  const penalite = (z: number) => Math.min(40, Math.max(0, Math.abs(z) - Z_SURVEILLANCE) * 20);

  const total = evaluables.reduce((s, e) => s + penalite(e.ecartReduit!), 0);
  return Math.max(0, Math.min(100, Math.round(100 - total)));
}

/**
 * État global d'un équipement, déduit de ses capteurs.
 *
 * `non_evalue` est un état à part entière : il se distingue de `normal`, et
 * l'interface doit les montrer différemment. Confondre « tout va bien » et
 * « je ne sais pas » est la racine de la plupart des fabrications corrigées
 * dans cette plateforme.
 */
export function etatEquipement(
  evaluations: EvaluationCapteur[],
): 'sain' | 'surveillance' | 'anomalie' | 'non_evalue' {
  if (evaluations.some((e) => e.etat === 'anomalie')) return 'anomalie';
  if (evaluations.some((e) => e.etat === 'surveillance')) return 'surveillance';
  if (evaluations.some((e) => e.etat === 'normal')) return 'sain';
  return 'non_evalue';
}
