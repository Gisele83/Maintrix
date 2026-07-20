/**
 * Enclave PTW conditionnant l'émission de commande — Brevet MAINTRIX-SCA-ORC,
 * revendications 1 et 9.
 *
 * Avant toute émission de commande autonome (niveau d'autonomie ≥ SUPERVISED_EXECUTION)
 * sur un équipement classé à risque (criticalityLevel high|critical), ce module
 * interdit l'exécution en l'absence d'un permis de travail actif compatible. En cas
 * d'absence de permis : interruption, génération automatique d'une demande de permis
 * pré-remplie, et notification prioritaire du rôle safety_officer.
 */

import { and, eq, isNull, or, gte, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { equipmentRegistry, permitToWork, type PermitToWork } from "@shared/schema";
import { AutonomyLevel } from "./cognitive-layers/layer-contracts";
import { notifyByRole } from "./notifications";

const RISK_CLASSES_REQUIRING_PTW = new Set(["high", "critical"]);
const ACTIVE_PERMIT_STATUS = "active";

export interface InterlockResult {
  allowed: boolean;
  permit: PermitToWork | null;
  reason: string;
}

/**
 * Recherche un permis actif couvrant l'équipement au moment présent.
 */
export async function getActivePermitForEquipment(
  equipmentId: number,
  tenantId: string
): Promise<PermitToWork | null> {
  const now = new Date();
  const [permit] = await db
    .select()
    .from(permitToWork)
    .where(
      and(
        eq(permitToWork.equipmentId, equipmentId),
        eq(permitToWork.tenantId, tenantId),
        eq(permitToWork.status, ACTIVE_PERMIT_STATUS),
        or(isNull(permitToWork.plannedStart), lte(permitToWork.plannedStart, now)),
        or(isNull(permitToWork.plannedEnd), gte(permitToWork.plannedEnd, now)),
      )
    )
    .limit(1);

  return permit ?? null;
}

/**
 * Gate d'enclavement : à appeler avant toute émission effective de commande.
 * Ne bloque que si autonomyLevel ≥ SUPERVISED_EXECUTION (3) ET l'équipement est
 * classé à risque (criticalityLevel high|critical). Sinon, laisse passer sans
 * condition — c'est le comportement existant pour les niveaux de supervision
 * humaine ou les équipements non critiques.
 */
export async function checkInterlock(
  equipmentId: number,
  autonomyLevel: AutonomyLevel,
  tenantId: string
): Promise<InterlockResult> {
  if (autonomyLevel < AutonomyLevel.SUPERVISED_EXECUTION) {
    return { allowed: true, permit: null, reason: "Autonomie < niveau 3 — enclave non applicable" };
  }

  const [equipment] = await db
    .select({ criticalityLevel: equipmentRegistry.criticalityLevel })
    .from(equipmentRegistry)
    .where(eq(equipmentRegistry.id, equipmentId))
    .limit(1);

  const criticalityLevel = equipment?.criticalityLevel ?? "medium";
  if (!RISK_CLASSES_REQUIRING_PTW.has(criticalityLevel)) {
    return { allowed: true, permit: null, reason: `Criticité ${criticalityLevel} — enclave non applicable` };
  }

  const permit = await getActivePermitForEquipment(equipmentId, tenantId);
  if (permit) {
    return { allowed: true, permit, reason: `Permis actif ${permit.permitNumber}` };
  }

  return { allowed: false, permit: null, reason: "Aucun permis actif — interruption matérielle de l'enclave" };
}

/**
 * Génère automatiquement une demande de permis pré-remplie (statut draft) suite
 * à une interruption d'enclave, et notifie le rôle safety_officer.
 */
export async function autoGeneratePermitRequest(
  equipmentId: number,
  tenantId: string,
  reason: string
): Promise<PermitToWork> {
  const [equipment] = await db
    .select({ name: equipmentRegistry.equipmentName, criticalityLevel: equipmentRegistry.criticalityLevel })
    .from(equipmentRegistry)
    .where(eq(equipmentRegistry.id, equipmentId))
    .limit(1);

  const permitNumber = `PTW-AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  const [permit] = await db
    .insert(permitToWork)
    .values({
      permitNumber,
      type: "electrical_loto",
      status: "draft",
      riskLevel: equipment?.criticalityLevel ?? "high",
      title: `Demande de permis auto-générée — enclave PTW`,
      description: `Générée automatiquement suite à une interruption du dispositif d'enclavement électronique : ${reason}. Équipement : ${equipment?.name ?? equipmentId}.`,
      equipmentId,
      tenantId,
    })
    .returning();

  await notifyByRole(
    tenantId,
    "safety_officer",
    "Interruption d'enclave PTW — permis requis",
    `Commande autonome bloquée sur l'équipement "${equipment?.name ?? equipmentId}" : aucun permis actif. Demande ${permitNumber} générée en brouillon, en attente de traitement.`
  );

  return permit;
}
