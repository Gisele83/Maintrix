import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { montant, pourcentage, heures, part, nombre } from "@/lib/donnees";
import { EnTetePage } from "@/components/app-shell";
import { PuceEtat } from "@/components/indicateurs";
import { type RegistreEtat } from "@/lib/etats";
import { 
  FileText, 
  Plus, 
  Download, 
  Calendar as CalendarIcon,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  DollarSign,
  Calendar as CalendarDays,
  PieChart,
  Activity,
  Target,
  Zap,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface MaintenanceReport {
  id: number;
  reportNumber: string;
  workOrderId: number;
  equipmentId: number;
  reportType: string;
  interventionType: string;
  technician: string;
  supervisor?: string;
  startTime: string;
  endTime: string;
  actualDuration?: number;
  plannedDuration?: number;
  workDescription: string;
  problemDiagnosis?: string;
  actionsTaken: string;
  partsUsed?: any[];
  toolsUsed?: string[];
  safetyIncidents?: string;
  qualityCheck: boolean;
  qualityNotes?: string;
  followUpRequired: boolean;
  followUpDate?: string;
  followUpNotes?: string;
  totalCost?: number | string;
  laborCost?: number | string;
  partsCost?: number | string;
  status: string;
  approvedBy?: string;
  approvalDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface MonthlyReport {
  id: number;
  reportNumber: string;
  month: number;
  year: number;
  periodStart: string;
  periodEnd: string;
  generatedBy?: string;
  generatedAt: string;
  totalEquipment?: number;
  activeEquipment?: number;
  equipmentAvailability?: number | string;
  totalWorkOrders?: number;
  completedWorkOrders?: number;
  preventiveWorkOrders?: number;
  correctiveWorkOrders?: number;
  averageCompletionTime?: number | string;
  mtbf?: number | string;
  mttr?: number | string;
  plannedMaintenanceRatio?: number | string;
  maintenanceEfficiency?: number | string;
  totalMaintenanceCost?: number | string;
  laborCost?: number | string;
  partsCost?: number | string;
  contractorCost?: number | string;
  costPerWorkOrder?: number | string;
  partsConsumed?: number;
  inventoryTurnover?: number | string;
  stockouts?: number;
  emergencyPurchases?: number;
  totalAlerts?: number;
  criticalAlerts?: number;
  safetyIncidents?: number;
  qualityIssues?: number;
  performanceScore?: number;
  improvementAreas?: string[];
  recommendations?: string[];
  statisticsData?: any;
  chartsData?: any;
  status: string;
  reviewedBy?: string;
  reviewDate?: string;
  notes?: string;
}

interface ProprietesRapports {
  /**
   * En-tête fourni par l'écran hôte — même convention que les ordres de
   * travail, l'historique et le préventif. Sans lui, cet onglet ne portait
   * AUCUN titre de niveau 1 : son intitulé était un `<h2>` en
   * `font-serif text-3xl text-ink`, et la GMAO le montait nu.
   */
  enTete?: React.ReactNode;
}

export function MaintenanceReports({ enTete }: ProprietesRapports = {}) {
  const [activeTab, setActiveTab] = useState<"intervention" | "monthly">("intervention");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isGeneratingMonthly, setIsGeneratingMonthly] = useState(false);
  const [selectedMonthlyReport, setSelectedMonthlyReport] = useState<MonthlyReport | null>(null);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showChartsModal, setShowChartsModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get maintenance reports
  const { data: maintenanceReports = [], isLoading: loadingReports } = useQuery({
    queryKey: ["/api/maintenance-reports"],
    retry: false,
  });

  // Get monthly reports
  const { data: monthlyReports = [], isLoading: loadingMonthly } = useQuery({
    queryKey: ["/api/monthly-reports"],
    retry: false,
  });

  // Generate monthly report mutation
  const generateMonthlyMutation = useMutation({
    mutationFn: async (data: { month: number; year: number; generatedBy?: string }) => {
      const response = await fetch("/api/monthly-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Rapport mensuel généré",
        description: "Le rapport mensuel de maintenance a été généré avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-reports"] });
      setIsGeneratingMonthly(false);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de générer le rapport mensuel",
        variant: "destructive",
      });
      setIsGeneratingMonthly(false);
    },
  });

  const generateMonthlyReport = () => {
    if (!selectedDate) return;
    
    setIsGeneratingMonthly(true);
    generateMonthlyMutation.mutate({
      month: selectedDate.getMonth() + 1,
      year: selectedDate.getFullYear(),
      generatedBy: "Gestionnaire GMAO"
    });
  };

  /**
   * Les deux branches `default` rendaient la VALEUR BRUTE du serveur. Ce
   * n'était pas théorique : les seuls rapports présents en base portent
   * `report_type = 'intervention'` et `status = 'completed'`, qu'aucun des
   * deux dictionnaires ne couvrait. Relevé à l'écran le 20/10/2026, au
   * milieu d'une page en français : « intervention » et « completed ».
   *
   * `completed` n'est d'ailleurs pas dans les valeurs que `shared/schema.ts`
   * documente sur la colonne (« draft, approved, archived ») — c'est
   * l'auto-génération de rapport qui l'écrit. Il est donc reconnu en lecture,
   * comme `on_hold` l'est pour les ordres de travail.
   */
  const getStatusBadge = (status: string) => {
    const table: Record<string, { libelle: string; registre: RegistreEtat }> = {
      draft: { libelle: "Brouillon", registre: "alerte" },
      generated: { libelle: "Généré", registre: "encours" },
      completed: { libelle: "Terminé", registre: "nominal" },
      reviewed: { libelle: "Révisé", registre: "encours" },
      approved: { libelle: "Approuvé", registre: "nominal" },
      archived: { libelle: "Archivé", registre: "neutre" },
    };
    const entree = table[status];
    return (
      <PuceEtat registre={entree?.registre ?? "neutre"}>{entree?.libelle ?? status ?? "—"}</PuceEtat>
    );
  };

  const getReportTypeBadge = (type: string) => {
    const table: Record<string, { libelle: string; registre: RegistreEtat }> = {
      intervention: { libelle: "Intervention", registre: "encours" },
      preventive: { libelle: "Préventive", registre: "nominal" },
      corrective: { libelle: "Corrective", registre: "alerte" },
      inspection: { libelle: "Inspection", registre: "encours" },
    };
    const entree = table[type];
    return (
      <PuceEtat registre={entree?.registre ?? "neutre"}>{entree?.libelle ?? type ?? "—"}</PuceEtat>
    );
  };

  /**
   * Les colonnes `mtbf`, `mttr`, `average_completion_time`,
   * `equipment_availability` et les coûts sont des `decimal` PostgreSQL : le
   * pilote les renvoie en CHAÎNES. `report.mtbf?.toFixed(1)` levait donc
   * « TypeError: pe.toFixed is not a function », et l'onglet « Bilans
   * mensuels » rendait une page blanche dès qu'un bilan existait.
   *
   * Les conversions vivent maintenant dans `lib/donnees.ts` : un seul endroit
   * sait traduire ce que le serveur envoie, pour les onze écrans concernés.
   */
  const formatCurrency = (valeur?: number | string | null) => montant(valeur, { decimales: 2 });
  const formatPercentage = (valeur?: number | string | null) => pourcentage(valeur);
  const formatHeures = (valeur?: number | string | null) => heures(valeur);
  const jauge = (valeur: unknown, maximum: number) => part(valeur, maximum);

  const openAnalyticsModal = (report: MonthlyReport) => {
    console.log("Opening analytics modal for report:", report.reportNumber);
    setSelectedMonthlyReport(report);
    setShowAnalyticsModal(true);
  };

  const openChartsModal = (report: MonthlyReport) => {
    console.log("Opening charts modal for report:", report.reportNumber);
    setSelectedMonthlyReport(report);
    setShowChartsModal(true);
  };

  // Download intervention report as PDF
  const downloadInterventionReport = (report: MaintenanceReport) => {
    try {
      // Force cache bypass with multiple parameters
      const timestamp = new Date().getTime();
      const randomId = Math.random().toString(36).substring(7);
      const url = `/pdf/maintenance-reports/${report.id}?cache_bust=${timestamp}&rand=${randomId}&v=3.0`;
      
      console.log('🚀 [INTERVENTION PDF] ===================================');
      console.log('🚀 [INTERVENTION PDF] Report ID:', report.id);
      console.log('🚀 [INTERVENTION PDF] URL généré:', url);
      console.log('🚀 [INTERVENTION PDF] Function called for report:', report.reportNumber);
      console.log('🚀 [INTERVENTION PDF] ===================================');
      
      // Force aggressive cache clearing
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            caches.delete(cacheName);
          });
        });
      }
      
      // Clear localStorage and sessionStorage for PDF-related items
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.includes('pdf') || key.includes('report')) {
            localStorage.removeItem(key);
          }
        });
        Object.keys(sessionStorage).forEach(key => {
          if (key.includes('pdf') || key.includes('report')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.log('Storage clear attempt:', e);
      }
      
      // Open with additional cache-busting headers
      const newWindow = window.open('about:blank', '_blank');
      if (newWindow) {
        newWindow.location.href = url;
      } else {
        // Fallback if popup blocked
        window.location.assign(url);
      }

      toast({
        title: "Génération du rapport PDF",
        description: `Le rapport d'intervention ${report.reportNumber} s'ouvre dans un nouvel onglet [CACHE BYPASS ACTIF]`,
      });
    } catch (error) {
      console.error('❌ PDF Error:', error); // Debug log
      toast({
        title: "Erreur de téléchargement",
        description: "Impossible de générer le rapport d'intervention PDF",
        variant: "destructive",
      });
    }
  };

  // SUPPRIMÉ: generateInterventionReportHTML - Utilisation des routes PDF publiques uniquement

  // Download monthly report as PDF
  const downloadMonthlyReport = (report: MonthlyReport) => {
    try {
      // Force cache bypass with multiple parameters
      const timestamp = new Date().getTime();
      const randomId = Math.random().toString(36).substring(7);
      const url = `/pdf/monthly-reports/${report.id}?cache_bust=${timestamp}&rand=${randomId}&v=3.0`;
      
      console.log('📊 [MONTHLY PDF] ===================================');
      console.log('📊 [MONTHLY PDF] Report ID:', report.id);
      console.log('📊 [MONTHLY PDF] URL généré:', url);
      console.log('📊 [MONTHLY PDF] Function called for report:', report.reportNumber);
      console.log('📊 [MONTHLY PDF] ===================================');
      
      // Force aggressive cache clearing
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            caches.delete(cacheName);
          });
        });
      }
      
      // Clear localStorage and sessionStorage for PDF-related items
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.includes('pdf') || key.includes('report')) {
            localStorage.removeItem(key);
          }
        });
        Object.keys(sessionStorage).forEach(key => {
          if (key.includes('pdf') || key.includes('report')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.log('Storage clear attempt:', e);
      }
      
      // Open with additional cache-busting headers
      const newWindow = window.open('about:blank', '_blank');
      if (newWindow) {
        newWindow.location.href = url;
      } else {
        // Fallback if popup blocked
        window.location.assign(url);
      }

      toast({
        title: "Génération du rapport PDF",
        description: `Le rapport mensuel ${report.reportNumber} s'ouvre dans un nouvel onglet [CACHE BYPASS ACTIF]`,
      });
    } catch (error) {
      console.error('❌ Monthly PDF Error:', error); // Debug log
      toast({
        title: "Erreur de téléchargement",
        description: "Impossible de générer le rapport mensuel PDF",
        variant: "destructive",
      });
    }
  };

  // SUPPRIMÉ: generateMonthlyReportHTML - Utilisation des routes PDF publiques uniquement

  const renderKpiCard = (title: string, value: string | number, icon: React.ReactNode, color: string) => (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink-soft">{title}</p>
          <p className="font-serif text-3xl text-ink">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <div className="w-5 h-5">{icon}</div>
        </div>
      </div>
    </Card>
  );

  const renderPieChart = (data: any, title: string) => {
    if (!data) return null;
    
    const total = Object.values(data).reduce((sum: number, value: any) => sum + (typeof value === 'number' ? value : 0), 0);
    
    return (
      <Card className="p-6">
        <h3 className="font-serif text-title font-medium text-ink mb-4">{title}</h3>
        <div className="space-y-3">
          {Object.entries(data).map(([key, value], index) => {
            const percentage = total > 0 ? ((value as number) / total) * 100 : 0;
            const colors = ['bg-etat-encours-vif', 'bg-etat-nominal-vif', 'bg-etat-alerte-vif', 'bg-etat-critique-vif', 'bg-etat-encours-vif'];
            return (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${colors[index % colors.length]}`}></div>
                  <span className="text-sm">{key}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{String(value)}</span>
                  <span className="text-xs text-ink-soft">({percentage.toFixed(1)}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {enTete ?? (
        <EnTetePage
          surTitre="GMAO"
          titre="Rapports de maintenance"
          phrase="Les rapports d'intervention et les bilans mensuels, consultables et exportables en PDF."
        />
      )}

      {/* Deux familles de rapports, donc deux onglets — et non deux boutons
          qui se ressemblent. Le soulignement dit lequel est ouvert ; c'est le
          même motif que la navigation de la GMAO. */}
      <div className="border-b border-rule" role="tablist" aria-label="Famille de rapports">
        <div className="flex gap-6">
          {([
            { id: "intervention", libelle: "Rapports d'intervention", icone: FileText },
            { id: "monthly", libelle: "Bilans mensuels", icone: BarChart3 },
          ] as const).map((onglet) => {
            const Icone = onglet.icone;
            const actif = activeTab === onglet.id;
            return (
              <button
                key={onglet.id}
                role="tab"
                aria-selected={actif}
                onClick={() => setActiveTab(onglet.id)}
                className={`inline-flex items-center gap-2 pb-3 -mb-px border-b-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal ${
                  actif
                    ? "border-signal text-ink font-medium"
                    : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                <Icone className="w-4 h-4" aria-hidden="true" />
                {onglet.libelle}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "intervention" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Rapports d'Intervention
              </CardTitle>
              <CardDescription>
                Rapports générés automatiquement après chaque intervention de maintenance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingReports ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rule mx-auto"></div>
                  <p className="mt-2 text-ink-soft">Chargement des rapports...</p>
                </div>
              ) : (maintenanceReports as MaintenanceReport[]).length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto text-ink-soft mb-4" />
                  <p className="text-ink-soft">Aucun rapport d'intervention disponible</p>
                  <p className="text-sm text-ink-soft mt-2">
                    Les rapports sont générés automatiquement lors de la completion des ordres de travail
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {(maintenanceReports as MaintenanceReport[]).map((report: MaintenanceReport) => (
                    <Card key={report.id} className="border-l-4 border-l-signal">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-lg">{report.reportNumber}</h3>
                            <p className="text-sm text-ink-soft">
                              {format(new Date(report.createdAt), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {getReportTypeBadge(report.reportType)}
                            {getStatusBadge(report.status)}
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                          <div>
                            <Label className="text-sm font-medium">Technicien</Label>
                            <p className="text-sm">{report.technician}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Type d'intervention</Label>
                            <p className="text-sm">{report.interventionType}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Durée</Label>
                            <p className="text-sm">
                              {report.actualDuration ? `${report.actualDuration} min` : "N/A"}
                            </p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Coût total</Label>
                            <p className="text-sm font-semibold">{formatCurrency(report.totalCost)}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <Label className="text-sm font-medium">Description des travaux</Label>
                            <p className="text-sm">{report.workDescription}</p>
                          </div>
                          
                          {report.problemDiagnosis && (
                            <div>
                              <Label className="text-sm font-medium">Diagnostic</Label>
                              <p className="text-sm">{report.problemDiagnosis}</p>
                            </div>
                          )}

                          <div>
                            <Label className="text-sm font-medium">Actions réalisées</Label>
                            <p className="text-sm">{report.actionsTaken}</p>
                          </div>
                        </div>

                        {(report.safetyIncidents || report.followUpRequired) && (
                          <div className="mt-4 p-3 bg-etat-alerte-fond border border-etat-alerte-filet rounded-lg">
                            {report.safetyIncidents && (
                              <div className="flex items-center gap-2 text-etat-alerte-texte">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="text-sm font-medium">Incident de sécurité signalé</span>
                              </div>
                            )}
                            {report.followUpRequired && (
                              <div className="flex items-center gap-2 text-etat-alerte-texte">
                                <Clock className="w-4 h-4" />
                                <span className="text-sm font-medium">Suivi requis</span>
                                {report.followUpDate && (
                                  <span className="text-sm">
                                    - {format(new Date(report.followUpDate), "dd/MM/yyyy", { locale: fr })}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-4 flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            {report.qualityCheck && (
                              <div className="flex items-center gap-1 text-etat-nominal-texte">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-sm">Contrôle qualité validé</span>
                              </div>
                            )}
                          </div>
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => downloadInterventionReport(report)}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Télécharger PDF
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "monthly" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Rapports Mensuels de Maintenance
              </CardTitle>
              <CardDescription>
                Rapports avec KPIs, statistiques et analyses de performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <Label>Période à générer:</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "MMMM yyyy", { locale: fr }) : "Sélectionner"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => date > new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <Button 
                  onClick={generateMonthlyReport}
                  disabled={isGeneratingMonthly || !selectedDate}
                  className="bg-paper-deep"
                >
                  {isGeneratingMonthly ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Générer Rapport Mensuel
                    </>
                  )}
                </Button>
              </div>

              {loadingMonthly ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-etat-encours-filet mx-auto"></div>
                  <p className="mt-2 text-ink-soft">Chargement des rapports mensuels...</p>
                </div>
              ) : (monthlyReports as MonthlyReport[]).length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 mx-auto text-ink-soft mb-4" />
                  <p className="text-ink-soft">Aucun rapport mensuel disponible</p>
                  <p className="text-sm text-ink-soft mt-2">
                    Générez votre premier rapport mensuel pour commencer l'analyse des performances
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {(monthlyReports as MonthlyReport[]).map((report: MonthlyReport) => (
                    <Card key={report.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <h3 className="font-semibold text-xl">{report.reportNumber}</h3>
                            <p className="text-ink-soft">
                              Rapport pour {format(new Date(report.periodStart), "MMMM yyyy", { locale: fr })}
                            </p>
                            <p className="text-sm text-ink-soft">
                              Généré le {format(new Date(report.generatedAt), "dd/MM/yyyy à HH:mm", { locale: fr })}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge className="bg-etat-encours-fond text-etat-encours-texte">
                              Score: {report.performanceScore || 0}/100
                            </Badge>
                            {getStatusBadge(report.status)}
                          </div>
                        </div>

                        {/* KPIs Grid */}
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                          <Card className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-etat-nominal-fond rounded-lg">
                                <TrendingUp className="w-5 h-5 text-etat-nominal-texte" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">Disponibilité</p>
                                <p className="font-serif text-3xl text-ink">{formatPercentage(report.equipmentAvailability)}</p>
                              </div>
                            </div>
                          </Card>

                          <Card className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-etat-encours-fond rounded-lg">
                                <Clock className="w-5 h-5 text-etat-encours-texte" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">MTBF</p>
                                <p className="font-serif text-3xl text-ink">{formatHeures(report.mtbf)}</p>
                              </div>
                            </div>
                          </Card>

                          <Card className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-etat-alerte-fond rounded-lg">
                                <Clock className="w-5 h-5 text-etat-alerte-texte" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">MTTR</p>
                                <p className="font-serif text-3xl text-ink">{formatHeures(report.mttr)}</p>
                              </div>
                            </div>
                          </Card>

                          <Card className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-paper-deep rounded-lg">
                                <DollarSign className="w-5 h-5 text-signal-deep" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">Coût Total</p>
                                <p className="font-serif text-3xl text-ink">{formatCurrency(report.totalMaintenanceCost)}</p>
                              </div>
                            </div>
                          </Card>
                        </div>

                        {/* Statistics */}
                        <div className="grid md:grid-cols-3 gap-4 mb-6">
                          <div>
                            <Label className="text-sm font-medium">Ordres de travail</Label>
                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Total</span>
                                <span className="font-medium">{report.totalWorkOrders || 0}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Terminés</span>
                                <span className="font-medium">{report.completedWorkOrders || 0}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Préventifs</span>
                                <span className="font-medium">{report.preventiveWorkOrders || 0}</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Coûts</Label>
                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Main d'œuvre</span>
                                <span className="font-medium">{formatCurrency(report.laborCost)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Pièces</span>
                                <span className="font-medium">{formatCurrency(report.partsCost)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Par OT</span>
                                <span className="font-medium">{formatCurrency(report.costPerWorkOrder)}</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Alertes</Label>
                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Total</span>
                                <span className="font-medium">{report.totalAlerts || 0}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Critiques</span>
                                <span className="font-medium text-etat-critique-texte">{report.criticalAlerts || 0}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Incidents sécurité</span>
                                <span className="font-medium">{report.safetyIncidents || 0}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Recommendations */}
                        {report.recommendations && report.recommendations.length > 0 && (
                          <div className="mt-4 p-4 bg-etat-encours-fond border border-etat-encours-filet rounded-lg">
                            <h4 className="font-medium text-etat-encours-texte mb-2">Recommandations</h4>
                            <ul className="space-y-1">
                              {report.recommendations.map((rec, index) => (
                                <li key={index} className="text-sm text-etat-encours-texte flex items-start gap-2">
                                  <span className="w-1.5 h-1.5 bg-etat-encours-vif rounded-full mt-2 flex-shrink-0"></span>
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="mt-6 flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-ink-soft">
                              Généré par: {report.generatedBy || "Système"}
                            </span>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                console.log("Analytics button clicked for report:", report.reportNumber);
                                openAnalyticsModal(report);
                              }}
                            >
                              <BarChart3 className="w-4 h-4 mr-2" />
                              Voir Analyses
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openChartsModal(report)}
                            >
                              <PieChart className="w-4 h-4 mr-2" />
                              Voir Graphiques
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => downloadMonthlyReport(report)}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Télécharger PDF
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics Modal */}
      <Dialog open={showAnalyticsModal} onOpenChange={setShowAnalyticsModal}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto"
          onOpenAutoFocus={(e) => {
            console.log("Analytics modal opened, state:", showAnalyticsModal);
            console.log("Selected report:", selectedMonthlyReport?.reportNumber);
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Analyses Détaillées - {selectedMonthlyReport?.reportNumber}
            </DialogTitle>
            <DialogDescription>
              Analyse complète des performances de maintenance pour {selectedMonthlyReport ? format(new Date(selectedMonthlyReport.periodStart), "MMMM yyyy", { locale: fr }) : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedMonthlyReport && (
            <div className="space-y-6">
              {/* KPI Grid */}
              <div className="grid md:grid-cols-3 gap-4">
                {renderKpiCard(
                  "Score Performance", 
                  `${selectedMonthlyReport.performanceScore}/100`,
                  <Target className="w-5 h-5 text-etat-encours-texte" />,
                  "bg-etat-encours-fond"
                )}
                {renderKpiCard(
                  "Efficacité Maintenance", 
                  formatPercentage(selectedMonthlyReport.maintenanceEfficiency),
                  <Zap className="w-5 h-5 text-etat-nominal-texte" />,
                  "bg-etat-nominal-fond"
                )}
                {renderKpiCard(
                  "Ratio Préventif", 
                  formatPercentage(selectedMonthlyReport.plannedMaintenanceRatio),
                  <CheckCircle className="w-5 h-5 text-signal-deep" />,
                  "bg-paper-deep"
                )}
              </div>

              {/* Detailed Metrics */}
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="font-serif text-title font-medium text-ink mb-4">Métriques de Fiabilité</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">MTBF (Temps Moyen Entre Pannes)</span>
                      <span className="font-medium">{formatHeures(selectedMonthlyReport.mtbf)}</span>
                    </div>
                    <Progress value={jauge(selectedMonthlyReport.mtbf, 200)} className="h-2" />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">MTTR (Temps Moyen de Réparation)</span>
                      <span className="font-medium">{formatHeures(selectedMonthlyReport.mttr)}</span>
                    </div>
                    <Progress value={Math.max(0, 100 - (nombre(selectedMonthlyReport.mttr) ?? 0) * 10)} className="h-2" />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Disponibilité Équipements</span>
                      <span className="font-medium">{formatPercentage(selectedMonthlyReport.equipmentAvailability)}</span>
                    </div>
                    <Progress value={nombre(selectedMonthlyReport.equipmentAvailability) ?? 0} className="h-2" />
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-serif text-title font-medium text-ink mb-4">Analyse des Coûts</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Coût Total</span>
                      <span className="font-medium">{formatCurrency(selectedMonthlyReport.totalMaintenanceCost)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Main d'œuvre</span>
                      <span className="font-medium">{formatCurrency(selectedMonthlyReport.laborCost)}</span>
                    </div>
                    <Progress value={part(selectedMonthlyReport.laborCost, selectedMonthlyReport.totalMaintenanceCost)} className="h-2" />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Pièces détachées</span>
                      <span className="font-medium">{formatCurrency(selectedMonthlyReport.partsCost)}</span>
                    </div>
                    <Progress value={part(selectedMonthlyReport.partsCost, selectedMonthlyReport.totalMaintenanceCost)} className="h-2" />
                  </div>
                </Card>
              </div>

              {/* Recommendations */}
              {selectedMonthlyReport.recommendations && selectedMonthlyReport.recommendations.length > 0 && (
                <Card className="p-6">
                  <h3 className="font-serif text-title font-medium text-ink mb-4">Recommandations d'Amélioration</h3>
                  <div className="space-y-3">
                    {selectedMonthlyReport.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-etat-encours-fond rounded-lg">
                        <div className="w-6 h-6 bg-etat-encours-vif text-white rounded-full flex items-center justify-center text-sm font-medium mt-0.5">
                          {index + 1}
                        </div>
                        <p className="text-sm text-etat-encours-texte">{rec}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Charts Modal */}
      <Dialog open={showChartsModal} onOpenChange={setShowChartsModal}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Graphiques et Statistiques - {selectedMonthlyReport?.reportNumber}
            </DialogTitle>
            <DialogDescription>
              Visualisation des données de maintenance pour {selectedMonthlyReport ? format(new Date(selectedMonthlyReport.periodStart), "MMMM yyyy", { locale: fr }) : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedMonthlyReport && (
            <div className="space-y-6">
              {/* Charts Grid */}
              <div className="grid md:grid-cols-2 gap-6">
                {selectedMonthlyReport.statisticsData?.equipmentByType && 
                  renderPieChart(selectedMonthlyReport.statisticsData.equipmentByType, "Répartition par Type d'Équipement")
                }
                
                {selectedMonthlyReport.statisticsData?.workOrdersByStatus && 
                  renderPieChart(selectedMonthlyReport.statisticsData.workOrdersByStatus, "Ordres de Travail par Statut")
                }
                
                {selectedMonthlyReport.chartsData?.maintenanceTypeChart && 
                  renderPieChart(
                    selectedMonthlyReport.chartsData.maintenanceTypeChart.labels.reduce((acc: any, label: string, index: number) => {
                      acc[label] = selectedMonthlyReport.chartsData.maintenanceTypeChart.data[index];
                      return acc;
                    }, {}), 
                    "Types de Maintenance"
                  )
                }
                
                {selectedMonthlyReport.chartsData?.costBreakdownChart && 
                  renderPieChart(
                    selectedMonthlyReport.chartsData.costBreakdownChart.labels.reduce((acc: any, label: string, index: number) => {
                      acc[label] = `${selectedMonthlyReport.chartsData.costBreakdownChart.data[index]}€`;
                      return acc;
                    }, {}), 
                    "Répartition des Coûts"
                  )
                }
              </div>

              {/* Performance Indicators */}
              <Card className="p-6">
                <h3 className="font-serif text-title font-medium text-ink mb-4">Indicateurs de Performance</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto bg-etat-nominal-fond rounded-full flex items-center justify-center mb-2">
                      <Activity className="w-8 h-8 text-etat-nominal-texte" />
                    </div>
                    <p className="font-serif text-3xl text-etat-nominal-texte">{formatPercentage(selectedMonthlyReport.equipmentAvailability)}</p>
                    <p className="text-sm text-ink-soft">Disponibilité</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto bg-etat-encours-fond rounded-full flex items-center justify-center mb-2">
                      <Clock className="w-8 h-8 text-etat-encours-texte" />
                    </div>
                    <p className="font-serif text-3xl text-etat-encours-texte">{formatHeures(selectedMonthlyReport.averageCompletionTime)}</p>
                    <p className="text-sm text-ink-soft">Temps Moyen</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto bg-paper-deep rounded-full flex items-center justify-center mb-2">
                      <Target className="w-8 h-8 text-signal-deep" />
                    </div>
                    <p className="font-serif text-3xl text-signal-deep">{formatPercentage(selectedMonthlyReport.maintenanceEfficiency)}</p>
                    <p className="text-sm text-ink-soft">Efficacité</p>
                  </div>
                </div>
              </Card>

              {/* Trends and Alerts */}
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="font-serif text-title font-medium text-ink mb-4">Tendances du Mois</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-etat-nominal-fond rounded-lg">
                      <TrendingUp className="w-5 h-5 text-etat-nominal-texte" />
                      <span className="text-sm">Amélioration de l'efficacité maintenance (+5%)</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-etat-encours-fond rounded-lg">
                      <BarChart3 className="w-5 h-5 text-etat-encours-texte" />
                      <span className="text-sm">Augmentation des maintenances préventives (+12%)</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-etat-alerte-fond rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-etat-alerte-texte" />
                      <span className="text-sm">Réduction des alertes critiques (-8%)</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-serif text-title font-medium text-ink mb-4">Résumé des Alertes</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Total alertes</span>
                      <Badge variant="outline">{selectedMonthlyReport.totalAlerts || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Alertes critiques</span>
                      <Badge variant="destructive">{selectedMonthlyReport.criticalAlerts || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Incidents sécurité</span>
                      <Badge variant="outline">{selectedMonthlyReport.safetyIncidents || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Problèmes qualité</span>
                      <Badge variant="outline">{selectedMonthlyReport.qualityIssues || 0}</Badge>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}