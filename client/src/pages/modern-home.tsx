import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { ModernNavigation } from "@/components/modern-navigation";
import FeatureCards, { QuickStats } from "@/components/feature-cards";
import { useAuth } from "@/hooks/useAuth";

import {
  Brain,
  Settings,
  Activity,
  Shield,
  Zap,
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

  const quickModules = [
    { href: "/gmao", icon: ClipboardList, label: "Ordres de travail", sub: `${openOrders} en cours`, color: "blue", bg: "from-blue-500/15 to-blue-600/5", border: "border-blue-500/25" },
    { href: "/equipment-management", icon: Settings, label: "Équipements", sub: `${totalEquipment} enregistrés`, color: "emerald", bg: "from-emerald-500/15 to-emerald-600/5", border: "border-emerald-500/25" },
    { href: "/smart-diagnostic", icon: Brain, label: "Diagnostic IA", sub: "Lancer une analyse", color: "violet", bg: "from-violet-500/15 to-violet-600/5", border: "border-violet-500/25" },
    { href: "/oee", icon: Gauge, label: "OEE", sub: "Efficacité globale", color: "amber", bg: "from-amber-500/15 to-amber-600/5", border: "border-amber-500/25" },
    { href: "/rca", icon: GitBranch, label: "Analyse RCA", sub: "Causes racines", color: "rose", bg: "from-rose-500/15 to-rose-600/5", border: "border-rose-500/25" },
    { href: "/asset-lifecycle", icon: Layers, label: "Actifs", sub: "Cycle de vie", color: "sky", bg: "from-sky-500/15 to-sky-600/5", border: "border-sky-500/25" },
  ];

  const mainModules = [
    {
      href: "/gmao",
      icon: Settings,
      title: "Module GMAO",
      subtitle: "Backbone Opérationnel",
      desc: "Planification des interventions, gestion des techniciens, ordres de travail, maintenance préventive et stocks de pièces détachées.",
      tags: ["Multi-tenant", "Workflow avancé", "120 cas réels"],
      color: "blue",
      cta: "Accéder au GMAO",
    },
    {
      href: "/cognitive-infrastructure",
      icon: Brain,
      title: "Supervision Adaptative",
      subtitle: "Contrôle Industriel Avancé",
      desc: "Architecture 5 modules coopératifs brevetée. Knowledge Graph causal, autonomie graduée 0-5, multi-agent et boucle fermée.",
      tags: ["Causalité", "Multi-Agent", "Niveaux 0-5"],
      color: "violet",
      cta: "Ouvrir la Supervision",
      cta2: { href: "/smart-diagnostic", label: "Diagnostic IA", icon: Cpu },
    },
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
        <QuickStats />

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
                  <div className={`w-10 h-10 bg-${color}-500/15 border border-${color}-500/25 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-5 h-5 text-${color}-600`} />
                  </div>
                  <div className="text-sm font-semibold text-slate-800 leading-tight mb-0.5">{label}</div>
                  <div className="text-xs text-slate-500">{sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Main Module Cards ───────────────────────────── */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-slate-800 mb-5">Modules principaux</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mainModules.map((m) => (
              <div key={m.href} className="group bg-white border border-slate-200/60 rounded-2xl p-7 shadow-sm hover:shadow-md hover:border-slate-300/60 transition-all duration-300">
                <div className="flex items-center gap-4 mb-5">
                  <div className={`w-14 h-14 bg-gradient-to-br from-${m.color}-500 to-${m.color}-600 rounded-xl flex items-center justify-center shadow-lg shadow-${m.color}-500/20 group-hover:scale-105 transition-transform`}>
                    <m.icon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold text-slate-800 group-hover:text-${m.color}-600 transition-colors`}>{m.title}</h3>
                    <p className="text-sm text-slate-500">{m.subtitle}</p>
                  </div>
                </div>
                <p className="text-slate-600 leading-relaxed mb-5 text-sm">{m.desc}</p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {m.tags.map((t) => (
                    <span key={t} className={`text-xs bg-${m.color}-50 text-${m.color}-600 border border-${m.color}-100 px-3 py-1 rounded-full font-medium`}>{t}</span>
                  ))}
                </div>
                <div className="space-y-2">
                  <Button asChild className={`w-full bg-${m.color}-600 hover:bg-${m.color}-700 rounded-xl`}>
                    <Link href={m.href}>
                      <m.icon className="w-4 h-4 mr-2" />
                      {m.cta}
                    </Link>
                  </Button>
                  {m.cta2 && (
                    <Button asChild variant="ghost" className="w-full text-slate-600 hover:bg-slate-50 rounded-xl">
                      <Link href={m.cta2.href}>
                        <m.cta2.icon className="w-4 h-4 mr-2" />
                        {m.cta2.label}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Architecture Cards ──────────────────────────── */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Architecture de Supervision</h2>
              <p className="text-slate-500 text-sm">5 modules coopératifs avec modélisation causale dynamique</p>
            </div>
            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">
              Autonomie Niveau 1
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Brain, title: "Modèle Causal", desc: "Graphe de connaissances, relations pondérées, prédiction cascade", color: "rose", bg: "bg-rose-50" },
              { icon: Zap, title: "Knowledge Graph", desc: "48+ nœuds, 46+ arêtes, raisonnement causal temps réel", color: "sky", bg: "bg-sky-50" },
              { icon: Shield, title: "Autonomie Graduée", desc: "Niveaux 0–5, du monitoring à l'action corrective autonome", color: "violet", bg: "bg-violet-50" },
            ].map(({ icon: Icon, title, desc, color, bg }) => (
              <Card key={title} className="border border-slate-200/60 shadow-sm bg-white hover:shadow-md transition-shadow">
                <CardContent className="p-5 text-center">
                  <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                    <Icon className={`w-5 h-5 text-${color}-600`} />
                  </div>
                  <h3 className="text-base font-semibold text-slate-800 mb-1">{title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </CardContent>
              </Card>
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
                  { label: "Disponibilité Multi-Tenant", value: "99.9%", sub: "SLA garanti" },
                  { label: "Cas Industriels Traités", value: "1 540", sub: "Depuis le démarrage" },
                  { label: "Précision IA Ensemble", value: "98.2%", sub: "Dernière validation" },
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
                {[
                  { dot: "bg-emerald-500", text: "Nouvel utilisateur créé", time: "il y a 2min" },
                  { dot: "bg-blue-500", text: "Email d'identifiants envoyé", time: "il y a 3min" },
                  { dot: "bg-violet-500", text: "Diagnostic ML — 98% confiance", time: "il y a 5min" },
                  { dot: "bg-amber-500", text: "Maintenance préventive planifiée", time: "il y a 8min" },
                  { dot: "bg-rose-500", text: "Alerte capteur vibration résolue", time: "il y a 12min" },
                ].map(({ dot, text, time }, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg hover:bg-slate-100/80 transition-colors">
                    <div className={`w-2 h-2 ${dot} rounded-full flex-shrink-0`} />
                    <span className="text-sm text-slate-700 flex-1">{text}</span>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{time}</span>
                  </div>
                ))}
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
                  className={`h-20 w-full rounded-xl border border-slate-200 hover:border-${color}-200 hover:bg-${color}-50/50 transition-all`}
                >
                  <div className="text-center">
                    <Icon className={`h-5 w-5 mx-auto mb-1.5 text-${color}-600`} />
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
