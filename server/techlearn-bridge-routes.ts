/**
 * Pont Maintrix ⇄ TechLearn — voir ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md section 11
 * et server/techlearn-bridge-service.ts.
 */

import type { Express, Request, Response } from "express";
import { detectCompetencyGaps, getGapForWorkOrder, requestTraining, listTrainingRequests, syncCompletedTraining } from "./techlearn-bridge-service";
import { isTechLearnConfigured } from "./techlearn-client";
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

export function registerTechLearnBridgeRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  app.get("/api/techlearn-bridge/status", generalRateLimit, auth, async (_req, res) => {
    res.json({ configured: await isTechLearnConfigured() });
  });

  app.get("/api/techlearn-bridge/gaps", generalRateLimit, auth, async (req: TenantRequest, res) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    try {
      res.json(await detectCompetencyGaps(tenantId));
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? "Échec de la détection d'écart de compétence" });
    }
  });

  app.get("/api/techlearn-bridge/gaps/:workOrderId", generalRateLimit, auth, async (req: TenantRequest, res) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    try {
      const gap = await getGapForWorkOrder(tenantId, Number(req.params.workOrderId));
      res.json(gap);
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? "Échec de la vérification" });
    }
  });

  app.post("/api/techlearn-bridge/request-training", generalRateLimit, auth, async (req: TenantRequest, res) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const workOrderId = Number(req.body?.workOrderId);
    if (!workOrderId) return res.status(400).json({ error: "workOrderId requis" });
    try {
      const requestedBy = req.user?.id ?? req.user?.userId;
      const result = await requestTraining(tenantId, workOrderId, requestedBy);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message ?? "Échec de la demande de formation" });
    }
  });

  app.get("/api/techlearn-bridge/requests", generalRateLimit, auth, async (req: TenantRequest, res) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    try {
      res.json(await listTrainingRequests(tenantId));
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? "Échec du chargement des demandes" });
    }
  });

  app.post("/api/techlearn-bridge/sync", generalRateLimit, auth, async (req: TenantRequest, res) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    try {
      res.json(await syncCompletedTraining(tenantId));
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? "Échec de la synchronisation" });
    }
  });
}
