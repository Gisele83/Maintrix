/**
 * RCM Routes — Reliability Centered Maintenance
 * Voir ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md, section 9, et rcm-engine.ts.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import { rcmAnalyses } from "@shared/schema";
import { determineRcmStrategy } from "./rcm-engine";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";

interface TenantRequest extends Request {
  tenantId?: string;
  user?: any;
}

function requireTenant(req: TenantRequest, res: Response): string | null {
  if (!req.tenantId) {
    res.status(400).json({ error: "Tenant non résolu pour cette requête" });
    return null;
  }
  return req.tenantId;
}

const RcmAnalysisSchema = z.object({
  equipmentId: z.number().optional(),
  functionDescription: z.string().min(3),
  functionalFailure: z.string().min(3),
  failureMode: z.string().min(3),
  failureEffect: z.string().optional(),
  evident: z.boolean(),
  safetyOrEnvironmental: z.boolean().default(false),
  operationalImpact: z.boolean().default(false),
  conditionMonitoringPossible: z.boolean().default(false),
  taskDescription: z.string().optional(),
  intervalSuggestion: z.string().optional(),
});

export function registerRcmRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  app.get("/api/rcm", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const analyses = await db.select().from(rcmAnalyses).where(eq(rcmAnalyses.tenantId, tenantId)).orderBy(desc(rcmAnalyses.createdAt));
      res.json(analyses);
    } catch (e: any) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Applique l'arbre de décision RCM sans persister — pour explorer un scénario avant de l'enregistrer.
  app.post("/api/rcm/evaluate", generalRateLimit, auth, async (req, res) => {
    try {
      const body = z.object({
        evident: z.boolean(),
        safetyOrEnvironmental: z.boolean().default(false),
        operationalImpact: z.boolean().default(false),
        conditionMonitoringPossible: z.boolean().default(false),
      }).parse(req.body);
      res.json(determineRcmStrategy(body));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/rcm", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const body = RcmAnalysisSchema.parse(req.body);

      const decision = determineRcmStrategy(body);

      const [analysis] = await db.insert(rcmAnalyses).values({
        ...body,
        tenantId,
        createdBy: req.user?.id ?? null,
        consequenceCategory: decision.consequenceCategory,
        recommendedTaskType: decision.recommendedTaskType,
        reasoning: decision.reasoning,
      }).returning();

      res.status(201).json(analysis);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.patch("/api/rcm/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const id = parseInt(req.params.id, 10);
      const body = z.object({ status: z.enum(["draft", "validated"]).optional() }).parse(req.body);

      const [analysis] = await db.update(rcmAnalyses).set({ ...body, updatedAt: new Date() })
        .where(and(eq(rcmAnalyses.id, id), eq(rcmAnalyses.tenantId, tenantId))).returning();
      if (!analysis) return res.status(404).json({ error: "Analyse RCM introuvable" });
      res.json(analysis);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Erreur serveur" });
    }
  });
}
