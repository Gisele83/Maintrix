/**
 * ISC API Routes — Brevet N°3 MAINTRIX-SCA-FED
 * Expose les métriques ISC 4D et Φ_i de l'agrégation fédérée
 */
import type { Express } from "express";
import { db } from "./db";
import { federatedLearning } from "@shared/schema";
import { desc, eq, sql } from "drizzle-orm";
import {
  calculateISC4D,
  calculateFiabilite,
  calculateMaturite,
  computePhi,
  aggregatePatternsByPhi,
  patternSimilarityISC4D,
  ISC_WEIGHTS,
  PHI_DEFAULTS,
  type PatternContext,
  type PatternWithPhi,
} from "./isc-aggregation";

export function registerISCRoutes(app: Express) {
  /**
   * GET /api/isc/config
   * Retourne la configuration de la formule ISC et Φ_i
   */
  app.get("/api/isc/config", (_req, res) => {
    res.json({
      brevet: "N°3 MAINTRIX-SCA-FED",
      description: "Indice de Similarité Contextuelle 4 dimensions + Agrégation Fédérée Φ_i",
      isc: {
        formula: "ISC = w1·D1_equipType + w2·D2_usageProfil + w3·D3_stressOp + w4·D4_historiqueDefaillances",
        weights: ISC_WEIGHTS,
        dimensions: {
          D1_equipType: { weight: ISC_WEIGHTS.D1, description: "Type d'équipement (exact match + famille)" },
          D2_usageProfile: { weight: ISC_WEIGHTS.D2, description: "Profil d'usage — Jaccard symptômes + complexité" },
          D3_opStress: { weight: ISC_WEIGHTS.D3, description: "Stress opérationnel — urgence + sévérité" },
          D4_failureHistory: { weight: ISC_WEIGHTS.D4, description: "Historique de défaillances — récurrence, MTBF, catégories, récupération" },
        },
      },
      phi: {
        formula: "Φ_i = α·ISC_i + β·Fiabilité + γ·Maturité",
        defaults: PHI_DEFAULTS,
        aggregation: "SolutionRelevance_i = Σ_j(Φ_ij·solution_j) / Σ_j(Φ_ij)",
      },
    });
  });

  /**
   * POST /api/isc/compute
   * Calcule l'ISC et Φ_i entre deux contextes de patterns
   */
  app.post("/api/isc/compute", async (req, res) => {
    try {
      const { pattern1, pattern2, phiConfig } = req.body;
      if (!pattern1 || !pattern2) {
        return res.status(400).json({ error: "pattern1 et pattern2 requis" });
      }

      const iscComponents = calculateISC4D(pattern1 as PatternContext, pattern2 as PatternContext);
      const fiabilite = calculateFiabilite(
        pattern1.solutionEffectiveness ?? 0.7,
        pattern1.successRate ?? 0.7,
        []
      );
      const maturite = calculateMaturite(
        pattern1.confirmationCount ?? 1,
        pattern1.firstSeenDate ? new Date(pattern1.firstSeenDate) : null,
        pattern1.tenantCount ?? 1
      );
      const phi = computePhi(iscComponents, fiabilite, maturite, phiConfig ?? PHI_DEFAULTS, "target");

      res.json({ iscComponents, fiabilite, maturite, phi });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/isc/global-patterns
   * Retourne les patterns fédérés globaux avec leurs scores Φ_i
   */
  app.get("/api/isc/global-patterns", async (req, res) => {
    try {
      const { equipmentCategory, minPhi = "0.3", limit = "30" } = req.query;
      const minPhiNum = parseFloat(minPhi as string);
      const limitNum = parseInt(limit as string);

      const query = db
        .select({
          patternHash: federatedLearning.patternHash,
          equipmentCategory: federatedLearning.equipmentCategory,
          problemPattern: federatedLearning.problemPattern,
          solutionEffectiveness: federatedLearning.solutionEffectiveness,
          anonymizedMetrics: federatedLearning.anonymizedMetrics,
          contributionWeight: federatedLearning.contributionWeight,
          lastUpdated: federatedLearning.lastUpdated,
        })
        .from(federatedLearning)
        .orderBy(desc(federatedLearning.contributionWeight))
        .limit(limitNum);

      if (equipmentCategory) {
        (query as any).where(eq(federatedLearning.equipmentCategory, equipmentCategory as string));
      }

      const patterns = await query;

      // Calculer Φ_i pour chaque pattern (auto-similarité : ISC=1)
      const patternsWithPhi: PatternWithPhi[] = patterns.map((p) => {
        const pp = p.problemPattern as any;
        const am = p.anonymizedMetrics as any;
        const fiabilite = calculateFiabilite(
          p.solutionEffectiveness ?? 0,
          am?.successRate ?? 0,
          []
        );
        const maturite = calculateMaturite(1, p.lastUpdated ? new Date(p.lastUpdated) : null, 1);
        const iscComp = { D1_equipType: 1, D2_usageProfile: 1, D3_opStress: 1, D4_failureHistory: 1, ISC: 1 };
        const phi = computePhi(iscComp, fiabilite, maturite, PHI_DEFAULTS, "global");
        return {
          patternHash: p.patternHash,
          solutionEffectiveness: p.solutionEffectiveness ?? 0,
          phi: phi.Phi,
          phi_detail: phi,
        };
      });

      const aggregation = aggregatePatternsByPhi(patternsWithPhi, minPhiNum);

      res.json({
        totalPatterns: patterns.length,
        aggregation,
        patterns: patternsWithPhi,
        iscWeights: ISC_WEIGHTS,
        phiConfig: PHI_DEFAULTS,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/isc/summary
   * Résumé statistique de la qualité ISC/Φ_i de la base fédérée
   */
  app.get("/api/isc/summary", async (_req, res) => {
    try {
      const allPatterns = await db
        .select({
          equipmentCategory: federatedLearning.equipmentCategory,
          solutionEffectiveness: federatedLearning.solutionEffectiveness,
          contributionWeight: federatedLearning.contributionWeight,
          anonymizedMetrics: federatedLearning.anonymizedMetrics,
          lastUpdated: federatedLearning.lastUpdated,
        })
        .from(federatedLearning)
        .orderBy(desc(federatedLearning.lastUpdated))
        .limit(200);

      if (allPatterns.length === 0) {
        return res.json({
          totalPatterns: 0,
          avgPhi: 0,
          avgFiabilite: 0,
          avgMaturite: 0,
          avgISC: 1,
          phiDistribution: { high: 0, medium: 0, low: 0 },
          topCategory: null,
          iscWeights: ISC_WEIGHTS,
          phiConfig: PHI_DEFAULTS,
        });
      }

      // Calculer les Φ_i pour chaque pattern
      const phiValues: number[] = [];
      const fiabiliteValues: number[] = [];
      const maturiteValues: number[] = [];
      const categoryCount: Record<string, number> = {};

      for (const p of allPatterns) {
        const am = p.anonymizedMetrics as any;
        const fiabilite = calculateFiabilite(p.solutionEffectiveness ?? 0, am?.successRate ?? 0, []);
        const maturite = calculateMaturite(1, p.lastUpdated ? new Date(p.lastUpdated) : null, 1);
        const iscComp = { D1_equipType: 1, D2_usageProfile: 1, D3_opStress: 1, D4_failureHistory: 1, ISC: 1 };
        const phi = computePhi(iscComp, fiabilite, maturite);
        phiValues.push(phi.Phi);
        fiabiliteValues.push(fiabilite.Fiabilite);
        maturiteValues.push(maturite.Maturite);
        const cat = p.equipmentCategory ?? "inconnu";
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      }

      const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
      const avgPhi = avg(phiValues);
      const high = phiValues.filter(v => v >= 0.7).length;
      const medium = phiValues.filter(v => v >= 0.4 && v < 0.7).length;
      const low = phiValues.filter(v => v < 0.4).length;
      const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      res.json({
        totalPatterns: allPatterns.length,
        avgPhi: parseFloat(avgPhi.toFixed(4)),
        avgFiabilite: parseFloat(avg(fiabiliteValues).toFixed(4)),
        avgMaturite: parseFloat(avg(maturiteValues).toFixed(4)),
        avgISC: 1.0,
        phiDistribution: { high, medium, low },
        topCategory,
        categoryBreakdown: categoryCount,
        iscWeights: ISC_WEIGHTS,
        phiConfig: PHI_DEFAULTS,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log("📐 ISC Agrégation Φ_i routes registered (Brevet N°3)");
}
