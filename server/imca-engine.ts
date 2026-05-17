/**
 * IMCA — Indice Cognitif Composite Multi-paramètres d'Actif
 * Brevet N°1 MAINTRIX-SCA-IMCA
 *
 * Four sub-indices:
 *   ISD  — Indice de Santé Dynamique       (vraie distance Mahalanobis multivariée)
 *   IDC  — Indice de Dérive Comportementale (divergence Kullback-Leibler sur fenêtre glissante)
 *   ISO  — Indice de Stress Opérationnel    (score de charge relative et d'alarmes)
 *   IRS  — Indice de Résilience Structurelle (MTBF, âge, historique qualité)
 *
 * Composite: IMCA = w_ISD × ISD + w_IDC × IDC + w_ISO × ISO + w_IRS × IRS
 */

import { db } from "./db";
import { iotSensorData, equipmentRegistry, workOrders, alertsNotifications } from "@shared/schema";
import { eq, and, gte, desc, lte } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IMCAResult {
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
  trend: "improving" | "stable" | "degrading" | "critical";
  alertLevel: "ok" | "watch" | "warning" | "critical";
  explanation: IMCAExplanation;
  rul_hours: number | null;
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
  // Regularize diagonal to avoid singular matrix
  for (let i = 0; i < types.length; i++) cov[i][i] = Math.max(cov[i][i], 1e-6);
  return cov;
}

function mahalanobisDistance(x: Record<string, number>, model: NominalModel): number {
  const types = model.sensorTypes;
  const diff = types.map(t => (x[t] ?? model.mean[t]) - model.mean[t]);
  // d² = diff^T × Σ^-1 × diff
  const inv = model.covarianceInverse;
  let d2 = 0;
  for (let i = 0; i < types.length; i++) {
    let row = 0;
    for (let j = 0; j < types.length; j++) row += inv[i][j] * diff[j];
    d2 += diff[i] * row;
  }
  return Math.sqrt(Math.max(d2, 0));
}

// ─── Kullback-Leibler divergence (discrete, histogram) ───────────────────────

function buildHistogram(values: number[], bins: number = 20): number[] {
  if (values.length === 0) return Array(bins).fill(1 / bins);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const hist = Array(bins).fill(0);
  for (const v of values) {
    const bin = Math.min(Math.floor(((v - min) / range) * bins), bins - 1);
    hist[bin]++;
  }
  const total = hist.reduce((a, b) => a + b, 0);
  const alpha = 1 / (total + bins); // Laplace smoothing
  return hist.map(h => (h + alpha) / (total + bins * alpha));
}

function klDivergence(P: number[], Q: number[]): number {
  let kl = 0;
  for (let i = 0; i < P.length; i++) {
    if (P[i] > 0 && Q[i] > 0) kl += P[i] * Math.log(P[i] / Q[i]);
  }
  return Math.max(kl, 0);
}

// ─── Sub-index computations ──────────────────────────────────────────────────

/**
 * ISD — Indice de Santé Dynamique
 * ISD(t) = 100 × exp(−α × D_M(x(t), M_nom))
 * Uses multivariate Mahalanobis distance on current sensor window vs nominal model
 */
function computeISD(
  currentMeans: Record<string, number>,
  model: NominalModel,
  alpha: number = 0.4
): { value: number; dM: number; explanation: string } {
  if (model.sensorTypes.length === 0 || !model.covarianceInverse) {
    return { value: 75, dM: 0, explanation: "Données capteurs insuffisantes pour calibration nominale." };
  }
  const dM = mahalanobisDistance(currentMeans, model);
  const isd = Math.round(100 * Math.exp(-alpha * dM));
  const explanation =
    dM < 1
      ? `Comportement nominal conforme (D_M=${dM.toFixed(2)}). Tous les capteurs dans les plages attendues.`
      : dM < 2.5
      ? `Légère déviation détectée (D_M=${dM.toFixed(2)}). Surveillance recommandée.`
      : dM < 4
      ? `Déviation significative (D_M=${dM.toFixed(2)}). L'actif s'éloigne de son comportement nominal.`
      : `Déviation critique (D_M=${dM.toFixed(2)}). Intervention requise — comportement anormal multi-capteurs.`;
  return { value: Math.max(0, Math.min(100, isd)), dM, explanation };
}

/**
 * IDC — Indice de Dérive Comportementale
 * IDC(t) = 100 × (1 − tanh(β × D_KL(P_obs(t), P_obs(t−T))))
 * Compares recent distribution vs reference window (30-90j)
 */
function computeIDC(
  recentValues: number[],
  referenceValues: number[],
  beta: number = 3.0
): { value: number; kl: number; explanation: string } {
  if (recentValues.length < 5 || referenceValues.length < 5) {
    return { value: 80, kl: 0, explanation: "Historique insuffisant pour calculer la dérive comportementale." };
  }
  const P = buildHistogram(recentValues, 20);
  const Q = buildHistogram(referenceValues, 20);
  const kl = klDivergence(P, Q);
  const idc = Math.round(100 * (1 - Math.tanh(beta * kl)));
  const explanation =
    kl < 0.05
      ? `Distribution stable (D_KL=${kl.toFixed(3)}). Aucune dérive comportementale détectée.`
      : kl < 0.2
      ? `Dérive légère (D_KL=${kl.toFixed(3)}). La distribution des signaux évolue progressivement.`
      : kl < 0.5
      ? `Dérive modérée (D_KL=${kl.toFixed(3)}). Le comportement actuel diverge de la référence historique.`
      : `Dérive sévère (D_KL=${kl.toFixed(3)}). Changement de régime opérationnel probable — investigation requise.`;
  return { value: Math.max(0, Math.min(100, idc)), kl, explanation };
}

/**
 * ISO — Indice de Stress Opérationnel
 * Fusionne : taux de dépassement de seuils, fréquence d'alarmes, surcharge relative
 */
function computeISO(
  alarmCount: number,
  warningCount: number,
  criticalCount: number,
  overloadRatio: number, // fraction de mesures au-delà du seuil nominal
  windowDays: number
): { value: number; explanation: string } {
  const alarmRate = (alarmCount + warningCount * 0.5 + criticalCount * 2) / Math.max(windowDays, 1);
  const stressScore = alarmRate * 0.6 + overloadRatio * 0.4;
  const iso = Math.round(100 * Math.exp(-2.5 * stressScore));
  const explanation =
    stressScore < 0.05
      ? `Stress opérationnel faible. Équipement dans sa plage de fonctionnement nominal.`
      : stressScore < 0.2
      ? `Stress modéré (score=${stressScore.toFixed(2)}). ${alarmCount} alarmes et ${Math.round(overloadRatio * 100)}% de surcharge sur la période.`
      : stressScore < 0.5
      ? `Stress élevé (score=${stressScore.toFixed(2)}). Fréquence d'alarmes significative. Révision des seuils conseillée.`
      : `Stress critique (score=${stressScore.toFixed(2)}). L'actif est régulièrement sollicité hors limites — révision urgente.`;
  return { value: Math.max(0, Math.min(100, iso)), explanation };
}

/**
 * IRS — Indice de Résilience Structurelle
 * Fusionne : MTBF tendance, âge vs cycle de vie, qualité de maintenance récente
 */
function computeIRS(
  mtbfTrend: number,       // MTBF actuel vs MTBF nominal (ratio 0-2+)
  ageRatio: number,        // âge actuel / durée de vie nominale (0-1+)
  maintenanceQuality: number, // score qualité maintenance [0-1]
  recentFailures: number   // nombre de défaillances dans la fenêtre
): { value: number; explanation: string } {
  const mtbfScore = Math.min(1, mtbfTrend);
  const ageScore = 1 - Math.min(1, ageRatio);
  const failurePenalty = Math.exp(-0.5 * recentFailures);
  const irs = Math.round(100 * (0.35 * mtbfScore + 0.30 * ageScore + 0.20 * maintenanceQuality + 0.15 * failurePenalty));
  const explanation =
    irs >= 80
      ? `Résilience structurelle excellente. MTBF stable, maintenance de qualité, âge maîtrisé.`
      : irs >= 60
      ? `Résilience correcte. Ratio âge/cycle=${Math.round(ageRatio * 100)}%, MTBF tendance=${Math.round(mtbfTrend * 100)}% du nominal.`
      : irs >= 40
      ? `Résilience dégradée. ${recentFailures} défaillances récentes. Plan de maintenance renforcé recommandé.`
      : `Résilience critique. L'actif montre des signes structurels de vieillissement prématuré ou de surexploitation.`;
  return { value: Math.max(0, Math.min(100, irs)), explanation };
}

// ─── Adaptive weight calculation ─────────────────────────────────────────────

function adaptiveWeights(
  dataQuality: { hasIot: boolean; hasHistory: boolean; hasMaintenance: boolean }
): { ISD: number; IDC: number; ISO: number; IRS: number } {
  if (!dataQuality.hasIot) {
    // No IoT: lean on history and maintenance
    return { ISD: 0.10, IDC: 0.15, ISO: 0.35, IRS: 0.40 };
  }
  if (!dataQuality.hasHistory) {
    // No history: lean on current sensors
    return { ISD: 0.45, IDC: 0.05, ISO: 0.35, IRS: 0.15 };
  }
  // Full data
  return { ISD: 0.35, IDC: 0.25, ISO: 0.25, IRS: 0.15 };
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

  const equipmentName = equipment?.name ?? `Équipement #${equipmentId}`;

  // ── Fetch sensor readings ─────────────────────────────────────────────────
  const recentSensors = await db
    .select()
    .from(iotSensorData)
    .where(and(eq(iotSensorData.equipmentId, equipmentId), gte(iotSensorData.timestamp!, shortStart)))
    .orderBy(desc(iotSensorData.timestamp!))
    .limit(500);

  const historicalSensors = await db
    .select()
    .from(iotSensorData)
    .where(and(eq(iotSensorData.equipmentId, equipmentId), gte(iotSensorData.timestamp!, longStart), lte(iotSensorData.timestamp!, shortStart)))
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
  const isdResult = nominalModel
    ? computeISD(currentMeans, nominalModel, 0.4)
    : { value: 70, dM: 0, explanation: "Modèle nominal non calibré — historique de capteurs insuffisant." };

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
  const isoResult = computeISO(alarmRows.length, 0, criticalRows.length, overloadRatio, windowDaysShort);

  // ─── IRS ─────────────────────────────────────────────────────────────────
  const corrective = recentWOs.filter(w => w.type === "corrective" || w.type === "emergency");
  const preventive = recentWOs.filter(w => w.type === "preventive");
  const completed = recentWOs.filter(w => w.status === "completed");
  const maintenanceQuality = recentWOs.length > 0 ? (completed.length / recentWOs.length) * (1 - preventive.length / Math.max(recentWOs.length, 1) * 0.5) : 0.5;

  const installDate = equipment?.installationDate ? new Date(equipment.installationDate) : null;
  const lifespan = equipment?.lifespan ?? 20; // years
  const ageYears = installDate ? (now.getTime() - installDate.getTime()) / (365.25 * 86_400_000) : 0;
  const ageRatio = lifespan > 0 ? ageYears / lifespan : 0.3;

  // MTBF trend: compare corrective WO rate vs baseline expectation
  const correctiveRate = corrective.length / Math.max(windowDaysLong / 30, 1); // per month
  const mtbfTrend = Math.exp(-0.3 * correctiveRate); // 1.0 = no failures, <1 = degrading

  const irsResult = computeIRS(mtbfTrend, ageRatio, Math.min(1, maintenanceQuality), corrective.length);

  // ─── IMCA composite ──────────────────────────────────────────────────────
  const imcaRaw =
    weights.ISD * isdResult.value +
    weights.IDC * idcResult.value +
    weights.ISO * isoResult.value +
    weights.IRS * irsResult.value;
  const IMCA = Math.round(Math.max(0, Math.min(100, imcaRaw)));

  // ─── Alert level & trend ─────────────────────────────────────────────────
  const alertLevel: IMCAResult["alertLevel"] =
    IMCA >= 75 ? "ok" : IMCA >= 55 ? "watch" : IMCA >= 35 ? "warning" : "critical";

  const subValues = [isdResult.value, idcResult.value, isoResult.value, irsResult.value];
  const minSub = Math.min(...subValues);
  const trend: IMCAResult["trend"] =
    IMCA >= 75 && idcResult.kl < 0.1 ? "improving"
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

  // ─── Estimated RUL (simplified) ──────────────────────────────────────────
  const rul_hours: number | null =
    IMCA < 20 ? Math.round(isdResult.dM > 0 ? 200 / isdResult.dM : 50)
    : IMCA < 40 ? Math.round(500 / Math.max(1, isdResult.dM))
    : IMCA < 60 ? Math.round(2000 / Math.max(0.5, isdResult.dM))
    : null;

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
    klDivergence: parseFloat(idcResult.kl.toFixed(4)),
    weights,
    trend,
    alertLevel,
    rul_hours,
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
