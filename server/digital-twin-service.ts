/**
 * Digital Twin — jumeau numérique par équipement.
 * "Chaque équipement possède son jumeau" (ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md, section 7) :
 * ce service instancie/exécute les modèles physiques de physics-models.ts avec les
 * paramètres CALIBRÉS de l'équipement précis (pas les valeurs par défaut génériques du type),
 * fusionnés avec les dernières lectures capteurs IoT réelles.
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import { digitalTwins, equipmentRegistry, iotSensorData, type DigitalTwin } from "@shared/schema";
import { getPhysicsModel, type PhysicsModelResult } from "./cognitive-layers/physics-models";

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

  return { twin: updated, result };
}

export async function calibrateTwin(equipmentId: number, tenantId: string, calibration: Record<string, number>): Promise<DigitalTwin> {
  const twin = await getOrCreateTwin(equipmentId, tenantId);
  const [updated] = await db.update(digitalTwins).set({
    calibration, isCalibrated: true, updatedAt: new Date(),
  }).where(eq(digitalTwins.id, twin.id)).returning();
  return updated;
}
