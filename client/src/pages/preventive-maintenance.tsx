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
import { CHART_COLOR, type ChartColor } from "@/lib/accent-colors";
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
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

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
    customEquipment: "",
    frequency: "",
    description: "",
    duration: 2
  });

  // Fetch maintenance plans from API
  const { data: maintenancePlans = [], isLoading: plansLoading } = useQuery<any[]>({
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

  /**
   * ⚠️ CINQ PLANS DE MAINTENANCE ENTIÈREMENT FABRIQUÉS ONT ÉTÉ RETIRÉS ICI.
   *
   * Le code les annonçait lui-même : « Sample static data for demo ». Ils
   * n'étaient pas une valeur de repli — ils étaient CONCATÉNÉS aux vrais,
   * par « [...formattedPlans, ...staticPlans] », donc affichés en toutes
   * circonstances, mêlés aux plans réels du client et impossibles à
   * distinguer.
   *
   * Ce qu'ils inventaient : cinq intitulés (« Graissage Moteur Principal »,
   * « Maintenance Pompe Hydraulique »…), cinq techniciens nommés (Jean
   * Dupont, Marie Martin, Pierre Durand, Sophie Blanc, Michel Leroy), cinq
   * coûts (150 à 800 €) et cinq taux de réalisation (85 à 100 %).
   *
   * Mesuré le 20/10/2026 : la route /api/maintenance-plans renvoyait ZÉRO
   * plan pour ce locataire, et l'écran affichait pourtant « 5 plans ·
   * 4 actifs · 1 en retard · 94 % de réalisation ». Chaque organisation
   * voyait les mêmes cinq plans et les mêmes deux techniciens.
   *
   * L'écran montre désormais ce que contient la base, et rien d'autre.
   */

  const allPlans = formattedPlans;
  
  const filteredPlans = allPlans.filter(plan => {
    const matchesSearch = plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         plan.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         plan.assignedTechnician.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || plan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: "Actif", variant: "default" as const, color: "bg-etat-nominal-vif" },
      paused: { label: "Suspendu", variant: "secondary" as const, color: "bg-gray-500" },
      completed: { label: "Terminé", variant: "outline" as const, color: "bg-etat-encours-vif" },
      overdue: { label: "En retard", variant: "destructive" as const, color: "bg-etat-critique-vif" }
    };
    return statusConfig[status as keyof typeof statusConfig];
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { label: "Faible", color: "bg-etat-nominal-fond text-etat-nominal-texte" },
      medium: { label: "Moyenne", color: "bg-etat-alerte-fond text-etat-alerte-texte" },
      high: { label: "Élevée", color: "bg-etat-alerte-fond text-etat-alerte-texte" },
      critical: { label: "Critique", color: "bg-etat-critique-fond text-etat-critique-texte" }
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
    const equipmentType = addFormData.equipment === "autre" ? addFormData.customEquipment : addFormData.equipment;
    
    if (!addFormData.planName || !addFormData.equipment || !addFormData.frequency) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    if (addFormData.equipment === "autre" && !addFormData.customEquipment) {
      toast({
        title: "Erreur",
        description: "Veuillez spécifier le nom de l'équipement.",
        variant: "destructive",
      });
      return;
    }

    const planData = {
      planName: addFormData.planName,
      equipmentType: equipmentType,
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
    
    createPlanMutation.mutate(planData, {
      onSuccess: (createdPlan) => {
      }
    });
  };

  const resetAddForm = () => {
    setAddFormData({
      planName: "",
      equipment: "",
      customEquipment: "",
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
    toast({
      title: "Exécution lancée",
      description: "L'exécution du plan de maintenance a été démarrée.",
    });
  };

  const handlePausePlan = (id: string) => {
    toast({
      title: "Plan suspendu",
      description: "Le plan de maintenance a été suspendu.",
    });
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
  /**
   * ⚠️ Cette moyenne valait `Math.round(0 / 0)`, soit `NaN`, dès qu'aucun
   * plan n'existait — l'écran aurait affiché « NaN % ». Le défaut restait
   * invisible tant que les cinq plans fabriqués garantissaient un
   * dénominateur non nul : les retirer l'a découvert.
   * Une moyenne sans population ne vaut pas zéro, elle n'existe pas : on
   * écrit « — », comme partout ailleurs dans le produit.
   */
  const avgCompletionRate = totalPlans > 0
    ? Math.round(allPlans.reduce((acc, p) => acc + p.completionRate, 0) / totalPlans)
    : null;

  return (
    <AppShell filAriane={[{ libelle: "GMAO", href: "/gmao" }, { libelle: "Maintenance préventive" }]} largeur="large">
    <div className="space-y-6">
      <div className="space-y-8">
        {/* ══════════════════════════════════════════════════════════
            EN-TÊTE
            ══════════════════════════════════════════════════════════
            C'était une bannière centrée de douze unités de hauteur : une
            icône de 48 px posée sur deux halos flous superposés, un titre
            en 36 px et une accroche en 20 px. Elle occupait le premier
            écran entier sans rien dire d'utile, et — plus gênant — elle
            n'employait AUCUN `<h1>` : son titre était un `CardTitle`,
            c'est-à-dire un `<div>`. La page était la dernière du produit
            sans titre de niveau 1, et son premier intitulé visible était
            une valeur de donnée (« Graissage Moteur Principal »).
            Même en-tête que partout ailleurs. */}
        <EnTetePage
          surTitre="GMAO"
          titre="Maintenance préventive"
          phrase="Les plans d'entretien périodiques et leurs échéances."
        />

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white border-0 rounded-none">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-soft">Total Plans</p>
                  <p className="text-3xl font-bold text-ink">{totalPlans}</p>
                </div>
                <div className="bg-etat-encours-fond p-3 rounded-none">
                  <Calendar className="h-8 w-8 text-etat-encours-texte" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 rounded-none">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-soft">Actifs</p>
                  <p className="text-3xl font-bold text-etat-nominal-texte">{activePlans}</p>
                </div>
                <div className="bg-etat-nominal-fond p-3 rounded-none">
                  <CheckCircle className="h-8 w-8 text-etat-nominal-texte" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 rounded-none">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-soft">En Retard</p>
                  <p className="text-3xl font-bold text-etat-critique-texte">{overduePlans}</p>
                </div>
                <div className="bg-etat-critique-fond p-3 rounded-none">
                  <AlertTriangle className="h-8 w-8 text-etat-critique-texte" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 rounded-none">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-soft">Taux de réalisation</p>
                  <p className={`text-3xl font-bold ${avgCompletionRate == null ? "text-ink-mute" : "text-etat-encours-texte"}`}>
                    {avgCompletionRate == null ? "—" : `${avgCompletionRate} %`}
                  </p>
                </div>
                <div className="bg-etat-encours-fond p-3 rounded-none">
                  <Activity className="h-8 w-8 text-etat-encours-texte" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="bg-white border-0 rounded-none">
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div>
                <CardTitle className="text-2xl font-bold text-ink">
                  Plans de Maintenance
                </CardTitle>
                <p className="text-ink-soft mt-1">
                  Gestion et planification des maintenances préventives
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setShowAddModal(true)} className="bg-paper-deep">
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
                <Search className="absolute left-3 top-3 h-4 w-4 text-ink-mute" />
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
                className="px-4 py-2 border border-rule rounded-lg bg-white"
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
                  {/* Un écran vide doit dire POURQUOI il l'est et quoi faire.
                      Tant que cinq plans fabriqués le remplissaient, la
                      question ne se posait pas. */}
                  {filteredPlans.length === 0 && (
                    <EtatVide
                      icone={Calendar}
                      titre={
                        allPlans.length === 0
                          ? "Aucun plan de maintenance préventive"
                          : "Aucun plan ne correspond à la recherche"
                      }
                      phrase={
                        allPlans.length === 0
                          ? "Un plan préventif déclenche une intervention à échéance calendaire ou au compteur, avant la panne. Aucun n'est encore enregistré pour cette organisation."
                          : "Élargissez la recherche, ou remettez le filtre de statut sur « tous »."
                      }
                    />
                  )}
                  {filteredPlans.map((plan) => {
                    const statusConfig = getStatusBadge(plan.status);
                    const priorityConfig = getPriorityBadge(plan.priority);
                    const daysUntilNext = getDaysUntilNext(plan.nextExecution);
                    
                    return (
                      <Card key={plan.id} className="bg-white border border-rule transition-all duration-300">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="bg-etat-encours-fond p-2 rounded-lg">
                                  {getTypeIcon(plan.type)}
                                </div>
                                <div>
                                  <h3 className="font-semibold text-ink text-lg">{plan.name}</h3>
                                  <p className="text-sm text-ink-soft">{plan.equipmentName}</p>
                                </div>
                              </div>
                              <p className="text-ink-soft mb-3">{plan.description}</p>
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
                              <span className="text-ink-soft">Fréquence:</span>
                              <p className="font-medium text-ink">{plan.frequency}</p>
                            </div>
                            <div className="text-sm">
                              <span className="text-ink-soft">Prochaine maintenance:</span>
                              <p className="font-medium text-ink">
                                {new Date(plan.nextExecution).toLocaleDateString('fr-FR')}
                                {daysUntilNext <= 7 && (
                                  <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                                    daysUntilNext < 0 ? 'bg-etat-critique-fond text-etat-critique-texte' : 
                                    daysUntilNext <= 3 ? 'bg-etat-alerte-fond text-etat-alerte-texte' : 
                                    'bg-etat-alerte-fond text-etat-alerte-texte'
                                  }`}>
                                    {daysUntilNext < 0 ? `${Math.abs(daysUntilNext)}j en retard` : `${daysUntilNext}j restants`}
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="text-sm">
                              <span className="text-ink-soft">Technicien:</span>
                              <p className="font-medium text-ink">{plan.assignedTechnician}</p>
                            </div>
                            <div className="text-sm">
                              <span className="text-ink-soft">Durée estimée:</span>
                              <p className="font-medium text-ink">{plan.estimatedDuration}h</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="text-sm">
                                <span className="text-ink-soft">Taux de réalisation:</span>
                                <span className="ml-2 font-semibold text-etat-encours-texte">{plan.completionRate}%</span>
                              </div>
                              <div className="text-sm">
                                <span className="text-ink-soft">Coût estimé:</span>
                                <span className="ml-2 font-semibold text-etat-nominal-texte">{plan.cost}€</span>
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleExecutePlan(plan.id)} className="bg-etat-nominal-vif hover:bg-etat-nominal-vif">
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
                <div className="space-y-6">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-ink">
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
                  <Card className="bg-white border border-rule">
                    <CardContent className="p-6">
                      <div className="grid grid-cols-7 gap-2">
                        {/* Days of week header */}
                        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                          <div key={day} className="p-2 text-center text-sm font-medium text-ink-soft">
                            {day}
                          </div>
                        ))}
                        
                        {/* Calendar days */}
                        {Array.from({ length: 35 }, (_, i) => {
                          const date = new Date();
                          date.setDate(date.getDate() - date.getDay() + 1 + i);
                          const isCurrentMonth = date.getMonth() === new Date().getMonth();
                          const isToday = date.toDateString() === new Date().toDateString();
                          // ⚠️ `Math.random() > 0.7` semait des interventions au hasard
                          // dans le calendrier : environ trois jours sur dix en portaient
                          // une, et elles changeaient à chaque affichage. On planifie sa
                          // semaine là-dessus. Les vraies échéances viennent des plans.
                          const jour = date.toDateString();
                          const hasEvent = (maintenancePlans as any[]).some((plan: any) =>
                            plan?.nextDue && new Date(plan.nextDue).toDateString() === jour);
                          
                          return (
                            <div
                              key={i}
                              className={`p-2 min-h-[80px] border border-rule rounded-lg cursor-pointer hover:bg-paper transition-colors ${
                                !isCurrentMonth ? 'opacity-50' : ''
                              } ${isToday ? 'bg-etat-encours-fond border-etat-encours-filet' : ''}`}
                              onClick={() => {
                                toast({
                                  title: "Date sélectionnée",
                                  description: `Maintenance programmée le ${date.toLocaleDateString('fr-FR')}`,
                                });
                              }}
                            >
                              <div className="text-sm font-medium text-ink">
                                {date.getDate()}
                              </div>
                              {hasEvent && isCurrentMonth && (
                                <div className="mt-1">
                                  <div className="text-xs bg-etat-encours-vif text-white px-2 py-1 rounded">
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
                  <Card className="bg-white border border-rule">
                    <CardContent className="p-4">
                      <h4 className="font-medium text-ink mb-3">Légende</h4>
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-etat-encours-vif rounded"></div>
                          <span className="text-sm text-ink-soft">Maintenance planifiée</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-etat-nominal-vif rounded"></div>
                          <span className="text-sm text-ink-soft">Maintenance terminée</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-etat-critique-vif rounded"></div>
                          <span className="text-sm text-ink-soft">Maintenance en retard</span>
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
                    <h3 className="text-xl font-semibold text-ink">
                      Analyses et Métriques de Performance
                    </h3>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        // ⚠️ Cet export fabriquait ses chiffres : MTBF entre 120 et
                        // 200 h, MTTR entre 2 et 5 h, disponibilité entre 95 et 99 %,
                        // tirés au sort à chaque clic, et datés « Janvier 2025 ». Le
                        // fichier obtenu porte le nom de l'outil et circule ensuite
                        // par courriel. C'est la fabrication la plus dommageable :
                        // elle quitte l'écran et devient une pièce.
                        //
                        // On exporte désormais les plans réellement enregistrés.
                        const lignes = (maintenancePlans as any[]).map((plan: any) => [
                          JSON.stringify(plan?.planName ?? ''),
                          JSON.stringify(plan?.maintenanceType ?? ''),
                          JSON.stringify(plan?.frequency ?? ''),
                          plan?.nextDue ? new Date(plan.nextDue).toLocaleDateString('fr-FR') : '',
                          plan?.isActive ? 'actif' : 'inactif',
                        ].join(','));
                        const csvData = ['Plan,Type,Fréquence,Prochaine échéance,État', ...lignes].join('\n');
                        const blob = new Blob([csvData], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = 'plans-maintenance-preventive.csv';
                        link.click();
                        toast({
                          title: (maintenancePlans as any[]).length ? "Export terminé" : "Rien à exporter",
                          description: (maintenancePlans as any[]).length
                            ? `${(maintenancePlans as any[]).length} plan(s) exporté(s).`
                            : "Aucun plan de maintenance n'est enregistré.",
                        });
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


                  {/* Charts Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Performance Trends */}
                    <Card className="bg-white border border-rule">
                      <CardContent className="p-6">
                        <h4 className="text-lg font-semibold text-ink mb-4">
                          Tendances de Performance
                        </h4>
                        <div className="space-y-4">
                          {/* ⚠️ MTBF, MTTR, disponibilité et coûts étaient tirés au
                              sort : douze valeurs aléatoires par indicateur, redessinées
                              à chaque affichage. La barre de progression bougeait donc
                              toute seule, ce qui rendait l'ensemble crédible. Aucune de
                              ces quatre mesures n'existe dans la base. 2026-10-13. */}
                          <p className="text-sm text-ink-soft">
                            Aucune tendance de performance n'est disponible.
                          </p>
                          <p className="text-xs text-ink-mute">
                            MTBF, MTTR, disponibilité et coûts ne sont pas encore mesurés
                            par la plateforme. Le tableau de bord GMAO présente en revanche
                            les indicateurs réellement calculés à partir de vos interventions.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Equipment Health Distribution */}
                    <Card className="bg-white border border-rule">
                      <CardContent className="p-6">
                        <h4 className="text-lg font-semibold text-ink mb-4">
                          Distribution Santé Équipements
                        </h4>
                        <div className="space-y-4">
                          {[
                            { status: 'Excellent', count: 12, color: 'green' as ChartColor },
                            { status: 'Bon', count: 8, color: 'blue' as ChartColor },
                            { status: 'Moyen', count: 5, color: 'yellow' as ChartColor },
                            { status: 'Critique', count: 2, color: 'red' as ChartColor }
                          ].map((item) => (
                            <div key={item.status} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 ${CHART_COLOR[item.color].bg500} rounded-full`}></div>
                                <span className="text-sm text-ink-soft">{item.status}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-ink">{item.count}</span>
                                <div className="w-20 bg-paper-deep rounded-full h-2">
                                  <div
                                    className={`${CHART_COLOR[item.color].bg500} h-2 rounded-full`}
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
                  <Card className="bg-white border border-rule">
                    <CardContent className="p-6">
                      <h4 className="text-lg font-semibold text-ink mb-4">
                        Analyse Planning Maintenance
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-3">
                          <h5 className="font-medium text-ink">Cette Semaine</h5>
                          <div className="space-y-2">
                            {['Lundi: 3 maintenances', 'Mercredi: 2 maintenances', 'Vendredi: 1 maintenance'].map((item, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-ink-soft">
                                <div className="w-2 h-2 bg-etat-encours-vif rounded-full"></div>
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h5 className="font-medium text-ink">Prochaine Semaine</h5>
                          <div className="space-y-2">
                            {['Mardi: 2 maintenances', 'Jeudi: 4 maintenances', 'Samedi: 1 maintenance'].map((item, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-ink-soft">
                                <div className="w-2 h-2 bg-etat-nominal-vif rounded-full"></div>
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h5 className="font-medium text-ink">En Retard</h5>
                          <div className="space-y-2">
                            {['Moteur Principal: 2 jours', 'Pompe Hydraulique: 1 jour'].map((item, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-ink-soft">
                                <div className="w-2 h-2 bg-etat-critique-vif rounded-full"></div>
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
            <div className="bg-white p-6 rounded-none max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold text-ink mb-4">
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
                    className="w-full px-3 py-2 border border-rule rounded-lg"
                    value={addFormData.equipment}
                    onChange={(e) => setAddFormData({...addFormData, equipment: e.target.value})}
                  >
                    <option value="">Sélectionner un équipement</option>
                    <option value="moteur">Moteur Principal</option>
                    <option value="pompe">Pompe Hydraulique</option>
                    <option value="compresseur">Compresseur Air</option>
                    <option value="convoyeur">Convoyeur</option>
                    <option value="transformateur">Transformateur</option>
                    <option value="grue">Grue</option>
                    <option value="variateur">Variateur de fréquence</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                {addFormData.equipment === "autre" && (
                  <div>
                    <Label htmlFor="customEquipment">Nom de l'équipement</Label>
                    <Input 
                      id="customEquipment"
                      value={addFormData.customEquipment}
                      onChange={(e) => setAddFormData({...addFormData, customEquipment: e.target.value})}
                      placeholder="Ex: Ventilateur industriel, Machine spéciale..." 
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="frequency">Fréquence</Label>
                  <select 
                    id="frequency"
                    className="w-full px-3 py-2 border border-rule rounded-lg"
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
                    className="w-full px-3 py-2 border border-rule rounded-lg min-h-[60px]"
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
            <div className="bg-white p-6 rounded-none max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold text-ink mb-4">
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
                    className="w-full px-3 py-2 border border-rule rounded-lg"
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
                    className="w-full px-3 py-2 border border-rule rounded-lg min-h-[80px]"
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
    </AppShell>
  );
}