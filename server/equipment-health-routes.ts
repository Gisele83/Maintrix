import type { Express } from "express";
import { gmaoStorage } from "./gmao-storage";

export function registerEquipmentHealthRoutes(app: Express) {
  // Get equipment health data with predictive analytics
  app.get("/api/equipment/health", async (req, res) => {
    try {
      const { equipmentId, timeRange } = req.query;
      const equipment = await gmaoStorage.getEquipmentRegistry();
      
      const healthData = await Promise.all(equipment.map(async (eq) => {
        // Get recent sensor data for this equipment
        const sensorData = await gmaoStorage.getIotSensorData(eq.id, undefined, 50);
        
        // Calculate health score based on sensor readings
        const healthScore = calculateHealthScore(sensorData);
        
        // Get sensor readings summary
        const sensors = getSensorReadings(sensorData);
        
        // Generate trend data (last 24 hours)
        const trends = generateTrendData(sensorData);
        
        // Generate predictive data
        const predictions = generatePredictions(sensorData, eq);
        
        // Get recent alerts for this equipment
        const alerts = await gmaoStorage.getAlerts(eq.id);
        
        // Determine overall status
        const status = determineEquipmentStatus(healthScore, sensors);
        
        return {
          id: eq.id,
          equipmentName: eq.equipmentName,
          equipmentCode: eq.equipmentId,
          healthScore,
          status,
          lastMaintenance: eq.createdAt, // Mock - should come from maintenance records
          nextMaintenance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Mock - 30 days from now
          sensors,
          trends,
          predictions,
          alerts: alerts.slice(0, 5) // Last 5 alerts
        };
      }));

      // Filter by equipment if specified
      const filteredData = equipmentId && equipmentId !== 'all' 
        ? healthData.filter(eq => eq.id.toString() === equipmentId)
        : healthData;

      res.json(filteredData);
    } catch (error) {
      console.error("Error fetching equipment health:", error);
      res.status(500).json({ message: "Failed to fetch equipment health data" });
    }
  });

  // Get equipment alerts
  app.get("/api/equipment/alerts", async (req, res) => {
    try {
      const { timeRange } = req.query;
      
      // Generate sample alerts based on IoT data
      const equipment = await gmaoStorage.getEquipmentRegistry();
      const allAlerts = [];
      
      for (const eq of equipment) {
        const sensorData = await gmaoStorage.getIotSensorData(eq.id, undefined, 10);
        const alerts = generateAlertsFromSensorData(eq, sensorData);
        allAlerts.push(...alerts);
      }
      
      // Sort by timestamp (most recent first)
      allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      res.json(allAlerts.slice(0, 50)); // Return last 50 alerts
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // Get predictive maintenance recommendations
  app.get("/api/equipment/predictions", async (req, res) => {
    try {
      const equipment = await gmaoStorage.getEquipmentRegistry();
      
      const predictions = await Promise.all(equipment.map(async (eq) => {
        const sensorData = await gmaoStorage.getIotSensorData(eq.id, undefined, 100);
        return {
          equipmentId: eq.id,
          equipmentName: eq.equipmentName,
          predictions: generatePredictions(sensorData, eq),
          recommendedActions: generateMaintenanceRecommendations(sensorData, eq)
        };
      }));
      
      res.json(predictions);
    } catch (error) {
      console.error("Error generating predictions:", error);
      res.status(500).json({ message: "Failed to generate predictions" });
    }
  });
}

// Helper functions for health calculations
function calculateHealthScore(sensorData: any[]): number {
  if (!sensorData.length) return 85; // Default score if no data
  
  const recentData = sensorData.slice(0, 10); // Last 10 readings
  
  let totalScore = 0;
  let scoreCount = 0;
  
  recentData.forEach(reading => {
    let sensorScore = 100;
    
    // Evaluate each sensor type
    if (reading.sensorType === 'temperature' && reading.value > 75) {
      sensorScore -= Math.min(50, (reading.value - 75) * 2);
    }
    if (reading.sensorType === 'vibration' && reading.value > 4.5) {
      sensorScore -= Math.min(40, (reading.value - 4.5) * 10);
    }
    if (reading.sensorType === 'pressure' && reading.value > 4.0) {
      sensorScore -= Math.min(45, (reading.value - 4.0) * 15);
    }
    if (reading.sensorType === 'current' && reading.value > 10) {
      sensorScore -= Math.min(30, (reading.value - 10) * 3);
    }
    
    totalScore += Math.max(0, sensorScore);
    scoreCount++;
  });
  
  return scoreCount > 0 ? Math.round(totalScore / scoreCount) : 85;
}

function getSensorReadings(sensorData: any[]): any[] {
  const sensorTypes = ['temperature', 'vibration', 'pressure', 'current'];
  
  return sensorTypes.map(type => {
    const readings = sensorData.filter(d => d.sensorType === type);
    if (!readings.length) {
      return {
        sensorType: type,
        value: 0,
        unit: getUnitForSensorType(type),
        threshold: getThresholdForSensorType(type),
        status: 'normal',
        timestamp: new Date().toISOString()
      };
    }
    
    const latestReading = readings[0];
    const threshold = getThresholdForSensorType(type);
    
    let status = 'normal';
    if (latestReading.value > threshold * 1.2) status = 'critical';
    else if (latestReading.value > threshold) status = 'warning';
    
    return {
      sensorType: type,
      value: parseFloat(parseFloat(latestReading.value).toFixed(2)),
      unit: getUnitForSensorType(type),
      threshold,
      status,
      timestamp: latestReading.timestamp
    };
  });
}

function generateTrendData(sensorData: any[]): any[] {
  // Group sensor data by timestamp (hourly intervals)
  const groupedData = new Map();
  
  sensorData.forEach(reading => {
    const hour = new Date(reading.timestamp);
    hour.setMinutes(0, 0, 0); // Round to hour
    const hourKey = hour.toISOString();
    
    if (!groupedData.has(hourKey)) {
      groupedData.set(hourKey, {
        timestamp: hourKey,
        temperature: [],
        vibration: [],
        pressure: [],
        current: []
      });
    }
    
    const group = groupedData.get(hourKey);
    if (group[reading.sensorType]) {
      group[reading.sensorType].push(reading.value);
    }
  });
  
  // Calculate averages and health scores
  return Array.from(groupedData.values())
    .map(group => {
      const avgTemp = group.temperature.length ? 
        group.temperature.reduce((a, b) => a + b, 0) / group.temperature.length : 65;
      const avgVib = group.vibration.length ? 
        group.vibration.reduce((a, b) => a + b, 0) / group.vibration.length : 3.2;
      const avgPress = group.pressure.length ? 
        group.pressure.reduce((a, b) => a + b, 0) / group.pressure.length : 3.5;
      const avgCurrent = group.current.length ? 
        group.current.reduce((a, b) => a + b, 0) / group.current.length : 8.5;
      
      // Calculate health score for this timestamp
      let healthScore = 100;
      if (avgTemp > 75) healthScore -= Math.min(50, (avgTemp - 75) * 2);
      if (avgVib > 4.5) healthScore -= Math.min(40, (avgVib - 4.5) * 10);
      if (avgPress > 4.0) healthScore -= Math.min(45, (avgPress - 4.0) * 15);
      if (avgCurrent > 10) healthScore -= Math.min(30, (avgCurrent - 10) * 3);
      
      return {
        timestamp: group.timestamp,
        temperature: parseFloat(avgTemp.toFixed(1)),
        vibration: parseFloat(avgVib.toFixed(2)),
        pressure: parseFloat(avgPress.toFixed(1)),
        current: parseFloat(avgCurrent.toFixed(1)),
        healthScore: Math.max(0, Math.round(healthScore))
      };
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-24); // Last 24 hours
}

function generatePredictions(sensorData: any[], equipment: any): any[] {
  const predictions = [];
  const sensorTypes = ['temperature', 'vibration', 'pressure', 'current'];
  
  sensorTypes.forEach(sensorType => {
    const readings = sensorData
      .filter(d => d.sensorType === sensorType)
      .slice(0, 20); // Last 20 readings
    
    if (readings.length < 5) return; // Need sufficient data
    
    // Simple trend analysis
    const values = readings.map(r => r.value);
    const trend = calculateTrend(values);
    const currentValue = values[0];
    const predictedValue = parseFloat((currentValue + trend * 24).toFixed(2)); // Predict 24 hours ahead
    
    // Calculate confidence based on data consistency
    const variance = calculateVariance(values);
    const confidence = Math.max(60, Math.min(95, 90 - variance * 10));
    
    // Determine risk level
    const threshold = getThresholdForSensorType(sensorType);
    let riskLevel = 'low';
    if (predictedValue > threshold * 1.2) riskLevel = 'high';
    else if (predictedValue > threshold) riskLevel = 'medium';
    
    // Estimate time to failure
    const timeToFailure = predictedValue > threshold ? 
      Math.max(1, Math.round((threshold * 1.5 - currentValue) / Math.abs(trend) * 24)) : 
      365; // 1 year if healthy
    
    predictions.push({
      metric: sensorType,
      currentValue: parseFloat(currentValue.toFixed(2)),
      predictedValue,
      confidence: Math.round(confidence),
      timeToFailure: Math.min(365, timeToFailure),
      riskLevel
    });
  });
  
  return predictions;
}

function generateAlertsFromSensorData(equipment: any, sensorData: any[]): any[] {
  const alerts = [];
  let alertId = Math.floor(Math.random() * 10000);
  
  sensorData.forEach(reading => {
    const threshold = getThresholdForSensorType(reading.sensorType);
    
    if (reading.value > threshold * 1.2) {
      alerts.push({
        id: alertId++,
        severity: 'critical',
        message: `${equipment.equipmentName}: ${reading.sensorType} critique (${reading.value} ${getUnitForSensorType(reading.sensorType)})`,
        timestamp: reading.timestamp,
        equipmentId: equipment.id
      });
    } else if (reading.value > threshold) {
      alerts.push({
        id: alertId++,
        severity: 'warning',
        message: `${equipment.equipmentName}: ${reading.sensorType} élevé (${reading.value} ${getUnitForSensorType(reading.sensorType)})`,
        timestamp: reading.timestamp,
        equipmentId: equipment.id
      });
    }
  });
  
  return alerts;
}

function generateMaintenanceRecommendations(sensorData: any[], equipment: any): any[] {
  const recommendations = [];
  const recentData = sensorData.slice(0, 10);
  
  // Analyze trends and generate recommendations
  const highTempReadings = recentData.filter(d => d.sensorType === 'temperature' && d.value > 75);
  const highVibReadings = recentData.filter(d => d.sensorType === 'vibration' && d.value > 4.5);
  const highPressReadings = recentData.filter(d => d.sensorType === 'pressure' && d.value > 4.0);
  
  if (highTempReadings.length > 3) {
    recommendations.push({
      type: 'maintenance',
      priority: 'high',
      action: 'Vérification système de refroidissement',
      reason: 'Température élevée détectée',
      estimatedDuration: '2 heures'
    });
  }
  
  if (highVibReadings.length > 3) {
    recommendations.push({
      type: 'maintenance',
      priority: 'medium',
      action: 'Équilibrage et alignement',
      reason: 'Vibrations excessives',
      estimatedDuration: '4 heures'
    });
  }
  
  if (highPressReadings.length > 3) {
    recommendations.push({
      type: 'maintenance',
      priority: 'high',
      action: 'Inspection circuit hydraulique',
      reason: 'Pression anormale',
      estimatedDuration: '3 heures'
    });
  }
  
  return recommendations;
}

// Utility functions
function getUnitForSensorType(sensorType: string): string {
  switch (sensorType) {
    case 'temperature': return '°C';
    case 'vibration': return 'mm/s';
    case 'pressure': return 'bar';
    case 'current': return 'A';
    default: return '';
  }
}

function getThresholdForSensorType(sensorType: string): number {
  switch (sensorType) {
    case 'temperature': return 75;
    case 'vibration': return 4.5;
    case 'pressure': return 4.0;
    case 'current': return 10;
    default: return 100;
  }
}

function determineEquipmentStatus(healthScore: number, sensors: any[]): string {
  const criticalSensors = sensors.filter(s => s.status === 'critical');
  const warningSensors = sensors.filter(s => s.status === 'warning');
  
  if (criticalSensors.length > 0 || healthScore < 50) return 'critical';
  if (warningSensors.length > 0 || healthScore < 70) return 'warning';
  return 'healthy';
}

function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;
  
  // Simple linear trend calculation
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, val, idx) => sum + val * idx, 0);
  const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  return slope || 0;
}

function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return variance;
}