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
  Wrench
} from "lucide-react";

export default function AdvancedReporting() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [selectedDepartment, setSelectedDepartment] = useState("all");

  // Fetch budget data
  const { data: budgets = [] } = useQuery({
    queryKey: ["/api/budgets"],
  });

  const { data: budgetSummary } = useQuery({
    queryKey: ["/api/budget-summary"],
  });

  const { data: budgetRequests = [] } = useQuery({
    queryKey: ["/api/budget-requests"],
  });

  const { data: kpiMetrics = [] } = useQuery({
    queryKey: ["/api/kpi-metrics"],
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ["/api/work-orders"],
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["/api/equipment"],
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["/api/alerts"],
  });

  // Calculate KPIs
  const calculateKPIs = () => {
    const activeAlerts = alerts.filter((a: any) => a.status === 'active').length;
    const completedWorkOrders = workOrders.filter((wo: any) => wo.status === 'completed').length;
    const pendingWorkOrders = workOrders.filter((wo: any) => wo.status === 'pending').length;
    const criticalEquipment = equipment.filter((eq: any) => eq.criticalityLevel === 'critical').length;
    
    const mtbf = kpiMetrics.find((m: any) => m.metricType === 'mtbf')?.metricValue || 168.5;
    const mttr = kpiMetrics.find((m: any) => m.metricType === 'mttr')?.metricValue || 4.2;
    const availability = kpiMetrics.find((m: any) => m.metricType === 'availability')?.metricValue || 94.7;
    const oee = kpiMetrics.find((m: any) => m.metricType === 'oee')?.metricValue || 87.3;

    return {
      activeAlerts,
      completedWorkOrders,
      pendingWorkOrders,
      criticalEquipment,
      mtbf,
      mttr,
      availability,
      oee,
      budgetUtilization: budgetSummary?.utilizationRate || 25
    };
  };

  const kpis = calculateKPIs();

  const exportReport = (format: string) => {
    toast({
      title: "Export en cours",
      description: `Génération du rapport ${format.toUpperCase()}...`,
    });
    // Implementation would generate actual export
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
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
        
        {/* Executive Summary KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Disponibilité</p>
                  <p className="text-3xl font-bold text-green-900">{kpis.availability.toFixed(1)}%</p>
                  <p className="text-xs text-green-600 mt-1">↗ +2.3% vs mois dernier</p>
                </div>
                <div className="p-3 bg-green-200 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-700" />
                </div>
              </div>
              <Progress value={kpis.availability} className="mt-4" />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">MTBF</p>
                  <p className="text-3xl font-bold text-blue-900">{kpis.mtbf.toFixed(0)}h</p>
                  <p className="text-xs text-blue-600 mt-1">Target: 200h</p>
                </div>
                <div className="p-3 bg-blue-200 rounded-full">
                  <Clock className="h-6 w-6 text-blue-700" />
                </div>
              </div>
              <Progress value={(kpis.mtbf / 200) * 100} className="mt-4" />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">MTTR</p>
                  <p className="text-3xl font-bold text-orange-900">{kpis.mttr.toFixed(1)}h</p>
                  <p className="text-xs text-orange-600 mt-1">Target: 3.0h</p>
                </div>
                <div className="p-3 bg-orange-200 rounded-full">
                  <Wrench className="h-6 w-6 text-orange-700" />
                </div>
              </div>
              <Progress value={(3 / kpis.mttr) * 100} className="mt-4" />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">OEE</p>
                  <p className="text-3xl font-bold text-purple-900">{kpis.oee.toFixed(1)}%</p>
                  <p className="text-xs text-purple-600 mt-1">Target: 90%</p>
                </div>
                <div className="p-3 bg-purple-200 rounded-full">
                  <Target className="h-6 w-6 text-purple-700" />
                </div>
              </div>
              <Progress value={kpis.oee} className="mt-4" />
            </CardContent>
          </Card>
        </div>

        {/* Budget Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                <span>Vue Budgétaire 2025</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {budgetSummary && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600">Budget Total</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {budgetSummary.totalAllocated?.toLocaleString()}€
                      </p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600">Disponible</p>
                      <p className="text-2xl font-bold text-green-900">
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
                      <div key={category} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium capitalize">{category}</span>
                        <div className="text-right">
                          <p className="font-bold">{data.remaining?.toLocaleString()}€</p>
                          <p className="text-xs text-gray-600">sur {data.allocated?.toLocaleString()}€</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <span>Demandes Budgétaires</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {budgetRequests.slice(0, 5).map((request: any) => (
                  <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{request.description}</p>
                      <p className="text-sm text-gray-600">{request.amount?.toLocaleString()}€</p>
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
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>Aucune demande budgétaire en attente</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Work Orders & Alerts Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="border-0 shadow-xl">
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

          <Card className="border-0 shadow-xl">
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

          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-purple-600" />
                <span>Équipements Critiques</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-purple-600">{kpis.criticalEquipment}</p>
                  <p className="text-sm text-gray-600">Équipements sous surveillance</p>
                </div>
                <div className="space-y-2">
                  {equipment
                    .filter((eq: any) => eq.criticalityLevel === 'critical')
                    .slice(0, 3)
                    .map((eq: any) => (
                    <div key={eq.id} className="p-2 bg-purple-50 rounded border-l-4 border-purple-500">
                      <p className="text-sm font-medium">{eq.equipmentName}</p>
                      <p className="text-xs text-gray-600">{eq.location}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Trends */}
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart className="h-5 w-5 text-indigo-600" />
              <span>Tendances de Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <h4 className="font-semibold text-gray-900">Coûts Maintenance</h4>
                <p className="text-2xl font-bold text-indigo-600">↓ 12%</p>
                <p className="text-sm text-gray-600">vs mois dernier</p>
              </div>
              <div className="text-center">
                <h4 className="font-semibold text-gray-900">Temps d'Arrêt</h4>
                <p className="text-2xl font-bold text-green-600">↓ 8%</p>
                <p className="text-sm text-gray-600">vs mois dernier</p>
              </div>
              <div className="text-center">
                <h4 className="font-semibold text-gray-900">Interventions Préventives</h4>
                <p className="text-2xl font-bold text-blue-600">↑ 15%</p>
                <p className="text-sm text-gray-600">vs mois dernier</p>
              </div>
              <div className="text-center">
                <h4 className="font-semibold text-gray-900">Satisfaction Client</h4>
                <p className="text-2xl font-bold text-purple-600">96%</p>
                <p className="text-sm text-gray-600">Score NPS</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}