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
  // `null` quand aucun capteur n'est évaluable : à afficher « — », jamais 0,
  // et surtout jamais la valeur 85 que l'ancien serveur inventait.
  healthScore: number | null;
  status: 'healthy' | 'warning' | 'critical' | 'offline' | 'non_evalue';
  lastMaintenance: string | null;
  nextMaintenance: string | null;
  sensors: SensorReading[];
  trends: TrendData[];
  predictions: PredictionData[];
}

interface SensorReading {
  sensorType: string;
  /** `null` quand le capteur n'existe pas sur cet équipement. */
  value: number | null;
  /** Unité telle qu'enregistrée avec le relevé, plus jamais devinée du type. */
  unit: string | null;
  status: 'normal' | 'warning' | 'critical' | 'non_evalue';
  timestamp: string | null;
  /** Écart au régime habituel du capteur, en écarts-types. Remplace `threshold`. */
  ecartReduit: number | null;
  reference: { moyenne: number; ecartType: number; points: number } | null;
  /** Pourquoi l'état vaut `non_evalue`. */
  motif: string | null;
}

interface TrendData {
  timestamp: string;
  // `null` = grandeur non mesurée sur cet intervalle. Le serveur substituait
  // auparavant des valeurs inventées (65 °C, 3,2 mm/s, 3,5 bar, 8,5 A), si
  // bien qu'une courbe pleine ne prouvait pas qu'un capteur existait.
  temperature: number | null;
  vibration: number | null;
  pressure: number | null;
  current: number | null;
  // `healthScore` a disparu de la tendance : il était calculé par intervalle
  // à partir des seuils absolus globaux, désormais supprimés. Un point isolé
  // n'a de toute façon pas d'historique auquel se comparer.
}

interface PredictionData {
  metric: string;
  currentValue: number;
  predictedValue: number;
  confidence: number;
  /**
   * Toujours `null` aujourd'hui. Le serveur renvoyait 365 (« un an ») dès que
   * la grandeur restait sous le seuil global : une durée de vie restante
   * purement inventée. Le calcul légitime vit dans `server/stochastic-rul.ts`,
   * qui s'appuie sur un modèle de dégradation ; il n'est pas encore branché
   * sur cet écran.
   */
  timeToFailure: number | null;
  /** Écart au régime habituel du capteur, en écarts-types. */
  ecartReduit: number | null;
  riskLevel: 'low' | 'medium' | 'high' | 'unknown';
}


export function EquipmentHealthDashboard() {
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("24h");
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch equipment health data
  const { data: healthData = [], isLoading } = useQuery<EquipmentHealth[]>({
    queryKey: ["/api/equipment/health", selectedEquipment, timeRange],
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
        };
      }
      acc[trend.timestamp].temperature.push(trend.temperature);
      acc[trend.timestamp].vibration.push(trend.vibration);
      acc[trend.timestamp].pressure.push(trend.pressure);
      acc[trend.timestamp].current.push(trend.current);
      return acc;
    }, {} as any);

    // ⚠️ Le serveur renvoie désormais `null` pour une grandeur non mesurée sur
    // l'intervalle, au lieu d'une valeur inventée (65 °C, 3,2 mm/s, 3,5 bar,
    // 8,5 A). Moyenner sans écarter ces `null` les compterait pour zéro et
    // tirerait la courbe vers le bas : un capteur absent ferait chuter la
    // mesure d'un capteur présent. `null` laisse un trou dans la courbe, ce
    // que Recharts affiche correctement comme une interruption.
    const moyenneMesuree = (xs: Array<number | null>): number | null => {
      const connues = xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
      return connues.length ? connues.reduce((a, b) => a + b, 0) / connues.length : null;
    };

    return Object.values(groupedTrends).map((group: any) => ({
      timestamp: group.timestamp,
      temperature: moyenneMesuree(group.temperature),
      vibration: moyenneMesuree(group.vibration),
      pressure: moyenneMesuree(group.pressure),
      current: moyenneMesuree(group.current),
    }));
  };

  const filteredEquipment = selectedEquipment === "all" 
    ? healthData 
    : healthData.filter(eq => eq.id.toString() === selectedEquipment);

  const trendChartData = formatTrendData(filteredEquipment);

  // ⚠️ La moyenne portait sur TOUS les équipements, y compris ceux dont le
  // score est désormais `null` faute de relevés. Les compter pour zéro ferait
  // chuter la santé du parc à cause de machines simplement non instrumentées ;
  // les compter pour 85 — ce que faisait l'ancien serveur — reviendrait à
  // inventer leur bonne santé. On ne moyenne donc que ce qui est mesuré, et on
  // dit sur combien d'équipements porte la moyenne.
  const scoresMesures = healthData
    .map(eq => eq.healthScore)
    .filter((s): s is number => typeof s === 'number');

  // Moyenne du parc, calculée uniquement sur les équipements RÉELLEMENT
  // évalués — affichée dans l'en-tête de la répartition ci-dessous.
  const santeMoyenne = scoresMesures.length > 0
    ? Math.round(scoresMesures.reduce((a, b) => a + b, 0) / scoresMesures.length)
    : null;

  const criticalEquipmentCount = healthData.filter(eq => eq.status === 'critical').length;
  const warningEquipmentCount = healthData.filter(eq => eq.status === 'warning').length;
  const healthyEquipmentCount = healthData.filter(eq => eq.status === 'healthy').length;
  const nonEvalueCount = healthData.filter(eq => eq.status === 'non_evalue').length;

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
              {healthData.map((eq) => (
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


      {/* Main Dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="trends">Tendances</TabsTrigger>
          <TabsTrigger value="predictions">Prédictions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredEquipment.map((eq) => (
              <Card key={eq.id} className="transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      {getStatusIcon(eq.status)}
                      <span>{eq.equipmentName}</span>
                    </CardTitle>
                    {eq.healthScore === null ? (
                      <Badge variant="outline" className="text-ink-mute">non évalué</Badge>
                    ) : (
                      <Badge className={getHealthScoreBg(eq.healthScore)}>
                        <span className={getHealthScoreColor(eq.healthScore)}>
                          {eq.healthScore}%
                        </span>
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{eq.equipmentCode}</p>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Health Score Progress */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Score de santé</span>
                      <span>{eq.healthScore === null ? '—' : `${eq.healthScore} %`}</span>
                    </div>
                    {eq.healthScore === null ? (
                      // Pas de barre à zéro : une jauge vide se lit « santé
                      // nulle », alors qu'on veut dire « pas de mesure ».
                      <p className="text-xs text-ink-mute">
                        Aucun capteur ne fournit assez de relevés pour établir une référence.
                      </p>
                    ) : (
                      <Progress value={eq.healthScore} className="h-2" />
                    )}
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
                  {/* ⚠️ Ces deux dates étaient fausses à la source : le serveur
                      renvoyait la date de CRÉATION de la fiche équipement pour
                      « dernière maintenance », et « aujourd'hui + 30 jours »
                      pour la suivante, identiques sur tout le parc. Elles
                      viennent maintenant des interventions closes et des plans
                      préventifs, et valent `null` quand il n'y en a pas. */}
                  <div className="border-t pt-3 text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">Dernière intervention :</span>
                      <span>
                        {eq.lastMaintenance
                          ? new Date(eq.lastMaintenance).toLocaleDateString('fr-FR')
                          : <span className="text-ink-mute">aucune close</span>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Prochaine échéance :</span>
                      <span>
                        {eq.nextMaintenance
                          ? new Date(eq.nextMaintenance).toLocaleDateString('fr-FR')
                          : <span className="text-ink-mute">aucun plan actif</span>}
                      </span>
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
                    {/* ⚠️ Une courbe « Score Santé (%) » tirait ici sur
                        `healthScore`, que le serveur calculait par intervalle
                        à partir des seuils absolus globaux — donc une courbe
                        qui décrivait l'échelle des unités, pas l'état de la
                        machine. Le champ a disparu du contrat ; la courbe
                        aurait été plate à zéro. */}
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
                <CardTitle>Répartition du parc par état</CardTitle>
                <p className="text-sm text-ink-soft">
                  {santeMoyenne === null
                    ? 'Santé moyenne : — (aucun équipement évalué)'
                    : `Santé moyenne : ${santeMoyenne} % sur ${scoresMesures.length} équipement${scoresMesures.length > 1 ? 's' : ''} évalué${scoresMesures.length > 1 ? 's' : ''}.`}
                  {nonEvalueCount > 0
                    && ` ${nonEvalueCount} sans relevés suffisants.`}
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {/* ⚠️ Les barres étaient étiquetées « 80-100 % », « 60-79 %,
                      « 0-59 % » alors qu'elles comptent des ÉTATS, pas des
                      plages de score. Et la catégorie « non évalué » était
                      absente : un parc entièrement non instrumenté affichait
                      trois barres vides, ce qui se lit « aucun problème »
                      plutôt que « aucune mesure ». */}
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { range: 'Sain', count: healthyEquipmentCount, fill: '#22c55e' },
                      { range: 'Sous surveillance', count: warningEquipmentCount, fill: '#f59e0b' },
                      { range: 'Anomalie', count: criticalEquipmentCount, fill: '#ef4444' },
                      { range: 'Non évalué', count: nonEvalueCount, fill: '#94a3b8' }
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
                <CardTitle>Évolution du niveau vibratoire</CardTitle>
                <p className="text-sm text-ink-soft">
                  La vibration est le premier signe d'une dégradation mécanique.
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {/* ⚠️ Cette aire traçait « Évolution du Score Moyen » sur
                      `healthScore`, calculé par intervalle à partir des seuils
                      absolus globaux. Ce champ n'existe plus : la courbe
                      aurait été vide. On trace une grandeur réellement
                      mesurée, et `connectNulls={false}` laisse visibles les
                      intervalles sans relevé plutôt que de les combler. */}
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="vibration"
                        name="Vibration"
                        stroke="#006B97"
                        fill="#006B97"
                        fillOpacity={0.3}
                        connectNulls={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          {/* ⚠️ Cet onglet itérait directement sur `filteredEquipment`. Sans
              équipement — c'est-à-dire sur toute organisation qui n'a pas
              encore saisi son parc — la liste est vide et le `.map()` ne rend
              RIEN : l'écran restait entièrement blanc, sans titre ni message.
              Un écran vide se lit comme une panne, pas comme une absence de
              données. */}
          {filteredEquipment.length === 0 && (
            <div className="rounded-lg border border-rule bg-paper p-8 text-center">
              <p className="text-ink-soft">
                Aucune prédiction : le parc ne comporte aucun équipement
                correspondant au filtre.
              </p>
              <p className="mt-2 text-sm text-ink-mute">
                Les prédictions se calculent à partir des relevés de capteurs
                et de l'historique d'interventions de chaque équipement.
              </p>
            </div>
          )}
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
                          {/* ⚠️ Affichait « 365 jours » dès que la grandeur
                              restait sous le seuil global — une durée de vie
                              restante inventée, et rassurante par défaut. */}
                          <span className="text-gray-600">Écart au régime habituel :</span>
                          <p className="font-medium">
                            {pred.ecartReduit === null
                              ? <span className="text-ink-mute">non évalué</span>
                              : `${Math.abs(pred.ecartReduit).toFixed(1)} écarts-types`}
                          </p>
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

      </Tabs>
    </div>
  );
}