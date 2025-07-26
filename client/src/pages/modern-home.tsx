import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import ModernNavigation from "@/components/modern-navigation";
import FeatureCards, { QuickStats } from "@/components/feature-cards";
import { TrialBanner } from "@/components/trial-banner";
import { DiagnosticForm } from "@/components/diagnostic-form";
import { DiagnosticResults } from "@/components/diagnostic-results";
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
  ArrowRight
} from "lucide-react";

export default function ModernHome() {
  const [showDiagnosticForm, setShowDiagnosticForm] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState([]);

  // Fetch recent alerts for live updates
  const { data: alerts = [] } = useQuery({
    queryKey: ["/api/alerts"],
    refetchInterval: 5000 // Refresh every 5 seconds for live updates
  });

  const activeAlerts = alerts.filter((alert: any) => alert.status === 'active').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <ModernNavigation />
      <TrialBanner />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="relative inline-block">
            <h1 className="text-5xl sm:text-7xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-tight mb-6">
              Smart GMAO DiagFix
            </h1>
            <div className="absolute -top-4 -right-12">
              <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-xl animate-bounce">
                <Sparkles className="h-4 w-4 mr-2" />
                IA Native
              </div>
            </div>
          </div>
          
          <p className="text-2xl text-gray-600 mt-8 max-w-5xl mx-auto leading-relaxed font-light">
            Plateforme intelligente de maintenance industrielle combinant 
            <span className="font-semibold text-purple-600 mx-2">Smart Diagnostic IA</span> 
            et 
            <span className="font-semibold text-blue-600 mx-2">Smart GMAO</span> 
            complète
          </p>
          
          {/* Quick Action Buttons */}
          <div className="flex flex-col lg:flex-row justify-center items-center space-y-6 lg:space-y-0 lg:space-x-8 mt-12">
            <Button 
              onClick={() => setShowDiagnosticForm(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-10 py-6 rounded-2xl text-xl font-medium shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 min-w-[280px]"
            >
              <Brain className="h-6 w-6 mr-4" />
              Démarrer Diagnostic IA
              <ChevronRight className="h-5 w-5 ml-3" />
            </Button>
            
            <Link href="/gmao">
              <Button 
                variant="outline"
                className="border-3 border-blue-500 text-blue-600 hover:bg-blue-50 px-10 py-6 rounded-2xl text-xl font-medium hover:shadow-xl transform hover:scale-105 transition-all duration-300 min-w-[280px]"
              >
                <Factory className="h-6 w-6 mr-4" />
                Accéder GMAO
                <ExternalLink className="h-5 w-5 ml-3" />
              </Button>
            </Link>
          </div>

          {/* Live Status Indicators */}
          <div className="flex justify-center items-center flex-wrap gap-4 mt-12">
            <div className="flex items-center space-x-3 text-base text-gray-700 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full border-2 border-green-200 shadow-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-medium">Système opérationnel</span>
            </div>
            <div className="flex items-center space-x-3 text-base text-gray-700 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full border-2 border-blue-200 shadow-lg">
              <Activity className="h-5 w-5 text-blue-500" />
              <span className="font-medium">IoT temps réel</span>
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
        </div>

        {/* Quick Stats Dashboard */}
        <QuickStats />

        {/* Diagnostic Form Modal */}
        {showDiagnosticForm && (
          <div className="mb-16">
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200 p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-gray-900 flex items-center">
                  <Brain className="h-8 w-8 text-purple-600 mr-3" />
                  Diagnostic IA Intelligent
                </h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowDiagnosticForm(false)}
                  className="text-gray-500 hover:text-gray-700 rounded-xl"
                >
                  ✕
                </Button>
              </div>
              <DiagnosticForm 
                onResultsChange={setDiagnosticResults}
                className="bg-transparent"
              />
              {diagnosticResults.length > 0 && (
                <div className="mt-8">
                  <DiagnosticResults suggestions={diagnosticResults} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feature Cards Grid */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Fonctionnalités Smart GMAO DiagFix
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
                  <span className="text-blue-700 font-medium">Disponibilité Système</span>
                  <span className="text-3xl font-bold text-blue-900">99.8%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-700 font-medium">Diagnostics Traités</span>
                  <span className="text-3xl font-bold text-blue-900">1,247</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-700 font-medium">Précision IA</span>
                  <span className="text-3xl font-bold text-blue-900">95.2%</span>
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
                  <span className="text-sm">Diagnostic moteur principal - Résolu</span>
                  <span className="text-xs text-gray-500 ml-auto">il y a 2min</span>
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
            <Link href="/pricing">
              <Button variant="outline" className="h-20 rounded-xl border-2 hover:shadow-lg transform hover:scale-105 transition-all duration-200">
                <div className="text-center">
                  <CheckCircle className="h-6 w-6 mx-auto mb-2 text-indigo-600" />
                  <span className="text-sm font-medium">Tarifs</span>
                </div>
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}