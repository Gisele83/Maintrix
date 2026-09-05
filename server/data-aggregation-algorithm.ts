import { db } from "./db";
import { equipmentRegistry, diagnosticSessions } from "@shared/schema";
import { eq, and, sql, gte } from "drizzle-orm";
import { companyDataAccess } from "./company-data-access";

/**
 * Algorithme d'agrégation et récupération des données historiques multi-tenants
 * pour enrichir le diagnostic IA tout en préservant la confidentialité des données
 */

export interface AggregationRequest {
  equipmentType: string;
  symptoms: string[];
  targetDiagnosis?: string;
  timeWindow?: {
    months: number; // Fenêtre temporelle en mois
  };
  confidentialityLevel: 'strict' | 'moderate' | 'open';
}

export interface AggregatedInsight {
  pattern: string;
  frequency: number;
  successRate: number;
  avgResolutionTime: number;
  avgCost: number;
  confidenceScore: number;
  sourcesCount: number; // Nombre d'entreprises ayant contribué
  recommendations: string[];
  isStatisticallySignificant: boolean;
}

export interface EnrichedDiagnosticResult {
  originalDiagnosis: any;
  aggregatedInsights: AggregatedInsight[];
  industryBenchmarks: {
    avgSuccessRate: number;
    avgCost: number;
    avgDuration: number;
    bestPractices: string[];
  };
  similarCasesFromIndustry: number;
  enhancedRecommendations: string[];
  confidenceBoost: number; // Augmentation de confiance grâce aux données agrégées
}

export class DataAggregationAlgorithm {
  
  /**
   * Algorithme principal d'agrégation des données historiques multi-entreprises
   */
  async aggregateHistoricalData(request: AggregationRequest): Promise<AggregatedInsight[]> {
    try {
      // 1. Requête base agrégée avec préservation confidentialité
      const aggregatedQuery = await this.buildAggregationQuery(request);
      
      // 2. Filtrage selon niveau de confidentialité
      const filteredResults = await this.applyConfidentialityFilters(
        aggregatedQuery, 
        request.confidentialityLevel
      );

      // 3. Calcul des insights statistiques
      const insights = await this.calculateStatisticalInsights(
        filteredResults,
        request.equipmentType
      );

      // 4. Validation significativité statistique
      const validatedInsights = this.validateStatisticalSignificance(insights);

      return validatedInsights;

    } catch (error) {
      console.error('Erreur agrégation données:', error);
      return [];
    }
  }

  /**
   * Construction de la requête d'agrégation avec anonymisation
   */
  private async buildAggregationQuery(request: AggregationRequest) {
    const timeThreshold = new Date();
    timeThreshold.setMonth(timeThreshold.getMonth() - (request.timeWindow?.months || 12));

    // Requête agrégée avec anonymisation stricte
    return await db
      .select({
        // Agrégations anonymisées - aucune donnée d'entreprise spécifique
        symptomPattern: sql<string>`
          CASE 
            WHEN ${diagnosticSessions.symptoms} ~* 'vibrat|shake|tremble' THEN 'vibration'
            WHEN ${diagnosticSessions.symptoms} ~* 'temp|heat|hot|surchauffe|burn' THEN 'thermal'
            WHEN ${diagnosticSessions.symptoms} ~* 'noise|sound|bruit|son' THEN 'acoustic'
            WHEN ${diagnosticSessions.symptoms} ~* 'leak|fuite|oil|fluid' THEN 'leak'
            WHEN ${diagnosticSessions.symptoms} ~* 'pressure|press|pression' THEN 'pressure'
            WHEN ${diagnosticSessions.symptoms} ~* 'electric|électrique|current' THEN 'electrical'
            ELSE 'other'
          END
        `,
        diagnosisPattern: sql<string>`
          CASE 
            WHEN ${diagnosticSessions.selectedDiagnosis} ~* 'roulement|bearing' THEN 'bearing_failure'
            WHEN ${diagnosticSessions.selectedDiagnosis} ~* 'motor|moteur|engine' THEN 'motor_issue'
            WHEN ${diagnosticSessions.selectedDiagnosis} ~* 'seal|joint|étanch' THEN 'seal_problem'
            WHEN ${diagnosticSessions.selectedDiagnosis} ~* 'alignment|alignement' THEN 'misalignment'
            WHEN ${diagnosticSessions.selectedDiagnosis} ~* 'lubrication|lubrifiant' THEN 'lubrication_issue'
            ELSE 'other_diagnosis'
          END
        `,
        caseCount: sql<number>`COUNT(*)`,
        avgConfidence: sql<number>`AVG(${diagnosticSessions.confidence})`,
        successRate: sql<number>`
          AVG(CASE WHEN ${diagnosticSessions.status} = 'completed' THEN 1.0 ELSE 0.0 END) * 100
        `,
        // Pas de lien fiable diagnostic -> ordre de travail dans le schéma actuel
        // (voir company-data-access.ts) : durée de résolution et coût indisponibles ici.
        avgResolutionTime: sql<number>`0`,
        distinctCompanies: sql<number>`COUNT(DISTINCT ${equipmentRegistry.tenantId})`,
        equipmentVariety: sql<number>`COUNT(DISTINCT ${equipmentRegistry.manufacturer})`,
        avgCost: sql<number>`0`,
        totalSavings: sql<number>`0`,
      })
      .from(diagnosticSessions)
      .innerJoin(equipmentRegistry, eq(diagnosticSessions.equipmentId, sql`${equipmentRegistry.id}::text`))
      .where(
        and(
          eq(equipmentRegistry.equipmentType, request.equipmentType),
          gte(diagnosticSessions.createdAt, timeThreshold),
          sql`${diagnosticSessions.confidence} > 0.5` // Seuil minimal de confiance
        )
      )
      .groupBy(
        sql`
          CASE 
            WHEN ${diagnosticSessions.symptoms} ~* 'vibrat|shake|tremble' THEN 'vibration'
            WHEN ${diagnosticSessions.symptoms} ~* 'temp|heat|hot|surchauffe|burn' THEN 'thermal'
            WHEN ${diagnosticSessions.symptoms} ~* 'noise|sound|bruit|son' THEN 'acoustic'
            WHEN ${diagnosticSessions.symptoms} ~* 'leak|fuite|oil|fluid' THEN 'leak'
            WHEN ${diagnosticSessions.symptoms} ~* 'pressure|press|pression' THEN 'pressure'
            WHEN ${diagnosticSessions.symptoms} ~* 'electric|électrique|current' THEN 'electrical'
            ELSE 'other'
          END
        `,
        sql`
          CASE 
            WHEN ${diagnosticSessions.selectedDiagnosis} ~* 'roulement|bearing' THEN 'bearing_failure'
            WHEN ${diagnosticSessions.selectedDiagnosis} ~* 'motor|moteur|engine' THEN 'motor_issue'
            WHEN ${diagnosticSessions.selectedDiagnosis} ~* 'seal|joint|étanch' THEN 'seal_problem'
            WHEN ${diagnosticSessions.selectedDiagnosis} ~* 'alignment|alignement' THEN 'misalignment'
            WHEN ${diagnosticSessions.selectedDiagnosis} ~* 'lubrication|lubrifiant' THEN 'lubrication_issue'
            ELSE 'other_diagnosis'
          END
        `
      )
      .having(
        and(
          sql`COUNT(*) >= 5`, // Minimum 5 cas pour éviter identification
          sql`COUNT(DISTINCT ${equipmentRegistry.tenantId}) >= 3` // Au moins 3 tenants
        )
      );
  }

  /**
   * Application des filtres de confidentialité selon le niveau
   */
  private async applyConfidentialityFilters(
    results: any[], 
    confidentialityLevel: string
  ): Promise<any[]> {
    
    switch (confidentialityLevel) {
      case 'strict':
        // Filtres les plus stricts - masquage maximal
        return results.filter(result => 
          result.caseCount >= 10 && 
          result.distinctCompanies >= 5 &&
          result.equipmentVariety >= 3
        ).map(result => ({
          ...result,
          // Arrondir les valeurs pour éviter identification
          avgConfidence: Math.round(result.avgConfidence * 100) / 100,
          successRate: Math.round(result.successRate),
          avgResolutionTime: Math.round(result.avgResolutionTime),
          avgCost: Math.round(result.avgCost / 100) * 100, // Arrondir à 100€
          distinctCompanies: result.distinctCompanies >= 10 ? '10+' : '5-9',
        }));

      case 'moderate':
        // Filtres modérés
        return results.filter(result => 
          result.caseCount >= 7 && 
          result.distinctCompanies >= 3
        ).map(result => ({
          ...result,
          avgCost: Math.round(result.avgCost / 50) * 50, // Arrondir à 50€
          distinctCompanies: result.distinctCompanies >= 5 ? '5+' : '3-4',
        }));

      case 'open':
        // Filtres ouverts - données plus précises
        return results.filter(result => 
          result.caseCount >= 5 && 
          result.distinctCompanies >= 2
        );

      default:
        return results.filter(result => result.caseCount >= 5);
    }
  }

  /**
   * Calcul des insights statistiques à partir des données agrégées
   */
  private async calculateStatisticalInsights(
    filteredResults: any[],
    equipmentType: string
  ): Promise<AggregatedInsight[]> {
    
    const insights: AggregatedInsight[] = [];

    for (const result of filteredResults) {
      // Calcul score de confiance basé sur volume de données
      const confidenceScore = this.calculateConfidenceScore(
        result.caseCount,
        result.distinctCompanies,
        result.avgConfidence
      );

      // Génération recommandations contextuelles
      const recommendations = await this.generateContextualRecommendations(
        result.symptomPattern,
        result.diagnosisPattern,
        equipmentType,
        result.successRate
      );

      const insight: AggregatedInsight = {
        pattern: `${result.symptomPattern} → ${result.diagnosisPattern}`,
        frequency: result.caseCount,
        successRate: parseFloat(result.successRate),
        avgResolutionTime: parseFloat(result.avgResolutionTime),
        avgCost: parseFloat(result.avgCost),
        confidenceScore: confidenceScore,
        sourcesCount: typeof result.distinctCompanies === 'string' 
          ? parseInt(result.distinctCompanies.replace(/[^0-9]/g, '')) 
          : result.distinctCompanies,
        recommendations: recommendations,
        isStatisticallySignificant: confidenceScore > 0.7
      };

      insights.push(insight);
    }

    // Tri par score de confiance décroissant
    return insights.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Calcul du score de confiance basé sur volume et diversité des données
   */
  private calculateConfidenceScore(
    caseCount: number, 
    sourcesCount: number, 
    avgConfidence: number
  ): number {
    
    // Facteurs de pondération
    const volumeWeight = 0.4;
    const diversityWeight = 0.3;
    const qualityWeight = 0.3;

    // Normalisation volume (logarithmique pour diminuer l'impact des très gros volumes)
    const volumeScore = Math.min(Math.log10(caseCount) / Math.log10(100), 1.0);
    
    // Normalisation diversité sources
    const diversityScore = Math.min(sourcesCount / 10, 1.0);
    
    // Normalisation qualité (confiance moyenne)
    const qualityScore = avgConfidence;

    // Score final pondéré
    const finalScore = (
      volumeScore * volumeWeight +
      diversityScore * diversityWeight +
      qualityScore * qualityWeight
    );

    return Math.round(finalScore * 1000) / 1000; // 3 décimales
  }

  /**
   * Génération de recommandations contextuelles intelligentes
   */
  private async generateContextualRecommendations(
    symptomPattern: string,
    diagnosisPattern: string,
    equipmentType: string,
    successRate: number
  ): Promise<string[]> {
    
    const recommendations: string[] = [];

    // Recommandations par pattern de symptôme
    switch (symptomPattern) {
      case 'vibration':
        recommendations.push('Effectuer analyse vibratoire spectrale');
        recommendations.push('Vérifier équilibrage et alignement');
        break;
      case 'thermal':
        recommendations.push('Contrôler système refroidissement');
        recommendations.push('Vérifier charge et ventilation');
        break;
      case 'acoustic':
        recommendations.push('Analyser signature acoustique');
        recommendations.push('Inspecter éléments mobiles');
        break;
      case 'leak':
        recommendations.push('Localiser source de fuite');
        recommendations.push('Remplacer joints et étanchéités');
        break;
      case 'pressure':
        recommendations.push('Calibrer capteurs de pression');
        recommendations.push('Vérifier circuit hydraulique');
        break;
      case 'electrical':
        recommendations.push('Tester isolement électrique');
        recommendations.push('Contrôler connexions et câblage');
        break;
    }

    // Recommandations par diagnostic
    switch (diagnosisPattern) {
      case 'bearing_failure':
        recommendations.push('Remplacer roulements selon spécifications');
        recommendations.push('Améliorer programme lubrification');
        break;
      case 'motor_issue':
        recommendations.push('Contrôler bobinages et rotor');
        recommendations.push('Vérifier alimentation électrique');
        break;
      case 'misalignment':
        recommendations.push('Réaligner selon tolérances constructeur');
        recommendations.push('Utiliser outils laser d\'alignement');
        break;
    }

    // Recommandations selon taux de succès industrie
    if (successRate > 85) {
      recommendations.push('✅ Problème bien maîtrisé industrie - solutions éprouvées');
    } else if (successRate < 60) {
      recommendations.push('⚠️ Problème complexe - expertise spécialisée recommandée');
    }

    // Recommandations spécifiques par équipement
    recommendations.push(...this.getEquipmentSpecificRecommendations(equipmentType));

    return recommendations.slice(0, 6); // Limiter à 6 recommandations max
  }

  /**
   * Recommandations spécifiques par type d'équipement
   */
  private getEquipmentSpecificRecommendations(equipmentType: string): string[] {
    const specificRecs: Record<string, string[]> = {
      'Grue': [
        'Inspecter câbles et poulies',
        'Vérifier systèmes hydrauliques',
        'Contrôler dispositifs sécurité'
      ],
      'Moteur': [
        'Mesurer courant et tension',
        'Vérifier roulements et paliers',
        'Contrôler ventilation moteur'
      ],
      'Pompe': [
        'Vérifier amorçage et cavitation',
        'Contrôler étanchéité mécanique',
        'Mesurer courbe caractéristique'
      ],
      'Compresseur': [
        'Contrôler filtres aspiration',
        'Vérifier huile et séparateur',
        'Mesurer pression différentielle'
      ],
      'Transformateur': [
        'Contrôler huile diélectrique',
        'Mesurer résistance isolement',
        'Vérifier refroidissement'
      ]
    };

    return specificRecs[equipmentType] || ['Suivre procédures maintenance préventive'];
  }

  /**
   * Validation de la significativité statistique
   */
  private validateStatisticalSignificance(insights: AggregatedInsight[]): AggregatedInsight[] {
    return insights.map(insight => ({
      ...insight,
      isStatisticallySignificant: (
        insight.frequency >= 10 &&
        insight.sourcesCount >= 3 &&
        insight.confidenceScore > 0.65
      )
    }));
  }

  /**
   * Enrichissement du diagnostic avec données agrégées multi-entreprises
   */
  async enrichDiagnosticWithAggregatedData(
    userId: number,
    tenantId: string,
    currentDiagnosis: {
      equipmentType: string;
      symptoms: string[];
      selectedDiagnosis?: string;
    },
    confidentialityLevel: 'strict' | 'moderate' | 'open' = 'moderate'
  ): Promise<EnrichedDiagnosticResult> {
    
    try {
      // 1. Agrégation données industrie
      const aggregationRequest: AggregationRequest = {
        equipmentType: currentDiagnosis.equipmentType,
        symptoms: currentDiagnosis.symptoms,
        targetDiagnosis: currentDiagnosis.selectedDiagnosis,
        timeWindow: { months: 24 }, // 2 ans de données
        confidentialityLevel: confidentialityLevel
      };

      const aggregatedInsights = await this.aggregateHistoricalData(aggregationRequest);

      // 2. Calcul benchmarks industrie
      const industryBenchmarks = this.calculateIndustryBenchmarks(aggregatedInsights);

      // 3. Recommandations enrichies
      const enhancedRecommendations = this.generateEnhancedRecommendations(
        currentDiagnosis,
        aggregatedInsights,
        industryBenchmarks
      );

      // 4. Calcul boost de confiance
      const confidenceBoost = this.calculateConfidenceBoost(
        aggregatedInsights,
        currentDiagnosis.symptoms
      );

      // 5. Comptage cas similaires
      const similarCasesFromIndustry = aggregatedInsights.reduce(
        (total, insight) => total + insight.frequency, 0
      );

      // 6. Journalisation utilisation données agrégées
      await companyDataAccess.logDataAccess(userId, tenantId, 'aggregated_data_enrichment', {
        equipmentType: currentDiagnosis.equipmentType,
        insightsUsed: aggregatedInsights.length,
        confidenceBoost: confidenceBoost,
        similarCases: similarCasesFromIndustry
      });

      return {
        originalDiagnosis: currentDiagnosis,
        aggregatedInsights: aggregatedInsights.slice(0, 5), // Top 5 insights
        industryBenchmarks,
        similarCasesFromIndustry,
        enhancedRecommendations,
        confidenceBoost
      };

    } catch (error) {
      console.error('Erreur enrichissement avec données agrégées:', error);
      
      // Fallback en cas d'erreur
      return {
        originalDiagnosis: currentDiagnosis,
        aggregatedInsights: [],
        industryBenchmarks: {
          avgSuccessRate: 0,
          avgCost: 0,
          avgDuration: 0,
          bestPractices: []
        },
        similarCasesFromIndustry: 0,
        enhancedRecommendations: [],
        confidenceBoost: 0
      };
    }
  }

  /**
   * Calcul des benchmarks industrie
   */
  private calculateIndustryBenchmarks(insights: AggregatedInsight[]) {
    if (insights.length === 0) {
      return {
        avgSuccessRate: 0,
        avgCost: 0,
        avgDuration: 0,
        bestPractices: []
      };
    }

    const weightedAvg = (values: number[], weights: number[]) => {
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      const weightedSum = values.reduce((sum, val, i) => sum + (val * weights[i]), 0);
      return totalWeight > 0 ? weightedSum / totalWeight : 0;
    };

    const successRates = insights.map(i => i.successRate);
    const costs = insights.map(i => i.avgCost);
    const durations = insights.map(i => i.avgResolutionTime);
    const weights = insights.map(i => i.frequency); // Pondération par fréquence

    // Top practices des insights avec meilleur taux de succès
    const bestInsights = insights
      .filter(i => i.successRate > 80)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 3);

    const bestPractices = bestInsights.flatMap(i => i.recommendations);

    return {
      avgSuccessRate: Math.round(weightedAvg(successRates, weights)),
      avgCost: Math.round(weightedAvg(costs, weights)),
      avgDuration: Math.round(weightedAvg(durations, weights) * 10) / 10,
      bestPractices: [...new Set(bestPractices)].slice(0, 5) // Déduplication et limite
    };
  }

  /**
   * Génération recommandations enrichies finales
   */
  private generateEnhancedRecommendations(
    diagnosis: any,
    insights: AggregatedInsight[],
    benchmarks: any
  ): string[] {
    const recommendations: string[] = [];

    // Recommandations basées insights les plus fiables
    const topInsight = insights.find(i => i.isStatisticallySignificant);
    if (topInsight) {
      recommendations.push(
        `📊 Pattern industrie détecté: ${topInsight.pattern} (${topInsight.frequency} cas, ${Math.round(topInsight.successRate)}% succès)`
      );
      recommendations.push(...topInsight.recommendations.slice(0, 2));
    }

    // Benchmarks industrie
    if (benchmarks.avgSuccessRate > 0) {
      recommendations.push(
        `📈 Taux succès moyen industrie: ${benchmarks.avgSuccessRate}% (${benchmarks.avgDuration}h, ${benchmarks.avgCost}€)`
      );
    }

    // Best practices industrie
    if (benchmarks.bestPractices.length > 0) {
      recommendations.push('✨ Meilleures pratiques industrie:');
      recommendations.push(...benchmarks.bestPractices.slice(0, 2).map((bp: string) => `  • ${bp}`));
    }

    // Recommandation action immédiate si insights significatifs
    const urgentInsight = insights.find(i => i.successRate > 90 && i.isStatisticallySignificant);
    if (urgentInsight) {
      recommendations.unshift(
        `🚀 Solution éprouvée disponible: ${urgentInsight.avgResolutionTime}h moyenne, ${urgentInsight.successRate}% succès`
      );
    }

    return recommendations.slice(0, 8); // Maximum 8 recommandations
  }

  /**
   * Calcul du boost de confiance apporté par les données agrégées
   */
  private calculateConfidenceBoost(insights: AggregatedInsight[], symptoms: string[]): number {
    if (insights.length === 0) return 0;

    // Recherche de l'insight le plus pertinent par rapport aux symptômes
    const symptomText = symptoms.join(' ').toLowerCase();
    
    let maxRelevance = 0;
    for (const insight of insights) {
      if (!insight.isStatisticallySignificant) continue;
      
      const patternKeywords = insight.pattern.toLowerCase().split(' ');
      let relevance = 0;
      
      for (const keyword of patternKeywords) {
        if (symptomText.includes(keyword)) {
          relevance += 0.2;
        }
      }
      
      maxRelevance = Math.max(maxRelevance, relevance);
    }

    // Boost basé sur pertinence et qualité des données
    const baseBoost = maxRelevance * 0.15; // Max 15% boost
    const qualityMultiplier = insights[0]?.confidenceScore || 1;
    
    return Math.min(baseBoost * qualityMultiplier, 0.20); // Maximum 20% boost
  }
}

export const dataAggregationAlgorithm = new DataAggregationAlgorithm();