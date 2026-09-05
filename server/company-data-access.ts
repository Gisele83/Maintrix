import { db } from "./db";
import { userProfiles, equipmentRegistry, diagnosticSessions, dataAccessPermissions } from "@shared/schema";
import { eq, and, inArray, ne, sql } from "drizzle-orm";

/**
 * Contrôleur d'accès aux données historiques de maintenance par tenant
 * Assure la confidentialité des données entre tenants tout en permettant
 * l'agrégation anonymisée pour améliorer le diagnostic IA
 */

export interface CompanyDataFilter {
  tenantId: string;
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
   * Vérifie les permissions d'accès utilisateur pour un tenant
   */
  async verifyUserAccess(userId: number, tenantId: string, requiredPermission: string): Promise<boolean> {
    try {
      // Vérifier que l'utilisateur appartient bien au tenant demandé
      const userCompany = await db
        .select()
        .from(userProfiles)
        .where(and(
          eq(userProfiles.id, userId),
          eq(userProfiles.tenantId, tenantId),
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
   * Récupère les données historiques de maintenance pour un tenant spécifique
   *
   * Note: il n'existe pas de lien direct diagnosticSessions -> workOrders dans le
   * schéma actuel (l'ancien FK workOrders.diagnosticId n'existe plus ; le lien
   * diagnostic/OT passe désormais par interventionSteps.diagnosticSessionId dans
   * le pipeline Maintenance Execution). Les champs dérivés d'un OT (résolution,
   * coût, durée, succès) ne sont donc pas disponibles ici.
   */
  async getCompanyHistoricalData(
    filter: CompanyDataFilter,
    request: HistoricalDataRequest
  ): Promise<any[]> {

    // Vérification des permissions
    const hasAccess = await this.verifyUserAccess(
      filter.userId,
      filter.tenantId,
      'read_historical_data'
    );

    if (!hasAccess) {
      throw new Error('Accès refusé aux données historiques du tenant');
    }

    try {
      const conditions = [
        eq(equipmentRegistry.tenantId, filter.tenantId), // Filtre strict par tenant
        ne(equipmentRegistry.operationalState, 'decommissioned')
      ];

      if (request.equipmentTypes?.length) {
        conditions.push(inArray(equipmentRegistry.equipmentType, request.equipmentTypes));
      }

      if (request.timeRange) {
        conditions.push(sql`${diagnosticSessions.createdAt} >= ${request.timeRange.startDate}`);
        conditions.push(sql`${diagnosticSessions.createdAt} <= ${request.timeRange.endDate}`);
      }

      const companyData = await db
        .select({
          equipmentId: equipmentRegistry.id,
          equipmentName: equipmentRegistry.equipmentName,
          equipmentType: equipmentRegistry.equipmentType,
          manufacturer: equipmentRegistry.manufacturer,
          diagnosisDate: diagnosticSessions.createdAt,
          symptoms: diagnosticSessions.symptoms,
          diagnosis: diagnosticSessions.selectedDiagnosis,
          confidence: diagnosticSessions.confidence
        })
        .from(diagnosticSessions)
        .innerJoin(equipmentRegistry, eq(diagnosticSessions.equipmentId, sql`${equipmentRegistry.id}::text`))
        .where(and(...conditions))
        .execute();

      // Journalisation accès données (audit trail)
      await this.logDataAccess(filter.userId, filter.tenantId, 'historical_data_access', {
        requestedTypes: request.equipmentTypes,
        timeRange: request.timeRange,
        resultCount: companyData.length
      });

      return companyData;

    } catch (error) {
      console.error('Erreur récupération données tenant:', error);
      throw new Error('Impossible de récupérer les données historiques');
    }
  }

  /**
   * Récupère données agrégées anonymisées de tous les tenants
   * pour enrichir le diagnostic IA (sans exposition des données sensibles)
   *
   * Note: successRate/avgCost/avgDuration restent à 0 tant qu'un lien fiable
   * diagnostic -> ordre de travail n'est pas branché ici (voir note ci-dessus).
   */
  async getAggregatedDataForML(equipmentType: string, diagnosisType?: string): Promise<AggregatedData[]> {
    try {
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
          successRate: sql<number>`0`,
          avgCost: sql<number>`0`,
          avgDuration: sql<number>`0`,
          anonymizedCases: sql<number>`COUNT(DISTINCT ${equipmentRegistry.tenantId})`
        })
        .from(diagnosticSessions)
        .innerJoin(equipmentRegistry, eq(diagnosticSessions.equipmentId, sql`${equipmentRegistry.id}::text`))
        .where(
          eq(equipmentRegistry.equipmentType, equipmentType)
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
      await this.logDataAccess(0, '', 'aggregated_data_access', {
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
   * Algorithme d'enrichissement du diagnostic basé sur données multi-tenants
   */
  async enrichDiagnosisWithHistoricalData(
    currentDiagnosis: {
      equipmentType: string;
      symptoms: string;
      tenantId: string;
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
      // 1. Données propres au tenant (accès complet)
      const companyFilter: CompanyDataFilter = {
        tenantId: currentDiagnosis.tenantId,
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

      // 2. Données agrégées anonymisées (enrichissement cross-tenant)
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

    // Recommandations basées historique tenant
    if (companyCases.length > 0) {
      recommendations.push(
        `✅ ${companyCases.length} cas similaires trouvés dans votre historique`
      );
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

  private calculateCostRange(
    companyCases: any[],
    aggregatedPattern: AggregatedData | undefined
  ): { min: number, max: number } {
    const costs: number[] = [];

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
   * Journalisation des accès aux données pour audit et conformité.
   * La table dataAccessPermissions conserve une colonne companyId héritée
   * (FK vers l'ancienne table companies, non liée au modèle tenant actuel) :
   * on ne la renseigne plus et on trace le tenant réel dans metadata.
   */
  async logDataAccess(
    userId: number,
    tenantId: string,
    accessType: string,
    metadata: any
  ): Promise<void> {
    try {
      await db.insert(dataAccessPermissions).values({
        userId,
        permission: accessType,
        metadata: JSON.stringify({ ...metadata, tenantId }),
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
