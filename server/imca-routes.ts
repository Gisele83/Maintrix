import type { Express, Request, Response } from "express";
import { computeIMCA, computeFleetIMCA } from "./imca-engine";
import { db } from "./db";
import { equipmentRegistry } from "@shared/schema";
import { eq } from "drizzle-orm";
import { tenantRequis } from "./tenant-requis";

export function registerImcaRoutes(app: Express) {
  // Fleet IMCA overview
  app.get("/api/imca/fleet", async (req: Request, res: Response) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const fleet = await computeFleetIMCA(tenantId);
      res.json(fleet);
    } catch (error) {
      console.error("IMCA fleet error:", error);
      res.status(500).json({ error: "Erreur calcul IMCA flotte" });
    }
  });

  // Single equipment IMCA
  app.get("/api/imca/equipment/:id", async (req: Request, res: Response) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

      const windowShort = parseInt(req.query.windowShort as string) || 7;
      const windowLong = parseInt(req.query.windowLong as string) || 60;

      const result = await computeIMCA(id, tenantId, windowShort, windowLong);
      res.json(result);
    } catch (error) {
      console.error("IMCA equipment error:", error);
      res.status(500).json({ error: "Erreur calcul IMCA équipement" });
    }
  });

  // Equipment list with basic IMCA for selection
  app.get("/api/imca/equipment-list", async (req: Request, res: Response) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const equipments = await db
        .select({ id: equipmentRegistry.id, name: equipmentRegistry.equipmentName, type: equipmentRegistry.equipmentType, status: equipmentRegistry.operationalState })
        .from(equipmentRegistry)
        .where(eq(equipmentRegistry.tenantId, tenantId))
        .limit(100);
      res.json(equipments);
    } catch (error) {
      res.status(500).json({ error: "Erreur liste équipements" });
    }
  });

  console.log("🧠 IMCA (Indice Cognitif Composite Multi-paramètres) routes registered");
}
