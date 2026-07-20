/**
 * Predictive Maintenance Engine Routes (unifié)
 * Voir ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md, section 8.
 */

import type { Express, Request, Response } from "express";
import { runPredictiveEngine } from "./predictive-maintenance-engine";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";

interface TenantRequest extends Request {
  tenantId?: string;
}

function requireTenant(req: TenantRequest, res: Response): string | null {
  if (!req.tenantId) {
    res.status(400).json({ error: "Tenant non résolu pour cette requête" });
    return null;
  }
  return req.tenantId;
}

export function registerPredictiveMaintenanceRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  app.get("/api/predictive-engine/:equipmentId", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const equipmentId = parseInt(req.params.equipmentId, 10);
      const result = await runPredictiveEngine(equipmentId, tenantId);
      res.json(result);
    } catch (e: any) {
      console.error("Predictive engine error:", e.message);
      res.status(500).json({ error: e.message || "Erreur serveur" });
    }
  });
}
