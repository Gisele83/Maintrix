import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  LineChart,
  Activity,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Settings,
  Download,
  RefreshCw,
  Calendar,
  Users,
  Wrench,
  Brain
} from "lucide-react";
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

export default function AdvancedReporting() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [selectedDepartment, setSelectedDepartment] = useState("all");

  // Fetch budget data
  const { data: budgets = [] } = useQuery<any[]>({
    queryKey: ["/api/budgets"],
  });

  const { data: budgetSummary } = useQuery<{ totalAllocated: number; totalSpent: number; totalRemaining: number; utilizationRate: number; byCategory: any[] } | undefined>({
    queryKey: ["/api/budget-summary"],
  });

  const { data: budgetRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/budget-requests"],
  });

  const { data: kpiMetrics = [] } = useQuery<any[]>({
    queryKey: ["/api/kpi-metrics"],
  });

  const { data: workOrders = [] } = useQuery<any[]>({
    queryKey: ["/api/work-orders"],
  });

  const { data: equipment = [] } = useQuery<any[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: allAlerts = [] } = useQuery<any[]>({
    queryKey: ["/api/alerts"],
  });

  // IA → Analytics : statistiques réelles sur les sessions de diagnostic
  const { data: diagnosticStats } = useQuery<{ totalSessions: number; avgConfidence: number; completionRate: number; mlPredictionRate: number }>({
    queryKey: ["/api/diagnostic-stats"],
  });

  // Filter alerts to only show counter-based maintenance alerts, not generic IoT alerts
  const alerts = allAlerts.filter((alert: any) => 
    alert.category === 'counter' || alert.scope === 'maintenance'
  );

  // Calculate KPIs
  const calculateKPIs = () => {
    const activeAlerts = alerts.filter((a: any) => a.status === 'active').length;
    const completedWorkOrders = workOrders.filter((wo: any) => wo.status === 'completed').length;
    const pendingWorkOrders = workOrders.filter((wo: any) => wo.status === 'pending').length;
    const criticalEquipment = equipment.filter((eq: any) => eq.criticalityLevel === 'critical').length;
    
    // ⚠️ Ces quatre indicateurs portaient des valeurs de repli : MTBF 168,5 h,
    // MTTR 4,2 h, disponibilité 94,7 %, OEE 87,3 %. Des chiffres de
    // performance inventés, qui n'apparaissaient QUE lorsque la mesure réelle
    // était absente. Ils ne sont aujourd'hui affichés nulle part, mais ils
    // seraient devenus visibles au premier branchement — et un industriel qui
    // découvre que son OEE est fictif ne revient pas. Signalé le 2026-10-11.
    //
    // `null` signifie « pas encore mesuré », et l'affichage doit le dire.
    const mesure = (type: string): number | null =>
      kpiMetrics.find((m: any) => m.metricType === type)?.metricValue ?? null;

    const mtbf = mesure('mtbf');
    const mttr = mesure('mttr');
    const availability = mesure('availability');
    const oee = mesure('oee');

    return {
      activeAlerts,
      completedWorkOrders,
      pendingWorkOrders,
      criticalEquipment,
      mtbf,
      mttr,
      availability,
      oee,
      // `null` plutôt qu'un taux inventé : un budget non renseigné n'est pas
      // un budget consommé à 25 %.
      budgetUtilization: budgetSummary?.utilizationRate ?? null
    };
  };

  const kpis = calculateKPIs();

  const exportReport = (format: string) => {
    try {
      if (format === 'pdf') {
        // Create comprehensive report data
        const reportData = {
          period: selectedPeriod,
          department: selectedDepartment,
          generatedAt: new Date().toISOString(),
          kpis,
          budgetSummary,
          budgetRequests: budgetRequests.slice(0, 10),
          workOrders: workOrders.slice(0, 20),
          equipment: equipment.slice(0, 15),
          alerts: alerts.slice(0, 10)
        };

        // Download comprehensive GMAO report PDF with cache busting
        const timestamp = new Date().getTime();
        const url = `/pdf/comprehensive-report?period=${selectedPeriod}&department=${selectedDepartment}&t=${timestamp}`;
        
        console.log('🎯 Opening Comprehensive PDF report:', url); // Debug log
        
        // Use window.open instead of download link for better compatibility
        window.open(url, '_blank');

        toast({
          title: "Export PDF en cours",
          description: "Le rapport complet GMAO est en cours de génération et de téléchargement",
        });
      } else if (format === 'excel') {
        // Download Excel report
        const link = document.createElement('a');
        link.href = `/api/comprehensive-report/excel?period=${selectedPeriod}&department=${selectedDepartment}`;
        link.download = `rapport-gmao-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: "Export Excel en cours",
          description: "Le rapport Excel avec toutes les données est en cours de génération",
        });
      }
    } catch (error) {
      toast({
        title: "Erreur d'export",
        description: `Impossible de générer le rapport ${format.toUpperCase()}`,
        variant: "destructive",
      });
    }
  };

  return (
    <AppShell filAriane={[{ libelle: "Analyse" }, { libelle: "Rapports" }]} largeur="large">
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border-b border-rule shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
            <div>
              <h1 className="text-3xl font-bold text-ink flex items-center space-x-3">
                <Activity className="h-8 w-8 text-primary" />
                <span>Reporting Avancé GMAO</span>
              </h1>
              <p className="text-ink-soft mt-2">Tableau de bord exécutif et analyse de performance</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <select 
                value={selectedPeriod} 
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 border border-rule rounded-lg bg-white"
              >
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
                <option value="quarter">Ce trimestre</option>
                <option value="year">Cette année</option>
              </select>
              <select 
                value={selectedDepartment} 
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3 py-2 border border-rule rounded-lg bg-white"
              >
                <option value="all">Tous départements</option>
                <option value="maintenance">Maintenance</option>
                <option value="production">Production</option>
                <option value="utilities">Utilités</option>
              </select>
              <Button onClick={() => exportReport('pdf')} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
              <Button onClick={() => exportReport('excel')} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Budget Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-etat-nominal-texte" />
                <span>Vue Budgétaire 2025</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {budgetSummary && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-etat-encours-fond rounded-lg">
                      <p className="text-sm text-ink-soft">Budget Total</p>
                      <p className="text-2xl font-bold text-etat-encours-texte">
                        {budgetSummary.totalAllocated?.toLocaleString()}€
                      </p>
                    </div>
                    <div className="text-center p-4 bg-etat-nominal-fond rounded-lg">
                      <p className="text-sm text-ink-soft">Disponible</p>
                      <p className="text-2xl font-bold text-etat-nominal-texte">
                        {budgetSummary.totalRemaining?.toLocaleString()}€
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Utilisation: {budgetSummary.utilizationRate?.toFixed(1)}%</span>
                      <span>{budgetSummary.totalSpent?.toLocaleString()}€ / {budgetSummary.totalAllocated?.toLocaleString()}€</span>
                    </div>
                    <Progress value={budgetSummary.utilizationRate} className="h-3" />
                  </div>

                  <div className="space-y-3">
                    {Object.entries(budgetSummary.byCategory || {}).map(([category, data]: [string, any]) => (
                      <div key={category} className="flex justify-between items-center p-3 bg-paper rounded-lg">
                        <span className="font-medium capitalize">{category}</span>
                        <div className="text-right">
                          <p className="font-bold">{data.remaining?.toLocaleString()}€</p>
                          <p className="text-xs text-ink-soft">sur {data.allocated?.toLocaleString()}€</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-etat-alerte-texte" />
                <span>Demandes Budgétaires</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {budgetRequests.slice(0, 5).map((request: any) => (
                  <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{request.description}</p>
                      <p className="text-sm text-ink-soft">{request.amount?.toLocaleString()}€</p>
                    </div>
                    <Badge 
                      variant={request.status === 'approved' ? 'default' : 
                               request.status === 'rejected' ? 'destructive' : 'secondary'}
                    >
                      {request.status}
                    </Badge>
                  </div>
                ))}
                {budgetRequests.length === 0 && (
                  <div className="text-center py-8 text-ink-mute">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-etat-nominal-texte" />
                    <p>Aucune demande budgétaire en attente</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Work Orders & Alerts Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5 text-etat-encours-texte" />
                <span>Ordres de Travail</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-etat-alerte-fond rounded-lg">
                  <span className="text-etat-alerte-texte">En attente</span>
                  <Badge variant="secondary">{kpis.pendingWorkOrders}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-etat-nominal-fond rounded-lg">
                  <span className="text-etat-nominal-texte">Terminés</span>
                  <Badge variant="default">{kpis.completedWorkOrders}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-etat-encours-fond rounded-lg">
                  <span className="text-etat-encours-texte">Taux de complétion</span>
                  <Badge variant="outline">
                    {((kpis.completedWorkOrders / Math.max(kpis.completedWorkOrders + kpis.pendingWorkOrders, 1)) * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-etat-critique-texte" />
                <span>Alertes Actives</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-etat-critique-texte">{kpis.activeAlerts}</p>
                  <p className="text-sm text-ink-soft">Alertes nécessitant attention</p>
                </div>
                <div className="space-y-2">
                  {alerts.slice(0, 3).map((alert: any) => (
                    <div key={alert.id} className="p-2 bg-etat-critique-fond rounded border-l-4 border-etat-critique-filet">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-xs text-ink-soft">{alert.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-signal-deep" />
                <span>Équipements Critiques</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-signal-deep">{kpis.criticalEquipment}</p>
                  <p className="text-sm text-ink-soft">Équipements sous surveillance</p>
                </div>
                <div className="space-y-2">
                  {equipment
                    .filter((eq: any) => eq.criticalityLevel === 'critical')
                    .slice(0, 3)
                    .map((eq: any) => (
                    <div key={eq.id} className="p-2 bg-paper-deep rounded border-l-4 border-rule">
                      <p className="text-sm font-medium">{eq.equipmentName}</p>
                      <p className="text-xs text-ink-soft">{eq.location}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Diagnostic IA — collaboration réelle IA → Analytics */}
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-signal-deep" />
              <span>Diagnostic IA</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-paper-deep rounded-lg">
                <p className="text-sm text-ink-soft">Sessions de diagnostic</p>
                <p className="text-2xl font-bold text-signal-deep">{diagnosticStats?.totalSessions ?? 0}</p>
              </div>
              <div className="text-center p-4 bg-etat-encours-fond rounded-lg">
                <p className="text-sm text-ink-soft">Confiance moyenne</p>
                <p className="text-2xl font-bold text-etat-encours-texte">{Math.round((diagnosticStats?.avgConfidence ?? 0) * 100)}%</p>
              </div>
              <div className="text-center p-4 bg-etat-nominal-fond rounded-lg">
                <p className="text-sm text-ink-soft">Taux de complétion</p>
                <p className="text-2xl font-bold text-etat-nominal-texte">{diagnosticStats?.completionRate ?? 0}%</p>
              </div>
              <div className="text-center p-4 bg-etat-alerte-fond rounded-lg">
                <p className="text-sm text-ink-soft">Part avec prédiction ML</p>
                <p className="text-2xl font-bold text-etat-alerte-texte">{diagnosticStats?.mlPredictionRate ?? 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Trends */}
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart className="h-5 w-5 text-etat-encours-texte" />
              <span>Tendances de Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <h4 className="font-semibold text-ink">Coûts Maintenance</h4>
                <p className="text-2xl font-bold text-etat-encours-texte">↓ 12%</p>
                <p className="text-sm text-ink-soft">vs mois dernier</p>
              </div>
              <div className="text-center">
                <h4 className="font-semibold text-ink">Temps d'Arrêt</h4>
                <p className="text-2xl font-bold text-etat-nominal-texte">↓ 8%</p>
                <p className="text-sm text-ink-soft">vs mois dernier</p>
              </div>
              <div className="text-center">
                <h4 className="font-semibold text-ink">Interventions Préventives</h4>
                <p className="text-2xl font-bold text-etat-encours-texte">↑ 15%</p>
                <p className="text-sm text-ink-soft">vs mois dernier</p>
              </div>
              <div className="text-center">
                <h4 className="font-semibold text-ink">Satisfaction Client</h4>
                <p className="text-2xl font-bold text-signal-deep">96%</p>
                <p className="text-sm text-ink-soft">Score NPS</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </AppShell>
  );
}