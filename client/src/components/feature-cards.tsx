import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Settings,
  Brain,
  Zap,
  BarChart3,
  Users,
  HelpCircle,
  ArrowRight,
  Sparkles,
  Shield,
  Database,
  Cpu
} from "lucide-react";

const features = [
  {
    title: "Supervision Adaptative",
    description: "5 modules coopératifs avec modélisation causale dynamique et autonomie graduée",
    icon: Brain,
    href: "/cognitive-infrastructure",
    gradient: "from-purple-500 to-pink-500",
    badge: "Adaptatif",
    features: ["Graphe causal 48+ noeuds", "Multi-Agent IA", "Autonomie graduée 0-5", "3 objectifs coopératifs"],
    stats: "5 modules"
  },
  {
    title: "Diagnostic Hybride",
    description: "Moteur de diagnostic combinant règles expert, similarité historique et IA Claude",
    icon: Cpu,
    href: "/smart-diagnostic",
    gradient: "from-violet-500 to-fuchsia-500",
    badge: "IA + Expert",
    features: ["120+ cas industriels", "Règles expert", "Similarité historique", "Structuration IA"],
    stats: "98% précision"
  },
  {
    title: "GMAO Intégrée",
    description: "Backbone opérationnel : équipements, ordres de travail et maintenance préventive",
    icon: Settings,
    href: "/gmao",
    gradient: "from-blue-500 to-cyan-500",
    badge: "Enterprise",
    features: ["Multi-tenant", "Workflow avancé", "Maintenance préventive", "Pièces détachées"],
    stats: "99% conformité"
  },
  {
    title: "Perception IoT",
    description: "Capteurs intelligents et edge computing pour la perception autonome des machines",
    icon: Zap,
    href: "/iot-gamification",
    gradient: "from-green-500 to-emerald-500",
    badge: "Temps Réel",
    features: ["Capteurs IoT", "Edge Intelligence", "Alertes prédictives", "Monitoring 24/7"],
    stats: "24/7 actif"
  },
  {
    title: "Analytics & Reporting",
    description: "Tableaux de bord adaptatifs et analytics de performance industrielle",
    icon: BarChart3,
    href: "/advanced-reporting",
    gradient: "from-orange-500 to-red-500",
    badge: "Analytics",
    features: ["KPI temps réel", "Budget tracking", "Export PDF/Excel", "Tendances"],
    stats: "15+ métriques"
  },
  {
    title: "Administration & Sécurité",
    description: "Gestion multi-tenant, contrôle d'accès RBAC et audit de sécurité",
    icon: Shield,
    href: "/admin-login",
    gradient: "from-red-500 to-pink-500",
    badge: "Sécurisé",
    features: ["Gestion tenants", "RBAC 7 rôles", "Audit trail", "Contrôle accès"],
    stats: "Multi-tenant"
  },
  {
    title: "Support & Formation",
    description: "Documentation cognitive et assistant IA pour support technique",
    icon: HelpCircle,
    href: "/support-chatbot",
    gradient: "from-teal-500 to-blue-500",
    badge: "24/7",
    features: ["Assistant IA", "Documentation", "Formation", "Import/Export"],
    stats: "Support continu"
  }
];

export default function FeatureCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-4">
      {features.map((feature) => {
        const IconComponent = feature.icon;
        return (
          <div key={feature.title} className="group relative">
            <div className="absolute inset-0 bg-white rounded-2xl -z-10 transition-all duration-300 group-hover:shadow-xl border border-slate-100 group-hover:border-blue-100" />
            <div className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div className={`p-4 rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <IconComponent className="h-7 w-7 text-white" />
                </div>
                <Badge className={`bg-slate-50 text-slate-600 border-slate-200 font-semibold px-3 py-1 rounded-full group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors`}>
                  {feature.badge}
                </Badge>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed font-medium">
                  {feature.description}
                </p>
              </div>

              <div className="space-y-3 mb-8">
                {feature.features.map((feat, index) => (
                  <div key={index} className="flex items-center space-x-3 text-sm font-medium text-slate-600">
                    <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${feature.gradient} opacity-60`} />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Performance</span>
                  <span className={`text-sm font-bold bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>
                    {feature.stats}
                  </span>
                </div>
                <Link href={feature.href}>
                  <Button 
                    variant="ghost"
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold group/btn"
                  >
                    Ouvrir
                    <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
