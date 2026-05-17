/**
 * Jensen-Shannon Divergence API Routes
 * Dérive conceptuelle sur fenêtres glissantes
 *
 * GET  /api/jsd/config              → configuration et seuils
 * POST /api/jsd/compute             → JSD entre deux séries
 * GET  /api/jsd/equipment/:id       → analyse JSD de l'historique IoT d'un équipement
 * GET  /api/jsd/global-status       → état de dérive global de la flotte
 */

import type { Express } from "express";
import { db } from "./db";
import { iotSensorData, equipmentRegistry } from "@shared/schema";
import { eq, gte, desc } from "drizzle-orm";
import {
  computeSeriesJSD,
  slidingWindowJSD,
  analyzeMultiSensorDrift,
  jensenShannonDivergence,
  jensenShannonDistance,
  JSD_THRESHOLDS,
  JSD_BETA_DEFAULT,
  JSD_BINS_DEFAULT,
  JSD_WINDOW_DEFAULT,
} from "./js-divergence";

export function registerJSDRoutes(app: Express) {
  /**
   * GET /api/jsd/config
   * Retourne la configuration des seuils JSD et la formule
   */
  app.get("/api/jsd/config", (_req, res) => {
    res.json({
      method: "Jensen-Shannon Divergence",
      formula: "JSD(P‖Q) = ½·KL(P‖M) + ½·KL(Q‖M) où M = ½(P+Q)",
      distance: "JSD_distance = √JSD ∈ [0,1]",
      properties: {
        symmetric: true,
        bounded: "[0, 1] (base 2)",
        properMetric: true,
        robustToZeros: "Oui — lissage de Laplace + mélange M évite KL infini",
      },
      thresholds: JSD_THRESHOLDS,
      defaults: {
        beta: JSD_BETA_DEFAULT,
        bins: JSD_BINS_DEFAULT,
        windowSize: JSD_WINDOW_DEFAULT,
      },
      upgrade: {
        from: "Kullback-Leibler (asymétrique, non borné, sensible aux zéros)",
        to: "Jensen-Shannon (symétrique, [0,1], métrique propre, robuste)",
        idcFormula: "IDC(t) = 100 × (1 − tanh(β × JSD_mean_glissant))",
      },
    });
  });

  /**
   * POST /api/jsd/compute
   * Calcule JSD et distance entre deux séries de valeurs
   * Body: { seriesP: number[], seriesQ: number[], bins?: number, windowSize?: number }
   */
  app.post("/api/jsd/compute", (req, res) => {
    try {
      const { seriesP, seriesQ, bins = 20, windowSize = 20 } = req.body;

      if (!Array.isArray(seriesP) || !Array.isArray(seriesQ)) {
        return res.status(400).json({ error: "seriesP et seriesQ doivent être des tableaux de nombres" });
      }

      if (seriesP.length < 2 || seriesQ.length < 2) {
        return res.status(400).json({ error: "Chaque série doit contenir au moins 2 valeurs" });
      }

      const { jsd, jsdDistance } = computeSeriesJSD(seriesP, seriesQ, bins);

      // Sliding window sur la série concaténée
      const combined = [...seriesP, ...seriesQ];
      const sliding = slidingWindowJSD(combined, Math.min(windowSize, Math.floor(combined.length / 4)));

      const driftLevel =
        jsdDistance < JSD_THRESHOLDS.stable   ? "stable"   :
        jsdDistance < JSD_THRESHOLDS.light    ? "light"    :
        jsdDistance < JSD_THRESHOLDS.moderate ? "moderate" :
        jsdDistance < JSD_THRESHOLDS.severe   ? "severe"   : "critical";

      res.json({
        jsd: parseFloat(jsd.toFixed(5)),
        jsdDistance: parseFloat(jsdDistance.toFixed(5)),
        driftLevel,
        idcValue: Math.round(100 * (1 - Math.tanh(JSD_BETA_DEFAULT * sliding.summary.meanJSD))),
        sliding: {
          meanJSD: sliding.summary.meanJSD,
          maxJSD: sliding.summary.maxJSD,
          alertCount: sliding.summary.alertCount,
          driftTrend: sliding.summary.driftTrend,
          adaptiveThreshold: sliding.summary.adaptiveThreshold,
          seriesLength: sliding.series.length,
          lastPoint: sliding.lastDrift,
        },
        comparison: {
          klCompat: parseFloat((jsd / 2).toFixed(5)), // approximation ½·KL(P‖M) pour comparaison
          improvement: "JSD symétrique + bornée vs KL asymétrique non borné",
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/jsd/equipment/:id
   * Analyse JSD complète de l'historique IoT d'un équipement
   */
  app.get("/api/jsd/equipment/:id", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.id);
      const windowDays = parseInt((req.query.windowDays as string) ?? "30");
      const windowSize = parseInt((req.query.windowSize as string) ?? "20");

      if (isNaN(equipmentId)) {
        return res.status(400).json({ error: "equipmentId invalide" });
      }

      const cutoff = new Date(Date.now() - windowDays * 86_400_000);

      const sensorRows = await db
        .select({
          sensorType: iotSensorData.sensorType,
          value: iotSensorData.value,
          timestamp: iotSensorData.timestamp,
        })
        .from(iotSensorData)
        .where(gte(iotSensorData.timestamp, cutoff))
        .orderBy(iotSensorData.timestamp)
        .limit(2000);

      if (sensorRows.length === 0) {
        return res.json({
          equipmentId,
          windowDays,
          message: "Aucune donnée IoT disponible sur la période",
          globalDrift: 0,
          combinedDriftLevel: "stable",
          perSensor: {},
        });
      }

      // Grouper par type de capteur
      const sensorMap = new Map<string, number[]>();
      for (const row of sensorRows) {
        const type = row.sensorType ?? "unknown";
        if (!sensorMap.has(type)) sensorMap.set(type, []);
        sensorMap.get(type)!.push(row.value ?? 0);
      }

      const multiResult = analyzeMultiSensorDrift(sensorMap, windowSize);

      res.json({
        equipmentId,
        windowDays,
        windowSize,
        totalReadings: sensorRows.length,
        sensorTypes: Array.from(sensorMap.keys()),
        globalDrift: multiResult.globalDrift,
        dominantSensor: multiResult.dominantSensor,
        combinedDriftLevel: multiResult.combinedDriftLevel,
        recommendation: multiResult.recommendation,
        perSensor: Object.fromEntries(
          Object.entries(multiResult.perSensor).map(([sensor, result]) => [
            sensor,
            {
              meanJSD: result.summary.meanJSD,
              maxJSD: result.summary.maxJSD,
              alertCount: result.summary.alertCount,
              driftTrend: result.summary.driftTrend,
              overallDriftLevel: result.summary.overallDriftLevel,
              adaptiveThreshold: result.summary.adaptiveThreshold,
              calibrationMean: result.summary.calibrationMean,
              calibrationStd: result.summary.calibrationStd,
              lastPoint: result.lastDrift,
              seriesLength: result.series.length,
              // Include last 20 JSD points for mini-chart
              recentSeries: result.series.slice(-20).map(p => ({
                index: p.index,
                jsdDistance: p.jsdDistance,
                driftLevel: p.driftLevel,
                isAlert: p.isAlert,
              })),
            },
          ])
        ),
        jsdConfig: {
          thresholds: JSD_THRESHOLDS,
          beta: JSD_BETA_DEFAULT,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/jsd/global-status
   * État de dérive conceptuelle global de tous les équipements (last 24h IoT data)
   */
  app.get("/api/jsd/global-status", async (_req, res) => {
    try {
      const cutoff24h = new Date(Date.now() - 24 * 3_600_000);

      const rows = await db
        .select({
          sensorType: iotSensorData.sensorType,
          value: iotSensorData.value,
          timestamp: iotSensorData.timestamp,
        })
        .from(iotSensorData)
        .where(gte(iotSensorData.timestamp, cutoff24h))
        .orderBy(iotSensorData.timestamp)
        .limit(5000);

      const sensorMap = new Map<string, number[]>();
      for (const row of rows) {
        const t = row.sensorType ?? "unknown";
        if (!sensorMap.has(t)) sensorMap.set(t, []);
        sensorMap.get(t)!.push(row.value ?? 0);
      }

      if (sensorMap.size === 0) {
        return res.json({
          status: "no_data",
          globalDrift: 0,
          combinedDriftLevel: "stable",
          perSensor: {},
          totalReadings: 0,
          recommendation: "Aucune donnée IoT disponible dans les dernières 24h.",
        });
      }

      const multi = analyzeMultiSensorDrift(sensorMap, 15, 5);

      // Summary per sensor (lightweight)
      const perSensorSummary: Record<string, {
        meanJSD: number; driftLevel: string; alertCount: number; trend: string;
      }> = {};
      for (const [sensor, result] of Object.entries(multi.perSensor)) {
        perSensorSummary[sensor] = {
          meanJSD: result.summary.meanJSD,
          driftLevel: result.summary.overallDriftLevel,
          alertCount: result.summary.alertCount,
          trend: result.summary.driftTrend,
        };
      }

      res.json({
        status: "ok",
        computedAt: new Date().toISOString(),
        globalDrift: multi.globalDrift,
        dominantSensor: multi.dominantSensor,
        combinedDriftLevel: multi.combinedDriftLevel,
        recommendation: multi.recommendation,
        perSensor: perSensorSummary,
        totalReadings: rows.length,
        sensorCount: sensorMap.size,
        jsdThresholds: JSD_THRESHOLDS,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log("📊 Jensen-Shannon Divergence routes registered (concept drift sur fenêtres glissantes)");
}
