/**
 * Knowledge Graph Sync Service
 * Transforme chaque étape d'intervention complétée en nœuds/arêtes du graphe métier.
 * Voir CADRAGE_MAINTENANCE_EXECUTION_KNOWLEDGE_GRAPH.md, Partie 3 (le "pont").
 *
 * Règle centrale : si un nœud/une arête équivalente existe déjà, on la renforce
 * (occurrenceCount++, weight ajusté) plutôt que d'en créer une nouvelle — c'est ce
 * qui transforme le graphe en mémoire technique qui apprend avec l'usage.
 */

import { db } from "./db";
import { eq, and } from "drizzle-orm";
import {
  kgNodes,
  kgEdges,
  interventionSteps,
  interventionExecutions,
  interventionMeasurements,
  interventionAttachments,
  diagnosticSessions,
  equipmentRegistry,
  userProfiles,
  workOrders,
  type InterventionStep,
} from "@shared/schema";
import { getKnowledgeGraph } from "./cognitive-layers/knowledge-graph";

const MAX_WEIGHT = 5.0;
const REINFORCEMENT_INCREMENT = 0.1;

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Trouve un nœud existant (par référence réelle si possible, sinon par libellé normalisé) ou le crée. */
export async function findOrCreateNode(params: {
  tenantId: string;
  nodeType: string;
  label: string;
  refTable?: string;
  refId?: string;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  const { tenantId, nodeType, label, refTable, refId, metadata } = params;

  if (refTable && refId) {
    const [existing] = await db.select().from(kgNodes).where(
      and(
        eq(kgNodes.tenantId, tenantId),
        eq(kgNodes.nodeType, nodeType),
        eq(kgNodes.refTable, refTable),
        eq(kgNodes.refId, refId),
      )
    ).limit(1);
    if (existing) return existing.id;
  } else {
    const normalized = normalizeLabel(label);
    const candidates = await db.select().from(kgNodes).where(
      and(eq(kgNodes.tenantId, tenantId), eq(kgNodes.nodeType, nodeType))
    );
    const existing = candidates.find(n => normalizeLabel(n.label) === normalized);
    if (existing) return existing.id;
  }

  const [created] = await db.insert(kgNodes).values({
    tenantId, nodeType, label, refTable: refTable ?? null, refId: refId ?? null,
    metadata: metadata ?? null,
  }).returning();
  return created.id;
}

/** Crée une arête, ou la renforce (occurrenceCount + weight) si elle existe déjà entre ces deux nœuds. */
export async function reinforceOrCreateEdge(params: {
  tenantId: string;
  fromNodeId: number;
  toNodeId: number;
  relationType: string;
}): Promise<void> {
  const { tenantId, fromNodeId, toNodeId, relationType } = params;

  const [existing] = await db.select().from(kgEdges).where(
    and(
      eq(kgEdges.tenantId, tenantId),
      eq(kgEdges.fromNodeId, fromNodeId),
      eq(kgEdges.toNodeId, toNodeId),
      eq(kgEdges.relationType, relationType),
    )
  ).limit(1);

  if (existing) {
    await db.update(kgEdges).set({
      occurrenceCount: existing.occurrenceCount + 1,
      weight: Math.min(existing.weight + REINFORCEMENT_INCREMENT, MAX_WEIGHT),
      lastReinforcedAt: new Date(),
    }).where(eq(kgEdges.id, existing.id));
  } else {
    await db.insert(kgEdges).values({ tenantId, fromNodeId, toNodeId, relationType });
  }
}

/**
 * Point d'entrée principal — à appeler quand une intervention_step passe à status="completed".
 * Ne lève pas d'exception métier bloquante : une erreur de sync KG ne doit jamais faire
 * échouer la complétion réelle de l'étape (le graphe est une vue dérivée, pas la source de vérité).
 */
export async function syncStepToKnowledgeGraph(stepId: number): Promise<void> {
  try {
    const [step] = await db.select().from(interventionSteps).where(eq(interventionSteps.id, stepId)).limit(1);
    if (!step || step.status !== "completed") return;

    const [execution] = await db.select().from(interventionExecutions)
      .where(eq(interventionExecutions.id, step.executionId)).limit(1);
    if (!execution) return;

    const [equipment] = await db.select().from(equipmentRegistry)
      .where(eq(equipmentRegistry.id, execution.equipmentId)).limit(1);
    if (!equipment) return;

    const tenantId = step.tenantId;
    const equipmentNodeId = await findOrCreateNode({
      tenantId, nodeType: "equipment", label: equipment.equipmentName,
      refTable: "equipment_registry", refId: String(equipment.id),
    });

    // Chaque étape avec pièces jointes documente le nœud équipement
    const attachments = await db.select().from(interventionAttachments).where(eq(interventionAttachments.stepId, step.id));
    for (const att of attachments) {
      if (att.type !== "photo") continue;
      const photoNodeId = await findOrCreateNode({
        tenantId, nodeType: "photo", label: att.caption || `Photo #${att.id}`,
        refTable: "intervention_attachments", refId: String(att.id),
      });
      await reinforceOrCreateEdge({ tenantId, fromNodeId: equipmentNodeId, toNodeId: photoNodeId, relationType: "documented_by_photo" });
    }

    switch (step.stepType) {
      case "diagnostic":
        await syncDiagnosticStep(tenantId, step, equipmentNodeId);
        break;
      case "reparation":
        await syncReparationStep(tenantId, step, equipmentNodeId);
        break;
      case "essais":
        await syncEssaisStep(tenantId, step, equipmentNodeId);
        break;
      case "livraison":
        await syncLivraisonStep(tenantId, step, execution, equipmentNodeId);
        break;
      case "rex":
        await syncRexStep(tenantId, step, equipmentNodeId);
        break;
      default:
        // reception, inspection, controle_qualite : pas d'enrichissement direct du graphe pour l'instant
        break;
    }
  } catch (error) {
    console.error(`[kg-sync] Échec de synchronisation pour l'étape ${stepId}:`, error);
  }
}

async function syncDiagnosticStep(tenantId: string, step: InterventionStep, equipmentNodeId: number): Promise<void> {
  if (!step.diagnosticSessionId) return;
  const [session] = await db.select().from(diagnosticSessions).where(eq(diagnosticSessions.id, step.diagnosticSessionId)).limit(1);
  if (!session) return;

  if (session.selectedDiagnosis) {
    const failureModeNodeId = await findOrCreateNode({ tenantId, nodeType: "failure_mode", label: session.selectedDiagnosis });
    await reinforceOrCreateEdge({ tenantId, fromNodeId: equipmentNodeId, toNodeId: failureModeNodeId, relationType: "causes" });

    for (const symptom of (session.symptomsChecked ?? [])) {
      const symptomNodeId = await findOrCreateNode({ tenantId, nodeType: "symptom", label: symptom });
      await reinforceOrCreateEdge({ tenantId, fromNodeId: failureModeNodeId, toNodeId: symptomNodeId, relationType: "exhibits_symptom" });
    }
  }
}

async function syncReparationStep(tenantId: string, step: InterventionStep, equipmentNodeId: number): Promise<void> {
  const data = (step.structuredData as Record<string, unknown> | null) ?? {};
  const procedureLabel = typeof data.procedureUtilisee === "string" ? data.procedureUtilisee : null;

  let procedureNodeId: number | null = null;
  if (procedureLabel) {
    procedureNodeId = await findOrCreateNode({ tenantId, nodeType: "procedure", label: procedureLabel });
    await reinforceOrCreateEdge({ tenantId, fromNodeId: equipmentNodeId, toNodeId: procedureNodeId, relationType: "resolved_by_procedure" });
  }

  if (step.technicianId) {
    const [tech] = await db.select().from(userProfiles).where(eq(userProfiles.id, step.technicianId)).limit(1);
    if (tech) {
      const techLabel = [tech.firstName, tech.lastName].filter(Boolean).join(" ") || tech.username;
      const techNodeId = await findOrCreateNode({
        tenantId, nodeType: "technician", label: techLabel,
        refTable: "user_profiles", refId: String(tech.id),
      });
      const fromId = procedureNodeId ?? equipmentNodeId;
      await reinforceOrCreateEdge({ tenantId, fromNodeId: fromId, toNodeId: techNodeId, relationType: "performed_by" });
    }
  }
}

async function syncEssaisStep(tenantId: string, step: InterventionStep, equipmentNodeId: number): Promise<void> {
  const measurements = await db.select().from(interventionMeasurements).where(eq(interventionMeasurements.stepId, step.id));
  for (const m of measurements) {
    const measurementNodeId = await findOrCreateNode({ tenantId, nodeType: "measurement_type", label: m.measurementType });
    await reinforceOrCreateEdge({ tenantId, fromNodeId: equipmentNodeId, toNodeId: measurementNodeId, relationType: "measured_by" });
  }
}

async function syncLivraisonStep(
  tenantId: string,
  step: InterventionStep,
  execution: typeof interventionExecutions.$inferSelect,
  equipmentNodeId: number,
): Promise<void> {
  const [wo] = await db.select().from(workOrders).where(eq(workOrders.id, execution.workOrderId)).limit(1);
  if (!wo) return;
  const woNodeId = await findOrCreateNode({
    tenantId, nodeType: "work_order", label: wo.orderNumber,
    refTable: "work_orders", refId: String(wo.id),
  });
  await reinforceOrCreateEdge({ tenantId, fromNodeId: equipmentNodeId, toNodeId: woNodeId, relationType: "part_of_work_order" });

  // La livraison n'est atteinte qu'après un contrôle qualité conforme (voir machine à états
  // dans intervention-execution-routes.ts) — c'est le signal de succès qui justifie de renforcer
  // le graphe fondationnel (IndustrialKnowledgeGraph) avec ce cas réel résolu.
  await reinforceFoundationalGraph(execution.id);
}

/**
 * Ferme la boucle Detection → Diagnostic → Decision → Action → Feedback → Learning :
 * une intervention qui a atteint la livraison (donc validée en contrôle qualité) réinforce
 * la confiance des relations symptôme→cause→intervention du graphe fondationnel statique
 * (server/cognitive-layers/knowledge-graph.ts), au-delà du seul enregistrement en base.
 */
async function reinforceFoundationalGraph(executionId: number): Promise<void> {
  const steps = await db.select().from(interventionSteps).where(eq(interventionSteps.executionId, executionId));

  const diagnosticStep = steps.find(s => s.stepType === "diagnostic" && s.diagnosticSessionId);
  const lastReparation = steps
    .filter(s => s.stepType === "reparation" && s.status === "completed")
    .sort((a, b) => b.sequenceOrder - a.sequenceOrder)[0];

  if (!diagnosticStep?.diagnosticSessionId || !lastReparation) return;

  const [session] = await db.select().from(diagnosticSessions)
    .where(eq(diagnosticSessions.id, diagnosticStep.diagnosticSessionId)).limit(1);
  const procedureUtilisee = (lastReparation.structuredData as Record<string, unknown> | null)?.procedureUtilisee;

  if (!session?.selectedDiagnosis || typeof procedureUtilisee !== "string" || !session.symptomsChecked?.length) return;

  getKnowledgeGraph().learnFromIntervention(
    session.symptomsChecked,
    session.selectedDiagnosis,
    procedureUtilisee,
    true, // la livraison n'est atteinte qu'après contrôle qualité conforme
  );
}

async function syncRexStep(tenantId: string, step: InterventionStep, equipmentNodeId: number): Promise<void> {
  const data = (step.structuredData as Record<string, unknown> | null) ?? {};
  const lessons = typeof data.lecons === "string" ? data.lecons : null;
  if (!lessons) return;
  const lessonNodeId = await findOrCreateNode({ tenantId, nodeType: "lesson_learned", label: lessons });
  await reinforceOrCreateEdge({ tenantId, fromNodeId: equipmentNodeId, toNodeId: lessonNodeId, relationType: "generated_lesson" });
}
