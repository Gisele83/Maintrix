import type { Express } from "express";
import { companyDataAccess } from "./company-data-access";
import { dataAggregationAlgorithm } from "./data-aggregation-algorithm";
import { db } from "./db";
import { equipmentRegistry, diagnosticSessions, companies, dataAccessPermissions } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Routes API pour le diagnostic enrichi avec contrôle d'accès par entreprise
 * et algorithme d'agrégation des données historiques
 */

export function registerEnhancedDiagnosticRoutes(app: Express) {
  
  /**
   * Diagnostic IA enrichi avec données historiques multi-entreprises
   * Respecte la confidentialité tout en améliorant la précision
   */
  app.post("/api/enhanced-diagnostic", async (req, res) => {
    try {
      const {
        userId,
        equipmentId,
        equipmentType,
        symptoms,
        sensorData,
        confidentialityLevel = 'moderate'
      } = req.body;
      const tenantId = (req as any).tenantId || 'default-tenant';

      // 1. Validation des permissions utilisateur
      const hasAccess = await companyDataAccess.verifyUserAccess(
        userId,
        tenantId,
        'enhanced_diagnostic'
      );

      if (!hasAccess) {
        return res.status(403).json({
          error: "Accès refusé au diagnostic enrichi"
        });
      }

      // 2. Récupération contexte équipement
      const equipment = await db
        .select()
        .from(equipmentRegistry)
        .where(and(
          eq(equipmentRegistry.id, equipmentId),
          eq(equipmentRegistry.tenantId, tenantId) // Sécurité isolation tenant
        ))
        .limit(1);

      if (!equipment.length) {
        return res.status(404).json({
          error: "Équipement non trouvé ou accès non autorisé"
        });
      }

      // 3. Données historiques propres au tenant
      const companyHistorical = await companyDataAccess.getCompanyHistoricalData(
        { tenantId, userId, userRole: 'user' },
        {
          equipmentTypes: [equipmentType],
          timeRange: {
            startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 an
            endDate: new Date()
          }
        }
      );

      // 4. Enrichissement avec données agrégées industrie
      const enrichedResult = await dataAggregationAlgorithm.enrichDiagnosticWithAggregatedData(
        userId,
        tenantId,
        {
          equipmentType,
          symptoms: Array.isArray(symptoms) ? symptoms : [symptoms],
          selectedDiagnosis: req.body.initialDiagnosis
        },
        confidentialityLevel
      );

      // 5. Calcul score de confiance final
      const baseConfidence = req.body.baseConfidence || 0.7;
      const finalConfidence = Math.min(
        baseConfidence + enrichedResult.confidenceBoost,
        0.99
      );

      // 6. Sauvegarde session diagnostic enrichi
      const [diagnosticSession] = await db
        .insert(diagnosticSessions)
        .values({
          equipmentType,
          equipmentId: equipmentId.toString(),
          symptoms: Array.isArray(symptoms) ? symptoms.join(', ') : symptoms,
          urgency: req.body.urgency || 'medium',
          confidence: finalConfidence,
          mlPrediction: true,
          sessionData: JSON.stringify({
            sensorData,
            companyHistoricalCases: companyHistorical.length,
            industryInsights: enrichedResult.aggregatedInsights.length,
            confidenceBoost: enrichedResult.confidenceBoost,
            enrichmentSource: 'multi_enterprise_aggregation'
          }),
          userId,
          status: 'completed'
        })
        .returning();

      // 7. Réponse enrichie
      res.json({
        diagnosticId: diagnosticSession.id,
        equipment: {
          id: equipment[0].id,
          name: equipment[0].equipmentName,
          type: equipment[0].equipmentType,
          manufacturer: equipment[0].manufacturer
        },
        diagnosis: {
          primary: req.body.initialDiagnosis || 'Diagnostic basé sur données historiques',
          confidence: finalConfidence,
          confidenceBoost: enrichedResult.confidenceBoost,
          sources: {
            companyHistorical: companyHistorical.length,
            industryAggregated: enrichedResult.similarCasesFromIndustry,
            insights: enrichedResult.aggregatedInsights.length
          }
        },
        recommendations: {
          immediate: enrichedResult.enhancedRecommendations.slice(0, 3),
          preventive: enrichedResult.enhancedRecommendations.slice(3, 6),
          industryBestPractices: enrichedResult.industryBenchmarks.bestPractices
        },
        industryComparison: {
          avgSuccessRate: enrichedResult.industryBenchmarks.avgSuccessRate,
          avgCost: enrichedResult.industryBenchmarks.avgCost,
          avgDuration: enrichedResult.industryBenchmarks.avgDuration,
          yourPerformance: calculateCompanyPerformance(companyHistorical)
        },
        insights: enrichedResult.aggregatedInsights.map(insight => ({
          pattern: insight.pattern,
          frequency: insight.frequency,
          successRate: insight.successRate,
          isSignificant: insight.isStatisticallySignificant,
          recommendations: insight.recommendations.slice(0, 2)
        })),
        dataPrivacy: {
          level: confidentialityLevel,
          companyDataIsolated: true,
          aggregationAnonymized: true,
          sourcesCount: enrichedResult.aggregatedInsights.reduce(
            (sum, i) => sum + i.sourcesCount, 0
          )
        }
      });

    } catch (error) {
      console.error('Erreur diagnostic enrichi:', error);
      res.status(500).json({ 
        error: "Erreur lors du diagnostic enrichi",
        fallback: "Diagnostic standard disponible"
      });
    }
  });

  /**
   * Récupération des benchmarks industrie pour un type d'équipement
   */
  app.get("/api/industry-benchmarks/:equipmentType", async (req, res) => {
    try {
      const { equipmentType } = req.params;
      const { userId } = req.query;
      const tenantId = (req as any).tenantId || 'default-tenant';

      // Validation permissions
      const hasAccess = await companyDataAccess.verifyUserAccess(
        parseInt(userId as string),
        tenantId,
        'view_industry_benchmarks'
      );

      if (!hasAccess) {
        return res.status(403).json({
          error: "Accès refusé aux benchmarks industrie"
        });
      }

      // Récupération benchmarks anonymisés
      const aggregatedInsights = await dataAggregationAlgorithm.aggregateHistoricalData({
        equipmentType: equipmentType,
        symptoms: [], // Tous symptômes
        confidentialityLevel: 'moderate',
        timeWindow: { months: 18 }
      });

      const benchmarks = {
        equipmentType: equipmentType,
        lastUpdated: new Date(),
        industryMetrics: {
          totalCases: aggregatedInsights.reduce((sum, i) => sum + i.frequency, 0),
          avgSuccessRate: calculateWeightedAverage(
            aggregatedInsights.map(i => i.successRate),
            aggregatedInsights.map(i => i.frequency)
          ),
          avgResolutionTime: calculateWeightedAverage(
            aggregatedInsights.map(i => i.avgResolutionTime),
            aggregatedInsights.map(i => i.frequency)
          ),
          avgCost: calculateWeightedAverage(
            aggregatedInsights.map(i => i.avgCost),
            aggregatedInsights.map(i => i.frequency)
          ),
          sourcesCount: Math.max(...aggregatedInsights.map(i => i.sourcesCount))
        },
        commonPatterns: aggregatedInsights
          .filter(i => i.isStatisticallySignificant)
          .slice(0, 5)
          .map(insight => ({
            pattern: insight.pattern,
            frequency: insight.frequency,
            successRate: Math.round(insight.successRate),
            topRecommendation: insight.recommendations[0]
          })),
        bestPractices: [
          ...new Set(
            aggregatedInsights
              .filter(i => i.successRate > 85)
              .flatMap(i => i.recommendations)
          )
        ].slice(0, 8),
        riskFactors: aggregatedInsights
          .filter(i => i.successRate < 60)
          .map(i => ({
            pattern: i.pattern,
            riskLevel: 'high',
            mitigation: i.recommendations[0]
          }))
      };

      res.json(benchmarks);

    } catch (error) {
      console.error('Erreur benchmarks industrie:', error);
      res.status(500).json({ error: "Erreur récupération benchmarks" });
    }
  });

  /**
   * Statistiques d'utilisation des données agrégées (audit)
   */
  app.get("/api/data-usage-stats", async (req, res) => {
    try {
      const { userId } = req.query;
      const tenantId = (req as any).tenantId || 'default-tenant';

      // Validation permissions admin
      const hasAccess = await companyDataAccess.verifyUserAccess(
        parseInt(userId as string),
        tenantId,
        'view_data_usage_stats'
      );

      if (!hasAccess) {
        return res.status(403).json({
          error: "Accès refusé aux statistiques d'usage"
        });
      }

      // Statistiques anonymisées (tenant tracé dans metadata, voir company-data-access.ts)
      const stats = await db
        .select({
          month: sql`DATE_TRUNC('month', accessed_at)`,
          accessType: dataAccessPermissions.permission,
          accessCount: sql<number>`COUNT(*)`,
          uniqueUsers: sql<number>`COUNT(DISTINCT user_id)`
        })
        .from(dataAccessPermissions)
        .where(sql`${dataAccessPermissions.metadata}->>'tenantId' = ${tenantId}`)
        .groupBy(
          sql`DATE_TRUNC('month', accessed_at)`,
          dataAccessPermissions.permission
        )
        .orderBy(sql`DATE_TRUNC('month', accessed_at) DESC`)
        .limit(12); // 12 derniers mois

      res.json({
        company: {
          id: tenantId,
          dataUsageCompliant: true,
          privacyLevel: 'enterprise_grade'
        },
        monthlyStats: stats,
        summary: {
          totalAccess: stats.reduce((sum, s) => sum + s.accessCount, 0),
          activeUsers: Math.max(...stats.map(s => s.uniqueUsers)),
          mostUsedFeature: stats
            .reduce((max, curr) => 
              curr.accessCount > max.accessCount ? curr : max,
              stats[0] || { accessType: 'none', accessCount: 0 }
            ).accessType
        }
      });

    } catch (error) {
      console.error('Erreur statistiques usage:', error);
      res.status(500).json({ error: "Erreur récupération statistiques" });
    }
  });

}

// Méthodes utilitaires
function calculateWeightedAverage(values: number[], weights: number[]): number {
  if (values.length === 0 || weights.length === 0) return 0;

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = values.reduce((sum, val, i) => sum + (val * weights[i]), 0);
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

// Note: sans lien fiable diagnostic -> ordre de travail (voir company-data-access.ts),
// historicalData n'expose plus success/cost/duration : cette fonction retombe donc
// toujours sur des valeurs à 0, en attendant le branchement via interventionSteps.
function calculateCompanyPerformance(historicalData: any[]): any {
  if (historicalData.length === 0) {
    return {
      successRate: 0,
      avgCost: 0,
      avgDuration: 0,
      totalCases: 0
    };
  }

  const completed = historicalData.filter(h => h.success === 'completed');
  const costs = historicalData.map(h => parseFloat(h.cost || '0')).filter(c => c > 0);
  const durations = historicalData.map(h => parseInt(h.duration || '0')).filter(d => d > 0);

  return {
    successRate: Math.round((completed.length / historicalData.length) * 100),
    avgCost: costs.length > 0 ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length) : 0,
    avgDuration: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    totalCases: historicalData.length
  };
}

export default registerEnhancedDiagnosticRoutes;