/**
 * Routes de l'équipe d'agents fonctionnels — deuxième dimension du multi-agent
 * (spécialité métier), voir ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md section 10.
 */

import type { Express, Request, Response } from "express";
import { FUNCTIONAL_AGENTS } from "./agents/functional/functional-agents";
import { runSupervisorArbitration } from "./agents/functional/supervisor-agent";
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

export function registerFunctionalAgentsRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  app.get("/api/functional-agents", generalRateLimit, auth, async (req: TenantRequest, res) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    try {
      const agents = await Promise.all(FUNCTIONAL_AGENTS.map((a) => a.assess(tenantId)));
      res.json(agents);
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? "Échec de l'évaluation des agents fonctionnels" });
    }
  });

  app.get("/api/functional-agents/arbitration", generalRateLimit, auth, async (req: TenantRequest, res) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    try {
      const arbitration = await runSupervisorArbitration(tenantId);
      res.json(arbitration);
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? "Échec de l'arbitrage du Supervisor Agent" });
    }
  });
}
