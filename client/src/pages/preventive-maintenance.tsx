import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Calendar, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Edit,
  Trash2,
  Eye,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wrench,
  BarChart3,
  MapPin,
  Settings,
  PlayCircle,
  PauseCircle,
  RotateCcw,
  AlertCircle,
  TrendingUp
} from "lucide-react";

interface MaintenancePlan {
  id: string;
  name: string;
  equipmentId: string;
  equipmentName: string;
  type: "time" | "usage" | "condition";
  frequency: string;
  description: string;
  status: "active" | "paused" | "completed" | "overdue";
  priority: "low" | "medium" | "high" | "critical";
  lastExecution: string;
  nextExecution: string;
  estimatedDuration: number;
  assignedTechnician: string;
  procedures: string[];
  spareParts: string[];
  cost: number;
  completionRate: number;
}

export default function PreventiveMaintenance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPlan, setSelectedPlan] = useState<MaintenancePlan | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Sample maintenance plans data - in real app this would come from API
  const maintenancePlans: MaintenancePlan[] = [
    {
      id: "1",
      name: "Graissage Moteur Principal",
      equipmentId: "EQ001",
      equipmentName: "Moteur Principal Ligne 1",
      type: "time",
      frequency: "Mensuel",
      description: "Graissage des paliers et vérification des niveaux d'huile",
      status: "active",
      priority: "high",
      lastExecution: "2024-01-15",
      nextExecution: "2024-02-15",
      estimatedDuration: 2,
      assignedTechnician: "Jean Dupont",
      procedures: ["Arrêt machine", "Graissage paliers", "Contrôle niveau huile", "Redémarrage"],
      spareParts: ["Graisse EP2", "Huile moteur SAE 30"],
      cost: 150,
      completionRate: 98
    },
    {
      id: "2",
      name: "Maintenance Pompe Hydraulique",
      equipmentId: "EQ002",
      equipmentName: "Pompe Hydraulique P-001",
      type: "condition",
      frequency: "Selon état",
      description: "Contrôle des joints et filtration du circuit hydraulique",
      status: "overdue",
      priority: "critical",
      lastExecution: "2024-01-05",
      nextExecution: "2024-02-05",
      estimatedDuration: 4,
      assignedTechnician: "Marie Martin",
      procedures: ["Arrêt pompe", "Contrôle joints", "Remplacement filtres", "Test pression"],
      spareParts: ["Joints toriques", "Filtre hydraulique", "Huile hydraulique"],
      cost: 280,
      completionRate: 85
    },
    {
      id: "3",
      name: "Révision Compresseur",
      equipmentId: "EQ003",
      equipmentName: "Compresseur Air Principal",
      type: "usage",
      frequency: "Toutes les 1000h",
      description: "Révision complète du compresseur à vis",
      status: "active",
      priority: "medium",
      lastExecution: "2024-01-20",
      nextExecution: "2024-04-20",
      estimatedDuration: 8,
      assignedTechnician: "Pierre Durand",
      procedures: ["Arrêt compresseur", "Démontage", "Nettoyage", "Remplacement pièces", "Remontage", "Test"],
      spareParts: ["Kit révision", "Huile compresseur", "Filtre air"],
      cost: 450,
      completionRate: 92
    },
    {
      id: "4",
      name: "Nettoyage Convoyeur",
      equipmentId: "EQ004",
      equipmentName: "Convoyeur Ligne 2",
      type: "time",
      frequency: "Hebdomadaire",
      description: "Nettoyage et lubrification du convoyeur",
      status: "active",
      priority: "low",
      lastExecution: "2024-01-22",
      nextExecution: "2024-01-29",
      estimatedDuration: 1,
      assignedTechnician: "Sophie Blanc",
      procedures: ["Arrêt convoyeur", "Nettoyage bande", "Lubrification chaînes", "Vérification tension"],
      spareParts: ["Lubrifiant chaîne", "Produit nettoyant"],
      cost: 50,
      completionRate: 100
    },
    {
      id: "5",
      name: "Test Transformateur",
      equipmentId: "EQ005",
      equipmentName: "Transformateur TR-001",
      type: "time",
      frequency: "Annuel",
      description: "Tests électriques et thermiques du transformateur",
      status: "active",
      priority: "critical",
      lastExecution: "2023-12-15",
      nextExecution: "2024-12-15",
      estimatedDuration: 6,
      assignedTechnician: "Michel Leroy",
      procedures: ["Consignation", "Tests isolement", "Thermographie", "Analyse huile", "Rapport"],
      spareParts: ["Huile transformateur", "Joints"],
      cost: 800,
      completionRate: 95
    }
  ];

  const filteredPlans = maintenancePlans.filter(plan => {
    const matchesSearch = plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         plan.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         plan.assignedTechnician.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || plan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: "Actif", variant: "default" as const, color: "bg-green-500" },
      paused: { label: "Suspendu", variant: "secondary" as const, color: "bg-gray-500" },
      completed: { label: "Terminé", variant: "outline" as const, color: "bg-blue-500" },
      overdue: { label: "En retard", variant: "destructive" as const, color: "bg-red-500" }
    };
    return statusConfig[status as keyof typeof statusConfig];
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { label: "Faible", color: "bg-green-100 text-green-800" },
      medium: { label: "Moyenne", color: "bg-yellow-100 text-yellow-800" },
      high: { label: "Élevée", color: "bg-orange-100 text-orange-800" },
      critical: { label: "Critique", color: "bg-red-100 text-red-800" }
    };
    return priorityConfig[priority as keyof typeof priorityConfig];
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "time": return <Clock className="h-4 w-4" />;
      case "usage": return <BarChart3 className="h-4 w-4" />;
      case "condition": return <TrendingUp className="h-4 w-4" />;
      default: return <Wrench className="h-4 w-4" />;
    }
  };

  const getDaysUntilNext = (nextExecution: string) => {
    const today = new Date();
    const next = new Date(nextExecution);
    const diffTime = next.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleAddPlan = () => {
    toast({
      title: "Plan ajouté",
      description: "Le nouveau plan de maintenance a été créé avec succès.",
    });
    setShowAddModal(false);
  };

  const handleEditPlan = (plan: MaintenancePlan) => {
    setSelectedPlan(plan);
    toast({
      title: "Modification du plan",
      description: `Ouverture du plan ${plan.name}`,
    });
  };

  const handleExecutePlan = (id: string) => {
    toast({
      title: "Exécution lancée",
      description: "L'exécution du plan de maintenance a été démarrée.",
    });
  };

  const handlePausePlan = (id: string) => {
    toast({
      title: "Plan suspendu",
      description: "Le plan de maintenance a été mis en pause.",
    });
  };

  const handleDeletePlan = (id: string) => {
    toast({
      title: "Plan supprimé",
      description: "Le plan de maintenance a été supprimé avec succès.",
    });
  };

  const handleExportData = () => {
    toast({
      title: "Export en cours",
      description: "Le fichier Excel des plans est en cours de génération...",
    });
  };

  // Calculate statistics
  const totalPlans = maintenancePlans.length;
  const activePlans = maintenancePlans.filter(p => p.status === "active").length;
  const overduePlans = maintenancePlans.filter(p => p.status === "overdue").length;
  const avgCompletionRate = Math.round(maintenancePlans.reduce((acc, p) => acc + p.completionRate, 0) / totalPlans);

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
                    <Calendar className="h-12 w-12 text-white" />
                  </div>
                </div>
              </div>
              <CardTitle className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                Maintenance Préventive
              </CardTitle>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Planification et suivi des maintenances préventives avec optimisation prédictive
              </p>
            </CardHeader>
          </Card>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Plans</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalPlans}</p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-xl">
                  <Calendar className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Actifs</p>
                  <p className="text-3xl font-bold text-green-600">{activePlans}</p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-xl">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">En Retard</p>
                  <p className="text-3xl font-bold text-red-600">{overduePlans}</p>
                </div>
                <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-xl">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Taux Réalisation</p>
                  <p className="text-3xl font-bold text-blue-600">{avgCompletionRate}%</p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-xl">
                  <Activity className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-xl rounded-2xl">
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div>
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                  Plans de Maintenance
                </CardTitle>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Gestion et planification des maintenances préventives
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setShowAddModal(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau Plan
                </Button>
                <Button variant="outline" onClick={handleExportData}>
                  <Download className="h-4 w-4 mr-2" />
                  Exporter
                </Button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 mt-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher un plan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-600"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actif</option>
                <option value="paused">Suspendu</option>
                <option value="completed">Terminé</option>
                <option value="overdue">En retard</option>
              </select>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="plans" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="plans">Plans de Maintenance</TabsTrigger>
                <TabsTrigger value="calendar">Calendrier</TabsTrigger>
                <TabsTrigger value="analytics">Analyses</TabsTrigger>
              </TabsList>

              <TabsContent value="plans">
                <div className="space-y-4">
                  {filteredPlans.map((plan) => {
                    const statusConfig = getStatusBadge(plan.status);
                    const priorityConfig = getPriorityBadge(plan.priority);
                    const daysUntilNext = getDaysUntilNext(plan.nextExecution);
                    
                    return (
                      <Card key={plan.id} className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                                  {getTypeIcon(plan.type)}
                                </div>
                                <div>
                                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{plan.name}</h3>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">{plan.equipmentName}</p>
                                </div>
                              </div>
                              <p className="text-gray-600 dark:text-gray-400 mb-3">{plan.description}</p>
                            </div>
                            <div className="flex gap-2">
                              <Badge variant={statusConfig.variant}>
                                {statusConfig.label}
                              </Badge>
                              <Badge className={priorityConfig.color}>
                                {priorityConfig.label}
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                            <div className="text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Fréquence:</span>
                              <p className="font-medium text-gray-900 dark:text-white">{plan.frequency}</p>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Prochaine maintenance:</span>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {new Date(plan.nextExecution).toLocaleDateString('fr-FR')}
                                {daysUntilNext <= 7 && (
                                  <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                                    daysUntilNext < 0 ? 'bg-red-100 text-red-800' : 
                                    daysUntilNext <= 3 ? 'bg-orange-100 text-orange-800' : 
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {daysUntilNext < 0 ? `${Math.abs(daysUntilNext)}j en retard` : `${daysUntilNext}j restants`}
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Technicien:</span>
                              <p className="font-medium text-gray-900 dark:text-white">{plan.assignedTechnician}</p>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Durée estimée:</span>
                              <p className="font-medium text-gray-900 dark:text-white">{plan.estimatedDuration}h</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Taux de réalisation:</span>
                                <span className="ml-2 font-semibold text-blue-600">{plan.completionRate}%</span>
                              </div>
                              <div className="text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Coût estimé:</span>
                                <span className="ml-2 font-semibold text-green-600">{plan.cost}€</span>
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleEditPlan(plan)}>
                                <Eye className="h-4 w-4 mr-1" />
                                Détails
                              </Button>
                              <Button size="sm" onClick={() => handleExecutePlan(plan.id)} className="bg-green-600 hover:bg-green-700">
                                <PlayCircle className="h-4 w-4 mr-1" />
                                Exécuter
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handlePausePlan(plan.id)}>
                                <PauseCircle className="h-4 w-4 mr-1" />
                                Suspendre
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleEditPlan(plan)}>
                                <Edit className="h-4 w-4 mr-1" />
                                Modifier
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDeletePlan(plan.id)}>
                                <Trash2 className="h-4 w-4 mr-1" />
                                Supprimer
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="calendar">
                <Card className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                  <CardContent className="p-8 text-center">
                    <Calendar className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Calendrier de Maintenance
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Vue calendaire interactive des maintenances planifiées et réalisées
                    </p>
                    <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                      <Calendar className="h-4 w-4 mr-2" />
                      Ouvrir le calendrier
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analytics">
                <Card className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                  <CardContent className="p-8 text-center">
                    <BarChart3 className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Analyses et KPIs
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Tableaux de bord analytiques avec métriques de performance de la maintenance préventive
                    </p>
                    <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                      <Activity className="h-4 w-4 mr-2" />
                      Voir les analyses
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Add Plan Modal Placeholder */}
        {showAddModal && (
          <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Nouveau Plan de Maintenance
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="planName">Nom du plan</Label>
                  <Input id="planName" placeholder="Ex: Graissage pompe hydraulique" />
                </div>
                <div>
                  <Label htmlFor="equipment">Équipement</Label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">Sélectionner un équipement</option>
                    <option value="eq1">Moteur Principal Ligne 1</option>
                    <option value="eq2">Pompe Hydraulique P-001</option>
                    <option value="eq3">Compresseur Air Principal</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="frequency">Fréquence</Label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">Sélectionner la fréquence</option>
                    <option value="weekly">Hebdomadaire</option>
                    <option value="monthly">Mensuelle</option>
                    <option value="quarterly">Trimestrielle</option>
                    <option value="annual">Annuelle</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button onClick={handleAddPlan} className="flex-1">
                  Créer le plan
                </Button>
                <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
                  Annuler
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}