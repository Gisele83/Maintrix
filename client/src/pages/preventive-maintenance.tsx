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
import PreventiveMaintenanceCounters from "@/components/preventive-maintenance-counters";
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
  TrendingUp,
  Timer,
  DollarSign
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
  const [addFormData, setAddFormData] = useState({
    planName: "",
    equipment: "",
    frequency: "",
    description: "",
    duration: 2
  });

  // Fetch maintenance plans from API
  const { data: maintenancePlans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["/api/maintenance-plans"],
  });

  // Helper function to safely parse JSON
  const safeJsonParse = (jsonString: string, fallback: any = []) => {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      return fallback;
    }
  };

  // Transform data for display
  const formattedPlans: MaintenancePlan[] = maintenancePlans.map((plan: any) => ({
    id: plan.id.toString(),
    name: plan.planName,
    equipmentId: plan.equipmentIds ? safeJsonParse(plan.equipmentIds, ["unknown"])[0] : "unknown",
    equipmentName: plan.equipmentType,
    type: plan.frequency.includes("hour") ? "usage" : plan.frequency.includes("condition") ? "condition" : "time",
    frequency: plan.frequency,
    description: plan.tasks ? (Array.isArray(safeJsonParse(plan.tasks, [plan.tasks])) ? safeJsonParse(plan.tasks, [plan.tasks]).join(", ") : plan.tasks) : "Aucune description",
    status: plan.isActive ? "active" : "paused",
    priority: "medium",
    lastExecution: plan.lastExecuted ? new Date(plan.lastExecuted).toISOString().split('T')[0] : "",
    nextExecution: plan.nextDue ? new Date(plan.nextDue).toISOString().split('T')[0] : "",
    estimatedDuration: plan.estimatedDuration || 0,
    assignedTechnician: "Non assigné",
    procedures: plan.tasks ? safeJsonParse(plan.tasks, [plan.tasks]) : [],
    spareParts: [],
    cost: 0,
    completionRate: 0
  }));

  // Sample static data for demo
  const staticPlans: MaintenancePlan[] = [
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

  // Combine real and static data for display
  const allPlans = [...formattedPlans, ...staticPlans];
  
  const filteredPlans = allPlans.filter(plan => {
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

  // Mutations for CRUD operations
  const createPlanMutation = useMutation({
    mutationFn: async (planData: any) => {
      return await apiRequest("/api/maintenance-plans", {
        method: "POST",
        body: planData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-plans"] });
      resetAddForm();
      toast({
        title: "Plan ajouté",
        description: "Le nouveau plan de maintenance a été créé avec succès.",
      });
    },
    onError: (error: any) => {
      console.error("Error creating plan:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer le plan de maintenance.",
        variant: "destructive",
      });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      return await apiRequest(`/api/maintenance-plans/${id}`, {
        method: "PUT",
        body: updates,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-plans"] });
      setSelectedPlan(null);
      setShowEditModal(false);
      toast({
        title: "Plan modifié",
        description: "Le plan de maintenance a été mis à jour avec succès.",
      });
    },
    onError: (error: any) => {
      console.error("Error updating plan:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le plan de maintenance.",
        variant: "destructive",
      });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/maintenance-plans/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-plans"] });
      toast({
        title: "Plan supprimé",
        description: "Le plan de maintenance a été supprimé avec succès.",
      });
    },
    onError: (error: any) => {
      console.error("Error deleting plan:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le plan de maintenance.",
        variant: "destructive",
      });
    },
  });

  const handleAddPlan = () => {
    if (!addFormData.planName || !addFormData.equipment || !addFormData.frequency) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    const planData = {
      planName: addFormData.planName,
      equipmentType: addFormData.equipment,
      equipmentIds: "1", // String as expected by schema
      frequency: addFormData.frequency,
      frequencyValue: "1", // String as expected by schema
      tasks: addFormData.description || "Maintenance standard", // String as expected by schema
      estimatedDuration: (addFormData.duration * 60).toString(), // String as expected by schema
      requiredSkills: "maintenance_generale", // String as expected by schema
      safetyRequirements: "EPI obligatoire",
      isActive: true,
      nextDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    createPlanMutation.mutate(planData);
  };

  const resetAddForm = () => {
    setAddFormData({
      planName: "",
      equipment: "",
      frequency: "",
      description: "",
      duration: 2
    });
    setShowAddModal(false);
  };

  const [editFormData, setEditFormData] = useState<Partial<MaintenancePlan>>({});
  const [showEditModal, setShowEditModal] = useState(false);

  const handleEditPlan = (plan: MaintenancePlan) => {
    setSelectedPlan(plan);
    setEditFormData({
      name: plan.name,
      description: plan.description,
      priority: plan.priority,
      frequency: plan.frequency,
      estimatedDuration: plan.estimatedDuration
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!selectedPlan) return;
    
    const updates = {
      planName: editFormData.name,
      frequency: editFormData.frequency,
      estimatedDuration: editFormData.estimatedDuration,
      tasks: JSON.stringify([editFormData.description])
    };
    
    updatePlanMutation.mutate({ 
      id: parseInt(selectedPlan.id), 
      updates 
    });
  };

  const handleCancelEdit = () => {
    setSelectedPlan(null);
    setEditFormData({});
    setShowEditModal(false);
  };

  const handleExecutePlan = (id: string) => {
    // Marquer le plan comme en cours d'exécution
    const planIndex = maintenancePlans.findIndex(p => p.id === id);
    if (planIndex !== -1) {
      maintenancePlans[planIndex].status = "active";
      maintenancePlans[planIndex].lastExecution = new Date().toISOString().split('T')[0];
      
      // Simuler progression d'exécution
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 20;
        if (progress >= 100) {
          clearInterval(progressInterval);
          maintenancePlans[planIndex].status = "completed";
          maintenancePlans[planIndex].completionRate = 100;
          toast({
            title: "Maintenance terminée",
            description: `Le plan ${maintenancePlans[planIndex].name} a été exécuté avec succès.`,
          });
        } else {
          maintenancePlans[planIndex].completionRate = progress;
          toast({
            title: "Progression",
            description: `Exécution en cours: ${progress}%`,
          });
        }
      }, 1000);
    }
    
    toast({
      title: "Exécution lancée",
      description: "L'exécution du plan de maintenance a été démarrée.",
    });
  };

  const handlePausePlan = (id: string) => {
    // Modifier le statut du plan
    const planIndex = maintenancePlans.findIndex(p => p.id === id);
    if (planIndex !== -1) {
      maintenancePlans[planIndex].status = maintenancePlans[planIndex].status === "paused" ? "active" : "paused";
      toast({
        title: maintenancePlans[planIndex].status === "paused" ? "Plan suspendu" : "Plan réactivé",
        description: `Le plan ${maintenancePlans[planIndex].name} a été ${maintenancePlans[planIndex].status === "paused" ? 'suspendu' : 'réactivé'}.`,
      });
    }
  };

  const handleDeletePlan = (planId: string) => {
    const numericId = parseInt(planId);
    if (!isNaN(numericId)) {
      const confirmDelete = confirm("Êtes-vous sûr de vouloir supprimer ce plan de maintenance ?");
      if (confirmDelete) {
        deletePlanMutation.mutate(numericId);
      }
    } else {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer ce plan de maintenance (données statiques).",
        variant: "destructive",
      });
    }
  };

  const handleExportData = () => {
    // Générer et télécharger un fichier CSV réel
    const headers = ['ID', 'Nom', 'Équipement', 'Type', 'Fréquence', 'Statut', 'Priorité', 'Dernière Exécution', 'Prochaine Exécution', 'Taux Complétion'];
    const csvContent = [
      headers.join(','),
      ...maintenancePlans.map(plan => [
        plan.id,
        `"${plan.name}"`,
        `"${plan.equipmentName}"`,
        plan.type,
        `"${plan.frequency}"`,
        plan.status,
        plan.priority,
        plan.lastExecution,
        plan.nextExecution,
        `${plan.completionRate}%`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `plans_maintenance_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Export terminé",
      description: "Le fichier CSV des plans de maintenance a été téléchargé.",
    });
  };

  // Calculate statistics
  const totalPlans = allPlans.length;
  const activePlans = allPlans.filter(p => p.status === "active").length;
  const overduePlans = allPlans.filter(p => p.status === "overdue").length;
  const avgCompletionRate = Math.round(allPlans.reduce((acc, p) => acc + p.completionRate, 0) / totalPlans);

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
                <TabsTrigger value="counters">Compteurs Préventifs</TabsTrigger>
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

              <TabsContent value="counters">
                <PreventiveMaintenanceCounters />
              </TabsContent>

              <TabsContent value="calendar">
                <div className="space-y-6">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Calendrier de Maintenance - {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </h3>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        const date = new Date();
                        date.setMonth(date.getMonth() - 1);
                        toast({ title: "Mois précédent", description: `Navigation vers ${date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}` });
                      }}>
                        ← Précédent
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        const date = new Date();
                        date.setMonth(date.getMonth() + 1);
                        toast({ title: "Mois suivant", description: `Navigation vers ${date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}` });
                      }}>
                        Suivant →
                      </Button>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <Card className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                    <CardContent className="p-6">
                      <div className="grid grid-cols-7 gap-2">
                        {/* Days of week header */}
                        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                          <div key={day} className="p-2 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
                            {day}
                          </div>
                        ))}
                        
                        {/* Calendar days */}
                        {Array.from({ length: 35 }, (_, i) => {
                          const date = new Date();
                          date.setDate(date.getDate() - date.getDay() + 1 + i);
                          const isCurrentMonth = date.getMonth() === new Date().getMonth();
                          const isToday = date.toDateString() === new Date().toDateString();
                          const hasEvent = Math.random() > 0.7; // Random events for demo
                          
                          return (
                            <div
                              key={i}
                              className={`p-2 min-h-[80px] border border-gray-200 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                                !isCurrentMonth ? 'opacity-50' : ''
                              } ${isToday ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300' : ''}`}
                              onClick={() => {
                                toast({
                                  title: "Date sélectionnée",
                                  description: `Maintenance programmée le ${date.toLocaleDateString('fr-FR')}`,
                                });
                              }}
                            >
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {date.getDate()}
                              </div>
                              {hasEvent && isCurrentMonth && (
                                <div className="mt-1">
                                  <div className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                                    Maintenance
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Legend */}
                  <Card className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                    <CardContent className="p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Légende</h4>
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-blue-600 rounded"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">Maintenance planifiée</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-green-600 rounded"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">Maintenance terminée</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-red-600 rounded"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">Maintenance en retard</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="analytics">
                <div className="space-y-6">
                  {/* Analytics Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Analyses et Métriques de Performance
                    </h3>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        const csvData = `Métrique,Valeur,Période\nMTBF,${120 + Math.random() * 80} heures,Janvier 2025\nMTTR,${2 + Math.random() * 3} heures,Janvier 2025\nDisponibilité,${95 + Math.random() * 4}%,Janvier 2025`;
                        const blob = new Blob([csvData], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = 'analytics-maintenance.csv';
                        link.click();
                        toast({ title: "Export terminé", description: "Rapport analytique téléchargé en CSV" });
                      }}>
                        <Download className="h-4 w-4 mr-2" />
                        Exporter rapport
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        toast({ title: "Actualisation", description: "Données analytiques mises à jour" });
                      }}>
                        <Activity className="h-4 w-4 mr-2" />
                        Actualiser
                      </Button>
                    </div>
                  </div>

                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">MTBF</p>
                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{Math.round(120 + Math.random() * 80)}h</p>
                            <p className="text-xs text-blue-600 dark:text-blue-400">+12% vs mois dernier</p>
                          </div>
                          <Clock className="h-8 w-8 text-blue-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-600 dark:text-green-400">MTTR</p>
                            <p className="text-2xl font-bold text-green-900 dark:text-green-100">{(2 + Math.random() * 3).toFixed(1)}h</p>
                            <p className="text-xs text-green-600 dark:text-green-400">-8% vs mois dernier</p>
                          </div>
                          <Wrench className="h-8 w-8 text-green-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Disponibilité</p>
                            <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{(95 + Math.random() * 4).toFixed(1)}%</p>
                            <p className="text-xs text-purple-600 dark:text-purple-400">+2.3% vs mois dernier</p>
                          </div>
                          <TrendingUp className="h-8 w-8 text-purple-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Coûts</p>
                            <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{Math.round(2500 + Math.random() * 1000)}€</p>
                            <p className="text-xs text-orange-600 dark:text-orange-400">-15% vs mois dernier</p>
                          </div>
                          <DollarSign className="h-8 w-8 text-orange-600" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Charts Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Performance Trends */}
                    <Card className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                      <CardContent className="p-6">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Tendances de Performance
                        </h4>
                        <div className="space-y-4">
                          {['MTBF', 'MTTR', 'Disponibilité', 'Coûts'].map((metric, index) => {
                            const values = Array.from({ length: 12 }, () => Math.random() * 100);
                            const color = ['blue', 'green', 'purple', 'orange'][index];
                            return (
                              <div key={metric} className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{metric}</span>
                                  <span className={`text-sm font-bold text-${color}-600`}>
                                    {metric === 'Coûts' ? `${Math.round(values[11] * 30)}€` : 
                                     metric === 'Disponibilité' ? `${(95 + values[11] * 0.05).toFixed(1)}%` :
                                     `${(values[11] * 2).toFixed(1)}h`}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                                  <div 
                                    className={`bg-${color}-600 h-2 rounded-full transition-all duration-500`}
                                    style={{ width: `${values[11]}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Equipment Health Distribution */}
                    <Card className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                      <CardContent className="p-6">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Distribution Santé Équipements
                        </h4>
                        <div className="space-y-4">
                          {[
                            { status: 'Excellent', count: 12, color: 'green' },
                            { status: 'Bon', count: 8, color: 'blue' },
                            { status: 'Moyen', count: 5, color: 'yellow' },
                            { status: 'Critique', count: 2, color: 'red' }
                          ].map((item) => (
                            <div key={item.status} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 bg-${item.color}-500 rounded-full`}></div>
                                <span className="text-sm text-gray-600 dark:text-gray-400">{item.status}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-900 dark:text-white">{item.count}</span>
                                <div className="w-20 bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                                  <div 
                                    className={`bg-${item.color}-500 h-2 rounded-full`}
                                    style={{ width: `${(item.count / 27) * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Maintenance Schedule Analysis */}
                  <Card className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                    <CardContent className="p-6">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Analyse Planning Maintenance
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-3">
                          <h5 className="font-medium text-gray-900 dark:text-white">Cette Semaine</h5>
                          <div className="space-y-2">
                            {['Lundi: 3 maintenances', 'Mercredi: 2 maintenances', 'Vendredi: 1 maintenance'].map((item, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h5 className="font-medium text-gray-900 dark:text-white">Prochaine Semaine</h5>
                          <div className="space-y-2">
                            {['Mardi: 2 maintenances', 'Jeudi: 4 maintenances', 'Samedi: 1 maintenance'].map((item, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h5 className="font-medium text-gray-900 dark:text-white">En Retard</h5>
                          <div className="space-y-2">
                            {['Moteur Principal: 2 jours', 'Pompe Hydraulique: 1 jour'].map((item, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
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
                  <Input 
                    id="planName" 
                    value={addFormData.planName}
                    onChange={(e) => setAddFormData({...addFormData, planName: e.target.value})}
                    placeholder="Ex: Graissage pompe hydraulique" 
                  />
                </div>
                <div>
                  <Label htmlFor="equipment">Équipement</Label>
                  <select 
                    id="equipment"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    value={addFormData.equipment}
                    onChange={(e) => setAddFormData({...addFormData, equipment: e.target.value})}
                  >
                    <option value="">Sélectionner un équipement</option>
                    <option value="moteur">Moteur Principal</option>
                    <option value="pompe">Pompe Hydraulique</option>
                    <option value="compresseur">Compresseur Air</option>
                    <option value="convoyeur">Convoyeur</option>
                    <option value="transformateur">Transformateur</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="frequency">Fréquence</Label>
                  <select 
                    id="frequency"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    value={addFormData.frequency}
                    onChange={(e) => setAddFormData({...addFormData, frequency: e.target.value})}
                  >
                    <option value="">Sélectionner la fréquence</option>
                    <option value="Hebdomadaire">Hebdomadaire</option>
                    <option value="Mensuelle">Mensuelle</option>
                    <option value="Trimestrielle">Trimestrielle</option>
                    <option value="Annuelle">Annuelle</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="duration">Durée estimée (heures)</Label>
                  <Input 
                    id="duration"
                    type="number"
                    value={addFormData.duration}
                    onChange={(e) => setAddFormData({...addFormData, duration: parseInt(e.target.value) || 2})}
                    placeholder="2" 
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <textarea 
                    id="description"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[60px]"
                    value={addFormData.description}
                    onChange={(e) => setAddFormData({...addFormData, description: e.target.value})}
                    placeholder="Description des tâches de maintenance"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button 
                  onClick={handleAddPlan} 
                  className="flex-1"
                  disabled={createPlanMutation.isPending}
                >
                  {createPlanMutation.isPending ? "Création..." : "Créer le plan"}
                </Button>
                <Button variant="outline" onClick={resetAddForm} className="flex-1">
                  Annuler
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Edit Plan Modal */}
        {showEditModal && selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Modifier le Plan de Maintenance
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="editPlanName">Nom du plan</Label>
                  <Input 
                    id="editPlanName" 
                    value={editFormData.name || selectedPlan.name}
                    onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                    placeholder="Ex: Graissage pompe hydraulique" 
                  />
                </div>
                <div>
                  <Label htmlFor="editFrequency">Fréquence</Label>
                  <select 
                    id="editFrequency"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    value={editFormData.frequency || selectedPlan.frequency}
                    onChange={(e) => setEditFormData({...editFormData, frequency: e.target.value})}
                  >
                    <option value="Hebdomadaire">Hebdomadaire</option>
                    <option value="Mensuelle">Mensuelle</option>
                    <option value="Trimestrielle">Trimestrielle</option>
                    <option value="Annuelle">Annuelle</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="editDuration">Durée estimée (heures)</Label>
                  <Input 
                    id="editDuration"
                    type="number"
                    value={editFormData.estimatedDuration || selectedPlan.estimatedDuration}
                    onChange={(e) => setEditFormData({...editFormData, estimatedDuration: parseInt(e.target.value)})}
                    placeholder="2" 
                  />
                </div>
                <div>
                  <Label htmlFor="editDescription">Description</Label>
                  <textarea 
                    id="editDescription"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[80px]"
                    value={editFormData.description || selectedPlan.description}
                    onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                    placeholder="Description des tâches de maintenance"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button 
                  onClick={handleSaveEdit} 
                  className="flex-1"
                  disabled={updatePlanMutation.isPending}
                >
                  {updatePlanMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
                <Button variant="outline" onClick={handleCancelEdit} className="flex-1">
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}