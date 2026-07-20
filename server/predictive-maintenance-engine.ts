/**
 * Predictive Maintenance Engine — UNIFIÉ
 * Health Score → RUL → Anomaly Detection → Failure Prediction → Automatic Work Order
 * Voir ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md, section 8.
 *
 * Ce fichier n'invente pas de nouvelle logique de calcul — il orchestre 4 briques déjà
 * réelles mais jusqu'ici dispersées et jamais appelées ensemble :
 * - Health Score + Failure Prediction : server/integrations/predictive-engine.ts (PredictiveMaintenanceEngine)
 * - RUL stochastique : server/stochastic-rul.ts (Wiener + Gamma, données IoT réelles)
 * - Anomaly Detection : server/agents/equipment-agent.ts (z-score sur baseline calibrée)
 * - Automatic Work Order : insertion directe dans work_orders (même table que cognitive-kernel)
 */

import { eq, gte, and, desc } from "drizzle-orm";
import { db } from "./db";
import { equipmentRegistry, iotSensorData, workOrders } from "@shared/schema";
import { PredictiveMaintenanceEngine } from "./integrations/predictive-engine";
import { computeStochasticRUL, type StochasticRULResult } from "./stochastic-rul";
import { getGlobalAgent } from "./agents/global-agent";
import type { AnomalyDetection } from "./cognitive-layers/layer-contracts";

const predictiveEngine = new PredictiveMaintenanceEngine();

export interface UnifiedPredictiveResult {
  equipmentId: number;
  equipmentName: string;
  equipmentType: string;
  healthScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  rul: { available: boolean; result?: StochasticRULResult; nReadings?: number; message?: string };
  anomaly: { available: boolean; detections: AnomalyDetection[]; agentHealthScore?: number; message?: string };
  predictedFailures: any[];
  recommendations: any[];
  autoWorkOrder: { created: boolean; workOrderId?: number; orderNumber?: string; reason: string };
}

/** Étape 2 — RUL stochastique depuis les vraies lectures IoT (même logique que /api/stochastic-rul/equipment/:id). */
async function computeEquipmentRUL(equipmentId: number, windowDays = 90, deltaTHours = 24, failureIMCA = 30) {
  const cutoff = new Date(Date.now() - windowDays * 86_400_000);
  const sensorRows = await db.select({ value: iotSensorData.value, timestamp: iotSensorData.timestamp })
    .from(iotSensorData)
    .where(and(eq(iotSensorData.equipmentId, equipmentId), gte(iotSensorData.timestamp, cutoff)))
    .orderBy(iotSensorData.timestamp)
    .limit(5000);

  if (sensorRows.length < 3) {
    return { available: false as const, nReadings: sensorRows.length, message: "Données IoT insuffisantes pour ajuster un modèle stochastique" };
  }

  const binMs = deltaTHours * 3_600_000;
  const t0 = sensorRows[0].timestamp?.getTime() ?? Date.now();
  const bins = new Map<number, number[]>();
  for (const row of sensorRows) {
    const bin = Math.floor(((row.timestamp?.getTime() ?? t0) - t0) / binMs);
    if (!bins.has(bin)) bins.set(bin, []);
    bins.get(bin)!.push(Number(row.value) || 0);
  }

  const allValues = sensorRows.map(r => Number(r.value) || 0);
  const sorted = [...allValues].sort((a, b) => a - b);
  const globalMedian = sorted[Math.floor(sorted.length / 2)] || 1;

  const imcaHistory: number[] = [];
  for (const k of [...bins.keys()].sort((a, b) => a - b)) {
    const vals = bins.get(k)!;
    const binMean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const relDev = Math.abs(binMean - globalMedian) / (globalMedian || 1);
    imcaHistory.push(Math.round(Math.max(0, Math.min(100, 100 * Math.exp(-2 * relDev)))));
  }

  if (imcaHistory.length < 3) {
    return { available: false as const, nReadings: sensorRows.length, message: "Trop peu de périodes temporelles distinctes pour ajuster un modèle" };
  }

  const currentIMCA = imcaHistory[imcaHistory.length - 1];
  const result = computeStochasticRUL(imcaHistory, currentIMCA, deltaTHours, failureIMCA);
  return { available: true as const, result, nReadings: sensorRows.length };
}

/**
 * Étape 3 — Anomaly Detection à la demande, sur l'EquipmentAgent déjà enregistré (s'il existe).
 * Rejoue les dernières lectures capteurs réelles dans l'agent pour rafraîchir sa détection
 * z-score plutôt que de se contenter d'un historique potentiellement périmé.
 */
async function runRealtimeAnomalyCheck(equipmentId: number) {
  const agent = getGlobalAgent().findEquipmentAgent(equipmentId);
  if (!agent) {
    return { available: false as const, detections: [], message: "Équipement non enregistré auprès d'un agent (limite de 20 équipements au démarrage)" };
  }

  const latestBySensor = await db.select().from(iotSensorData)
    .where(eq(iotSensorData.equipmentId, equipmentId))
    .orderBy(desc(iotSensorData.timestamp))
    .limit(50);

  const seenTypes = new Set<string>();
  const freshDetections: AnomalyDetection[] = [];
  for (const reading of latestBySensor) {
    if (seenTypes.has(reading.sensorType)) continue;
    seenTypes.add(reading.sensorType);
    const anomaly = agent.processSensorReading(reading.sensorType, Number(reading.value), reading.unit);
    if (anomaly) freshDetections.push(anomaly);
  }

  const state = agent.getState();
  return { available: true as const, detections: freshDetections, agentHealthScore: state.healthScore };
}

/** Étape 5 — Automatic Work Order si le risque est élevé/critique, sans dupliquer un OT déjà ouvert. */
async function maybeCreateAutoWorkOrder(
  equipmentId: number, tenantId: string, equipmentName: string,
  riskLevel: string, predictedFailures: any[],
): Promise<UnifiedPredictiveResult["autoWorkOrder"]> {
  if (riskLevel !== "high" && riskLevel !== "critical") {
    return { created: false, reason: `Risque "${riskLevel}" — pas de seuil déclenchant une création automatique` };
  }

  const existingOpen = await db.select().from(workOrders)
    .where(and(
      eq(workOrders.equipmentId, equipmentId),
      eq(workOrders.tenantId, tenantId),
    ))
    .orderBy(desc(workOrders.createdAt))
    .limit(5);
  const alreadyOpen = existingOpen.find(wo => wo.orderType === "predictive" && wo.status !== "completed" && wo.status !== "cancelled");
  if (alreadyOpen) {
    return { created: false, workOrderId: alreadyOpen.id, orderNumber: alreadyOpen.orderNumber, reason: "Un OT prédictif est déjà ouvert pour cet équipement" };
  }

  const topFailure = predictedFailures[0];
  const orderNumber = `WO-PRED-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const [created] = await db.insert(workOrders).values({
    tenantId,
    orderNumber,
    equipmentId,
    orderType: "predictive",
    title: `Intervention prédictive — ${equipmentName}`,
    description: topFailure
      ? `Risque "${riskLevel}" détecté par le Predictive Maintenance Engine. Panne anticipée : ${topFailure.name ?? topFailure.patternId ?? "non spécifiée"}.`
      : `Risque "${riskLevel}" détecté par le Predictive Maintenance Engine.`,
    priority: riskLevel === "critical" ? "urgent" : "high",
    status: "pending",
  }).returning();

  return { created: true, workOrderId: created.id, orderNumber: created.orderNumber, reason: `Créé automatiquement — risque "${riskLevel}"` };
}

/** Point d'entrée unique — exécute le pipeline complet pour un équipement. */
export async function runPredictiveEngine(equipmentId: number, tenantId: string): Promise<UnifiedPredictiveResult> {
  const [equipment] = await db.select().from(equipmentRegistry)
    .where(and(eq(equipmentRegistry.id, equipmentId), eq(equipmentRegistry.tenantId, tenantId))).limit(1);
  if (!equipment) {
    throw new Error(`Équipement ${equipmentId} introuvable`);
  }

  // Étapes 1 + 4 : Health Score + Failure Prediction (anomalyScore désormais réel, pas Math.random())
  const analysis = await predictiveEngine.analyzeEquipmentHealth(equipmentId, tenantId);

  // Étape 2 : RUL stochastique (données IoT réelles)
  const rulOutcome = await computeEquipmentRUL(equipmentId);
  const rul = rulOutcome.available
    ? { available: true as const, result: rulOutcome.result, nReadings: rulOutcome.nReadings }
    : { available: false as const, nReadings: rulOutcome.nReadings, message: rulOutcome.message };

  // Étape 3 : Anomaly Detection temps réel
  const anomalyOutcome = await runRealtimeAnomalyCheck(equipmentId);
  const anomaly = anomalyOutcome.available
    ? { available: true as const, detections: anomalyOutcome.detections, agentHealthScore: anomalyOutcome.agentHealthScore }
    : { available: false as const, detections: [], message: anomalyOutcome.message };

  // Étape 5 : Automatic Work Order
  const autoWorkOrder = await maybeCreateAutoWorkOrder(
    equipmentId, tenantId, equipment.equipmentName, analysis.riskLevel, analysis.predictedFailures,
  );

  return {
    equipmentId,
    equipmentName: equipment.equipmentName,
    equipmentType: equipment.equipmentType,
    healthScore: analysis.healthScore,
    riskLevel: analysis.riskLevel as UnifiedPredictiveResult["riskLevel"],
    rul,
    anomaly,
    predictedFailures: analysis.predictedFailures,
    recommendations: analysis.recommendations,
    autoWorkOrder,
  };
}
