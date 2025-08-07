import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  Brain, 
  Activity, 
  BarChart3, 
  Wrench, 
  Cpu, 
  Database, 
  Mic,
  ArrowRight,
  Users,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle
} from "lucide-react";

export default function ModulesOverview() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Architecture Modulaire Smart GMAO DiagFix
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Interface unifiée avec deux modules spécialisés pour une maintenance industrielle optimale
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          
          {/* Module GMAO */}
          <Card className="border-0 shadow-2xl bg-gradient-to-br from-blue-50 to-blue-100 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white pb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-4">
                    <Settings className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl mb-2">Module GMAO</CardTitle>
                    <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                      Planification & Interventions
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-8">
              <div className="space-y-6">
                <p className="text-gray-700 text-lg leading-relaxed">
                  Gestion complète de la maintenance avec planification des interventions, 
                  attribution aux techniciens, et suivi des ordres de travail.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/60 p-4 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600 mb-2" />
                    <h4 className="font-semibold text-blue-900">Techniciens</h4>
                    <p className="text-sm text-gray-600">Gestion équipes</p>
                  </div>
                  <div className="bg-white/60 p-4 rounded-lg">
                    <Clock className="w-6 h-6 text-blue-600 mb-2" />
                    <h4 className="font-semibold text-blue-900">Planification</h4>
                    <p className="text-sm text-gray-600">Ordres de travail</p>
                  </div>
                  <div className="bg-white/60 p-4 rounded-lg">
                    <Cpu className="w-6 h-6 text-blue-600 mb-2" />
                    <h4 className="font-semibold text-blue-900">Équipements</h4>
                    <p className="text-sm text-gray-600">Registre complet</p>
                  </div>
                  <div className="bg-white/60 p-4 rounded-lg">
                    <Database className="w-6 h-6 text-blue-600 mb-2" />
                    <h4 className="font-semibold text-blue-900">Stock</h4>
                    <p className="text-sm text-gray-600">Pièces détachées</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6">
                    <Link href="/gmao">
                      <Settings className="w-5 h-5 mr-2" />
                      Accéder au Module GMAO
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Link>
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/work-orders">
                        <Wrench className="w-4 h-4 mr-1" />
                        Ordres de Travail
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/equipment">
                        <Cpu className="w-4 h-4 mr-1" />
                        Équipements
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Module Diagnostic IA */}
          <Card className="border-0 shadow-2xl bg-gradient-to-br from-purple-50 to-purple-100 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white pb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-4">
                    <Brain className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl mb-2">Module Diagnostic IA</CardTitle>
                    <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                      Intelligence Artificielle
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-8">
              <div className="space-y-6">
                <p className="text-gray-700 text-lg leading-relaxed">
                  Analyse intelligente des symptômes pour générer des diagnostics précis, 
                  des préconisations et créer automatiquement les interventions.
                </p>
                
                <div className="bg-white/60 p-6 rounded-lg border-l-4 border-purple-500">
                  <h4 className="font-semibold text-purple-900 mb-3">Processus de Diagnostic IA</h4>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">1</div>
                      <span>Analyse des symptômes</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">2</div>
                      <span>Diagnostic automatique</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">3</div>
                      <span>Préconisations détaillées</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">4</div>
                      <span>Lien vers intervention GMAO</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Button asChild className="w-full bg-purple-600 hover:bg-purple-700 text-lg py-6">
                    <Link href="/diagnostic">
                      <Brain className="w-5 h-5 mr-2" />
                      Lancer Diagnostic IA
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Link>
                  </Button>
                  
                  <Button asChild variant="outline" className="w-full border-purple-500 text-purple-600 hover:bg-purple-50">
                    <Link href="/voice-diagnostic">
                      <div className="w-5 h-5 mr-2 rounded-full bg-red-500 animate-pulse flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                      Assistant Vocal
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Integration Section */}
        <Card className="border-0 shadow-2xl bg-gradient-to-r from-green-50 to-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center text-2xl text-green-800">
              <TrendingUp className="w-6 h-6 mr-3" />
              Intégration des Modules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold text-green-800 mb-2">Détection Automatique</h3>
                <p className="text-sm text-gray-600">
                  Le module IA détecte les problèmes et alertes en temps réel
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold text-blue-800 mb-2">Diagnostic Intelligent</h3>
                <p className="text-sm text-gray-600">
                  Analyse avancée et recommandations précises
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold text-purple-800 mb-2">Action GMAO</h3>
                <p className="text-sm text-gray-600">
                  Création automatique des ordres de travail
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}