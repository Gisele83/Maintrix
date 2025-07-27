import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DiagnosticForm } from "@/components/diagnostic-form";
import { DiagnosticResults } from "@/components/diagnostic-results";
import { useLanguage } from "@/hooks/use-language";
import {
  Brain,
  Search,
  Wrench,
  History,
  Bug,
  Upload,
  Sparkles,
  Activity,
  BarChart3,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  Zap,
  ArrowLeft
} from "lucide-react";
import { Link } from "wouter";

type Tab = "diagnostic" | "repair" | "history" | "reporting" | "import";

interface DiagnosticSuggestion {
  diagnosis: string;
  solution: string;
  confidence: number;
  estimatedDuration: number;
  estimatedCost: string;
  riskLevel: string;
  aiInsights: string;
  equipmentType: string;
  urgency: string;
  caseId?: number;
  difficulty?: string;
}

export default function SmartDiagnostic() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<Tab>("diagnostic");
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticSuggestion[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [cloudSearchPerformed, setCloudSearchPerformed] = useState(false);
  const [cloudInsights, setCloudInsights] = useState("");
  
  // ML Mode states
  const [advancedMode, setAdvancedMode] = useState(false);
  const [enhancedMode, setEnhancedMode] = useState(false);
  const [ensembleMode, setEnsembleMode] = useState(false);

  // Submit diagnostic form with ML
  const diagnosticMutation = useMutation({
    mutationFn: async (data: any) => {
      let endpoint = "/api/diagnostic";
      if (ensembleMode) {
        endpoint = "/api/diagnostic-ensemble-ml";
      } else if (enhancedMode) {
        endpoint = "/api/diagnostic-enhanced-ml";
      } else if (advancedMode) {
        endpoint = "/api/diagnostic-advanced-ml";
      }
      
      console.log("Sending diagnostic data:", data);
      const response = await apiRequest(endpoint, { method: "POST", body: data });
      return response;
    },
    onSuccess: (result: any) => {
      console.log("ML Diagnostic API response:", result);
      setDiagnosticResults(result.suggestions || []);
      setCurrentSessionId(result.sessionId || null);
      setCloudSearchPerformed(result.cloudSearchPerformed || false);
      setCloudInsights(result.cloudInsights || "");
      setIsAnalyzing(false);
      
      const mlType = result.ensembleML ? " (Ensemble ML)" : 
                   result.enhancedML ? " (Enhanced ML)" : 
                   result.advancedML ? " (Advanced ML)" : 
                   result.mlEnabled ? " (ML Enhanced)" : "";
      const cloudNote = result.cloudSearchPerformed ? " + Recherche Cloud" : "";
      
      toast({
        title: "Diagnostic terminé",
        description: `Analyse IA complétée${mlType}${cloudNote} - ${result.suggestions?.length || 0} suggestions trouvées`,
      });
    },
    onError: () => {
      setIsAnalyzing(false);
      toast({
        title: "Erreur",
        description: "Erreur lors du diagnostic. Veuillez réessayer.",
        variant: "destructive"
      });
    },
  });

  const handleDiagnosticSubmit = (data: any) => {
    console.log("Raw form data received:", data);
    setIsAnalyzing(true);
    setDiagnosticResults([]);
    
    const cleanData = typeof data === 'string' ? JSON.parse(data) : data;
    console.log("Clean data to send:", cleanData);
    
    diagnosticMutation.mutate(cleanData);
  };

  const handleStartRepair = (caseId: number) => {
    setSelectedCaseId(caseId);
    setActiveTab("repair");
  };

  const handleSaveDiagnostic = (suggestion: DiagnosticSuggestion) => {
    toast({
      title: "Succès",
      description: "Diagnostic sauvegardé avec succès",
    });
    queryClient.invalidateQueries({ queryKey: ["/api/history"] });
  };

  const tabs = [
    {
      id: "diagnostic" as Tab,
      label: "Diagnostic IA",
      icon: Search,
    },
    {
      id: "repair" as Tab,
      label: "Réparation",
      icon: Wrench,
    },
    {
      id: "history" as Tab,
      label: "Historique",
      icon: History,
    },
    {
      id: "reporting" as Tab,
      label: "Rapports",
      icon: Bug,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-purple-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour Accueil
                </Button>
              </Link>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl blur-lg opacity-50"></div>
                  <div className="relative bg-gradient-to-r from-purple-600 to-pink-600 p-3 rounded-xl">
                    <Brain className="h-8 w-8 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Smart Diagnostic IA
                  </h1>
                  <p className="text-sm text-gray-600">Assistant IA de diagnostic industriel</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Badge variant="outline" className="border-green-300 text-green-700">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                Système actif
              </Badge>
              <Badge variant="outline" className="border-purple-300 text-purple-700">
                <Brain className="h-3 w-3 mr-1" />
                IA Native
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-xl rounded-2xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6 text-center">
              <div className="bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 p-4 rounded-xl mb-4 mx-auto w-fit">
                <Search className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Diagnostic Standard</h3>
              <p className="text-sm text-gray-600">Analyse IA rapide avec Machine Learning</p>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-xl rounded-2xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6 text-center">
              <div className="bg-gradient-to-r from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 p-4 rounded-xl mb-4 mx-auto w-fit">
                <Zap className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Mode Avancé</h3>
              <p className="text-sm text-gray-600">Réseaux de neurones et SVM</p>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-xl rounded-2xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6 text-center">
              <div className="bg-gradient-to-r from-pink-100 to-pink-200 dark:from-pink-900/30 dark:to-pink-800/30 p-4 rounded-xl mb-4 mx-auto w-fit">
                <Sparkles className="h-8 w-8 text-pink-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Ensemble ML</h3>
              <p className="text-sm text-gray-600">Consensus multi-modèles IA</p>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-xl rounded-2xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6 text-center">
              <div className="bg-gradient-to-r from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 p-4 rounded-xl mb-4 mx-auto w-fit">
                <Activity className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Temps Réel</h3>
              <p className="text-sm text-gray-600">Analyse IoT et capteurs</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl rounded-3xl">
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)}>
              <div className="border-b border-gray-200 px-6 pt-6">
                <TabsList className="grid w-full grid-cols-4 bg-gray-100/50 rounded-xl p-1">
                  {tabs.map((tab) => (
                    <TabsTrigger 
                      key={tab.id} 
                      value={tab.id}
                      className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg"
                    >
                      <tab.icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="p-6">
                <TabsContent value="diagnostic" className="mt-0">
                  <div className="space-y-6">
                    {/* ML Mode Selection */}
                    <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg flex items-center">
                          <Brain className="h-5 w-5 mr-2 text-purple-600" />
                          Mode d'Analyse IA
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Button
                            variant={!advancedMode && !enhancedMode && !ensembleMode ? "default" : "outline"}
                            onClick={() => {
                              setAdvancedMode(false);
                              setEnhancedMode(false);
                              setEnsembleMode(false);
                            }}
                            className="h-auto p-4 flex flex-col items-start space-y-2"
                          >
                            <div className="flex items-center space-x-2">
                              <Search className="h-4 w-4" />
                              <span className="font-medium">Standard ML</span>
                            </div>
                            <span className="text-xs text-left opacity-75">
                              Random Forest + Gradient Boosting
                            </span>
                          </Button>

                          <Button
                            variant={advancedMode ? "default" : "outline"}
                            onClick={() => {
                              setAdvancedMode(true);
                              setEnhancedMode(false);
                              setEnsembleMode(false);
                            }}
                            className="h-auto p-4 flex flex-col items-start space-y-2"
                          >
                            <div className="flex items-center space-x-2">
                              <Zap className="h-4 w-4" />
                              <span className="font-medium">Avancé ML</span>
                            </div>
                            <span className="text-xs text-left opacity-75">
                              Neural Networks + SVM
                            </span>
                          </Button>

                          <Button
                            variant={ensembleMode ? "default" : "outline"}
                            onClick={() => {
                              setAdvancedMode(false);
                              setEnhancedMode(false);
                              setEnsembleMode(true);
                            }}
                            className="h-auto p-4 flex flex-col items-start space-y-2"
                          >
                            <div className="flex items-center space-x-2">
                              <Sparkles className="h-4 w-4" />
                              <span className="font-medium">Ensemble ML</span>
                            </div>
                            <span className="text-xs text-left opacity-75">
                              Consensus 9 algorithmes
                            </span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Diagnostic Form */}
                    <DiagnosticForm 
                      onFormSubmit={handleDiagnosticSubmit}
                      isAnalyzing={isAnalyzing}
                    />

                    {/* Results */}
                    {(diagnosticResults.length > 0 || isAnalyzing) && (
                      <div className="space-y-4">
                        {isAnalyzing && (
                          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                            <CardContent className="p-6 text-center">
                              <div className="flex items-center justify-center space-x-3">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                                <div>
                                  <p className="font-medium text-gray-900">Analyse IA en cours...</p>
                                  <p className="text-sm text-gray-600">
                                    {ensembleMode ? "Consensus multi-modèles" : 
                                     advancedMode ? "Réseaux de neurones actifs" : 
                                     "Machine Learning standard"}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {diagnosticResults.length > 0 && (
                          <DiagnosticResults 
                            suggestions={diagnosticResults}
                            onStartRepair={handleStartRepair}
                            onSaveDiagnostic={handleSaveDiagnostic}
                            sessionId={currentSessionId || undefined}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="repair" className="mt-0">
                  <Card className="bg-white/50 border border-gray-200">
                    <CardContent className="p-8 text-center">
                      <Wrench className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Procédures de Réparation
                      </h3>
                      <p className="text-gray-600 mb-6">
                        Guides pas-à-pas pour la réparation d'équipements
                      </p>
                      <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                        <Wrench className="h-4 w-4 mr-2" />
                        Accéder aux procédures
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                  <Card className="bg-white/50 border border-gray-200">
                    <CardContent className="p-8 text-center">
                      <History className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Historique des Diagnostics
                      </h3>
                      <p className="text-gray-600 mb-6">
                        Consultez l'historique complet des analyses IA
                      </p>
                      <Button className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700">
                        <History className="h-4 w-4 mr-2" />
                        Voir l'historique
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="reporting" className="mt-0">
                  <Card className="bg-white/50 border border-gray-200">
                    <CardContent className="p-8 text-center">
                      <Bug className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Rapports Diagnostiques
                      </h3>
                      <p className="text-gray-600 mb-6">
                        Génération automatique de rapports d'analyse et de performance IA
                      </p>
                      <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Générer rapport
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}