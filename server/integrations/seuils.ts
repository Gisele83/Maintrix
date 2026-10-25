/**
 * Seuils de capteurs : le type, les valeurs, et la décision.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER EST SÉPARÉ DU CONNECTEUR
 * ═══════════════════════════════════════════════════════════════════
 * Cette règle tenait en trois lignes dans une méthode privée de
 * `iot-connector.ts`, et la configuration vivait en ligne dans
 * `server/routes.ts`. Deux conséquences, qui se sont toutes deux réalisées :
 *
 *   • personne ne pouvait les éprouver. `iot-connector.ts` importe
 *     `gmaoStorage`, donc `server/db`, qui exige `DATABASE_URL` au
 *     chargement : tester une comparaison de nombres y demandait une base de
 *     données. Un test qu'il faut provisionner n'est pas écrit ;
 *   • la configuration et la comparaison se contredisaient sans que rien ne
 *     le signale. Les seuils de pression déclaraient une CHUTE — alerte à
 *     5,5 bar, critique à 4,0 — pendant que la comparaison ne savait tester
 *     qu'un dépassement vers le haut, et évaluait le critique en premier.
 *     Toute pression normale franchissait 4,0 : alerte critique à chaque
 *     relevé, en continu, pendant des semaines.
 *
 * Ce fichier n'importe rien. C'est sa seule qualité, et elle suffit : la
 * règle et sa configuration deviennent mesurables sans infrastructure.
 */

export interface SensorThreshold {
  sensorType: string;
  warningThreshold: number;
  criticalThreshold: number;
  unit: string;
  /**
   * De quel côté le seuil est-il franchi ?
   *
   * `au-dessus` par défaut — le cas de la température, du courant et de la
   * vibration, où c'est la montée qui inquiète.
   *
   * `au-dessous` pour les grandeurs dont la panne est la CHUTE : la pression
   * d'un circuit hydraulique, le débit d'une pompe, le niveau d'un bac. Le
   * seuil critique y est alors plus BAS que le seuil d'alerte, ce qui se lit
   * mal si l'on n'a pas le sens sous les yeux — d'où ce champ, plutôt qu'une
   * convention tacite.
   */
  sens?: 'au-dessus' | 'au-dessous';
}

/**
 * Valeurs nominales du simulateur de relevés.
 *
 * Exportées pour être CONFRONTÉES aux seuils par un test : une valeur
 * nominale posée dans une bande d'alarme produit un flot d'alertes dénuées
 * de sens. C'est arrivé à la vibration, dont le nominal valait exactement le
 * seuil d'alerte — 4,5 mm/s — et basculait donc une fois sur deux sous
 * l'effet de la variation.
 */
export const VALEURS_NOMINALES: Record<string, number> = {
  temperature: 65,
  // 2,8 mm/s : frontière des zones A et B de l'ISO 10816, c'est-à-dire une
  // machine saine. L'ancienne valeur, 4,5, était la frontière B/C — le seuil
  // d'alerte lui-même.
  vibration: 2.8,
  // 7 bar : pression de service courante, et surtout assez loin de
  // l alerte basse (5,5) pour que la variation du simulateur ne vienne pas
  // la frôler. À 6,2, la borne basse tombait à 5,58 — huit centièmes
  // au-dessus du seuil. Cela ne déclenchait rien, mais le moindre
  // ajustement l aurait fait basculer, comme pour la vibration.
  pressure: 7.0,
  current: 12.5,
  voltage: 400,
  humidity: 45,
  speed: 1450,
};

/** Amplitude de la variation appliquée autour de la valeur nominale (±10 %). */
export const VARIATION_SIMULATION = 0.1;

/** Seuils par défaut de la plateforme. */
export const SEUILS_PAR_DEFAUT: SensorThreshold[] = [
  { sensorType: 'temperature', warningThreshold: 75, criticalThreshold: 85, unit: '°C' },
  // ISO 10816 : 4,5 mm/s sépare les zones B et C, 7,1 les zones C et D.
  { sensorType: 'vibration', warningThreshold: 4.5, criticalThreshold: 7.1, unit: 'mm/s' },
  // La panne d'un circuit hydraulique est la chute de pression : ces deux
  // nombres se lisent à l'envers, et le déclarent désormais.
  { sensorType: 'pressure', warningThreshold: 5.5, criticalThreshold: 4.0, unit: 'bar', sens: 'au-dessous' },
  { sensorType: 'current', warningThreshold: 105, criticalThreshold: 120, unit: 'A' },
];

/** Quelle gravité pour cette valeur et ce seuil — ou aucune. */
export function evaluerSeuil(valeur: number, seuil: SensorThreshold): 'critical' | 'high' | null {
  const auDessous = seuil.sens === 'au-dessous';
  const franchi = (limite: number) => (auDessous ? valeur <= limite : valeur >= limite);
  if (franchi(seuil.criticalThreshold)) return 'critical';
  if (franchi(seuil.warningThreshold)) return 'high';
  return null;
}
