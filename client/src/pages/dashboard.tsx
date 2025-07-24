import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Wrench, History, Bug, Brain, GitBranch, Loader2, Users, Upload, Shield, Factory, ExternalLink, Activity } from "lucide-react";
import { Link } from "wouter";
import { Header } from "@/components/header";
import { DiagnosticForm } from "@/components/diagnostic-form";
import { DiagnosticResults } from "@/components/diagnostic-results";
import { RepairGuidance } from "@/components/repair-guidance";
import { MaintenanceHistory } from "@/components/maintenance-history";
import { CaseReporting } from "@/components/case-reporting";
import { DataImport } from "@/components/data-import";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";

type Tab = "diagnostic" | "repair" | "history" | "reporting" | "import";

interface DiagnosticSuggestion {
  diagnosis: string;
  solution: string;
  confidence: number;
  matchingCases: number;
  caseId: number;
  duration?: number;
  riskLevel?: string;
  costEstimate?: string;
  aiInsights?: string;
  predictiveTips?: string[];
}

export default function Dashboard() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<Tab>("diagnostic");
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [enhancedMode, setEnhancedMode] = useState(false);
  const [ensembleMode, setEnsembleMode] = useState(false);
  const [cloudSearchPerformed, setCloudSearchPerformed] = useState(false);
  const [cloudInsights, setCloudInsights] = useState<string>("");

  // Submit diagnostic form with ML
  const diagnosticMutation = useMutation({
    mutationFn: async (data: any) => {
      let endpoint = "/api/diagnostic-ml";
      if (ensembleMode) {
        endpoint = "/api/diagnostic-ensemble-ml";
      } else if (enhancedMode) {
        endpoint = "/api/diagnostic-enhanced-ml";
      } else if (advancedMode) {
        endpoint = "/api/diagnostic-advanced-ml";
      }
      const response = await apiRequest(endpoint, { method: "POST", body: JSON.stringify(data) });
      return await response.json();
    },
    onSuccess: (result: any) => {
      console.log("ML Diagnostic API response:", result);
      console.log("Suggestions:", result.suggestions);
      setDiagnosticResults(result.suggestions || []);
      setCurrentSessionId(result.sessionId || null);
      setCloudSearchPerformed(result.cloudSearchPerformed || false);
      setCloudInsights(result.cloudInsights || "");
      setIsAnalyzing(false);
      const mlType = result.ensembleML ? " (Ensemble ML)" : result.enhancedML ? " (Enhanced ML)" : result.advancedML ? " (Advanced ML)" : result.mlEnabled ? " (ML Enhanced)" : "";
      const cloudNote = result.cloudSearchPerformed ? " + Recherche Cloud" : "";
      toast({
        title: t("success", language),
        description: `Diagnostic terminé${mlType}${cloudNote} - ${result.suggestions?.length || 0} suggestions trouvées`,
      });
    },
    onError: () => {
      setIsAnalyzing(false);
      toast({
        title: t("error", language),
        description: "Erreur lors du diagnostic",
        variant: "destructive",
      });
    },
  });

  // Train ML model mutation
  const trainMLMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/train-ml", { method: "POST" });
      return await response.json();
    },
    onSuccess: (result: any) => {
      toast({
        title: "ML Model Training",
        description: result.message || "Modèle ML entraîné avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Training Error",
        description: "Erreur lors de l'entraînement du modèle ML",
        variant: "destructive",
      });
    },
  });

  // Train Enhanced ML models mutation
  const trainEnhancedMLMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/train-enhanced-ml", { method: "POST" });
      return await response.json();
    },
    onSuccess: (result: any) => {
      toast({
        title: "Enhanced ML Training",
        description: `${result.models_trained?.length || 0} modèles Enhanced ML entraînés avec succès`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Enhanced ML Training Error",
        description: "Erreur lors de l'entraînement Enhanced ML",
        variant: "destructive",
      });
    },
  });

  // Train advanced ML models mutation
  const trainAdvancedMLMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/train-advanced-ml", { method: "POST" });
      return await response.json();
    },
    onSuccess: (result: any) => {
      toast({
        title: "Advanced ML Training",
        description: result.message || "Modèles ML avancés entraînés avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Advanced Training Error",
        description: "Erreur lors de l'entraînement des modèles ML avancés",
        variant: "destructive",
      });
    },
  });

  // Train ensemble ML models mutation
  const trainEnsembleMLMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/train-ensemble-ml", { method: "POST" });
      return await response.json();
    },
    onSuccess: (result: any) => {
      toast({
        title: "Ensemble ML Training",
        description: result.message || "Modèles ML ensemble entraînés avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ensemble Training Error",
        description: "Erreur lors de l'entraînement des modèles ML ensemble",
        variant: "destructive",
      });
    },
  });

  const handleDiagnosticSubmit = (data: any) => {
    setIsAnalyzing(true);
    setDiagnosticResults([]);
    diagnosticMutation.mutate(data);
  };

  const handleStartRepair = (caseId: number) => {
    setSelectedCaseId(caseId);
    setActiveTab("repair");
  };

  const handleSaveDiagnostic = (suggestion: DiagnosticSuggestion) => {
    toast({
      title: t("success", language),
      description: "Diagnostic sauvegardé",
    });
    // Invalidate history to refresh the list
    queryClient.invalidateQueries({ queryKey: ["/api/history"] });
  };

  const tabs = [
    {
      id: "diagnostic" as Tab,
      label: t("diagnostic", language),
      icon: Search,
    },
    {
      id: "repair" as Tab,
      label: t("repair", language),
      icon: Wrench,
    },
    {
      id: "history" as Tab,
      label: t("history", language),
      icon: History,
    },
    {
      id: "reporting" as Tab,
      label: t("reporting", language),
      icon: Bug,
    },
    {
      id: "import" as Tab,
      label: "Importation",
      icon: Upload,
    },
  ];

  const utilityLinks = [
    {
      href: "/pricing",
      label: "Tarifs",
      icon: Shield,
      description: "Formules d'abonnement"
    },
    {
      href: "/secure-validation",
      label: "Validation",
      icon: Factory,
      description: "Système multi-niveaux"
    },
    {
      href: "/gmao",
      label: "GMAO", 
      icon: Factory,
      description: "Dashboard industriel"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <Header />
      
      {/* Modern Hero Section */}
      <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
              <Brain className="w-4 h-4" />
              <span>Assistant de Diagnostic IA</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              SMDiagFix
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Plateforme avancée de diagnostic et maintenance industrielle propulsée par l'intelligence artificielle
            </p>
          </div>
        </div>
      </div>
      
      {/* Modern Navigation Tabs */}
      <nav className="bg-card/80 backdrop-blur-sm border-b sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex space-x-1 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <Button
                    key={tab.id}
                    variant={isActive ? "default" : "ghost"}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-6 py-3 transition-all duration-300 whitespace-nowrap ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </Button>
                );
              })}
            </div>
            
            {/* Navigation Links */}
            <div className="flex items-center space-x-2">
              {utilityLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.href} href={link.href}>
                    <Button variant="outline" className="flex items-center space-x-2 hover:bg-primary/10 hover:border-primary/20">
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{link.label}</span>
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </Button>
                  </Link>
                );
              })}
              <Link href="/learning">
                <Button variant="outline" className="flex items-center space-x-2 hover:bg-green-50 hover:border-green-300 hover:text-green-700">
                  <Brain className="w-4 h-4" />
                  <span className="hidden sm:inline">Apprentissage IA</span>
                </Button>
              </Link>
              <Link href="/iot-gamification">
                <Button variant="outline" className="flex items-center space-x-2 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700">
                  <Activity className="w-4 h-4" />
                  <span className="hidden sm:inline">IoT & Gamification</span>
                </Button>
              </Link>
              <Link href="/profiles">
                <Button variant="outline" className="flex items-center space-x-2 hover:bg-primary/10 hover:border-primary/20">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Profils</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Diagnostic Section */}
        {activeTab === "diagnostic" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-8">
              <Card className="border-0 shadow-xl bg-card/95 backdrop-blur-sm card-hover">
                <CardContent className="p-8">
                  <DiagnosticForm 
                    onSubmit={handleDiagnosticSubmit} 
                    isLoading={isAnalyzing}
                  />
                </CardContent>
              </Card>
              
              {/* Advanced ML Configuration */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 to-primary/10 card-hover">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Brain className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Configuration ML</h3>
                      <p className="text-sm text-muted-foreground">Options avancées d'intelligence artificielle</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium">
                          Mode ML Avancé
                        </label>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={advancedMode}
                        onChange={(e) => {
                          setAdvancedMode(e.target.checked);
                          if (e.target.checked) {
                            setEnhancedMode(false);
                            setEnsembleMode(false);
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                    {advancedMode 
                      ? "Utilise réseaux de neurones, détection d'anomalies et analyse prédictive"
                      : "Mode ML standard avec Random Forest et Gradient Boosting"
                    }
                  </p>
                  
                  {/* Enhanced ML Mode Toggle */}
                  <div className="flex items-center justify-between mb-3 pt-3 border-t">
                    <div className="flex items-center space-x-2">
                      <Brain className="h-5 w-5 text-purple-600" />
                      <label className="text-sm font-medium">
                        Mode Enhanced ML
                      </label>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enhancedMode}
                        onChange={(e) => {
                          setEnhancedMode(e.target.checked);
                          if (e.target.checked) {
                            setAdvancedMode(false);
                            setEnsembleMode(false);
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-carbon-gray-30 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-600/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-carbon-gray-30 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                  <p className="text-xs text-carbon-gray-70 mb-3">
                    {enhancedMode 
                      ? "10 algorithmes ML avec consensus, détection d'anomalies et évaluation de risque"
                      : "Désactivé - Mode Enhanced ML avec 10 modèles indépendants"
                    }
                  </p>

                  {/* Ensemble Mode Toggle */}
                  <div className="flex items-center justify-between mb-3 pt-3 border-t border-carbon-gray-20">
                    <div className="flex items-center space-x-2">
                      <GitBranch className="h-4 w-4 text-carbon-green" />
                      <label className="text-sm font-medium text-carbon-gray-90">
                        Mode ML Ensemble
                      </label>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ensembleMode}
                        onChange={(e) => {
                          setEnsembleMode(e.target.checked);
                          if (e.target.checked) {
                            setAdvancedMode(false);
                            setEnhancedMode(false);
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-carbon-gray-30 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-carbon-green/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-carbon-gray-30 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-carbon-green"></div>
                    </label>
                  </div>
                  <p className="text-xs text-carbon-gray-70 mb-3">
                    {ensembleMode 
                      ? "Combine 9 algorithmes ML (RF, SVM, Neural Networks, etc.) pour une précision maximale"
                      : enhancedMode
                        ? "10 algorithmes ML avec consensus, détection d'anomalies et évaluation de risque"
                        : advancedMode 
                          ? "Utilise réseaux de neurones, détection d'anomalies et analyse prédictive"
                          : "Mode ML standard avec Random Forest et Gradient Boosting"
                    }
                  </p>

                  {/* ML Training Controls */}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      onClick={() => trainMLMutation.mutate()}
                      disabled={trainMLMutation.isPending}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      {trainMLMutation.isPending ? "Entraînement..." : "ML Standard"}
                    </Button>
                    <Button
                      onClick={() => trainAdvancedMLMutation.mutate()}
                      disabled={trainAdvancedMLMutation.isPending}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      {trainAdvancedMLMutation.isPending ? "Entraînement..." : "ML Avancé"}
                    </Button>
                    <Button
                      onClick={() => trainEnhancedMLMutation.mutate()}
                      disabled={trainEnhancedMLMutation.isPending}
                      variant="outline"
                      size="sm"
                      className="text-xs bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                    >
                      {trainEnhancedMLMutation.isPending ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Enhanced...
                        </>
                      ) : (
                        <>
                          <Brain className="w-3 h-3 mr-1" />
                          Enhanced
                        </>
                      )}
                    </Button>
                    {ensembleMode && (
                      <Button
                        onClick={() => trainEnsembleMLMutation.mutate()}
                        disabled={trainEnsembleMLMutation.isPending}
                        variant="outline"
                        size="sm"
                        className="text-xs col-span-3"
                      >
                        {trainEnsembleMLMutation.isPending ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Entraînement Ensemble...
                          </>
                        ) : (
                          <>
                            <GitBranch className="w-3 h-3 mr-1" />
                            Entraîner ML Ensemble
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                </CardContent>
              </Card>
            </div>

            <DiagnosticResults
              suggestions={diagnosticResults}
              isLoading={isAnalyzing}
              onStartRepair={handleStartRepair}
              onSaveDiagnostic={handleSaveDiagnostic}
              sessionId={currentSessionId}
              cloudSearchPerformed={cloudSearchPerformed}
              cloudInsights={cloudInsights}
            />
          </div>
        )}

        {/* Repair Section */}
        {activeTab === "repair" && (
          <div>
            {selectedCaseId ? (
              <RepairGuidance caseId={selectedCaseId} />
            ) : (
              <div className="text-center py-16">
                <Wrench className="text-carbon-gray-50 text-6xl mb-4 mx-auto" />
                <h3 className="text-xl font-semibold text-carbon-gray-90 mb-2">
                  Aucune réparation sélectionnée
                </h3>
                <p className="text-carbon-gray-70 mb-6">
                  Effectuez d'abord un diagnostic pour démarrer une procédure de réparation.
                </p>
                <Button 
                  onClick={() => setActiveTab("diagnostic")}
                  className="bg-carbon-blue text-white hover:bg-blue-700"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Effectuer un diagnostic
                </Button>
              </div>
            )}
          </div>
        )}

        {/* History Section */}
        {activeTab === "history" && <MaintenanceHistory />}

        {/* Reporting Section */}
        {activeTab === "reporting" && <CaseReporting />}

        {/* Data Import Section */}
        {activeTab === "import" && <DataImport />}
      </main>

      {/* Footer */}
      <footer className="bg-carbon-gray-90 text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">{t("appTitle", language)}</h3>
              <p className="text-carbon-gray-50 text-sm">{t("appSubtitle", language)}</p>
            </div>
            <div>
              <h4 className="font-medium mb-3">{t("statistics", language)}</h4>
              <ul className="space-y-2 text-sm text-carbon-gray-50">
                <li>• 1,247 {t("casesDiagnosed", language)}</li>
                <li>• 89% {t("successRate", language)}</li>
                <li>• 45 min {t("averageTime", language)}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">{t("support", language)}</h4>
              <ul className="space-y-2 text-sm text-carbon-gray-50">
                <li>• <Link href="/documentation" className="hover:text-white transition-colors cursor-pointer">{t("documentation", language)}</Link></li>
                <li>• <Link href="/training" className="hover:text-white transition-colors cursor-pointer">{t("training", language)}</Link></li>
                <li>• {t("technicalContact", language)}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">{t("system", language)}</h4>
              <ul className="space-y-2 text-sm text-carbon-gray-50">
                <li>• {t("version", language)} 2.1.0</li>
                <li>• {t("databaseUpdated", language)}</li>
                <li>• Status: ✓ {t("operational", language)}</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-carbon-gray-70 mt-8 pt-6 text-center text-sm text-carbon-gray-50">
            © 2024 {t("appTitle", language)} - {t("copyright", language)}
          </div>
        </div>
      </footer>
    </div>
  );
}
