/**
 * Cycle de vie ISO 55000 — machine à états sur equipment_registry.lifecycle_stage.
 * Voir ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md, section 12.
 *
 * Distinct de :
 * - equipment_registry.operationalState : statut court terme (en marche/en panne/hors ligne),
 *   ne dit rien de la phase de vie de l'actif.
 * - asset_lifecycle (server/asset-lifecycle-routes.ts) : suivi financier/amortissement,
 *   table séparée et optionnelle par équipement, avec ses propres 7 étapes non contraintes.
 *
 * Chaque transition ici est validée contre un graphe d'états autorisés, journalisée dans
 * equipment_lifecycle_transitions (traçabilité), et renforce une arête du Knowledge Graph
 * métier (equipment)-[in_lifecycle_stage]->(stage) — occurrenceCount devient un signal réel
 * de "combien de fois cet équipement a transité par Maintenance/Diagnostic", exploitable par
 * les agents fonctionnels (Reliability, Planning) sans nouvelle modélisation.
 */

import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import { equipmentRegistry, equipmentLifecycleTransitions, workOrders } from "@shared/schema";
import { findOrCreateNode, reinforceOrCreateEdge } from "./kg-sync-service";

export const ISO_LIFECYCLE_STAGES = [
  { key: "acquisition", label: "Acquisition" },
  { key: "installation", label: "Installation" },
  { key: "mise_en_service", label: "Mise en service" },
  { key: "exploitation", label: "Exploitation" },
  { key: "surveillance", label: "Surveillance" },
  { key: "diagnostic", label: "Diagnostic" },
  { key: "maintenance", label: "Maintenance" },
  { key: "reparation", label: "Réparation" },
  { key: "essais", label: "Essais" },
  { key: "remise_en_service", label: "Remise en service" },
  { key: "amelioration", label: "Amélioration" },
  { key: "fin_de_vie", label: "Fin de vie / Remplacement" },
] as const;

export type LifecycleStage = (typeof ISO_LIFECYCLE_STAGES)[number]["key"];

const STAGE_LABELS: Record<string, string> = Object.fromEntries(ISO_LIFECYCLE_STAGES.map(s => [s.key, s.label]));

// Toute étape non terminale peut aussi basculer directement en fin_de_vie (décision
// économique, obsolescence, sinistre) — pas seulement au bout de la chaîne linéaire du
// diagramme. C'est la seule règle transversale ; le reste suit le flux du document.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  acquisition: ["installation", "fin_de_vie"],
  installation: ["mise_en_service", "fin_de_vie"],
  mise_en_service: ["exploitation", "fin_de_vie"],
  exploitation: ["surveillance", "diagnostic", "maintenance", "fin_de_vie"],
  surveillance: ["exploitation", "diagnostic", "fin_de_vie"],
  diagnostic: ["maintenance", "reparation", "exploitation", "fin_de_vie"],
  maintenance: ["essais", "exploitation", "fin_de_vie"],
  reparation: ["essais", "fin_de_vie"],
  essais: ["remise_en_service", "reparation", "fin_de_vie"],
  remise_en_service: ["exploitation", "amelioration", "fin_de_vie"],
  amelioration: ["exploitation", "fin_de_vie"],
  fin_de_vie: [],
};

export function getStageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

export function getAllowedNextStages(fromStage: string): string[] {
  return ALLOWED_TRANSITIONS[fromStage] ?? [];
}

export function canTransition(fromStage: string, toStage: string): boolean {
  return getAllowedNextStages(fromStage).includes(toStage);
}

export interface TransitionResult {
  equipment: typeof equipmentRegistry.$inferSelect;
  transition: typeof equipmentLifecycleTransitions.$inferSelect;
}

export async function transitionEquipment(params: {
  tenantId: string;
  equipmentId: number;
  toStage: string;
  reason?: string;
  triggeredBy?: number;
  workOrderId?: number;
}): Promise<TransitionResult> {
  const { tenantId, equipmentId, toStage, reason, triggeredBy, workOrderId } = params;

  const [equipment] = await db.select().from(equipmentRegistry)
    .where(and(eq(equipmentRegistry.id, equipmentId), eq(equipmentRegistry.tenantId, tenantId))).limit(1);
  if (!equipment) throw new Error("Équipement introuvable");

  const fromStage = equipment.lifecycleStage;
  if (!ALLOWED_TRANSITIONS[toStage]) throw new Error(`Étape de cycle de vie inconnue : ${toStage}`);
  if (!canTransition(fromStage, toStage)) {
    throw new Error(
      `Transition non autorisée : ${getStageLabel(fromStage)} → ${getStageLabel(toStage)}. ` +
      `Depuis "${getStageLabel(fromStage)}", les étapes possibles sont : ${getAllowedNextStages(fromStage).map(getStageLabel).join(", ") || "aucune (état terminal)"}.`
    );
  }

  const [updatedEquipment] = await db.update(equipmentRegistry)
    .set({ lifecycleStage: toStage, lifecycleStageSince: new Date(), updatedAt: new Date() })
    .where(eq(equipmentRegistry.id, equipmentId))
    .returning();

  const [transition] = await db.insert(equipmentLifecycleTransitions).values({
    tenantId, equipmentId, fromStage, toStage,
    reason: reason ?? null,
    triggeredBy: triggeredBy ?? null,
    relatedWorkOrderId: workOrderId ?? null,
  }).returning();

  try {
    const equipmentNodeId = await findOrCreateNode({
      tenantId, nodeType: "equipment", label: equipment.equipmentName,
      refTable: "equipment_registry", refId: String(equipment.id),
    });
    const stageNodeId = await findOrCreateNode({
      tenantId, nodeType: "lifecycle_stage", label: getStageLabel(toStage),
    });
    await reinforceOrCreateEdge({ tenantId, fromNodeId: equipmentNodeId, toNodeId: stageNodeId, relationType: "in_lifecycle_stage" });
  } catch (kgError) {
    console.warn("[equipment-lifecycle] Renforcement Knowledge Graph échoué (non bloquant):", kgError);
  }

  return { equipment: updatedEquipment, transition };
}

export async function getEquipmentLifecycle(tenantId: string, equipmentId: number) {
  const [equipment] = await db.select().from(equipmentRegistry)
    .where(and(eq(equipmentRegistry.id, equipmentId), eq(equipmentRegistry.tenantId, tenantId))).limit(1);
  if (!equipment) return null;

  const history = await db.select().from(equipmentLifecycleTransitions)
    .where(and(eq(equipmentLifecycleTransitions.tenantId, tenantId), eq(equipmentLifecycleTransitions.equipmentId, equipmentId)))
    .orderBy(desc(equipmentLifecycleTransitions.transitionedAt));

  return {
    equipmentId: equipment.id,
    equipmentName: equipment.equipmentName,
    currentStage: equipment.lifecycleStage,
    currentStageLabel: getStageLabel(equipment.lifecycleStage),
    stageSince: equipment.lifecycleStageSince,
    allowedNextStages: getAllowedNextStages(equipment.lifecycleStage).map(key => ({ key, label: getStageLabel(key) })),
    history,
  };
}

export async function getLifecycleOverview(tenantId: string) {
  const rows = await db.select({ stage: equipmentRegistry.lifecycleStage, id: equipmentRegistry.id })
    .from(equipmentRegistry).where(eq(equipmentRegistry.tenantId, tenantId));

  const counts: Record<string, number> = {};
  for (const stage of ISO_LIFECYCLE_STAGES) counts[stage.key] = 0;
  for (const row of rows) counts[row.stage] = (counts[row.stage] ?? 0) + 1;

  return {
    total: rows.length,
    byStage: ISO_LIFECYCLE_STAGES.map(s => ({ key: s.key, label: s.label, count: counts[s.key] ?? 0 })),
  };
}

// Suggestion pure (pas d'écriture) — consommée par la bannière dans work-orders.tsx et par
// le Reliability Agent. Ancrage explicite avec Maintenance Execution : un OT correctif qui
// démarre implique qu'on diagnostique un problème réel ; un OT préventif/prédictif qui
// démarre est déjà une intervention connue et planifiée, pas une investigation.
export function suggestTransitionForWorkOrder(orderType: string, woStatus: string, currentStage: string): { toStage: string; reason: string } | null {
  if (woStatus === "in_progress" || woStatus === "assigned") {
    const target = orderType === "corrective" || orderType === "emergency" ? "diagnostic" : "maintenance";
    if (canTransition(currentStage, target) && currentStage !== target) {
      return { toStage: target, reason: `Ordre de travail ${orderType === "corrective" || orderType === "emergency" ? "correctif" : orderType} démarré` };
    }
    return null;
  }
  if (woStatus === "completed") {
    if (canTransition(currentStage, "essais") && currentStage !== "essais") {
      return { toStage: "essais", reason: "Ordre de travail clôturé — validation avant remise en service" };
    }
  }
  return null;
}
