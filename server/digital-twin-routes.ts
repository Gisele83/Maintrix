/**
 * Digital Twin Routes
 * Voir ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md, section 7.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { runTwin, calibrateTwin } from "./digital-twin-service";
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

const CalibrationSchema = z.record(z.number());

export function registerDigitalTwinRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  // Exécute (ou ré-exécute) le jumeau numérique d'un équipement avec les dernières données.
  app.get("/api/digital-twin/:equipmentId", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const equipmentId = parseInt(req.params.equipmentId, 10);
      const { twin, result } = await runTwin(equipmentId, tenantId);
      res.json({ twin, result });
    } catch (e: any) {
      console.error("Digital twin run error:", e.message);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.patch("/api/digital-twin/:equipmentId/calibration", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const equipmentId = parseInt(req.params.equipmentId, 10);
      const calibration = CalibrationSchema.parse(req.body);
      const twin = await calibrateTwin(equipmentId, tenantId, calibration);
      res.json(twin);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Erreur serveur" });
    }
  });
}
