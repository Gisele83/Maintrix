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
    title: "Smart Diagnostic IA",
    description: "Assistant de diagnostic intelligent avec IA avancée et ML ensemble",
    icon: Brain,
    href: "/smart-diagnostic",
    gradient: "from-purple-500 to-pink-500",
    badge: "IA Native",
    features: ["9 algorithmes ML", "120 cas industriels", "Ensemble learning", "Prédictions avancées"],
    stats: "98% précision"
  },
  {
    title: "Smart GMAO",
    description: "Système de gestion de maintenance assistée par ordinateur multi-tenant",
    icon: Settings,
    href: "/gmao",
    gradient: "from-blue-500 to-cyan-500",
    badge: "Enterprise",
    features: ["Multi-tenant", "Workflow avancé", "Maintenance prédictive", "Intégration Excel"],
    stats: "99% conformité"
  },
  {
    title: "IoT & Monitoring",
    description: "Surveillance temps réel des équipements avec capteurs IoT intelligents",
    icon: Zap,
    href: "/iot-gamification",
    gradient: "from-green-500 to-emerald-500",
    badge: "Temps Réel",
    features: ["Capteurs IoT", "Alertes intelligentes", "Prédictions", "Gamification"],
    stats: "24/7 monitoring"
  },
  {
    title: "Reporting Avancé",
    description: "Tableaux de bord exécutifs et analytics de performance avancés",
    icon: BarChart3,
    href: "/advanced-reporting",
    gradient: "from-orange-500 to-red-500",
    badge: "Analytics",
    features: ["KPI temps réel", "Budget tracking", "Export PDF/Excel", "Tendances"],
    stats: "15+ métriques"
  },
  {
    title: "Super-Admin Center",
    description: "Interface d'administration centralisée multi-tenant avec gestion avancée",
    icon: Users,
    href: "/admin-login",
    gradient: "from-red-500 to-pink-500",
    badge: "Enterprise",
    features: ["Gestion tenants", "Identifiants par défaut", "Email automatique", "Monitoring global"],
    stats: "Multi-tenant"
  },
  {
    title: "Gestion & Sécurité",
    description: "Administration utilisateurs et contrôle d'accès sécurisé renforcé",
    icon: Shield,
    href: "/access-management",
    gradient: "from-indigo-500 to-purple-500",
    badge: "Sécurisé",
    features: ["Authentication 2FA", "Audit trail", "Identifiants temporaires", "Contrôle accès"],
    stats: "100% sécurisé"
  },
  {
    title: "Support & Formation",
    description: "Documentation complète et assistant IA pour support technique",
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      {features.map((feature) => {
        const IconComponent = feature.icon;
        return (
          <Card key={feature.title} className="group relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-white/80 backdrop-blur-sm">
            
            {/* Gradient background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
            
            {/* Badge */}
            <div className="absolute top-4 right-4">
              <Badge className={`bg-gradient-to-r ${feature.gradient} text-white border-0 font-medium`}>
                {feature.badge}
              </Badge>
            </div>

            <CardHeader className="pb-4">
              <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg`}>
                  <IconComponent className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-gray-900 group-hover:to-gray-600 transition-all duration-300">
                    {feature.title}
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
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