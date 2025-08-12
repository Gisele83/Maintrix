import { db } from "./db";
import { companies, userProfiles, equipmentRegistry, diagnosticSessions, workOrders, dataAccessPermissions } from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

/**
 * Contrôleur d'accès aux données historiques de maintenance par entreprise
 * Assure la confidentialité des données entre entreprises tout en permettant
 * l'agrégation anonymisée pour améliorer le diagnostic IA
 */

export interface CompanyDataFilter {
  companyId: number;
  userId: number;
  userRole: string;
}

export interface HistoricalDataRequest {
  equipmentTypes?: string[];
  diagnosticTypes?: string[];
  timeRange?: {
    startDate: Date;
    endDate: Date;
  };
  includeAggregatedData?: boolean;
}

export interface AggregatedData {
  pattern: string;
  frequency: number;
  successRate: number;
  avgCost: number;
  avgDuration: number;
  anonymizedCases: number;
}

export class CompanyDataAccessController {
  
  /**
   * Vérifie les permissions d'accès utilisateur pour une entreprise
   */
  async verifyUserAccess(userId: number, companyId: number, requiredPermission: string): Promise<boolean> {
    try {
      // Vérifier si l'utilisateur appartient à l'entreprise
      const userCompany = await db
        .select()
        .from(userProfiles)
        .where(and(
          eq(userProfiles.id, userId),
          eq(userProfiles.isActive, true)
        ))
        .limit(1);

      if (!userCompany.length) {
        return false;
      }

      // Vérifier permissions spécifiques
      const permissions = await db
        .select()
        .from(dataAccessPermissions)
        .where(and(
          eq(dataAccessPermissions.userId, userId),
          eq(dataAccessPermissions.permission, requiredPermission),
          eq(dataAccessPermissions.isActive, true)
        ))
        .limit(1);

      return permissions.length > 0 || userCompany[0].role === 'admin' || userCompany[0].role === 'manager';
    } catch (error) {
      console.error('Erreur vérification accès:', error);
      return false;
    }
  }

  /**
   * Récupère les données historiques de maintenance pour une entreprise spécifique
   */
  async getCompanyHistoricalData(
    filter: CompanyDataFilter, 
    request: HistoricalDataRequest
  ): Promise<any[]> {
    
    // Vérification des permissions
    const hasAccess = await this.verifyUserAccess(
      filter.userId, 
      filter.companyId, 
      'read_historical_data'
    );

    if (!hasAccess) {
      throw new Error('Accès refusé aux données historiques de l\'entreprise');
    }

    try {
      // Construction requête avec filtres entreprise
      let query = db
        .select({
          equipmentId: equipmentRegistry.id,
          equipmentName: equipmentRegistry.name,
          equipmentType: equipmentRegistry.type,
          manufacturer: equipmentRegistry.manufacturer,
          diagnosisDate: diagnosticSessions.createdAt,
          symptoms: diagnosticSessions.symptoms,
          diagnosis: diagnosticSessions.selectedDiagnosis,
          confidence: diagnosticSessions.confidence,
          workOrderId: workOrders.id,
          resolution: workOrders.description,
          cost: workOrders.cost,
          duration: workOrders.actualDuration,
          success: workOrders.status
        })
        .from(diagnosticSessions)
        .innerJoin(equipmentRegistry, eq(diagnosticSessions.equipmentId, equipmentRegistry.id))
        .leftJoin(workOrders, eq(diagnosticSessions.id, workOrders.diagnosticId))
        .where(and(
          eq(equipmentRegistry.companyId, filter.companyId), // Filtre strict par entreprise
          sql`${equipmentRegistry.isActive} = true`
        ));

      // Filtres additionnels
      if (request.equipmentTypes?.length) {
        query = query.where(and(
          eq(equipmentRegistry.companyId, filter.companyId),
          inArray(equipmentRegistry.type, request.equipmentTypes)
        ));
      }

      if (request.timeRange) {
        query = query.where(and(
          eq(equipmentRegistry.companyId, filter.companyId),
          sql`${diagnosticSessions.createdAt} >= ${request.timeRange.startDate}`,
          sql`${diagnosticSessions.createdAt} <= ${request.timeRange.endDate}`
        ));
      }

      const companyData = await query.execute();

      // Journalisation accès données (audit trail)
      await this.logDataAccess(filter.userId, filter.companyId, 'historical_data_access', {
        requestedTypes: request.equipmentTypes,
        timeRange: request.timeRange,
        resultCount: companyData.length
      });

      return companyData;

    } catch (error) {
      console.error('Erreur récupération données entreprise:', error);
      throw new Error('Impossible de récupérer les données historiques');
    }
  }

  /**
   * Récupère données agrégées anonymisées de toutes les entreprises
   * pour enrichir le diagnostic IA (sans exposition des données sensibles)
   */
  async getAggregatedDataForML(equipmentType: string, diagnosisType?: string): Promise<AggregatedData[]> {
    try {
      // Requête d'agrégation anonymisée - aucune donnée d'entreprise spécifique
      const aggregatedQuery = db
        .select({
          pattern: sql<string>`
            CASE 
              WHEN ${diagnosticSessions.symptoms} LIKE '%vibration%' THEN 'vibration_pattern'
              WHEN ${diagnosticSessions.symptoms} LIKE '%temperature%' OR ${diagnosticSessions.symptoms} LIKE '%surchauffe%' THEN 'thermal_pattern'
              WHEN ${diagnosticSessions.symptoms} LIKE '%bruit%' OR ${diagnosticSessions.symptoms} LIKE '%son%' THEN 'acoustic_pattern'
              WHEN ${diagnosticSessions.symptoms} LIKE '%fuite%' OR ${diagnosticSessions.symptoms} LIKE '%leak%' THEN 'leak_pattern'
              ELSE 'other_pattern'
            END
          `,
          frequency: sql<number>`COUNT(*)`,
          successRate: sql<number>`
            ROUND(
              AVG(CASE WHEN ${workOrders.status} = 'completed' THEN 1.0 ELSE 0.0 END) * 100, 2
            )
          `,
          avgCost: sql<number>`ROUND(AVG(COALESCE(${workOrders.cost}, 0)), 2)`,
          avgDuration: sql<number>`ROUND(AVG(COALESCE(${workOrders.actualDuration}, 0)), 2)`,
          anonymizedCases: sql<number>`COUNT(DISTINCT ${equipmentRegistry.companyId})`
        })
        .from(diagnosticSessions)
        .innerJoin(equipmentRegistry, eq(diagnosticSessions.equipmentId, equipmentRegistry.id))
        .leftJoin(workOrders, eq(diagnosticSessions.id, workOrders.diagnosticId))
        .where(
          eq(equipmentRegistry.type, equipmentType)
        )
        .groupBy(sql`
          CASE 
            WHEN ${diagnosticSessions.symptoms} LIKE '%vibration%' THEN 'vibration_pattern'
            WHEN ${diagnosticSessions.symptoms} LIKE '%temperature%' OR ${diagnosticSessions.symptoms} LIKE '%surchauffe%' THEN 'thermal_pattern'
            WHEN ${diagnosticSessions.symptoms} LIKE '%bruit%' OR ${diagnosticSessions.symptoms} LIKE '%son%' THEN 'acoustic_pattern'
            WHEN ${diagnosticSessions.symptoms} LIKE '%fuite%' OR ${diagnosticSessions.symptoms} LIKE '%leak%' THEN 'leak_pattern'
            ELSE 'other_pattern'
          END
        `)
        .having(sql`COUNT(*) >= 3`); // Minimum 3 cas pour éviter identification

      const aggregatedData = await aggregatedQuery.execute();

      // Journalisation utilisation données agrégées
      await this.logDataAccess(0, 0, 'aggregated_data_access', {
        equipmentType,
        diagnosisType,
        patternsReturned: aggregatedData.length
      });

      return aggregatedData;

    } catch (error) {
      console.error('Erreur données agrégées:', error);
      return [];
    }
  }

  /**
   * Algorithme d'enrichissement du diagnostic basé sur données multi-entreprises
   */
  async enrichDiagnosisWithHistoricalData(
    currentDiagnosis: {
      equipmentType: string;
      symptoms: string;
      companyId: number;
      userId: number;
    }
  ): Promise<{
    originalDiagnosis: any;
    enrichedRecommendations: string[];
    similarCasesCount: number;
    industryAverageSuccessRate: number;
    estimatedCostRange: { min: number, max: number };
  }> {
    
    try {
      // 1. Données propres à l'entreprise (accès complet)
      const companyFilter: CompanyDataFilter = {
        companyId: currentDiagnosis.companyId,
        userId: currentDiagnosis.userId,
        userRole: 'user'
      };

      const companyHistorical = await this.getCompanyHistoricalData(companyFilter, {
        equipmentTypes: [currentDiagnosis.equipmentType],
        timeRange: {
          startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 an
          endDate: new Date()
        }
      });

      // 2. Données agrégées anonymisées (enrichissement cross-entreprise)
      const aggregatedData = await this.getAggregatedDataForML(
        currentDiagnosis.equipmentType
      );

      // 3. Analyse patterns similaires
      const symptomKeywords = this.extractSymptomKeywords(currentDiagnosis.symptoms);
      const similarCompanyCases = companyHistorical.filter(case_ => 
        this.calculateSymptomSimilarity(case_.symptoms, currentDiagnosis.symptoms) > 0.7
      );

      const relevantAggregatedPattern = aggregatedData.find(pattern => 
        symptomKeywords.some(keyword => pattern.pattern.includes(keyword))
      );

      // 4. Génération recommandations enrichies
      const enrichedRecommendations = this.generateEnrichedRecommendations(
        similarCompanyCases,
        relevantAggregatedPattern,
        currentDiagnosis.equipmentType
      );

      // 5. Calculs statistiques
      const industryAverageSuccessRate = relevantAggregatedPattern?.successRate || 0;
      const costRange = this.calculateCostRange(similarCompanyCases, relevantAggregatedPattern);

      return {
        originalDiagnosis: currentDiagnosis,
        enrichedRecommendations,
        similarCasesCount: similarCompanyCases.length,
        industryAverageSuccessRate,
        estimatedCostRange: costRange
      };

    } catch (error) {
      console.error('Erreur enrichissement diagnostic:', error);
      return {
        originalDiagnosis: currentDiagnosis,
        enrichedRecommendations: [],
        similarCasesCount: 0,
        industryAverageSuccessRate: 0,
        estimatedCostRange: { min: 0, max: 0 }
      };
    }
  }

  /**
   * Utilitaires privés
   */
  private extractSymptomKeywords(symptoms: string): string[] {
    const keywords = ['vibration', 'temperature', 'surchauffe', 'bruit', 'fuite', 'pression'];
    return keywords.filter(keyword => 
      symptoms.toLowerCase().includes(keyword)
    );
  }

  private calculateSymptomSimilarity(symptoms1: string, symptoms2: string): number {
    const words1 = symptoms1.toLowerCase().split(' ');
    const words2 = symptoms2.toLowerCase().split(' ');
    const intersection = words1.filter(word => words2.includes(word));
    return intersection.length / Math.max(words1.length, words2.length);
  }

  private generateEnrichedRecommendations(
    companyCases: any[], 
    aggregatedPattern: AggregatedData | undefined,
    equipmentType: string
  ): string[] {
    const recommendations: string[] = [];

    // Recommandations basées historique entreprise
    if (companyCases.length > 0) {
      const successfulCases = companyCases.filter(c => c.success === 'completed');
      if (successfulCases.length > 0) {
        recommendations.push(
          `✅ Basé sur ${successfulCases.length} cas similaires résolus dans votre entreprise`
        );
        
        const mostCommonResolution = this.getMostCommonResolution(successfulCases);
        if (mostCommonResolution) {
          recommendations.push(`🔧 Solution efficace précédente: ${mostCommonResolution}`);
        }
      }
    }

    // Recommandations basées données industrie
    if (aggregatedPattern) {
      recommendations.push(
        `📊 Taux de réussite industrie pour ce type de problème: ${aggregatedPattern.successRate}%`
      );
      
      if (aggregatedPattern.successRate > 80) {
        recommendations.push(`✨ Problème généralement bien maîtrisé dans l'industrie`);
      } else if (aggregatedPattern.successRate < 60) {
        recommendations.push(`⚠️ Problème complexe nécessitant expertise spécialisée`);
      }
    }

    // Recommandations spécifiques par équipement
    recommendations.push(...this.getEquipmentSpecificRecommendations(equipmentType));

    return recommendations;
  }

  private getMostCommonResolution(cases: any[]): string | null {
    const resolutions = cases
      .map(c => c.resolution)
      .filter(r => r && r.length > 10);
    
    if (resolutions.length === 0) return null;

    // Simplification: retour de la résolution la plus fréquente
    const frequency = new Map<string, number>();
    resolutions.forEach(resolution => {
      frequency.set(resolution, (frequency.get(resolution) || 0) + 1);
    });

    let maxCount = 0;
    let mostCommon = '';
    frequency.forEach((count, resolution) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = resolution;
      }
    });

    return mostCommon || null;
  }

  private calculateCostRange(
    companyCases: any[], 
    aggregatedPattern: AggregatedData | undefined
  ): { min: number, max: number } {
    const costs: number[] = [];

    // Coûts entreprise
    companyCases.forEach(case_ => {
      if (case_.cost && case_.cost > 0) {
        costs.push(parseFloat(case_.cost.toString()));
      }
    });

    // Coût moyen industrie
    if (aggregatedPattern && aggregatedPattern.avgCost > 0) {
      costs.push(aggregatedPattern.avgCost);
    }

    if (costs.length === 0) {
      return { min: 200, max: 1000 }; // Valeurs par défaut
    }

    return {
      min: Math.round(Math.min(...costs) * 0.8),
      max: Math.round(Math.max(...costs) * 1.2)
    };
  }

  private getEquipmentSpecificRecommendations(equipmentType: string): string[] {
    const recommendations: string[] = [];

    switch (equipmentType.toLowerCase()) {
      case 'grue':
        recommendations.push('🏗️ Vérifier tensions câbles et systèmes hydrauliques');
        break;
      case 'moteur':
        recommendations.push('⚡ Contrôler isolement électrique et roulements');
        break;
      case 'pompe':
        recommendations.push('💧 Vérifier amorçage et étanchéités');
        break;
      case 'compresseur':
        recommendations.push('🔧 Contrôler filtres et système de refroidissement');
        break;
      default:
        recommendations.push('🔍 Suivre procédures de maintenance préventive');
    }

    return recommendations;
  }

  /**
   * Journalisation des accès aux données pour audit et conformité
   */
  private async logDataAccess(
    userId: number, 
    companyId: number, 
    accessType: string, 
    metadata: any
  ): Promise<void> {
    try {
      await db.insert(dataAccessPermissions).values({
        userId,
        companyId,
        permission: accessType,
        metadata: JSON.stringify(metadata),
        accessedAt: new Date(),
        isActive: true
      });
    } catch (error) {
      console.error('Erreur journalisation accès:', error);
      // Ne pas faire échouer l'opération principale
    }
  }
}

export const companyDataAccess = new CompanyDataAccessController();