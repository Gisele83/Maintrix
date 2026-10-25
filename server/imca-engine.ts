/**
 * IMCA — Indice Cognitif Composite Multi-paramètres d'Actif
 * Brevet N°1 MAINTRIX-SCA-IMCA
 *
 * Four sub-indices:
 *   ISD  — Indice de Santé Dynamique         (vraie distance Mahalanobis multivariée)
 *   IDC  — Indice de Dérive Comportementale  (divergence Jensen-Shannon sur fenêtres glissantes)
 *   ISO  — Indice de Stress Opérationnel     (score de charge relative et d'alarmes)
 *   IRS  — Indice de Résilience Structurelle (MTBF, âge, historique qualité)
 *
 * Composite: IMCA = w_ISD × ISD + w_IDC × IDC + w_ISO × ISO + w_IRS × IRS
 *
 * IDC upgrade: KL divergence (asymétrique, non borné) → Jensen-Shannon distance
 *   (symétrique, bornée [0,1], métrique propre, robuste aux zéros)
 */

import { db } from "./db";
import { iotSensorData, equipmentRegistry, workOrders, alertsNotifications } from "@shared/schema";
import { eq, and, gte, desc, lte } from "drizzle-orm";
import {
  computeIDCWithJSD,
  buildHistogram,
  type SlidingWindowResult,
} from "./js-divergence";
import {
  computeStochasticRUL,
  type StochasticRULResult,
} from "./stochastic-rul";
import { getDependencyGraph, propagateAnomalyMonitoring, type PropagatedMonitoring } from "./component-propagation";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IMCAResult {
  // jsDivergence replaces klDivergence as primary drift metric
  jsDivergence: number;       // √JSD ∈ [0,1] — Jensen-Shannon distance (bounded, symmetric)
  equipmentId: number;
  equipmentName: string;
  timestamp: Date;
  ISD: number;
  IDC: number;
  ISO: number;
  IRS: number;
  IMCA: number;
  mahalanobisDistance: number;
  klDivergence: number;
  weights: { ISD: number; IDC: number; ISO: number; IRS: number };
  /** Part du composite issue d une valeur par défaut, entre 0 et 1. */
  partEstimee: number;
  /** Ce qui n a pas pu être mesuré, et son poids dans le composite. */
  reserves: string[];
  trend: "improving" | "stable" | "degrading" | "critical";
  alertLevel: "ok" | "watch" | "warning" | "critical";
  explanation: IMCAExplanation;
  rul_hours: number | null;
  stochasticRUL?: StochasticRULResult; // projection Wiener/Gamma avec intervalles de confiance
  /** Propagation de surveillance vers les composants avals (Brevet 1, rev. 1c/4) — renseigné si alertLevel ∈ {warning, critical}. */
  propagatedMonitoring?: PropagatedMonitoring[];
}

export interface IMCAExplanation {
  ISD: string;
  IDC: string;
  ISO: string;
  IRS: string;
  dominantFactor: string;
  recommendation: string;
}

interface NominalModel {
  mean: Record<string, number>;
  covariance: number[][];
  covarianceInverse: number[][];
  sensorTypes: string[];
  n: number;
}

// ─── Matrix utilities ────────────────────────────────────────────────────────

function matMul(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  const m = B[0].length;
  const p = B.length;
  const C: number[][] = Array.from({ length: n }, () => Array(m).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++)
      for (let k = 0; k < p; k++) C[i][j] += A[i][k] * B[k][j];
  return C;
}

function matInverse(M: number[][]): number[][] | null {
  const n = M.length;
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = -1;
    let maxVal = 0;
    for (let row = col; row < n; row++) {
      if (Math.abs(A[row][col]) > maxVal) { maxVal = Math.abs(A[row][col]); pivot = row; }
    }
    if (pivot < 0 || maxVal < 1e-12) return null;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    const scale = A[col][col];
    for (let j = 0; j < 2 * n; j++) A[col][j] /= scale;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = A[row][col];
      for (let j = 0; j < 2 * n; j++) A[row][j] -= factor * A[col][j];
    }
  }
  return A.map(row => row.slice(n));
}

function computeCovariance(data: Record<string, number[]>, types: string[]): number[][] {
  const n = data[types[0]]?.length ?? 0;
  const means: Record<string, number> = {};
  for (const t of types) means[t] = (data[t] ?? []).reduce((a, b) => a + b, 0) / Math.max(n, 1);

  const cov: number[][] = Array.from({ length: types.length }, () => Array(types.length).fill(0));
  for (let i = 0; i < types.length; i++) {
    for (let j = 0; j < types.length; j++) {
      let sum = 0;
      const xi = data[types[i]] ?? [];
      const xj = data[types[j]] ?? [];
      for (let k = 0; k < n; k++) {
        sum += ((xi[k] ?? 0) - means[types[i]]) * ((xj[k] ?? 0) - means[types[j]]);
      }
      cov[i][j] = n > 1 ? sum / (n - 1) : 0;
    }
  }
  // ⚠️ LA RÉGULARISATION ÉTAIT ABSOLUE : `max(variance, 1e-6)`.
  //
  // Les capteurs n ont pas les mêmes unités — une température en °C autour de
  // 80, un débit autour de 100, une vibration en mm/s autour de 6. Un plancher
  // unique de 1e-6 n a de sens pour aucun d eux.
  //
  // Conséquence mesurée : un débitmètre PARFAITEMENT STABLE sur la fenêtre de
  // référence obtenait une variance de 1e-6, donc une inverse de 1e6. Une
  // déviation de 0,1 unité — un dixième de pour cent — produisait une distance
  // de Mahalanobis de 100, et un ISD de 0/100, « critique ». Or sur une
  // installation qui tourne bien, les capteurs stables sont la NORME : le
  // dispositif s effondrait précisément là où tout allait bien.
  //
  // Deux corrections, toutes deux classiques en analyse multivariée :
  //
  //   1. plancher RELATIF à l échelle de la variable. Une fenêtre sans
  //      variation ne prouve pas une variance nulle — elle prouve seulement
  //      qu on a observé trop peu, ou trop calme. On retient 1 % de la moyenne.
  //
  //   2. terme de crête (ridge) proportionnel à la variance moyenne, qui
  //      conditionne la matrice sans privilégier aucune variable.
  //
  // Constaté le 2026-10-13.
  const PLANCHER_RELATIF = 0.01;   // 1 % de la moyenne de la variable
  const CRETE = 0.01;              // 1 % de la variance moyenne

  const variances = types.map((_, i) => cov[i][i]);
  const varianceMoyenne = variances.reduce((a, b) => a + b, 0) / Math.max(types.length, 1);

  for (let i = 0; i < types.length; i++) {
    const echelle = Math.abs(means[types[i]]);
    const plancher = (PLANCHER_RELATIF * echelle) ** 2;
    cov[i][i] = Math.max(cov[i][i], plancher, 1e-9) + CRETE * varianceMoyenne;
  }
  return cov;
}

/**
 * Distance de Mahalanobis au modèle nominal.
 *
 * ⚠️ `x[t] ?? model.mean[t]` remplace un capteur MUET par sa propre moyenne
 * nominale : sa contribution à la distance vaut alors exactement zéro, et le
 * capteur passe pour parfaitement conforme. Un capteur qui cesse d'émettre est
 * pourtant un signal en soi — ligne coupée, carte morte, sonde arrachée — et
 * c'est souvent le premier symptôme d'un incident.
 *
 * Le remplacement est conservé faute de mieux : on ne peut pas inventer une
 * mesure. Mais les capteurs manquants sont désormais RAPPORTÉS, et celui qui
 * lit l'indice sait sur combien de voies il repose réellement.
 * Constaté le 2026-10-13.
 */
function mahalanobisDistance(
  x: Record<string, number>,
  model: NominalModel,
): { distance: number; capteursManquants: string[] } {
  const types = model.sensorTypes;
  const capteursManquants = types.filter(t => x[t] === undefined || x[t] === null);
  const diff = types.map(t => (x[t] ?? model.mean[t]) - model.mean[t]);
  // d² = diff^T × Σ^-1 × diff
  const inv = model.covarianceInverse;
  let d2 = 0;
  for (let i = 0; i < types.length; i++) {
    let row = 0;
    for (let j = 0; j < types.length; j++) row += inv[i][j] * diff[j];
    d2 += diff[i] * row;
  }
  return { distance: Math.sqrt(Math.max(d2, 0)), capteursManquants };
}

// buildHistogram is imported from ./js-divergence
// klDivergence replaced by Jensen-Shannon divergence (see ./js-divergence)

// ─── Sub-index computations ──────────────────────────────────────────────────

/**
 * ISD — Indice de Santé Dynamique
 * ISD(t) = 100 × exp(−α × D_M(x(t), M_nom))
 * Uses multivariate Mahalanobis distance on current sensor window vs nominal model
 */
function computeISD(
  currentMeans: Record<string, number>,
  model: NominalModel,
  alpha: number = 0.1
): { value: number; dM: number; explanation: string; estime: boolean; capteursManquants: string[] } {
  // ⚠️ Cette branche rendait `value: 75`, soit « bonne santé », quand AUCUNE
  // donnée capteur ne permettait de calibrer un modèle nominal. Un indice de
  // santé inventé, qui pesait ensuite de 0,35 à 0,45 dans le composite IMCA :
  // l'actif le moins instrumenté était ainsi présenté comme l'un des mieux
  // portants. Il est désormais marqué comme estimé, et le composite en tient
  // compte. Constaté le 2026-10-13.
  if (model.sensorTypes.length === 0 || !model.covarianceInverse) {
    return {
      value: 75,
      dM: 0,
      estime: true,
      capteursManquants: [],
      explanation: "Données capteurs insuffisantes pour calibrer un modèle nominal — "
        + "valeur conventionnelle, à ne pas lire comme une mesure.",
    };
  }
  const { distance: dM, capteursManquants } = mahalanobisDistance(currentMeans, model);
  const isd = Math.round(100 * Math.exp(-alpha * dM));
  const explanation =
    dM < 1
      ? `Comportement nominal conforme (D_M=${dM.toFixed(2)}). Tous les capteurs dans les plages attendues.`
      : dM < 2.5
      ? `Légère déviation détectée (D_M=${dM.toFixed(2)}). Surveillance recommandée.`
      : dM < 4
      ? `Déviation significative (D_M=${dM.toFixed(2)}). L'actif s'éloigne de son comportement nominal.`
      : `Déviation critique (D_M=${dM.toFixed(2)}). Intervention requise — comportement anormal multi-capteurs.`;
  const mention = capteursManquants.length
    ? " Attention : " + capteursManquants.length + " capteur(s) sans mesure sur la fenêtre ("
      + capteursManquants.join(", ") + ") — ils comptent comme conformes faute de donnée."
    : "";

  return {
    value: Math.max(0, Math.min(100, isd)),
    dM,
    estime: false,
    capteursManquants,
    explanation: explanation + mention,
  };
}

/**
 * IDC — Indice de Dérive Comportementale
 * IDC(t) = 100 × (1 − tanh(β × JSD_mean))
 *
 * Upgrade KL → Jensen-Shannon (symétrique, bornée [0,1], métrique propre).
 * JSD_mean = moyenne de √JSD sur les fenêtres glissantes.
 *
 * Comparaison fenêtre récente vs fenêtre de référence (30-90j).
 */
function computeIDC(
  recentValues: number[],
  referenceValues: number[],
  beta: number = 3.0
): { value: number; kl: number; jsd: number; jsdDistance: number; slidingResult: SlidingWindowResult; explanation: string; estime: boolean } {
  const result = computeIDCWithJSD(recentValues, referenceValues, beta, 20, 20);
  return {
    value: result.value,
    kl: result.kl_compat,           // compatibilité ascendante (tableau de bord)
    jsd: result.jsd,
    jsdDistance: result.jsdDistance,
    slidingResult: result.slidingResult,
    explanation: result.explanation,
    estime: result.estime,
  };
}

/**
 * ISO — Indice de Stress Opérationnel
 * ISO(t) = 100 × Π_j (1 − β_j × γ_j(t))
 * Formule multiplicative par condition exceptionnelle j (Brevet N°1, §5.5).
 * Chaque condition j (surcharge, alarmes, criticité) contribue indépendamment
 * via son facteur d'occurrence γ_j ∈ [0,1] et son coefficient d'impact β_j.
 */
function computeISO(
  conditions: { label: string; gamma: number; beta: number }[]
): { value: number; explanation: string } {
  let product = 1;
  const active: string[] = [];
  for (const c of conditions) {
    const gamma = Math.max(0, Math.min(1, c.gamma));
    product *= 1 - c.beta * gamma;
    if (gamma > 0.05) active.push(`${c.label} (γ=${gamma.toFixed(2)})`);
  }
  const iso = Math.round(100 * Math.max(0, product));
  const conditionsText = active.length > 0 ? active.join(", ") : "aucune condition exceptionnelle notable";
  const explanation =
    iso >= 90
      ? `Stress opérationnel faible. Équipement dans sa plage de fonctionnement nominal.`
      : iso >= 70
      ? `Stress modéré. Conditions : ${conditionsText}.`
      : iso >= 40
      ? `Stress élevé. Conditions cumulées significatives : ${conditionsText}. Révision des seuils conseillée.`
      : `Stress critique. Conditions cumulées : ${conditionsText} — révision urgente.`;
  return { value: Math.max(0, Math.min(100, iso)), explanation };
}

/**
 * IRS — Indice de Résilience Structurelle
 * IRS(t) = 100 / (1 + β × τ_moyen(t))
 * où τ_moyen est le temps moyen observé de retour à l'état nominal après une
 * perturbation (Brevet N°1, §5.6) — ici la durée moyenne entre le signalement
 * d'une intervention corrective/urgente et sa clôture effective.
 */
function computeIRS(
  tauMoyenHours: number | null,  // temps moyen de retour à l'état nominal (heures), null si aucune donnée
  beta: number = 0.02
): { value: number; explanation: string; estime: boolean } {
  const hasData = tauMoyenHours !== null;
  const tau = tauMoyenHours ?? 24; // valeur neutre par défaut en l'absence d'historique de perturbation
  const irs = Math.round(100 / (1 + beta * tau));
  // ⚠️ Quand `tauMoyenHours` est absent, la valeur 24 h sert de défaut et
  // produit un IRS d'environ 68/100. La prose l'annonçait, mais l'INDICATEUR,
  // lui, ne portait aucune marque : le composite l'agrégeait comme une mesure.
  // Avec un poids pouvant atteindre 0,40, près de la moitié de l'IMCA pouvait
  // ainsi reposer sur une convention, sans que rien ne le dise au lecteur.
  // Constaté le 2026-10-13.
  const explanation = !hasData
    ? `Aucune perturbation résolue dans l'historique — résilience estimée par défaut (τ_moyen=${tau}h).`
    : tau < 8
    ? `Résilience structurelle excellente. Retour à l'état nominal en ${tau.toFixed(1)}h en moyenne après perturbation.`
    : tau < 24
    ? `Résilience correcte. Temps moyen de récupération τ_moyen=${tau.toFixed(1)}h.`
    : tau < 72
    ? `Résilience dégradée. τ_moyen=${tau.toFixed(1)}h — temps de récupération élevé après incident.`
    : `Résilience critique. τ_moyen=${tau.toFixed(1)}h — l'actif met très longtemps à revenir à l'état nominal.`;
  return { value: Math.max(0, Math.min(100, irs)), explanation, estime: !hasData };
}

// ─── Adaptive weight calculation ─────────────────────────────────────────────

/**
 * ⚠️ `hasMaintenance` était déclaré, calculé par l'appelant, transmis… et
 * JAMAIS lu. Or c'est lui qui conditionne l'IRS : sans historique de
 * maintenance, le temps moyen de retour à l'état nominal n'est pas mesurable,
 * l'IRS retombe sur sa valeur par défaut — et il pesait tout de même jusqu'à
 * 0,40 dans le composite. Autrement dit, le cas où l'IRS vaut le moins était
 * précisément celui où on lui donnait le plus de poids.
 *
 * Son poids est désormais réduit et redistribué sur les indices réellement
 * mesurés. Les quatre pondérations somment à 1 dans chaque branche.
 */
function adaptiveWeights(
  dataQuality: { hasIot: boolean; hasHistory: boolean; hasMaintenance: boolean }
): { ISD: number; IDC: number; ISO: number; IRS: number } {
  if (!dataQuality.hasIot) {
    // Sans IoT, on s'appuie sur l'historique et la maintenance — à condition
    // que cette dernière existe.
    return dataQuality.hasMaintenance
      ? { ISD: 0.10, IDC: 0.15, ISO: 0.35, IRS: 0.40 }
      : { ISD: 0.15, IDC: 0.20, ISO: 0.55, IRS: 0.10 };
  }
  if (!dataQuality.hasHistory) {
    // No history: lean on current sensors
    return { ISD: 0.45, IDC: 0.05, ISO: 0.35, IRS: 0.15 };
  }
  if (!dataQuality.hasMaintenance) {
    // Capteurs et historique présents, mais aucune intervention enregistrée :
    // l'IRS est une convention, il ne doit pas peser comme une mesure.
    return { ISD: 0.40, IDC: 0.30, ISO: 0.22, IRS: 0.08 };
  }
  // Full data — pondérations par défaut du Brevet N°1
  return { ISD: 0.35, IDC: 0.25, ISO: 0.20, IRS: 0.20 };
}

// ─── Main IMCA computation ────────────────────────────────────────────────────

export async function computeIMCA(
  equipmentId: number,
  tenantId: string,
  windowDaysShort: number = 7,
  windowDaysLong: number = 60
): Promise<IMCAResult> {
  const now = new Date();
  const shortStart = new Date(now.getTime() - windowDaysShort * 86_400_000);
  const longStart = new Date(now.getTime() - windowDaysLong * 86_400_000);

  // ── Fetch equipment info ──────────────────────────────────────────────────
  const [equipment] = await db
    .select()
    .from(equipmentRegistry)
    .where(and(eq(equipmentRegistry.id, equipmentId), eq(equipmentRegistry.tenantId, tenantId)));

  const equipmentName = equipment?.equipmentName ?? `Équipement #${equipmentId}`;

  // ── Fetch sensor readings ─────────────────────────────────────────────────
  const recentSensors = await db
    .select()
    .from(iotSensorData)
    .where(and(eq(iotSensorData.tenantId, tenantId), eq(iotSensorData.equipmentId, equipmentId), gte(iotSensorData.timestamp!, shortStart)))
    .orderBy(desc(iotSensorData.timestamp!))
    .limit(500);

  const historicalSensors = await db
    .select()
    .from(iotSensorData)
    .where(and(eq(iotSensorData.tenantId, tenantId), eq(iotSensorData.equipmentId, equipmentId), gte(iotSensorData.timestamp!, longStart), lte(iotSensorData.timestamp!, shortStart)))
    .orderBy(desc(iotSensorData.timestamp!))
    .limit(2000);

  // ── Fetch work orders for IRS ─────────────────────────────────────────────
  const recentWOs = await db
    .select()
    .from(workOrders)
    .where(and(eq(workOrders.equipmentId, equipmentId), gte(workOrders.createdAt!, longStart)))
    .limit(100);

  // ── Fetch alerts for ISO ──────────────────────────────────────────────────
  const recentAlerts = await db
    .select()
    .from(alertsNotifications)
    .where(and(eq(alertsNotifications.equipmentId, equipmentId), gte(alertsNotifications.createdAt!, shortStart)))
    .limit(200);

  const hasIot = recentSensors.length > 0;
  const hasHistory = historicalSensors.length > 0;
  const hasMaintenance = recentWOs.length > 0;
  const weights = adaptiveWeights({ hasIot, hasHistory, hasMaintenance });

  // ── Group sensor data by type ─────────────────────────────────────────────
  const groupByType = (rows: typeof recentSensors) => {
    const g: Record<string, number[]> = {};
    for (const r of rows) {
      const t = r.sensorType;
      if (!g[t]) g[t] = [];
      g[t].push(parseFloat(r.value as string));
    }
    return g;
  };

  const recentByType = groupByType(recentSensors);
  const histByType = groupByType(historicalSensors);
  const sensorTypes = [...new Set([...Object.keys(recentByType), ...Object.keys(histByType)])];

  // ── Build nominal model (use historical data as reference) ────────────────
  const refData = Object.keys(histByType).length > 0 ? histByType : recentByType;
  const refTypes = Object.keys(refData).filter(t => (refData[t]?.length ?? 0) >= 3);
  let nominalModel: NominalModel | null = null;

  if (refTypes.length >= 2) {
    const mean: Record<string, number> = {};
    for (const t of refTypes) mean[t] = refData[t].reduce((a, b) => a + b, 0) / refData[t].length;
    const cov = computeCovariance(refData, refTypes);
    const covInv = matInverse(cov);
    if (covInv) {
      nominalModel = { mean, covariance: cov, covarianceInverse: covInv, sensorTypes: refTypes, n: refData[refTypes[0]].length };
    }
  }

  // ── Current means (recent window) ─────────────────────────────────────────
  const currentMeans: Record<string, number> = {};
  for (const t of sensorTypes) {
    const vals = recentByType[t];
    if (vals?.length) currentMeans[t] = vals.reduce((a, b) => a + b, 0) / vals.length;
    else if (nominalModel?.mean[t]) currentMeans[t] = nominalModel.mean[t];
  }

  // ─── ISD ─────────────────────────────────────────────────────────────────
  // ⚠️ Second indice de santé inventé, à 70 cette fois — et à un autre endroit
  // que celui qui en inventait 75. Deux conventions différentes pour la même
  // situation, dans la même fonction. Il est maintenant marqué comme estimé.
  const isdResult = nominalModel
    ? computeISD(currentMeans, nominalModel, 0.1)
    : {
      value: 70,
      dM: 0,
      estime: true,
      capteursManquants: [] as string[],
      explanation: "Modèle nominal non calibré — historique de capteurs insuffisant. "
        + "Valeur conventionnelle, à ne pas lire comme une mesure.",
    };

  // ─── IDC ─────────────────────────────────────────────────────────────────
  const primarySensor = sensorTypes.find(t => ["temperature", "vibration", "pressure"].includes(t)) ?? sensorTypes[0];
  const idcResult = computeIDC(
    recentByType[primarySensor] ?? [],
    histByType[primarySensor] ?? [],
    3.0
  );

  // ─── ISO ─────────────────────────────────────────────────────────────────
  const alarmRows = recentAlerts.filter(a => a.severity === "warning");
  const criticalRows = recentAlerts.filter(a => a.severity === "critical");
  const overloadRatio = hasIot
    ? recentSensors.filter(s => s.alarmState !== "normal").length / Math.max(recentSensors.length, 1)
    : 0.1;
  const alarmGamma = Math.min(1, alarmRows.length / Math.max(windowDaysShort, 1) / 2);
  const criticalGamma = Math.min(1, criticalRows.length / Math.max(windowDaysShort, 1));
  const isoResult = computeISO([
    { label: "alarmes fréquentes", gamma: alarmGamma, beta: 0.35 },
    { label: "alertes critiques", gamma: criticalGamma, beta: 0.55 },
    { label: "surcharge capteurs", gamma: overloadRatio, beta: 0.45 },
  ]);

  // ─── IRS ─────────────────────────────────────────────────────────────────
  // NB: workOrders utilise "orderType" (pas "type") pour la catégorie d'intervention.
  const corrective = recentWOs.filter(w => w.orderType === "corrective" || w.orderType === "emergency");

  // τ_moyen : durée moyenne entre signalement (createdAt) et clôture (actualEnd)
  // des interventions correctives/urgentes résolues — proxy du retour à l'état nominal.
  const resolvedCorrective = corrective.filter(w => w.status === "completed" && w.actualEnd && w.createdAt);
  const recoveryTimesHours = resolvedCorrective.map(
    w => (new Date(w.actualEnd!).getTime() - new Date(w.createdAt!).getTime()) / 3_600_000
  ).filter(h => h >= 0);
  const tauMoyenHours = recoveryTimesHours.length > 0
    ? recoveryTimesHours.reduce((a, b) => a + b, 0) / recoveryTimesHours.length
    : null;

  const irsResult = computeIRS(tauMoyenHours);

  // ─── IMCA composite ──────────────────────────────────────────────────────
  const imcaRaw =
    weights.ISD * isdResult.value +
    weights.IDC * idcResult.value +
    weights.ISO * isoResult.value +
    weights.IRS * irsResult.value;
  const IMCA = Math.round(Math.max(0, Math.min(100, imcaRaw)));

  // ⚠️ Une réserve portée par un sous-indice se perdait ici. Le lecteur voyait
  // « IMCA 68 — à surveiller » sans savoir qu'une part de ce nombre reposait
  // sur une valeur par défaut. La part estimée est donc remontée, chiffrée :
  // c'est elle qui dit combien de confiance accorder au composite.
  const reserves: string[] = [];
  let partEstimee = 0;
  if (irsResult.estime) {
    partEstimee += weights.IRS;
    reserves.push(
      `IRS estimé par défaut (aucune perturbation résolue dans l'historique) — `
      + `${Math.round(weights.IRS * 100)} % du composite`,
    );
  }
  if (isdResult.estime) {
    partEstimee += weights.ISD;
    reserves.push(
      `ISD conventionnel (aucun modèle nominal calibrable) — `
      + `${Math.round(weights.ISD * 100)} % du composite`,
    );
  }
  if (isdResult.capteursManquants.length) {
    reserves.push(
      `${isdResult.capteursManquants.length} capteur(s) sans mesure sur la fenêtre : `
      + `${isdResult.capteursManquants.join(", ")} — comptés comme conformes faute de donnée`,
    );
  }
  if (idcResult.estime) {
    partEstimee += weights.IDC;
    reserves.push(
      `IDC conventionnel (historique insuffisant pour mesurer une dérive) — `
      + `${Math.round(weights.IDC * 100)} % du composite`,
    );
  }
  if (!hasIot) reserves.push("aucune donnée capteur : ISD et IDC reposent sur peu d'observations");
  if (!hasMaintenance) reserves.push("aucune intervention enregistrée sur la période");

  // ─── Alert level & trend ─────────────────────────────────────────────────
  const alertLevel: IMCAResult["alertLevel"] =
    IMCA >= 75 ? "ok" : IMCA >= 55 ? "watch" : IMCA >= 35 ? "warning" : "critical";

  const subValues = [isdResult.value, idcResult.value, isoResult.value, irsResult.value];
  const minSub = Math.min(...subValues);
  const trend: IMCAResult["trend"] =
    IMCA >= 75 && idcResult.jsdDistance < 0.10 ? "improving"  // JSD_distance < seuil stable
    : IMCA >= 55 ? "stable"
    : minSub < 40 ? "critical"
    : "degrading";

  // ─── Dominant factor & recommendation ────────────────────────────────────
  const factors = [
    { name: "ISD", value: isdResult.value, label: "santé dynamique" },
    { name: "IDC", value: idcResult.value, label: "dérive comportementale" },
    { name: "ISO", value: isoResult.value, label: "stress opérationnel" },
    { name: "IRS", value: irsResult.value, label: "résilience structurelle" },
  ];
  const worst = factors.reduce((a, b) => (a.value < b.value ? a : b));
  const dominantFactor = `${worst.name} — ${worst.label} (${worst.value}/100)`;

  const recommendation =
    IMCA >= 80
      ? "Actif en bonne santé. Maintenir la surveillance périodique."
      : IMCA >= 65
      ? `Surveiller l'évolution de ${worst.label}. Contrôle recommandé sous 30 jours.`
      : IMCA >= 45
      ? `Planifier une intervention préventive. Facteur limitant : ${worst.label}.`
      : `Intervention corrective urgente recommandée. L'IMCA indique un risque de défaillance élevé sur ${worst.label}.`;

  // ─── Stochastic RUL (Wiener + Gamma avec intervalles de confiance) ────────
  // Reconstruit une série IMCA proxy depuis l'historique IoT disponible
  const imcaProxy: number[] = [];
  if (hasIot && recentSensors.length > 5) {
    // Grouper les capteurs récents par tranches de 24h
    const sorted = [...recentSensors].sort((a, b) =>
      (a.timestamp?.getTime() ?? 0) - (b.timestamp?.getTime() ?? 0)
    );
    const binMs = 86_400_000; // 24h en ms
    const t0 = sorted[0].timestamp?.getTime() ?? Date.now();
    const bins = new Map<number, number[]>();
    for (const s of sorted) {
      const bin = Math.floor(((s.timestamp?.getTime() ?? t0) - t0) / binMs);
      if (!bins.has(bin)) bins.set(bin, []);
      bins.get(bin)!.push(parseFloat(s.value as string) || 0);
    }
    for (const [, vals] of [...bins.entries()].sort(([a], [b]) => a - b)) {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const allVals = sorted.map(s => parseFloat(s.value as string) || 0);
      const globalMed = allVals.sort((a, b) => a - b)[Math.floor(allVals.length / 2)] || 1;
      const relDev = Math.abs(mean - globalMed) / (globalMed || 1);
      imcaProxy.push(Math.round(Math.max(0, Math.min(100, 100 * Math.exp(-2 * relDev)))));
    }
  }
  // Utiliser l'IMCA calculé comme dernier point (plus précis)
  const imcaHistoryForRUL = imcaProxy.length >= 3 ? imcaProxy : [IMCA];
  const stochasticRUL = computeStochasticRUL(imcaHistoryForRUL, IMCA, 24, 30);

  // ⚠️ LA CHAÎNE DE REPLI INVENTAIT UNE DURÉE DE VIE RÉSIDUELLE.
  //
  // Faute de distribution stochastique, elle produisait `200 / dM`, `500 / dM`
  // ou `2000 / dM` selon le niveau d'IMCA — l'inverse d'une distance de
  // Mahalanobis, multipliée par un coefficient choisi au hasard, présentée en
  // HEURES. Une distance est sans dimension : son inverse ne produit pas une
  // durée, et les coefficients 200, 500 et 2000 ne reposent sur rien.
  //
  // Un exploitant lisant « RUL : 180 h » planifie un arrêt. Il mérite de savoir
  // que ce nombre n'a pas été mesuré. Quand aucun modèle ne converge, la durée
  // de vie résiduelle est inconnue — et c'est une information en soi.
  // Constaté le 2026-10-13.
  const medianeRUL = stochasticRUL.recommended?.median;
  const rul_hours: number | null =
    medianeRUL !== undefined && medianeRUL > 0 ? medianeRUL : null;

  // ─── Propagation de surveillance (jumeau comportemental, Brevet 1 rev. 1c/4) ──
  // Sur anomalie significative, propage l'intensité de surveillance depuis le
  // composant le plus amont du graphe de dépendances de l'équipement.
  let propagatedMonitoring: PropagatedMonitoring[] | undefined;
  if (alertLevel === "warning" || alertLevel === "critical") {
    const graph = await getDependencyGraph(equipmentId).catch(() => null);
    if (graph && graph.nodes.length > 0) {
      propagatedMonitoring = await propagateAnomalyMonitoring(equipmentId, graph.nodes[0]).catch(() => undefined);
    }
  }

  return {
    equipmentId,
    equipmentName,
    timestamp: now,
    ISD: isdResult.value,
    IDC: idcResult.value,
    ISO: isoResult.value,
    IRS: irsResult.value,
    IMCA,
    mahalanobisDistance: parseFloat(isdResult.dM.toFixed(3)),
    klDivergence: parseFloat(idcResult.kl.toFixed(4)),   // conservé pour compat. ascendante
    jsDivergence: parseFloat(idcResult.jsdDistance.toFixed(4)), // √JSD ∈ [0,1] — métrique principale
    weights,
    // Part du composite reposant sur une valeur par défaut plutôt que sur une
    // mesure, et les raisons. Sans ces deux champs, « IMCA 68 — à surveiller »
    // se lit comme un résultat alors qu il peut être une convention.
    partEstimee: Math.round(partEstimee * 100) / 100,
    reserves,
    trend,
    alertLevel,
    rul_hours,
    stochasticRUL,
    propagatedMonitoring,
    explanation: {
      ISD: isdResult.explanation,
      IDC: idcResult.explanation,
      ISO: isoResult.explanation,
      IRS: irsResult.explanation,
      dominantFactor,
      recommendation,
    },
  };
}

// ─── Fleet-level IMCA ────────────────────────────────────────────────────────

export async function computeFleetIMCA(
  tenantId: string
): Promise<{ results: IMCAResult[]; fleetIMCA: number; criticalCount: number; degradingCount: number }> {
  const equipment = await db
    .select()
    .from(equipmentRegistry)
    .where(eq(equipmentRegistry.tenantId, tenantId))
    .limit(50);

  const results: IMCAResult[] = [];
  for (const eq_ of equipment) {
    try {
      const r = await computeIMCA(eq_.id, tenantId);
      results.push(r);
    } catch {
      // skip equipment with no data
    }
  }

  const fleetIMCA = results.length > 0
    ? Math.round(results.reduce((a, b) => a + b.IMCA, 0) / results.length)
    : 0;

  return {
    results,
    fleetIMCA,
    criticalCount: results.filter(r => r.alertLevel === "critical").length,
    degradingCount: results.filter(r => r.trend === "degrading").length,
  };
}
