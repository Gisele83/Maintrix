import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { ModernNavigation } from "@/components/modern-navigation";
import FeatureCards from "@/components/feature-cards";
import { useAuth } from "@/hooks/useAuth";
import { ACCENT, type AccentColor } from "@/lib/accent-colors";

import {
  Brain,
  Settings,
  Activity,
  BarChart3,
  Users,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Wrench,
  Cpu,
  Network,
  Clock,
  ClipboardList,
  Package,
  Gauge,
  GitBranch,
  Layers,
  ChevronRight,
  Bell,
  CalendarClock,
  BookOpen,
  MessageSquare,
} from "lucide-react";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

const WORK_ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "créé",
  assigned: "assigné",
  in_progress: "en cours",
  paused: "en pause",
  completed: "terminé",
  cancelled: "annulé",
};

export default function ModernHome() {
  const { user } = useAuth() as any;
  const { data: alerts = [] } = useQuery({ queryKey: ["/api/alerts"], refetchInterval: 5000 });
  const { data: equipment = [] } = useQuery({ queryKey: ["/api/equipment"] });
  const { data: workOrders = [] } = useQuery({ queryKey: ["/api/work-orders"] });
  const { data: licenseStatus } = useQuery({ queryKey: ["/api/license/status"] });

  const activeAlerts = (alerts as any[]).filter((a: any) => a.status === "active").length;
  const criticalAlerts = (alerts as any[]).filter((a: any) => a.severity === "critical" && a.status === "active").length;
  const totalEquipment = (equipment as any[]).length;
  const openOrders = (workOrders as any[]).filter((o: any) => o.status === "open" || o.status === "in_progress").length;
  const license = licenseStatus as any;

  const displayName = user?.firstName ? `${user.firstName}` : user?.username || "Utilisateur";
  const isTrialActive = license?.isTrialActive;
  const trialDays = license?.trialDaysRemaining ?? 0;

  // ── Métriques réelles dérivées des données déjà chargées (pas de chiffres inventés) ──
  const equipmentIdsWithActiveAlerts = new Set(
    (alerts as any[]).filter((a: any) => a.status === "active").map((a: any) => a.equipmentId)
  );
  const healthyEquipmentPct = totalEquipment > 0
    ? Math.round(((totalEquipment - equipmentIdsWithActiveAlerts.size) / totalEquipment) * 100)
    : 100;

  const completedOrders = (workOrders as any[]).filter((o: any) => o.status === "completed").length;
  const pendingValidationOrders = (workOrders as any[]).filter((o: any) =>
    ["pending", "level1_validated"].includes(o.validationStatus)
  ).length;
  const completionRate = (workOrders as any[]).length > 0
    ? Math.round((completedOrders / (workOrders as any[]).length) * 100)
    : 0;

  const quickStats = [
    { label: "Équipements Surveillés", value: String(totalEquipment), icon: Cpu, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Alertes Actives", value: String(activeAlerts), icon: AlertTriangle, color: activeAlerts > 0 ? "text-red-600" : "text-green-600", bg: activeAlerts > 0 ? "bg-red-100" : "bg-green-100" },
    { label: "OT en Cours", value: String(openOrders), icon: Wrench, color: "text-orange-600", bg: "bg-orange-100" },
    { label: "Équipements Sains", value: `${healthyEquipmentPct}%`, icon: TrendingUp, color: "text-green-600", bg: "bg-green-100" },
  ];

  const recentActivity = [
    ...(alerts as any[]).map((a: any) => ({
      id: `alert-${a.id}`,
      text: a.title || a.message || "Alerte équipement",
      time: timeAgo(a.createdAt),
      ts: a.createdAt ? new Date(a.createdAt).getTime() : 0,
      dot: a.severity === "critical" ? "bg-rose-500" : a.severity === "high" ? "bg-amber-500" : "bg-blue-500",
    })),
    ...(workOrders as any[]).map((o: any) => ({
      id: `wo-${o.id}`,
      text: `${o.title || o.orderNumber || "Ordre de travail"} — ${WORK_ORDER_STATUS_LABEL[o.status] || o.status}`,
      time: timeAgo(o.updatedAt || o.createdAt),
      ts: new Date(o.updatedAt || o.createdAt || 0).getTime(),
      dot: o.status === "completed" ? "bg-emerald-500" : o.status === "in_progress" ? "bg-violet-500" : "bg-slate-400",
    })),
  ]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 5);

  const quickModules = [
    { href: "/gmao", icon: ClipboardList, label: "Ordres de travail", sub: `${openOrders} en cours`, color: "blue", bg: "from-blue-500/15 to-blue-600/5", border: "border-blue-500/25" },
    { href: "/equipment-management", icon: Settings, label: "Équipements", sub: `${totalEquipment} enregistrés`, color: "emerald", bg: "from-emerald-500/15 to-emerald-600/5", border: "border-emerald-500/25" },
    { href: "/smart-diagnostic", icon: Brain, label: "Diagnostic IA", sub: "Lancer une analyse", color: "violet", bg: "from-violet-500/15 to-violet-600/5", border: "border-violet-500/25" },
    { href: "/oee", icon: Gauge, label: "OEE", sub: "Efficacité globale", color: "amber", bg: "from-amber-500/15 to-amber-600/5", border: "border-amber-500/25" },
    { href: "/rca", icon: GitBranch, label: "Analyse RCA", sub: "Causes racines", color: "rose", bg: "from-rose-500/15 to-rose-600/5", border: "border-rose-500/25" },
    { href: "/asset-lifecycle", icon: Layers, label: "Actifs", sub: "Cycle de vie", color: "sky", bg: "from-sky-500/15 to-sky-600/5", border: "border-sky-500/25" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/80 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-100/30 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4" />
      </div>

      <ModernNavigation />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Trial Banner ────────────────────────────────── */}
        {isTrialActive && trialDays <= 7 && (
          <div className={`mb-6 rounded-2xl border px-5 py-4 flex items-center justify-between gap-4 ${trialDays <= 3 ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"}`}>
            <div className="flex items-center gap-3">
              <Clock className={`w-5 h-5 ${trialDays <= 3 ? "text-rose-500" : "text-amber-500"}`} />
              <span className={`text-sm font-medium ${trialDays <= 3 ? "text-rose-700" : "text-amber-700"}`}>
                Essai gratuit — {trialDays} jour{trialDays > 1 ? "s" : ""} restant{trialDays > 1 ? "s" : ""}
              </span>
            </div>
            <Link href="/subscription">
              <Button size="sm" className={trialDays <= 3 ? "bg-rose-600 hover:bg-rose-500" : "bg-amber-600 hover:bg-amber-500"}>
                Activer un plan
                <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        )}

        {/* ── Welcome Header ──────────────────────────────── */}
        <div className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-slate-500 text-sm mb-1">{getGreeting()},</p>
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-800">
                {displayName} <span className="wave" role="img" aria-label="wave">👋</span>
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                {new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 rounded-full shadow-sm text-sm text-slate-600">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Système actif
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 rounded-full shadow-sm text-sm text-slate-600">
                <Activity className="w-4 h-4 text-blue-500" />
                IoT temps réel
              </div>
              {activeAlerts > 0 && (
                <div className={`flex items-center gap-1.5 px-3 py-2 rounded-full shadow-sm text-sm border ${criticalAlerts > 0 ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                  <AlertTriangle className="w-4 h-4" />
                  {activeAlerts} alerte{activeAlerts > 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Quick Stats ─────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {quickStats.map((stat) => (
            <Card key={stat.label} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Quick Module Grid ───────────────────────────── */}
        <div className="mb-12 mt-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-slate-800">Accès rapide</h2>
            <Link href="/gmao">
              <button className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                Tout voir <ChevronRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickModules.map(({ href, icon: Icon, label, sub, color, bg, border }) => (
              <Link key={href} href={href}>
                <div className={`group bg-gradient-to-br ${bg} border ${border} rounded-2xl p-4 hover:scale-[1.04] transition-all duration-200 cursor-pointer h-full`}>
                  <div className={`w-10 h-10 ${ACCENT[color as AccentColor].iconTile} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-5 h-5 ${ACCENT[color as AccentColor].icon600}`} />
                  </div>
                  <div className="text-sm font-semibold text-slate-800 leading-tight mb-0.5">{label}</div>
                  <div className="text-xs text-slate-500">{sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Feature Cards ───────────────────────────────── */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Modules & Fonctionnalités</h2>
              <p className="text-slate-500 text-sm">Toutes les capacités du système de supervision</p>
            </div>
          </div>
          <FeatureCards />
        </div>

        {/* ── Live + Activity ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          <Card className="border border-slate-200/60 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg text-slate-800">
                <TrendingUp className="h-5 w-5 mr-2.5 text-blue-600" />
                Performance en Temps Réel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: "Ordres de Travail Terminés", value: String(completedOrders), sub: `sur ${(workOrders as any[]).length} au total` },
                  { label: "Taux de Complétion", value: `${completionRate}%`, sub: "Ordres de travail terminés" },
                  { label: "En Attente de Validation", value: String(pendingValidationOrders), sub: "Workflow de validation" },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                    <div>
                      <div className="text-sm text-slate-700 font-medium">{label}</div>
                      <div className="text-xs text-slate-400">{sub}</div>
                    </div>
                    <span className="text-2xl font-bold text-slate-800">{value}</span>
                  </div>
                ))}
                <Link href="/advanced-reporting">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl mt-2">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Voir Analytics
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/60 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg text-slate-800">
                <Activity className="h-5 w-5 mr-2.5 text-violet-600" />
                Activité Récente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentActivity.length === 0 ? (
                  <div className="text-sm text-slate-400 text-center py-6">Aucune activité récente</div>
                ) : (
                  recentActivity.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg hover:bg-slate-100/80 transition-colors">
                      <div className={`w-2 h-2 ${item.dot} rounded-full flex-shrink-0`} />
                      <span className="text-sm text-slate-700 flex-1 truncate">{item.text}</span>
                      <span className="text-xs text-slate-400 whitespace-nowrap">{item.time}</span>
                    </div>
                  ))
                )}
                <Link href="/iot-gamification">
                  <Button className="w-full bg-violet-600 hover:bg-violet-700 rounded-xl mt-2">
                    <Activity className="h-4 w-4 mr-2" />
                    Monitoring IoT
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Bottom quick access ─────────────────────────── */}
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-5">Outils & Ressources</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: "/profiles", icon: Users, label: "Utilisateurs", color: "blue" },
              { href: "/documentation", icon: BookOpen, label: "Documentation", color: "emerald" },
              { href: "/support-chatbot", icon: MessageSquare, label: "Assistant IA", color: "violet" },
              { href: "/advanced-reporting", icon: BarChart3, label: "Rapports", color: "amber" },
            ].map(({ href, icon: Icon, label, color }) => (
              <Link key={href} href={href}>
                <Button
                  variant="outline"
                  className={`h-20 w-full rounded-xl border border-slate-200 ${ACCENT[color as AccentColor].hoverTile} transition-all`}
                >
                  <div className="text-center">
                    <Icon className={`h-5 w-5 mx-auto mb-1.5 ${ACCENT[color as AccentColor].icon600}`} />
                    <span className="text-sm font-medium text-slate-700">{label}</span>
                  </div>
                </Button>
              </Link>
            ))}
          </div>
        </div>

        {/* Admin link */}
        <div className="flex justify-center mt-10">
          <Link href="/admin-login">
            <button className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-3 py-1">
              Administration Plateforme
            </button>
          </Link>
        </div>

      </main>
    </div>
  );
}
