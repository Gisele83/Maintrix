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
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

const statusConfig: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  healthy: { color: "text-etat-nominal-texte", bg: "bg-etat-nominal-fond border-etat-nominal-filet", icon: CheckCircle, label: "Sain" },
  warning: { color: "text-etat-alerte-texte", bg: "bg-etat-alerte-fond border-etat-alerte-filet", icon: AlertTriangle, label: "Attention" },
  critical: { color: "text-etat-critique-texte", bg: "bg-etat-critique-fond border-etat-critique-filet", icon: XCircle, label: "Critique" },
  offline: { color: "text-ink-mute", bg: "bg-gray-500/10 border-gray-500/30", icon: Minus, label: "Hors ligne" }
};

const trendIcons: Record<string, any> = { improving: TrendingUp, declining: TrendingDown, stable: Minus };
const trendColors: Record<string, string> = { improving: "text-etat-nominal-texte", declining: "text-etat-critique-texte", stable: "text-ink-mute" };

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
      <AppShell filAriane={[{ libelle: "Exploitation" }, { libelle: "Santé des machines" }]} largeur="large">
      <div className="space-y-6">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin w-12 h-12 border-4 border-etat-encours-filet border-t-transparent rounded-full" />
        </div>
      </div>
    </AppShell>
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
    <div className="min-h-screen bg-paper-deep">
      <ModernNavigation />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-paper-deep rounded-none flex items-center justify-center">
            <Heart className="w-6 h-6 text-ink" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">Scoring Santé Machines</h1>
            <p className="text-ink-mute">Indice de santé et évaluation des risques en temps réel</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-paper-deep border-rule md:col-span-1">
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
                  <span className="text-2xl font-bold text-ink">{summary.averageScore}</span>
                  <span className="text-[10px] text-ink-mute">/100</span>
                </div>
              </div>
              <p className="text-xs text-ink-mute">Score moyen</p>
            </CardContent>
          </Card>
          {[
            { icon: CheckCircle, label: "Sain", value: summary.healthy, color: "" },
            { icon: AlertTriangle, label: "Attention", value: summary.warning, color: "" },
            { icon: XCircle, label: "Critique", value: summary.critical, color: "" },
            { icon: Minus, label: "Hors ligne", value: summary.offline, color: "" }
          ].map((stat, i) => (
            <Card key={i} className="bg-paper-deep border-rule">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-paper-deep ${stat.color} flex items-center justify-center shrink-0`}>
                  <stat.icon className="w-5 h-5 text-ink" />
                </div>
                <div>
                  <p className="text-xl font-bold text-ink">{stat.value}</p>
                  <p className="text-xs text-ink-mute">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border border-rule">
            <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
            <TabsTrigger value="equipment">Équipements</TabsTrigger>
            <TabsTrigger value="recommendations">Recommandations IA</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-paper-deep border-rule">
                <CardHeader>
                  <CardTitle className="text-ink text-sm">Répartition par état de santé</CardTitle>
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

              <Card className="bg-paper-deep border-rule">
                <CardHeader>
                  <CardTitle className="text-ink text-sm">Score de santé par équipement</CardTitle>
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
                <Card key={eq.id} className={`bg-paper-deep border ${config.bg} cursor-pointer hover:bg-white transition-colors`}
                  onClick={() => setSelectedEquipment(selectedEquipment?.id === eq.id ? null : eq)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-14 h-14 rounded-none bg-white flex items-center justify-center">
                            <Gauge className={`w-7 h-7 ${config.color}`} />
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-paper-deep flex items-center justify-center`}>
                            <TrendIcon className={`w-3 h-3 ${trendColors[eq.trend]}`} />
                          </div>
                        </div>
                        <div>
                          <p className="text-ink font-medium">{eq.equipmentName}</p>
                          <p className="text-xs text-ink-mute">{eq.equipmentType} · {eq.location || 'N/A'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={`text-xs ${config.color} border-current`}>
                              {config.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs text-ink-mute border-rule">
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
                        <p className="text-xs text-ink-mute mt-1">
                          {eq.recentFailures} panne(s) · {eq.pendingWorkOrders} OT en attente
                        </p>
                      </div>
                    </div>

                    {selectedEquipment?.id === eq.id && eq.recommendations.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-rule space-y-2">
                        <p className="text-xs font-medium text-ink-soft flex items-center gap-1">
                          <Brain className="w-3 h-3 text-signal" /> Recommandations IA
                        </p>
                        {eq.recommendations.map((rec: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 p-2 bg-white rounded-lg">
                            <Zap className={`w-4 h-4 mt-0.5 shrink-0 ${rec.priority === 'critical' ? 'text-etat-critique-texte' : rec.priority === 'high' ? 'text-etat-alerte-texte' : 'text-etat-encours-texte'}`} />
                            <div>
                              <p className="text-xs text-ink">{rec.message}</p>
                              <Badge className="text-[10px] mt-1 bg-paper-deep text-ink-soft">{rec.type}</Badge>
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
            <Card className="bg-paper-deep border-rule">
              <CardHeader>
                <CardTitle className="text-ink flex items-center gap-2">
                  <Brain className="w-5 h-5 text-signal" />
                  Recommandations d'Actions IA
                </CardTitle>
                <CardDescription className="text-ink-mute">
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
                  <div key={rec.key} className={`p-4 rounded-lg border ${rec.priority === 'critical' ? 'bg-red-950/20 border-etat-critique-filet' : rec.priority === 'high' ? 'bg-orange-950/20 border-etat-alerte-filet' : 'bg-white border-rule'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`${rec.priority === 'critical' ? 'bg-etat-critique-fond text-etat-critique-texte' : rec.priority === 'high' ? 'bg-etat-alerte-fond text-etat-alerte-texte' : 'bg-etat-encours-fond text-etat-encours-texte'}`}>
                          {rec.priority}
                        </Badge>
                        <span className="text-sm font-medium text-ink">{rec.equipmentName}</span>
                        <span className="text-xs text-ink-mute">Score: {rec.healthScore}/100</span>
                      </div>
                      <Badge variant="outline" className="text-xs text-ink-mute border-rule">{rec.type}</Badge>
                    </div>
                    <p className="text-sm text-ink-soft">{rec.message}</p>
                  </div>
                ))}
                {equipment.filter((eq: any) => eq.recommendations.length > 0).length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-etat-nominal-texte mx-auto mb-3" />
                    <p className="text-ink font-medium">Tous les équipements sont en bon état</p>
                    <p className="text-sm text-ink-mute">Aucune action recommandée pour le moment</p>
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
