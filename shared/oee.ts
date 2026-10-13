/**
 * OEE = Disponibilité × Performance × Qualité.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI CLOCHAIT
 * ═══════════════════════════════════════════════════════════════════
 * Le produit des trois facteurs était juste. Leurs définitions, moins.
 *
 * 1. QUALITÉ À 100 % SANS PRODUCTION. `actualProd > 0 ? … : 1` donnait un taux
 *    de qualité parfait à une ligne qui n'avait rien produit. Aucune pièce
 *    produite, donc aucune pièce conforme : le taux n'existe pas, il ne vaut
 *    pas 100 %. Et comme il multiplie les deux autres facteurs, il gonflait
 *    l'OEE d'une journée sans production.
 *
 * 2. DISPONIBILITÉ À 0 SANS TEMPS PLANIFIÉ. Une saisie incomplète donnait 0,
 *    soit « jamais disponible », au lieu de « non calculable ».
 *
 * 3. LA PERTE DE CADENCE ÉTAIT COLLECTÉE MAIS JAMAIS UTILISÉE. Elle
 *    n'apparaissait que dans une condition qui choisissait entre DEUX
 *    définitions différentes de la performance — l'une proratisée sur le temps
 *    de marche, l'autre non. Deux saisies voisines pouvaient donc être
 *    mesurées différemment. Une seule définition subsiste, et l'on dit
 *    franchement que cette donnée n'entre pas dans le calcul.
 *
 * 4. PERFORMANCE PLAFONNÉE À 1. Une cadence supérieure au nominal est possible,
 *    et surtout elle RÉVÈLE une cadence de référence mal réglée. L'écraser
 *    silencieusement supprime le signal.
 *
 * Constaté le 2026-10-13. `undefined` signifie « non calculable », jamais zéro.
 */

export interface ResultatOEE {
  availability: number | undefined;
  performance: number | undefined;
  quality: number | undefined;
  oee: number | undefined;
  /** Ce que le calcul n'a pas pu faire, et pourquoi. */
  reserves: string[];
}

export interface SaisieOEE {
  /** Temps planifié de production, en minutes. */
  planned: number;
  /** Temps d'arrêt subi, en minutes. */
  downtime: number;
  /** Perte de cadence déclarée, en minutes. N'entre pas dans le calcul. */
  speedLoss: number;
  /** Pièces réellement produites, REBUTS INCLUS. */
  actualProd: number;
  /** Production attendue sur le temps planifié. */
  plannedProd: number;
  /** Pièces non conformes parmi celles produites. */
  defects: number;
}

const arrondi4 = (v: number | undefined) =>
  (v === undefined ? undefined : Math.round(v * 10000) / 10000);

export function calculerOEE(saisie: SaisieOEE): ResultatOEE {
  const { planned, downtime, speedLoss, actualProd, plannedProd, defects } = saisie;

  const operatingTime = planned - downtime;
  const availability = planned > 0 ? operatingTime / planned : undefined;

  // Production attendue pendant le temps de marche réel.
  const attendu = planned > 0 && plannedProd > 0
    ? plannedProd * (operatingTime / planned)
    : undefined;
  const performance = attendu !== undefined && attendu > 0 ? actualProd / attendu : undefined;

  const quality = actualProd > 0
    ? Math.max((actualProd - defects) / actualProd, 0)
    : undefined;

  const calculable = availability !== undefined && performance !== undefined && quality !== undefined;
  const oee = calculable ? availability! * performance! * quality! : undefined;

  const reserves: string[] = [];
  if (availability === undefined) reserves.push('temps planifié absent ou nul');
  if (performance === undefined) reserves.push('production planifiée absente ou nulle');
  if (quality === undefined) reserves.push("aucune pièce produite : le taux de qualité n'existe pas");
  if (performance !== undefined && performance > 1) {
    reserves.push(
      `performance mesurée à ${Math.round(performance * 100)} % : la cadence réelle dépasse `
      + 'la cadence de référence, qui est probablement sous-estimée',
    );
  }
  if (speedLoss > 0) {
    reserves.push(
      "la perte de cadence saisie n'entre pas dans ce calcul : la performance est "
      + 'déduite du rapport entre production réelle et production attendue',
    );
  }

  return {
    availability: arrondi4(availability),
    performance: arrondi4(performance),
    quality: arrondi4(quality),
    oee: arrondi4(oee),
    reserves,
  };
}
