import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Wrench, History, Bug, Brain, GitBranch, Users, Upload, Shield, Factory, ExternalLink, Activity, Sparkles, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { DiagnosticForm } from "@/components/diagnostic-form";
import { DiagnosticResults, type DiagnosticSuggestion } from "@/components/diagnostic-results";
import { RepairGuidance } from "@/components/repair-guidance";
import { MaintenanceHistory } from "@/components/maintenance-history";
import { CaseReporting } from "@/components/case-reporting";
import { DataImport } from "@/components/data-import";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ModernNavigation from "@/components/modern-navigation";
import FeatureCards from "@/components/feature-cards";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";

type Tab = "diagnostic" | "repair" | "history" | "reporting" | "import";

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

  /**
   * Profondeur d'analyse — un seul réglage, quatre positions.
   *
   * L'écran proposait auparavant trois interrupteurs indépendants nommés
   * « Mode ML Avancé », « Mode Enhanced ML » et « Mode ML Ensemble », qui
   * s'excluaient mutuellement sans le dire, et dont les descriptions
   * énuméraient des algorithmes (Random Forest, SVM, réseaux de neurones).
   * Un responsable maintenance n'a pas à arbitrer entre des noms
   * d'algorithmes : il choisit le temps qu'il accepte d'attendre.
   * Les trois états internes restent inchangés — seul le vocabulaire change.
   */
  const niveauAnalyse = ensembleMode ? 'maximale' : enhancedMode ? 'approfondie' : advancedMode ? 'avancee' : 'standard';
  const choisirNiveau = (niveau: string) => {
    setAdvancedMode(niveau === 'avancee');
    setEnhancedMode(niveau === 'approfondie');
    setEnsembleMode(niveau === 'maximale');
  };

  const NIVEAUX_ANALYSE = [
    {
      id: 'standard',
      nom: 'Standard',
      texte: "Règles de maintenance et cas similaires déjà résolus. Réponse immédiate.",
    },
    {
      id: 'avancee',
      nom: 'Avancée',
      texte: "Ajoute la détection des écarts au comportement habituel de la machine.",
    },
    {
      id: 'approfondie',
      nom: 'Approfondie',
      texte: "Croise plusieurs modèles indépendants et signale leur niveau d'accord.",
    },
    {
      id: 'maximale',
      nom: 'Maximale',
      texte: "La plus complète, et la plus lente. À réserver aux cas qui résistent.",
    },
  ];

  const { data: diagnosticStats } = useQuery<{ totalSessions: number; avgConfidence: number; completionRate: number; mlPredictionRate: number }>({
    queryKey: ["/api/diagnostic-stats"],
  });

  // Submit diagnostic form with ML
  const diagnosticMutation = useMutation({
    mutationFn: async (data: any) => {
      // Use the basic diagnostic endpoint that we know works
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

  const handleDiagnosticSubmit = (data: any) => {
    console.log("Raw form data received:", data);
    console.log("Data type:", typeof data);
    console.log("JSON stringified data:", JSON.stringify(data));
    
    setIsAnalyzing(true);
    setDiagnosticResults([]);
    
    // Ensure data is a plain object, not a string
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
    <div className="min-h-screen bg-paper text-ink font-sans">
      <ModernNavigation />

      {/* En-tête de travail. La version précédente affichait ici une accroche
          commerciale centrée — pastille « Assistant de Diagnostic IA », titre
          « Maintrix » et slogan « propulsée par l'intelligence artificielle » —
          c'est-à-dire de la publicité à l'intérieur de l'outil, à relire à
          chaque connexion. On affiche à la place ce sur quoi la personne
          travaille, et les chiffres réels de son activité. */}
      <header className="border-b border-rule bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="font-mono text-eyebrow uppercase text-ink-mute">Diagnostic</p>
              <h1 className="font-serif text-headline font-medium mt-2">
                Identifier la panne, guider la réparation.
              </h1>
            </div>

            <dl className="flex flex-wrap gap-x-10 gap-y-3">
              <div>
                <dt className="font-mono text-eyebrow uppercase text-ink-mute">Diagnostics</dt>
                <dd className="font-serif text-title mt-1">{diagnosticStats?.totalSessions ?? 0}</dd>
              </div>
              <div>
                <dt className="font-mono text-eyebrow uppercase text-ink-mute">Menés à terme</dt>
                <dd className="font-serif text-title mt-1">
                  {diagnosticStats ? Math.round(diagnosticStats.completionRate) : 0}<span className="text-lg text-ink-mute"> %</span>
                </dd>
              </div>
              <div>
                <dt className="font-mono text-eyebrow uppercase text-ink-mute">Confiance moyenne</dt>
                <dd className="font-serif text-title mt-1">
                  {diagnosticStats ? Math.round(diagnosticStats.avgConfidence * 100) : 0}<span className="text-lg text-ink-mute"> %</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </header>
      {/* Modern Navigation Tabs */}
      <nav className="bg-white border-b border-rule sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex space-x-1 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 h-14 border-b-2 text-sm transition-colors whitespace-nowrap ${
                      isActive
                        ? "border-signal text-ink font-medium"
                        : "border-transparent text-ink-soft hover:text-ink hover:border-rule"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
            
            {/* Navigation Links */}
            <div className="flex items-center space-x-2">
              {utilityLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.href} href={link.href}>
                    <span className="inline-flex items-center gap-2 h-9 px-3 border border-rule text-sm text-ink-soft hover:text-ink hover:border-ink transition-colors">
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{link.label}</span>
                    </span>
                  </Link>
                );
              })}
              {[
                { href: '/learning', label: 'Apprentissage', icon: Brain },
                { href: '/iot-gamification', label: 'Capteurs', icon: Activity },
                { href: '/profiles', label: 'Profils', icon: Users },
                { href: '/data-import-export', label: 'Import / Export', icon: Upload },
              ].map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}>
                  <span className="inline-flex items-center gap-2 h-9 px-3 border border-rule text-sm text-ink-soft hover:text-ink hover:border-ink transition-colors">
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </span>
                </Link>
              ))}            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Diagnostic Section */}
        {activeTab === "diagnostic" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-8">
              <Card className="border border-rule shadow-none bg-white rounded-none">
                <CardContent className="p-8">
                  <DiagnosticForm 
                    onSubmit={handleDiagnosticSubmit} 
                    isLoading={isAnalyzing}
                  />
                </CardContent>
              </Card>
              
              {/* Profondeur d'analyse — un réglage, quatre positions. */}
              <Card className="border border-rule shadow-none bg-white rounded-none">
                <CardContent className="p-6">
                  <p className="font-mono text-eyebrow uppercase text-ink-mute">Profondeur d'analyse</p>
                  <p className="text-sm text-ink-soft mt-2">
                    Plus l'analyse est poussée, plus elle est longue. Le résultat indique toujours
                    d'où vient chaque hypothèse.
                  </p>

                  <div className="mt-5 border-t border-rule">
                    {NIVEAUX_ANALYSE.map((niveau) => {
                      const actif = niveauAnalyse === niveau.id;
                      return (
                        <label
                          key={niveau.id}
                          className={`flex items-start gap-3 border-b border-rule py-3 cursor-pointer transition-colors ${
                            actif ? 'bg-paper' : 'hover:bg-paper'
                          }`}
                        >
                          <input
                            type="radio"
                            name="profondeur-analyse"
                            value={niveau.id}
                            checked={actif}
                            onChange={() => choisirNiveau(niveau.id)}
                            className="mt-1 accent-signal"
                          />
                          <span className="min-w-0">
                            <span className={`block text-sm ${actif ? 'font-medium text-ink' : 'text-ink'}`}>
                              {niveau.nom}
                            </span>
                            <span className="block text-sm text-ink-soft mt-0.5">{niveau.texte}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <DiagnosticResults
              suggestions={diagnosticResults}
              isLoading={isAnalyzing}
              onStartRepair={handleStartRepair}
              onSaveDiagnostic={handleSaveDiagnostic}
              sessionId={currentSessionId || undefined}
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
              <div className="border border-rule bg-white p-10 max-w-xl">
                <Wrench className="w-6 h-6 text-ink-mute" />
                <h2 className="font-serif text-title font-medium mt-4">
                  Aucune réparation en cours
                </h2>
                <p className="text-ink-soft mt-2">
                  Lancez d'abord un diagnostic : la procédure de réparation en découle.
                </p>
                <button
                  onClick={() => setActiveTab("diagnostic")}
                  className="mt-6 inline-flex items-center gap-2 h-11 px-5 bg-ink text-paper text-sm font-medium hover:bg-signal transition-colors"
                >
                  <Search className="w-4 h-4" />
                  Aller au diagnostic
                </button>
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

      <footer className="border-t border-rule mt-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid gap-8 sm:grid-cols-3">
          <div>
            <img src="/logo-maintrix.png" alt="Maintrix" width={640} height={213} className="h-7 w-auto" />
            <p className="text-sm text-ink-soft mt-3 max-w-xs">
              {t("appSubtitle", language)}
            </p>
          </div>
          <div>
            <p className="font-mono text-eyebrow uppercase text-ink-mute mb-3">{t("support", language)}</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/documentation" className="text-ink-soft hover:text-ink">{t("documentation", language)}</Link></li>
              <li><Link href="/training" className="text-ink-soft hover:text-ink">{t("training", language)}</Link></li>
              <li><Link href="/support-chatbot" className="text-ink-soft hover:text-ink">{t("technicalContact", language)}</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-eyebrow uppercase text-ink-mute mb-3">{t("system", language)}</p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-rule pb-2">
                <dt className="text-ink-mute">{t("version", language)}</dt>
                <dd className="font-mono text-ink">1.0.0</dd>
              </div>
              <div className="flex justify-between border-b border-rule pb-2">
                <dt className="text-ink-mute">{t("statistics", language)}</dt>
                <dd className="font-mono text-ink">{diagnosticStats?.totalSessions ?? 0}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="border-t border-rule">
          <p className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 text-sm text-ink-mute">
            © {new Date().getFullYear()} {t("appTitle", language)}
          </p>
        </div>
      </footer>    </div>
  );
}
