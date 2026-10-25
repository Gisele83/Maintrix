import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Brain, Activity, Thermometer, Gauge, Zap, AlertTriangle,
  TrendingUp, TrendingDown, Clock, Shield, BarChart2,
  ChevronDown, RefreshCw, Eye, Target, Cpu, Waves, Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModernNavigation } from "@/components/modern-navigation";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell, ScatterChart, Scatter
} from "recharts";
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

// ─── Types ───────────────────────────────────────────────────────────────────
interface PredictiveInsightData {
  equipment: EquipmentInsight[];
  fleetSummary: FleetSummary;
  sensorTrends: SensorTrend[];
  failureProbabilityTimeline: FailureProbPoint[];
  anomalyDistribution: AnomalyBucket[];
  kpiRadar: KpiRadarPoint[];
  maintenanceWindowSuggestions: MaintenanceWindow[];
}

interface EquipmentInsight {
  id: number;
  name: string;
  type: string;
  healthScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  remainingUsefulLife: number | null;
  failureProbability: number;
  anomalyScore: number;
  lastSensorUpdate: string | null;
  topSensor: string | null;
  topSensorValue: number | null;
  topSensorUnit: string | null;
  openWorkOrders: number;
  predictedFailureDate: string | null;
  recommendations: string[];
}

interface FleetSummary {
  total: number;
  healthy: number;
  warning: number;
  critical: number;
  avgHealthScore: number;
  avgRul: number;
  criticalAlerts: number;
  predictedFailuresNext30d: number;
}

interface SensorTrend {
  timestamp: string;
  temperature: number | null;
  vibration: number | null;
  pressure: number | null;
  current: number | null;
}

interface FailureProbPoint {
  day: string;
  probability: number;
  threshold: number;
}

interface AnomalyBucket {
  equipment: string;
  score: number;
  count: number;
}

interface KpiRadarPoint {
  metric: string;
  value: number;
  benchmark: number;
}

interface MaintenanceWindow {
  equipmentId: number;
  equipmentName: string;
  suggestedDate: string;
  urgency: "low" | "medium" | "high" | "critical";
  estimatedDuration: number;
  reason: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const riskColor: Record<string, string> = {
  low: "bg-etat-nominal-fond text-etat-nominal-texte border-etat-nominal-filet",
  medium: "bg-etat-alerte-fond text-etat-alerte-texte border-etat-alerte-filet",
  high: "bg-etat-alerte-fond text-etat-alerte-texte border-etat-alerte-filet",
  critical: "bg-etat-critique-fond text-etat-critique-texte border-etat-critique-filet",
};

const riskBg: Record<string, string> = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

const CHART_COLORS = ["#60a5fa", "#34d399", "#f59e0b", "#a78bfa", "#f87171", "#38bdf8"];

function RiskBadge({ level }: { level: string }) {
  const labels: Record<string, string> = { low: "Faible", medium: "Modéré", high: "Élevé", critical: "Critique" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${riskColor[level] ?? riskColor.low}`}>
      {labels[level] ?? level}
    </span>
  );
}

function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9" fill="none"
            stroke={color} strokeWidth="3"
            strokeDasharray={`${score} ${100 - score}`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-ink">
          {score}
        </span>
      </div>
      <span className="text-xs text-ink-mute">Santé</span>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-rule rounded-lg p-3 text-xs">
      <p className="text-ink-soft font-medium mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="flex gap-2">
          <span>{p.name}:</span>
          <span className="font-bold">{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PredictiveInsights() {
  const [selectedEquipId, setSelectedEquipId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery<PredictiveInsightData>({
    queryKey: ["/api/predictive-insights", selectedEquipId],
    queryFn: () =>
      apiRequest(`/api/predictive-insights${selectedEquipId !== "all" ? `?equipmentId=${selectedEquipId}` : ""}`),
    refetchInterval: 30000,
  });

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("/api/predictive-insights/seed-demo", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/predictive-insights"] });
      refetch();
    },
  });

  const fleet = data?.fleetSummary;
  const equipment = data?.equipment ?? [];

  const criticalEquip = useMemo(() => equipment.filter((e) => e.riskLevel === "critical"), [equipment]);
  const highEquip = useMemo(() => equipment.filter((e) => e.riskLevel === "high"), [equipment]);

  if (isLoading) {
    return (
      <AppShell filAriane={[{ libelle: "Prédictif" }, { libelle: "Analyse prédictive" }]} largeur="large">
      <div className="space-y-6">
        <div className="flex items-center justify-center h-[70vh]">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-etat-encours-filet border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-ink-soft text-lg">Analyse prédictive en cours…</p>
          </div>
        </div>
      </div>
    </AppShell>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-paper-deep">
        <ModernNavigation />
        <div className="flex items-center justify-center h-[70vh]">
          <div className="text-center space-y-4 p-8 rounded-none bg-etat-critique-fond border border-etat-critique-filet">
            <AlertTriangle className="w-12 h-12 text-etat-critique-texte mx-auto" />
            <p className="text-etat-critique-texte text-lg">Impossible de charger les données prédictives</p>
            <Button onClick={() => refetch()} variant="outline" className="border-etat-critique-filet text-etat-critique-texte">
              Réessayer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-deep">
      <ModernNavigation />

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-rule bg-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-none bg-paper-deep border border-rule/20">
              <Brain className="w-6 h-6 text-signal" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink">Analyse Prédictive</h1>
              <p className="text-ink-mute text-sm">Visualisation avancée — maintenance prévisionnelle</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedEquipId} onValueChange={setSelectedEquipId}>
              <SelectTrigger className="w-52 bg-white/5 border-rule text-ink">
                <SelectValue placeholder="Tous les équipements" />
              </SelectTrigger>
              <SelectContent className="bg-white border-rule">
                <SelectItem value="all">Tous les équipements</SelectItem>
                {equipment.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="border-rule/30 text-signal hover:bg-signal-deep/10"
            >
              <Sparkles className={`w-4 h-4 mr-1 ${seedMutation.isPending ? "animate-pulse" : ""}`} />
              {seedMutation.isPending ? "Génération…" : "Données démo"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="border-rule text-ink-soft hover:bg-white"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Fleet KPI cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Score santé moyen", value: `${fleet?.avgHealthScore ?? 0}%`, icon: Shield, color: "/20/20", iconColor: "text-etat-nominal-texte", border: "border-etat-nominal-filet" },
            { label: "Durée de vie restante moy.", value: fleet?.avgRul ? `${fleet.avgRul}j` : "—", icon: Clock, color: "/20/20", iconColor: "text-etat-encours-texte", border: "border-etat-encours-filet" },
            { label: "Alertes critiques", value: fleet?.criticalAlerts ?? 0, icon: AlertTriangle, color: "/20/20", iconColor: "text-etat-critique-texte", border: "border-etat-critique-filet" },
            { label: "Pannes prévues < 30j", value: fleet?.predictedFailuresNext30d ?? 0, icon: Target, color: "/20/20", iconColor: "text-etat-alerte-texte", border: "border-etat-alerte-filet" },
          ].map((kpi, i) => (
            <Card key={i} className={`bg-paper-deep ${kpi.color} border ${kpi.border}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-white/5`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-ink">{kpi.value}</p>
                  <p className="text-xs text-ink-mute">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Fleet health bar ────────────────────────────────────────────── */}
        {fleet && fleet.total > 0 && (
          <Card className="bg-white/5 border border-rule">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-ink-soft">Répartition santé flotte ({fleet.total} équipements)</span>
              </div>
              <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                {fleet.healthy > 0 && (
                  <div style={{ width: `${(fleet.healthy / fleet.total) * 100}%` }} className="bg-etat-nominal-vif transition-all duration-700" title={`Sains: ${fleet.healthy}`} />
                )}
                {fleet.warning > 0 && (
                  <div style={{ width: `${(fleet.warning / fleet.total) * 100}%` }} className="bg-etat-alerte-vif transition-all duration-700" title={`En alerte: ${fleet.warning}`} />
                )}
                {fleet.critical > 0 && (
                  <div style={{ width: `${(fleet.critical / fleet.total) * 100}%` }} className="bg-etat-critique-vif transition-all duration-700 animate-pulse" title={`Critiques: ${fleet.critical}`} />
                )}
              </div>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-etat-nominal-vif inline-block" />Sains ({fleet.healthy})</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-etat-alerte-vif inline-block" />En alerte ({fleet.warning})</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-etat-critique-vif inline-block" />Critiques ({fleet.critical})</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Main tabs ───────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/5 border border-rule p-1 grid grid-cols-4 sm:w-auto sm:inline-flex">
            <TabsTrigger value="overview" className="data-[state=active]:bg-etat-encours-vif data-[state=active]:text-white text-ink-mute text-xs sm:text-sm">
              <Eye className="w-3 h-3 mr-1" />Vue globale
            </TabsTrigger>
            <TabsTrigger value="trends" className="data-[state=active]:bg-etat-encours-vif data-[state=active]:text-white text-ink-mute text-xs sm:text-sm">
              <Waves className="w-3 h-3 mr-1" />Tendances
            </TabsTrigger>
            <TabsTrigger value="risk" className="data-[state=active]:bg-etat-encours-vif data-[state=active]:text-white text-ink-mute text-xs sm:text-sm">
              <AlertTriangle className="w-3 h-3 mr-1" />Risques
            </TabsTrigger>
            <TabsTrigger value="schedule" className="data-[state=active]:bg-etat-encours-vif data-[state=active]:text-white text-ink-mute text-xs sm:text-sm">
              <Target className="w-3 h-3 mr-1" />Planning
            </TabsTrigger>
          </TabsList>

          {/* ── Overview tab ──────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-6 mt-4">

            {/* Equipment cards */}
            {equipment.length === 0 ? (
              <Card className="bg-white/5 border border-rule">
                <CardContent className="p-12 text-center">
                  <Brain className="w-12 h-12 text-ink-mute mx-auto mb-3" />
                  <p className="text-ink-mute">Aucune donnée prédictive disponible.</p>
                  <p className="text-ink-mute text-sm mt-1">Créez des ordres de travail et des équipements pour commencer l'analyse.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {equipment.map((eq) => (
                  <Card key={eq.id} className={`bg-white/5 border transition-all duration-300 hover:bg-white hover:border-rule ${eq.riskLevel === "critical" ? "border-etat-critique-filet shadow-red-500/10" : eq.riskLevel === "high" ? "border-etat-alerte-filet" : "border-rule"}`}>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm font-semibold text-ink truncate">{eq.name}</CardTitle>
                          <CardDescription className="text-xs text-ink-mute truncate">{eq.type}</CardDescription>
                        </div>
                        <RiskBadge level={eq.riskLevel} />
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <HealthGauge score={eq.healthScore} />
                        <div className="flex-1 ml-4 space-y-2">
                          <div>
                            <div className="flex justify-between text-xs text-ink-mute mb-0.5">
                              <span>Probabilité panne</span>
                              <span className={`font-semibold ${eq.failureProbability > 0.6 ? "text-etat-critique-texte" : eq.failureProbability > 0.3 ? "text-etat-alerte-texte" : "text-etat-nominal-texte"}`}>
                                {Math.round(eq.failureProbability * 100)}%
                              </span>
                            </div>
                            <Progress value={eq.failureProbability * 100} className="h-1.5" />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs text-ink-mute mb-0.5">
                              <span>Score anomalie</span>
                              <span className={`font-semibold ${eq.anomalyScore > 0.6 ? "text-etat-critique-texte" : eq.anomalyScore > 0.3 ? "text-etat-alerte-texte" : "text-ink-soft"}`}>
                                {(eq.anomalyScore * 100).toFixed(0)}%
                              </span>
                            </div>
                            <Progress value={eq.anomalyScore * 100} className="h-1.5" />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white/5 rounded-lg p-2">
                          <p className="text-ink-mute">Durée de vie restante</p>
                          <p className="text-ink font-semibold mt-0.5">{eq.remainingUsefulLife != null ? `${eq.remainingUsefulLife} jours` : "—"}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2">
                          <p className="text-ink-mute">OT ouverts</p>
                          <p className={`font-semibold mt-0.5 ${eq.openWorkOrders > 0 ? "text-etat-alerte-texte" : "text-etat-nominal-texte"}`}>{eq.openWorkOrders}</p>
                        </div>
                      </div>

                      {eq.topSensor && (
                        <div className="flex items-center gap-2 bg-white/5 rounded-lg p-2 text-xs">
                          <Activity className="w-3 h-3 text-etat-encours-texte flex-shrink-0" />
                          <span className="text-ink-mute truncate capitalize">{eq.topSensor} :</span>
                          <span className="text-ink font-semibold ml-auto">
                            {eq.topSensorValue?.toFixed(1)} {eq.topSensorUnit}
                          </span>
                        </div>
                      )}

                      {eq.recommendations.length > 0 && (
                        <div className="space-y-1">
                          {eq.recommendations.slice(0, 2).map((rec, i) => (
                            <p key={i} className="text-xs text-ink-mute flex items-start gap-1">
                              <span className="text-etat-encours-texte flex-shrink-0 mt-0.5">▸</span>
                              <span className="line-clamp-1">{rec}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* KPI Radar chart */}
            {data?.kpiRadar && data.kpiRadar.length > 0 && (
              <Card className="bg-white/5 border border-rule">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-ink flex items-center gap-2"><BarChart2 className="w-4 h-4 text-signal" />Radar KPI — Performance vs Benchmark</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={data.kpiRadar}>
                      <PolarGrid stroke="#1e293b" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#475569", fontSize: 9 }} />
                      <Radar name="Valeur actuelle" dataKey="value" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.25} strokeWidth={2} />
                      <Radar name="Benchmark" dataKey="benchmark" stroke="#34d399" fill="#34d399" fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 2" />
                      <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Trends tab ────────────────────────────────────────────────── */}
          <TabsContent value="trends" className="space-y-6 mt-4">
            {data?.sensorTrends && data.sensorTrends.length > 0 ? (
              <>
                <Card className="bg-white/5 border border-rule">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-ink flex items-center gap-2"><Thermometer className="w-4 h-4 text-etat-critique-texte" />Température & Vibration</CardTitle>
                    <CardDescription className="text-xs text-ink-mute">Tendances capteurs sur la période sélectionnée</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={data.sensorTrends}>
                        <defs>
                          <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="vibGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="timestamp" tick={{ fill: "#475569", fontSize: 10 }} tickFormatter={(v) => v.slice(11, 16)} />
                        <YAxis tick={{ fill: "#475569", fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
                        <Area type="monotone" dataKey="temperature" name="Température (°C)" stroke="#f87171" fill="url(#tempGrad)" strokeWidth={2} dot={false} connectNulls />
                        <Area type="monotone" dataKey="vibration" name="Vibration (mm/s)" stroke="#60a5fa" fill="url(#vibGrad)" strokeWidth={2} dot={false} connectNulls />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border border-rule">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-ink flex items-center gap-2"><Gauge className="w-4 h-4 text-etat-nominal-texte" />Pression & Courant électrique</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={data.sensorTrends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="timestamp" tick={{ fill: "#475569", fontSize: 10 }} tickFormatter={(v) => v.slice(11, 16)} />
                        <YAxis tick={{ fill: "#475569", fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
                        <Line type="monotone" dataKey="pressure" name="Pression (bar)" stroke="#34d399" strokeWidth={2} dot={false} connectNulls />
                        <Line type="monotone" dataKey="current" name="Courant (A)" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="bg-white/5 border border-rule">
                <CardContent className="p-12 text-center">
                  <Activity className="w-10 h-10 text-ink-mute mx-auto mb-3" />
                  <p className="text-ink-mute">Aucune donnée capteur disponible.</p>
                  <p className="text-ink-mute text-sm mt-1">Les données IoT simulées alimenteront ces graphiques en temps réel.</p>
                </CardContent>
              </Card>
            )}

            {/* Failure probability timeline */}
            {data?.failureProbabilityTimeline && data.failureProbabilityTimeline.length > 0 && (
              <Card className="bg-white/5 border border-rule">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-ink flex items-center gap-2"><TrendingUp className="w-4 h-4 text-etat-alerte-texte" />Probabilité de panne — Projection 30 jours</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={data.failureProbabilityTimeline}>
                      <defs>
                        <linearGradient id="probGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="day" tick={{ fill: "#475569", fontSize: 10 }} />
                      <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fill: "#475569", fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} formatter={(v: any) => [`${Math.round(v * 100)}%`]} />
                      <ReferenceLine y={0.5} stroke="#ef4444" strokeDasharray="4 2" label={{ value: "Seuil critique 50%", fill: "#ef4444", fontSize: 10 }} />
                      <Area type="monotone" dataKey="probability" name="Probabilité panne" stroke="#f97316" fill="url(#probGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Risk tab ──────────────────────────────────────────────────── */}
          <TabsContent value="risk" className="space-y-6 mt-4">

            {/* Anomaly distribution bar chart */}
            {data?.anomalyDistribution && data.anomalyDistribution.length > 0 ? (
              <Card className="bg-white/5 border border-rule">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-ink flex items-center gap-2"><Cpu className="w-4 h-4 text-etat-encours-texte" />Score d'anomalie par équipement</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.anomalyDistribution} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fill: "#475569", fontSize: 10 }} />
                      <YAxis type="category" dataKey="equipment" tick={{ fill: "#94a3b8", fontSize: 11 }} width={120} />
                      <Tooltip content={<CustomTooltip />} formatter={(v: any) => [`${Math.round(v * 100)}%`]} />
                      <ReferenceLine x={0.5} stroke="#ef4444" strokeDasharray="4 2" />
                      <Bar dataKey="score" name="Score anomalie" radius={[0, 4, 4, 0]}>
                        {data.anomalyDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.score > 0.6 ? "#ef4444" : entry.score > 0.3 ? "#f59e0b" : "#10b981"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white/5 border border-rule">
                <CardContent className="p-12 text-center">
                  <Shield className="w-10 h-10 text-etat-nominal-texte mx-auto mb-3" />
                  <p className="text-etat-nominal-texte font-medium">Aucune anomalie détectée</p>
                  <p className="text-ink-mute text-sm mt-1">Tous les équipements fonctionnent dans les paramètres normaux.</p>
                </CardContent>
              </Card>
            )}

            {/* Critical & high risk equipment list */}
            {(criticalEquip.length > 0 || highEquip.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {criticalEquip.length > 0 && (
                  <Card className="bg-etat-critique-fond border border-etat-critique-filet">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-etat-critique-texte flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 animate-pulse" />
                        Critiques ({criticalEquip.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {criticalEquip.map((eq) => (
                        <div key={eq.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                          <div>
                            <p className="text-sm text-ink font-medium">{eq.name}</p>
                            <p className="text-xs text-ink-mute">{eq.recommendations[0] ?? "Intervention requise"}</p>
                          </div>
                          <span className="text-etat-critique-texte text-xs font-bold">{Math.round(eq.failureProbability * 100)}%</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {highEquip.length > 0 && (
                  <Card className="bg-etat-alerte-fond border border-etat-alerte-filet">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-etat-alerte-texte flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Risque élevé ({highEquip.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {highEquip.map((eq) => (
                        <div key={eq.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                          <div>
                            <p className="text-sm text-ink font-medium">{eq.name}</p>
                            <p className="text-xs text-ink-mute">{eq.recommendations[0] ?? "Surveiller de près"}</p>
                          </div>
                          <span className="text-etat-alerte-texte text-xs font-bold">{Math.round(eq.failureProbability * 100)}%</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Schedule tab ──────────────────────────────────────────────── */}
          <TabsContent value="schedule" className="space-y-4 mt-4">
            {data?.maintenanceWindowSuggestions && data.maintenanceWindowSuggestions.length > 0 ? (
              <div className="space-y-3">
                <p className="text-ink-mute text-sm">Fenêtres de maintenance suggérées par l'analyse prédictive :</p>
                {data.maintenanceWindowSuggestions.map((mw, i) => (
                  <Card key={i} className={`bg-white/5 border ${mw.urgency === "critical" ? "border-etat-critique-filet" : mw.urgency === "high" ? "border-etat-alerte-filet" : "border-rule"}`}>
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-1 self-stretch rounded-full ${mw.urgency === "critical" ? "bg-etat-critique-vif" : mw.urgency === "high" ? "bg-etat-alerte-vif" : mw.urgency === "medium" ? "bg-etat-alerte-vif" : "bg-etat-nominal-vif"}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">{mw.equipmentName}</p>
                          <p className="text-xs text-ink-mute mt-0.5 line-clamp-2">{mw.reason}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0 text-sm">
                        <div className="text-right">
                          <p className="text-xs text-ink-mute">Date suggérée</p>
                          <p className="text-ink font-medium">{new Date(mw.suggestedDate).toLocaleDateString("fr-FR")}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-ink-mute">Durée est.</p>
                          <p className="text-ink font-medium">{mw.estimatedDuration}h</p>
                        </div>
                        <RiskBadge level={mw.urgency} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-white/5 border border-rule">
                <CardContent className="p-12 text-center">
                  <Target className="w-10 h-10 text-ink-mute mx-auto mb-3" />
                  <p className="text-ink-mute">Aucune fenêtre de maintenance suggérée</p>
                  <p className="text-ink-mute text-sm mt-1">L'analyse prédictive génère des suggestions dès que des données suffisantes sont disponibles.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
