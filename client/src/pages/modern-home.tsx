import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { ModernNavigation } from "@/components/modern-navigation";
import FeatureCards, { QuickStats } from "@/components/feature-cards";
import maintrixLogo from "@assets/ChatGPT Image 19 sept. 2025, 17_52_08_1758301845251.png";

import {
  Brain,
  Factory,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Activity,
  Shield,
  Zap,
  BarChart3,
  Users,
  Settings,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  PlayCircle,
  ArrowRight,

} from "lucide-react";

export default function ModernHome() {

  // Fetch recent alerts for live updates
  const { data: alerts = [] } = useQuery({
    queryKey: ["/api/alerts"],
    refetchInterval: 5000 // Refresh every 5 seconds for live updates
  });

  const activeAlerts = (alerts as any[]).filter((alert: any) => alert.status === 'active').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50/30 to-purple-100/50 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-96 h-96 bg-gradient-to-r from-blue-400/30 to-purple-400/30 rounded-full blur-3xl animate-float"></div>
        <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-gradient-to-r from-purple-400/30 to-pink-400/30 rounded-full blur-3xl animate-float" style={{animationDelay: '3s'}}></div>
      </div>
      
      <ModernNavigation />
      
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Enhanced Hero Section */}
        <div className="text-center mb-20">
          <div className="relative inline-block mb-12">
            {/* Logo Maintrix */}
            <div className="flex justify-center mb-8">
              <img 
                src={maintrixLogo} 
                alt="Maintrix Logo" 
                className="h-24 sm:h-32 lg:h-40 w-auto animate-float hover:scale-105 transition-transform duration-300"
              />
            </div>
            
            {/* Main title with enhanced animations */}
            <h1 className="text-6xl sm:text-8xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-tight animate-float">
              Maintrix
            </h1>
            
            {/* Enhanced badge with glassmorphism */}
            <div className="absolute -top-6 right-0 sm:-right-8 lg:-right-12">
              <div className="inline-flex items-center px-4 py-2 sm:px-5 sm:py-2.5 md:px-6 md:py-3 rounded-2xl text-sm md:text-base font-semibold bg-white/20 backdrop-blur-md border border-white/30 text-gray-700 shadow-2xl animate-pulse hover:animate-bounce transition-all duration-300">
                ✨ Interface Unifiée
              </div>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute -top-8 -left-8 w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-ping"></div>
            <div className="absolute -bottom-4 -right-4 w-3 h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-ping" style={{animationDelay: '1s'}}></div>
          </div>
          
          <p className="text-xl sm:text-3xl text-gray-700 max-w-5xl mx-auto mb-12 leading-relaxed font-light">
            <span className="font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Plateforme Multi-Tenant</span> avec architecture modulaire : 
            <br className="hidden sm:block" />
            Gestion centralisée et modules intelligents pour la maintenance industrielle de nouvelle génération
          </p>
          
          {/* Enhanced feature badges */}
          <div className="flex justify-center items-center flex-wrap gap-4 mb-16">
            <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 text-sm rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 backdrop-blur-sm border border-white/20">
              ✅ Super-Admin Interface
            </Badge>
            <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 text-sm rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 backdrop-blur-sm border border-white/20">
              🔐 Gestion Identifiants
            </Badge>
            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 text-sm rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 backdrop-blur-sm border border-white/20">
              📧 Notifications Email
            </Badge>
            <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 text-sm rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 backdrop-blur-sm border border-white/20">
              🏢 Multi-Tenant SaaS
            </Badge>
          </div>
          
          {/* Enhanced Modules Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto mb-16">
            <div className="group bg-white/20 backdrop-blur-lg border border-white/30 rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-105 hover:bg-white/30 card-hover">
              <div className="flex items-center justify-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300">
                  <Settings className="w-10 h-10 text-white" />
                </div>
              </div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent mb-6 text-center">Module GMAO</h3>
              <p className="text-gray-700 leading-relaxed mb-6 text-center text-lg">
                Planification des interventions, gestion des techniciens, ordres de travail et maintenance préventive
              </p>
              <div className="flex flex-wrap gap-3 mb-8 justify-center">
                <Badge variant="secondary" className="text-xs bg-blue-100/80 text-blue-700 px-3 py-1 rounded-full">Multi-tenant</Badge>
                <Badge variant="secondary" className="text-xs bg-indigo-100/80 text-indigo-700 px-3 py-1 rounded-full">Workflow avancé</Badge>
                <Badge variant="secondary" className="text-xs bg-purple-100/80 text-purple-700 px-3 py-1 rounded-full">120 cas réels</Badge>
              </div>
              <div className="mt-8">
                <Button asChild className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl py-3 shadow-lg hover:shadow-xl transition-all duration-300">
                  <Link href="/gmao">
                    <Settings className="w-5 h-5 mr-2" />
                    Accéder au GMAO
                  </Link>
                </Button>
              </div>
            </div>
            
            <div className="group bg-white/20 backdrop-blur-lg border border-white/30 rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-105 hover:bg-white/30 card-hover">
              <div className="flex items-center justify-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300">
                  <Brain className="w-10 h-10 text-white" />
                </div>
              </div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-700 to-pink-700 bg-clip-text text-transparent mb-6 text-center">Module Diagnostic IA</h3>
              <p className="text-gray-700 leading-relaxed mb-6 text-center text-lg">
                Analyse intelligente : symptômes → diagnostic → préconisations → lien vers intervention
              </p>
              <div className="flex flex-wrap gap-3 mb-8 justify-center">
                <Badge variant="secondary" className="text-xs bg-purple-100/80 text-purple-700 px-3 py-1 rounded-full">9 Algorithmes ML</Badge>
                <Badge variant="secondary" className="text-xs bg-pink-100/80 text-pink-700 px-3 py-1 rounded-full">98% précision</Badge>
                <Badge variant="secondary" className="text-xs bg-indigo-100/80 text-indigo-700 px-3 py-1 rounded-full">Ensemble learning</Badge>
              </div>
              <div className="mt-8 space-y-4">
                <Button asChild className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl py-3 shadow-lg hover:shadow-xl transition-all duration-300">
                  <Link href="/diagnostic">
                    <Brain className="w-5 h-5 mr-2" />
                    Diagnostic IA
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full border-purple-300/50 bg-white/10 backdrop-blur-sm text-purple-700 hover:bg-purple-50/50 rounded-xl py-3 transition-all duration-300">
                  <Link href="/voice-diagnostic">
                    <div className="w-4 h-4 mr-2 rounded-full bg-red-500 animate-pulse flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    Assistant Vocal
                  </Link>
                </Button>
              </div>
            </div>
          </div>
          
          {/* Live Status Indicators */}
          <div className="flex justify-center items-center flex-wrap gap-4 mt-12">
            <div className="flex items-center space-x-3 text-base text-gray-700 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full border-2 border-green-200 shadow-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-medium">Multi-tenant actif</span>
            </div>
            <div className="flex items-center space-x-3 text-base text-gray-700 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full border-2 border-blue-200 shadow-lg">
              <Activity className="h-5 w-5 text-blue-500" />
              <span className="font-medium">IoT temps réel</span>
            </div>
            <div className="flex items-center space-x-3 text-base text-gray-700 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full border-2 border-purple-200 shadow-lg">
              <Shield className="h-5 w-5 text-purple-500" />
              <span className="font-medium">Sécurité renforcée</span>
            </div>
            <div className="flex items-center space-x-3 text-base text-gray-700 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full border-2 border-purple-200 shadow-lg">
              <Shield className="h-5 w-5 text-purple-500" />
              <span className="font-medium">98% conformité</span>
            </div>
            {activeAlerts > 0 && (
              <div className="flex items-center space-x-3 text-base text-white bg-gradient-to-r from-red-500 to-orange-500 px-6 py-3 rounded-full shadow-lg animate-pulse">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">{activeAlerts} alertes actives</span>
              </div>
            )}
          </div>

          {/* Lien d'accès administration plateforme (discret) */}
          <div className="flex justify-center mt-8">
            <Link href="/admin-login">
              <button className="text-xs text-gray-400 hover:text-blue-600 transition-colors duration-200 px-3 py-1 rounded-md hover:bg-gray-50">
                Administration Plateforme
              </button>
            </Link>
          </div>
        </div>

        {/* Quick Stats Dashboard */}
        <QuickStats />



        {/* Architecture Enterprise Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium mb-6">
              ✨ Nouvelle Architecture Enterprise
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Plateforme Multi-Tenant SaaS
            </h2>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto mb-8">
              Architecture enterprise avec super-administration, gestion centralisée des utilisateurs et isolation complète des données par tenant
            </p>
            
            {/* Architecture highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-pink-50">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Super-Administration</h3>
                  <p className="text-sm text-gray-600">Interface centralisée pour la gestion des tenants et utilisateurs avec génération automatique d'identifiants sécurisés</p>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Sécurité Renforcée</h3>
                  <p className="text-sm text-gray-600">Isolation des données par tenant, authentification multi-niveaux et identifiants temporaires obligatoires</p>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-indigo-50">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Settings className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Automatisation</h3>
                  <p className="text-sm text-gray-600">Notifications email automatiques, workflow avancés et intégration transparente avec 120 cas industriels réels</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Modules & Fonctionnalités
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Découvrez toutes les capacités de notre plateforme de maintenance intelligente
            </p>
          </div>
          <FeatureCards />
        </div>

        {/* Live Performance Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          <Card className="border-0 shadow-2xl bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl text-blue-900">
                <TrendingUp className="h-6 w-6 mr-3" />
                Performance en Temps Réel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-blue-700 font-medium">Disponibilité Multi-Tenant</span>
                  <span className="text-3xl font-bold text-blue-900">99.9%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-700 font-medium">Cas Industriels Traités</span>
                  <span className="text-3xl font-bold text-blue-900">1,540</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-700 font-medium">Précision IA Ensemble</span>
                  <span className="text-3xl font-bold text-blue-900">98.2%</span>
                </div>
                <Link href="/advanced-reporting">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Voir Analytics Complet
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-2xl bg-gradient-to-br from-purple-50 to-purple-100">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl text-purple-900">
                <Zap className="h-6 w-6 mr-3" />
                Activité Récente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-white/60 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Super-admin: Nouvel utilisateur créé</span>
                  <span className="text-xs text-gray-500 ml-auto">il y a 2min</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-white/60 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm">Email d'identifiants envoyé automatiquement</span>
                  <span className="text-xs text-gray-500 ml-auto">il y a 3min</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-white/60 rounded-lg">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-sm">Diagnostic ML Ensemble - 98% confiance</span>
                  <span className="text-xs text-gray-500 ml-auto">il y a 5min</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-white/60 rounded-lg">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-sm">Alerte pression hydraulique</span>
                  <span className="text-xs text-gray-500 ml-auto">il y a 5min</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-white/60 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm">Maintenance préventive planifiée</span>
                  <span className="text-xs text-gray-500 ml-auto">il y a 8min</span>
                </div>
                <Link href="/iot-gamification">
                  <Button className="w-full bg-purple-600 hover:bg-purple-700 rounded-xl">
                    <Activity className="h-4 w-4 mr-2" />
                    Monitoring IoT Live
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access Section */}
        <div className="text-center">
          <h3 className="text-3xl font-bold text-gray-900 mb-8">Accès Rapide</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/profiles">
              <Button variant="outline" className="h-20 rounded-xl border-2 hover:shadow-lg transform hover:scale-105 transition-all duration-200">
                <div className="text-center">
                  <Users className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                  <span className="text-sm font-medium">Utilisateurs</span>
                </div>
              </Button>
            </Link>
            <Link href="/documentation">
              <Button variant="outline" className="h-20 rounded-xl border-2 hover:shadow-lg transform hover:scale-105 transition-all duration-200">
                <div className="text-center">
                  <Settings className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <span className="text-sm font-medium">Documentation</span>
                </div>
              </Button>
            </Link>
            <Link href="/support-chatbot">
              <Button variant="outline" className="h-20 rounded-xl border-2 hover:shadow-lg transform hover:scale-105 transition-all duration-200">
                <div className="text-center">
                  <Brain className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                  <span className="text-sm font-medium">Assistant IA</span>
                </div>
              </Button>
            </Link>

            <Button variant="outline" disabled className="h-20 rounded-xl border-2 opacity-50">
              <div className="text-center">
                <CheckCircle className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                <span className="text-sm font-medium">Fonctionnalité désactivée</span>
              </div>
            </Button>
          </div>
        </div>
        
      </main>
    </div>
  );
}