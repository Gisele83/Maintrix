import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { ModernNavigation } from "@/components/modern-navigation";
import FeatureCards, { QuickStats } from "@/components/feature-cards";
import { TrialBanner } from "@/components/trial-banner";

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <ModernNavigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="relative inline-block mb-8">
            <h1 className="text-5xl sm:text-7xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-tight">
              Smart GMAO DiagFix
            </h1>
            <div className="absolute -top-4 right-0 sm:-right-8 lg:-right-12">
              <div className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-xl animate-bounce">
                Interface Unifiée
              </div>
            </div>
          </div>
          
          <p className="text-xl sm:text-2xl text-gray-600 max-w-4xl mx-auto mb-8 leading-relaxed">
            <span className="font-semibold text-blue-600">Plateforme Multi-Tenant</span> avec architecture modulaire : 
            Gestion centralisée et modules intelligents pour la maintenance industrielle
          </p>
          
          {/* Nouvelles fonctionnalités mises en avant */}
          <div className="flex justify-center items-center flex-wrap gap-3 mb-8">
            <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 text-sm">
              ✅ Super-Admin Interface
            </Badge>
            <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 text-sm">
              🔐 Gestion Identifiants
            </Badge>
            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 text-sm">
              📧 Notifications Email
            </Badge>
            <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 text-sm">
              🏢 Multi-Tenant SaaS
            </Badge>
          </div>
          
          {/* Modules Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto mb-12">
            <div className="bg-white/60 backdrop-blur-sm border border-blue-200 rounded-2xl p-8 shadow-xl">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <Settings className="w-8 h-8 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-blue-900 mb-4">Module GMAO</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Planification des interventions, gestion des techniciens, ordres de travail et maintenance préventive
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                <Badge variant="secondary" className="text-xs">Multi-tenant</Badge>
                <Badge variant="secondary" className="text-xs">Workflow avancé</Badge>
                <Badge variant="secondary" className="text-xs">120 cas réels</Badge>
              </div>
              <div className="mt-6">
                <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                  <Link href="/gmao">
                    <Settings className="w-4 h-4 mr-2" />
                    Accéder au GMAO
                  </Link>
                </Button>
              </div>
            </div>
            
            <div className="bg-white/60 backdrop-blur-sm border border-purple-200 rounded-2xl p-8 shadow-xl">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Brain className="w-8 h-8 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-purple-900 mb-4">Module Diagnostic IA</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Analyse intelligente : symptômes → diagnostic → préconisations → lien vers intervention
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                <Badge variant="secondary" className="text-xs">9 Algorithmes ML</Badge>
                <Badge variant="secondary" className="text-xs">98% précision</Badge>
                <Badge variant="secondary" className="text-xs">Ensemble learning</Badge>
              </div>
              <div className="mt-6 space-y-3">
                <Button asChild className="w-full bg-purple-600 hover:bg-purple-700">
                  <Link href="/diagnostic">
                    <Brain className="w-4 h-4 mr-2" />
                    Diagnostic IA
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full border-purple-500 text-purple-600 hover:bg-purple-50">
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
        
        {/* Déplacement de la bannière d'essai en bas de page */}
        <div className="mt-16">
          <TrialBanner />
        </div>
      </main>
    </div>
  );
}