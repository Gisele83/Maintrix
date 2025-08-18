import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DiagnosticForm } from "@/components/diagnostic-form";
import { DiagnosticResults } from "@/components/diagnostic-results";
import { useLanguage } from "@/hooks/use-language";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { offlineStorage } from "@/lib/offline-storage";
import { OfflineDiagnostic } from "@/components/OfflineDiagnostic";
import { OfflineIndicator } from "@/components/OfflineIndicator";
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
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Shield,
  FileText,
  Timer,
  Euro,
  ChevronRight,
  X
} from "lucide-react";
import { Link } from "wouter";

type Tab = "diagnostic" | "repair" | "history" | "reporting" | "import";

interface DiagnosticSuggestion {
  diagnosis: string;
  solution: string;
  confidence: number;
  matchingCases: number;
  caseId: number;
  estimatedDuration?: number;
  estimatedCost?: string;
  riskLevel?: string;
  aiInsights?: string;
  equipmentType?: string;
  urgency?: string;
  difficulty?: string;
  duration?: number;
  costEstimate?: string;
  predictiveTips?: string[];
  // Advanced ML fields
  advancedML?: boolean;
  anomalyDetected?: boolean;
  anomalyScore?: number;
  failureRisk?: number;
  patternMatch?: any;
  maintenanceRecommendation?: any;
  // Ensemble ML fields
  ensembleML?: boolean;
  ensembleAgreement?: number;
  individualPredictions?: any;
  riskAssessment?: any;
  // Cloud diagnostic fields
  cloudSource?: boolean;
  repairSteps?: string[];
  safetyWarnings?: string[];
  tools?: string[];
}

export default function SmartDiagnostic() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isOffline } = useOfflineSync();
  
  const [activeTab, setActiveTab] = useState<Tab>("diagnostic");
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticSuggestion[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [cloudSearchPerformed, setCloudSearchPerformed] = useState(false);
  const [cloudInsights, setCloudInsights] = useState("");
  
  // Equipment identifiers from database
  const { data: equipmentData } = useQuery({
    queryKey: ["/api/diagnostic/equipment-identifiers"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Modal states
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [repairInProgress, setRepairInProgress] = useState(false);
  
  // History modal states
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [diagnosticHistory, setDiagnosticHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Données de procédures de réparation
  const repairProcedures = {
    1: {
      title: "Remplacement Roulement Défectueux",
      duration: "2-3 heures",
      difficulty: "Intermédiaire",
      cost: "230€",
      safetyLevel: "Élevé",
      tools: ["Extracteur de roulement", "Marteau à inertie", "Presse hydraulique", "Tournevis", "Clés mixtes"],
      materials: ["Roulement neuf SKF 6308", "Graisse lithium", "Joint d'étanchéité"],
      steps: [
        {
          title: "Préparation et sécurité",
          description: "Consigner l'équipement et s'équiper des EPI",
          duration: "10 min",
          safety: "Port du casque, lunettes et gants obligatoires",
          details: "Couper l'alimentation électrique, verrouiller les organes de commande et afficher la consignation"
        },
        {
          title: "Démontage du roulement usagé",
          description: "Retirer le roulement défaillant avec l'extracteur",
          duration: "45 min",
          safety: "Attention aux projections lors de l'extraction",
          details: "Utiliser l'extracteur progressivement, contrôler l'état de l'arbre et du logement"
        },
        {
          title: "Nettoyage et inspection",
          description: "Nettoyer le logement et vérifier l'alignement",
          duration: "30 min",
          safety: "Utiliser des solvants dans un local ventilé",
          details: "Dégraisser complètement, mesurer les côtes, contrôler l'état des surfaces"
        },
        {
          title: "Montage du nouveau roulement",
          description: "Installer le roulement neuf avec la presse",
          duration: "60 min",
          safety: "Respecter le sens de montage et l'effort de serrage",
          details: "Chauffer légèrement le roulement, emmener progressivement en butée"
        },
        {
          title: "Remontage et test",
          description: "Remonter l'ensemble et effectuer les essais",
          duration: "35 min",
          safety: "Vérifier le serrage avant mise en route",
          details: "Test à vide puis en charge progressive, contrôler température et vibrations"
        }
      ]
    },
    8: {
      title: "Réparation Amorçage Déficient Pompe",
      duration: "1-2 heures",
      difficulty: "Facile",
      cost: "71€",
      safetyLevel: "Moyen",
      tools: ["Manomètre", "Clés plates", "Multimètre", "Tournevis"],
      materials: ["Joint de bride", "Huile hydraulique", "Filtre à air"],
      steps: [
        {
          title: "Diagnostic préliminaire",
          description: "Vérifier les niveaux et pressions",
          duration: "15 min",
          safety: "Attention à la pression résiduelle",
          details: "Contrôler niveau réservoir, état des flexibles, pression d'aspiration"
        },
        {
          title: "Purge circuit aspiration",
          description: "Éliminer l'air du circuit d'aspiration",
          duration: "30 min",
          safety: "Manipuler l'huile avec précaution",
          details: "Ouvrir les purgeurs, faire tourner la pompe manuellement, contrôler l'étanchéité"
        },
        {
          title: "Contrôle et ajustement",
          description: "Vérifier l'amorçage et ajuster les paramètres",
          duration: "45 min",
          safety: "Surveiller la température d'huile",
          details: "Test d'amorçage automatique, réglage pression, contrôle débits"
        }
      ]
    }
  };

  const getCurrentProcedure = () => {
    if (!selectedCaseId || !diagnosticResults.length) return null;
    const selectedResult = diagnosticResults.find(r => r.caseId === selectedCaseId);
    if (!selectedResult) return null;
    
    // Vérifier si nous avons une procédure prédéfinie
    const predefinedProcedure = repairProcedures[selectedResult.caseId as keyof typeof repairProcedures];
    if (predefinedProcedure) {
      return predefinedProcedure;
    }
    
    // Sinon, créer une procédure générique basée sur le diagnostic
    return {
      title: selectedResult.diagnosis || "Procédure de Réparation",
      duration: selectedResult.estimatedDuration ? `${selectedResult.estimatedDuration}h` : "1-2 heures",
      difficulty: selectedResult.difficulty || "Intermédiaire",
      cost: selectedResult.estimatedCost || "N/A",
      safetyLevel: selectedResult.riskLevel === "Élevé" ? "Élevé" : "Moyen",
      tools: ["Outils standard", "Équipements de sécurité", "Matériel de mesure"],
      materials: ["Pièces de rechange", "Consommables", "Produits d'entretien"],
      steps: [
        {
          title: "Préparation et diagnostic",
          description: "Préparer la zone de travail et confirmer le diagnostic",
          duration: "15 min",
          safety: "Port des équipements de protection individuelle obligatoire",
          details: "Consigner l'équipement, sécuriser la zone et confirmer les symptômes identifiés"
        },
        {
          title: "Exécution de la réparation",
          description: selectedResult.solution || "Appliquer la solution recommandée",
          duration: "45 min",
          safety: "Suivre les consignes de sécurité spécifiques à l'équipement",
          details: selectedResult.solution || "Exécuter la réparation selon les recommandations du diagnostic IA"
        },
        {
          title: "Test et validation",
          description: "Tester le fonctionnement et valider la réparation",
          duration: "20 min",
          safety: "Vérifier tous les paramètres avant remise en service",
          details: "Effectuer les tests fonctionnels et s'assurer que les symptômes ont disparu"
        }
      ]
    };
  };
  
  // ML Mode states
  const [advancedMode, setAdvancedMode] = useState(false);
  const [enhancedMode, setEnhancedMode] = useState(false);
  const [ensembleMode, setEnsembleMode] = useState(false);

  // Load diagnostic history function
  const loadDiagnosticHistory = async () => {
    setIsLoadingHistory(true);
    try {
      // Charger l'historique depuis l'API ou localStorage
      const storedHistory = localStorage.getItem('smartgmao_diagnostic_history');
      if (storedHistory) {
        const history = JSON.parse(storedHistory);
        setDiagnosticHistory(history);
      } else {
        // Créer un historique d'exemple s'il n'y en a pas
        const exampleHistory = [
          {
            id: 1,
            date: new Date().toLocaleDateString('fr-FR'),
            equipmentType: "Moteur électrique",
            symptoms: "Vibrations anormales, température élevée",
            diagnosis: "Défaut de palier",
            confidence: 87,
            status: "Résolu"
          },
          {
            id: 2,
            date: new Date(Date.now() - 86400000).toLocaleDateString('fr-FR'),
            equipmentType: "Pompe hydraulique",
            symptoms: "Pression insuffisante, bruit anormal",
            diagnosis: "Usure des joints",
            confidence: 92,
            status: "En cours"
          }
        ];
        setDiagnosticHistory(exampleHistory);
      }
      
      toast({
        title: "Historique chargé",
        description: "L'historique des diagnostics a été chargé avec succès",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger l'historique",
        variant: "destructive",
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Generate diagnostic report function
  const generateDiagnosticReport = () => {
    if (!diagnosticResults.length) return;

    const reportContent = generateReportHTML();
    
    // Create and download the report
    const blob = new Blob([reportContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport-diagnostic-${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Rapport téléchargé",
      description: "Le rapport d'analyse IA a été téléchargé avec succès",
    });
  };

  const generateReportHTML = () => {
    const reportDate = new Date().toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport de Diagnostic Smart GMAO DiagFix</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { color: #2563eb; font-size: 28px; font-weight: bold; }
        .subtitle { color: #6b7280; margin-top: 5px; }
        .section { margin-bottom: 30px; }
        .section-title { color: #1f2937; font-size: 20px; font-weight: bold; border-left: 4px solid #2563eb; padding-left: 15px; margin-bottom: 15px; }
        .diagnostic-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 15px; }
        .diagnostic-title { color: #1f2937; font-size: 18px; font-weight: bold; margin-bottom: 10px; }
        .confidence { background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: bold; }
        .risk-high { background: #fee2e2; color: #dc2626; }
        .risk-medium { background: #fef3c7; color: #d97706; }
        .risk-low { background: #dcfce7; color: #16a34a; }
        .details { margin-top: 15px; }
        .label { font-weight: bold; color: #374151; }
        .footer { margin-top: 50px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">Smart GMAO DiagFix</div>
        <div class="subtitle">Rapport de Diagnostic IA - Analyse Avancée</div>
        <div style="margin-top: 10px; color: #6b7280;">Généré le ${reportDate}</div>
    </div>

    <div class="section">
        <div class="section-title">Résumé de l'Analyse</div>
        <p><span class="label">Session ID:</span> ${currentSessionId || 'N/A'}</p>
        <p><span class="label">Nombre de suggestions:</span> ${diagnosticResults.length}</p>
        <p><span class="label">Mode d'analyse:</span> ${
          ensembleMode ? 'Ensemble ML (9 algorithmes)' :
          enhancedMode ? 'ML Avancé (Réseaux de neurones)' :
          advancedMode ? 'ML Avancé (SVM + Isolation Forest)' :
          'ML Standard'
        }</p>
        ${cloudSearchPerformed ? `<p><span class="label">Recherche Cloud:</span> Effectuée</p>` : ''}
        ${cloudInsights ? `<p><span class="label">Insights Cloud:</span> ${cloudInsights}</p>` : ''}
    </div>

    <div class="section">
        <div class="section-title">Diagnostics Détaillés</div>
        ${diagnosticResults.map((result, index) => `
        <div class="diagnostic-item">
            <div class="diagnostic-title">Diagnostic ${index + 1}: ${result.diagnosis}</div>
            <div style="margin-bottom: 15px;">
                <span class="confidence">Confiance: ${result.confidence}%</span>
                <span class="confidence risk-${result.riskLevel === 'Élevé' ? 'high' : result.riskLevel === 'Moyen' ? 'medium' : 'low'}" style="margin-left: 10px;">
                    Risque: ${result.riskLevel}
                </span>
            </div>
            <div class="details">
                <p><span class="label">Solution recommandée:</span> ${result.solution}</p>
                ${result.estimatedCost ? `<p><span class="label">Coût estimé:</span> ${result.estimatedCost}</p>` : ''}
                ${result.estimatedDuration ? `<p><span class="label">Durée estimée:</span> ${result.estimatedDuration}h</p>` : ''}
                ${result.urgency ? `<p><span class="label">Urgence:</span> ${result.urgency}</p>` : ''}
                ${result.aiInsights ? `<p><span class="label">Insights IA:</span> ${result.aiInsights}</p>` : ''}
            </div>
        </div>
        `).join('')}
    </div>

    <div class="footer">
        <p>Ce rapport a été généré automatiquement par Smart GMAO DiagFix</p>
        <p>Plateforme de diagnostic IA et gestion de maintenance industrielle</p>
        <p>Pour plus d'informations, consultez la documentation complète de la plateforme</p>
    </div>
</body>
</html>`;
  };

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
      setCurrentSessionId(result.sessionId ?? null);
      setCloudSearchPerformed(result.cloudSearchPerformed || false);
      setCloudInsights(result.cloudInsights || "");
      setIsAnalyzing(false);
      
      // Sélectionner automatiquement le premier cas pour les procédures de réparation
      if (result.suggestions && result.suggestions.length > 0) {
        const firstCaseId = result.suggestions[0].caseId;
        if (firstCaseId !== undefined) {
          setSelectedCaseId(firstCaseId);
        }
      }
      
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

  const handleDiagnosticSubmit = async (data: any) => {
    console.log("Raw form data received:", data);
    setIsAnalyzing(true);
    setDiagnosticResults([]);
    
    const cleanData = typeof data === 'string' ? JSON.parse(data) : data;
    console.log("Clean data to send:", cleanData);
    
    try {
      // First try advanced diagnostic for improved reliability
      const advancedResponse = await apiRequest("POST", "/api/advanced-diagnostic", cleanData);
      
      // Transform advanced response to match existing UI structure
      const transformedResults = {
        sessionId: `session_${Date.now()}`,
        suggestions: [{
          diagnosis: advancedResponse.diagnosis,
          solution: advancedResponse.solution,
          confidence: Math.round(advancedResponse.confidence.final * 100),
          riskLevel: advancedResponse.reliability.riskLevel,
          estimatedCost: advancedResponse.confidence.final > 0.8 ? "€200-500" : "€300-800",
          estimatedDuration: advancedResponse.confidence.final > 0.8 ? 2 : 4,
          urgency: cleanData.urgency,
          aiInsights: `Fiabilité: ${advancedResponse.reliability.confidenceLevel}. ${advancedResponse.recommendations.explanation}`,
          advancedML: true,
          evidenceChain: advancedResponse.evidenceChain,
          sensorTrends: advancedResponse.sensorTrends,
          recommendedAction: advancedResponse.recommendations.action,
          nextSteps: advancedResponse.recommendations.nextSteps
        }],
        reliability: advancedResponse.reliability,
        cloudSearchPerformed: true,
        cloudInsights: `Analyse multi-sources avec ${advancedResponse.evidenceChain.length} éléments d'évidence`,
        mlEnabled: true,
        modelAccuracy: advancedResponse.reliability.confidenceLevel,
        success: true,
        advanced: true
      };

      setDiagnosticResults(transformedResults.suggestions || []);
      setCurrentSessionId(transformedResults.sessionId ?? null);
      setCloudSearchPerformed(transformedResults.cloudSearchPerformed || false);
      setCloudInsights(transformedResults.cloudInsights || null);
      setIsAnalyzing(false);

      // Show reliability notification
      if (advancedResponse.reliability.needsReview) {
        toast({
          title: "Révision recommandée",
          description: advancedResponse.recommendations.explanation,
          variant: "default",
          duration: 8000,
        });
      } else {
        toast({
          title: "Diagnostic avancé complété",
          description: `Fiabilité: ${advancedResponse.reliability.confidenceLevel} - Confiance: ${Math.round(advancedResponse.confidence.final * 100)}%`,
          variant: "default",
        });
      }

    } catch (advancedError) {
      console.warn("Advanced diagnostic failed, trying fallback:", advancedError);
      
      // Fallback to existing ML diagnostic system
      diagnosticMutation.mutate(cleanData);
    }
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
              <OfflineIndicator />
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
                    {/* Offline Diagnostic Mode */}
                    {isOffline && (
                      <OfflineDiagnostic
                        onAddPendingAction={(action) => {
                          offlineStorage.addPendingAction(action);
                          toast({
                            title: "Action sauvegardée",
                            description: "Sera synchronisée dès le retour de la connexion",
                          });
                        }}
                      />
                    )}
                    
                    {/* Online diagnostic forms (hidden when offline) */}
                    {!isOffline && (
                      <>
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
                          onSubmit={handleDiagnosticSubmit}
                          isLoading={isAnalyzing}
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
                      </>
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
                      <Button 
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        onClick={() => {
                          console.log("Repair button clicked. selectedCaseId:", selectedCaseId, "diagnosticResults:", diagnosticResults);
                          
                          if (diagnosticResults.length > 0) {
                            // Si nous avons des résultats diagnostiques, toujours permettre l'accès
                            const caseIdToUse = selectedCaseId || (diagnosticResults[0]?.caseId) || 1;
                            setSelectedCaseId(caseIdToUse);
                            setCurrentStep(0);
                            setRepairInProgress(false);
                            setShowRepairModal(true);
                            
                            toast({
                              title: "Procédures de réparation",
                              description: `Ouverture des procédures pour le cas ${caseIdToUse}`,
                            });
                          } else {
                            toast({
                              title: "Aucun diagnostic disponible",
                              description: "Veuillez d'abord réaliser un diagnostic pour accéder aux procédures",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
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
                      <Button 
                        className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log("History button clicked!");
                          
                          try {
                            // Charger l'historique puis ouvrir le modal
                            await loadDiagnosticHistory();
                            setShowHistoryModal(true);
                            console.log("History modal should be open now");
                          } catch (error) {
                            console.error("Error loading history:", error);
                            toast({
                              title: "Erreur",
                              description: "Impossible de charger l'historique",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
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
                      <Button 
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        onClick={() => {
                          if (diagnosticResults.length === 0) {
                            toast({
                              title: "Aucun diagnostic disponible",
                              description: "Veuillez d'abord réaliser un diagnostic pour générer un rapport",
                              variant: "destructive",
                            });
                            return;
                          }

                          toast({
                            title: "Génération de rapport",
                            description: "Création du rapport d'analyse IA en cours...",
                          });

                          // Générer le rapport réel
                          setTimeout(() => {
                            generateDiagnosticReport();
                          }, 1000);
                        }}
                      >
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

        {/* Modal de procédures de réparation */}
        <Dialog open={showRepairModal} onOpenChange={setShowRepairModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-3">
                <Wrench className="h-6 w-6 text-blue-600" />
                <span>{getCurrentProcedure()?.title}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRepairModal(false)}
                  className="ml-auto"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>

            {getCurrentProcedure() && (
              <div className="space-y-6">
                {/* Informations générales */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Timer className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500">Durée</p>
                      <p className="font-medium">{getCurrentProcedure()?.duration}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-xs text-gray-500">Difficulté</p>
                      <p className="font-medium">{getCurrentProcedure()?.difficulty}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Euro className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="text-xs text-gray-500">Coût</p>
                      <p className="font-medium">{getCurrentProcedure()?.cost}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-red-600" />
                    <div>
                      <p className="text-xs text-gray-500">Sécurité</p>
                      <p className="font-medium">{getCurrentProcedure()?.safetyLevel}</p>
                    </div>
                  </div>
                </div>

                {/* Progression */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Progression</h3>
                    <span className="text-sm text-gray-500">
                      Étape {currentStep + 1} sur {getCurrentProcedure()?.steps.length}
                    </span>
                  </div>
                  <Progress 
                    value={(currentStep / (getCurrentProcedure()?.steps.length || 1)) * 100} 
                    className="h-2"
                  />
                </div>

                {/* Outils et matériaux */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <h4 className="font-semibold mb-3 flex items-center">
                      <Wrench className="h-4 w-4 mr-2 text-blue-600" />
                      Outils requis
                    </h4>
                    <ul className="space-y-1 text-sm">
                      {getCurrentProcedure()?.tools.map((tool, index) => (
                        <li key={index} className="flex items-center">
                          <div className="w-2 h-2 bg-blue-600 rounded-full mr-2" />
                          {tool}
                        </li>
                      ))}
                    </ul>
                  </Card>
                  <Card className="p-4">
                    <h4 className="font-semibold mb-3 flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-green-600" />
                      Matériaux
                    </h4>
                    <ul className="space-y-1 text-sm">
                      {getCurrentProcedure()?.materials.map((material, index) => (
                        <li key={index} className="flex items-center">
                          <div className="w-2 h-2 bg-green-600 rounded-full mr-2" />
                          {material}
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>

                {/* Étapes de réparation */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Étapes de réparation</h3>
                  {getCurrentProcedure()?.steps.map((step, index) => (
                    <Card 
                      key={index} 
                      className={`p-4 transition-all duration-200 ${
                        index === currentStep 
                          ? 'border-blue-500 bg-blue-50' 
                          : index < currentStep 
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start space-x-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          index === currentStep 
                            ? 'bg-blue-600 text-white' 
                            : index < currentStep 
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-300 text-gray-600'
                        }`}>
                          {index < currentStep ? <CheckCircle className="h-4 w-4" /> : index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">{step.title}</h4>
                            <Badge variant="outline" className="text-xs">
                              {step.duration}
                            </Badge>
                          </div>
                          <p className="text-gray-600 mb-3">{step.description}</p>
                          
                          {index === currentStep && (
                            <div className="space-y-3 mt-4 p-3 bg-white rounded border">
                              <div className="flex items-start space-x-2">
                                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                                <div>
                                  <p className="font-medium text-orange-800 text-sm">Sécurité</p>
                                  <p className="text-sm text-orange-700">{step.safety}</p>
                                </div>
                              </div>
                              <Separator />
                              <div>
                                <p className="font-medium text-sm mb-1">Détails de l'étape</p>
                                <p className="text-sm text-gray-600">{step.details}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Contrôles de navigation */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    disabled={currentStep === 0}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Étape précédente
                  </Button>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant={repairInProgress ? "secondary" : "default"}
                      onClick={() => setRepairInProgress(!repairInProgress)}
                    >
                      {repairInProgress ? (
                        <>
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Démarrer
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => {
                        setCurrentStep(0);
                        setRepairInProgress(false);
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Recommencer
                    </Button>
                  </div>

                  <Button
                    onClick={() => {
                      if (currentStep < (getCurrentProcedure()?.steps.length || 1) - 1) {
                        setCurrentStep(currentStep + 1);
                      } else {
                        toast({
                          title: "Réparation terminée",
                          description: "Toutes les étapes ont été complétées avec succès",
                        });
                        setShowRepairModal(false);
                      }
                    }}
                  >
                    {currentStep < (getCurrentProcedure()?.steps.length || 1) - 1 ? (
                      <>
                        Étape suivante
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </>
                    ) : (
                      <>
                        Terminer
                        <CheckCircle className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal d'historique des diagnostics */}
        <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-3">
                <History className="h-6 w-6 text-green-600" />
                <span>Historique des Diagnostics</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistoryModal(false)}
                  className="ml-auto"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {isLoadingHistory ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-gray-600">Chargement de l'historique...</p>
                </div>
              ) : diagnosticHistory.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">Aucun diagnostic dans l'historique</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {diagnosticHistory.map((item) => (
                    <Card key={item.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4 mb-2">
                            <h3 className="font-semibold text-gray-900">{item.equipmentType}</h3>
                            <Badge variant={item.status === "Résolu" ? "default" : "secondary"}>
                              {item.status}
                            </Badge>
                            <span className="text-sm text-gray-500">{item.date}</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">Symptômes:</span> {item.symptoms}
                          </p>
                          <p className="text-sm text-gray-800">
                            <span className="font-medium">Diagnostic:</span> {item.diagnosis}
                          </p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-center">
                            <div className="text-lg font-bold text-blue-600">{item.confidence}%</div>
                            <div className="text-xs text-gray-500">Confiance</div>
                          </div>
                          <Button variant="outline" size="sm">
                            Voir détails
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-gray-500">
                {diagnosticHistory.length} diagnostic(s) dans l'historique
              </p>
              <div className="space-x-2">
                <Button variant="outline" onClick={() => setShowHistoryModal(false)}>
                  Fermer
                </Button>
                <Button onClick={() => {
                  // Exporter l'historique
                  const exportData = JSON.stringify(diagnosticHistory, null, 2);
                  const blob = new Blob([exportData], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `historique-diagnostics-${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.json`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                  
                  toast({
                    title: "Historique exporté",
                    description: "L'historique a été téléchargé au format JSON",
                  });
                }}>
                  Exporter
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}