import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, AlertTriangle, CheckCircle, Brain, Zap, TrendingUp,
  Shield, Eye, Filter, Search, Activity, Target, Clock,
  ArrowRight, Info, XCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/header";
import { useLanguage } from "@/hooks/use-language";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

const severityConfig: Record<string, { color: string; bg: string; icon: any; gradient: string }> = {
  critical: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", icon: XCircle, gradient: "from-red-500 to-rose-600" },
  high: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", icon: AlertTriangle, gradient: "from-orange-500 to-amber-600" },
  warning: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", icon: Bell, gradient: "from-yellow-500 to-amber-500" },
  info: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30", icon: Info, gradient: "from-blue-500 to-cyan-600" }
};

const typeLabels: Record<string, string> = {
  pattern_detected: "Schéma détecté",
  equipment_state: "État équipement",
  priority_escalation: "Escalade priorité",
  predictive: "Prédictif"
};

const COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6'];

export default function SmartAlerts() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/smart-alerts'],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
        <Header />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  const summary = data?.summary || { total: 0, critical: 0, high: 0, warning: 0, info: 0, patternDetected: 0, predictive: 0 };
  const alerts = data?.alerts || [];

  const filteredAlerts = alerts.filter((alert: any) => {
    const matchesSearch = !searchTerm || alert.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      alert.equipment?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = filterSeverity === "all" || alert.severity === filterSeverity;
    const matchesTab = activeTab === "all" || 
      (activeTab === "critical" && (alert.severity === "critical" || alert.severity === "high")) ||
      (activeTab === "predictive" && alert.type === "predictive") ||
      (activeTab === "patterns" && alert.type === "pattern_detected");
    return matchesSearch && matchesSeverity && matchesTab;
  });

  const pieData = [
    { name: 'Critique', value: summary.critical },
    { name: 'Haute', value: summary.high },
    { name: 'Attention', value: summary.warning },
    { name: 'Info', value: summary.info }
  ].filter(d => d.value > 0);

  const typeData = [
    { name: 'Schémas', count: summary.patternDetected },
    { name: 'Prédictif', count: summary.predictive },
    { name: 'Escalade', count: alerts.filter((a: any) => a.type === 'priority_escalation').length },
    { name: 'État', count: alerts.filter((a: any) => a.type === 'equipment_state').length }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <Header />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Alertes Intelligentes</h1>
            <p className="text-slate-400">Détection de schémas, alertes prédictives et recommandations d'actions IA</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: Bell, label: "Total alertes", value: summary.total, color: "from-slate-500 to-slate-600" },
            { icon: XCircle, label: "Critiques", value: summary.critical, color: "from-red-500 to-rose-600" },
            { icon: AlertTriangle, label: "Hautes", value: summary.high, color: "from-orange-500 to-amber-600" },
            { icon: Brain, label: "Schémas IA", value: summary.patternDetected, color: "from-purple-500 to-violet-600" },
            { icon: TrendingUp, label: "Prédictives", value: summary.predictive, color: "from-cyan-500 to-blue-600" }
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-slate-900/60 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">Par sévérité</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-white/10 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">Par type de détection</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={typeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                  <Bar dataKey="count" name="Alertes" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Rechercher une alerte..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900/50 border-white/10 text-white" />
          </div>
          <div className="flex gap-1">
            {["all", "critical", "high", "warning", "info"].map(sev => (
              <Button key={sev} size="sm" variant={filterSeverity === sev ? "default" : "outline"}
                className={filterSeverity === sev ? "bg-blue-600" : "border-white/10 text-slate-300"}
                onClick={() => setFilterSeverity(sev)}>
                {sev === "all" ? "Tout" : sev === "critical" ? "Critique" : sev === "high" ? "Haute" : sev === "warning" ? "Attention" : "Info"}
              </Button>
            ))}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/50 border border-white/10">
            <TabsTrigger value="all">Toutes ({summary.total})</TabsTrigger>
            <TabsTrigger value="critical">Urgentes ({summary.critical + summary.high})</TabsTrigger>
            <TabsTrigger value="predictive">Prédictives ({summary.predictive})</TabsTrigger>
            <TabsTrigger value="patterns">Schémas IA ({summary.patternDetected})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-3 mt-4">
            {filteredAlerts.map((alert: any) => {
              const config = severityConfig[alert.severity] || severityConfig.info;
              const StatusIcon = config.icon;
              return (
                <Card key={alert.id} className={`bg-slate-900/60 border ${config.bg}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center shrink-0 mt-0.5`}>
                        <StatusIcon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-white font-medium">{alert.title}</p>
                          <Badge className={`text-[10px] ${config.bg}`}>{alert.severity}</Badge>
                          <Badge variant="outline" className="text-[10px] text-slate-400 border-white/10">
                            {typeLabels[alert.type] || alert.type}
                          </Badge>
                          {alert.confidence && (
                            <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-500/30">
                              <Brain className="w-2.5 h-2.5 mr-1" /> {Math.round(alert.confidence * 100)}% confiance
                            </Badge>
                          )}
                        </div>
                        {alert.equipment && (
                          <p className="text-xs text-slate-400 mb-1">Équipement : {alert.equipment}</p>
                        )}
                        <p className="text-sm text-slate-300 mb-2">{alert.message}</p>
                        {alert.recommendation && (
                          <div className="p-2 bg-slate-800/50 rounded-lg border border-white/5">
                            <p className="text-xs text-slate-300 flex items-start gap-1.5">
                              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <span><strong className="text-white">Action recommandée :</strong> {alert.recommendation}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filteredAlerts.length === 0 && (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-white font-medium">Aucune alerte trouvée</p>
                <p className="text-sm text-slate-400">Aucune alerte ne correspond à vos critères de recherche</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
