import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { ModernNavigation } from "@/components/modern-navigation";
import FeatureCards, { QuickStats } from "@/components/feature-cards";

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
} from "lucide-react";

export default function ModernHome() {
  const { data: alerts = [] } = useQuery({
    queryKey: ["/api/alerts"],
    refetchInterval: 5000
  });

  const activeAlerts = (alerts as any[]).filter((alert: any) => alert.status === 'active').length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/80 relative overflow-hidden">
      {/* Soft background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-100/30 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4"></div>
      </div>
      
      <ModernNavigation />
      
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        {/* Hero Section - Clean & Elegant */}
        <div className="text-center mb-20">
          <div className="mb-10">
            {/* Icon instead of logo */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 mb-8">
              <Brain className="w-10 h-10 text-white" />
            </div>
            
            {/* Main title - softer gradient */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-800 leading-tight mb-4">
              Maintrix
            </h1>
            
            <p className="text-lg text-slate-500 font-medium">
              L'Intelligence Cognitive au Service de l'Industrie
            </p>
          </div>
          
          <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed">
            Infrastructure cognitive formelle qui transforme vos machines industrielles en systèmes autonomes capables de percevoir, comprendre, anticiper et agir sur leurs propres défaillances.
          </p>
          
          {/* Feature badges - softer colors */}
          <div className="flex justify-center items-center flex-wrap gap-3 mb-14">
            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 text-sm font-medium rounded-full hover:bg-emerald-100 transition-colors">
              Architecture 6 Couches
            </Badge>
            <Badge className="bg-violet-50 text-violet-700 border border-violet-200 px-4 py-2 text-sm font-medium rounded-full hover:bg-violet-100 transition-colors">
              Multi-Agent IA
            </Badge>
            <Badge className="bg-sky-50 text-sky-700 border border-sky-200 px-4 py-2 text-sm font-medium rounded-full hover:bg-sky-100 transition-colors">
              Knowledge Graph
            </Badge>
            <Badge className="bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2 text-sm font-medium rounded-full hover:bg-amber-100 transition-colors">
              Autonomie Graduée
            </Badge>
          </div>
          
          {/* Module Cards - Clean design */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-14">
            {/* Module GMAO */}
            <div className="group bg-white border border-slate-200/60 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-blue-200/60 transition-all duration-300">
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Settings className="w-8 h-8 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-1">Module GMAO</h3>
              <p className="text-sm text-slate-500 font-medium mb-4">Backbone Opérationnel</p>
              <p className="text-slate-600 leading-relaxed mb-6">
                Planification des interventions, gestion des techniciens, ordres de travail et maintenance préventive
              </p>
              <div className="flex flex-wrap gap-2 mb-6 justify-center">
                <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">Multi-tenant</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">Workflow avancé</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">120 cas réels</span>
              </div>
              <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl py-3 shadow-sm">
                <Link href="/gmao">
                  <Settings className="w-4 h-4 mr-2" />
                  Accéder au GMAO
                </Link>
              </Button>
            </div>
            
            {/* Intelligence Cognitive */}
            <div className="group bg-white border border-slate-200/60 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-violet-200/60 transition-all duration-300">
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-violet-500/20">
                  <Brain className="w-8 h-8 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-4">Intelligence Cognitive</h3>
              <p className="text-slate-600 leading-relaxed mb-6">
                Architecture 6 couches: Perception → Compréhension → Raisonnement → Décision → Action → Apprentissage
              </p>
              <div className="flex flex-wrap gap-2 mb-6 justify-center">
                <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">Knowledge Graph</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">Multi-Agent</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">Autonomie 0-5</span>
              </div>
              <div className="space-y-3">
                <Button asChild className="w-full bg-violet-600 hover:bg-violet-700 rounded-xl py-3 shadow-sm">
                  <Link href="/cognitive-infrastructure">
                    <Brain className="w-4 h-4 mr-2" />
                    Infrastructure Cognitive
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl py-3">
                  <Link href="/diagnostic">
                    <Cpu className="w-4 h-4 mr-2" />
                    Diagnostic IA
                  </Link>
                </Button>
              </div>
            </div>
          </div>
          
          {/* Status Indicators - Subtle */}
          <div className="flex justify-center items-center flex-wrap gap-3 mt-10">
            <div className="flex items-center space-x-2 text-sm text-slate-600 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span>Kernel Cognitif actif</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-slate-600 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
              <Activity className="h-4 w-4 text-blue-500" />
              <span>IoT temps réel</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-slate-600 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
              <Shield className="h-4 w-4 text-violet-500" />
              <span>Autonomie Niveau 1</span>
            </div>
            {activeAlerts > 0 && (
              <div className="flex items-center space-x-2 text-sm text-amber-700 bg-amber-50 px-4 py-2 rounded-full border border-amber-200">
                <AlertTriangle className="h-4 w-4" />
                <span>{activeAlerts} alertes actives</span>
              </div>
            )}
          </div>

          {/* Admin link - discreet */}
          <div className="flex justify-center mt-6">
            <Link href="/admin-login">
              <button className="text-xs text-slate-400 hover:text-slate-600 transition-colors duration-200 px-3 py-1">
                Administration Plateforme
              </button>
            </Link>
          </div>
        </div>

        {/* Quick Stats Dashboard */}
        <QuickStats />

        {/* Architecture Cognitive Industrielle Section */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-200 mb-4">
              Architecture Cognitive Industrielle
            </span>
            <h2 className="text-3xl font-bold text-slate-800 mb-3">
              Architecture Cognitive Industrielle
            </h2>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto">
              6 couches formelles avec Kernel Cognitif orchestrant un système multi-agent distribué
            </p>
          </div>
          
          {/* Architecture highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            <Card className="border border-slate-200/60 shadow-sm bg-white">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-6 h-6 text-rose-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Kernel Cognitif</h3>
                <p className="text-sm text-slate-600">Orchestration multi-agent, policy engine, boucle fermée</p>
              </CardContent>
            </Card>
            
            <Card className="border border-slate-200/60 shadow-sm bg-white">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-6 h-6 text-sky-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Knowledge Graph</h3>
                <p className="text-sm text-slate-600">48+ noeuds, 46+ arêtes, raisonnement causal</p>
              </CardContent>
            </Card>
            
            <Card className="border border-slate-200/60 shadow-sm bg-white">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-6 h-6 text-violet-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Autonomie Graduée</h3>
                <p className="text-sm text-slate-600">Niveaux 0-5, du monitoring à l'autonomie complète</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-800 mb-3">
              Modules & Fonctionnalités
            </h2>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto">
              Découvrez toutes les capacités de l'infrastructure cognitive
            </p>
          </div>
          <FeatureCards />
        </div>

        {/* Live Performance Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-16">
          <Card className="border border-slate-200/60 shadow-sm bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-xl text-slate-800">
                <TrendingUp className="h-5 w-5 mr-3 text-blue-600" />
                Performance en Temps Réel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Disponibilité Multi-Tenant</span>
                  <span className="text-2xl font-bold text-slate-800">99.9%</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Cas Industriels Traités</span>
                  <span className="text-2xl font-bold text-slate-800">1,540</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-600">Précision IA Ensemble</span>
                  <span className="text-2xl font-bold text-slate-800">98.2%</span>
                </div>
                <Link href="/advanced-reporting">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl mt-4">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Voir Analytics
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/60 shadow-sm bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-xl text-slate-800">
                <Activity className="h-5 w-5 mr-3 text-violet-600" />
                Activité Récente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-sm text-slate-700 flex-1">Nouvel utilisateur créé</span>
                  <span className="text-xs text-slate-400">il y a 2min</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-slate-700 flex-1">Email d'identifiants envoyé</span>
                  <span className="text-xs text-slate-400">il y a 3min</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                  <div className="w-2 h-2 bg-violet-500 rounded-full"></div>
                  <span className="text-sm text-slate-700 flex-1">Diagnostic ML - 98% confiance</span>
                  <span className="text-xs text-slate-400">il y a 5min</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  <span className="text-sm text-slate-700 flex-1">Maintenance préventive planifiée</span>
                  <span className="text-xs text-slate-400">il y a 8min</span>
                </div>
                <Link href="/iot-gamification">
                  <Button className="w-full bg-violet-600 hover:bg-violet-700 rounded-xl mt-4">
                    <Activity className="h-4 w-4 mr-2" />
                    Monitoring IoT
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access Section */}
        <div className="text-center">
          <h3 className="text-2xl font-bold text-slate-800 mb-6">Accès Rapide</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/profiles">
              <Button variant="outline" className="h-20 w-full rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 transition-all">
                <div className="text-center">
                  <Users className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">Utilisateurs</span>
                </div>
              </Button>
            </Link>
            <Link href="/documentation">
              <Button variant="outline" className="h-20 w-full rounded-xl border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all">
                <div className="text-center">
                  <Settings className="h-6 w-6 mx-auto mb-2 text-emerald-600" />
                  <span className="text-sm font-medium text-slate-700">Documentation</span>
                </div>
              </Button>
            </Link>
            <Link href="/support-chatbot">
              <Button variant="outline" className="h-20 w-full rounded-xl border border-slate-200 hover:border-violet-200 hover:bg-violet-50/50 transition-all">
                <div className="text-center">
                  <Brain className="h-6 w-6 mx-auto mb-2 text-violet-600" />
                  <span className="text-sm font-medium text-slate-700">Assistant IA</span>
                </div>
              </Button>
            </Link>
            <Button variant="outline" disabled className="h-20 rounded-xl border border-slate-200 opacity-50">
              <div className="text-center">
                <CheckCircle className="h-6 w-6 mx-auto mb-2 text-slate-400" />
                <span className="text-sm font-medium text-slate-500">Bientôt disponible</span>
              </div>
            </Button>
          </div>
        </div>
        
      </main>
    </div>
  );
}
