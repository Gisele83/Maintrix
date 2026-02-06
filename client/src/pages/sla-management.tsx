import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock, AlertTriangle, CheckCircle, XCircle, TrendingUp,
  Shield, Timer, Zap, Bell, ArrowUp, BarChart3, Target
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/header";
import { useLanguage } from "@/hooks/use-language";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, RadialBarChart, RadialBar
} from "recharts";

const complianceColors: Record<string, string> = {
  compliant: "bg-green-500/10 text-green-400 border-green-500/30",
  at_risk: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  breached: "bg-red-500/10 text-red-400 border-red-500/30"
};

const complianceLabels: Record<string, string> = {
  compliant: "Conforme",
  at_risk: "À risque",
  breached: "En dépassement"
};

const COLORS = ['#22c55e', '#eab308', '#ef4444'];

export default function SLAManagement() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState("overview");

  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/sla-management'],
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

  const summary = data?.summary || { complianceRate: 0, compliant: 0, atRisk: 0, breached: 0, total: 0 };
  const pieData = [
    { name: 'Conforme', value: summary.compliant },
    { name: 'À risque', value: summary.atRisk },
    { name: 'En dépassement', value: summary.breached }
  ].filter(d => d.value > 0);

  const rulePerformance = data?.rules?.map((rule: any) => {
    const ruleMetrics = data.metrics?.filter((m: any) => m.slaRule === rule.name) || [];
    const compliant = ruleMetrics.filter((m: any) => m.complianceStatus === 'compliant').length;
    return {
      name: rule.name,
      compliant,
      breached: ruleMetrics.length - compliant,
      total: ruleMetrics.length,
      rate: ruleMetrics.length ? Math.round((compliant / ruleMetrics.length) * 100) : 100
    };
  }) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <Header />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
            <Timer className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">SLA Automatisés</h1>
            <p className="text-slate-400">Suivi en temps réel des engagements de niveau de service</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { icon: Target, label: "Taux de conformité", value: `${summary.complianceRate}%`, color: "from-green-500 to-emerald-600", sub: "SLA respectés" },
            { icon: CheckCircle, label: "Conformes", value: summary.compliant, color: "from-blue-500 to-cyan-600", sub: "Ordres dans les délais" },
            { icon: AlertTriangle, label: "À risque", value: summary.atRisk, color: "from-yellow-500 to-amber-600", sub: "Délai de réponse dépassé" },
            { icon: XCircle, label: "En dépassement", value: summary.breached, color: "from-red-500 to-rose-600", sub: "SLA non respectés" }
          ].map((stat, i) => (
            <Card key={i} className="bg-slate-900/60 border-white/10 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-slate-400">{stat.label}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">{stat.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/50 border border-white/10">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="rules">Règles SLA</TabsTrigger>
            <TabsTrigger value="tracking">Suivi détaillé</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-900/60 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Répartition conformité SLA</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {pieData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Performance par niveau de priorité</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={rulePerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                      <Bar dataKey="compliant" name="Conformes" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="breached" name="Non conformes" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-900/60 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-sm">Jauge de conformité globale</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <div className="relative w-48 h-48">
                  <svg viewBox="0 0 200 200" className="w-full h-full">
                    <circle cx="100" cy="100" r="85" fill="none" stroke="#1e293b" strokeWidth="15" />
                    <circle cx="100" cy="100" r="85" fill="none"
                      stroke={summary.complianceRate >= 80 ? '#22c55e' : summary.complianceRate >= 60 ? '#eab308' : '#ef4444'}
                      strokeWidth="15" strokeDasharray={`${summary.complianceRate * 5.34} 534`}
                      strokeLinecap="round" transform="rotate(-90 100 100)" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white">{summary.complianceRate}%</span>
                    <span className="text-xs text-slate-400">Conformité SLA</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rules" className="space-y-4">
            {data?.rules?.map((rule: any) => (
              <Card key={rule.id} className="bg-slate-900/60 border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${rule.priority === 'critical' ? 'bg-red-500' : rule.priority === 'high' ? 'bg-orange-500' : rule.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                      <div>
                        <p className="text-white font-medium">{rule.name}</p>
                        <p className="text-xs text-slate-400">Priorité : {rule.priority}</p>
                      </div>
                    </div>
                    <Badge className="bg-slate-800 text-slate-300 border-white/10">Automatique</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <Clock className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{rule.responseTime}h</p>
                      <p className="text-xs text-slate-400">Temps de réponse</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <Zap className="w-5 h-5 text-green-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{rule.resolutionTime}h</p>
                      <p className="text-xs text-slate-400">Temps de résolution</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <ArrowUp className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{rule.escalationAfter}h</p>
                      <p className="text-xs text-slate-400">Escalade après</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="tracking" className="space-y-3">
            {data?.metrics?.slice(0, 20).map((metric: any) => (
              <Card key={metric.workOrderId} className={`bg-slate-900/60 border ${metric.complianceStatus === 'breached' ? 'border-red-500/30' : metric.complianceStatus === 'at_risk' ? 'border-yellow-500/30' : 'border-white/10'}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-10 rounded-full ${metric.complianceStatus === 'breached' ? 'bg-red-500' : metric.complianceStatus === 'at_risk' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                    <div>
                      <p className="text-sm font-medium text-white">{metric.title}</p>
                      <p className="text-xs text-slate-400">
                        OT #{metric.workOrderId} · {metric.slaRule} · {metric.hoursElapsed}h écoulées
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {metric.needsEscalation && (
                      <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/30">
                        <ArrowUp className="w-3 h-3 mr-1" /> Escalade
                      </Badge>
                    )}
                    <Badge className={complianceColors[metric.complianceStatus]}>
                      {complianceLabels[metric.complianceStatus]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
