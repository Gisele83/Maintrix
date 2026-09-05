/**
 * Routes du cycle de vie ISO 55000 — voir server/equipment-lifecycle-engine.ts.
 */

import type { Express, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { workOrders, equipmentRegistry } from "@shared/schema";
import {
  ISO_LIFECYCLE_STAGES,
  transitionEquipment,
  getEquipmentLifecycle,
  getLifecycleOverview,
  suggestTransitionForWorkOrder,
} from "./equipment-lifecycle-engine";
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

export function registerEquipmentLifecycleRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  app.get("/api/equipment-lifecycle/stages", generalRateLimit, auth, async (_req, res) => {
    res.json(ISO_LIFECYCLE_STAGES);
  });

  app.get("/api/equipment-lifecycle/overview", generalRateLimit, auth, async (req: TenantRequest, res) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    try {
      res.json(await getLifecycleOverview(tenantId));
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? "Échec du calcul de la vue d'ensemble" });
    }
  });

  app.get("/api/equipment-lifecycle/:equipmentId", generalRateLimit, auth, async (req: TenantRequest, res) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    try {
      const data = await getEquipmentLifecycle(tenantId, Number(req.params.equipmentId));
      if (!data) return res.status(404).json({ error: "Équipement introuvable" });
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? "Échec du chargement du cycle de vie" });
    }
  });

  app.get("/api/equipment-lifecycle/:equipmentId/suggestion", generalRateLimit, auth, async (req: TenantRequest, res) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const workOrderId = Number(req.query.workOrderId);
    if (!workOrderId) return res.json(null);
    try {
      const [wo] = await db.select().from(workOrders)
        .where(and(eq(workOrders.id, workOrderId), eq(workOrders.tenantId, tenantId))).limit(1);
      const [equipment] = await db.select().from(equipmentRegistry)
        .where(and(eq(equipmentRegistry.id, Number(req.params.equipmentId)), eq(equipmentRegistry.tenantId, tenantId))).limit(1);
      if (!wo || !equipment) return res.json(null);
      res.json(suggestTransitionForWorkOrder(wo.orderType, wo.status ?? "pending", equipment.lifecycleStage));
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? "Échec du calcul de la suggestion" });
    }
  });

  app.post("/api/equipment-lifecycle/:equipmentId/transition", generalRateLimit, auth, async (req: TenantRequest, res) => {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const { toStage, reason, workOrderId } = req.body ?? {};
    if (!toStage) return res.status(400).json({ error: "toStage requis" });
    try {
      const result = await transitionEquipment({
        tenantId,
        equipmentId: Number(req.params.equipmentId),
        toStage,
        reason,
        triggeredBy: req.user?.id,
        workOrderId: workOrderId ? Number(workOrderId) : undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message ?? "Échec de la transition" });
    }
  });

  console.log("🔄 Equipment Lifecycle (ISO 55000) routes registered");
}
