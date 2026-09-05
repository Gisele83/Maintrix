import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, TrendingUp, TrendingDown, Minus, AlertTriangle,
  CheckCircle, XCircle, Heart, Shield, Gauge, Wrench,
  Factory, Zap, ArrowRight, Brain, BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModernNavigation } from "@/components/modern-navigation";
import { useLanguage } from "@/hooks/use-language";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";

const statusConfig: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  healthy: { color: "text-green-400", bg: "bg-green-500/10 border-green-500/30", icon: CheckCircle, label: "Sain" },
  warning: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", icon: AlertTriangle, label: "Attention" },
  critical: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", icon: XCircle, label: "Critique" },
  offline: { color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/30", icon: Minus, label: "Hors ligne" }
};

const trendIcons: Record<string, any> = { improving: TrendingUp, declining: TrendingDown, stable: Minus };
const trendColors: Record<string, string> = { improving: "text-green-400", declining: "text-red-400", stable: "text-slate-400" };

const COLORS = ['#22c55e', '#eab308', '#ef4444', '#6b7280'];

export default function MachineHealth() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/machine-health'],
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

  const summary = data?.summary || { averageScore: 0, healthy: 0, warning: 0, critical: 0, offline: 0, totalEquipment: 0 };
  const equipment = data?.equipment || [];

  const pieData = [
    { name: 'Sain', value: summary.healthy },
    { name: 'Attention', value: summary.warning },
    { name: 'Critique', value: summary.critical },
    { name: 'Hors ligne', value: summary.offline }
  ].filter(d => d.value > 0);

  const scoreDistribution = equipment.map((eq: any) => ({
    name: eq.equipmentName.substring(0, 15),
    score: eq.healthScore,
    fill: eq.healthScore >= 80 ? '#22c55e' : eq.healthScore >= 60 ? '#eab308' : eq.healthScore >= 30 ? '#ef4444' : '#6b7280'
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <ModernNavigation />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
            <Heart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Scoring Santé Machines</h1>
            <p className="text-slate-400">Indice de santé et évaluation des risques en temps réel</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-slate-900/60 border-white/10 md:col-span-1">
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <div className="relative w-24 h-24 mb-2">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="8" />
                  <circle cx="50" cy="50" r="42" fill="none"
                    stroke={summary.averageScore >= 80 ? '#22c55e' : summary.averageScore >= 60 ? '#eab308' : '#ef4444'}
                    strokeWidth="8" strokeDasharray={`${summary.averageScore * 2.64} 264`}
                    strokeLinecap="round" transform="rotate(-90 50 50)" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-white">{summary.averageScore}</span>
                  <span className="text-[10px] text-slate-400">/100</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">Score moyen</p>
            </CardContent>
          </Card>
          {[
            { icon: CheckCircle, label: "Sain", value: summary.healthy, color: "from-green-500 to-emerald-600" },
            { icon: AlertTriangle, label: "Attention", value: summary.warning, color: "from-yellow-500 to-amber-600" },
            { icon: XCircle, label: "Critique", value: summary.critical, color: "from-red-500 to-rose-600" },
            { icon: Minus, label: "Hors ligne", value: summary.offline, color: "from-gray-500 to-slate-600" }
          ].map((stat, i) => (
            <Card key={i} className="bg-slate-900/60 border-white/10">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center shrink-0`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-slate-400">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/50 border border-white/10">
            <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
            <TabsTrigger value="equipment">Équipements</TabsTrigger>
            <TabsTrigger value="recommendations">Recommandations IA</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-900/60 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Répartition par état de santé</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {pieData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Score de santé par équipement</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} angle={-20} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                      <Bar dataKey="score" name="Score" radius={[4, 4, 0, 0]}>
                        {scoreDistribution.map((entry: any, index: number) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="equipment" className="space-y-3">
            {equipment.map((eq: any) => {
              const config = statusConfig[eq.status] || statusConfig.healthy;
              const TrendIcon = trendIcons[eq.trend] || Minus;
              return (
                <Card key={eq.id} className={`bg-slate-900/60 border ${config.bg} cursor-pointer hover:bg-slate-800/60 transition-colors`}
                  onClick={() => setSelectedEquipment(selectedEquipment?.id === eq.id ? null : eq)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-14 h-14 rounded-xl bg-slate-800/50 flex items-center justify-center">
                            <Gauge className={`w-7 h-7 ${config.color}`} />
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center`}>
                            <TrendIcon className={`w-3 h-3 ${trendColors[eq.trend]}`} />
                          </div>
                        </div>
                        <div>
                          <p className="text-white font-medium">{eq.equipmentName}</p>
                          <p className="text-xs text-slate-400">{eq.equipmentType} · {eq.location || 'N/A'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={`text-xs ${config.color} border-current`}>
                              {config.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">
                              Risque: {eq.riskLevel}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <div className="w-24">
                            <Progress value={eq.healthScore} className="h-2" />
                          </div>
                          <span className={`text-2xl font-bold ${config.color}`}>{eq.healthScore}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {eq.recentFailures} panne(s) · {eq.pendingWorkOrders} OT en attente
                        </p>
                      </div>
                    </div>

                    {selectedEquipment?.id === eq.id && eq.recommendations.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                        <p className="text-xs font-medium text-slate-300 flex items-center gap-1">
                          <Brain className="w-3 h-3 text-purple-400" /> Recommandations IA
                        </p>
                        {eq.recommendations.map((rec: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 p-2 bg-slate-800/50 rounded-lg">
                            <Zap className={`w-4 h-4 mt-0.5 shrink-0 ${rec.priority === 'critical' ? 'text-red-400' : rec.priority === 'high' ? 'text-orange-400' : 'text-blue-400'}`} />
                            <div>
                              <p className="text-xs text-white">{rec.message}</p>
                              <Badge className="text-[10px] mt-1 bg-slate-700/50 text-slate-300">{rec.type}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            <Card className="bg-slate-900/60 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  Recommandations d'Actions IA
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Actions recommandées basées sur l'analyse des données de maintenance et le scoring santé
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {equipment.filter((eq: any) => eq.recommendations.length > 0).flatMap((eq: any) =>
                  eq.recommendations.map((rec: any, i: number) => ({
                    ...rec, equipmentName: eq.equipmentName, healthScore: eq.healthScore,
                    equipmentId: eq.id, key: `${eq.id}-${i}`
                  }))
                ).sort((a: any, b: any) => {
                  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
                  return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
                }).map((rec: any) => (
                  <div key={rec.key} className={`p-4 rounded-lg border ${rec.priority === 'critical' ? 'bg-red-950/20 border-red-500/30' : rec.priority === 'high' ? 'bg-orange-950/20 border-orange-500/30' : 'bg-slate-800/30 border-white/10'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`${rec.priority === 'critical' ? 'bg-red-500/20 text-red-400' : rec.priority === 'high' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {rec.priority}
                        </Badge>
                        <span className="text-sm font-medium text-white">{rec.equipmentName}</span>
                        <span className="text-xs text-slate-500">Score: {rec.healthScore}/100</span>
                      </div>
                      <Badge variant="outline" className="text-xs text-slate-400 border-white/10">{rec.type}</Badge>
                    </div>
                    <p className="text-sm text-slate-300">{rec.message}</p>
                  </div>
                ))}
                {equipment.filter((eq: any) => eq.recommendations.length > 0).length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    <p className="text-white font-medium">Tous les équipements sont en bon état</p>
                    <p className="text-sm text-slate-400">Aucune action recommandée pour le moment</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
