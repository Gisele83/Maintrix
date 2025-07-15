import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Wrench, History, Bug } from "lucide-react";
import { Header } from "@/components/header";
import { DiagnosticForm } from "@/components/diagnostic-form";
import { DiagnosticResults } from "@/components/diagnostic-results";
import { RepairGuidance } from "@/components/repair-guidance";
import { MaintenanceHistory } from "@/components/maintenance-history";
import { CaseReporting } from "@/components/case-reporting";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";

type Tab = "diagnostic" | "repair" | "history" | "reporting";

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

  // Submit diagnostic form
  const diagnosticMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/diagnostic", data);
    },
    onSuccess: (response: any) => {
      const result = response.json();
      setDiagnosticResults(result.suggestions || []);
      setIsAnalyzing(false);
      toast({
        title: t("success", language),
        description: "Diagnostic terminé avec succès",
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
  ];

  return (
    <div className="min-h-screen bg-white text-carbon-gray-90">
      <Header />
      
      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-carbon-gray-20 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <Button
                  key={tab.id}
                  variant="ghost"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? "border-carbon-blue text-carbon-blue font-medium"
                      : "border-transparent text-carbon-gray-70 hover:text-carbon-gray-90 hover:border-carbon-gray-20"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Diagnostic Section */}
        {activeTab === "diagnostic" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <DiagnosticForm 
              onSubmit={handleDiagnosticSubmit} 
              isLoading={isAnalyzing}
            />
            <DiagnosticResults
              suggestions={diagnosticResults}
              isLoading={isAnalyzing}
              onStartRepair={handleStartRepair}
              onSaveDiagnostic={handleSaveDiagnostic}
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
                <li>• {t("documentation", language)}</li>
                <li>• {t("training", language)}</li>
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
