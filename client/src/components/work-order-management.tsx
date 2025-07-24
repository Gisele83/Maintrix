import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, Clock, CheckCircle, AlertTriangle, User } from "lucide-react";
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

const workOrderSchema = z.object({
  workOrderNumber: z.string().min(1, "Numéro d'ordre requis"),
  equipmentId: z.string().min(1, "Équipement requis"),
  workOrderType: z.string().min(1, "Type d'ordre requis"),
  priority: z.string().min(1, "Priorité requise"),
  status: z.string().min(1, "Statut requis"),
  assignedTo: z.string().optional(),
  description: z.string().min(1, "Description requise"),
  requestedBy: z.string().min(1, "Demandeur requis"),
  scheduledDate: z.string().optional(),
  estimatedDuration: z.string().optional(),
  notes: z.string().optional()
});

type WorkOrderFormData = z.infer<typeof workOrderSchema>;

interface WorkOrder {
  id: number;
  workOrderNumber?: string; // Make optional for backward compatibility
  orderNumber?: string; // Alternative field name
  equipmentId: number;
  equipmentName?: string;
  workOrderType?: string;
  orderType?: string; // Alternative field name
  priority: string;
  status: string;
  assignedTo?: string;
  description?: string;
  requestedBy?: string;
  scheduledDate?: string;
  estimatedDuration?: number;
  notes?: string;
  createdAt?: string;
  completedAt?: string;
}

export function WorkOrderManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch work orders
  const { data: workOrders = [], isLoading } = useQuery<WorkOrder[]>({
    queryKey: ["/api/work-orders"],
  });

  // Fetch equipment for dropdown
  const { data: equipment = [] } = useQuery({
    queryKey: ["/api/equipment"],
  });

  // Add work order mutation
  const addWorkOrderMutation = useMutation({
    mutationFn: (data: WorkOrderFormData) => apiRequest("/api/work-orders", {
      method: "POST",
      body: data
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setIsAddDialogOpen(false);
      toast({
        title: "Ordre de travail créé",
        description: "Le nouvel ordre de travail a été créé avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer l'ordre de travail",
        variant: "destructive",
      });
    }
  });

  // Update work order mutation
  const updateWorkOrderMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<WorkOrderFormData> }) => 
      apiRequest(`/api/work-orders/${id}`, {
        method: "PUT",
        body: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setIsEditDialogOpen(false);
      setSelectedWorkOrder(null);
      toast({
        title: "Ordre de travail mis à jour",
        description: "L'ordre de travail a été mis à jour avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'ordre de travail",
        variant: "destructive",
      });
    }
  });

  // Delete work order mutation
  const deleteWorkOrderMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/work-orders/${id}`, {
      method: "DELETE"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({
        title: "Ordre de travail supprimé",
        description: "L'ordre de travail a été supprimé avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'ordre de travail",
        variant: "destructive",
      });
    }
  });

  const form = useForm<WorkOrderFormData>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: {
      workOrderNumber: `WO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      equipmentId: "",
      workOrderType: "",
      priority: "medium",
      status: "pending",
      assignedTo: "",
      description: "",
      requestedBy: "",
      scheduledDate: "",
      estimatedDuration: "",
      notes: ""
    }
  });

  const filteredWorkOrders = workOrders.filter(wo => {
    const matchesSearch = (wo.workOrderNumber || wo.orderNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (wo.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (wo.equipmentName && wo.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || wo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const onSubmit = (data: WorkOrderFormData) => {
    // Transform form data to match API expectations
    const transformedData = {
      ...data,
      equipmentId: parseInt(data.equipmentId),
      estimatedDuration: data.estimatedDuration ? parseInt(data.estimatedDuration) : undefined,
      scheduledStart: data.scheduledDate ? new Date(data.scheduledDate).toISOString() : undefined,
      orderType: data.workOrderType, // Map workOrderType to orderType for API
    };

    // Remove frontend-only fields
    const { workOrderNumber, workOrderType, scheduledDate, ...apiData } = transformedData;

    if (selectedWorkOrder) {
      updateWorkOrderMutation.mutate({ id: selectedWorkOrder.id, data: apiData });
    } else {
      addWorkOrderMutation.mutate(apiData);
    }
  };

  const handleEdit = (workOrder: WorkOrder) => {
    setSelectedWorkOrder(workOrder);
    form.reset({
      workOrderNumber: workOrder.workOrderNumber || workOrder.orderNumber || '',
      equipmentId: workOrder.equipmentId?.toString() || '',
      workOrderType: workOrder.workOrderType || workOrder.orderType || '',
      priority: workOrder.priority || 'medium',
      status: workOrder.status || 'pending',
      assignedTo: workOrder.assignedTo || "",
      description: workOrder.description || '',
      requestedBy: workOrder.requestedBy || '',
      scheduledDate: workOrder.scheduledDate || "",
      estimatedDuration: workOrder.estimatedDuration?.toString() || "",
      notes: workOrder.notes || ""
    });
    setIsEditDialogOpen(true);
  };

  const handleStatusChange = (workOrderId: number, newStatus: string) => {
    updateWorkOrderMutation.mutate({
      id: workOrderId,
      data: { status: newStatus }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet ordre de travail ?")) {
      deleteWorkOrderMutation.mutate(id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "in_progress": return "bg-blue-100 text-blue-800";
      case "completed": return "bg-green-100 text-green-800";
      case "cancelled": return "bg-gray-100 text-gray-800";
      case "on_hold": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="w-4 h-4" />;
      case "in_progress": return <AlertTriangle className="w-4 h-4" />;
      case "completed": return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Chargement des ordres de travail...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Ordres de Travail</h2>
          <p className="text-gray-600">Gérez les demandes de maintenance et réparations</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => form.reset()}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvel Ordre de Travail
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer un Nouvel Ordre de Travail</DialogTitle>
            </DialogHeader>
            <WorkOrderForm
              form={form}
              onSubmit={onSubmit}
              isLoading={addWorkOrderMutation.isPending}
              equipment={equipment}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <div className="flex space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Rechercher par numéro, description ou équipement..."
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
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="completed">Terminé</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
            <SelectItem value="on_hold">En pause</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Work Orders Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredWorkOrders.map((wo) => (
          <Card key={wo.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(wo.status)}
                  <CardTitle className="text-lg">{wo.workOrderNumber || wo.orderNumber || `WO-${wo.id}`}</CardTitle>
                </div>
                <div className="flex space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(wo)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDelete(wo.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium text-sm text-gray-900 mb-1">Description:</p>
                <p className="text-sm text-gray-600 line-clamp-2">{wo.description || 'Aucune description'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium">Équipement:</span>
                  <p className="text-gray-600">{wo.equipmentName || `ID: ${wo.equipmentId}`}</p>
                </div>
                <div>
                  <span className="font-medium">Type:</span>
                  <p className="text-gray-600">{wo.workOrderType || wo.orderType || 'Non spécifié'}</p>
                </div>
                <div>
                  <span className="font-medium">Demandeur:</span>
                  <p className="text-gray-600">{wo.requestedBy || 'Non spécifié'}</p>
                </div>
                {wo.assignedTo && (
                  <div>
                    <span className="font-medium">Assigné à:</span>
                    <p className="text-gray-600">{wo.assignedTo}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <Badge className={getPriorityColor(wo.priority)}>
                  {wo.priority}
                </Badge>
                <Select
                  value={wo.status}
                  onValueChange={(value) => handleStatusChange(wo.id, value)}
                >
                  <SelectTrigger className="w-32 h-7">
                    <Badge className={getStatusColor(wo.status)}>
                      {wo.status}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="completed">Terminé</SelectItem>
                    <SelectItem value="cancelled">Annulé</SelectItem>
                    <SelectItem value="on_hold">En pause</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {wo.scheduledDate && (
                <div className="text-sm">
                  <span className="font-medium">Programmé:</span>
                  <p className="text-gray-600">{new Date(wo.scheduledDate).toLocaleDateString('fr-FR')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredWorkOrders.length === 0 && (
        <div className="text-center py-12">
          <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun ordre de travail trouvé</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm ? "Aucun ordre ne correspond à votre recherche." : "Commencez par créer votre premier ordre de travail."}
          </p>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Créer un Ordre de Travail
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'Ordre de Travail</DialogTitle>
          </DialogHeader>
          <WorkOrderForm
            form={form}
            onSubmit={onSubmit}
            isLoading={updateWorkOrderMutation.isPending}
            equipment={equipment}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Work Order Form Component
function WorkOrderForm({ 
  form, 
  onSubmit, 
  isLoading,
  equipment
}: { 
  form: any; 
  onSubmit: (data: WorkOrderFormData) => void; 
  isLoading: boolean;
  equipment: any[];
}) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="workOrderNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Numéro d'ordre *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: WO-2025-0001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="workOrderType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type d'ordre *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="corrective">Maintenance corrective</SelectItem>
                    <SelectItem value="preventive">Maintenance préventive</SelectItem>
                    <SelectItem value="emergency">Urgence</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="calibration">Étalonnage</SelectItem>
                    <SelectItem value="modification">Modification</SelectItem>
                    <SelectItem value="installation">Installation</SelectItem>
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
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priorité *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
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
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Statut *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="completed">Terminé</SelectItem>
                    <SelectItem value="cancelled">Annulé</SelectItem>
                    <SelectItem value="on_hold">En pause</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="requestedBy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Demandeur *</FormLabel>
                <FormControl>
                  <Input placeholder="Nom du demandeur" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="assignedTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assigné à</FormLabel>
                <FormControl>
                  <Input placeholder="Technicien assigné" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="estimatedDuration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Durée estimée (heures)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="ex: 4" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="scheduledDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date programmée</FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description du travail *</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Décrivez le travail à effectuer..."
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
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes supplémentaires</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Notes et instructions supplémentaires..."
                  rows={3}
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