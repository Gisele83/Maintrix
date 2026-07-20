/**
 * MODULE DE SIMULATION PROSPECTIVE — Brevet N°2 MAINTRIX-SCA-ORC
 *
 * Compare formellement trois scénarios avant toute décision autonome :
 *   IMMÉDIAT    — intervention planifiée maintenant (t=0)
 *   DIFFÉRÉ     — intervention reportée de d jours
 *   NON_INTERVENTION — aucune action, dégradation libre
 *
 * Pour chaque scénario : courbe de dégradation IMCA(t), probabilité de défaillance,
 * coût total attendu (maintenance + arrêt + défaillance), impact OEE, score de risque.
 * Produit une recommandation formelle avant émission de toute commande autonome.
 */

import { db } from "./db";
import {
  equipmentRegistry, workOrders,
} from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";
import { computeIMCA } from "./imca-engine";
import { inverseGaussianCDF, type WienerParams } from "./stochastic-rul";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ScenarioType = "IMMEDIATE" | "DEFERRED" | "NO_INTERVENTION";

export interface DegradationPoint {
  day: number;
  imca: number;
  failureProb: number;
  oeeImpact: number;  // percentage points lost
}

export interface ScenarioCost {
  maintenance: number;         // planned maintenance cost (€)
  downtime: number;            // production loss (€)
  failureRisk: number;         // expected cost of failure × probability (€)
  total: number;               // total expected cost (€)
  currency: string;
}

export interface ScenarioResult {
  id: ScenarioType;
  label: string;
  description: string;
  deferDays: number;
  degradationCurve: DegradationPoint[];   // 90-day horizon
  failureProbability30d: number;           // P(failure within 30 days)
  failureProbability90d: number;           // P(failure within 90 days)
  cost: ScenarioCost;
  riskScore: number;                       // 0-100, lower = safer
  oeeAverageLoss: number;                  // avg OEE points lost over 90d
  recommendationWeight: number;            // composite score for comparison (lower = better)
  pros: string[];
  cons: string[];
  imcaAtDecision: number;                  // IMCA at the moment of potential intervention
  imcaAtEnd: number;                       // IMCA at day-90
  rul_days: number | null;                 // estimated RUL at current trajectory
}

export interface ProspectiveSimulationResult {
  equipmentId: number;
  equipmentName: string;
  criticalityLevel: string;
  currentIMCA: number;
  currentDegradationRate: number;          // IMCA points lost per day
  timestamp: string;
  horizon_days: number;
  scenarios: Record<ScenarioType, ScenarioResult>;
  recommendation: {
    scenario: ScenarioType;
    confidence: number;                    // 0-1
    urgencyLevel: "low" | "moderate" | "high" | "critical";
    rationale: string;
    decisionDeadline: string | null;       // ISO date by which decision must be made
    autonomyCompatible: boolean;           // can this be auto-executed or needs human approval?
  };
  comparisonMatrix: ComparisonMatrix;
}

export interface ComparisonMatrix {
  costRanking: ScenarioType[];
  riskRanking: ScenarioType[];
  oeeRanking: ScenarioType[];
  overallRanking: ScenarioType[];
}

// ─── Degradation models ───────────────────────────────────────────────────────

/**
 * Weibull-inspired degradation: IMCA(t) = IMCA_0 × exp(−λ × (t/τ)^β)
 * λ: degradation intensity (estimated from alarm rate + current deviation)
 * β: shape factor (1.0 = exponential, 1.5 = accelerating wear-out)
 * τ: characteristic time scale (days)
 */
function projectIMCA(
  imca0: number,
  t: number,
  lambda: number,
  beta: number = 1.3,
  tau: number = 30
): number {
  const degraded = imca0 * Math.exp(-lambda * Math.pow(t / tau, beta));
  return Math.max(0, Math.min(100, degraded));
}

/**
 * Projection de dégradation par processus de Wiener (Brevet N°1, chapitre 6) —
 * trajectoire moyenne X(t) = X₀ + μt réutilisant la dérive μ estimée par MLE
 * dans le moteur RUL stochastique, plutôt qu'un modèle de Weibull disjoint.
 * μPerDay est exprimé en points de dégradation IMCA par jour.
 */
function projectIMCAWiener(imca0: number, tDays: number, muPerDay: number): number {
  const d0 = 100 - imca0;
  const dt = d0 + muPerDay * tDays;
  return Math.max(0, Math.min(100, 100 - dt));
}

/**
 * Probabilité de défaillance à l'horizon tDays via la CDF Inverse Gaussienne
 * exacte du processus de Wiener (chapitre 6.2.1), au lieu d'une heuristique
 * ad hoc. D = marge de dégradation restante ; m = D/μ ; λ = D²/σ².
 */
function wienerFailureProbAtDay(
  tDays: number,
  currentDegradation: number,
  failureThresholdDegradation: number,
  wienerParams: WienerParams
): number {
  const D = failureThresholdDegradation - currentDegradation;
  if (D <= 0) return 1;
  if (wienerParams.mu <= 0) return 0;
  const m = D / wienerParams.mu;
  const lambda = (D ** 2) / (wienerParams.sigma ** 2);
  return Math.max(0, Math.min(1, inverseGaussianCDF(tDays * 24, m, lambda)));
}

/**
 * Post-maintenance recovery: IMCA recovers toward imca_target using exponential approach.
 * imca_post(t) = imca_target − (imca_target − imca_pre) × exp(−κ × t)
 * κ: recovery rate (typically 0.15-0.4 depending on intervention type)
 */
function projectPostMaintenance(
  imcaPreMaint: number,
  imcaTarget: number,
  t: number,
  kappa: number = 0.25
): number {
  const recovered = imcaTarget - (imcaTarget - imcaPreMaint) * Math.exp(-kappa * t);
  return Math.max(0, Math.min(100, recovered));
}

/**
 * Failure probability given IMCA level.
 * P(failure) increases sharply below IMCA=40 (critical zone).
 * P(failure | IMCA=x) = 1 − exp(−μ × max(0, 60−x)² / 800)
 */
function failureProbability(imca: number, mu: number = 1.0): number {
  const riskZone = Math.max(0, 60 - imca);
  return 1 - Math.exp(-mu * riskZone * riskZone / 800);
}

/**
 * Cumulative failure probability over a horizon.
 * P(failure in [0,T]) = 1 − ∏(1 − P(failure|IMCA(t))) over t=0..T
 */
function cumulativeFailureProb(curve: DegradationPoint[], horizonDays: number): number {
  let survivalProb = 1.0;
  for (const point of curve.filter(p => p.day <= horizonDays)) {
    survivalProb *= (1 - point.failureProb * (1 / Math.max(curve.length, 1)));
  }
  return Math.max(0, Math.min(1, 1 - survivalProb));
}

/**
 * OEE impact as function of IMCA: linear beyond threshold.
 * OEE_loss(IMCA) = 0 if IMCA >= 80, else (80 − IMCA) × 0.15 percentage points per point
 */
function oeeImpact(imca: number): number {
  if (imca >= 80) return 0;
  return Math.min(25, (80 - imca) * 0.15);
}

// ─── Cost model ───────────────────────────────────────────────────────────────

interface CostParams {
  plannedMaintenanceCost: number;   // €
  hourlyProductionValue: number;    // €/h
  interventionDowntimeHours: number;
  failureCost: number;              // catastrophic failure cost €
  urgencyMultiplier: number;        // cost premium for emergency/deferred
  deferDays: number;
}

function computeCost(
  scenario: ScenarioType,
  curve: DegradationPoint[],
  failureProb90d: number,
  params: CostParams
): ScenarioCost {
  const { plannedMaintenanceCost, hourlyProductionValue, interventionDowntimeHours, failureCost, urgencyMultiplier, deferDays } = params;

  const downtimePerDay = hourlyProductionValue * 24;
  const avgOeeLoss = curve.reduce((s, p) => s + p.oeeImpact, 0) / Math.max(curve.length, 1);

  if (scenario === "NO_INTERVENTION") {
    const productionLoss = avgOeeLoss * 0.01 * downtimePerDay * 90;
    const failureExpected = failureProb90d * failureCost;
    const total = productionLoss + failureExpected;
    return { maintenance: 0, downtime: productionLoss, failureRisk: failureExpected, total, currency: "EUR" };
  }

  if (scenario === "IMMEDIATE") {
    const maintenanceCost = plannedMaintenanceCost;
    const downtimeCost = interventionDowntimeHours * hourlyProductionValue;
    const residualFailure = failureProb90d * failureCost * 0.05; // 5% residual risk post-maintenance
    const total = maintenanceCost + downtimeCost + residualFailure;
    return { maintenance: maintenanceCost, downtime: downtimeCost, failureRisk: residualFailure, total, currency: "EUR" };
  }

  // DEFERRED
  const deferProductionLoss = avgOeeLoss * 0.01 * downtimePerDay * deferDays;
  const maintenanceCost = plannedMaintenanceCost * urgencyMultiplier;
  const downtimeCost = interventionDowntimeHours * hourlyProductionValue * urgencyMultiplier;
  const residualFailure = failureProb90d * failureCost * 0.08;
  const total = deferProductionLoss + maintenanceCost + downtimeCost + residualFailure;
  return { maintenance: maintenanceCost, downtime: deferProductionLoss + downtimeCost, failureRisk: residualFailure, total, currency: "EUR" };
}

// ─── Scenario builder ─────────────────────────────────────────────────────────

function buildScenario(
  type: ScenarioType,
  imca0: number,
  lambda: number,
  beta: number,
  costParams: CostParams,
  mu: number = 1.0,
  wienerParams?: WienerParams,
  failureThresholdDegradation: number = 70
): ScenarioResult {
  const horizon = 90;
  const steps = 91; // day 0 to day 90
  const deferDays = costParams.deferDays;

  // Trajectoire de dégradation libre : processus de Wiener réel (Brevet N°1,
  // chapitre 6) quand la dérive μ estimée par MLE est disponible et positive,
  // sinon repli sur l'heuristique de Weibull.
  const useWiener = !!wienerParams && wienerParams.mu > 0;
  const projectFree = (t: number) =>
    useWiener ? projectIMCAWiener(imca0, t, wienerParams!.mu * 24) : projectIMCA(imca0, t, lambda, beta);

  const degradationCurve: DegradationPoint[] = [];

  for (let d = 0; d < steps; d++) {
    let imca: number;

    if (type === "IMMEDIATE") {
      if (d === 0) {
        imca = imca0;
      } else {
        // Recovery after immediate intervention (target = 90)
        imca = projectPostMaintenance(imca0, 90, d, 0.2);
      }
    } else if (type === "DEFERRED") {
      if (d <= deferDays) {
        imca = projectFree(d);
      } else {
        const imcaAtDefer = projectFree(deferDays);
        imca = projectPostMaintenance(imcaAtDefer, 88, d - deferDays, 0.18);
      }
    } else {
      // NO_INTERVENTION — free degradation
      imca = projectFree(d);
    }

    degradationCurve.push({
      day: d,
      imca: Math.round(imca * 10) / 10,
      failureProb: parseFloat(failureProbability(imca, mu).toFixed(4)),
      oeeImpact: parseFloat(oeeImpact(imca).toFixed(2)),
    });
  }

  // Probabilité de défaillance : CDF Inverse Gaussienne exacte du processus de
  // Wiener pour le scénario NON_INTERVENTION (dégradation libre pure, fidèle
  // au modèle du chapitre 6) ; intégration numérique du risque instantané
  // pour les scénarios avec récupération post-intervention (hors périmètre
  // du modèle de premier passage).
  const currentDegradation = 100 - imca0;
  const fp30 = type === "NO_INTERVENTION" && useWiener
    ? wienerFailureProbAtDay(30, currentDegradation, failureThresholdDegradation, wienerParams!)
    : cumulativeFailureProb(degradationCurve, 30);
  const fp90 = type === "NO_INTERVENTION" && useWiener
    ? wienerFailureProbAtDay(90, currentDegradation, failureThresholdDegradation, wienerParams!)
    : cumulativeFailureProb(degradationCurve, 90);
  const avgOeeLoss = degradationCurve.reduce((s, p) => s + p.oeeImpact, 0) / steps;
  const imcaAtEnd = degradationCurve[90]?.imca ?? 0;
  const imcaAtDecision = type === "DEFERRED" ? degradationCurve[Math.min(deferDays, 90)]?.imca ?? imca0 : imca0;
  const cost = computeCost(type, degradationCurve, fp90, costParams);

  // Risk score: 0-100 composite of failure prob + cost + OEE loss
  const riskScore = Math.round(
    fp90 * 40 +                       // 40% weight on failure probability
    (avgOeeLoss / 25) * 30 +          // 30% weight on OEE loss
    (cost.total / (costParams.failureCost + 1)) * 30  // 30% weight on cost ratio
  );

  // Recommendation weight (lower = better choice)
  const recommendationWeight = cost.total * 0.4 + riskScore * 100 * 0.4 + avgOeeLoss * 100 * 0.2;

  // RUL estimation
  let rul_days: number | null = null;
  if (type === "NO_INTERVENTION") {
    const criticalDay = degradationCurve.find(p => p.imca < 30);
    rul_days = criticalDay ? criticalDay.day : null;
  }

  const labels: Record<ScenarioType, string> = {
    IMMEDIATE: "Intervention Immédiate",
    DEFERRED: `Intervention Différée (J+${deferDays})`,
    NO_INTERVENTION: "Non-Intervention",
  };

  const descriptions: Record<ScenarioType, string> = {
    IMMEDIATE: `Planification et exécution de l'intervention dès maintenant. L'actif retrouve un niveau de santé nominal (~90/100) après remise en état.`,
    DEFERRED: `L'intervention est reportée de ${deferDays} jours (prochaine fenêtre de maintenance). La dégradation se poursuit pendant la période d'attente.`,
    NO_INTERVENTION: `Aucune action corrective. L'actif continue sa trajectoire de dégradation selon le modèle de Weibull calibré sur les données capteurs.`,
  };

  const prosMap: Record<ScenarioType, string[]> = {
    IMMEDIATE: [
      "Arrêt de la dégradation dès aujourd'hui",
      "Réduction maximale du risque de défaillance",
      "Récupération OEE optimale sur 90 jours",
      "Coût de maintenance au tarif normal (non urgence)",
    ],
    DEFERRED: [
      "Optimisation du calendrier (regroupement d'interventions)",
      `Laisse ${deferDays} jours pour préparer les pièces et ressources`,
      "Coût légèrement inférieur à une urgence",
    ],
    NO_INTERVENTION: [
      "Aucun coût de maintenance immédiat",
      "Continuité de production à court terme",
    ],
  };

  const consMap: Record<ScenarioType, string[]> = {
    IMMEDIATE: [
      `Arrêt de production estimé à ${costParams.interventionDowntimeHours}h`,
      "Mobilisation immédiate des ressources requise",
      `Coût maintenance : ~${Math.round(cost.maintenance / 1000)}k€`,
    ],
    DEFERRED: [
      `Dégradation continue pendant ${deferDays} jours (IMCA→${imcaAtDecision.toFixed(0)})`,
      `Majoration urgence si défaillance avant J+${deferDays} (+${Math.round((costParams.urgencyMultiplier - 1) * 100)}%)`,
      `Risque défaillance 30j : ${(fp30 * 100).toFixed(1)}%`,
    ],
    NO_INTERVENTION: [
      `Probabilité de défaillance à 30 jours : ${(fp30 * 100).toFixed(1)}%`,
      `Probabilité de défaillance à 90 jours : ${(fp90 * 100).toFixed(1)}%`,
      `Coût de défaillance catastrophique estimé : ${Math.round(costParams.failureCost / 1000)}k€`,
      `Perte OEE moyenne sur 90j : ${avgOeeLoss.toFixed(1)} pts`,
      rul_days ? `RUL estimé : ${rul_days} jours` : "RUL indéterminé — risque immédiat",
    ],
  };

  return {
    id: type,
    label: labels[type],
    description: descriptions[type],
    deferDays: type === "DEFERRED" ? deferDays : 0,
    degradationCurve,
    failureProbability30d: parseFloat((fp30 * 100).toFixed(2)),
    failureProbability90d: parseFloat((fp90 * 100).toFixed(2)),
    cost,
    riskScore: Math.min(100, riskScore),
    oeeAverageLoss: parseFloat(avgOeeLoss.toFixed(2)),
    recommendationWeight,
    pros: prosMap[type],
    cons: consMap[type],
    imcaAtDecision,
    imcaAtEnd,
    rul_days,
  };
}

// ─── Main simulation function ─────────────────────────────────────────────────

export async function runProspectiveSimulation(
  equipmentId: number,
  tenantId: string,
  deferDays: number = 14
): Promise<ProspectiveSimulationResult> {
  const now = new Date();
  const window30 = new Date(now.getTime() - 30 * 86_400_000);

  // ── Fetch equipment ──────────────────────────────────────────────────────
  const [equipment] = await db.select().from(equipmentRegistry)
    .where(and(eq(equipmentRegistry.id, equipmentId), eq(equipmentRegistry.tenantId, tenantId)));

  const equipmentName = equipment?.equipmentName ?? `Équipement #${equipmentId}`;
  const criticalityLevel = equipment?.criticalityLevel ?? "medium";

  // ── IMCA réel (moteur IMCA, Brevet N°1) et RUL stochastique associé ───────
  // Remplace l'ancienne estimation heuristique déconnectée : l'IMCA affiché
  // ici est désormais identique à celui du tableau de bord IMCA pour le même
  // équipement, et la dérive de Wiener (μ, σ) est réutilisée pour projeter
  // la trajectoire de dégradation (chapitre 8.2 : "combine le modèle
  // stochastique RUL").
  const imcaResult = await computeIMCA(equipmentId, tenantId);
  const currentIMCA = imcaResult.IMCA;
  const wienerParams = imcaResult.stochasticRUL?.wienerParams;

  // ── Fetch recent work orders (contexte confiance + fallback) ──────────────
  const wos = await db.select().from(workOrders)
    .where(and(eq(workOrders.equipmentId, equipmentId), gte(workOrders.createdAt!, window30)))
    .limit(50);

  // ── Fallback lambda (Weibull) — utilisé uniquement si la dérive de Wiener
  // n'est pas exploitable (μ ≤ 0 ou historique insuffisant) ─────────────────
  const criticalityMultiplier: Record<string, number> = {
    low: 0.3, medium: 0.6, high: 0.9, critical: 1.4,
  };
  const baseLambda = 0.05 + (100 - currentIMCA) * 0.003;
  const lambda = baseLambda * (criticalityMultiplier[criticalityLevel] ?? 0.6);
  const beta = 1.3; // Weibull shape: accelerating wear-out (repli)

  // ── Cost parameters (defaults, scaled by criticality) ─────────────────────
  const costBase: Record<string, { maint: number; failCost: number; prodPerHour: number; downHours: number }> = {
    low:      { maint: 2_000,  failCost: 20_000,   prodPerHour: 200,  downHours: 4  },
    medium:   { maint: 8_000,  failCost: 80_000,   prodPerHour: 800,  downHours: 8  },
    high:     { maint: 25_000, failCost: 250_000,  prodPerHour: 2500, downHours: 16 },
    critical: { maint: 60_000, failCost: 600_000,  prodPerHour: 6000, downHours: 24 },
  };
  const cb = costBase[criticalityLevel] ?? costBase.medium;

  const costParams: CostParams = {
    plannedMaintenanceCost: cb.maint,
    hourlyProductionValue: cb.prodPerHour,
    interventionDowntimeHours: cb.downHours,
    failureCost: cb.failCost,
    urgencyMultiplier: 1.35,
    deferDays,
  };

  // Failure sensitivity mu: higher for critical equipment
  const mu = criticalityMultiplier[criticalityLevel] ?? 0.6;

  // ── Build 3 scenarios ─────────────────────────────────────────────────────
  const failureThresholdDegradation = 100 - 30; // IMCA < 30 = défaillance, cohérent avec stochastic-rul.ts
  const immediate = buildScenario("IMMEDIATE", currentIMCA, lambda, beta, costParams, mu, wienerParams, failureThresholdDegradation);
  const deferred = buildScenario("DEFERRED", currentIMCA, lambda, beta, costParams, mu, wienerParams, failureThresholdDegradation);
  const noIntervention = buildScenario("NO_INTERVENTION", currentIMCA, lambda, beta, costParams, mu, wienerParams, failureThresholdDegradation);

  // ── Current degradation rate (points/day) ─────────────────────────────────
  const imcaDay1 = wienerParams && wienerParams.mu > 0
    ? projectIMCAWiener(currentIMCA, 1, wienerParams.mu * 24)
    : projectIMCA(currentIMCA, 1, lambda, beta);
  const currentDegradationRate = parseFloat((currentIMCA - imcaDay1).toFixed(3));

  // ── Recommendation ────────────────────────────────────────────────────────
  const scenarios: [ScenarioType, ScenarioResult][] = [
    ["IMMEDIATE", immediate], ["DEFERRED", deferred], ["NO_INTERVENTION", noIntervention],
  ];
  const ranked = [...scenarios].sort((a, b) => a[1].recommendationWeight - b[1].recommendationWeight);
  const bestScenario = ranked[0][0];

  const urgencyLevel: ProspectiveSimulationResult["recommendation"]["urgencyLevel"] =
    currentIMCA < 30 || noIntervention.failureProbability30d > 50 ? "critical"
    : currentIMCA < 50 || noIntervention.failureProbability30d > 25 ? "high"
    : currentIMCA < 70 ? "moderate"
    : "low";

  const confidence = Math.min(0.95, 0.5 + (wienerParams ? 0.3 : 0) + (wos.length > 0 ? 0.15 : 0));

  const rationale = urgencyLevel === "critical"
    ? `L'actif est en zone critique (IMCA=${currentIMCA.toFixed(0)}). Probabilité de défaillance à 30j : ${noIntervention.failureProbability30d.toFixed(1)}%. Une intervention immédiate est formellement requise pour éviter un arrêt catastrophique.`
    : urgencyLevel === "high"
    ? `L'actif présente une dégradation significative (IMCA=${currentIMCA.toFixed(0)}, λ=${lambda.toFixed(3)}). Le scénario optimal est ${immediate.label} pour minimiser le risque (coût attendu : ${Math.round(immediate.cost.total / 1000)}k€ vs ${Math.round(noIntervention.cost.total / 1000)}k€ sans intervention).`
    : urgencyLevel === "moderate"
    ? `L'actif montre des signes précoces de dégradation. Le report à J+${deferDays} est acceptable si l'évolution est surveillée quotidiennement (IMCA cible: ${deferred.imcaAtDecision.toFixed(0)} à J+${deferDays}).`
    : `L'actif est en bonne santé (IMCA=${currentIMCA.toFixed(0)}). Maintenir la surveillance. Le scénario différé est économiquement optimal.`;

  const decisionDeadline = urgencyLevel === "critical"
    ? now.toISOString()
    : urgencyLevel === "high"
    ? new Date(now.getTime() + 3 * 86_400_000).toISOString()
    : urgencyLevel === "moderate"
    ? new Date(now.getTime() + deferDays * 86_400_000).toISOString()
    : null;

  const autonomyCompatible = urgencyLevel !== "critical" && criticalityLevel !== "critical";

  // ── Comparison matrix ─────────────────────────────────────────────────────
  const costRanking = [...scenarios].sort((a, b) => a[1].cost.total - b[1].cost.total).map(s => s[0]);
  const riskRanking = [...scenarios].sort((a, b) => a[1].riskScore - b[1].riskScore).map(s => s[0]);
  const oeeRanking = [...scenarios].sort((a, b) => a[1].oeeAverageLoss - b[1].oeeAverageLoss).map(s => s[0]);
  const overallRanking = ranked.map(s => s[0]);

  return {
    equipmentId,
    equipmentName,
    criticalityLevel,
    currentIMCA: parseFloat(currentIMCA.toFixed(1)),
    currentDegradationRate,
    timestamp: now.toISOString(),
    horizon_days: 90,
    scenarios: { IMMEDIATE: immediate, DEFERRED: deferred, NO_INTERVENTION: noIntervention },
    recommendation: { scenario: bestScenario, confidence, urgencyLevel, rationale, decisionDeadline, autonomyCompatible },
    comparisonMatrix: { costRanking, riskRanking, oeeRanking, overallRanking },
  };
}
