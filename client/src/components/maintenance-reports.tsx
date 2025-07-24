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
  totalCost?: number;
  laborCost?: number;
  partsCost?: number;
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
  equipmentAvailability?: number;
  totalWorkOrders?: number;
  completedWorkOrders?: number;
  preventiveWorkOrders?: number;
  correctiveWorkOrders?: number;
  averageCompletionTime?: number;
  mtbf?: number;
  mttr?: number;
  plannedMaintenanceRatio?: number;
  maintenanceEfficiency?: number;
  totalMaintenanceCost?: number;
  laborCost?: number;
  partsCost?: number;
  contractorCost?: number;
  costPerWorkOrder?: number;
  partsConsumed?: number;
  inventoryTurnover?: number;
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

export function MaintenanceReports() {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Approuvé</Badge>;
      case "draft":
        return <Badge className="bg-yellow-100 text-yellow-800">Brouillon</Badge>;
      case "generated":
        return <Badge className="bg-blue-100 text-blue-800">Généré</Badge>;
      case "reviewed":
        return <Badge className="bg-purple-100 text-purple-800">Révisé</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const getReportTypeBadge = (type: string) => {
    switch (type) {
      case "preventive":
        return <Badge className="bg-green-100 text-green-800">Préventive</Badge>;
      case "corrective":
        return <Badge className="bg-red-100 text-red-800">Corrective</Badge>;
      case "inspection":
        return <Badge className="bg-blue-100 text-blue-800">Inspection</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{type}</Badge>;
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatPercentage = (value?: number) => {
    if (!value) return "N/A";
    return `${value.toFixed(1)}%`;
  };

  const openAnalyticsModal = (report: MonthlyReport) => {
    setSelectedMonthlyReport(report);
    setShowAnalyticsModal(true);
  };

  const openChartsModal = (report: MonthlyReport) => {
    setSelectedMonthlyReport(report);
    setShowChartsModal(true);
  };

  const renderKpiCard = (title: string, value: string | number, icon: React.ReactNode, color: string) => (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
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
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="space-y-3">
          {Object.entries(data).map(([key, value], index) => {
            const percentage = total > 0 ? ((value as number) / total) * 100 : 0;
            const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500'];
            return (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${colors[index % colors.length]}`}></div>
                  <span className="text-sm">{key}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{value}</span>
                  <span className="text-xs text-muted-foreground">({percentage.toFixed(1)}%)</span>
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Rapports de Maintenance
          </h2>
          <p className="text-muted-foreground">Génération et consultation des rapports d'intervention et mensuels</p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={activeTab === "intervention" ? "default" : "outline"}
            onClick={() => setActiveTab("intervention")}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <FileText className="w-4 h-4 mr-2" />
            Rapports d'Intervention
          </Button>
          <Button
            variant={activeTab === "monthly" ? "default" : "outline"}
            onClick={() => setActiveTab("monthly")}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Rapports Mensuels
          </Button>
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                  <p className="mt-2 text-muted-foreground">Chargement des rapports...</p>
                </div>
              ) : (maintenanceReports as MaintenanceReport[]).length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Aucun rapport d'intervention disponible</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Les rapports sont générés automatiquement lors de la completion des ordres de travail
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {(maintenanceReports as MaintenanceReport[]).map((report: MaintenanceReport) => (
                    <Card key={report.id} className="border-l-4 border-l-purple-500">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-lg">{report.reportNumber}</h3>
                            <p className="text-sm text-muted-foreground">
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
                          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            {report.safetyIncidents && (
                              <div className="flex items-center gap-2 text-yellow-800">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="text-sm font-medium">Incident de sécurité signalé</span>
                              </div>
                            )}
                            {report.followUpRequired && (
                              <div className="flex items-center gap-2 text-yellow-800">
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
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-sm">Contrôle qualité validé</span>
                              </div>
                            )}
                          </div>
                          
                          <Button variant="outline" size="sm">
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
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-muted-foreground">Chargement des rapports mensuels...</p>
                </div>
              ) : (monthlyReports as MonthlyReport[]).length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Aucun rapport mensuel disponible</p>
                  <p className="text-sm text-muted-foreground mt-2">
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
                            <p className="text-muted-foreground">
                              Rapport pour {format(new Date(report.periodStart), "MMMM yyyy", { locale: fr })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Généré le {format(new Date(report.generatedAt), "dd/MM/yyyy à HH:mm", { locale: fr })}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge className="bg-blue-100 text-blue-800">
                              Score: {report.performanceScore || 0}/100
                            </Badge>
                            {getStatusBadge(report.status)}
                          </div>
                        </div>

                        {/* KPIs Grid */}
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                          <Card className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-green-100 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-green-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">Disponibilité</p>
                                <p className="text-2xl font-bold">{formatPercentage(report.equipmentAvailability)}</p>
                              </div>
                            </div>
                          </Card>

                          <Card className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 rounded-lg">
                                <Clock className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">MTBF</p>
                                <p className="text-2xl font-bold">{report.mtbf?.toFixed(1) || 0}h</p>
                              </div>
                            </div>
                          </Card>

                          <Card className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-orange-100 rounded-lg">
                                <Clock className="w-5 h-5 text-orange-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">MTTR</p>
                                <p className="text-2xl font-bold">{report.mttr?.toFixed(1) || 0}h</p>
                              </div>
                            </div>
                          </Card>

                          <Card className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-purple-100 rounded-lg">
                                <DollarSign className="w-5 h-5 text-purple-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">Coût Total</p>
                                <p className="text-2xl font-bold">{formatCurrency(report.totalMaintenanceCost)}</p>
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
                                <span className="font-medium text-red-600">{report.criticalAlerts || 0}</span>
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
                          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="font-medium text-blue-900 mb-2">Recommandations</h4>
                            <ul className="space-y-1">
                              {report.recommendations.map((rec, index) => (
                                <li key={index} className="text-sm text-blue-800 flex items-start gap-2">
                                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="mt-6 flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">
                              Généré par: {report.generatedBy || "Système"}
                            </span>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openAnalyticsModal(report)}
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
                            <Button variant="outline" size="sm">
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
    </div>
  );
}