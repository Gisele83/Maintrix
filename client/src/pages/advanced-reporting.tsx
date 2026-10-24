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

export default function AdvancedReporting() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [selectedDepartment, setSelectedDepartment] = useState("all");

  // Fetch budget data
  const { data: budgets = [] } = useQuery<any[]>({
    queryKey: ["/api/budgets"],
  });

  // ⚠️ Cette page interrogeait /api/budget-summary et /api/budget-requests, qui
  // étaient servis par `server/budget-management.ts` depuis deux tableaux EN
  // MÉMOIRE, codés en dur sous le commentaire « Sample budget data for
  // demonstration » : 325 000 € de budget, 189 100 € disponibles, deux demandes
  // d'achat nominatives. Chaque testeur et chaque locataire les voyait comme
  // étant les siens — et les voyait TOUS À L'IDENTIQUE, les tableaux étant
  // partagés par l'ensemble de l'instance.
  //
  // Le module a été supprimé. /api/budgets/stats lit les vraies tables
  // `budget_plans` / `budget_transactions`, filtrées par locataire et par
  // exercice. Il ne connaît pas la notion de « demande budgétaire » : aucune
  // table ne la porte, ce qui n'existait donc que dans le tableau fabriqué.
  const exerciceCourant = new Date().getFullYear();

  const { data: budgetStats } = useQuery<{
    totalAllocated: number;
    totalSpent: number;
    totalCommitted: number;
    byType: Array<{ budget_type: string; allocated: string; spent: string }>;
  } | undefined>({
    queryKey: ["/api/budgets/stats"],
  });

  const budget = (() => {
    if (!budgetStats) return undefined;
    const alloue = Number(budgetStats.totalAllocated) || 0;
    const depense = Number(budgetStats.totalSpent) || 0;
    const engage = Number(budgetStats.totalCommitted) || 0;
    return {
      alloue,
      depense,
      engage,
      disponible: alloue - depense - engage,
      // Un budget non renseigné n'est pas un budget consommé à 0 % : sans
      // enveloppe allouée, le taux n'a pas de valeur, il n'existe pas.
      utilisation: alloue > 0 ? (depense / alloue) * 100 : null,
      parType: budgetStats.byType ?? [],
    };
  })();

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
      budgetUtilization: budget?.utilisation ?? null
    };
  };

  const kpis = calculateKPIs();

  /**
   * Tendances mois courant / mois précédent.
   *
   * ⚠️ Les quatre tuiles « Tendances de Performance » affichaient ↓ 12 %,
   * ↓ 8 %, ↑ 15 % et 96 % de satisfaction — quatre littéraux écrits dans le
   * JSX, identiques pour tout le monde et insensibles aux données. Un
   * industriel qui voit « coûts de maintenance en baisse de 12 % » sur un parc
   * qu'il vient de créer n'a aucune raison de refaire confiance au reste.
   *
   * Deux de ces quatre grandeurs se calculent vraiment à partir des ordres de
   * travail que cette page charge déjà. Les deux autres n'ont aucune source
   * dans Maintrix et le disent.
   */
  const tendances = (() => {
    const maintenant = new Date();
    const moisDe = (d: Date) => d.getFullYear() * 12 + d.getMonth();
    const moisCourant = moisDe(maintenant);

    const clos = workOrders.filter((wo: any) => wo.status === 'completed' && wo.actualEnd);
    const parMois = (decalage: number) =>
      clos.filter((wo: any) => moisDe(new Date(wo.actualEnd)) === moisCourant - decalage);

    const ceMois = parMois(0);
    const moisPrecedent = parMois(1);

    const cumulCout = (lot: any[]) =>
      lot.reduce((s: number, wo: any) => s + (parseFloat(wo.cost ?? '0') || 0), 0);

    // Une variation n'a de sens que si le mois de référence existe ET porte un
    // coût non nul : sinon on diviserait par zéro, ou on annoncerait « +∞ % ».
    const coutPrecedent = cumulCout(moisPrecedent);
    const variationCout = moisPrecedent.length > 0 && coutPrecedent > 0
      ? ((cumulCout(ceMois) - coutPrecedent) / coutPrecedent) * 100
      : null;

    // Part du préventif sur le mois : indicateur de pilotage standard en GMAO.
    const partPreventif = ceMois.length > 0
      ? (ceMois.filter((wo: any) => wo.orderType === 'preventive').length / ceMois.length) * 100
      : null;

    return { variationCout, partPreventif, interventionsClosesCeMois: ceMois.length };
  })();

  const exportReport = (format: string) => {
    try {
      if (format === 'pdf') {
        // Create comprehensive report data
        const reportData = {
          period: selectedPeriod,
          department: selectedDepartment,
          generatedAt: new Date().toISOString(),
          kpis,
          budget,
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
    <div className="min-h-screen bg-paper-deep">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
                <Activity className="h-8 w-8 text-primary" />
                <span>Reporting Avancé GMAO</span>
              </h1>
              <p className="text-gray-600 mt-2">Tableau de bord exécutif et analyse de performance</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <select 
                value={selectedPeriod} 
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
                <option value="quarter">Ce trimestre</option>
                <option value="year">Cette année</option>
              </select>
              <select 
                value={selectedDepartment} 
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
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
                <DollarSign className="h-5 w-5 text-green-600" />
                <span>Vue budgétaire {exerciceCourant}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {budget && budget.alloue > 0 ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-paper-deep rounded-lg">
                      <p className="text-sm text-ink-soft">Budget alloué</p>
                      <p className="text-2xl font-bold text-ink">
                        {budget.alloue.toLocaleString('fr-FR')} €
                      </p>
                    </div>
                    <div className="text-center p-4 bg-paper-deep rounded-lg">
                      <p className="text-sm text-ink-soft">Disponible</p>
                      <p className="text-2xl font-bold text-ink">
                        {budget.disponible.toLocaleString('fr-FR')} €
                      </p>
                      <p className="text-xs text-ink-mute mt-1">
                        alloué − dépensé − engagé
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Utilisation : {budget.utilisation!.toFixed(1)} %</span>
                      <span>
                        {budget.depense.toLocaleString('fr-FR')} € / {budget.alloue.toLocaleString('fr-FR')} €
                      </span>
                    </div>
                    <Progress value={budget.utilisation!} className="h-3" />
                  </div>

                  <div className="space-y-3">
                    {budget.parType.map((ligne) => {
                      const alloue = Number(ligne.allocated) || 0;
                      const depense = Number(ligne.spent) || 0;
                      return (
                        <div key={ligne.budget_type} className="flex justify-between items-center p-3 bg-paper rounded-lg">
                          <span className="font-medium capitalize">{ligne.budget_type}</span>
                          <div className="text-right">
                            <p className="font-bold">{(alloue - depense).toLocaleString('fr-FR')} €</p>
                            <p className="text-xs text-ink-soft">sur {alloue.toLocaleString('fr-FR')} €</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm text-ink-soft py-6">
                  <p>Aucun budget n'est défini pour l'exercice {exerciceCourant}.</p>
                  <p className="text-ink-mute">
                    Les montants affichés ici proviennent des enveloppes saisies dans
                    le module Budget. Tant qu'aucune n'est créée, il n'y a rien à
                    afficher — et rien à supposer.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <span>Demandes budgétaires</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* ⚠️ Cette carte listait « Remplacement roulements moteur
                  principal — 3 500 € — pending » et « Pièces détachées pompe
                  hydraulique — 850 € — approved ». Deux demandes inventées,
                  identiques chez tous les locataires.

                  Et son état vide affirmait « Aucune demande budgétaire en
                  attente », coche verte à l'appui — une affirmation, pas un
                  constat : aucune table ne stocke de demande budgétaire, donc
                  la plateforme ne peut pas savoir s'il y en a. Dire « aucune »
                  quand on ne mesure rien est la même faute que d'en inventer
                  deux. */}
              <div className="space-y-2 text-sm text-ink-soft py-6">
                <p>Les demandes budgétaires ne sont pas encore gérées par la plateforme.</p>
                <p className="text-ink-mute">
                  Le circuit d'engagement de dépense (demande, seuils d'approbation,
                  rattachement à un ordre de travail ou à un bon de commande) reste à
                  construire. Les engagements déjà saisis apparaissent dans la vue
                  budgétaire ci-contre, sous « engagé ».
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Work Orders & Alerts Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5 text-blue-600" />
                <span>Ordres de Travail</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <span className="text-yellow-700">En attente</span>
                  <Badge variant="secondary">{kpis.pendingWorkOrders}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-green-700">Terminés</span>
                  <Badge variant="default">{kpis.completedWorkOrders}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="text-blue-700">Taux de complétion</span>
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
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span>Alertes Actives</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-red-600">{kpis.activeAlerts}</p>
                  <p className="text-sm text-gray-600">Alertes nécessitant attention</p>
                </div>
                <div className="space-y-2">
                  {alerts.slice(0, 3).map((alert: any) => (
                    <div key={alert.id} className="p-2 bg-red-50 rounded border-l-4 border-red-500">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-xs text-gray-600">{alert.message}</p>
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
                  <p className="text-sm text-gray-600">Équipements sous surveillance</p>
                </div>
                <div className="space-y-2">
                  {equipment
                    .filter((eq: any) => eq.criticalityLevel === 'critical')
                    .slice(0, 3)
                    .map((eq: any) => (
                    <div key={eq.id} className="p-2 bg-paper-deep rounded border-l-4 border-rule">
                      <p className="text-sm font-medium">{eq.equipmentName}</p>
                      <p className="text-xs text-gray-600">{eq.location}</p>
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
                <p className="text-sm text-gray-600">Sessions de diagnostic</p>
                <p className="text-2xl font-bold text-signal-deep">{diagnosticStats?.totalSessions ?? 0}</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Confiance moyenne</p>
                <p className="text-2xl font-bold text-blue-900">{Math.round((diagnosticStats?.avgConfidence ?? 0) * 100)}%</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">Taux de complétion</p>
                <p className="text-2xl font-bold text-green-900">{diagnosticStats?.completionRate ?? 0}%</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <p className="text-sm text-gray-600">Part avec prédiction ML</p>
                <p className="text-2xl font-bold text-amber-900">{diagnosticStats?.mlPredictionRate ?? 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Trends */}
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart className="h-5 w-5 text-indigo-600" />
              <span>Tendances de Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <h4 className="font-semibold text-ink">Coût des interventions</h4>
                {tendances.variationCout === null ? (
                  <>
                    <p className="text-2xl font-bold text-ink-mute">—</p>
                    <p className="text-sm text-ink-mute">pas de mois de référence</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-ink">
                      {tendances.variationCout >= 0 ? '↑' : '↓'}{' '}
                      {Math.abs(tendances.variationCout).toFixed(0)} %
                    </p>
                    <p className="text-sm text-ink-soft">vs mois précédent</p>
                  </>
                )}
              </div>
              <div className="text-center">
                <h4 className="font-semibold text-ink">Part du préventif</h4>
                {tendances.partPreventif === null ? (
                  <>
                    <p className="text-2xl font-bold text-ink-mute">—</p>
                    <p className="text-sm text-ink-mute">aucune intervention close ce mois</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-ink">
                      {tendances.partPreventif.toFixed(0)} %
                    </p>
                    <p className="text-sm text-ink-soft">
                      sur {tendances.interventionsClosesCeMois} intervention
                      {tendances.interventionsClosesCeMois > 1 ? 's' : ''} ce mois
                    </p>
                  </>
                )}
              </div>
              <div className="text-center">
                <h4 className="font-semibold text-ink-mute">Temps d'arrêt</h4>
                <p className="text-2xl font-bold text-ink-mute">—</p>
                <p className="text-sm text-ink-mute">
                  non mesuré : les arrêts de production ne sont pas enregistrés
                </p>
              </div>
              <div className="text-center">
                <h4 className="font-semibold text-ink-mute">Satisfaction</h4>
                <p className="text-2xl font-bold text-ink-mute">—</p>
                <p className="text-sm text-ink-mute">
                  non mesuré : aucune enquête n'est collectée
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}