/**
 * Multi-Asset Combinatorial Optimizer — Routes API
 * Arbitrage simultané sous contraintes budget/ressources
 *
 * GET  /api/multi-asset/config                — algorithmes, catalogue d'actions
 * POST /api/multi-asset/optimize              — optimisation complète (DP + Greedy + Pareto)
 * GET  /api/multi-asset/fleet                 — optimisation auto depuis l'IMCA flotte
 * POST /api/multi-asset/sensitivity           — analyse de sensibilité budget/ressources
 * GET  /api/multi-asset/action-catalog/:id    — catalogue d'actions pour un équipement
 */

import type { Express } from "express";
import { db } from "./db";
import { equipmentRegistry, workOrders } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import {
  optimizeMultiAsset,
  generateActionCatalog,
  sensitivityAnalysis,
  type AssetInput,
  type BudgetConstraints,
  CRITICALITY_WEIGHT,
} from "./multi-asset-optimizer";
import { computeIMCA } from "./imca-engine";
import { getArbitrationWeights, type ArbitrationWeights } from "./arbitration-learning";

export function registerMultiAssetRoutes(app: Express) {
  /**
   * GET /api/multi-asset/config
   * Configuration des algorithmes et du catalogue d'actions
   */
  app.get("/api/multi-asset/config", (_req, res) => {
    res.json({
      problem: "Multiple Choice Knapsack Problem (MCKP)",
      formulation: {
        objective: "Maximiser Σ_i Σ_j x_ij × (gain_ij × w_criticality_i)",
        constraint_budget: "Σ_i Σ_j x_ij × cost_ij ≤ B_total",
        constraint_resource: "Σ_i Σ_j x_ij × techDays_ij ≤ R_max",
        constraint_unique: "Σ_j x_ij ≤ 1 ∀i  (au plus une action par actif)",
        domain: "x_ij ∈ {0,1}",
      },
      algorithms: {
        dp_mckp: {
          name: "DP-MCKP (Programmation Dynamique)",
          complexity: "O(N × K × S) — S = slots budgétaires (200)",
          optimality: "Exact — solution globalement optimale garantie",
          use: "Défaut pour N ≤ 50 actifs",
        },
        greedy_roi: {
          name: "Greedy ROI",
          complexity: "O(N·K·log(N·K))",
          optimality: "Heuristique — rapidité maximale, sous-optimal possible",
          use: "Comparaison, initialisation Branch & Bound",
        },
        pareto: {
          name: "Front de Pareto budget ↔ gain",
          points: 25,
          use: "Aide à la décision — courbe d'efficacité marginale des investissements",
        },
      },
      criticalityWeights: { critical: 4.0, warning: 2.5, watch: 1.5, ok: 1.0 },
      actionTypes: [
        { type: "none", label: "Aucune action", costFactor: 0, gainRange: [0, 0] },
        { type: "inspection", label: "Inspection approfondie", costFactor: "0.15×base", gainRange: ["2", "6 pts IMCA"] },
        { type: "preventive", label: "Maintenance préventive", costFactor: "0.60×base", gainRange: ["8", "18 pts IMCA"] },
        { type: "corrective", label: "Intervention corrective", costFactor: "1.80×base", gainRange: ["18", "35 pts IMCA"] },
        { type: "overhaul", label: "Révision générale", costFactor: "5.00×base", gainRange: ["35", "60 pts IMCA"] },
      ],
    });
  });

  /**
   * POST /api/multi-asset/optimize
   * Optimisation complète depuis une liste d'actifs fournie
   * Body: {
   *   assets: AssetInput[],
   *   constraints: { totalBudget, maxTechDays, minCriticalInterventions? },
   * }
   */
  app.post("/api/multi-asset/optimize", async (req, res) => {
    try {
      const { assets, constraints } = req.body;

      if (!Array.isArray(assets) || assets.length === 0) {
        return res.status(400).json({ error: "assets doit être un tableau non vide d'actifs" });
      }
      if (!constraints?.totalBudget || constraints.totalBudget <= 0) {
        return res.status(400).json({ error: "constraints.totalBudget doit être un nombre positif (€)" });
      }

      const safeConstraints: BudgetConstraints = {
        totalBudget: constraints.totalBudget,
        maxTechDays: constraints.maxTechDays ?? 9999,
        minCriticalInterventions: constraints.minCriticalInterventions,
      };

      const tenantId = (req as any).tenantId ?? "default-tenant";
      const learnedWeights = await getArbitrationWeights(tenantId);
      const arbitrationWeights: ArbitrationWeights = {
        riskWeight: learnedWeights.riskWeight,
        costWeight: learnedWeights.costWeight,
        availabilityWeight: learnedWeights.availabilityWeight,
      };

      const result = optimizeMultiAsset(assets, safeConstraints, undefined, arbitrationWeights);

      res.json({
        ...result,
        computedAt: new Date().toISOString(),
        meta: { nAssets: assets.length, budget: safeConstraints.totalBudget },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/multi-asset/fleet
   * Optimisation automatique de la flotte complète depuis la BDD
   * Query: totalBudget (€), maxTechDays, failureIMCA
   */
  app.get("/api/multi-asset/fleet", async (req, res) => {
    try {
      const totalBudget = parseFloat((req.query.totalBudget as string) ?? "50000");
      const maxTechDays = parseFloat((req.query.maxTechDays as string) ?? "30");
      const windowDays = parseInt((req.query.windowDays as string) ?? "60");
      const tenantId = (req as any).tenantId ?? "default-tenant";

      const allEquipment = await db
        .select({
          id: equipmentRegistry.id,
          name: equipmentRegistry.equipmentName,
          type: equipmentRegistry.equipmentType,
          status: equipmentRegistry.operationalState,
          criticalityLevel: equipmentRegistry.criticalityLevel,
        })
        .from(equipmentRegistry)
        .where(eq(equipmentRegistry.tenantId, tenantId))
        .limit(30); // limiter pour performance

      if (allEquipment.length === 0) {
        return res.json({
          message: "Aucun équipement dans le registre",
          result: null,
        });
      }

      // Calculer l'IMCA pour chaque équipement (en parallèle avec limite de concurrence)
      const assetInputs: AssetInput[] = [];
      const batchSize = 5;
      for (let i = 0; i < allEquipment.length; i += batchSize) {
        const batch = allEquipment.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(item =>
            computeIMCA(item.id, tenantId, windowDays, windowDays * 3).catch(() => null)
          )
        );

        for (let j = 0; j < batch.length; j++) {
          const eq = batch[j];
          const settled = results[j];
          const imcaResult = settled.status === "fulfilled" ? settled.value : null;
          const imca = imcaResult?.IMCA ?? 70;
          const alert = imcaResult?.alertLevel ?? "ok";

          // Estimer le coût de référence selon le niveau de criticité
          const costByCriticality: Record<string, number> = {
            critical: 15000, high: 10000, medium: 5000, low: 2500,
          };
          const baseCost = costByCriticality[eq.criticalityLevel ?? "medium"] ?? 5000;

          assetInputs.push({
            equipmentId: eq.id,
            equipmentName: eq.name,
            equipmentType: eq.type ?? "unknown",
            currentIMCA: imca,
            alertLevel: alert,
            isMandatory: imca < 25,
            maintenanceCost: baseCost,
            rul_hours: imcaResult?.rul_hours ?? null,
          });
        }
      }

      const constraints: BudgetConstraints = {
        totalBudget,
        maxTechDays,
      };

      const learnedWeights = await getArbitrationWeights(tenantId);
      const arbitrationWeights: ArbitrationWeights = {
        riskWeight: learnedWeights.riskWeight,
        costWeight: learnedWeights.costWeight,
        availabilityWeight: learnedWeights.availabilityWeight,
      };

      const result = optimizeMultiAsset(assetInputs, constraints, undefined, arbitrationWeights);

      res.json({
        totalEquipment: allEquipment.length,
        ...result,
        computedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("[multi-asset/fleet] ERROR:", err.stack ?? err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/multi-asset/sensitivity
   * Analyse de sensibilité : impact de la variation du budget ou des ressources
   * Body: { assets, constraints, paramName: "budget"|"techDays", nSteps }
   */
  app.post("/api/multi-asset/sensitivity", (req, res) => {
    try {
      const { assets, constraints, paramName = "budget", nSteps = 10 } = req.body;

      if (!Array.isArray(assets) || assets.length === 0) {
        return res.status(400).json({ error: "assets requis" });
      }

      const safeConstraints: BudgetConstraints = {
        totalBudget: constraints.totalBudget,
        maxTechDays: constraints.maxTechDays ?? 9999,
      };

      const curve = sensitivityAnalysis(assets, safeConstraints, paramName, nSteps);

      res.json({
        paramName,
        baseValue: paramName === "budget" ? safeConstraints.totalBudget : safeConstraints.maxTechDays,
        nSteps,
        curve,
        interpretation:
          paramName === "budget"
            ? "Variation du budget de 50% à 200% de la valeur de référence"
            : "Variation des ressources techniciens de 50% à 200%",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/multi-asset/action-catalog/:id
   * Catalogue d'actions standard pour un équipement donné
   */
  app.get("/api/multi-asset/action-catalog/:id", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.id);
      if (isNaN(equipmentId)) return res.status(400).json({ error: "equipmentId invalide" });
      const tenantId = (req as any).tenantId ?? "default-tenant";

      const [equipment] = await db
        .select({ id: equipmentRegistry.id, name: equipmentRegistry.equipmentName, type: equipmentRegistry.equipmentType, criticalityLevel: equipmentRegistry.criticalityLevel })
        .from(equipmentRegistry)
        .where(eq(equipmentRegistry.id, equipmentId))
        .limit(1);

      if (!equipment) return res.status(404).json({ error: "Équipement non trouvé" });

      // Calcul IMCA simplifié
      let imca = 70;
      let alertLevel: AssetInput["alertLevel"] = "ok";
      try {
        const imcaResult = await computeIMCA(equipmentId, tenantId, 30, 90);
        imca = imcaResult.IMCA;
        alertLevel = imcaResult.alertLevel;
      } catch {
        /* fallback */
      }

      const costByCriticality: Record<string, number> = {
        critical: 15000, high: 10000, medium: 5000, low: 2500,
      };
      const maintenanceCost = costByCriticality[equipment.criticalityLevel ?? "medium"] ?? 5000;

      const asset: AssetInput = {
        equipmentId,
        equipmentName: equipment.name,
        equipmentType: equipment.type ?? "unknown",
        currentIMCA: imca,
        alertLevel,
        maintenanceCost,
      };

      const catalog = generateActionCatalog(asset);

      res.json({
        equipmentId,
        equipmentName: equipment.name,
        currentIMCA: imca,
        alertLevel,
        catalog,
        criticalityWeight: CRITICALITY_WEIGHT[alertLevel] ?? 1.0,
        recommendation: catalog.reduce((best, a) => {
          const roi = a.cost > 0 ? (a.gainIMCA * (CRITICALITY_WEIGHT[alertLevel] ?? 1)) / (a.cost / 1000) : 0;
          const bestRoi = best.cost > 0 ? (best.gainIMCA * (CRITICALITY_WEIGHT[alertLevel] ?? 1)) / (best.cost / 1000) : 0;
          return roi > bestRoi ? a : best;
        }, catalog[0]),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log("🎯 Routes Optimiseur Multi-Actifs enregistrées (MCKP · DP · Greedy · Pareto)");
}
