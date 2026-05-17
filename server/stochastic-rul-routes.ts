/**
 * Stochastic RUL API Routes
 * Projection RUL par processus de Wiener / Gamma avec intervalles de confiance
 *
 * GET  /api/stochastic-rul/config                  → paramètres et formules
 * POST /api/stochastic-rul/compute                 → calcul à partir d'une série IMCA fournie
 * GET  /api/stochastic-rul/equipment/:id           → RUL stochastique depuis historique IoT réel
 * GET  /api/stochastic-rul/compare/:id             → Wiener vs Gamma côte à côte
 */

import type { Express } from "express";
import { db } from "./db";
import { iotSensorData, equipmentRegistry } from "@shared/schema";
import { eq, gte, desc } from "drizzle-orm";
import {
  computeStochasticRUL,
  estimateWienerParams,
  estimateGammaParams,
  computeWienerRUL,
  computeGammaRUL,
  type StochasticRULResult,
} from "./stochastic-rul";

export function registerStochasticRULRoutes(app: Express) {
  /**
   * GET /api/stochastic-rul/config
   * Retourne la configuration mathématique des deux modèles stochastiques
   */
  app.get("/api/stochastic-rul/config", (_req, res) => {
    res.json({
      models: {
        wiener: {
          name: "Processus de Wiener (Brownian Motion avec dérive)",
          equation: "X(t) = X₀ + μt + σW(t)",
          rulDistribution: "T_RUL ~ IG(m, λ)  [Inverse Gaussienne]",
          rulFormula: "m = D/μ,  λ = D²/σ²,  D = θ - x_actuel",
          cdf: "F(t) = Φ(√(λ/t)·(t/m−1)) + exp(2λ/m)·Φ(−√(λ/t)·(t/m+1))",
          properties: ["Distribution analytique exacte", "Symétrique aux petites valeurs σ/μ", "Adapté aux dégradations continues à bruit additif"],
          parameterEstimation: {
            mu: "μ̂ = mean(Δd) / Δt  [MLE dérive]",
            sigma: "σ̂² = var(Δd) / Δt  [MLE diffusion]",
          },
          confidenceIntervals: "Analytiques via CDF Inverse Gaussienne (bisection)",
        },
        gamma: {
          name: "Processus Gamma",
          equation: "ΔX(Δt) ~ Gamma(α·Δt, β)  [incréments i.i.d.]",
          rulDistribution: "Monte Carlo (15 000 trajectoires, générateur Marsaglia-Tsang)",
          properties: ["Adapté aux dégradations monotones cumulatives (usure, corrosion)", "Incréments toujours positifs", "Leptokurtique pour petits α"],
          parameterEstimation: {
            alpha: "α̂ = mean²/var  (par heure)",
            beta: "β̂ = mean/var  (taux)",
          },
          confidenceIntervals: "Empiriques sur trajectoires Monte Carlo",
        },
      },
      ensemble: {
        method: "Fusion bayésienne pondérée",
        weights: "w_Wiener ∝ R²(trajectoire linéaire),  w_Gamma ∝ fraction incréments positifs",
        formula: "RUL_ensemble = w_W × RUL_Wiener + w_G × RUL_Gamma  (par percentile)",
      },
      degradationMapping: {
        formula: "d(t) = 100 − IMCA(t)",
        failureThreshold: "θ_fail = 100 − IMCA_seuil  (défaut: IMCA_seuil = 30 → θ = 70)",
        interpretation: "Plus d est élevé, plus l'actif est dégradé",
      },
      confidenceIntervals: ["P05 (pessimiste)", "P10", "P25 (Q1)", "P50 (médiane)", "P75 (Q3)", "P90", "P95 (optimiste)"],
    });
  });

  /**
   * POST /api/stochastic-rul/compute
   * Calcul RUL stochastique à partir d'une série IMCA fournie
   * Body: { imcaHistory: number[], currentIMCA?: number, deltaTHours?: number, failureIMCA?: number }
   */
  app.post("/api/stochastic-rul/compute", (req, res) => {
    try {
      const {
        imcaHistory,
        currentIMCA,
        deltaTHours = 24,
        failureIMCA = 30,
      } = req.body;

      if (!Array.isArray(imcaHistory) || imcaHistory.length < 2) {
        return res.status(400).json({
          error: "imcaHistory doit être un tableau d'au moins 2 scores IMCA chronologiques",
        });
      }

      const current = typeof currentIMCA === "number" ? currentIMCA : imcaHistory[imcaHistory.length - 1];

      if (current < 0 || current > 100) {
        return res.status(400).json({ error: "currentIMCA doit être dans [0, 100]" });
      }

      const result = computeStochasticRUL(imcaHistory, current, deltaTHours, failureIMCA);

      res.json({
        ...result,
        meta: {
          nHistory: imcaHistory.length,
          deltaTHours,
          failureIMCA,
          currentIMCA: current,
          computedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/stochastic-rul/equipment/:id
   * RUL stochastique depuis l'historique IMCA reconstruit par capteurs IoT
   */
  app.get("/api/stochastic-rul/equipment/:id", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.id);
      const windowDays = parseInt((req.query.windowDays as string) ?? "90");
      const deltaTHours = parseFloat((req.query.deltaTHours as string) ?? "24");
      const failureIMCA = parseFloat((req.query.failureIMCA as string) ?? "30");

      if (isNaN(equipmentId)) {
        return res.status(400).json({ error: "equipmentId invalide" });
      }

      const equipment = await db
        .select({ name: equipmentRegistry.name, type: equipmentRegistry.type })
        .from(equipmentRegistry)
        .where(eq(equipmentRegistry.id, equipmentId))
        .limit(1);

      const cutoff = new Date(Date.now() - windowDays * 86_400_000);

      const sensorRows = await db
        .select({ value: iotSensorData.value, timestamp: iotSensorData.timestamp, sensorType: iotSensorData.sensorType })
        .from(iotSensorData)
        .where(gte(iotSensorData.timestamp, cutoff))
        .orderBy(iotSensorData.timestamp)
        .limit(5000);

      if (sensorRows.length < 3) {
        return res.json({
          equipmentId,
          equipmentName: equipment[0]?.name ?? `Équipement #${equipmentId}`,
          message: "Données IoT insuffisantes pour ajuster un modèle stochastique",
          nReadings: sensorRows.length,
          result: null,
        });
      }

      // Reconstituer série IMCA approximée via la santé capteur normalisée
      // Regrouper par tranche de deltaTHours
      const binMs = deltaTHours * 3_600_000;
      const t0 = sensorRows[0].timestamp?.getTime() ?? Date.now();
      const bins = new Map<number, number[]>();
      for (const row of sensorRows) {
        const bin = Math.floor(((row.timestamp?.getTime() ?? t0) - t0) / binMs);
        if (!bins.has(bin)) bins.set(bin, []);
        bins.get(bin)!.push(row.value ?? 0);
      }

      // IMCA proxy: normalise chaque bin en [0,100] relatif à la médiane globale
      const allValues = sensorRows.map(r => r.value ?? 0);
      const sorted = [...allValues].sort((a, b) => a - b);
      const globalMedian = sorted[Math.floor(sorted.length / 2)] || 1;

      const imcaHistory: number[] = [];
      const binKeys = [...bins.keys()].sort((a, b) => a - b);
      for (const k of binKeys) {
        const vals = bins.get(k)!;
        const binMean = vals.reduce((a, b) => a + b, 0) / vals.length;
        // Proxy santé : plus la valeur s'éloigne de la médiane → score plus bas
        const relDev = Math.abs(binMean - globalMedian) / (globalMedian || 1);
        const imcaProxy = Math.max(0, Math.min(100, 100 * Math.exp(-2 * relDev)));
        imcaHistory.push(Math.round(imcaProxy));
      }

      if (imcaHistory.length < 3) {
        return res.json({
          equipmentId,
          message: "Trop peu de périodes temporelles distinctes pour ajuster un modèle",
          nReadings: sensorRows.length, nBins: imcaHistory.length, result: null,
        });
      }

      const currentIMCA = imcaHistory[imcaHistory.length - 1];
      const result = computeStochasticRUL(imcaHistory, currentIMCA, deltaTHours, failureIMCA);

      res.json({
        equipmentId,
        equipmentName: equipment[0]?.name ?? `Équipement #${equipmentId}`,
        equipmentType: equipment[0]?.type,
        windowDays,
        deltaTHours,
        failureIMCA,
        nReadings: sensorRows.length,
        nPeriods: imcaHistory.length,
        imcaHistory,
        currentIMCA,
        result,
        computedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/stochastic-rul/compare/:id
   * Compare Wiener vs Gamma côte à côte sur une série synthétique
   * Body: { imcaHistory: number[], currentIMCA?, deltaTHours?, failureIMCA? }
   */
  app.get("/api/stochastic-rul/compare/:id", async (req, res) => {
    try {
      const failureIMCA = parseFloat((req.query.failureIMCA as string) ?? "30");

      // Série synthétique de démonstration si aucune fournie
      const demoDegradation = Array.from({ length: 24 }, (_, i) =>
        Math.max(35, 90 - i * 1.5 - Math.sin(i) * 3)
      );
      const demoIMCA = demoDegradation.map(d => Math.round(100 - d));

      const failureThreshold = 100 - failureIMCA;
      const currentDeg = 100 - demoIMCA[demoIMCA.length - 1];

      const degradationPath = demoIMCA.map(s => 100 - s);
      const wienerParams = estimateWienerParams(degradationPath, 24);
      const gammaParams  = estimateGammaParams(degradationPath, 24);

      const wienerRUL = wienerParams.mu > 0
        ? computeWienerRUL(currentDeg, failureThreshold, wienerParams)
        : null;
      const gammaRUL = computeGammaRUL(currentDeg, failureThreshold, gammaParams, 15000, 24);

      res.json({
        note: "Comparaison sur série de démonstration. Utilisez POST /api/stochastic-rul/compute pour vos données réelles.",
        demoIMCA,
        currentIMCA: demoIMCA[demoIMCA.length - 1],
        failureIMCA,
        comparison: {
          wiener: {
            model: "Inverse Gaussienne IG(m, λ)",
            params: wienerParams,
            rul: wienerRUL,
            pros: ["Analytique — rapide", "IC exacts", "Standard industrie (PHM)"],
            cons: ["Peut prédire RUL infini si μ ≤ 0", "Non adapté aux dégradations non-monotones"],
          },
          gamma: {
            model: "Gamma (Monte Carlo 15 000 trajectoires)",
            params: gammaParams,
            rul: gammaRUL,
            pros: ["Adapté aux dégradations cumulatives irréversibles", "Robuste aux sauts de dégradation"],
            cons: ["Monte Carlo = plus lent", "Requiert des incréments positifs"],
          },
        },
        recommendation:
          wienerParams.r2 > 0.7
            ? "Le modèle de Wiener est recommandé (R² élevé — trajectoire quasi-linéaire)."
            : gammaParams.positiveRatio > 0.7
            ? "Le modèle Gamma est recommandé (dégradation monotone cumulative bien établie)."
            : "Fusion bayésienne recommandée (incertitude sur la nature du processus de dégradation).",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log("🎲 Routes RUL stochastiques enregistrées (Wiener · Inverse Gaussienne · Gamma · Monte Carlo)");
}
