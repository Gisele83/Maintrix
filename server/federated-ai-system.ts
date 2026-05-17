import { db } from "./db";
import { federatedLearning, maintenanceCases, diagnosticSessions, tenants } from "@shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import crypto from "crypto";
import {
  patternSimilarityISC4D,
  computePhiContributionWeight,
  calculateFiabilite,
  calculateMaturite,
  computePhi,
  aggregatePatternsByPhi,
  ISC_WEIGHTS,
  PHI_DEFAULTS,
  type PatternWithPhi,
} from "./isc-aggregation";

// =====================================================
// FEDERATED AI LEARNING SYSTEM
// =====================================================
// Système d'apprentissage fédéré pour amélioration continue
// - Modèles ML séparés par tenant
// - Agrégation sécurisée sans fuite de données
// - Feedback loop pour amélioration continue

export interface TenantAIModel {
  tenantId: string;
  equipmentCategory: string;
  modelVersion: string;
  accuracy: number;
  trainingDataSize: number;
  lastTraining: Date;
  patterns: any[];
}

export interface FederatedPattern {
  patternHash: string;
  equipmentCategory: string;
  problemPattern: any;
  solutionEffectiveness: number;
  anonymizedMetrics: any;
  contributionWeight: number;
}

/**
 * 🧠 FEDERATED AI SERVICE
 * Service principal pour l'IA fédérée multi-tenant
 */
export class FederatedAIService {
  private tenantModels: Map<string, Map<string, TenantAIModel>> = new Map();

  /**
   * 🔄 CONTINUOUS LEARNING
   * Traitement continu des données de diagnostic pour améliorer les modèles
   */
  async processDiagnosticFeedback(
    tenantId: string,
    diagnosticSessionId: number,
    actualSolution: string,
    effectiveness: number,
    resolutionTime: number
  ): Promise<void> {
    try {
      // 1. Récupérer la session de diagnostic
      const [session] = await db
        .select()
        .from(diagnosticSessions)
        .where(and(
          eq(diagnosticSessions.id, diagnosticSessionId),
          eq(diagnosticSessions.tenantId!, tenantId)
        ));

      if (!session) {
        throw new Error("Session de diagnostic non trouvée");
      }

      // 2. Anonymiser les données
      const anonymizedPattern = this.anonymizePattern({
        equipmentType: session.equipmentType,
        symptoms: session.symptoms,
        zone: session.zone ? "zone_anonymized" : null,
        urgency: session.urgency,
      });

      // 3. Calculer le hash du pattern
      const patternHash = this.generatePatternHash(anonymizedPattern);

      // 4. Créer ou mettre à jour l'entrée federated learning
      await db.insert(federatedLearning).values({
        tenantId,
        patternHash,
        equipmentCategory: session.equipmentType,
        problemPattern: anonymizedPattern,
        solutionEffectiveness: effectiveness,
        anonymizedMetrics: {
          resolutionTime: this.anonymizeMetric(resolutionTime),
          urgencyLevel: session.urgency,
          complexityScore: this.calculateComplexity(session.symptoms),
        },
        contributionWeight: this.calculateContributionWeight(effectiveness, resolutionTime),
      }).onConflictDoUpdate({
        target: [federatedLearning.patternHash, federatedLearning.tenantId!],
        set: {
          solutionEffectiveness: effectiveness,
          anonymizedMetrics: {
            resolutionTime: this.anonymizeMetric(resolutionTime),
            urgencyLevel: session.urgency,
            complexityScore: this.calculateComplexity(session.symptoms),
          },
          contributionWeight: this.calculateContributionWeight(effectiveness, resolutionTime),
          lastUpdated: new Date(),
        },
      });

      console.log(`🧠 FEDERATED LEARNING: Pattern ${patternHash} mis à jour pour tenant ${tenantId}`);
    } catch (error) {
      console.error("❌ FEDERATED LEARNING ERROR:", error);
      throw error;
    }
  }

  /**
   * 🌐 GLOBAL PATTERN AGGREGATION
   * Agrège les patterns de tous les tenants de manière anonymisée
   */
  async aggregateGlobalPatterns(equipmentCategory: string): Promise<FederatedPattern[]> {
    try {
      // 1. Récupérer tous les patterns pour cette catégorie
      const patterns = await db
        .select({
          patternHash: federatedLearning.patternHash,
          equipmentCategory: federatedLearning.equipmentCategory,
          problemPattern: federatedLearning.problemPattern,
          solutionEffectiveness: federatedLearning.solutionEffectiveness,
          anonymizedMetrics: federatedLearning.anonymizedMetrics,
          contributionWeight: federatedLearning.contributionWeight,
        })
        .from(federatedLearning)
        .where(eq(federatedLearning.equipmentCategory, equipmentCategory))
        .orderBy(desc(federatedLearning.solutionEffectiveness));

      // 2. Grouper par patternHash et calculer les moyennes pondérées
      const aggregatedPatterns = new Map<string, FederatedPattern>();

      for (const pattern of patterns) {
        const existing = aggregatedPatterns.get(pattern.patternHash);
        
        if (existing) {
          // Combiner avec le pattern existant (moyenne pondérée)
          const totalWeight = existing.contributionWeight + (pattern.contributionWeight ?? 0);
          existing.solutionEffectiveness = (
            (existing.solutionEffectiveness * existing.contributionWeight) +
            ((pattern.solutionEffectiveness ?? 0) * (pattern.contributionWeight ?? 0))
          ) / totalWeight;
          existing.contributionWeight = totalWeight;
        } else {
          aggregatedPatterns.set(pattern.patternHash, {
            patternHash: pattern.patternHash,
            equipmentCategory: pattern.equipmentCategory ?? '',
            problemPattern: pattern.problemPattern,
            solutionEffectiveness: pattern.solutionEffectiveness ?? 0,
            anonymizedMetrics: pattern.anonymizedMetrics,
            contributionWeight: pattern.contributionWeight ?? 0,
          });
        }
      }

      return Array.from(aggregatedPatterns.values())
        .filter(p => p.solutionEffectiveness >= 0.7) // Seulement les patterns efficaces
        .sort((a, b) => b.solutionEffectiveness - a.solutionEffectiveness)
        .slice(0, 50); // Top 50 patterns
    } catch (error) {
      console.error("❌ GLOBAL AGGREGATION ERROR:", error);
      return [];
    }
  }

  /**
   * 🎯 TENANT-SPECIFIC RECOMMENDATIONS
   * Génère des recommandations spécifiques au tenant basées sur l'IA fédérée
   */
  async getTenantRecommendations(
    tenantId: string,
    equipmentType: string,
    symptoms: string[]
  ): Promise<{
    recommendations: any[];
    confidence: number;
    globalPatterns: number;
    tenantPatterns: number;
  }> {
    try {
      // 1. Créer un pattern anonymisé pour la recherche
      const queryPattern = this.anonymizePattern({
        equipmentType,
        symptoms: symptoms.join(", "),
      });
      
      // 2. Récupérer les patterns globaux pertinents
      const globalPatterns = await this.aggregateGlobalPatterns(equipmentType);
      
      // 3. Récupérer les patterns spécifiques au tenant
      const tenantPatterns = await db
        .select()
        .from(federatedLearning)
        .where(and(
          eq(federatedLearning.tenantId!, tenantId),
          eq(federatedLearning.equipmentCategory!, equipmentType)
        ))
        .orderBy(desc(federatedLearning.solutionEffectiveness));

      // 4. Calculer la similarité et générer des recommandations
      const recommendations = [];
      let totalConfidence = 0;

      // Priorité aux patterns du tenant (poids x2)
      for (const pattern of tenantPatterns) {
        const similarity = this.calculatePatternSimilarity(
          queryPattern,
          pattern.problemPattern
        );
        
        if (similarity > 0.6) {
          recommendations.push({
            source: "tenant",
            similarity,
            effectiveness: pattern.solutionEffectiveness,
            confidence: similarity * (pattern.solutionEffectiveness ?? 0) * 2, // Poids tenant
            pattern: pattern.problemPattern,
            metrics: pattern.anonymizedMetrics,
          });
          totalConfidence += similarity * (pattern.solutionEffectiveness ?? 0) * 2;
        }
      }

      // Puis patterns globaux
      for (const pattern of globalPatterns) {
        const similarity = this.calculatePatternSimilarity(
          queryPattern,
          pattern.problemPattern
        );
        
        if (similarity > 0.5) {
          recommendations.push({
            source: "global",
            similarity,
            effectiveness: pattern.solutionEffectiveness,
            confidence: similarity * (pattern.solutionEffectiveness ?? 0),
            pattern: pattern.problemPattern,
            metrics: pattern.anonymizedMetrics,
          });
          totalConfidence += similarity * (pattern.solutionEffectiveness ?? 0);
        }
      }

      // 5. Trier par confiance et limiter
      recommendations.sort((a, b) => b.confidence - a.confidence);
      const finalRecommendations = recommendations.slice(0, 10);

      return {
        recommendations: finalRecommendations,
        confidence: Math.min(totalConfidence / finalRecommendations.length, 1.0),
        globalPatterns: globalPatterns.length,
        tenantPatterns: tenantPatterns.length,
      };
    } catch (error) {
      console.error("❌ TENANT RECOMMENDATIONS ERROR:", error);
      return {
        recommendations: [],
        confidence: 0,
        globalPatterns: 0,
        tenantPatterns: 0,
      };
    }
  }

  /**
   * 🔒 ANONYMIZATION HELPERS
   * Méthodes pour anonymiser les données sensibles
   */
  private anonymizePattern(pattern: any): any {
    return {
      equipmentType: pattern.equipmentType, // OK à garder
      symptomCount: pattern.symptoms ? pattern.symptoms.split(",").length : 0,
      symptomCategories: this.categorizeSymptoms(pattern.symptoms),
      urgencyLevel: pattern.urgency || "normal",
      zoneCategory: pattern.zone ? "industrial" : "unknown",
    };
  }

  private anonymizeMetric(value: number): number {
    // Arrondir à des intervalles pour anonymiser
    if (value < 60) return 30; // < 1h -> 30min
    if (value < 240) return 120; // < 4h -> 2h
    if (value < 480) return 360; // < 8h -> 6h
    return 720; // > 8h -> 12h
  }

  private generatePatternHash(pattern: any): string {
    const patternString = JSON.stringify(pattern, Object.keys(pattern).sort());
    return crypto.createHash("sha256").update(patternString).digest("hex").substring(0, 16);
  }

  private calculateComplexity(symptoms: string): number {
    if (!symptoms) return 0;
    const symptomCount = symptoms.split(",").length;
    const uniqueWords = new Set(symptoms.toLowerCase().split(/\s+/)).size;
    return Math.min((symptomCount + uniqueWords) / 20, 1.0);
  }

  private calculateContributionWeight(effectiveness: number, resolutionTime: number): number {
    // Φ_i formula: ISC=1 (self-context), Fiabilité + Maturité derived from effectiveness/time
    const successRate = Math.max(0, 1 - resolutionTime / 480);
    return computePhiContributionWeight(effectiveness, successRate, 1, null, 1, PHI_DEFAULTS);
  }

  private categorizeSymptoms(symptoms: string): string[] {
    if (!symptoms) return [];
    
    const categories = [];
    const lowerSymptoms = symptoms.toLowerCase();
    
    if (lowerSymptoms.includes("vibration") || lowerSymptoms.includes("bruit")) {
      categories.push("mechanical");
    }
    if (lowerSymptoms.includes("température") || lowerSymptoms.includes("chaleur")) {
      categories.push("thermal");
    }
    if (lowerSymptoms.includes("pression") || lowerSymptoms.includes("hydraulique")) {
      categories.push("hydraulic");
    }
    if (lowerSymptoms.includes("électrique") || lowerSymptoms.includes("courant")) {
      categories.push("electrical");
    }
    
    return categories.length > 0 ? categories : ["general"];
  }

  private calculatePatternSimilarity(pattern1: any, pattern2: any): number {
    // ISC 4 dimensions — Brevet N°3
    // D1: type équipement, D2: profil usage, D3: stress opérationnel, D4: historique défaillances
    return patternSimilarityISC4D(pattern1, pattern2);
  }
}

// Instance globale du service
export const federatedAI = new FederatedAIService();