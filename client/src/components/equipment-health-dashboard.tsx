import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Thermometer,
  Zap,
  Droplets,
  Gauge
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from "recharts";

interface EquipmentHealth {
  id: number;
  equipmentName: string;
  equipmentCode: string;
  healthScore: number;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  lastMaintenance: string;
  nextMaintenance: string;
  sensors: SensorReading[];
  trends: TrendData[];
  predictions: PredictionData[];
  alerts: AlertData[];
}

interface SensorReading {
  sensorType: string;
  value: number;
  unit: string;
  threshold: number;
  status: 'normal' | 'warning' | 'critical';
  timestamp: string;
}

interface TrendData {
  timestamp: string;
  temperature: number;
  vibration: number;
  pressure: number;
  current: number;
  healthScore: number;
}

interface PredictionData {
  metric: string;
  currentValue: number;
  predictedValue: number;
  confidence: number;
  timeToFailure: number; // days
  riskLevel: 'low' | 'medium' | 'high';
}

interface AlertData {
  id: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  equipmentId: number;
}

export function EquipmentHealthDashboard() {
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("24h");
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch equipment health data
  const { data: healthData = [], isLoading } = useQuery<EquipmentHealth[]>({
    queryKey: ["/api/equipment/health", selectedEquipment, timeRange],
  });

  // Fetch equipment list for filtering
  const { data: equipment = [] } = useQuery({
    queryKey: ["/api/equipment"],
  });

  // Fetch recent alerts
  const { data: alerts = [] } = useQuery<AlertData[]>({
    queryKey: ["/api/equipment/alerts", timeRange],
  });

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getHealthScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-100";
    if (score >= 60) return "bg-yellow-100";
    return "bg-red-100";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'critical': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'offline': return <XCircle className="w-5 h-5 text-gray-500" />;
      default: return <Activity className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSensorIcon = (sensorType: string) => {
    switch (sensorType) {
      case 'temperature': return <Thermometer className="w-4 h-4" />;
      case 'current': return <Zap className="w-4 h-4" />;
      case 'pressure': return <Droplets className="w-4 h-4" />;
      case 'vibration': return <Gauge className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const formatTrendData = (equipment: EquipmentHealth[]) => {
    if (!equipment.length) return [];
    
    // Combine trends from all equipment
    const allTrends = equipment.flatMap(eq => 
      eq.trends.map(trend => ({
        ...trend,
        equipmentName: eq.equipmentName
      }))
    );

    // Group by timestamp and average values
    const groupedTrends = allTrends.reduce((acc, trend) => {
      if (!acc[trend.timestamp]) {
        acc[trend.timestamp] = {
          timestamp: new Date(trend.timestamp).toLocaleTimeString(),
          temperature: [],
          vibration: [],
          pressure: [],
          current: [],
          healthScore: []
        };
      }
      acc[trend.timestamp].temperature.push(trend.temperature);
      acc[trend.timestamp].vibration.push(trend.vibration);
      acc[trend.timestamp].pressure.push(trend.pressure);
      acc[trend.timestamp].current.push(trend.current);
      acc[trend.timestamp].healthScore.push(trend.healthScore);
      return acc;
    }, {} as any);

    return Object.values(groupedTrends).map((group: any) => ({
      timestamp: group.timestamp,
      temperature: group.temperature.reduce((a: number, b: number) => a + b, 0) / group.temperature.length,
      vibration: group.vibration.reduce((a: number, b: number) => a + b, 0) / group.vibration.length,
      pressure: group.pressure.reduce((a: number, b: number) => a + b, 0) / group.pressure.length,
      current: group.current.reduce((a: number, b: number) => a + b, 0) / group.current.length,
      healthScore: group.healthScore.reduce((a: number, b: number) => a + b, 0) / group.healthScore.length,
    }));
  };

  const filteredEquipment = selectedEquipment === "all" 
    ? healthData 
    : healthData.filter(eq => eq.id.toString() === selectedEquipment);

  const trendChartData = formatTrendData(filteredEquipment);

  const overallHealthScore = healthData.length > 0 
    ? Math.round(healthData.reduce((sum, eq) => sum + eq.healthScore, 0) / healthData.length)
    : 0;

  const criticalEquipmentCount = healthData.filter(eq => eq.status === 'critical').length;
  const warningEquipmentCount = healthData.filter(eq => eq.status === 'warning').length;
  const healthyEquipmentCount = healthData.filter(eq => eq.status === 'healthy').length;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord Santé Équipements</h1>
          <p className="text-gray-600 mt-2">Surveillance temps réel et analyse prédictive</p>
        </div>
        
        <div className="flex space-x-4">
          <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tous les équipements" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les équipements</SelectItem>
              {equipment.map((eq: any) => (
                <SelectItem key={eq.id} value={eq.id.toString()}>
                  {eq.equipmentName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1 heure</SelectItem>
              <SelectItem value="24h">24 heures</SelectItem>
              <SelectItem value="7d">7 jours</SelectItem>
              <SelectItem value="30d">30 jours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score Santé Global</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallHealthScore}%</div>
            <Progress value={overallHealthScore} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {overallHealthScore >= 80 ? "Excellent" : overallHealthScore >= 60 ? "Bon" : "Critique"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Équipements Sains</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{healthyEquipmentCount}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((healthyEquipmentCount / healthData.length) * 100)}% du parc
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertes Actives</CardTitle>
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{warningEquipmentCount}</div>
            <p className="text-xs text-muted-foreground">
              Surveillance requise
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">États Critiques</CardTitle>
            <XCircle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalEquipmentCount}</div>
            <p className="text-xs text-muted-foreground">
              Action immédiate requise
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="trends">Tendances</TabsTrigger>
          <TabsTrigger value="predictions">Prédictions</TabsTrigger>
          <TabsTrigger value="alerts">Alertes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredEquipment.map((eq) => (
              <Card key={eq.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      {getStatusIcon(eq.status)}
                      <span>{eq.equipmentName}</span>
                    </CardTitle>
                    <Badge className={getHealthScoreBg(eq.healthScore)}>
                      <span className={getHealthScoreColor(eq.healthScore)}>
                        {eq.healthScore}%
                      </span>
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{eq.equipmentCode}</p>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Health Score Progress */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Score de Santé</span>
                      <span>{eq.healthScore}%</span>
                    </div>
                    <Progress value={eq.healthScore} className="h-2" />
                  </div>

                  {/* Sensor Readings */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-900">Capteurs</h4>
                    {eq.sensors.slice(0, 4).map((sensor, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          {getSensorIcon(sensor.sensorType)}
                          <span className="capitalize">{sensor.sensorType}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span>{sensor.value} {sensor.unit}</span>
                          <Badge 
                            variant={sensor.status === 'normal' ? 'default' : sensor.status === 'warning' ? 'secondary' : 'destructive'}
                            className="text-xs"
                          >
                            {sensor.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Maintenance Info */}
                  <div className="border-t pt-3 text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">Dernière maintenance:</span>
                      <span>{new Date(eq.lastMaintenance).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Prochaine maintenance:</span>
                      <span>{new Date(eq.nextMaintenance).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tendances des Métriques Clés</CardTitle>
              <p className="text-sm text-gray-600">
                Évolution des paramètres de santé sur la période sélectionnée
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="healthScore" 
                      stroke="#22c55e" 
                      name="Score Santé (%)"
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="temperature" 
                      stroke="#ef4444" 
                      name="Température (°C)"
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="vibration" 
                      stroke="#f59e0b" 
                      name="Vibration (mm/s)"
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="pressure" 
                      stroke="#3b82f6" 
                      name="Pression (bar)"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribution des Scores de Santé</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { range: '80-100%', count: healthyEquipmentCount, fill: '#22c55e' },
                      { range: '60-79%', count: warningEquipmentCount, fill: '#f59e0b' },
                      { range: '0-59%', count: criticalEquipmentCount, fill: '#ef4444' }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Évolution du Score Moyen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="healthScore" 
                        stroke="#22c55e" 
                        fill="#22c55e" 
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredEquipment.map((eq) => (
              <Card key={eq.id}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5" />
                    <span>Prédictions - {eq.equipmentName}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {eq.predictions.map((pred, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium capitalize">{pred.metric}</h4>
                        <Badge 
                          variant={pred.riskLevel === 'low' ? 'default' : pred.riskLevel === 'medium' ? 'secondary' : 'destructive'}
                        >
                          Risque {pred.riskLevel}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Valeur actuelle:</span>
                          <p className="font-medium">{pred.currentValue}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Prédiction:</span>
                          <p className={`font-medium ${pred.predictedValue > pred.currentValue ? 'text-red-600' : 'text-green-600'}`}>
                            {pred.predictedValue}
                            {pred.predictedValue > pred.currentValue ? 
                              <TrendingUp className="w-4 h-4 inline ml-1" /> : 
                              <TrendingDown className="w-4 h-4 inline ml-1" />
                            }
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Confiance:</span>
                          <p className="font-medium">{pred.confidence}%</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Temps avant panne:</span>
                          <p className="font-medium">{pred.timeToFailure} jours</p>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Probabilité de défaillance</span>
                          <span>{100 - pred.confidence}%</span>
                        </div>
                        <Progress value={100 - pred.confidence} className="h-2" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Alertes Récentes</CardTitle>
              <p className="text-sm text-gray-600">
                Historique des alertes pour la période sélectionnée
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      {alert.severity === 'critical' && <XCircle className="w-5 h-5 text-red-500" />}
                      {alert.severity === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
                      {alert.severity === 'info' && <Activity className="w-5 h-5 text-blue-500" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(alert.timestamp).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <Badge 
                      variant={alert.severity === 'critical' ? 'destructive' : alert.severity === 'warning' ? 'secondary' : 'default'}
                      className="text-xs"
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                ))}
                
                {alerts.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune alerte</h3>
                    <p className="text-gray-600">Tous les équipements fonctionnent normalement</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}