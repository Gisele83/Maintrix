/**
 * Digital Twin — jumeau numérique par équipement.
 * "Chaque équipement possède son jumeau" (ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md, section 7) :
 * ce service instancie/exécute les modèles physiques de physics-models.ts avec les
 * paramètres CALIBRÉS de l'équipement précis (pas les valeurs par défaut génériques du type),
 * fusionnés avec les dernières lectures capteurs IoT réelles.
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import { digitalTwins, equipmentRegistry, iotSensorData, workOrders, type DigitalTwin } from "@shared/schema";
import { getPhysicsModel, type PhysicsModelResult } from "./cognitive-layers/physics-models";

// Même seuil que la coloration "rouge" déjà visible par l'utilisateur côté client
// (client/src/pages/digital-twin.tsx, fonction deviationColor) — pas un nouveau chiffre inventé,
// on le rend simplement actionnable côté serveur.
const CRITICAL_DEVIATION_THRESHOLD = 0.7;

export interface TwinWorkOrderOutcome {
  created: boolean;
  workOrderId?: number;
  orderNumber?: string;
  reason: string;
}

/**
 * Digital Twin → GMAO : auto-création d'un OT quand la déviation du jumeau dépasse le seuil
 * critique. Même principe réactif que gmao-storage.ts::checkAndGenerateCounterAlert (déclenché
 * juste après la mise à jour de l'état, pas de cron). Garde-fou anti-doublon identique à
 * predictive-maintenance-engine.ts::maybeCreateAutoWorkOrder.
 */
async function maybeCreateWorkOrderFromTwin(
  equipmentId: number, tenantId: string, result: PhysicsModelResult | null,
): Promise<TwinWorkOrderOutcome> {
  if (!result || result.deviationFromNormal <= CRITICAL_DEVIATION_THRESHOLD) {
    return {
      created: false,
      reason: result
        ? `Déviation ${result.deviationFromNormal.toFixed(2)} sous le seuil critique (${CRITICAL_DEVIATION_THRESHOLD})`
        : "Aucun résultat de modèle physique disponible",
    };
  }

  const existingOpen = await db.select().from(workOrders)
    .where(and(eq(workOrders.equipmentId, equipmentId), eq(workOrders.tenantId, tenantId)))
    .orderBy(desc(workOrders.createdAt))
    .limit(5);
  const alreadyOpen = existingOpen.find(wo => wo.orderType === "digital_twin" && wo.status !== "completed" && wo.status !== "cancelled");
  if (alreadyOpen) {
    return { created: false, workOrderId: alreadyOpen.id, orderNumber: alreadyOpen.orderNumber, reason: "Un OT jumeau numérique est déjà ouvert pour cet équipement" };
  }

  const [equipment] = await db.select().from(equipmentRegistry)
    .where(and(eq(equipmentRegistry.id, equipmentId), eq(equipmentRegistry.tenantId, tenantId))).limit(1);
  const equipmentName = equipment?.equipmentName ?? `Équipement #${equipmentId}`;

  const orderNumber = `WO-TWIN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const [created] = await db.insert(workOrders).values({
    tenantId,
    orderNumber,
    equipmentId,
    orderType: "digital_twin",
    title: `Intervention jumeau numérique — ${equipmentName}`,
    description: `Déviation du jumeau numérique (${(result.deviationFromNormal * 100).toFixed(0)}%) au-delà du seuil critique. ${result.physicalExplanation}`,
    priority: result.deviationFromNormal > 0.85 ? "urgent" : "high",
    status: "pending",
  }).returning();

  return { created: true, workOrderId: created.id, orderNumber: created.orderNumber, reason: `Créé automatiquement — déviation ${(result.deviationFromNormal * 100).toFixed(0)}%` };
}

/** Trouve le jumeau d'un équipement, ou le crée (non calibré) au premier accès. */
export async function getOrCreateTwin(equipmentId: number, tenantId: string): Promise<DigitalTwin> {
  const [existing] = await db.select().from(digitalTwins)
    .where(and(eq(digitalTwins.equipmentId, equipmentId), eq(digitalTwins.tenantId, tenantId))).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(digitalTwins).values({
    tenantId, equipmentId, calibration: {}, isCalibrated: false,
  }).returning();
  return created;
}

/** Dernière valeur connue pour chaque type de capteur d'un équipement. */
async function getLatestSensorReadings(equipmentId: number): Promise<Record<string, number>> {
  const readings = await db.select().from(iotSensorData)
    .where(eq(iotSensorData.equipmentId, equipmentId))
    .orderBy(desc(iotSensorData.timestamp))
    .limit(200); // fenêtre récente, suffisante pour couvrir tous les types de capteurs actifs

  const latestByType: Record<string, number> = {};
  for (const r of readings) {
    if (!(r.sensorType in latestByType)) {
      latestByType[r.sensorType] = Number(r.value);
    }
  }
  return latestByType;
}

export interface DigitalTwinRunResult {
  twin: DigitalTwin;
  result: PhysicsModelResult | null;
  autoWorkOrder?: TwinWorkOrderOutcome;
}

/**
 * Exécute le modèle physique de l'équipement : calibration (paramètres fixes propres à
 * cet équipement) fusionnée avec les dernières lectures capteurs réelles (valeurs dynamiques).
 */
export async function runTwin(equipmentId: number, tenantId: string): Promise<DigitalTwinRunResult> {
  const twin = await getOrCreateTwin(equipmentId, tenantId);

  const [equipment] = await db.select().from(equipmentRegistry)
    .where(and(eq(equipmentRegistry.id, equipmentId), eq(equipmentRegistry.tenantId, tenantId))).limit(1);
  if (!equipment) return { twin, result: null };

  const liveSensorData = await getLatestSensorReadings(equipmentId);
  const calibration = (twin.calibration as Record<string, number>) ?? {};
  // La calibration fournit la ligne de base propre à cet équipement (bearingType, ratedCurrent...) ;
  // les lectures capteurs réelles priment pour les valeurs dynamiques (temperature, vibration...).
  const mergedParams = { ...calibration, ...liveSensorData };

  const result = getPhysicsModel().selectAndRunModel(equipment.equipmentType, mergedParams);

  const [updated] = await db.update(digitalTwins).set({
    lastResult: result ?? null,
    lastRemainingUsefulLife: result?.remainingUsefulLife ?? null,
    lastComputedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(digitalTwins.id, twin.id)).returning();

  const autoWorkOrder = await maybeCreateWorkOrderFromTwin(equipmentId, tenantId, result);

  return { twin: updated, result, autoWorkOrder };
}

export async function calibrateTwin(equipmentId: number, tenantId: string, calibration: Record<string, number>): Promise<DigitalTwin> {
  const twin = await getOrCreateTwin(equipmentId, tenantId);
  const [updated] = await db.update(digitalTwins).set({
    calibration, isCalibrated: Object.keys(calibration).length > 0, updatedAt: new Date(),
  }).where(eq(digitalTwins.id, twin.id)).returning();
  return updated;
}
