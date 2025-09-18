import { EventEmitter } from 'events';
import { gmaoStorage } from '../gmao-storage';
import type { 
  InsertIotDevice, 
  InsertSensorThreshold, 
  InsertAutomatedSymptomDetection,
  InsertSmartNotification 
} from '@shared/schema';

interface SensorReading {
  deviceId: string;
  sensorType: string;
  value: number;
  unit: string;
  timestamp: Date;
  metadata?: any;
}

interface SymptomDetectionRule {
  id: string;
  equipmentType: string;
  symptomCode: string;
  symptomName: string;
  conditions: {
    sensorType: string;
    operator: 'gt' | 'lt' | 'eq' | 'between' | 'trend';
    value: number | [number, number];
    duration?: number; // minutes
  }[];
  confidence: number;
  algorithm: string;
}

export class AdvancedIoTConnector extends EventEmitter {
  private devices: Map<string, any> = new Map();
  private sensorReadings: Map<string, SensorReading[]> = new Map();
  private symptomRules: SymptomDetectionRule[] = [];
  private isConnected: boolean = false;
  private mqttClient: any = null;

  constructor() {
    super();
    this.initializeSymptomDetectionRules();
  }

  /**
   * Initialize connection to IoT devices and MQTT broker
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔗 Initializing Advanced IoT Connector...');
      
      // Simulate MQTT connection
      this.mqttClient = {
        connected: true,
        subscribe: (topics: string[]) => {
          console.log('📡 Subscribed to IoT topics:', topics);
        }
      };

      // Load existing IoT devices from database
      await this.loadIoTDevices();
      
      // Set up real-time sensor data collection
      this.startSensorDataCollection();
      
      // Start automated symptom detection
      this.startAutomatedSymptomDetection();
      
      this.isConnected = true;
      console.log('✅ Advanced IoT Connector initialized successfully');
      
      this.emit('connected');
    } catch (error) {
      console.error('❌ Failed to initialize IoT Connector:', error);
      throw error;
    }
  }

  /**
   * Load IoT devices from database
   */
  private async loadIoTDevices(): Promise<void> {
    try {
      // Create sample IoT devices if they don't exist
      const sampleDevices = [
        {
          deviceId: 'ACCEL-001-EQ001',
          equipmentId: 1,
          deviceType: 'accelerometer',
          location: 'Moteur principal - Palier arrière',
          batteryLevel: 0.85,
          signalStrength: 0.92,
          metadata: { sampleRate: 1000, sensitivity: 'high' }
        },
        {
          deviceId: 'TEMP-001-EQ001',
          equipmentId: 1,
          deviceType: 'thermometer',
          location: 'Moteur principal - Stator',
          batteryLevel: 0.78,
          signalStrength: 0.88,
          metadata: { range: [-40, 150], accuracy: 0.1 }
        },
        {
          deviceId: 'PRESS-001-EQ002',
          equipmentId: 2,
          deviceType: 'pressure_sensor',
          location: 'Pompe hydraulique - Circuit principal',
          batteryLevel: 0.92,
          signalStrength: 0.95,
          metadata: { range: [0, 100], unit: 'bar' }
        }
      ];

      for (const deviceData of sampleDevices) {
        this.devices.set(deviceData.deviceId, deviceData);
        
        // Initialize sensor reading history
        this.sensorReadings.set(deviceData.deviceId, []);
        
        // Create sensor thresholds
        await this.createSensorThresholds(deviceData);
      }

      console.log(`📱 Loaded ${this.devices.size} IoT devices`);
    } catch (error) {
      console.error('Error loading IoT devices:', error);
    }
  }

  /**
   * Create sensor thresholds for IoT devices
   */
  private async createSensorThresholds(device: any): Promise<void> {
    const thresholdData = this.getThresholdsByDeviceType(device.deviceType);
    
    for (const threshold of thresholdData) {
      // Note: In a real implementation, we would store these in the database
      console.log(`🎯 Threshold configured for ${device.deviceId}: ${threshold.metricType} (${threshold.warningLevel}-${threshold.criticalLevel} ${threshold.unit})`);
    }
  }

  /**
   * Get default thresholds by device type
   */
  private getThresholdsByDeviceType(deviceType: string): any[] {
    const thresholds: { [key: string]: any[] } = {
      accelerometer: [
        { metricType: 'vibration', warningLevel: 4.5, criticalLevel: 6.0, unit: 'mm/s' }
      ],
      thermometer: [
        { metricType: 'temperature', warningLevel: 75, criticalLevel: 90, unit: '°C' }
      ],
      pressure_sensor: [
        { metricType: 'pressure', warningLevel: 4.0, criticalLevel: 5.5, unit: 'bar' }
      ],
      current_sensor: [
        { metricType: 'current', warningLevel: 10, criticalLevel: 12, unit: 'A' }
      ]
    };

    return thresholds[deviceType] || [];
  }

  /**
   * Start collecting sensor data from IoT devices
   */
  private startSensorDataCollection(): void {
    // Simulate real-time sensor data collection
    setInterval(() => {
      this.collectSensorData();
    }, 5000); // Every 5 seconds

    console.log('📊 Started real-time sensor data collection');
  }

  /**
   * Collect sensor data from all devices
   */
  private collectSensorData(): void {
    this.devices.forEach((device) => {
      const reading = this.generateSensorReading(device);
      
      // Store reading in memory
      const readings = this.sensorReadings.get(device.deviceId) || [];
      readings.unshift(reading);
      
      // Keep only last 100 readings per device
      if (readings.length > 100) {
        readings.splice(100);
      }
      
      this.sensorReadings.set(device.deviceId, readings);
      
      // Emit sensor reading event
      this.emit('sensorReading', reading);
      
      // Check for threshold breaches
      this.checkThresholdBreaches(device, reading);
    });
  }

  /**
   * Generate realistic sensor reading for a device
   */
  private generateSensorReading(device: any): SensorReading {
    const baseValues: { [key: string]: { base: number; variance: number; unit: string } } = {
      accelerometer: { base: 3.2, variance: 2.5, unit: 'mm/s' },
      thermometer: { base: 65, variance: 15, unit: '°C' },
      pressure_sensor: { base: 3.5, variance: 2.0, unit: 'bar' },
      current_sensor: { base: 8.5, variance: 3.0, unit: 'A' }
    };

    const config = baseValues[device.deviceType];
    if (!config) {
      throw new Error(`Unknown device type: ${device.deviceType}`);
    }

    const value = config.base + (Math.random() - 0.5) * config.variance * 2;
    
    return {
      deviceId: device.deviceId,
      sensorType: this.getSensorTypeFromDevice(device.deviceType),
      value: Math.max(0, parseFloat(value.toFixed(2))),
      unit: config.unit,
      timestamp: new Date(),
      metadata: {
        deviceLocation: device.location,
        batteryLevel: device.batteryLevel,
        signalStrength: device.signalStrength
      }
    };
  }

  /**
   * Map device type to sensor type
   */
  private getSensorTypeFromDevice(deviceType: string): string {
    const mapping: { [key: string]: string } = {
      accelerometer: 'vibration',
      thermometer: 'temperature',
      pressure_sensor: 'pressure',
      current_sensor: 'current'
    };
    return mapping[deviceType] || deviceType;
  }

  /**
   * Check for threshold breaches and trigger alerts
   */
  private checkThresholdBreaches(device: any, reading: SensorReading): void {
    const thresholds = this.getThresholdsByDeviceType(device.deviceType);
    
    for (const threshold of thresholds) {
      if (threshold.metricType === reading.sensorType) {
        let severity = 'normal';
        
        if (reading.value >= threshold.criticalLevel) {
          severity = 'critical';
        } else if (reading.value >= threshold.warningLevel) {
          severity = 'warning';
        }
        
        if (severity !== 'normal') {
          this.triggerThresholdAlert(device, reading, threshold, severity);
        }
      }
    }
  }

  /**
   * Trigger threshold breach alert
   */
  private triggerThresholdAlert(device: any, reading: SensorReading, threshold: any, severity: string): void {
    const alert = {
      equipmentId: device.equipmentId,
      deviceId: device.deviceId,
      alertType: 'threshold_breach',
      severity,
      title: `${reading.sensorType.toUpperCase()} ${severity === 'critical' ? 'critique' : 'élevé'}`,
      message: `${device.location}: ${reading.sensorType} ${severity === 'critical' ? 'critique' : 'élevé'} (${reading.value}${reading.unit} > ${threshold[severity + 'Level']}${reading.unit})`,
      sensorReading: reading,
      threshold
    };

    // Supprimer ces logs génériques pour éviter le bruit d'alerte
    // console.log(`🚨 ${severity.toUpperCase()} Alert: ${alert.message}`);
    
    this.emit('thresholdAlert', alert);
  }

  /**
   * Initialize symptom detection rules
   */
  private initializeSymptomDetectionRules(): void {
    this.symptomRules = [
      {
        id: 'BEARING_WEAR',
        equipmentType: 'moteur',
        symptomCode: 'BEARING_001',
        symptomName: 'Usure roulement',
        conditions: [
          { sensorType: 'vibration', operator: 'gt', value: 4.5, duration: 5 },
          { sensorType: 'temperature', operator: 'gt', value: 70 }
        ],
        confidence: 0.85,
        algorithm: 'multi_sensor_correlation'
      },
      {
        id: 'PUMP_CAVITATION',
        equipmentType: 'pompe',
        symptomCode: 'PUMP_001',
        symptomName: 'Cavitation pompe',
        conditions: [
          { sensorType: 'pressure', operator: 'lt', value: 2.0, duration: 3 },
          { sensorType: 'vibration', operator: 'gt', value: 3.8 }
        ],
        confidence: 0.78,
        algorithm: 'pressure_vibration_analysis'
      },
      {
        id: 'OVERHEATING',
        equipmentType: 'moteur',
        symptomCode: 'TEMP_001',
        symptomName: 'Surchauffe équipement',
        conditions: [
          { sensorType: 'temperature', operator: 'gt', value: 85, duration: 2 }
        ],
        confidence: 0.92,
        algorithm: 'temperature_threshold'
      },
      {
        id: 'ELECTRICAL_ANOMALY',
        equipmentType: 'moteur',
        symptomCode: 'ELEC_001',
        symptomName: 'Anomalie électrique',
        conditions: [
          { sensorType: 'current', operator: 'gt', value: 11.5 },
          { sensorType: 'temperature', operator: 'gt', value: 75, duration: 1 }
        ],
        confidence: 0.80,
        algorithm: 'electrical_analysis'
      }
    ];

    console.log(`🧠 Loaded ${this.symptomRules.length} automated symptom detection rules`);
  }

  /**
   * Start automated symptom detection
   */
  private startAutomatedSymptomDetection(): void {
    setInterval(() => {
      this.analyzeForSymptoms();
    }, 10000); // Every 10 seconds

    console.log('🔍 Started automated symptom detection');
  }

  /**
   * Analyze sensor data for automated symptom detection
   */
  private analyzeForSymptoms(): void {
    this.devices.forEach((device) => {
      const readings = this.sensorReadings.get(device.deviceId) || [];
      
      if (readings.length < 5) return; // Need sufficient data
      
      // Find applicable rules for this equipment type
      const applicableRules = this.symptomRules.filter(rule => 
        this.isRuleApplicable(rule, device)
      );
      
      for (const rule of applicableRules) {
        const detection = this.evaluateSymptomRule(rule, device, readings);
        
        if (detection.detected) {
          this.triggerSymptomDetection(device, rule, detection);
        }
      }
    });
  }

  /**
   * Check if a symptom rule is applicable to a device
   */
  private isRuleApplicable(rule: SymptomDetectionRule, device: any): boolean {
    // Get equipment info to check type compatibility
    // For now, assume all rules are applicable
    return true;
  }

  /**
   * Evaluate a symptom detection rule against sensor readings
   */
  private evaluateSymptomRule(rule: SymptomDetectionRule, device: any, readings: SensorReading[]): any {
    let conditionsMet = 0;
    const evaluationDetails: any[] = [];
    
    for (const condition of rule.conditions) {
      const relevantReadings = readings
        .filter(r => r.sensorType === condition.sensorType)
        .slice(0, condition.duration || 1);
      
      if (relevantReadings.length === 0) continue;
      
      const evaluation = this.evaluateCondition(condition, relevantReadings);
      evaluationDetails.push({
        condition,
        met: evaluation.met,
        value: evaluation.value,
        readings: relevantReadings.length
      });
      
      if (evaluation.met) {
        conditionsMet++;
      }
    }
    
    const detected = conditionsMet >= rule.conditions.length * 0.8; // 80% threshold
    const confidence = detected ? rule.confidence * (conditionsMet / rule.conditions.length) : 0;
    
    return {
      detected,
      confidence,
      conditionsMet,
      totalConditions: rule.conditions.length,
      details: evaluationDetails
    };
  }

  /**
   * Evaluate a single condition against sensor readings
   */
  private evaluateCondition(condition: any, readings: SensorReading[]): any {
    const values = readings.map(r => r.value);
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    
    let met = false;
    
    switch (condition.operator) {
      case 'gt':
        met = avgValue > condition.value;
        break;
      case 'lt':
        met = avgValue < condition.value;
        break;
      case 'eq':
        met = Math.abs(avgValue - condition.value) < 0.1;
        break;
      case 'between':
        const [min, max] = condition.value as [number, number];
        met = avgValue >= min && avgValue <= max;
        break;
      case 'trend':
        // Simple trend detection
        if (values.length >= 3) {
          const trend = (values[0] - values[values.length - 1]) / values.length;
          met = Math.abs(trend) > condition.value;
        }
        break;
    }
    
    return { met, value: avgValue };
  }

  /**
   * Trigger automated symptom detection
   */
  private triggerSymptomDetection(device: any, rule: SymptomDetectionRule, detection: any): void {
    const symptomDetection = {
      equipmentId: device.equipmentId,
      deviceId: device.deviceId,
      detectedSymptom: rule.symptomName,
      symptomCode: rule.symptomCode,
      confidence: detection.confidence,
      sensorData: this.sensorReadings.get(device.deviceId)?.slice(0, 10) || [],
      detectionAlgorithm: rule.algorithm,
      details: detection.details
    };

    console.log(`🎯 Automated symptom detected: ${rule.symptomName} (${Math.round(detection.confidence * 100)}% confidence) on ${device.location}`);
    
    this.emit('symptomDetected', symptomDetection);
    
    // Create smart notification
    this.createSmartNotification(device, rule, detection);
  }

  /**
   * Create smart notification for detected symptoms
   */
  private createSmartNotification(device: any, rule: SymptomDetectionRule, detection: any): void {
    const notification = {
      equipmentId: device.equipmentId,
      notificationType: 'automated_symptom_detection',
      severity: detection.confidence > 0.8 ? 'critical' : 'warning',
      title: `Symptôme détecté automatiquement: ${rule.symptomName}`,
      message: `L'IA a détecté "${rule.symptomName}" sur ${device.location} avec ${Math.round(detection.confidence * 100)}% de confiance. Vérification recommandée.`,
      actionRequired: `Inspecter ${device.location} et vérifier les conditions: ${rule.conditions.map(c => `${c.sensorType} ${c.operator} ${c.value}`).join(', ')}`,
      metadata: {
        detectionRule: rule.id,
        algorithm: rule.algorithm,
        deviceId: device.deviceId,
        conditionsMet: detection.conditionsMet,
        totalConditions: detection.totalConditions
      }
    };

    console.log(`📢 Smart notification: ${notification.title}`);
    
    this.emit('smartNotification', notification);
  }

  /**
   * Get current status of all IoT devices
   */
  getDeviceStatus(): any[] {
    const deviceStatuses: any[] = [];
    
    this.devices.forEach((device, deviceId) => {
      const recentReadings = this.sensorReadings.get(deviceId)?.slice(0, 5) || [];
      const lastReading = recentReadings[0];
      
      deviceStatuses.push({
        deviceId,
        equipmentId: device.equipmentId,
        deviceType: device.deviceType,
        location: device.location,
        status: device.batteryLevel > 0.2 ? 'active' : 'low_battery',
        batteryLevel: device.batteryLevel,
        signalStrength: device.signalStrength,
        lastReading: lastReading ? {
          value: lastReading.value,
          unit: lastReading.unit,
          timestamp: lastReading.timestamp
        } : null,
        readingsCount: recentReadings.length
      });
    });
    
    return deviceStatuses;
  }

  /**
   * Get sensor readings for a specific device
   */
  getDeviceReadings(deviceId: string, limit: number = 20): SensorReading[] {
    return this.sensorReadings.get(deviceId)?.slice(0, limit) || [];
  }

  /**
   * Get all recent sensor readings across all devices
   */
  getAllRecentReadings(minutes: number = 10): SensorReading[] {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    const allReadings: SensorReading[] = [];
    
    this.sensorReadings.forEach((readings) => {
      const recentReadings = readings.filter(r => r.timestamp >= cutoffTime);
      allReadings.push(...recentReadings);
    });
    
    return allReadings.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Disconnect from IoT systems
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;
    
    if (this.mqttClient) {
      // In a real implementation, disconnect from MQTT
      this.mqttClient = null;
    }
    
    console.log('🔌 Advanced IoT Connector disconnected');
    this.emit('disconnected');
  }

  /**
   * Check if connector is connected
   */
  isConnectedToIoT(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const advancedIoTConnector = new AdvancedIoTConnector();