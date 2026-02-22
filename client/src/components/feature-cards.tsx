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
  Wrench,
  AlertTriangle,
  TrendingUp,
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-8">
      {features.map((feature) => {
        const IconComponent = feature.icon;
        return (
          <Card key={feature.title} className="group relative overflow-hidden border-0 shadow-2xl hover:shadow-3xl transition-all duration-500 transform hover:-translate-y-4 hover:scale-105 bg-white/10 backdrop-blur-lg card-hover">
            
            {/* Enhanced gradient background with animation */}
            <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-20 transition-all duration-500`} />
            
            {/* Glassmorphism overlay */}
            <div className="absolute inset-0 bg-white/5 backdrop-blur-sm group-hover:bg-white/10 transition-all duration-300" />
            
            {/* Floating particles effect */}
            <div className="absolute top-2 left-2 w-2 h-2 bg-white/30 rounded-full animate-ping opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute bottom-4 right-6 w-1 h-1 bg-white/40 rounded-full animate-pulse opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{animationDelay: '0.5s'}} />
            
            {/* Enhanced Badge */}
            <div className="absolute top-4 right-4 z-10">
              <Badge className={`bg-gradient-to-r ${feature.gradient} text-white border-0 font-semibold px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-sm`}>
                {feature.badge}
              </Badge>
            </div>

            <CardHeader className="pb-4 relative z-10">
              <div className="flex items-center space-x-4">
                <div className={`relative p-4 rounded-2xl bg-gradient-to-br ${feature.gradient} shadow-xl group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300`}>
                  <IconComponent className="h-8 w-8 text-white" />
                  <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl font-bold text-gray-800 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-gray-800 group-hover:to-gray-600 transition-all duration-300">
                    {feature.title}
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              
              {/* Stats */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-600">Performance</span>
                <span className={`font-bold bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>
                  {feature.stats}
                </span>
              </div>

              {/* Features list */}
              <div className="space-y-2">
                {feature.features.map((feat, index) => (
                  <div key={index} className="flex items-center space-x-2 text-sm">
                    <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${feature.gradient}`} />
                    <span className="text-gray-700">{feat}</span>
                  </div>
                ))}
              </div>

              {/* Action button */}
              <Link href={feature.href}>
                <Button 
                  className={`w-full mt-4 bg-gradient-to-r ${feature.gradient} hover:shadow-lg transform hover:scale-105 transition-all duration-200 border-0 font-medium`}
                >
                  <span>Accéder</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                </Button>
              </Link>
            </CardContent>

            {/* Sparkle effect */}
            <div className="absolute top-6 left-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <Sparkles className="h-4 w-4 text-yellow-400 animate-pulse" />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// Quick access stats component
export function QuickStats() {
  const stats = [
    {
      label: "Équipements Surveillés",
      value: "24",
      icon: Cpu,
      color: "text-blue-600",
      bg: "bg-blue-100"
    },
    {
      label: "Alertes Actives",
      value: "7",
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-100"
    },
    {
      label: "OT en Cours",
      value: "12",
      icon: Wrench,
      color: "text-orange-600",
      bg: "bg-orange-100"
    },
    {
      label: "Disponibilité",
      value: "94.7%",
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-100"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, index) => {
        const IconComponent = stat.icon;
        return (
          <Card key={index} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <IconComponent className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}