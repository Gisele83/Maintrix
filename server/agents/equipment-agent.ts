import { EventEmitter } from 'events';
import { AgentType, AgentStatus, AutonomyLevel, AnomalyDetection } from '../cognitive-layers/layer-contracts.js';
import { getCognitiveKernel, CognitiveAgent } from '../cognitive-kernel/index.js';
import { slidingWindowJSD, JSD_THRESHOLDS } from '../js-divergence.js';

export interface EquipmentState {
  equipmentId: number;
  equipmentType: string;
  healthScore: number;
  operatingHours: number;
  sensorReadings: Map<string, { value: number; unit: string; timestamp: Date }>;
  anomalyHistory: AnomalyDetection[];
  localModel: LocalEquipmentModel;
  lastDiagnosis?: any;
}

export interface LocalEquipmentModel {
  baselineValues: Map<string, { mean: number; stdDev: number }>;
  degradationRate: number;
  failurePatterns: string[];
  lastCalibration: Date;
}

export class EquipmentAgent extends EventEmitter {
  private agentRegistration: CognitiveAgent | null = null;
  private state: EquipmentState;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private sensorHistory: Map<string, number[]> = new Map();

  constructor(equipmentId: number, equipmentType: string) {
    super();
    this.state = {
      equipmentId,
      equipmentType,
      healthScore: 100,
      operatingHours: 0,
      sensorReadings: new Map(),
      anomalyHistory: [],
      localModel: {
        baselineValues: new Map(),
        degradationRate: 0,
        failurePatterns: [],
        lastCalibration: new Date()
      }
    };
  }

  async initialize(): Promise<void> {
    const kernel = getCognitiveKernel();
    this.agentRegistration = kernel.registerAgent(AgentType.EQUIPMENT, this.state.equipmentId);

    this.calibrateLocalModel();

    this.monitoringInterval = setInterval(() => this.monitoringCycle(), 10000);
  }

  private calibrateLocalModel(): void {
    const defaults: Record<string, { mean: number; stdDev: number }> = {
      temperature: { mean: 55, stdDev: 8 },
      vibration: { mean: 2.5, stdDev: 0.8 },
      pressure: { mean: 5.0, stdDev: 0.5 },
      current: { mean: 85, stdDev: 10 },
      speed: { mean: 1500, stdDev: 50 }
    };

    for (const [sensor, values] of Object.entries(defaults)) {
      this.state.localModel.baselineValues.set(sensor, values);
    }
    this.state.localModel.lastCalibration = new Date();
  }

  processSensorReading(sensorType: string, value: number, unit: string): AnomalyDetection | null {
    this.state.sensorReadings.set(sensorType, { value, unit, timestamp: new Date() });

    if (!this.sensorHistory.has(sensorType)) {
      this.sensorHistory.set(sensorType, []);
    }
    const history = this.sensorHistory.get(sensorType)!;
    history.push(value);
    if (history.length > 100) history.shift();

    const anomaly = this.detectLocalAnomaly(sensorType, value);

    if (anomaly) {
      this.state.anomalyHistory.push(anomaly);
      if (this.state.anomalyHistory.length > 50) this.state.anomalyHistory.shift();

      const kernel = getCognitiveKernel();
      kernel.sendMessage({
        fromAgent: this.agentRegistration?.agentId || 'unknown',
        toAgent: 'cognitive-kernel',
        messageType: 'anomaly_alert',
        payload: anomaly,
        priority: anomaly.severity === 'critical' ? 'critical' : 'high',
        requiresAck: true
      });
    }

    this.updateHealthScore();
    return anomaly;
  }

  private detectLocalAnomaly(sensorType: string, value: number): AnomalyDetection | null {
    const baseline = this.state.localModel.baselineValues.get(sensorType);
    if (!baseline) return null;

    const zScore = Math.abs((value - baseline.mean) / baseline.stdDev);

    if (zScore > 3.0) {
      return {
        anomalyId: `anomaly-eq${this.state.equipmentId}-${Date.now()}`,
        equipmentId: this.state.equipmentId,
        signalIds: [`${sensorType}-${Date.now()}`],
        anomalyType: 'threshold_breach',
        severity: zScore > 4.0 ? 'critical' : 'high',
        confidence: Math.min(0.5 + zScore * 0.1, 0.99),
        detectedAt: new Date(),
        description: `${sensorType} anomaly: value ${value} (z-score: ${zScore.toFixed(2)}, baseline: ${baseline.mean}±${baseline.stdDev})`,
        rawData: { sensorType, value, zScore, baseline }
      };
    }

    const history = this.sensorHistory.get(sensorType);
    if (history && history.length >= 10) {
      const recentValues = history.slice(-10);
      const trend = this.calculateTrend(recentValues);
      if (Math.abs(trend) > baseline.stdDev * 0.5) {
        return {
          anomalyId: `anomaly-trend-eq${this.state.equipmentId}-${Date.now()}`,
          equipmentId: this.state.equipmentId,
          signalIds: [`${sensorType}-trend-${Date.now()}`],
          anomalyType: 'trend_deviation',
          severity: Math.abs(trend) > baseline.stdDev ? 'high' : 'medium',
          confidence: 0.7,
          detectedAt: new Date(),
          description: `${sensorType} trend anomaly: rate of change ${trend.toFixed(3)} per reading`,
          rawData: { sensorType, trend, recentValues }
        };
      }
    }

    return null;
  }

  private calculateTrend(values: number[]): number {
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private updateHealthScore(): void {
    let score = 100;

    for (const [sensorType, reading] of this.state.sensorReadings) {
      const baseline = this.state.localModel.baselineValues.get(sensorType);
      if (baseline) {
        const deviation = Math.abs(reading.value - baseline.mean) / baseline.stdDev;
        score -= Math.min(deviation * 5, 20);
      }
    }

    const recentAnomalies = this.state.anomalyHistory.filter(
      a => Date.now() - a.detectedAt.getTime() < 3600000
    );
    score -= recentAnomalies.length * 5;
    score -= recentAnomalies.filter(a => a.severity === 'critical').length * 10;

    this.state.healthScore = Math.max(0, Math.min(100, Math.round(score)));
  }

  private monitoringCycle(): void {
    if (this.agentRegistration) {
      this.agentRegistration.lastHeartbeat = new Date();

      const history = this.sensorHistory;
      for (const [sensorType, values] of history) {
        if (values.length >= 30) {
          // Jensen-Shannon divergence sur fenêtres glissantes
          // Remplace : drift = |recentMean - baseline.mean| / baseline.mean  (% simple)
          const jsdResult = slidingWindowJSD(values, Math.min(20, Math.floor(values.length / 3)), 5);
          const lastJSD = jsdResult.lastDrift?.jsdDistance ?? 0;

          if (lastJSD > JSD_THRESHOLDS.light) {
            // JSD > seuil "légère" → mise à jour du taux de dégradation
            // Échelle : JSD_distance ∈ [0,1] → degradationRate ∈ [0,1]
            this.state.localModel.degradationRate = Math.max(
              this.state.localModel.degradationRate,
              lastJSD
            );
          }
        } else if (values.length >= 20) {
          // Fallback pour historique court : comparaison simple mais normalisée
          const baseline = this.state.localModel.baselineValues.get(sensorType);
          if (baseline && baseline.stdDev > 0) {
            const recentMean = values.slice(-10).reduce((a, b) => a + b, 0) / 10;
            // Écart normalisé par stdDev (z-score) → plus robuste que %
            const zDrift = Math.abs(recentMean - baseline.mean) / baseline.stdDev;
            // Conversion en échelle [0,1] équivalente JSD
            const driftEquiv = Math.min(1, zDrift / 4);
            if (driftEquiv > JSD_THRESHOLDS.light) {
              this.state.localModel.degradationRate = Math.max(
                this.state.localModel.degradationRate,
                driftEquiv
              );
            }
          }
        }
      }
    }
  }

  updateLocalModel(feedback: { sensorType: string; correctedBaseline?: { mean: number; stdDev: number } }): void {
    if (feedback.correctedBaseline) {
      this.state.localModel.baselineValues.set(feedback.sensorType, feedback.correctedBaseline);
      this.state.localModel.lastCalibration = new Date();
    }
  }

  getState(): Omit<EquipmentState, 'sensorReadings' | 'localModel'> & {
    sensorReadings: Record<string, any>;
    localModel: { baselineCount: number; degradationRate: number; lastCalibration: Date; failurePatterns: string[] };
  } {
    const readings: Record<string, any> = {};
    for (const [key, value] of this.state.sensorReadings) {
      readings[key] = value;
    }
    return {
      equipmentId: this.state.equipmentId,
      equipmentType: this.state.equipmentType,
      healthScore: this.state.healthScore,
      operatingHours: this.state.operatingHours,
      sensorReadings: readings,
      anomalyHistory: this.state.anomalyHistory.slice(-10),
      localModel: {
        baselineCount: this.state.localModel.baselineValues.size,
        degradationRate: this.state.localModel.degradationRate,
        lastCalibration: this.state.localModel.lastCalibration,
        failurePatterns: this.state.localModel.failurePatterns
      },
      lastDiagnosis: this.state.lastDiagnosis
    };
  }

  async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.agentRegistration) {
      const kernel = getCognitiveKernel();
      kernel.unregisterAgent(this.agentRegistration.agentId);
    }
  }
}
