import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Factory, Wrench, Package, CalendarCheck, Bell, BarChart3, 
  AlertTriangle, Clock, CheckCircle, TrendingUp, Activity,
  Cog, Users, Smartphone, Brain, Database, Zap, Plus, 
  Search, Filter, Eye, Edit, Trash2, ShoppingCart, Target,
  PieChart, DollarSign, Gauge, ClipboardCheck, FileText
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Header } from "@/components/header";
import { useLanguage } from "@/hooks/use-language";
import { t } from "@/lib/i18n";
import { ProcurementDashboard } from "@/components/procurement-dashboard";
import { EquipmentManagement } from "@/components/equipment-management";
import { WorkOrderManagement } from "@/components/work-order-management";
import { PreventiveMaintenance } from "@/components/preventive-maintenance";
import InventoryManagement from "@/components/inventory-simple";
import { MaintenanceReports } from "@/components/maintenance-reports";
import ValidationDashboard from "@/components/validation-dashboard-simple";
import PurchaseOrderWorkflowDemo from "@/components/purchase-order-workflow-demo";
import { CompanyLetterheadConfig } from "@/components/company-letterhead-config";
import ThresholdConfiguration from "@/components/threshold-configuration";
import PurchaseOrderCreator from "@/components/purchase-order-creator";
import { EquipmentHealthDashboard } from "@/components/equipment-health-dashboard";
import { HistoryManagement } from "@/components/history-management";


interface GMAODashboardData {
  equipmentCount: number;
  activeWorkOrdersCount: number;
  pendingWorkOrdersCount: number;
  criticalAlertsCount: number;
  lowStockPartsCount: number;
  recentWorkOrders: any[];
  recentAlerts: any[];
  equipmentByType: Record<string, number>;
  workOrdersByStatus: Record<string, number>;
}

type GMAOTab = "overview" | "work-orders" | "equipment" | "inventory" | "alerts";
type AdminTab = "maintenance" | "history" | "procurement" | "reports" | "analytics" | "health-dashboard" | "validation" | "company-config";

export default function GMAODashboard() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<GMAOTab>("overview");
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);

  // Fetch GMAO dashboard data
  const { data: dashboardData, isLoading } = useQuery<GMAODashboardData>({
    queryKey: ["/api/gmao-dashboard"],
  });

  const tabs = [
    {
      id: "overview" as GMAOTab,
      label: "Vue d'ensemble",
      icon: BarChart3,
    },
    {
      id: "work-orders" as GMAOTab,
      label: "Ordres de Travail",
      icon: Wrench,
    },
    {
      id: "equipment" as GMAOTab,
      label: "Équipements",
      icon: Factory,
    },
    {
      id: "inventory" as GMAOTab,
      label: "Inventaire",
      icon: Package,
    },
    {
      id: "alerts" as GMAOTab,
      label: "Alertes",
      icon: Bell,
    },
  ];

  const adminTabs = [
    { id: "maintenance" as AdminTab, label: "Maintenance Préventive", icon: CalendarCheck },
    { id: "history" as AdminTab, label: "Historique", icon: FileText },
    { id: "procurement" as AdminTab, label: "Achats", icon: ShoppingCart },
    { id: "reports" as AdminTab, label: "Rapports", icon: BarChart3 },
    { id: "analytics" as AdminTab, label: "Analytiques", icon: TrendingUp },
    { id: "health-dashboard" as AdminTab, label: "Santé Équipements", icon: Activity },
    { id: "validation" as AdminTab, label: "Validation Multi-Niveaux", icon: ClipboardCheck },
    { id: "company-config" as AdminTab, label: "Configuration Entreprise", icon: Cog },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <Header />
      

      {/* Navigation Tabs */}
      <nav className="bg-card/80 backdrop-blur-sm border-b sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setShowAdminModal(false);
                    setActiveAdminTab(null);
                  }}
                  className={`flex items-center space-x-2 px-3 py-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id && !showAdminModal
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${
                    activeTab === tab.id && !showAdminModal ? "text-primary" : "text-muted-foreground"
                  }`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
            
            {/* Menu Plus/Admin */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowAdminModal(!showAdminModal);
                  if (!showAdminModal) {
                    setActiveAdminTab("maintenance");
                  }
                }}
                className={`flex items-center space-x-2 px-3 py-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  showAdminModal
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                }`}
              >
                <Cog className={`w-4 h-4 ${
                  showAdminModal ? "text-primary" : "text-muted-foreground"
                }`} />
                <span>Plus</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Menu Admin Dropdown */}
      {showAdminModal && (
        <div className="bg-card border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-4 py-3 overflow-x-auto">
              {adminTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveAdminTab(tab.id)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md font-medium text-sm whitespace-nowrap transition-colors ${
                      activeAdminTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Vue d'ensemble uniquement */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Équipements Actifs
                  </CardTitle>
                  <Factory className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {dashboardData?.equipmentCount || 0}
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    +2 ce mois
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    OT Actifs
                  </CardTitle>
                  <Wrench className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {dashboardData?.activeWorkOrdersCount || 0}
                  </div>
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    -5 depuis hier
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
                    Alertes Critiques
                  </CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                    {dashboardData?.criticalAlertsCount || 0}
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    +1 aujourd'hui
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    Stock Faible
                  </CardTitle>
                  <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {dashboardData?.lowStockPartsCount || 0}
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    Réapprovisionnement nécessaire
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts and Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Work Orders by Status - Simplified */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Wrench className="w-5 h-5" />
                    <span>Statut des OT</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboardData?.workOrdersByStatus && Object.entries(dashboardData.workOrdersByStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${
                            status === 'pending' ? 'bg-orange-500' :
                            status === 'in_progress' ? 'bg-blue-500' :
                            status === 'completed' ? 'bg-green-500' : 'bg-gray-500'
                          }`} />
                          <span className="text-sm font-medium capitalize">{status.replace('_', ' ')}</span>
                        </div>
                        <span className="text-sm font-bold">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Work Orders */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Wrench className="w-5 h-5" />
                    <span>Ordres de Travail Récents</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboardData?.recentWorkOrders?.slice(0, 3).map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{order.title}</p>
                          <p className="text-xs text-muted-foreground">#{order.orderNumber}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getPriorityColor(order.priority)}>
                            {order.priority}
                          </Badge>
                          <Badge className={getStatusColor(order.status)}>
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                    )) || (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucun ordre de travail récent
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>


            </div>
          </div>
        )}

        {/* Équipements uniquement */}
        {activeTab === "equipment" && (
          <EquipmentManagement />
        )}

        {/* Ordres de travail uniquement */}
        {activeTab === "work-orders" && (
          <WorkOrderManagement />
        )}

        {/* Inventaire uniquement */}
        {activeTab === "inventory" && (
          <InventoryManagement />
        )}
        
        {/* Alertes uniquement */}
        {activeTab === "alerts" && (
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold">Centre d'Alertes</h2>
            <p className="text-gray-600 mt-2">Gestion des alertes système en cours de développement</p>
          </div>
        )}

        {/* Admin Tabs - Only show if activeAdminTab is set */}
        {showAdminModal && activeAdminTab === "maintenance" && (
          <PreventiveMaintenance />
        )}

        {showAdminModal && activeAdminTab === "history" && (
          <HistoryManagement />
        )}

        {showAdminModal && activeAdminTab === "procurement" && (
          <div className="space-y-6">
            <PurchaseOrderCreator />
            <ProcurementDashboard />
          </div>
        )}

        {showAdminModal && activeAdminTab === "reports" && (
          <MaintenanceReports />
        )}

        {showAdminModal && activeAdminTab === "analytics" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Analytiques et KPI</h2>

            {/* Performance Trends */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Tendances de Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Efficacité Maintenance</span>
                      <span className="font-medium">87.3%</span>
                    </div>
                    <Progress value={87.3} className="h-2" />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Taux Préventif</span>
                      <span className="font-medium">68.5%</span>
                    </div>
                    <Progress value={68.5} className="h-2" />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Satisfaction Qualité</span>
                      <span className="font-medium">92.1%</span>
                    </div>
                    <Progress value={92.1} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Objectifs vs Réalisé
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Disponibilité Cible: 95%</span>
                        <span className="font-medium text-green-600">94.7%</span>
                      </div>
                      <Progress value={94.7} max={95} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">MTBF Cible: 180h</span>
                        <span className="font-medium text-blue-600">168h</span>
                      </div>
                      <Progress value={168} max={180} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Budget Maintenance: €50K</span>
                        <span className="font-medium text-green-600">€47.2K</span>
                      </div>
                      <Progress value={47.2} max={50} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Analytics Actions */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="text-center py-8">
                    <BarChart3 className="w-12 h-12 mx-auto text-blue-600 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Analyses Détaillées</h3>
                    <p className="text-muted-foreground mb-4">
                      Rapports avancés, prédictions IA et recommandations
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => setShowAnalyticsModal(true)}
                    >
                      Voir les analyses
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="text-center py-8">
                    <PieChart className="w-12 h-12 mx-auto text-purple-600 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Tableaux de Bord</h3>
                    <p className="text-muted-foreground mb-4">
                      Visualisations interactives et métriques temps réel
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => setShowAnalyticsModal(true)}
                    >
                      Voir les graphiques
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}


        {showAdminModal && activeAdminTab === "health-dashboard" && (
          <EquipmentHealthDashboard />
        )}

        {showAdminModal && activeAdminTab === "validation" && (
          <div className="space-y-6">
            <PurchaseOrderWorkflowDemo 
              currentUserRole="Chef de Service"
              validationLevel={1}
            />
            <ValidationDashboard
              userId={1}
              userRole="Chef de Service"
              validationLevel={1}
              canValidateWorkOrders={true}
              canValidatePurchaseOrders={true}
            />
          </div>
        )}

        {showAdminModal && activeAdminTab === "company-config" && (
          <div className="space-y-6">
            <ThresholdConfiguration />
            <CompanyLetterheadConfig />
          </div>
        )}
      </main>

      {/* Alerts Modal */}
      <Dialog open={showAlertsModal} onOpenChange={setShowAlertsModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Toutes les Alertes
            </DialogTitle>
            <DialogDescription>
              Centre de gestion des alertes et notifications IoT
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {dashboardData?.recentAlerts?.map((alert) => (
              <Card key={alert.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <h4 className="font-semibold">{alert.title}</h4>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <span>#{alert.id}</span>
                        <span>•</span>
                        <span>{new Date(alert.timestamp).toLocaleString('fr-FR')}</span>
                      </div>
                    </div>
                    <Badge className={`${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                      alert.severity === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' :
                      alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                    }`}>
                      {alert.severity}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )) || (
              <p className="text-center py-8 text-muted-foreground">
                Aucune alerte disponible
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Analytics Modal */}
      <Dialog open={showAnalyticsModal} onOpenChange={setShowAnalyticsModal}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Analyses Détaillées de Performance
            </DialogTitle>
            <DialogDescription>
              Rapports avancés, prédictions IA et recommandations pour optimiser la maintenance
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Advanced KPIs */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Efficacité Globale</h3>
                  <Gauge className="w-5 h-5 text-blue-600" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">OEE (Overall Equipment Effectiveness)</span>
                    <span className="font-medium">78.4%</span>
                  </div>
                  <Progress value={78.4} className="h-2" />
                  
                  <div className="flex justify-between">
                    <span className="text-sm">Taux d'utilisation</span>
                    <span className="font-medium">85.2%</span>
                  </div>
                  <Progress value={85.2} className="h-2" />
                  
                  <div className="flex justify-between">
                    <span className="text-sm">Taux de performance</span>
                    <span className="font-medium">92.1%</span>
                  </div>
                  <Progress value={92.1} className="h-2" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Coûts & Budget</h3>
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Coût par heure productive</span>
                    <span className="font-medium">€127</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm">Économies préventif vs correctif</span>
                    <span className="font-medium text-green-600">€12.3K</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm">ROI maintenance prédictive</span>
                    <span className="font-medium text-green-600">+24%</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Prédictions IA</h3>
                  <Brain className="w-5 h-5 text-purple-600" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Pannes évitées ce mois</span>
                    <span className="font-medium">7</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm">Précision prédictions</span>
                    <span className="font-medium">94.3%</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm">Alertes précoces actives</span>
                    <span className="font-medium text-orange-600">3</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Detailed Analytics Charts */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Analyse des Tendances</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium">Amélioration continue</p>
                      <p className="text-sm text-muted-foreground">MTBF en hausse de 12% sur 3 mois</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <Activity className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Optimisation des coûts</p>
                      <p className="text-sm text-muted-foreground">Réduction de 8% des coûts de maintenance</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                    <Brain className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="font-medium">IA Performance</p>
                      <p className="text-sm text-muted-foreground">Modèles prédictifs améliorés de 15%</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Recommandations Prioritaires</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-medium mt-0.5">
                      1
                    </div>
                    <div>
                      <p className="font-medium text-yellow-900">Optimiser planning préventif</p>
                      <p className="text-sm text-yellow-800">Réduire MTTR de 15% avec planification avancée</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium mt-0.5">
                      2
                    </div>
                    <div>
                      <p className="font-medium text-blue-900">Formation équipes</p>
                      <p className="text-sm text-blue-800">Améliorer compétences sur équipements critiques</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium mt-0.5">
                      3
                    </div>
                    <div>
                      <p className="font-medium text-green-900">Expansion IoT</p>
                      <p className="text-sm text-green-800">Ajouter capteurs sur 3 équipements critiques</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Performance Benchmarks */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Comparaison Sectorielle</h3>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">94.7%</p>
                  <p className="text-sm text-muted-foreground">Votre disponibilité</p>
                  <p className="text-xs text-green-600">+2.1% vs secteur</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">168h</p>
                  <p className="text-sm text-muted-foreground">Votre MTBF</p>
                  <p className="text-xs text-blue-600">+18h vs secteur</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">4.2h</p>
                  <p className="text-sm text-muted-foreground">Votre MTTR</p>
                  <p className="text-xs text-purple-600">-1.3h vs secteur</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">€127</p>
                  <p className="text-sm text-muted-foreground">Coût/h productive</p>
                  <p className="text-xs text-yellow-600">-€15 vs secteur</p>
                </div>
              </div>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alerts Modal */}
      <Dialog open={showAlertsModal} onOpenChange={setShowAlertsModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Centre d'Alertes Intelligent
            </DialogTitle>
            <DialogDescription>
              Notifications temps réel et alertes prédictives basées sur l'IA
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Alert Summary */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="p-4 border-l-4 border-l-red-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Critiques</p>
                    <p className="text-2xl font-bold text-red-600">3</p>
                  </div>
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </Card>
              
              <Card className="p-4 border-l-4 border-l-yellow-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Importantes</p>
                    <p className="text-2xl font-bold text-yellow-600">7</p>
                  </div>
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                </div>
              </Card>
              
              <Card className="p-4 border-l-4 border-l-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Prédictives</p>
                    <p className="text-2xl font-bold text-blue-600">5</p>
                  </div>
                  <Brain className="w-6 h-6 text-blue-600" />
                </div>
              </Card>
              
              <Card className="p-4 border-l-4 border-l-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Résolues</p>
                    <p className="text-2xl font-bold text-green-600">12</p>
                  </div>
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </Card>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
