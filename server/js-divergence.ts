/**
 * Jensen-Shannon Divergence — Détection de Dérive Conceptuelle
 * ═══════════════════════════════════════════════════════════════
 *
 * Remplace le calcul de dérive en % par une vraie divergence J-S
 * sur fenêtres glissantes (sliding windows).
 *
 * Propriétés de JSD vs KL :
 *   • Symétrique       : JSD(P‖Q) = JSD(Q‖P)       [KL n'est PAS symétrique]
 *   • Bornée           : JSD ∈ [0, 1]  (base 2)     [KL peut tendre vers ∞]
 *   • Métrique propre  : √JSD respecte l'inégalité triangulaire
 *   • Robuste          : insensible aux 0 isolés grâce au mélange M = ½(P+Q)
 *
 * Formule :
 *   M   = ½ · P + ½ · Q
 *   JSD = ½ · KL(P‖M) + ½ · KL(Q‖M)
 *   JSD_distance = √JSD  ∈ [0, 1]
 *
 * Sliding-window drift :
 *   Pour chaque position t dans la série temporelle :
 *     P_t = distribution de la fenêtre de référence [t-2w, t-w]
 *     Q_t = distribution de la fenêtre courante     [t-w,  t]
 *     Drift_t = √JSD(P_t, Q_t)
 *
 *   Seuils adaptatifs (CUSUM-like) :
 *     μ_base, σ_base = moyenne et std du JSD en période de calibration
 *     Alerte si Drift_t > μ_base + k · σ_base   (k=2 par défaut → ~97.5% CI)
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DriftPoint {
  index: number;          // position dans la série temporelle
  jsd: number;            // JSD brut ∈ [0,1]
  jsdDistance: number;    // J-S Distance √JSD ∈ [0,1]
  isAlert: boolean;       // au-dessus du seuil adaptatif ?
  driftLevel: "stable" | "light" | "moderate" | "severe" | "critical";
  referenceWindow: [number, number]; // indices [start, end]
  currentWindow: [number, number];
}

export interface SlidingWindowResult {
  series: DriftPoint[];
  summary: {
    meanJSD: number;           // JSD moyen sur la série
    maxJSD: number;            // pic de dérive
    alertCount: number;        // nombre de points en alerte
    driftTrend: "improving" | "stable" | "drifting" | "diverging";
    overallDriftLevel: DriftPoint["driftLevel"];
    calibrationMean: number;   // μ de la période de calibration
    calibrationStd: number;    // σ de la période de calibration
    adaptiveThreshold: number; // seuil adaptatif μ + 2σ
  };
  lastDrift: DriftPoint | null;
}

export interface MultiSensorDriftResult {
  perSensor: Record<string, SlidingWindowResult>;
  globalDrift: number;            // max JSD toutes dimensions confondues
  dominantSensor: string | null;  // capteur avec la plus forte dérive
  combinedDriftLevel: DriftPoint["driftLevel"];
  recommendation: string;
}

// ─── Histogram & KL primitives ──────────────────────────────────────────────

/**
 * Histogramme normalisé avec lissage de Laplace.
 * Bins auto-adaptatifs : on force les deux distributions à partager
 * les mêmes bornes min/max pour la comparabilité.
 */
export function buildHistogram(
  values: number[],
  bins: number = 20,
  forcedMin?: number,
  forcedMax?: number
): number[] {
  if (values.length === 0) return Array(bins).fill(1 / bins);

  const min = forcedMin ?? Math.min(...values);
  const max = forcedMax ?? Math.max(...values);
  const range = max - min || 1;

  const hist = Array(bins).fill(0);
  for (const v of values) {
    const bin = Math.min(Math.floor(((v - min) / range) * bins), bins - 1);
    hist[bin]++;
  }

  // Lissage de Laplace : évite les 0 qui rendent KL infini
  const alpha = 1e-6;
  const total = hist.reduce((a, b) => a + b, 0) + alpha * bins;
  return hist.map(h => (h + alpha) / total);
}

function klDivergenceRaw(P: number[], Q: number[]): number {
  let kl = 0;
  for (let i = 0; i < P.length; i++) {
    if (P[i] > 1e-12 && Q[i] > 1e-12) kl += P[i] * Math.log2(P[i] / Q[i]);
  }
  return Math.max(kl, 0);
}

// ─── Jensen-Shannon Divergence ─────────────────────────────────────────────

/**
 * JSD(P ‖ Q) = ½·KL(P‖M) + ½·KL(Q‖M)   où M = ½(P+Q)
 * Retourne JSD ∈ [0, 1]  (base 2, log2, donc max = 1)
 */
export function jensenShannonDivergence(P: number[], Q: number[]): number {
  if (P.length !== Q.length) {
    throw new Error(`JSD: P.length(${P.length}) ≠ Q.length(${Q.length})`);
  }
  const M = P.map((p, i) => 0.5 * p + 0.5 * Q[i]);
  const jsd = 0.5 * klDivergenceRaw(P, M) + 0.5 * klDivergenceRaw(Q, M);
  return Math.max(0, Math.min(1, jsd));
}

/**
 * JSD-distance = √JSD  ∈ [0, 1]
 * Métrique propre (triangle inequality satisfaite).
 */
export function jensenShannonDistance(P: number[], Q: number[]): number {
  return Math.sqrt(jensenShannonDivergence(P, Q));
}

/**
 * Calcule JSD entre deux séries de valeurs scalaires.
 * Les deux distributions partagent les mêmes bornes histogramme.
 */
export function computeSeriesJSD(
  valuesP: number[],
  valuesQ: number[],
  bins: number = 20
): { jsd: number; jsdDistance: number; P: number[]; Q: number[] } {
  // Bornes partagées pour comparabilité
  const allValues = [...valuesP, ...valuesQ];
  const forcedMin = Math.min(...allValues);
  const forcedMax = Math.max(...allValues);

  const P = buildHistogram(valuesP, bins, forcedMin, forcedMax);
  const Q = buildHistogram(valuesQ, bins, forcedMin, forcedMax);
  const jsd = jensenShannonDivergence(P, Q);
  return { jsd, jsdDistance: Math.sqrt(jsd), P, Q };
}

// ─── Niveau de dérive ─────────────────────────────────────────────────────

function classifyDriftLevel(jsdDistance: number): DriftPoint["driftLevel"] {
  if (jsdDistance < 0.10) return "stable";
  if (jsdDistance < 0.22) return "light";
  if (jsdDistance < 0.38) return "moderate";
  if (jsdDistance < 0.55) return "severe";
  return "critical";
}

// ─── Sliding Window JSD ────────────────────────────────────────────────────

/**
 * Calcule la série temporelle de JSD sur fenêtres glissantes.
 *
 * @param values      Série temporelle scalaire (mesures capteur)
 * @param windowSize  Taille de chaque fenêtre (référence + courante)
 * @param step        Pas de glissement (défaut = windowSize/2)
 * @param bins        Nombre de bins histogramme
 * @param kAdaptive   Coefficient pour seuil adaptatif (μ + k·σ)
 * @returns           Série de DriftPoints + résumé statistique
 */
export function slidingWindowJSD(
  values: number[],
  windowSize: number = 30,
  step: number = Math.max(1, Math.floor(windowSize / 2)),
  bins: number = 20,
  kAdaptive: number = 2.0
): SlidingWindowResult {
  const minLen = 2 * windowSize;
  if (values.length < minLen) {
    return {
      series: [],
      summary: {
        meanJSD: 0, maxJSD: 0, alertCount: 0,
        driftTrend: "stable", overallDriftLevel: "stable",
        calibrationMean: 0, calibrationStd: 0, adaptiveThreshold: 0.15,
      },
      lastDrift: null,
    };
  }

  const series: DriftPoint[] = [];
  const n = values.length;

  // Compute JSD at each sliding position
  for (let t = minLen; t <= n; t += step) {
    const refStart = Math.max(0, t - 2 * windowSize);
    const refEnd   = t - windowSize;
    const curStart = refEnd;
    const curEnd   = t;

    const refWindow = values.slice(refStart, refEnd);
    const curWindow = values.slice(curStart, curEnd);

    if (refWindow.length < 3 || curWindow.length < 3) continue;

    const { jsd, jsdDistance } = computeSeriesJSD(refWindow, curWindow, bins);

    series.push({
      index: t - 1,
      jsd,
      jsdDistance,
      isAlert: false,         // will be filled after calibration
      driftLevel: classifyDriftLevel(jsdDistance),
      referenceWindow: [refStart, refEnd],
      currentWindow: [curStart, curEnd],
    });
  }

  if (series.length === 0) {
    return {
      series: [],
      summary: {
        meanJSD: 0, maxJSD: 0, alertCount: 0,
        driftTrend: "stable", overallDriftLevel: "stable",
        calibrationMean: 0, calibrationStd: 0, adaptiveThreshold: 0.15,
      },
      lastDrift: null,
    };
  }

  // Adaptive threshold: calibration on first ~30% of the series
  const calibLen = Math.max(2, Math.floor(series.length * 0.30));
  const calibValues = series.slice(0, calibLen).map(p => p.jsdDistance);
  const calMean = calibValues.reduce((a, b) => a + b, 0) / calibValues.length;
  const calVariance = calibValues.reduce((s, v) => s + (v - calMean) ** 2, 0) / calibValues.length;
  const calStd = Math.sqrt(calVariance);
  const adaptiveThreshold = Math.min(0.50, calMean + kAdaptive * calStd);

  // Mark alerts
  for (const p of series) {
    p.isAlert = p.jsdDistance > adaptiveThreshold;
  }

  // Summary statistics
  const jsdValues = series.map(p => p.jsdDistance);
  const meanJSD = jsdValues.reduce((a, b) => a + b, 0) / jsdValues.length;
  const maxJSD = Math.max(...jsdValues);
  const alertCount = series.filter(p => p.isAlert).length;

  // Trend: compare first half vs second half of series
  const half = Math.floor(series.length / 2);
  const firstHalfMean = series.slice(0, half).reduce((s, p) => s + p.jsdDistance, 0) / Math.max(half, 1);
  const secondHalfMean = series.slice(half).reduce((s, p) => s + p.jsdDistance, 0) / Math.max(series.length - half, 1);
  const driftTrend: SlidingWindowResult["summary"]["driftTrend"] =
    secondHalfMean < firstHalfMean * 0.85 ? "improving"
    : secondHalfMean <= firstHalfMean * 1.15 ? "stable"
    : secondHalfMean < firstHalfMean * 1.50 ? "drifting"
    : "diverging";

  const overallDriftLevel = classifyDriftLevel(meanJSD);

  return {
    series,
    summary: {
      meanJSD: parseFloat(meanJSD.toFixed(4)),
      maxJSD: parseFloat(maxJSD.toFixed(4)),
      alertCount,
      driftTrend,
      overallDriftLevel,
      calibrationMean: parseFloat(calMean.toFixed(4)),
      calibrationStd: parseFloat(calStd.toFixed(4)),
      adaptiveThreshold: parseFloat(adaptiveThreshold.toFixed(4)),
    },
    lastDrift: series[series.length - 1] ?? null,
  };
}

// ─── Multi-sensor drift analysis ───────────────────────────────────────────

/**
 * Analyse JSD sur fenêtres glissantes pour plusieurs capteurs en parallèle.
 * Retourne le capteur dominant (plus forte dérive) et un score global.
 */
export function analyzeMultiSensorDrift(
  sensorHistory: Map<string, number[]>,
  windowSize: number = 30,
  step: number = Math.max(1, Math.floor(windowSize / 2))
): MultiSensorDriftResult {
  const perSensor: Record<string, SlidingWindowResult> = {};
  let globalDrift = 0;
  let dominantSensor: string | null = null;

  for (const [sensorType, values] of sensorHistory.entries()) {
    const result = slidingWindowJSD(values, windowSize, step);
    perSensor[sensorType] = result;

    const lastJSD = result.lastDrift?.jsdDistance ?? 0;
    if (lastJSD > globalDrift) {
      globalDrift = lastJSD;
      dominantSensor = sensorType;
    }
  }

  const combinedDriftLevel = classifyDriftLevel(globalDrift);

  const recommendation =
    combinedDriftLevel === "stable"
      ? "Toutes les distributions capteurs sont stables. Aucune dérive conceptuelle détectée."
    : combinedDriftLevel === "light"
      ? `Légère dérive sur ${dominantSensor ?? "certains capteurs"}. Surveillance accrue conseillée.`
    : combinedDriftLevel === "moderate"
      ? `Dérive modérée sur ${dominantSensor ?? "plusieurs capteurs"} (JSD=${globalDrift.toFixed(3)}). Recalibration à planifier.`
    : combinedDriftLevel === "severe"
      ? `Dérive sévère détectée sur ${dominantSensor ?? "le système"} (JSD=${globalDrift.toFixed(3)}). Analyse de cause-racine urgente.`
    : `Dérive critique (JSD=${globalDrift.toFixed(3)}) — ${dominantSensor ?? "capteur inconnu"}. Arrêt supervisé et recalibration immédiate.`;

  return {
    perSensor,
    globalDrift: parseFloat(globalDrift.toFixed(4)),
    dominantSensor,
    combinedDriftLevel,
    recommendation,
  };
}

// ─── IDC formula with JSD ──────────────────────────────────────────────────

/**
 * Calcule l'IDC via JSD sur fenêtres glissantes.
 *
 * IDC(t) = 100 × (1 − tanh(β × JSD_mean))
 *
 * JSD_mean = moyenne des √JSD sur la série de fenêtres glissantes.
 * Plus robuste que le simple KL : symétrie + bornage + insensibilité aux zéros.
 */
export function computeIDCWithJSD(
  recentValues: number[],
  referenceValues: number[],
  beta: number = 3.0,
  bins: number = 20,
  windowSize: number = 20
): {
  value: number;
  jsd: number;
  jsdDistance: number;
  kl_compat: number;          // KL (sens P→Q) pour compatibilité ascendante
  slidingResult: SlidingWindowResult;
  explanation: string;
} {
  // Cas dégénéré
  if (recentValues.length < 5 || referenceValues.length < 5) {
    return {
      value: 80, jsd: 0, jsdDistance: 0, kl_compat: 0,
      slidingResult: {
        series: [],
        summary: {
          meanJSD: 0, maxJSD: 0, alertCount: 0,
          driftTrend: "stable", overallDriftLevel: "stable",
          calibrationMean: 0, calibrationStd: 0, adaptiveThreshold: 0.15,
        },
        lastDrift: null,
      },
      explanation: "Historique insuffisant pour calculer la dérive comportementale via Jensen-Shannon.",
    };
  }

  // Concaténer référence + récent pour calculer la série glissante
  const combinedSeries = [...referenceValues, ...recentValues];
  const slidingResult = slidingWindowJSD(
    combinedSeries,
    Math.min(windowSize, Math.floor(combinedSeries.length / 4)),
    Math.max(1, Math.floor(windowSize / 3))
  );

  // JSD ponctuel sur la paire de fenêtres (référence vs récent)
  const { jsd, jsdDistance } = computeSeriesJSD(referenceValues, recentValues, bins);

  // JSD moyen glissant (plus stable que ponctuel)
  const jsdMean = slidingResult.summary.meanJSD > 0 ? slidingResult.summary.meanJSD : jsdDistance;

  // KL pour compatibilité ascendante (P→Q sens unique)
  const allVals = [...referenceValues, ...recentValues];
  const fMin = Math.min(...allVals);
  const fMax = Math.max(...allVals);
  const P = buildHistogram(recentValues, bins, fMin, fMax);
  const Q = buildHistogram(referenceValues, bins, fMin, fMax);
  const M = P.map((p, i) => 0.5 * p + 0.5 * Q[i]);
  const kl_compat = 0.5 * klDivergenceRaw(P, M); // ½·KL(P‖M) seul

  const idc = Math.round(100 * (1 - Math.tanh(beta * jsdMean)));

  const overallLevel = slidingResult.summary.overallDriftLevel;
  const alertCnt = slidingResult.summary.alertCount;
  const trend = slidingResult.summary.driftTrend;

  const explanation =
    overallLevel === "stable"
      ? `Distribution stable (JSD_dist=${jsdDistance.toFixed(3)}, μ_glissant=${jsdMean.toFixed(3)}). Aucune dérive comportementale détectée.`
    : overallLevel === "light"
      ? `Dérive légère (JSD_dist=${jsdDistance.toFixed(3)}). ${alertCnt} fenêtre(s) au-dessus du seuil adaptatif — tendance ${trend}.`
    : overallLevel === "moderate"
      ? `Dérive modérée (JSD_dist=${jsdDistance.toFixed(3)}, ${alertCnt} alertes). Le comportement actuel diverge progressivement.`
    : overallLevel === "severe"
      ? `Dérive sévère (JSD_dist=${jsdDistance.toFixed(3)}, ${alertCnt} alertes). Changement de régime opérationnel probable.`
    : `Dérive critique (JSD_dist=${jsdDistance.toFixed(3)}, ${alertCnt} alertes). Investigation immédiate requise.`;

  return {
    value: Math.max(0, Math.min(100, idc)),
    jsd,
    jsdDistance: parseFloat(jsdDistance.toFixed(4)),
    kl_compat: parseFloat(kl_compat.toFixed(4)),
    slidingResult,
    explanation,
  };
}

// ─── Export constants ──────────────────────────────────────────────────────

export const JSD_THRESHOLDS = {
  stable:   0.10,
  light:    0.22,
  moderate: 0.38,
  severe:   0.55,
  critical: 1.00,
} as const;

export const JSD_BETA_DEFAULT = 3.0;
export const JSD_BINS_DEFAULT = 20;
export const JSD_WINDOW_DEFAULT = 30;
