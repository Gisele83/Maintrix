import type { Express, Request, Response } from "express";
import { runProspectiveSimulation } from "./prospective-simulation";
import { db } from "./db";
import { equipmentRegistry } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export function registerProspectiveSimulationRoutes(app: Express) {
  // Run prospective simulation for one equipment
  app.get("/api/prospective/simulate/:id", async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId || "default-tenant";
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

      const deferDays = parseInt(req.query.deferDays as string) || 14;
      const result = await runProspectiveSimulation(id, tenantId, Math.min(deferDays, 90));
      res.json(result);
    } catch (error) {
      console.error("Prospective simulation error:", error);
      res.status(500).json({ error: "Erreur simulation prospective" });
    }
  });

  // Fleet-level: run simulation on all equipment and return ranked summary
  app.get("/api/prospective/fleet-summary", async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId || "default-tenant";
      const deferDays = parseInt(req.query.deferDays as string) || 14;

      const equipments = await db.select({ id: equipmentRegistry.id, name: equipmentRegistry.name, criticalityLevel: equipmentRegistry.criticalityLevel })
        .from(equipmentRegistry)
        .where(eq(equipmentRegistry.tenantId, tenantId))
        .limit(30);

      const summaries = await Promise.allSettled(
        equipments.map(eq_ => runProspectiveSimulation(eq_.id, tenantId, deferDays))
      );

      const results = summaries
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map(r => r.value)
        .map((sim: any) => ({
          equipmentId: sim.equipmentId,
          equipmentName: sim.equipmentName,
          criticalityLevel: sim.criticalityLevel,
          currentIMCA: sim.currentIMCA,
          recommendedScenario: sim.recommendation.scenario,
          urgencyLevel: sim.recommendation.urgencyLevel,
          decisionDeadline: sim.recommendation.decisionDeadline,
          immediateCost: Math.round(sim.scenarios.IMMEDIATE.cost.total),
          noInterventionRisk: sim.scenarios.NO_INTERVENTION.failureProbability30d,
          autonomyCompatible: sim.recommendation.autonomyCompatible,
        }))
        .sort((a: any, b: any) => {
          const urgencyOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
          return (urgencyOrder[a.urgencyLevel as keyof typeof urgencyOrder] ?? 3) -
                 (urgencyOrder[b.urgencyLevel as keyof typeof urgencyOrder] ?? 3);
        });

      res.json({ results, totalEquipment: results.length, criticalCount: results.filter((r: any) => r.urgencyLevel === "critical").length });
    } catch (error) {
      console.error("Fleet simulation error:", error);
      res.status(500).json({ error: "Erreur simulation flotte" });
    }
  });

  // Equipment list for selection
  app.get("/api/prospective/equipment-list", async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId || "default-tenant";
      const list = await db.select({ id: equipmentRegistry.id, name: equipmentRegistry.name, type: equipmentRegistry.type, criticalityLevel: equipmentRegistry.criticalityLevel, status: equipmentRegistry.status })
        .from(equipmentRegistry)
        .where(eq(equipmentRegistry.tenantId, tenantId))
        .limit(100);
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Erreur liste équipements" });
    }
  });

  console.log("🔮 Simulation Prospective routes registered (Brevet N°2 — Immédiat / Différé / Non-intervention)");
}
