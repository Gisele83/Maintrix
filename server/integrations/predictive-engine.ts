/**
 * Advanced Predictive Maintenance Engine
 * Combines ML algorithms with industrial expertise for failure prediction and maintenance optimization
 */

import { gmaoStorage } from "../gmao-storage";
import { InsertPredictiveAnalytics, InsertWorkOrder, InsertKpiMetrics } from "@shared/schema";
import { probabiliteDefaillance, combinerAvecSymptomes, joursAvantDefaillance } from "@shared/pronostic";

export interface PredictiveModel {
  equipmentType: string;
  modelVersion: string;
  failurePatterns: FailurePattern[];
  maintenanceRules: MaintenanceRule[];
  thresholds: PredictiveThreshold[];
}

export interface FailurePattern {
  patternId: string;
  name: string;
  description: string;
  symptoms: string[];
  leadTime: number; // days
  criticality: 'low' | 'medium' | 'high' | 'critical';
  frequency: number; // occurrences per year
}

export interface MaintenanceRule {
  ruleId: string;
  condition: string;
  action: string;
  priority: string;
  estimatedDuration: number; // hours
  requiredSkills: string[];
  spareParts: string[];
}

export interface PredictiveThreshold {
  metricType: string;
  warningLevel: number;
  criticalLevel: number;
  trendThreshold: number;
}

/**
 * Les symptômes que la supervision sait réellement détecter.
 *
 * ⚠️ Les modèles déclaraient des symptômes absents du détecteur, qui
 * comptaient donc toujours comme non observés — sans que rien ne le signale.
 * Cette liste est la SEULE source : y ajouter une entrée oblige à écrire la
 * détection correspondante, et un modèle qui s en écarte est journalisé.
 */
const SYMPTOMES_RECONNUS = new Set<string>([
  'vibrations_excessives',
  'echauffement',
  'échauffement_excessif',
  'surintensité',
  'baisse_debit',
]);

export class PredictiveMaintenanceEngine {
  /** Symptômes inconnus déjà signalés — on ne journalise qu une seule fois. */
  private static readonly symptomesInconnusSignales = new Set<string>();

  private models: Map<string, PredictiveModel>;
  private learningEnabled = true;

  constructor() {
    this.models = new Map();
    this.initializeDefaultModels();
  }

  /**
   * Initialize default predictive models for common equipment types
   */
  private initializeDefaultModels(): void {
    // Motor failure prediction model
    const motorModel: PredictiveModel = {
      equipmentType: 'moteur',
      modelVersion: '2.0',
      failurePatterns: [
        {
          patternId: 'MOTOR_BEARING_FAIL',
          name: 'Roulement défectueux',
          description: 'Défaillance progressive des roulements moteur',
          symptoms: ['vibrations_excessives', 'bruit_anormal', 'echauffement'],
          leadTime: 14,
          criticality: 'high',
          frequency: 2.5
        },
        {
          patternId: 'MOTOR_WINDING_FAIL',
          name: 'Bobinage endommagé',
          description: 'Détérioration de l\'isolant des bobinages',
          symptoms: ['surintensité', 'échauffement_excessif', 'baisse_rendement'],
          leadTime: 7,
          criticality: 'critical',
          frequency: 1.2
        }
      ],
      maintenanceRules: [
        {
          ruleId: 'MOTOR_PREVENTIVE_1',
          condition: 'vibration > 6.3 mm/s OR temperature > 80°C',
          action: 'Vérification alignement et graissage roulements',
          priority: 'medium',
          estimatedDuration: 2,
          requiredSkills: ['mécanique', 'vibrations'],
          spareParts: ['graisse', 'joint_etancheite']
        }
      ],
      thresholds: [
        { metricType: 'vibration', warningLevel: 4.5, criticalLevel: 7.1, trendThreshold: 0.5 },
        { metricType: 'temperature', warningLevel: 75, criticalLevel: 85, trendThreshold: 2.0 },
        { metricType: 'current', warningLevel: 105, criticalLevel: 120, trendThreshold: 5.0 }
      ]
    };

    // Pump failure prediction model
    const pumpModel: PredictiveModel = {
      equipmentType: 'pompe',
      modelVersion: '2.0',
      failurePatterns: [
        {
          patternId: 'PUMP_CAVITATION',
          name: 'Cavitation',
          description: 'Formation de bulles de vapeur causant des dommages',
          symptoms: ['bruit_cavitation', 'vibrations', 'baisse_debit'],
          leadTime: 5,
          criticality: 'high',
          frequency: 3.2
        },
        {
          patternId: 'PUMP_SEAL_LEAK',
          name: 'Fuite étanchéité',
          description: 'Usure des joints et garnitures mécaniques',
          symptoms: ['fuite_externe', 'baisse_pression', 'surintensité'],
          leadTime: 10,
          criticality: 'medium',
          frequency: 4.1
        }
      ],
      maintenanceRules: [
        {
          ruleId: 'PUMP_PREVENTIVE_1',
          condition: 'flow < 85% AND pressure < 90%',
          action: 'Vérification garniture mécanique et impulseur',
          priority: 'high',
          estimatedDuration: 4,
          requiredSkills: ['hydraulique', 'mécanique'],
          spareParts: ['garniture_mecanique', 'joint_bride', 'impulseur']
        }
      ],
      thresholds: [
        { metricType: 'flow', warningLevel: 90, criticalLevel: 80, trendThreshold: -5.0 },
        { metricType: 'pressure', warningLevel: 85, criticalLevel: 75, trendThreshold: -3.0 },
        { metricType: 'vibration', warningLevel: 3.5, criticalLevel: 5.6, trendThreshold: 0.3 }
      ]
    };

    this.models.set('moteur', motorModel);
    this.models.set('pompe', pumpModel);
  }

  /**
   * Analyze equipment health and predict failures
   */
  async analyzeEquipmentHealth(equipmentId: number, tenantId: string): Promise<{
    healthScore: number;
    riskLevel: string;
    predictedFailures: any[];
    recommendations: any[];
    nextMaintenanceDate: Date | null;
  }> {
    try {
      // Get equipment details
      const equipment = await gmaoStorage.getEquipmentById(equipmentId, tenantId);
      if (!equipment) {
        throw new Error(`Equipment ${equipmentId} not found`);
      }

      // Get recent sensor data
      const sensorData = await gmaoStorage.getLatestSensorData(equipmentId, tenantId);
      
      // Get equipment model
      const model = this.models.get(equipment.equipmentType);
      if (!model) {
        return this.generateGenericAnalysis(equipmentId);
      }

      // Calculate health score
      const healthScore = await this.calculateHealthScore(equipmentId, sensorData, model, tenantId);

      // Predict failures
      const predictedFailures = await this.predictFailures(equipmentId, sensorData, model);

      // Generate recommendations
      const recommendations = await this.generateRecommendations(equipmentId, sensorData, model, healthScore, tenantId);
      
      // Calculate next maintenance date
      const nextMaintenanceDate = this.calculateNextMaintenanceDate(predictedFailures, recommendations);

      // Determine risk level
      const riskLevel = this.determineRiskLevel(healthScore, predictedFailures);

      // Store analysis results
      const analytics: InsertPredictiveAnalytics = {
        equipmentId,
        analysisType: 'health_assessment',
        remainingUsefulLife: this.estimateRUL(predictedFailures),
        failureProbability: 1 - (healthScore / 100),
        anomalyScore: this.calculateAnomalyScore(sensorData, model),
        confidenceLevel: 0.85,
        riskLevel,
        recommendations,
        modelVersion: model.modelVersion,
        inputFeatures: {
          equipmentType: equipment.equipmentType,
          sensorDataPoints: sensorData.length,
          healthScore,
          analysisTimestamp: new Date().toISOString()
        }
      };

      await gmaoStorage.createPredictiveAnalytics(analytics);

      return {
        healthScore,
        riskLevel,
        predictedFailures,
        recommendations,
        nextMaintenanceDate
      };

    } catch (error) {
      console.error('Error analyzing equipment health:', error);
      throw error;
    }
  }

  /**
   * Calculate equipment health score (0-100)
   */
  private async calculateHealthScore(
    equipmentId: number,
    sensorData: any[],
    model: PredictiveModel,
    tenantId: string
  ): Promise<number> {
    let healthScore = 100;

    // Analyze each sensor metric
    for (const threshold of model.thresholds) {
      const relevantData = sensorData.filter(d => d.sensorType === threshold.metricType);
      
      if (relevantData.length === 0) continue;

      const latestValue = parseFloat(relevantData[0].value);
      
      // Calculate degradation based on thresholds
      if (latestValue >= threshold.criticalLevel) {
        healthScore -= 25;
      } else if (latestValue >= threshold.warningLevel) {
        healthScore -= 10;
      }

      // Check trend
      if (relevantData.length >= 5) {
        const trend = this.calculateTrend(relevantData.slice(0, 5).map(d => parseFloat(d.value)));
        if (Math.abs(trend) > threshold.trendThreshold) {
          healthScore -= 5;
        }
      }
    }

    // Consider equipment age
    const equipment = await gmaoStorage.getEquipmentById(equipmentId, tenantId);
    if (equipment?.installationDate) {
      const ageYears = (Date.now() - equipment.installationDate.getTime()) / (365 * 24 * 60 * 60 * 1000);
      if (ageYears > 10) healthScore -= Math.min(15, (ageYears - 10) * 2);
    }

    // Consider maintenance history
    const recentWorkOrders = await gmaoStorage.getWorkOrdersByEquipment(equipmentId, tenantId);
    const recentFailures = recentWorkOrders.filter(wo => 
      wo.orderType === 'corrective' && 
      wo.createdAt && 
      (Date.now() - wo.createdAt.getTime()) < 90 * 24 * 60 * 60 * 1000
    );
    
    healthScore -= recentFailures.length * 8;

    return Math.max(0, Math.min(100, healthScore));
  }

  /**
   * Predict potential failures
   */
  private async predictFailures(
    equipmentId: number,
    sensorData: any[],
    model: PredictiveModel
  ): Promise<any[]> {
    const predictions: any[] = [];

    // Horizon sur lequel la probabilité de base est évaluée. Il DOIT être
    // explicite : une probabilité sans horizon n'a aucun sens, et l'ancienne
    // formule n'en avait pas.
    const HORIZON_JOURS = 30;

    for (const pattern of model.failurePatterns) {
      // ⚠️ `probabilityScore` était incrémenté de 0,3 par symptôme puis
      // JAMAIS utilisé : la probabilité finale se calculait à partir du ratio.
      // Une variable morte au cœur d'un calcul de risque donne à croire qu'un
      // raisonnement a lieu là où il n'y en a pas. Supprimée.
      const symptomesObserves = pattern.symptoms.filter(
        (sy) => this.isSymptomPresent(sy, sensorData),
      );
      const symptomRatio = symptomesObserves.length / pattern.symptoms.length;

      // ⚠️ AUCUNE PRÉDICTION SANS LE MOINDRE SYMPTÔME.
      //
      // L'ancienne version émettait une alerte pour un équipement parfaitement
      // sain : la probabilité de base d'un roulement moteur valait 0,25, soit
      // au-dessus du seuil de 0,2, et une rupture était annoncée à dix jours.
      // Un système qui crie au loup sur du matériel sain est abandonné en trois
      // semaines — et c'est l'alerte juste qu'on cesse alors de croire.
      //
      // Un taux de défaillance décrit une POPULATION ; il ne dit rien de CETTE
      // machine tant qu'aucun signe n'est relevé sur elle.
      if (symptomesObserves.length === 0) continue;

      const base = probabiliteDefaillance(pattern.frequency, HORIZON_JOURS);
      if (base === undefined) continue;

      const finalProbability = combinerAvecSymptomes(base, symptomRatio);
      const estimatedDays = joursAvantDefaillance(pattern.leadTime, symptomRatio);

      if (finalProbability > 0.2) {
        predictions.push({
          patternId: pattern.patternId,
          failureType: pattern.name,
          description: pattern.description,
          probability: finalProbability,
          probabiliteDeBase: base,
          horizonJours: HORIZON_JOURS,
          estimatedDays,
          criticality: pattern.criticality,
          symptoms: symptomesObserves,
          // Combien de symptômes du mode sont réellement observables par la
          // supervision : un mode dont la plupart des signes échappent aux
          // capteurs ne peut pas être pronostiqué de façon fiable.
          symptomesObservables: pattern.symptoms.filter(
            (sy) => SYMPTOMES_RECONNUS.has(sy),
          ).length,
          symptomesDeclares: pattern.symptoms.length,
        });
      }
    }

    return predictions.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Generate maintenance recommendations
   */
  private async generateRecommendations(
    equipmentId: number,
    sensorData: any[],
    model: PredictiveModel,
    healthScore: number,
    tenantId: string
  ): Promise<any[]> {
    const recommendations: any[] = [];

    // Apply maintenance rules
    for (const rule of model.maintenanceRules) {
      if (this.evaluateRuleCondition(rule.condition, sensorData)) {
        recommendations.push({
          ruleId: rule.ruleId,
          action: rule.action,
          priority: rule.priority,
          estimatedDuration: rule.estimatedDuration,
          requiredSkills: rule.requiredSkills,
          spareParts: rule.spareParts,
          reason: `Condition met: ${rule.condition}`
        });
      }
    }

    // Add health-based recommendations
    if (healthScore < 70) {
      recommendations.push({
        ruleId: 'HEALTH_CRITICAL',
        action: 'Inspection approfondie et diagnostic complet',
        priority: 'high',
        estimatedDuration: 4,
        requiredSkills: ['diagnostic', 'mécanique'],
        spareParts: [],
        reason: `Score de santé faible: ${healthScore}%`
      });
    }

    // Add predictive recommendations
    const equipment = await gmaoStorage.getEquipmentById(equipmentId, tenantId);
    if (equipment?.installationDate) {
      const ageYears = (Date.now() - equipment.installationDate.getTime()) / (365 * 24 * 60 * 60 * 1000);
      if (ageYears > 8) {
        recommendations.push({
          ruleId: 'AGE_PREVENTIVE',
          action: 'Révision générale planifiée',
          priority: 'medium',
          estimatedDuration: 8,
          requiredSkills: ['mécanique', 'électrique'],
          spareParts: ['joints', 'roulements', 'lubrifiants'],
          reason: `Équipement âgé de ${Math.round(ageYears)} ans`
        });
      }
    }

    return recommendations.sort((a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority));
  }

  /**
   * Calculate next recommended maintenance date
   */
  private calculateNextMaintenanceDate(predictedFailures: any[], recommendations: any[]): Date | null {
    let earliestDate: Date | null = null;

    // Consider predicted failures
    for (const failure of predictedFailures) {
      if (failure.probability > 0.6) {
        const failureDate = new Date();
        failureDate.setDate(failureDate.getDate() + failure.estimatedDays - 7); // Schedule 1 week before
        
        if (!earliestDate || failureDate < earliestDate) {
          earliestDate = failureDate;
        }
      }
    }

    // Consider high-priority recommendations
    const urgentRecommendations = recommendations.filter(r => r.priority === 'high');
    if (urgentRecommendations.length > 0 && !earliestDate) {
      earliestDate = new Date();
      earliestDate.setDate(earliestDate.getDate() + 3); // Schedule in 3 days
    }

    return earliestDate;
  }

  // Helper methods
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const x = Array.from({length: n}, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  private isSymptomPresent(symptom: string, sensorData: any[]): boolean {
    // ⚠️ Le `default: return false` traitait de la même façon « ce symptôme est
    // absent » et « ce symptôme, je ne sais pas le détecter ». Or les modèles
    // déclaraient des symptômes absents de ce switch — `bruit_anormal`,
    // `échauffement_excessif`, `baisse_rendement` — qui comptaient donc
    // systématiquement comme non observés. Le mode « bobinage endommagé »
    // plafonnait ainsi à un symptôme sur trois, quelle que soit la réalité.
    //
    // Un symptôme inconnu est maintenant journalisé, et le nombre de symptômes
    // réellement observables remonte dans la prédiction : un mode dont la
    // plupart des signes échappent aux capteurs ne peut pas être pronostiqué
    // de façon fiable, et celui qui lit l'alerte doit le savoir.
    // Constaté le 2026-10-13.
    if (!SYMPTOMES_RECONNUS.has(symptom)) {
      if (!PredictiveMaintenanceEngine.symptomesInconnusSignales.has(symptom)) {
        PredictiveMaintenanceEngine.symptomesInconnusSignales.add(symptom);
        console.warn(
          `[pronostic] symptôme « ${symptom} » déclaré dans un modèle mais `
          + `non détectable : aucun capteur ne lui est associé. Il comptera `
          + `toujours comme absent.`,
        );
      }
      return false;
    }

    // Les seuils ci-dessous sont des valeurs par défaut génériques. Ils
    // devraient à terme être propres à chaque équipement : un seuil de
    // vibration de 6 mm/s n'a pas le même sens sur un ventilateur et sur une
    // pompe haute pression (cf. ISO 10816, qui classe les machines avant de
    // fixer des zones).
    switch (symptom) {
      case 'vibrations_excessives':
        return sensorData.some(d => d.sensorType === 'vibration' && parseFloat(d.value) > 6);
      case 'echauffement':
      case 'échauffement_excessif':
        return sensorData.some(d => d.sensorType === 'temperature' && parseFloat(d.value) > 80);
      case 'surintensité':
        return sensorData.some(d => d.sensorType === 'current' && parseFloat(d.value) > 110);
      case 'baisse_debit':
        return sensorData.some(d => d.sensorType === 'flow' && parseFloat(d.value) < 85);
      default:
        return false;
    }
  }

  private evaluateRuleCondition(condition: string, sensorData: any[]): boolean {
    // Simplified condition evaluation
    // In production, this would use a proper expression parser
    const vibrationData = sensorData.find(d => d.sensorType === 'vibration');
    const temperatureData = sensorData.find(d => d.sensorType === 'temperature');
    const flowData = sensorData.find(d => d.sensorType === 'flow');
    const pressureData = sensorData.find(d => d.sensorType === 'pressure');

    if (condition.includes('vibration > 6.3') && vibrationData) {
      return parseFloat(vibrationData.value) > 6.3;
    }
    if (condition.includes('temperature > 80') && temperatureData) {
      return parseFloat(temperatureData.value) > 80;
    }
    if (condition.includes('flow < 85') && flowData) {
      return parseFloat(flowData.value) < 85;
    }
    if (condition.includes('pressure < 90') && pressureData) {
      return parseFloat(pressureData.value) < 90;
    }

    return false;
  }

  private determineRiskLevel(healthScore: number, predictedFailures: any[]): 'low' | 'medium' | 'high' | 'critical' {
    const highProbabilityFailures = predictedFailures.filter(f => f.probability > 0.7);
    const criticalFailures = predictedFailures.filter(f => f.criticality === 'critical');

    if (healthScore < 40 || criticalFailures.length > 0) return 'critical';
    if (healthScore < 60 || highProbabilityFailures.length > 0) return 'high';
    if (healthScore < 80) return 'medium';
    return 'low';
  }

  /**
   * Score d'anomalie 0-1 basé sur la déviation réelle de chaque capteur par rapport
   * aux seuils du modèle (mêmes seuils que calculateHealthScore) — remplace l'ancien
   * placeholder Math.random() qui ne reflétait aucune donnée réelle.
   */
  private calculateAnomalyScore(sensorData: any[], model: PredictiveModel): number {
    if (sensorData.length === 0 || model.thresholds.length === 0) return 0;

    let totalDeviation = 0;
    let count = 0;
    for (const threshold of model.thresholds) {
      const relevant = sensorData.filter(d => d.sensorType === threshold.metricType);
      if (relevant.length === 0) continue;

      const latestValue = parseFloat(relevant[0].value);
      const range = threshold.criticalLevel - threshold.warningLevel;
      if (range === 0) continue;

      const deviation = Math.max(0, (latestValue - threshold.warningLevel) / range);
      totalDeviation += Math.min(1, deviation);
      count++;
    }
    return count > 0 ? Math.round((totalDeviation / count) * 100) / 100 : 0;
  }

  private estimateRUL(predictedFailures: any[]): number {
    if (predictedFailures.length === 0) return 90;
    
    const nearestFailure = predictedFailures.reduce((min, failure) => 
      failure.estimatedDays < min ? failure.estimatedDays : min, 365
    );
    
    return Math.max(1, nearestFailure);
  }

  private getPriorityValue(priority: string): number {
    const values = { 'low': 1, 'medium': 2, 'high': 3, 'urgent': 4 };
    return values[priority as keyof typeof values] || 0;
  }

  private generateGenericAnalysis(equipmentId: number) {
    return {
      healthScore: 75,
      riskLevel: 'medium',
      predictedFailures: [],
      recommendations: [{
        action: 'Inspection préventive générale',
        priority: 'medium',
        estimatedDuration: 2,
        reason: 'Maintenance préventive recommandée'
      }],
      nextMaintenanceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  }

  /**
   * Update model based on feedback
   */
  async updateModelFromFeedback(
    equipmentType: string,
    predictionAccuracy: number,
    actualFailureType?: string
  ): Promise<void> {
    if (!this.learningEnabled) return;

    const model = this.models.get(equipmentType);
    if (!model) return;

    // Adjust model parameters based on accuracy
    if (predictionAccuracy < 0.7) {
      // Model needs improvement
      console.log(`Adjusting ${equipmentType} model based on low accuracy: ${predictionAccuracy}`);
    }

    // In a full implementation, this would update ML model weights
    // For now, we log the feedback for future model improvements
    console.log(`Model feedback received - Equipment: ${equipmentType}, Accuracy: ${predictionAccuracy}`);
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return Array.from(this.models.keys());
  }
}