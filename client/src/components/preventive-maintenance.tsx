import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, Calendar, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const maintenancePlanSchema = z.object({
  equipmentId: z.string().min(1, "Équipement requis"),
  maintenanceType: z.string().min(1, "Type de maintenance requis"),
  frequency: z.string().min(1, "Fréquence requise"),
  frequencyValue: z.string().min(1, "Valeur de fréquence requise"),
  description: z.string().min(1, "Description requise"),
  estimatedDuration: z.string().optional(),
  assignedTeam: z.string().optional(),
  priority: z.string().min(1, "Priorité requise"),
  isActive: z.boolean().default(true),
  lastMaintenance: z.string().optional(),
  nextMaintenance: z.string().optional(),
  instructions: z.string().optional(),
  requiredParts: z.string().optional(),
  safetyNotes: z.string().optional()
});

type MaintenancePlanFormData = z.infer<typeof maintenancePlanSchema>;

interface MaintenancePlan {
  id: number;
  equipmentId: number;
  equipmentName?: string;
  maintenanceType: string;
  frequency: string;
  frequencyValue: number;
  description: string;
  estimatedDuration?: number;
  assignedTeam?: string;
  priority: string;
  isActive: boolean;
  lastMaintenance?: string;
  nextMaintenance?: string;
  instructions?: string;
  requiredParts?: string;
  safetyNotes?: string;
  createdAt?: string;
}

export function PreventiveMaintenance() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MaintenancePlan | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch maintenance plans
  const { data: maintenancePlans = [], isLoading } = useQuery<MaintenancePlan[]>({
    queryKey: ["/api/preventive-maintenance-plans"],
  });

  // Fetch equipment for dropdown
  const { data: equipment = [] } = useQuery({
    queryKey: ["/api/equipment"],
  });

  // Add maintenance plan mutation
  const addPlanMutation = useMutation({
    mutationFn: (data: MaintenancePlanFormData) => apiRequest("/api/preventive-maintenance-plans", {
      method: "POST",
      body: data
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/preventive-maintenance-plans"] });
      setIsAddDialogOpen(false);
      toast({
        title: "Plan de maintenance créé",
        description: "Le nouveau plan de maintenance a été créé avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer le plan de maintenance",
        variant: "destructive",
      });
    }
  });

  // Update maintenance plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MaintenancePlanFormData> }) => 
      apiRequest(`/api/preventive-maintenance-plans/${id}`, {
        method: "PUT",
        body: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/preventive-maintenance-plans"] });
      setIsEditDialogOpen(false);
      setSelectedPlan(null);
      toast({
        title: "Plan de maintenance mis à jour",
        description: "Le plan de maintenance a été mis à jour avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le plan de maintenance",
        variant: "destructive",
      });
    }
  });

  // Delete maintenance plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/preventive-maintenance-plans/${id}`, {
      method: "DELETE"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/preventive-maintenance-plans"] });
      toast({
        title: "Plan de maintenance supprimé",
        description: "Le plan de maintenance a été supprimé avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le plan de maintenance",
        variant: "destructive",
      });
    }
  });

  const form = useForm<MaintenancePlanFormData>({
    resolver: zodResolver(maintenancePlanSchema),
    defaultValues: {
      equipmentId: "",
      maintenanceType: "",
      frequency: "",
      frequencyValue: "",
      description: "",
      estimatedDuration: "",
      assignedTeam: "",
      priority: "medium",
      isActive: true,
      lastMaintenance: "",
      nextMaintenance: "",
      instructions: "",
      requiredParts: "",
      safetyNotes: ""
    }
  });

  const filteredPlans = maintenancePlans.filter(plan => {
    const matchesSearch = plan.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (plan.equipmentName && plan.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "active" && plan.isActive) ||
                         (statusFilter === "inactive" && !plan.isActive);
    return matchesSearch && matchesStatus;
  });

  const onSubmit = (data: MaintenancePlanFormData) => {
    if (selectedPlan) {
      updatePlanMutation.mutate({ id: selectedPlan.id, data });
    } else {
      addPlanMutation.mutate(data);
    }
  };

  const handleEdit = (plan: MaintenancePlan) => {
    setSelectedPlan(plan);
    form.reset({
      equipmentId: plan.equipmentId.toString(),
      maintenanceType: plan.maintenanceType,
      frequency: plan.frequency,
      frequencyValue: plan.frequencyValue.toString(),
      description: plan.description,
      estimatedDuration: plan.estimatedDuration?.toString() || "",
      assignedTeam: plan.assignedTeam || "",
      priority: plan.priority,
      isActive: plan.isActive,
      lastMaintenance: plan.lastMaintenance || "",
      nextMaintenance: plan.nextMaintenance || "",
      instructions: plan.instructions || "",
      requiredParts: plan.requiredParts || "",
      safetyNotes: plan.safetyNotes || ""
    });
    setIsEditDialogOpen(true);
  };

  const handleToggleActive = (planId: number, isActive: boolean) => {
    updatePlanMutation.mutate({
      id: planId,
      data: { isActive: !isActive }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce plan de maintenance ?")) {
      deletePlanMutation.mutate(id);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800";
      case "high": return "bg-orange-100 text-orange-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800";
  };

  const calculateNextMaintenance = (lastMaintenance: string, frequency: string, frequencyValue: number) => {
    if (!lastMaintenance) return "Non programmée";
    
    const lastDate = new Date(lastMaintenance);
    let nextDate = new Date(lastDate);
    
    switch (frequency) {
      case "days":
        nextDate.setDate(nextDate.getDate() + frequencyValue);
        break;
      case "weeks":
        nextDate.setDate(nextDate.getDate() + (frequencyValue * 7));
        break;
      case "months":
        nextDate.setMonth(nextDate.getMonth() + frequencyValue);
        break;
      case "years":
        nextDate.setFullYear(nextDate.getFullYear() + frequencyValue);
        break;
    }
    
    return nextDate.toLocaleDateString('fr-FR');
  };

  const isOverdue = (nextMaintenance: string) => {
    if (!nextMaintenance || nextMaintenance === "Non programmée") return false;
    return new Date(nextMaintenance) < new Date();
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Chargement des plans de maintenance...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Maintenance Préventive</h2>
          <p className="text-gray-600">Planifiez et gérez la maintenance préventive de vos équipements</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => form.reset()}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Plan de Maintenance
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer un Nouveau Plan de Maintenance</DialogTitle>
            </DialogHeader>
            <MaintenancePlanForm
              form={form}
              onSubmit={onSubmit}
              isLoading={addPlanMutation.isPending}
              equipment={equipment as any[]}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <div className="flex space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Rechercher par description ou équipement..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les plans</SelectItem>
            <SelectItem value="active">Plans actifs</SelectItem>
            <SelectItem value="inactive">Plans inactifs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Maintenance Plans Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredPlans.map((plan) => {
          const nextMaintenanceDate = plan.nextMaintenance || 
            calculateNextMaintenance(plan.lastMaintenance || "", plan.frequency, plan.frequencyValue);
          const isMaintenanceOverdue = isOverdue(nextMaintenanceDate);
          
          return (
            <Card key={plan.id} className={`hover:shadow-lg transition-shadow ${isMaintenanceOverdue ? 'border-red-200' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <CardTitle className="text-lg">{plan.equipmentName || `Équipement ${plan.equipmentId}`}</CardTitle>
                  </div>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(plan)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDelete(plan.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium text-sm text-gray-900 mb-1">Type de maintenance:</p>
                  <p className="text-sm text-gray-600">{plan.maintenanceType}</p>
                </div>

                <div>
                  <p className="font-medium text-sm text-gray-900 mb-1">Description:</p>
                  <p className="text-sm text-gray-600 line-clamp-2">{plan.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Fréquence:</span>
                    <p className="text-gray-600">{plan.frequencyValue} {plan.frequency}</p>
                  </div>
                  {plan.estimatedDuration && (
                    <div>
                      <span className="font-medium">Durée:</span>
                      <p className="text-gray-600">{plan.estimatedDuration}h</p>
                    </div>
                  )}
                  {plan.assignedTeam && (
                    <div className="col-span-2">
                      <span className="font-medium">Équipe:</span>
                      <p className="text-gray-600">{plan.assignedTeam}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {plan.lastMaintenance && (
                    <div className="text-sm">
                      <span className="font-medium">Dernière maintenance:</span>
                      <p className="text-gray-600">{new Date(plan.lastMaintenance).toLocaleDateString('fr-FR')}</p>
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="font-medium">Prochaine maintenance:</span>
                    <p className={`${isMaintenanceOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {isMaintenanceOverdue && <AlertTriangle className="w-4 h-4 inline mr-1" />}
                      {nextMaintenanceDate}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Badge className={getPriorityColor(plan.priority)}>
                    {plan.priority}
                  </Badge>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(plan.isActive)}>
                      {plan.isActive ? "Actif" : "Inactif"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(plan.id, plan.isActive)}
                      className="text-xs"
                    >
                      {plan.isActive ? "Désactiver" : "Activer"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredPlans.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun plan de maintenance trouvé</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm ? "Aucun plan ne correspond à votre recherche." : "Commencez par créer votre premier plan de maintenance."}
          </p>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Créer un Plan de Maintenance
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le Plan de Maintenance</DialogTitle>
          </DialogHeader>
          <MaintenancePlanForm
            form={form}
            onSubmit={onSubmit}
            isLoading={updatePlanMutation.isPending}
            equipment={equipment as any[]}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Maintenance Plan Form Component
function MaintenancePlanForm({ 
  form, 
  onSubmit, 
  isLoading,
  equipment
}: { 
  form: any; 
  onSubmit: (data: MaintenancePlanFormData) => void; 
  isLoading: boolean;
  equipment: any[];
}) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="equipmentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Équipement *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un équipement" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {equipment.map((eq: any) => (
                      <SelectItem key={eq.id} value={eq.id.toString()}>
                        {eq.equipmentName} ({eq.equipmentCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="maintenanceType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type de maintenance *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="lubrication">Lubrification</SelectItem>
                    <SelectItem value="cleaning">Nettoyage</SelectItem>
                    <SelectItem value="calibration">Étalonnage</SelectItem>
                    <SelectItem value="replacement">Remplacement</SelectItem>
                    <SelectItem value="testing">Test</SelectItem>
                    <SelectItem value="adjustment">Ajustement</SelectItem>
                    <SelectItem value="overhaul">Révision générale</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="frequencyValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fréquence *</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="ex: 30" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="frequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unité *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Unité" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="days">Jours</SelectItem>
                    <SelectItem value="weeks">Semaines</SelectItem>
                    <SelectItem value="months">Mois</SelectItem>
                    <SelectItem value="years">Années</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priorité *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Priorité" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">Élevé</SelectItem>
                    <SelectItem value="medium">Moyen</SelectItem>
                    <SelectItem value="low">Faible</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="estimatedDuration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Durée estimée (heures)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="ex: 2" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="assignedTeam"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Équipe assignée</FormLabel>
                <FormControl>
                  <Input placeholder="ex: Équipe Mécanique" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="lastMaintenance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dernière maintenance</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="nextMaintenance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prochaine maintenance</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description *</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Décrivez les tâches de maintenance à effectuer..."
                  rows={3}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="instructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Instructions détaillées</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Instructions étape par étape pour la maintenance..."
                  rows={3}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="requiredParts"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pièces nécessaires</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Liste des pièces et consommables nécessaires..."
                  rows={2}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="safetyNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes de sécurité</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Précautions de sécurité importantes..."
                  rows={2}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline">
            Annuler
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}