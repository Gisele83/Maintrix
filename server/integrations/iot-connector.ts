/**
 * IoT Sensor Integration Connector
 * Handles real-time data collection from industrial IoT sensors via MQTT and OPC-UA protocols
 */

import { gmaoStorage } from "../gmao-storage";
import { InsertIotSensorData, InsertAlertsNotifications, InsertPredictiveAnalytics } from "@shared/schema";
import * as mqtt from "mqtt";
type MqttClient = mqtt.MqttClient;

export interface IoTConfig {
  mqttBrokerUrl: string;
  mqttUsername?: string;
  mqttPassword?: string;
  opcuaEndpoint?: string;
  sensorThresholds: SensorThreshold[];
}

export interface SensorThreshold {
  sensorType: string;
  warningThreshold: number;
  criticalThreshold: number;
  unit: string;
}

export interface SensorReading {
  equipmentId: number;
  sensorId: string;
  sensorType: string;
  value: number;
  unit: string;
  timestamp: Date;
  quality: 'good' | 'uncertain' | 'bad';
  metadata?: any;
}

export class IoTConnector {
  private config: IoTConfig;
  private mqttClient?: MqttClient;
  private isConnected = false;
  private sensorData: Map<string, SensorReading[]> = new Map();
  private alertCooldowns: Map<string, Date> = new Map();

  constructor(config: IoTConfig) {
    this.config = config;
  }

  /**
   * Initialize IoT connections (MQTT and OPC-UA)
   */
  async initialize(): Promise<void> {
    await this.connectMQTT();
    // await this.connectOPCUA(); // Uncomment when OPC-UA is needed
  }

  /**
   * Connect to MQTT broker — real connection when MQTT_BROKER_URL is set,
   * simulation fallback otherwise.
   */
  private async connectMQTT(): Promise<void> {
    const brokerUrl = process.env.MQTT_BROKER_URL || this.config.mqttBrokerUrl;
    const isSimulation = brokerUrl.startsWith('mqtt://localhost') || brokerUrl.startsWith('mqtt://127.');

    if (isSimulation) {
      console.log('Simulating MQTT connection to:', brokerUrl);
      this.isConnected = true;
      setTimeout(() => {
        console.log('Simulated MQTT connection successful');
        this.subscribeToSensorTopicsSimulated();
      }, 1000);
      return;
    }

    try {
      console.log(`Connecting to real MQTT broker: ${brokerUrl}`);
      const options: mqtt.IClientOptions = {
        username: this.config.mqttUsername,
        password: this.config.mqttPassword,
        keepalive: 60,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
        protocolVersion: 4,
        clean: true,
      };

      this.mqttClient = mqtt.connect(brokerUrl, options);

      this.mqttClient.on('connect', () => {
        console.log('✅ MQTT broker connected:', brokerUrl);
        this.isConnected = true;
        this.subscribeToSensorTopics();
      });

      this.mqttClient.on('message', async (topic: string, message: Buffer) => {
        await this.handleSensorMessage(topic, message);
      });

      this.mqttClient.on('error', (err: Error) => {
        console.error('MQTT error:', err.message);
        this.isConnected = false;
      });

      this.mqttClient.on('offline', () => {
        console.warn('⚠️ MQTT broker offline — reconnecting...');
        this.isConnected = false;
      });

      this.mqttClient.on('reconnect', () => {
        console.log('🔄 MQTT reconnecting...');
      });
    } catch (error) {
      console.error('Failed to connect to MQTT broker:', error);
      // Fall back to simulation so the app doesn't crash
      this.isConnected = false;
    }
  }

  /**
   * Subscribe to sensor topics on real MQTT broker
   */
  private subscribeToSensorTopics(): void {
    if (!this.mqttClient) return;
    const topics = [
      'sensors/+/temperature',
      'sensors/+/vibration',
      'sensors/+/pressure',
      'sensors/+/flow',
      'sensors/+/current',
      'sensors/+/voltage',
      'sensors/+/humidity',
      'sensors/+/speed',
      'equipment/+/status',
      'alarms/+/state'
    ];
    this.mqttClient.subscribe(topics, (err: Error | null) => {
      if (err) console.error('MQTT subscribe error:', err.message);
      else console.log('✅ MQTT subscribed to', topics.length, 'topic patterns');
    });
  }

  /**
   * Simulated subscription (dev/localhost mode)
   */
  private subscribeToSensorTopicsSimulated(): void {
    const topics = [
      'sensors/+/temperature', 'sensors/+/vibration', 'sensors/+/pressure',
      'sensors/+/flow', 'sensors/+/current', 'sensors/+/voltage',
      'sensors/+/humidity', 'sensors/+/speed', 'equipment/+/status', 'alarms/+/state'
    ];
    console.log('Simulated subscription to topics:', topics);
  }

  /**
   * Handle incoming sensor messages
   */
  private async handleSensorMessage(topic: string, message: Buffer): Promise<void> {
    try {
      const data = JSON.parse(message.toString());
      const topicParts = topic.split('/');
      
      if (topicParts.length < 3) return;

      const equipmentId = parseInt(topicParts[1]);
      const sensorType = topicParts[2];
      
      const sensorReading: SensorReading = {
        equipmentId,
        sensorId: data.sensorId || `${equipmentId}_${sensorType}`,
        sensorType,
        value: parseFloat(data.value),
        unit: data.unit || this.getDefaultUnit(sensorType),
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        quality: data.quality || 'good',
        metadata: data.metadata
      };

      await this.processSensorReading(sensorReading);

    } catch (error) {
      console.error('Error processing sensor message:', error);
    }
  }

  /**
   * Process sensor reading and store in database
   */
  private async processSensorReading(reading: SensorReading): Promise<void> {
    try {
      // Store sensor data
      const sensorData: InsertIotSensorData = {
        equipmentId: reading.equipmentId,
        sensorType: reading.sensorType,
        sensorId: reading.sensorId,
        value: reading.value.toString(),
        unit: reading.unit,
        timestamp: reading.timestamp,
        quality: reading.quality,
        metadata: reading.metadata
      };

      await gmaoStorage.createIotSensorData(sensorData);

      // Store in memory for trend analysis
      const key = `${reading.equipmentId}_${reading.sensorType}`;
      if (!this.sensorData.has(key)) {
        this.sensorData.set(key, []);
      }
      
      const readings = this.sensorData.get(key)!;
      readings.push(reading);
      
      // Keep only last 100 readings for memory efficiency
      if (readings.length > 100) {
        readings.shift();
      }

      // Check thresholds and generate alerts
      await this.checkThresholds(reading);

      // Perform predictive analysis
      await this.performPredictiveAnalysis(reading);

    } catch (error) {
      console.error('Error processing sensor reading:', error);
    }
  }

  /**
   * Check sensor thresholds and generate alerts
   */
  private async checkThresholds(reading: SensorReading): Promise<void> {
    const threshold = this.config.sensorThresholds.find(
      t => t.sensorType === reading.sensorType
    );

    if (!threshold) return;

    const alertKey = `${reading.equipmentId}_${reading.sensorType}`;
    const lastAlert = this.alertCooldowns.get(alertKey);
    
    // Avoid spam alerts (5 minute cooldown)
    if (lastAlert && (Date.now() - lastAlert.getTime()) < 5 * 60 * 1000) {
      return;
    }

    let severity: string | null = null;
    let alertType = 'threshold';

    if (reading.value >= threshold.criticalThreshold) {
      severity = 'critical';
    } else if (reading.value >= threshold.warningThreshold) {
      severity = 'high';
    }

    if (severity) {
      const alert: InsertAlertsNotifications = {
        alertType,
        equipmentId: reading.equipmentId,
        severity,
        title: `${reading.sensorType.toUpperCase()} Alert`,
        message: `${reading.sensorType} value of ${reading.value} ${reading.unit} exceeds ${severity} threshold (${
          severity === 'critical' ? threshold.criticalThreshold : threshold.warningThreshold
        } ${reading.unit})`,
        triggerValue: reading.value,
        thresholdValue: severity === 'critical' ? threshold.criticalThreshold : threshold.warningThreshold
      };

      await gmaoStorage.createAlert(alert);
      this.alertCooldowns.set(alertKey, new Date());

      // Supprimer ces logs d'alertes IoT pour éviter le bruit dans toutes les pages
      // console.log(`Alert generated for equipment ${reading.equipmentId}: ${alert.message}`);
    }
  }

  /**
   * Perform predictive analysis on sensor data
   */
  private async performPredictiveAnalysis(reading: SensorReading): Promise<void> {
    const key = `${reading.equipmentId}_${reading.sensorType}`;
    const readings = this.sensorData.get(key);

    if (!readings || readings.length < 10) return;

    try {
      // Calculate trend and anomaly detection
      const values = readings.slice(-20).map(r => r.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      // Anomaly detection using z-score
      const zScore = Math.abs((reading.value - mean) / stdDev);
      const isAnomaly = zScore > 2.5; // 2.5 standard deviations

      // Trend analysis
      const trend = this.calculateTrend(values);
      const failureProbability = this.estimateFailureProbability(reading, trend, zScore);

      if (isAnomaly || failureProbability > 0.7) {
        const analytics: InsertPredictiveAnalytics = {
          equipmentId: reading.equipmentId,
          analysisType: isAnomaly ? 'anomaly' : 'pattern',
          remainingUsefulLife: this.estimateRUL(trend, failureProbability),
          failureProbability,
          anomalyScore: zScore,
          confidenceLevel: Math.min(0.95, 0.5 + (readings.length / 100) * 0.5),
          riskLevel: failureProbability > 0.8 ? 'critical' : failureProbability > 0.6 ? 'high' : 'medium',
          recommendations: this.generateRecommendations(reading, trend, failureProbability),
          modelVersion: '1.0',
          inputFeatures: {
            sensorType: reading.sensorType,
            currentValue: reading.value,
            mean,
            stdDev,
            trend,
            zScore,
            readingsCount: readings.length
          }
        };

        await gmaoStorage.createPredictiveAnalytics(analytics);

        // Generate alert for high failure probability
        if (failureProbability > 0.7) {
          const alert: InsertAlertsNotifications = {
            alertType: 'anomaly',
            equipmentId: reading.equipmentId,
            severity: failureProbability > 0.8 ? 'critical' : 'high',
            title: 'Predictive Maintenance Alert',
            message: `Equipment shows signs of potential failure. Failure probability: ${Math.round(failureProbability * 100)}%`,
            triggerValue: reading.value
          };

          await gmaoStorage.createAlert(alert);
        }
      }

    } catch (error) {
      console.error('Error in predictive analysis:', error);
    }
  }

  /**
   * Calculate trend from sensor values
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const x = Array.from({length: n}, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  /**
   * Estimate failure probability based on sensor data
   */
  private estimateFailureProbability(reading: SensorReading, trend: number, zScore: number): number {
    let probability = 0.1; // Base probability

    // Increase probability based on anomaly
    if (zScore > 3) probability += 0.4;
    else if (zScore > 2) probability += 0.2;

    // Increase probability based on trend
    if (reading.sensorType === 'temperature' || reading.sensorType === 'vibration') {
      if (trend > 0) probability += Math.min(0.3, trend * 0.1);
    }

    // Sensor-specific logic
    switch (reading.sensorType) {
      case 'vibration':
        if (reading.value > 10) probability += 0.2;
        break;
      case 'temperature':
        if (reading.value > 85) probability += 0.3;
        break;
      case 'current':
        if (Math.abs(trend) > 0.5) probability += 0.2;
        break;
    }

    return Math.min(1.0, probability);
  }

  /**
   * Estimate Remaining Useful Life (RUL) in days
   */
  private estimateRUL(trend: number, failureProbability: number): number {
    const baseDays = 90; // Base RUL
    const trendFactor = Math.max(0.1, 1 - Math.abs(trend) * 0.1);
    const probabilityFactor = Math.max(0.1, 1 - failureProbability);
    
    return Math.round(baseDays * trendFactor * probabilityFactor);
  }

  /**
   * Generate maintenance recommendations
   */
  private generateRecommendations(
    reading: SensorReading, 
    trend: number, 
    failureProbability: number
  ): any[] {
    const recommendations = [];

    if (failureProbability > 0.7) {
      recommendations.push({
        priority: 'high',
        action: 'Schedule immediate inspection',
        reason: `High failure probability detected (${Math.round(failureProbability * 100)}%)`
      });
    }

    switch (reading.sensorType) {
      case 'vibration':
        if (reading.value > 8) {
          recommendations.push({
            priority: 'medium',
            action: 'Check motor alignment and bearing condition',
            reason: 'Elevated vibration levels detected'
          });
        }
        break;
      case 'temperature':
        if (reading.value > 75) {
          recommendations.push({
            priority: 'medium',
            action: 'Verify cooling system and lubrication',
            reason: 'High temperature detected'
          });
        }
        break;
      case 'current':
        if (trend > 0.5) {
          recommendations.push({
            priority: 'medium',
            action: 'Inspect electrical connections and motor condition',
            reason: 'Increasing current consumption trend'
          });
        }
        break;
    }

    return recommendations;
  }

  /**
   * Get default unit for sensor type
   */
  private getDefaultUnit(sensorType: string): string {
    const units: Record<string, string> = {
      'temperature': '°C',
      'vibration': 'mm/s',
      'pressure': 'bar',
      'flow': 'L/min',
      'current': 'A',
      'voltage': 'V',
      'humidity': '%',
      'speed': 'rpm'
    };
    return units[sensorType] || 'unit';
  }

  /**
   * Get real-time sensor data for equipment
   */
  async getRealtimeSensorData(equipmentId: number): Promise<SensorReading[]> {
    const results: SensorReading[] = [];
    
    for (const [key, readings] of this.sensorData.entries()) {
      const [eqId] = key.split('_');
      if (parseInt(eqId) === equipmentId && readings.length > 0) {
        results.push(readings[readings.length - 1]); // Latest reading
      }
    }
    
    return results;
  }

  /**
   * Simulate sensor data for demo purposes
   */
  async simulateSensorData(equipmentId: number): Promise<void> {
    const sensorTypes = ['temperature', 'vibration', 'pressure', 'current'];
    
    for (const sensorType of sensorTypes) {
      const baseValue = this.getBaseValue(sensorType);
      const variation = Math.random() * 0.2 - 0.1; // ±10% variation
      const value = baseValue * (1 + variation);
      
      const reading: SensorReading = {
        equipmentId,
        sensorId: `SIM_${equipmentId}_${sensorType}`,
        sensorType,
        value: Math.round(value * 100) / 100,
        unit: this.getDefaultUnit(sensorType),
        timestamp: new Date(),
        quality: 'good',
        metadata: { simulated: true }
      };
      
      await this.processSensorReading(reading);
    }
  }

  private getBaseValue(sensorType: string): number {
    const baseValues: Record<string, number> = {
      'temperature': 65,
      'vibration': 4.5,
      'pressure': 6.2,
      'current': 12.5,
      'voltage': 400,
      'humidity': 45,
      'speed': 1450
    };
    return baseValues[sensorType] || 50;
  }

  /**
   * Disconnect from IoT systems
   */
  async disconnect(): Promise<void> {
    console.log('Disconnecting from IoT systems...');
    this.isConnected = false;
    // In production: this.mqttClient?.end();
  }

  /**
   * Get connection status
   */
  isConnectedToIoT(): boolean {
    return this.isConnected;
  }

  /**
   * Test IoT connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (this.isConnected) {
        return {
          success: true,
          message: 'IoT systems connected and receiving data'
        };
      } else {
        return {
          success: false,
          message: 'IoT systems not connected'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `IoT connection error: ${error}`
      };
    }
  }
}