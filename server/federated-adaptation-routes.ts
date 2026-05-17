/**
 * Adaptation Locale Différentielle — Routes API
 * Brevet MAINTRIX-SCA — Module Apprentissage Fédéré Adaptatif
 *
 * GET  /api/federated-adapt/config           — paramètres du système (λ_max, k, dimensions)
 * GET  /api/federated-adapt/sites            — profils de maturité de tous les sites
 * GET  /api/federated-adapt/site/:id         — profil + modèle personnalisé d'un site
 * POST /api/federated-adapt/aggregate        — déclenche l'agrégation différentielle complète
 * GET  /api/federated-adapt/specialization   — rapport SPI tous sites
 * GET  /api/federated-adapt/model-dims       — vecteur dimensions + interprétation
 */

import type { Express } from "express";
import { db } from "./db";
import { tenants, federatedLearning, diagnosticSessions } from "@shared/schema";
import { eq, count } from "drizzle-orm";
import {
  runDifferentialAggregation,
  getPersonalizedModelForSite,
  computeSiteMaturityScore,
  computeMixingCoefficient,
  cosineSimilarity,
  DIM_LABELS,
  MODEL_DIMS,
  LAMBDA_MAX,
} from "./federated-adaptation";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";

// Cache last aggregation result (évite de relancer à chaque requête)
let lastAggregation: Awaited<ReturnType<typeof runDifferentialAggregation>> | null = null;
let lastAggregationTs = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCachedAggregation() {
  if (lastAggregation && Date.now() - lastAggregationTs < CACHE_TTL_MS) {
    return lastAggregation;
  }
  lastAggregation = await runDifferentialAggregation();
  lastAggregationTs = Date.now();
  return lastAggregation;
}

export function registerFederatedAdaptationRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  /**
   * GET /api/federated-adapt/config
   * Paramètres du système d'adaptation différentielle
   */
  app.get("/api/federated-adapt/config", auth, (_req, res) => {
    res.json({
      algorithm: "Personalised Federated Learning (pFed) avec couplage élastique",
      formulas: {
        maturity: "M(s) = α·min(1, N_cas/100) + β·min(1, N_patterns/50) + γ·SuccessRate + δ·min(1, Jours/365)",
        weights: { alpha: 0.35, beta: 0.25, gamma: 0.25, delta: 0.15 },
        mixing: `λ(s) = ${LAMBDA_MAX} × (1 − exp(−3.5 × M(s)))`,
        personalized: "θ̂(s) = (1 − λ(s)) × θ_global + λ(s) × θ_local(s)",
        fedAvg: "θ_global = Σ_s [n_s × (1−λ(s)) × θ_local(s)] / Σ_s [n_s × (1−λ(s))]",
        spi: "SPI(s) = 1 − cosineSim(θ_global, θ_local(s))",
      },
      lambdaMax: LAMBDA_MAX,
      kElastic: 3.5,
      modelDims: MODEL_DIMS,
      dimLabels: DIM_LABELS,
      properties: {
        "λ→0": "Site neuf — suit entièrement le modèle global",
        "λ≈0.5": "Site modéré — mélange équilibré global/local",
        "λ→λ_max": "Site ultra-mature — préserve sa spécialisation locale",
        "w(s)=n_s×(1−λ)": "Sites matures contribuent moins au consensus global",
        "SPI→0": "Site non-spécialisé (identique au global)",
        "SPI→1": "Site maximalement spécialisé",
      },
    });
  });

  /**
   * GET /api/federated-adapt/sites
   * Profils de maturité + λ de tous les sites actifs
   */
  app.get("/api/federated-adapt/sites", auth, async (_req, res) => {
    try {
      const agg = await getCachedAggregation();
      res.json({
        sites: agg.siteProfiles,
        fleetStats: {
          nSites: agg.siteProfiles.length,
          fleetMaturityAvg: agg.fleetMaturityAvg,
          fleetLambdaAvg: agg.fleetLambdaAvg,
          fleetSPIAvg: agg.fleetSPIAvg,
          nSitesMature: agg.nSitesMature,
          nSitesSpecialized: agg.nSitesSpecialized,
        },
        aggregatedAt: agg.aggregatedAt,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/federated-adapt/site/:id
   * Profil complet + modèle personnalisé pour un site donné
   */
  app.get("/api/federated-adapt/site/:id", auth, async (req, res) => {
    try {
      const tenantId = req.params.id;
      const agg = await getCachedAggregation();
      const result = await getPersonalizedModelForSite(tenantId, agg.globalModel);
      const aggWeight = agg.aggregationWeights[tenantId] ?? 0;

      res.json({
        ...result,
        aggregationWeight: aggWeight,
        globalModel: agg.globalModel,
        dimLabels: DIM_LABELS,
        interpretation: {
          lambda: `λ = ${result.mixingCoefficient.toFixed(3)} — le site conserve ${(result.mixingCoefficient * 100).toFixed(1)}% de son modèle local`,
          spi: `SPI = ${result.spi.toFixed(3)} — ${result.spi > 0.5 ? "site fortement spécialisé" : result.spi > 0.2 ? "spécialisation modérée" : "proche du modèle global"}`,
          globalContrib: `Ce site contribue ${(aggWeight * 100).toFixed(1)}% au modèle global commun`,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/federated-adapt/aggregate
   * Déclenche l'agrégation différentielle complète (invalide le cache)
   */
  app.post("/api/federated-adapt/aggregate", auth, async (_req, res) => {
    try {
      lastAggregationTs = 0; // invalide le cache
      const result = await getCachedAggregation();
      res.json({
        success: true,
        globalModel: result.globalModel,
        nSites: result.siteProfiles.length,
        fleetMaturityAvg: result.fleetMaturityAvg,
        fleetLambdaAvg: result.fleetLambdaAvg,
        fleetSPIAvg: result.fleetSPIAvg,
        nSitesMature: result.nSitesMature,
        nSitesSpecialized: result.nSitesSpecialized,
        driftAlerts: result.driftAlerts,
        aggregationWeights: result.aggregationWeights,
        aggregatedAt: result.aggregatedAt,
        dimLabels: DIM_LABELS,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/federated-adapt/specialization
   * Rapport SPI complet : quels sites sont les plus spécialisés et sur quelles dimensions
   */
  app.get("/api/federated-adapt/specialization", auth, async (_req, res) => {
    try {
      const agg = await getCachedAggregation();

      const spiReport = agg.personalizedModels
        .map(pm => {
          const profile = agg.siteProfiles.find(p => p.tenantId === pm.tenantId)!;

          // Dimensions où le modèle local > global (spécialisation positive)
          const dimDiffs = DIM_LABELS.map((lbl, i) => ({
            dim: lbl,
            local: pm.localVector[i],
            global: pm.globalVector[i],
            delta: pm.localVector[i] - pm.globalVector[i],
            isSpecialized: pm.localVector[i] > pm.globalVector[i] * 1.2,
          }));

          const specializedDims = dimDiffs.filter(d => d.isSpecialized);

          return {
            tenantId: pm.tenantId,
            tenantName: profile?.tenantName ?? pm.tenantId,
            spi: pm.spi,
            lambda: pm.mixingCoefficient,
            maturity: profile?.maturityScore ?? 0,
            specializedDims,
            nSpecializedDims: specializedDims.length,
            dominantSpecialization: dimDiffs.sort((a, b) => b.delta - a.delta)[0]?.dim ?? "none",
            riskLevel: pm.spi > 0.6 && profile?.maturityScore < 0.3
              ? "artefact"
              : pm.spi > 0.5 ? "specialized"
              : pm.spi > 0.2 ? "emerging"
              : "generic",
          };
        })
        .sort((a, b) => b.spi - a.spi);

      res.json({
        spiReport,
        globalModel: agg.globalModel,
        dimLabels: DIM_LABELS,
        summary: {
          nGeneric: spiReport.filter(s => s.riskLevel === "generic").length,
          nEmerging: spiReport.filter(s => s.riskLevel === "emerging").length,
          nSpecialized: spiReport.filter(s => s.riskLevel === "specialized").length,
          nArtefact: spiReport.filter(s => s.riskLevel === "artefact").length,
          maxSPI: Math.max(...spiReport.map(s => s.spi), 0),
          avgSPI: agg.fleetSPIAvg,
          driftAlerts: agg.driftAlerts,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/federated-adapt/model-dims
   * Interprétation des 12 dimensions du vecteur modèle
   */
  app.get("/api/federated-adapt/model-dims", auth, (_req, res) => {
    res.json({
      dims: DIM_LABELS.map((lbl, i) => ({
        index: i,
        name: lbl,
        category: i < 6 ? "sensor_weight" : i < 11 ? "failure_mode" : "threshold",
        description: [
          "Poids capteur vibration (défauts mécaniques)",
          "Poids capteur température (surchauffe, friction)",
          "Poids capteur pression (défauts hydrauliques)",
          "Poids capteur courant électrique",
          "Poids capteur acoustique (bruits parasites)",
          "Poids capteur vitesse/rotation",
          "Probabilité défaillance roulement/palier",
          "Probabilité défaillance lubrification",
          "Probabilité surchauffe",
          "Probabilité cavitation",
          "Probabilité défaut électrique",
          "Sensibilité seuil IMCA (ajustement local)",
        ][i],
      })),
      priorUniform: new Array(MODEL_DIMS).fill(1 / MODEL_DIMS),
      lambdaTable: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map(m => ({
        maturity: m,
        lambda: LAMBDA_MAX * (1 - Math.exp(-3.5 * m)),
        interpretation: m < 0.2 ? "site neuf" : m < 0.5 ? "site intermédiaire" : m < 0.8 ? "site mature" : "site expert",
      })),
    });
  });

  console.log("🧬 Routes Adaptation Fédérée Différentielle enregistrées (pFed · λ-elastic · SPI · FedAvg pondéré)");
}
