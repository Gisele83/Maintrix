import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Card, Title, Paragraph, Chip, Badge, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';

interface SensorReading {
  id: string;
  equipmentId: string;
  equipmentName: string;
  sensorType: 'temperature' | 'vibration' | 'pressure' | 'flow';
  value: number;
  unit: string;
  timestamp: string;
  status: 'normal' | 'warning' | 'critical';
  threshold: {
    warning: number;
    critical: number;
  };
}

interface Alert {
  id: string;
  equipmentName: string;
  sensorType: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
}

export default function IoTMonitoringScreen() {
  const [sensorData, setSensorData] = useState<SensorReading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any>({});

  useEffect(() => {
    // Simulate real-time sensor data
    const generateSensorData = () => {
      const mockData: SensorReading[] = [
        {
          id: '1',
          equipmentId: 'EQ001',
          equipmentName: 'Pompe Hydraulique P-001',
          sensorType: 'temperature',
          value: 72 + Math.random() * 10,
          unit: '°C',
          timestamp: new Date().toISOString(),
          status: 'normal',
          threshold: { warning: 75, critical: 85 }
        },
        {
          id: '2',
          equipmentId: 'EQ001',
          equipmentName: 'Pompe Hydraulique P-001',
          sensorType: 'vibration',
          value: 3.2 + Math.random() * 2,
          unit: 'mm/s',
          timestamp: new Date().toISOString(),
          status: 'normal',
          threshold: { warning: 4.5, critical: 6 }
        },
        {
          id: '3',
          equipmentId: 'EQ001',
          equipmentName: 'Pompe Hydraulique P-001',
          sensorType: 'pressure',
          value: 3.8 + Math.random() * 1.5,
          unit: 'bar',
          timestamp: new Date().toISOString(),
          status: 'warning',
          threshold: { warning: 4, critical: 5.5 }
        },
        {
          id: '4',
          equipmentId: 'EQ002',
          equipmentName: 'Moteur Électrique M-002',
          sensorType: 'temperature',
          value: 78 + Math.random() * 8,
          unit: '°C',
          timestamp: new Date().toISOString(),
          status: 'warning',
          threshold: { warning: 75, critical: 90 }
        }
      ];

      // Update sensor status based on thresholds
      mockData.forEach(sensor => {
        if (sensor.value >= sensor.threshold.critical) {
          sensor.status = 'critical';
        } else if (sensor.value >= sensor.threshold.warning) {
          sensor.status = 'warning';
        } else {
          sensor.status = 'normal';
        }
      });

      setSensorData(mockData);

      // Generate alerts for warning/critical sensors
      const newAlerts: Alert[] = mockData
        .filter(sensor => sensor.status !== 'normal')
        .map(sensor => ({
          id: `alert-${sensor.id}-${Date.now()}`,
          equipmentName: sensor.equipmentName,
          sensorType: sensor.sensorType,
          message: `${sensor.sensorType} ${sensor.status}: ${sensor.value.toFixed(2)}${sensor.unit} > ${sensor.threshold[sensor.status as 'warning' | 'critical']}${sensor.unit}`,
          severity: sensor.status as 'warning' | 'critical',
          timestamp: new Date().toISOString()
        }));

      setAlerts(prev => [...newAlerts, ...prev].slice(0, 10)); // Keep last 10 alerts
    };

    generateSensorData();
    const interval = setInterval(generateSensorData, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Generate chart data for selected equipment
    if (selectedEquipment) {
      const equipmentSensors = sensorData.filter(s => s.equipmentId === selectedEquipment);
      
      // Create mock historical data for chart
      const chartLabels = ['10m', '8m', '6m', '4m', '2m', 'Now'];
      const temperatureData = chartLabels.map(() => 70 + Math.random() * 15);
      const vibrationData = chartLabels.map(() => 2 + Math.random() * 3);
      const pressureData = chartLabels.map(() => 3 + Math.random() * 2);

      setChartData({
        labels: chartLabels,
        datasets: [
          {
            data: temperatureData,
            color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`,
            label: 'Température (°C)'
          },
          {
            data: vibrationData,
            color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`,
            label: 'Vibration (mm/s)'
          },
          {
            data: pressureData,
            color: (opacity = 1) => `rgba(255, 206, 86, ${opacity})`,
            label: 'Pression (bar)'
          }
        ]
      });
    }
  }, [selectedEquipment, sensorData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return '#4CAF50';
      case 'warning': return '#FF9800';
      case 'critical': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'info': return '#2196F3';
      case 'warning': return '#FF9800';
      case 'critical': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const equipmentList = Array.from(new Set(sensorData.map(s => s.equipmentId)));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Card style={styles.headerCard}>
          <Card.Content>
            <Title>Monitoring IoT Temps Réel</Title>
            <Paragraph>Surveillance continue des capteurs industriels</Paragraph>
          </Card.Content>
        </Card>

        {/* Equipment Selection */}
        <Card style={styles.card}>
          <Card.Content>
            <Title>Sélection Équipement</Title>
            <View style={styles.equipmentButtons}>
              {equipmentList.map(equipId => {
                const equipment = sensorData.find(s => s.equipmentId === equipId);
                return (
                  <Button
                    key={equipId}
                    mode={selectedEquipment === equipId ? 'contained' : 'outlined'}
                    onPress={() => setSelectedEquipment(equipId)}
                    style={styles.equipmentButton}
                  >
                    {equipment?.equipmentName.split(' ')[0]}
                  </Button>
                );
              })}
            </View>
          </Card.Content>
        </Card>

        {/* Sensor Readings */}
        <Card style={styles.card}>
          <Card.Content>
            <Title>Lectures Capteurs en Temps Réel</Title>
            {sensorData.map((sensor) => (
              <View key={sensor.id} style={styles.sensorItem}>
                <View style={styles.sensorHeader}>
                  <Paragraph style={styles.sensorName}>
                    {sensor.equipmentName} - {sensor.sensorType}
                  </Paragraph>
                  <Chip 
                    style={{ backgroundColor: getStatusColor(sensor.status) }}
                    textStyle={{ color: 'white', fontSize: 10 }}
                  >
                    {sensor.status.toUpperCase()}
                  </Chip>
                </View>
                <View style={styles.sensorValue}>
                  <Title style={{ color: getStatusColor(sensor.status) }}>
                    {sensor.value.toFixed(2)} {sensor.unit}
                  </Title>
                  <Paragraph style={styles.threshold}>
                    Seuils: {sensor.threshold.warning}{sensor.unit} / {sensor.threshold.critical}{sensor.unit}
                  </Paragraph>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Chart */}
        {selectedEquipment && chartData.labels && (
          <Card style={styles.card}>
            <Card.Content>
              <Title>Tendances Historiques</Title>
              <LineChart
                data={chartData}
                width={Dimensions.get('window').width - 60}
                height={220}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16
                  },
                  propsForDots: {
                    r: '4',
                    strokeWidth: '2',
                  }
                }}
                bezier
                style={styles.chart}
              />
            </Card.Content>
          </Card>
        )}

        {/* Recent Alerts */}
        <Card style={styles.card}>
          <Card.Content>
            <Title>Alertes Récentes</Title>
            {alerts.length === 0 ? (
              <Paragraph>Aucune alerte récente</Paragraph>
            ) : (
              alerts.map((alert) => (
                <View key={alert.id} style={styles.alertItem}>
                  <View style={styles.alertHeader}>
                    <Badge 
                      style={{ backgroundColor: getSeverityColor(alert.severity) }}
                      size={8}
                    />
                    <Paragraph style={styles.alertEquipment}>
                      {alert.equipmentName}
                    </Paragraph>
                    <Paragraph style={styles.alertTime}>
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </Paragraph>
                  </View>
                  <Paragraph style={styles.alertMessage}>
                    {alert.message}
                  </Paragraph>
                </View>
              ))
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#E3F2FD',
  },
  card: {
    margin: 16,
    marginBottom: 8,
  },
  equipmentButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  equipmentButton: {
    margin: 4,
  },
  sensorItem: {
    marginVertical: 8,
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  sensorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sensorName: {
    flex: 1,
    fontWeight: 'bold',
  },
  sensorValue: {
    marginTop: 4,
  },
  threshold: {
    fontSize: 12,
    color: '#666',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  alertItem: {
    marginVertical: 4,
    padding: 8,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  alertEquipment: {
    flex: 1,
    marginLeft: 8,
    fontWeight: 'bold',
  },
  alertTime: {
    fontSize: 12,
    color: '#666',
  },
  alertMessage: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});