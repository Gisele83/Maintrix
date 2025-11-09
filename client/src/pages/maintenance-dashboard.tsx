import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Wrench, 
  Settings, 
  BarChart3, 
  PieChart,
  Calendar,
  Target,
  DollarSign,
  Gauge,
  Users,
  Package,
  Zap,
  Eye,
  Download,
  RefreshCw,
  Filter,
  Search
} from "lucide-react";

interface MaintenanceMetrics {
  totalWorkOrders: number;
  completedWorkOrders: number;
  pendingWorkOrders: number;
  overdueWorkOrders: number;
  avgCompletionTime: number;
  mtbf: number; // Mean Time Between Failures
  mttr: number; // Mean Time To Repair
  oee: number; // Overall Equipment Effectiveness
  availability: number;
  reliability: number;
  plannedMaintenanceRate: number;
  maintenanceCosts: number;
  costSavings: number;
  activeAlerts: number;
  criticalAlerts: number;
  technicianUtilization: number;
  equipmentHealth: number;
}

interface WorkOrderTrend {
  month: string;
  completed: number;
  planned: number;
  emergency: number;
}

interface EquipmentStatus {
  id: string;
  name: string;
  status: "operational" | "maintenance" | "down" | "critical";
  healthScore: number;
  lastMaintenance: string;
  nextMaintenance: string;
  mtbf: number;
  utilization: number;
}

interface MaintenanceCost {
  category: string;
  amount: number;
  percentage: number;
  trend: "up" | "down" | "stable";
}

export default function MaintenanceDashboard() {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [refreshing, setRefreshing] = useState(false);

  // Sample data - in real app this would come from API
  const metrics: MaintenanceMetrics = {
    totalWorkOrders: 156,
    completedWorkOrders: 142,
    pendingWorkOrders: 12,
    overdueWorkOrders: 2,
    avgCompletionTime: 4.2,
    mtbf: 720, // hours
    mttr: 2.8, // hours
    oee: 87.5, // percentage
    availability: 94.2,
    reliability: 92.8,
    plannedMaintenanceRate: 78.5,
    maintenanceCosts: 125800,
    costSavings: 34500,
    activeAlerts: 8,
    criticalAlerts: 2,
    technicianUtilization: 85.3,
    equipmentHealth: 89.2
  };

  const workOrderTrends: WorkOrderTrend[] = [
    { month: "Oct", completed: 28, planned: 22, emergency: 6 },
    { month: "Nov", completed: 32, planned: 26, emergency: 4 },
    { month: "Déc", completed: 35, planned: 28, emergency: 5 },
    { month: "Jan", completed: 38, planned: 31, emergency: 3 },
  ];

  const equipmentStatus: EquipmentStatus[] = [
    {
      id: "1",
      name: "Moteur Principal L1",
      status: "operational",
      healthScore: 92,
      lastMaintenance: "2024-01-15",
      nextMaintenance: "2024-02-15",
      mtbf: 680,
      utilization: 87.5
    },
    {
      id: "2",
      name: "Pompe Hydraulique P-001",
      status: "critical",
      healthScore: 65,
      lastMaintenance: "2024-01-08",
      nextMaintenance: "2024-02-08",
      mtbf: 420,
      utilization: 91.2
    },
    {
      id: "3",
      name: "Compresseur Air",
      status: "maintenance",
      healthScore: 78,
      lastMaintenance: "2024-01-20",
      nextMaintenance: "2024-04-20",
      mtbf: 850,
      utilization: 0
    },
    {
      id: "4",
      name: "Convoyeur L2",
      status: "operational",
      healthScore: 88,
      lastMaintenance: "2024-01-10",
      nextMaintenance: "2024-02-10",
      mtbf: 720,
      utilization: 94.8
    }
  ];

  const maintenanceCosts: MaintenanceCost[] = [
    { category: "Pièces détachées", amount: 45200, percentage: 36, trend: "down" },
    { category: "Main d'œuvre", amount: 38600, percentage: 31, trend: "stable" },
    { category: "Maintenance préventive", amount: 25800, percentage: 20, trend: "up" },
    { category: "Urgences", amount: 16200, percentage: 13, trend: "down" }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational": return "bg-green-500";
      case "maintenance": return "bg-yellow-500";
      case "down": return "bg-gray-500";
      case "critical": return "bg-red-500";
      default: return "bg-gray-400";
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      operational: { label: "Opérationnel", variant: "default" as const },
      maintenance: { label: "Maintenance", variant: "secondary" as const },
      down: { label: "Arrêté", variant: "destructive" as const },
      critical: { label: "Critique", variant: "destructive" as const }
    };
    return config[status as keyof typeof config];
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up": return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "down": return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <div className="h-4 w-4" />;
    }
  };

  const handleRefreshData = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      toast({
        title: "Données actualisées",
        description: "Le tableau de bord a été mis à jour avec les dernières données.",
      });
    }, 2000);
  };

  const handleExportReport = () => {
    try {
      // Generate maintenance dashboard report
      const reportContent = generateMaintenanceDashboardReport();
      
      // Create and download the report
      const blob = new Blob([reportContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tableau-bord-maintenance-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export terminé",
        description: "Le rapport du tableau de bord maintenance a été téléchargé avec succès",
      });
    } catch (error) {
      toast({
        title: "Erreur d'export",
        description: "Impossible de générer le rapport de maintenance",
        variant: "destructive",
      });
    }
  };

  // Generate HTML report for maintenance dashboard
  const generateMaintenanceDashboardReport = () => {
    const currentDate = new Date().toLocaleDateString('fr-FR', {
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
        <title>Tableau de Bord Maintenance - Maintrix</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; line-height: 1.6; }
          .header { text-align: center; border-bottom: 3px solid #3B82F6; padding-bottom: 20px; margin-bottom: 30px; }
          .company-name { font-size: 32px; font-weight: bold; color: #3B82F6; margin-bottom: 10px; }
          .report-title { font-size: 24px; color: #374151; margin-bottom: 10px; }
          .report-date { font-size: 16px; color: #6B7280; }
          .section { margin-bottom: 40px; }
          .section-title { font-size: 20px; font-weight: bold; color: #3B82F6; border-bottom: 2px solid #E5E7EB; padding-bottom: 8px; margin-bottom: 25px; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 25px; margin-bottom: 30px; }
          .kpi-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 25px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .kpi-title { font-size: 14px; color: #6B7280; margin-bottom: 10px; text-transform: uppercase; font-weight: 600; }
          .kpi-value { font-size: 32px; font-weight: bold; color: #1F2937; margin-bottom: 8px; }
          .kpi-trend { font-size: 14px; font-weight: 500; }
          .kpi-trend.positive { color: #10B981; }
          .kpi-trend.negative { color: #EF4444; }
          .kpi-trend.neutral { color: #6B7280; }
          .equipment-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
          .equipment-card { background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; }
          .equipment-title { font-size: 18px; font-weight: bold; color: #374151; margin-bottom: 15px; }
          .equipment-item { display: flex; justify-between; align-items: center; margin-bottom: 12px; padding: 12px; background: #F9FAFB; border-radius: 6px; }
          .equipment-name { font-weight: 600; color: #1F2937; }
          .equipment-status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
          .status-operational { background: #D1FAE5; color: #065F46; }
          .status-maintenance { background: #FEF3C7; color: #92400E; }
          .status-critical { background: #FEE2E2; color: #991B1B; }
          .status-down { background: #F3F4F6; color: #374151; }
          .cost-breakdown { background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; }
          .cost-item { display: flex; justify-between; align-items: center; margin-bottom: 15px; padding: 15px; border-radius: 8px; background: #F8FAFC; }
          .cost-category { font-weight: 600; color: #374151; }
          .cost-amount { font-size: 18px; font-weight: bold; color: #1F2937; }
          .cost-percentage { font-size: 14px; color: #6B7280; margin-left: 10px; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #E5E7EB; text-align: center; color: #6B7280; font-size: 12px; }
          .highlight-box { background: #EFF6FF; border: 1px solid #DBEAFE; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .performance-indicator { display: inline-block; background: #10B981; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">Maintrix</div>
          <div class="report-title">Tableau de Bord Maintenance</div>
          <div class="report-date">Généré le ${currentDate}</div>
          <div class="performance-indicator">
            Performance Globale: ${Math.round((metrics.oee + metrics.availability + metrics.reliability) / 3)}%
          </div>
        </div>

        <div class="section">
          <div class="section-title">Indicateurs Clés de Performance (KPIs)</div>
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-title">OEE Global</div>
              <div class="kpi-value">${metrics.oee}%</div>
              <div class="kpi-trend positive">+2.3% ce mois</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">MTBF Moyen</div>
              <div class="kpi-value">${metrics.mtbf}h</div>
              <div class="kpi-trend positive">+45h ce mois</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">MTTR Moyen</div>
              <div class="kpi-value">${metrics.mttr}h</div>
              <div class="kpi-trend positive">-0.8h ce mois</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Disponibilité</div>
              <div class="kpi-value">${metrics.availability}%</div>
              <div class="kpi-trend positive">+1.2% ce mois</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Ordres de Travail - Période: ${selectedPeriod === 'week' ? 'Cette semaine' : selectedPeriod === 'month' ? 'Ce mois' : selectedPeriod === 'quarter' ? 'Ce trimestre' : 'Cette année'}</div>
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-title">Total OT</div>
              <div class="kpi-value">${metrics.totalWorkOrders}</div>
              <div class="kpi-trend neutral">Toutes catégories</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Terminés</div>
              <div class="kpi-value">${metrics.completedWorkOrders}</div>
              <div class="kpi-trend positive">${Math.round((metrics.completedWorkOrders / metrics.totalWorkOrders) * 100)}% de réussite</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">En Cours</div>
              <div class="kpi-value">${metrics.pendingWorkOrders}</div>
              <div class="kpi-trend neutral">Progression normale</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">En Retard</div>
              <div class="kpi-value">${metrics.overdueWorkOrders}</div>
              <div class="kpi-trend ${metrics.overdueWorkOrders > 0 ? 'negative' : 'positive'}">${metrics.overdueWorkOrders === 0 ? 'Excellent' : 'Attention requise'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">État des Équipements</div>
          <div class="equipment-grid">
            <div class="equipment-card">
              <div class="equipment-title">Équipements Principaux</div>
              ${equipmentStatus.map(equipment => `
                <div class="equipment-item">
                  <div>
                    <div class="equipment-name">${equipment.name}</div>
                    <div style="font-size: 12px; color: #6B7280;">Score santé: ${equipment.healthScore}%</div>
                  </div>
                  <div class="equipment-status status-${equipment.status}">
                    ${equipment.status === 'operational' ? 'Opérationnel' : 
                      equipment.status === 'maintenance' ? 'Maintenance' :
                      equipment.status === 'critical' ? 'Critique' : 'Arrêté'}
                  </div>
                </div>
              `).join('')}
            </div>
            
            <div class="equipment-card">
              <div class="equipment-title">Statistiques Équipements</div>
              <div class="equipment-item">
                <span>Équipements actifs</span>
                <span class="equipment-name">${equipmentStatus.filter(e => e.status === 'operational').length}/${equipmentStatus.length}</span>
              </div>
              <div class="equipment-item">
                <span>Score santé moyen</span>
                <span class="equipment-name">${Math.round(equipmentStatus.reduce((acc, e) => acc + e.healthScore, 0) / equipmentStatus.length)}%</span>
              </div>
              <div class="equipment-item">
                <span>Utilisation moyenne</span>
                <span class="equipment-name">${Math.round(equipmentStatus.reduce((acc, e) => acc + e.utilization, 0) / equipmentStatus.length)}%</span>
              </div>
              <div class="equipment-item">
                <span>Alertes actives</span>
                <span class="equipment-name" style="color: ${metrics.criticalAlerts > 0 ? '#EF4444' : '#10B981'}">${metrics.activeAlerts} (${metrics.criticalAlerts} critiques)</span>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Analyse des Coûts de Maintenance</div>
          <div class="cost-breakdown">
            <div style="margin-bottom: 20px;">
              <strong>Coût total de maintenance: ${metrics.maintenanceCosts.toLocaleString('fr-FR')}€</strong>
              <span style="color: #10B981; margin-left: 15px;">Économies réalisées: ${metrics.costSavings.toLocaleString('fr-FR')}€</span>
            </div>
            ${maintenanceCosts.map(cost => `
              <div class="cost-item">
                <div>
                  <span class="cost-category">${cost.category}</span>
                  <span class="cost-percentage">(${cost.percentage}%)</span>
                </div>
                <div>
                  <span class="cost-amount">${cost.amount.toLocaleString('fr-FR')}€</span>
                  <span style="font-size: 14px; color: ${cost.trend === 'up' ? '#EF4444' : cost.trend === 'down' ? '#10B981' : '#6B7280'};">
                    ${cost.trend === 'up' ? '↗' : cost.trend === 'down' ? '↘' : '→'}
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Performances et Métriques Avancées</div>
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-title">Fiabilité</div>
              <div class="kpi-value">${metrics.reliability}%</div>
              <div class="kpi-trend positive">Très bon niveau</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Maintenance Planifiée</div>
              <div class="kpi-value">${metrics.plannedMaintenanceRate}%</div>
              <div class="kpi-trend positive">Objectif: >75%</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Utilisation Techniciens</div>
              <div class="kpi-value">${metrics.technicianUtilization}%</div>
              <div class="kpi-trend positive">Optimale</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Santé Équipements</div>
              <div class="kpi-value">${metrics.equipmentHealth}%</div>
              <div class="kpi-trend positive">Excellent état</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Recommandations et Actions</div>
          <div class="highlight-box">
            <h3 style="color: #3B82F6; margin-top: 0;">Points Forts</h3>
            <ul>
              <li>OEE supérieur à 85% - Performance excellente</li>
              <li>MTBF en amélioration constante (+45h ce mois)</li>
              <li>Taux de maintenance planifiée optimal (${metrics.plannedMaintenanceRate}%)</li>
              <li>Réduction du MTTR (-0.8h) indiquant une efficacité d'intervention améliorée</li>
            </ul>
            
            <h3 style="color: #F59E0B; margin-bottom: 10px;">Points d'Attention</h3>
            <ul>
              ${metrics.overdueWorkOrders > 0 ? `<li>⚠️ ${metrics.overdueWorkOrders} ordres de travail en retard nécessitent une attention immédiate</li>` : ''}
              ${metrics.criticalAlerts > 0 ? `<li>🚨 ${metrics.criticalAlerts} alertes critiques en cours</li>` : ''}
              <li>Surveiller l'évolution des coûts de pièces détachées (${maintenanceCosts[0]?.percentage}% du budget)</li>
            </ul>

            <h3 style="color: #10B981; margin-bottom: 10px;">Actions Recommandées</h3>
            <ul>
              <li>✅ Maintenir le niveau de maintenance préventive</li>
              <li>📊 Analyser les causes de pannes récurrentes pour optimiser les stocks</li>
              <li>🎯 Former les équipes sur les nouvelles procédures d'intervention</li>
              <li>📈 Étendre l'analyse prédictive aux équipements secondaires</li>
            </ul>
          </div>
        </div>

        <div class="footer">
          <p><strong>Rapport généré par:</strong> Maintrix</p>
          <p>Plateforme de gestion de maintenance assistée par intelligence artificielle</p>
          <p>Données extraites le ${currentDate} - Période analysée: ${selectedPeriod === 'week' ? 'Semaine courante' : selectedPeriod === 'month' ? 'Mois courant' : selectedPeriod === 'quarter' ? 'Trimestre courant' : 'Année courante'}</p>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header Section */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-3xl blur-3xl"></div>
          <Card className="relative backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-2xl rounded-3xl">
            <CardHeader className="text-center py-12">
              <div className="flex items-center justify-center mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur-lg opacity-50"></div>
                  <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-2xl">
                    <Activity className="h-12 w-12 text-white" />
                  </div>
                </div>
              </div>
              <CardTitle className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                Tableau de Bord Maintenance
              </CardTitle>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Vue d'ensemble complète des activités de maintenance avec KPIs en temps réel
              </p>
              
              <div className="flex flex-wrap gap-3 justify-center mt-6">
                <Button onClick={handleRefreshData} disabled={refreshing} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Actualiser
                </Button>
                <Button variant="outline" onClick={handleExportReport}>
                  <Download className="h-4 w-4 mr-2" />
                  Exporter Rapport
                </Button>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-600"
                >
                  <option value="week">Cette semaine</option>
                  <option value="month">Ce mois</option>
                  <option value="quarter">Ce trimestre</option>
                  <option value="year">Cette année</option>
                </select>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">OEE Global</p>
                  <p className="text-3xl font-bold text-blue-600">{metrics.oee}%</p>
                  <p className="text-sm text-green-600 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +2.3% ce mois
                  </p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-xl">
                  <Gauge className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">MTBF Moyen</p>
                  <p className="text-3xl font-bold text-green-600">{metrics.mtbf}h</p>
                  <p className="text-sm text-green-600 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +45h ce mois
                  </p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-xl">
                  <Clock className="h-8 w-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">MTTR Moyen</p>
                  <p className="text-3xl font-bold text-orange-600">{metrics.mttr}h</p>
                  <p className="text-sm text-green-600 flex items-center">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    -0.8h ce mois
                  </p>
                </div>
                <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-xl">
                  <Wrench className="h-8 w-8 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Disponibilité</p>
                  <p className="text-3xl font-bold text-blue-600">{metrics.availability}%</p>
                  <p className="text-sm text-green-600 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +1.2% ce mois
                  </p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-xl">
                  <CheckCircle className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Content */}
        <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-xl rounded-2xl">
          <CardContent className="p-6">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
                <TabsTrigger value="equipment">Équipements</TabsTrigger>
                <TabsTrigger value="analytics">Analyses</TabsTrigger>
                <TabsTrigger value="costs">Coûts</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Work Orders Overview */}
                  <Card className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wrench className="h-5 w-5" />
                        Ordres de Travail
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-2xl font-bold text-blue-600">{metrics.completedWorkOrders}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Terminés</p>
                        </div>
                        <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                          <p className="text-2xl font-bold text-yellow-600">{metrics.pendingWorkOrders}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">En cours</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Taux de complétion</span>
                          <span className="text-sm font-semibold">{Math.round((metrics.completedWorkOrders / metrics.totalWorkOrders) * 100)}%</span>
                        </div>
                        <Progress value={(metrics.completedWorkOrders / metrics.totalWorkOrders) * 100} className="h-2" />
                      </div>
                      {metrics.overdueWorkOrders > 0 && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="text-sm text-red-600">{metrics.overdueWorkOrders} ordres en retard</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Alerts & Health */}
                  <Card className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Alertes & Santé
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <p className="text-2xl font-bold text-red-600">{metrics.criticalAlerts}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Critiques</p>
                        </div>
                        <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                          <p className="text-2xl font-bold text-orange-600">{metrics.activeAlerts}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Actives</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Santé globale des équipements</span>
                          <span className="text-sm font-semibold text-green-600">{metrics.equipmentHealth}%</span>
                        </div>
                        <Progress value={metrics.equipmentHealth} className="h-2" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Utilisation techniciens</span>
                          <span className="text-sm font-semibold">{metrics.technicianUtilization}%</span>
                        </div>
                        <Progress value={metrics.technicianUtilization} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Work Order Trends */}
                <Card className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Tendances des Ordres de Travail
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {workOrderTrends.map((trend, index) => (
                        <div key={index} className="flex items-center space-x-4">
                          <div className="w-12 text-sm font-medium">{trend.month}</div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm">Planifiés: {trend.planned}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="text-sm">Terminés: {trend.completed}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <span className="text-sm">Urgences: {trend.emergency}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="equipment" className="space-y-6 mt-6">
                <div className="space-y-4">
                  {equipmentStatus.map((equipment) => {
                    const statusConfig = getStatusBadge(equipment.status);
                    return (
                      <Card key={equipment.id} className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                              <div className={`w-4 h-4 rounded-full ${getStatusColor(equipment.status)}`}></div>
                              <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">{equipment.name}</h3>
                                <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-bold text-blue-600">{equipment.healthScore}%</span>
                              <span className="text-sm text-gray-500">Santé</span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">MTBF</p>
                              <p className="font-semibold">{equipment.mtbf}h</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Utilisation</p>
                              <p className="font-semibold">{equipment.utilization}%</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Dernière maintenance</p>
                              <p className="font-semibold">{new Date(equipment.lastMaintenance).toLocaleDateString('fr-FR')}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Prochaine maintenance</p>
                              <p className="font-semibold">{new Date(equipment.nextMaintenance).toLocaleDateString('fr-FR')}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="analytics" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                    <CardHeader>
                      <CardTitle>Maintenance Préventive vs Corrective</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span>Préventive</span>
                          <span className="font-semibold">{metrics.plannedMaintenanceRate}%</span>
                        </div>
                        <Progress value={metrics.plannedMaintenanceRate} className="h-3" />
                        <div className="flex justify-between items-center">
                          <span>Corrective</span>
                          <span className="font-semibold">{100 - metrics.plannedMaintenanceRate}%</span>
                        </div>
                        <Progress value={100 - metrics.plannedMaintenanceRate} className="h-3" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                    <CardHeader>
                      <CardTitle>Fiabilité & Performance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between">
                        <span>Fiabilité</span>
                        <span className="font-semibold text-green-600">{metrics.reliability}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Disponibilité</span>
                        <span className="font-semibold text-blue-600">{metrics.availability}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>OEE</span>
                        <span className="font-semibold text-purple-600">{metrics.oee}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Temps de réparation moyen</span>
                        <span className="font-semibold">{metrics.avgCompletionTime}h</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="costs" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Coûts de Maintenance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-3xl font-bold text-blue-600">{metrics.maintenanceCosts.toLocaleString()}€</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Coût total ce mois</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-3xl font-bold text-green-600">{metrics.costSavings.toLocaleString()}€</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Économies réalisées</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                    <CardHeader>
                      <CardTitle>Répartition des Coûts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {maintenanceCosts.map((cost, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium">{cost.category}</span>
                              {getTrendIcon(cost.trend)}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{cost.amount.toLocaleString()}€</p>
                              <p className="text-sm text-gray-500">{cost.percentage}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}