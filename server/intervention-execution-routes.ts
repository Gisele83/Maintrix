/**
 * Maintenance Execution Routes
 * Pilote le cycle réel d'intervention technicien :
 * Réception → Inspection → Diagnostic → Réparation → Essais → Contrôle Qualité → Livraison → REX
 * Voir ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md (section 2) et
 * CADRAGE_MAINTENANCE_EXECUTION_KNOWLEDGE_GRAPH.md.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { db } from "./db";
import {
  interventionExecutions,
  interventionSteps,
  interventionAttachments,
  interventionMeasurements,
  workOrders,
  kgNodes,
  kgEdges,
  smmNonConformities,
} from "@shared/schema";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";
import { syncStepToKnowledgeGraph } from "./kg-sync-service";
import { uploadInterventionAttachment, inferAttachmentType, attachmentUrl } from "./intervention-attachments-upload";

function generateNcNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `NC-${year}-${rand}`;
}

interface TenantRequest extends Request {
  tenantId?: string;
  user?: any;
}

const STEP_ORDER = [
  "reception", "inspection", "diagnostic", "reparation",
  "essais", "controle_qualite", "livraison", "rex",
] as const;
type StepType = typeof STEP_ORDER[number];

function computeNextStep(stepType: StepType, structuredData: Record<string, unknown> | undefined): StepType | "terminee" {
  if (stepType === "inspection" && structuredData?.aucunDefautTrouve === true) {
    return "livraison";
  }
  if (stepType === "controle_qualite") {
    return structuredData?.verdict === "fail" ? "reparation" : "livraison";
  }
  const idx = STEP_ORDER.indexOf(stepType);
  if (idx === -1 || idx === STEP_ORDER.length - 1) return "terminee";
  return STEP_ORDER[idx + 1];
}

const CreateExecutionSchema = z.object({
  workOrderId: z.number(),
  equipmentId: z.number(),
});

const StartStepSchema = z.object({
  technicianId: z.number().optional(),
  diagnosticSessionId: z.number().optional(), // rattachement natif pour l'étape "diagnostic"
});

const CompleteStepSchema = z.object({
  structuredData: z.record(z.unknown()).optional(),
  rejectionReason: z.string().optional(),
  notes: z.string().optional(),
});

const AddAttachmentSchema = z.object({
  caption: z.string().optional(),
});

const AddMeasurementSchema = z.object({
  measurementType: z.string().min(1),
  value: z.number(),
  unit: z.string().optional(),
  expectedMin: z.number().optional(),
  expectedMax: z.number().optional(),
});

function requireTenant(req: TenantRequest, res: Response): string | null {
  if (!req.tenantId) {
    res.status(400).json({ error: "Tenant non résolu pour cette requête" });
    return null;
  }
  return req.tenantId;
}

export function registerInterventionExecutionRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  // ── POST /api/interventions ────────────────────────────────────────────
  // Crée une exécution d'intervention pour un OT et démarre l'étape "reception".
  app.post("/api/interventions", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const body = CreateExecutionSchema.parse(req.body);

      const [wo] = await db.select().from(workOrders)
        .where(and(eq(workOrders.id, body.workOrderId), eq(workOrders.tenantId, tenantId))).limit(1);
      if (!wo) return res.status(404).json({ error: "Ordre de travail introuvable" });

      // 🔒 F04 — TRANSACTION ATOMIQUE.
      //
      // Une intervention n'a de sens qu'avec sa première étape : sans elle, le
      // workflow n'a aucun point d'entrée et l'ordre de travail reste
      // définitivement bloqué. Sans transaction, un échec sur l'insertion de
      // l'étape laissait une `intervention_executions` orpheline — défaut
      // reproduit en F04 (tests/integration/transaction-integrity.test.ts).
      const { execution, firstStep } = await db.transaction(async (tx) => {
        const [createdExecution] = await tx.insert(interventionExecutions).values({
          workOrderId: body.workOrderId,
          equipmentId: body.equipmentId,
          tenantId,
          currentStep: "reception",
          overallStatus: "in_progress",
        }).returning();

        const [createdStep] = await tx.insert(interventionSteps).values({
          executionId: createdExecution.id,
          stepType: "reception",
          sequenceOrder: 1,
          status: "in_progress",
          technicianId: req.user?.id ?? null,
          startedAt: new Date(),
          tenantId,
        }).returning();

        return { execution: createdExecution, firstStep: createdStep };
      });

      res.status(201).json({ execution, currentStep: firstStep });
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      console.error("Intervention create error:", e.message);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── GET /api/interventions/by-work-order/:workOrderId ──────────────────
  app.get("/api/interventions/by-work-order/:workOrderId", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const workOrderId = parseInt(req.params.workOrderId, 10);
      const executions = await db.select().from(interventionExecutions)
        .where(and(eq(interventionExecutions.workOrderId, workOrderId), eq(interventionExecutions.tenantId, tenantId)));
      res.json(executions);
    } catch (e: any) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── GET /api/interventions/:id ──────────────────────────────────────────
  app.get("/api/interventions/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const id = parseInt(req.params.id, 10);
      const [execution] = await db.select().from(interventionExecutions)
        .where(and(eq(interventionExecutions.id, id), eq(interventionExecutions.tenantId, tenantId))).limit(1);
      if (!execution) return res.status(404).json({ error: "Intervention introuvable" });

      const steps = await db.select().from(interventionSteps)
        .where(eq(interventionSteps.executionId, id))
        .orderBy(asc(interventionSteps.sequenceOrder));

      res.json({ execution, steps });
    } catch (e: any) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── POST /api/interventions/:id/steps/start ─────────────────────────────
  // Démarre l'étape correspondant à execution.currentStep (le serveur décide, pas le client).
  app.post("/api/interventions/:id/steps/start", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const executionId = parseInt(req.params.id, 10);
      const body = StartStepSchema.parse(req.body);

      const [execution] = await db.select().from(interventionExecutions)
        .where(and(eq(interventionExecutions.id, executionId), eq(interventionExecutions.tenantId, tenantId))).limit(1);
      if (!execution) return res.status(404).json({ error: "Intervention introuvable" });
      if (execution.currentStep === "terminee") {
        return res.status(400).json({ error: "Cette intervention est déjà terminée" });
      }

      const existingSteps = await db.select().from(interventionSteps).where(eq(interventionSteps.executionId, executionId));
      const nextOrder = existingSteps.length > 0 ? Math.max(...existingSteps.map(s => s.sequenceOrder)) + 1 : 1;

      const [step] = await db.insert(interventionSteps).values({
        executionId,
        stepType: execution.currentStep,
        sequenceOrder: nextOrder,
        status: "in_progress",
        technicianId: body.technicianId ?? req.user?.id ?? null,
        diagnosticSessionId: body.diagnosticSessionId ?? null,
        startedAt: new Date(),
        tenantId,
      }).returning();

      res.status(201).json(step);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      console.error("Intervention step start error:", e.message);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── POST /api/interventions/:id/steps/:stepId/complete ──────────────────
  app.post("/api/interventions/:id/steps/:stepId/complete", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const executionId = parseInt(req.params.id, 10);
      const stepId = parseInt(req.params.stepId, 10);
      const body = CompleteStepSchema.parse(req.body);

      const [step] = await db.select().from(interventionSteps)
        .where(and(eq(interventionSteps.id, stepId), eq(interventionSteps.executionId, executionId), eq(interventionSteps.tenantId, tenantId)))
        .limit(1);
      if (!step) return res.status(404).json({ error: "Étape introuvable" });
      if (step.status !== "in_progress") {
        return res.status(400).json({ error: `Impossible de compléter une étape au statut "${step.status}"` });
      }

      const [execution] = await db.select().from(interventionExecutions)
        .where(eq(interventionExecutions.id, executionId)).limit(1);
      if (!execution) return res.status(404).json({ error: "Intervention introuvable" });

      const stepType = step.stepType as StepType;
      const isQcFailure = stepType === "controle_qualite" && body.structuredData?.verdict === "fail";
      const now = new Date();
      const startedAt = step.startedAt ? new Date(step.startedAt) : now;
      const durationMinutes = Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 60000));

      // 🔒 F04 — TRANSACTION ATOMIQUE.
      //
      // Trois écritures liées : l'étape passe à « terminée » (ou « rejetée »),
      // l'exécution avance vers l'étape suivante, et un contrôle qualité non
      // conforme génère une non-conformité SMM. Sans transaction :
      //   • échec après la 1ʳᵉ → l'étape est close mais l'exécution pointe
      //     toujours l'étape précédente : le workflow se fige ;
      //   • échec sur la 3ᵉ → l'étape est « rejetée » sans non-conformité
      //     enregistrée : perte de traçabilité qualité.
      //
      // La synchronisation du graphe de connaissances est volontairement
      // EXCLUE de la transaction et exécutée après le commit : c'est un effet
      // de bord non transactionnel (autre magasin), et l'échouer ne doit pas
      // annuler une intervention pourtant valide.
      const { updatedStep, updatedExecution, nonConformity } = await db.transaction(async (tx) => {
        const [stepRow] = await tx.update(interventionSteps).set({
          status: isQcFailure ? "rejected" : "completed",
          completedAt: now,
          durationMinutes,
          structuredData: body.structuredData ?? step.structuredData,
          notes: body.notes ?? step.notes,
          rejectionReason: isQcFailure ? (body.rejectionReason ?? "Contrôle qualité non conforme") : null,
          updatedAt: now,
        }).where(eq(interventionSteps.id, stepId)).returning();

        const nextStep = computeNextStep(stepType, body.structuredData);
        const executionUpdate: Partial<typeof interventionExecutions.$inferInsert> = {
          currentStep: nextStep,
          updatedAt: now,
        };
        if (nextStep === "terminee") {
          executionUpdate.overallStatus = "completed";
          executionUpdate.completedAt = now;
        }
        const [executionRow] = await tx.update(interventionExecutions).set(executionUpdate)
          .where(eq(interventionExecutions.id, executionId)).returning();

        // Un contrôle qualité non conforme est une non-conformité au sens SMM — capitalisation automatique
        let ncRow = null;
        if (isQcFailure) {
          [ncRow] = await tx.insert(smmNonConformities).values({
            tenantId,
            ncNumber: generateNcNumber(),
            title: `Contrôle qualité non conforme — OT #${execution.workOrderId}`,
            description: stepRow.rejectionReason,
            severity: "majeure",
            source: "controle_qualite",
            sourceInterventionStepId: stepId,
            equipmentId: execution.equipmentId,
            detectedBy: req.user?.id ?? null,
          }).returning();
        }

        return { updatedStep: stepRow, updatedExecution: executionRow, nonConformity: ncRow };
      });

      // Effet de bord post-commit — voir la note ci-dessus.
      if (updatedStep.status === "completed") {
        try {
          await syncStepToKnowledgeGraph(stepId);
        } catch (kgErr: any) {
          console.error(`⚠️  Synchronisation KG échouée pour l'étape ${stepId} (intervention validée malgré tout) :`, kgErr?.message);
        }
      }

      res.json({ step: updatedStep, execution: updatedExecution, nonConformity });
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      console.error("Intervention step complete error:", e.message);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── GET /api/interventions/:id/steps/:stepId/measurements ──────────────
  app.get("/api/interventions/:id/steps/:stepId/measurements", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const stepId = parseInt(req.params.stepId, 10);
      const measurements = await db.select().from(interventionMeasurements)
        .where(and(eq(interventionMeasurements.stepId, stepId), eq(interventionMeasurements.tenantId, tenantId)));
      res.json(measurements);
    } catch (e: any) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── GET /api/interventions/:id/steps/:stepId/attachments ───────────────
  app.get("/api/interventions/:id/steps/:stepId/attachments", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const stepId = parseInt(req.params.stepId, 10);
      const attachments = await db.select().from(interventionAttachments)
        .where(and(eq(interventionAttachments.stepId, stepId), eq(interventionAttachments.tenantId, tenantId)));
      res.json(attachments);
    } catch (e: any) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── POST /api/interventions/:id/steps/:stepId/attachments ──────────────
  // Upload multipart réel (photo/vidéo/document) — le type est déduit du mimetype du fichier.
  app.post("/api/interventions/:id/steps/:stepId/attachments", generalRateLimit, auth,
    uploadInterventionAttachment.single("file"),
    async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const stepId = parseInt(req.params.stepId, 10);
      const body = AddAttachmentSchema.parse(req.body);
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: "Aucun fichier reçu" });

      const [step] = await db.select().from(interventionSteps)
        .where(and(eq(interventionSteps.id, stepId), eq(interventionSteps.tenantId, tenantId))).limit(1);
      if (!step) return res.status(404).json({ error: "Étape introuvable" });

      const [attachment] = await db.insert(interventionAttachments).values({
        stepId,
        type: inferAttachmentType(file.mimetype),
        url: attachmentUrl(file.filename),
        caption: body.caption ?? file.originalname,
        uploadedBy: req.user?.id ?? null,
        tenantId,
      }).returning();

      res.status(201).json(attachment);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      console.error("Intervention attachment upload error:", e.message);
      res.status(500).json({ error: e.message || "Erreur serveur" });
    }
  });

  // ── POST /api/interventions/:id/steps/:stepId/measurements ─────────────
  app.post("/api/interventions/:id/steps/:stepId/measurements", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const stepId = parseInt(req.params.stepId, 10);
      const body = AddMeasurementSchema.parse(req.body);

      const [step] = await db.select().from(interventionSteps)
        .where(and(eq(interventionSteps.id, stepId), eq(interventionSteps.tenantId, tenantId))).limit(1);
      if (!step) return res.status(404).json({ error: "Étape introuvable" });

      const withinTolerance = body.expectedMin !== undefined && body.expectedMax !== undefined
        ? body.value >= body.expectedMin && body.value <= body.expectedMax
        : null;

      const [measurement] = await db.insert(interventionMeasurements).values({
        stepId, measurementType: body.measurementType, value: body.value, unit: body.unit ?? null,
        expectedMin: body.expectedMin ?? null, expectedMax: body.expectedMax ?? null,
        withinTolerance, tenantId,
      }).returning();

      res.status(201).json(measurement);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── KNOWLEDGE GRAPH (lecture) ────────────────────────────────────────────
  // Endpoints de consultation minimaux — alimentés automatiquement par kg-sync-service.ts
  // à chaque étape d'intervention complétée. Pas d'écriture directe exposée ici.

  app.get("/api/knowledge-graph/nodes", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { nodeType } = req.query;
      const nodes = nodeType
        ? await db.select().from(kgNodes).where(and(eq(kgNodes.tenantId, tenantId), eq(kgNodes.nodeType, String(nodeType))))
        : await db.select().from(kgNodes).where(eq(kgNodes.tenantId, tenantId));
      res.json(nodes);
    } catch (e: any) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/knowledge-graph/edges", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const edges = await db.select().from(kgEdges).where(eq(kgEdges.tenantId, tenantId));
      res.json(edges);
    } catch (e: any) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });
}
