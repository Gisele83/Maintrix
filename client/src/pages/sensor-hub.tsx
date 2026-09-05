import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wifi, WifiOff, Activity, Thermometer, Gauge, Droplets,
  Zap, RotateCw, AlertTriangle, CheckCircle, Signal,
  Battery, Radio, Database, TrendingUp, RefreshCw, Search
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModernNavigation } from "@/components/modern-navigation";
import { useLanguage } from "@/hooks/use-language";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from "recharts";

const sensorIcons: Record<string, any> = {
  temperature: Thermometer, vibration: Activity, pressure: Gauge,
  humidity: Droplets, current: Zap, rpm: RotateCw
};

const sensorColors: Record<string, string> = {
  temperature: "from-red-500 to-orange-500",
  vibration: "from-blue-500 to-cyan-500",
  pressure: "from-green-500 to-emerald-500",
  humidity: "from-teal-500 to-cyan-500",
  current: "from-yellow-500 to-amber-500",
  rpm: "from-purple-500 to-violet-500"
};

const sensorLabels: Record<string, string> = {
  temperature: "Température",
  vibration: "Vibration",
  pressure: "Pression",
  humidity: "Humidité",
  current: "Courant",
  rpm: "Vitesse de rotation"
};

export default function SensorHub() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState("live");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSensor, setSelectedSensor] = useState<any>(null);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ['/api/sensor-hub'],
    refetchInterval: 15000
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
        <ModernNavigation />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  const summary = data?.summary || { totalSensors: 0, online: 0, offline: 0, alarming: 0, protocols: [] };
  const sensors = data?.sensors || [];

  const filteredSensors = sensors.filter((s: any) =>
    !searchTerm || s.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.sensorType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sensorTypeStats = Object.entries(
    sensors.reduce((acc: Record<string, { count: number; alarming: number }>, s: any) => {
      if (!acc[s.sensorType]) acc[s.sensorType] = { count: 0, alarming: 0 };
      acc[s.sensorType].count++;
      if (s.isAlarm) acc[s.sensorType].alarming++;
      return acc;
    }, {})
  ).map(([type, stats]: [string, any]) => ({
    type, label: sensorLabels[type] || type, ...stats
  }));

  const generateHistoricalData = (sensor: any) => {
    const data = [];
    for (let i = 24; i >= 0; i--) {
      const variation = (Math.random() - 0.5) * sensor.value * 0.3;
      data.push({
        time: `${i}h`,
        value: Math.round((sensor.value + variation) * 100) / 100,
        threshold: sensor.threshold
      });
    }
    return data;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <ModernNavigation />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Hub Capteurs IoT</h1>
              <p className="text-slate-400">Connexion capteurs, monitoring temps réel et maintenance basée données</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="border-white/20 text-slate-300">
            <RefreshCw className="w-4 h-4 mr-2" /> Rafraîchir
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: Radio, label: "Capteurs", value: summary.totalSensors, color: "from-blue-500 to-cyan-600" },
            { icon: Wifi, label: "En ligne", value: summary.online, color: "from-green-500 to-emerald-600" },
            { icon: WifiOff, label: "Hors ligne", value: summary.offline, color: "from-gray-500 to-slate-600" },
            { icon: AlertTriangle, label: "En alarme", value: summary.alarming, color: "from-red-500 to-rose-600" },
            { icon: Database, label: "Protocoles", value: summary.protocols?.length || 0, color: "from-purple-500 to-violet-600" }
          ].map((stat, i) => (
            <Card key={i} className="bg-slate-900/60 border-white/10">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center shrink-0`}>
                  <stat.icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{stat.value}</p>
                  <p className="text-[10px] text-slate-400">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Rechercher un capteur..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900/50 border-white/10 text-white" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {summary.protocols?.map((proto: string) => (
              <Badge key={proto} variant="outline" className="text-xs text-cyan-400 border-cyan-500/30">{proto}</Badge>
            ))}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/50 border border-white/10">
            <TabsTrigger value="live">Monitoring Live</TabsTrigger>
            <TabsTrigger value="analytics">Analyse Données</TabsTrigger>
            <TabsTrigger value="types">Par Type</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSensors.map((sensor: any) => {
                const SensorIcon = sensorIcons[sensor.sensorType] || Activity;
                const colorGradient = sensorColors[sensor.sensorType] || "from-gray-500 to-slate-600";
                const percentage = Math.min(100, (sensor.value / sensor.threshold) * 100);
                
                return (
                  <Card key={sensor.id} className={`bg-slate-900/60 border ${sensor.isAlarm ? 'border-red-500/30 animate-pulse' : sensor.isOnline ? 'border-white/10' : 'border-gray-600/30 opacity-60'} cursor-pointer hover:bg-slate-800/60 transition-all`}
                    onClick={() => setSelectedSensor(selectedSensor?.id === sensor.id ? null : sensor)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colorGradient} flex items-center justify-center`}>
                            <SensorIcon className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-white">{sensorLabels[sensor.sensorType]}</p>
                            <p className="text-[10px] text-slate-400">{sensor.equipmentName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {sensor.isOnline ? (
                            <Wifi className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <WifiOff className="w-3.5 h-3.5 text-red-400" />
                          )}
                          <Badge variant="outline" className="text-[9px] text-slate-400 border-white/10">{sensor.protocol}</Badge>
                        </div>
                      </div>

                      <div className="text-center mb-3">
                        <p className={`text-2xl font-bold ${sensor.isAlarm ? 'text-red-400' : 'text-white'}`}>
                          {sensor.value} <span className="text-xs text-slate-400">{sensor.unit}</span>
                        </p>
                        <p className="text-[10px] text-slate-500">Seuil: {sensor.threshold} {sensor.unit}</p>
                      </div>

                      <Progress value={Math.min(percentage, 100)} className={`h-1.5 mb-2 ${sensor.isAlarm ? '[&>div]:bg-red-500' : percentage > 80 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'}`} />

                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Battery className="w-3 h-3" /> {sensor.batteryLevel}%
                        </span>
                        <span className="flex items-center gap-1">
                          <Signal className="w-3 h-3" /> {sensor.signalStrength}%
                        </span>
                      </div>

                      {selectedSensor?.id === sensor.id && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <p className="text-xs text-slate-300 mb-2">Historique 24h</p>
                          <ResponsiveContainer width="100%" height={120}>
                            <LineChart data={generateHistoricalData(sensor)}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 8 }} />
                              <YAxis tick={{ fill: '#64748b', fontSize: 8 }} />
                              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: 10 }} />
                              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                              <Line type="monotone" dataKey="threshold" stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card className="bg-slate-900/60 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  Maintenance Basée sur les Données
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Analyse des données capteurs pour optimiser les stratégies de maintenance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { title: "Capteurs en dépassement", value: summary.alarming, total: summary.totalSensors, color: "text-red-400", desc: "Nécessitent une intervention" },
                    { title: "Taux de connectivité", value: summary.online, total: summary.totalSensors, color: "text-green-400", desc: "Capteurs transmettant des données" },
                    { title: "Couverture capteurs", value: sensors.length > 0 ? [...new Set(sensors.map((s: any) => s.equipmentId))].length : 0, total: sensors.length > 0 ? [...new Set(sensors.map((s: any) => s.equipmentId))].length : 0, color: "text-blue-400", desc: "Équipements monitorés" }
                  ].map((metric, i) => (
                    <Card key={i} className="bg-slate-800/30 border-white/5">
                      <CardContent className="p-4 text-center">
                        <p className={`text-3xl font-bold ${metric.color}`}>{metric.value}<span className="text-sm text-slate-400">/{metric.total}</span></p>
                        <p className="text-sm text-white mt-1">{metric.title}</p>
                        <p className="text-xs text-slate-500">{metric.desc}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={sensorTypeStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                    <Bar dataKey="count" name="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="alarming" name="En alarme" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="types" className="space-y-4">
            {sensorTypeStats.map((stat: any) => {
              const SensorIcon = sensorIcons[stat.type] || Activity;
              const gradient = sensorColors[stat.type] || "from-gray-500 to-slate-600";
              const typeSensors = sensors.filter((s: any) => s.sensorType === stat.type);
              const avgValue = typeSensors.reduce((sum: number, s: any) => sum + s.value, 0) / (typeSensors.length || 1);
              
              return (
                <Card key={stat.type} className="bg-slate-900/60 border-white/10">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                          <SensorIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{stat.label}</p>
                          <p className="text-xs text-slate-400">{stat.count} capteurs · {stat.alarming} en alarme</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">{Math.round(avgValue * 10) / 10}</p>
                        <p className="text-xs text-slate-400">Moyenne</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {typeSensors.slice(0, 4).map((s: any) => (
                        <div key={s.id} className={`p-2 rounded-lg text-center ${s.isAlarm ? 'bg-red-950/30 border border-red-500/20' : 'bg-slate-800/30'}`}>
                          <p className="text-xs text-slate-400 truncate">{s.equipmentName}</p>
                          <p className={`text-sm font-bold ${s.isAlarm ? 'text-red-400' : 'text-white'}`}>{s.value} {s.unit}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
