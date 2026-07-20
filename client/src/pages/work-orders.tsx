import React, { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Wrench, Clock, CheckCircle, AlertCircle, Plus, Search, Calendar, User, MapPin,
  FileText, X, Edit, Eye, Play, Pause, CheckSquare, ClipboardList, GraduationCap, Loader2,
} from 'lucide-react';

interface CompetencyGap {
  workOrderId: number;
  technicianName: string;
  equipmentName: string;
  equipmentType: string;
}

function TrainingGapCheck({ workOrderId }: { workOrderId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: gap } = useQuery<CompetencyGap | null>({ queryKey: [`/api/techlearn-bridge/gaps/${workOrderId}`] });

  const requestTraining = useMutation({
    mutationFn: () => apiRequest('/api/techlearn-bridge/request-training', { method: 'POST', body: { workOrderId } }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/techlearn-bridge/gaps/${workOrderId}`] });
      toast({
        title: 'Formation demandée',
        description: data.techlearnConnected
          ? `TP recommandé : ${data.request.techlearn_tp_title ?? 'en cours de recherche côté TechLearn'}`
          : "Écart enregistré — TechLearn n'est pas joignable pour le moment.",
      });
    },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  if (!gap) return null;

  return (
    <div className="md:col-span-2 flex items-center justify-between bg-purple-50 border border-purple-100 rounded-lg px-4 py-3">
      <div className="text-xs text-purple-800 flex items-center gap-2">
        <GraduationCap className="h-4 w-4 flex-shrink-0" />
        {gap.technicianName} n'a jamais réalisé d'intervention sur un équipement de type "{gap.equipmentType}".
      </div>
      <Button size="sm" variant="outline" onClick={() => requestTraining.mutate()} disabled={requestTraining.isPending}>
        {requestTraining.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
        Former le technicien
      </Button>
    </div>
  );
}

// ─── Types (correspondent aux champs réels renvoyés par /api/work-orders) ─────
interface WorkOrderApi {
  id: number;
  orderNumber: string;
  equipmentId: number | null;
  equipmentName: string | null;
  orderType: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assignedTo: number | null;
  requestedBy: number | null;
  estimatedDuration: number | null; // minutes
  actualDuration: number | null; // minutes
  scheduledStart: string | null;
  location: string | null;
  createdAt: string;
}
interface EquipmentOption { id: number; equipmentName: string; }
interface UserOption { id: number; firstName: string | null; lastName: string | null; username: string; }

interface OrderFormState {
  title: string;
  description: string;
  equipmentId: string;
  priority: string;
  assignedTo: string;
  dueDate: string;
  estimatedHours: number;
  category: string;
}
const EMPTY_FORM: OrderFormState = {
  title: "", description: "", equipmentId: "", priority: "medium",
  assignedTo: "", dueDate: "", estimatedHours: 2, category: "Correctif",
};

export default function WorkOrders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [formState, setFormState] = useState<OrderFormState>(EMPTY_FORM);
  const [viewingOrder, setViewingOrder] = useState<WorkOrderApi | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: workOrders = [], isLoading, error } = useQuery<WorkOrderApi[]>({
    queryKey: ['/api/work-orders'],
    retry: 2,
    staleTime: 30000,
  });
  const { data: equipmentList = [] } = useQuery<EquipmentOption[]>({ queryKey: ['/api/equipment'] });
  const { data: users = [] } = useQuery<UserOption[]>({ queryKey: ['/api/user-profiles'] });

  const userLabel = (id: number | null) => {
    if (!id) return "Non assigné";
    const u = users.find(u => u.id === id);
    if (!u) return `Utilisateur #${id}`;
    return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username;
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/work-orders'] });

  const createMutation = useMutation({
    mutationFn: (payload: any) => apiRequest('/api/work-orders', { method: 'POST', body: payload }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Ordre de travail créé", description: `${formState.title} a été créé avec succès` });
      closeForm();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      apiRequest(`/api/work-orders/${id}`, { method: 'PUT', body: payload }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Ordre de travail mis à jour" });
      closeForm();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/api/work-orders/${id}`, { method: 'PUT', body: { status } }),
    onSuccess: (_data, variables) => {
      invalidate();
      toast({ title: "Statut mis à jour", description: getStatusConfig(variables.status).label });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const filteredOrders = workOrders.filter((order) => {
    const matchesSearch = (order.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.orderNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.equipmentName || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === "all" || order.status === selectedStatus;
    const matchesPriority = selectedPriority === "all" || order.priority === selectedPriority;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  function getStatusConfig(status: string) {
    switch (status) {
      case "pending": return { label: "En attente", color: "bg-yellow-100 text-yellow-800", icon: Clock };
      case "assigned": return { label: "Assigné", color: "bg-purple-100 text-purple-800", icon: User };
      case "in_progress": return { label: "En cours", color: "bg-blue-100 text-blue-800", icon: Play };
      case "paused": return { label: "Suspendu", color: "bg-orange-100 text-orange-800", icon: Pause };
      case "completed": return { label: "Terminé", color: "bg-green-100 text-green-800", icon: CheckCircle };
      case "cancelled": return { label: "Annulé", color: "bg-red-100 text-red-800", icon: X };
      default: return { label: status, color: "bg-gray-100 text-gray-800", icon: Clock };
    }
  }
  function getPriorityConfig(priority: string) {
    switch (priority) {
      case "urgent": case "critical": return { label: "Critique", color: "border-red-500 bg-red-50 text-red-700" };
      case "high": return { label: "Haute", color: "border-orange-500 bg-orange-50 text-orange-700" };
      case "medium": return { label: "Moyenne", color: "border-yellow-500 bg-yellow-50 text-yellow-700" };
      case "low": return { label: "Faible", color: "border-green-500 bg-green-50 text-green-700" };
      default: return { label: priority, color: "border-gray-500 bg-gray-50 text-gray-700" };
    }
  }

  const stats = {
    total: workOrders.length,
    pending: workOrders.filter(o => o.status === "pending").length,
    inProgress: workOrders.filter(o => o.status === "in_progress").length,
    completed: workOrders.filter(o => o.status === "completed").length,
    critical: workOrders.filter(o => o.priority === "critical" || o.priority === "urgent").length,
  };

  function closeForm() {
    setFormOpen(false);
    setEditingOrderId(null);
    setFormState(EMPTY_FORM);
  }

  function openCreateForm() {
    setFormState(EMPTY_FORM);
    setEditingOrderId(null);
    setFormOpen(true);
  }

  function openEditForm(order: WorkOrderApi) {
    setFormState({
      title: order.title,
      description: order.description || "",
      equipmentId: order.equipmentId ? String(order.equipmentId) : "",
      priority: order.priority,
      assignedTo: order.assignedTo ? String(order.assignedTo) : "",
      dueDate: order.scheduledStart ? order.scheduledStart.slice(0, 10) : "",
      estimatedHours: order.estimatedDuration ? order.estimatedDuration / 60 : 0,
      category: order.orderType === "preventive" ? "Préventif" : "Correctif",
    });
    setEditingOrderId(order.id);
    setFormOpen(true);
  }

  function handleSubmitForm() {
    if (!formState.title || !formState.equipmentId) {
      toast({ title: "Erreur", description: "Veuillez remplir au minimum le titre et l'équipement", variant: "destructive" });
      return;
    }
    const payload: any = {
      title: formState.title,
      description: formState.description,
      equipmentId: parseInt(formState.equipmentId, 10),
      priority: formState.priority,
      assignedTo: formState.assignedTo || undefined,
      dueDate: formState.dueDate || undefined,
      estimatedHours: formState.estimatedHours,
      category: formState.category,
    };
    if (editingOrderId) {
      updateMutation.mutate({ id: editingOrderId, payload });
    } else {
      payload.status = "pending";
      createMutation.mutate(payload);
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="container mx-auto p-6 space-y-6 bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Ordres de Travail
          </h1>
          <p className="text-gray-600 mt-2">Gestion complète des interventions de maintenance</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={openCreateForm} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg">
            <Plus className="h-4 w-4 mr-2" />
            Nouvel Ordre
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50 shadow-lg">
          <CardContent className="flex items-center p-4">
            <FileText className="h-8 w-8 text-blue-600" />
            <div className="ml-4"><p className="text-sm font-medium text-gray-600">Total</p><p className="text-2xl font-bold text-gray-900">{stats.total}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50 shadow-lg">
          <CardContent className="flex items-center p-4">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div className="ml-4"><p className="text-sm font-medium text-gray-600">En attente</p><p className="text-2xl font-bold text-gray-900">{stats.pending}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50 shadow-lg">
          <CardContent className="flex items-center p-4">
            <Play className="h-8 w-8 text-blue-600" />
            <div className="ml-4"><p className="text-sm font-medium text-gray-600">En cours</p><p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50 shadow-lg">
          <CardContent className="flex items-center p-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4"><p className="text-sm font-medium text-gray-600">Terminés</p><p className="text-2xl font-bold text-gray-900">{stats.completed}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50 shadow-lg">
          <CardContent className="flex items-center p-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <div className="ml-4"><p className="text-sm font-medium text-gray-600">Critiques</p><p className="text-2xl font-bold text-gray-900">{stats.critical}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input placeholder="Rechercher par numéro, titre ou équipement..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
            </div>
            <div className="flex gap-4">
              <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="assigned">Assigné</option>
                <option value="in_progress">En cours</option>
                <option value="paused">Suspendu</option>
                <option value="completed">Terminé</option>
                <option value="cancelled">Annulé</option>
              </select>
              <select value={selectedPriority} onChange={(e) => setSelectedPriority(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">Toutes priorités</option>
                <option value="critical">Critique</option>
                <option value="high">Haute</option>
                <option value="medium">Moyenne</option>
                <option value="low">Faible</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work Orders List */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <Card key={index} className="bg-white/70 backdrop-blur-sm border shadow-lg animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-800 mb-2">Erreur de chargement</h3>
              <p className="text-red-600 mb-4">Impossible de charger les ordres de travail.</p>
              <Button onClick={() => window.location.reload()} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
                Réessayer
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <Card className="bg-blue-50 border-blue-200 lg:col-span-2 xl:col-span-3">
          <CardContent className="p-8">
            <div className="text-center">
              <FileText className="h-16 w-16 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-blue-800 mb-2">Aucun ordre de travail trouvé</h3>
              <p className="text-blue-600 mb-4">
                {workOrders.length === 0 ? "Aucun ordre de travail n'a été créé pour le moment." : "Aucun ordre ne correspond aux filtres sélectionnés."}
              </p>
              <Button onClick={openCreateForm} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Créer le premier ordre
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredOrders.map((order) => {
            const statusConfig = getStatusConfig(order.status);
            const priorityConfig = getPriorityConfig(order.priority);
            const StatusIcon = statusConfig.icon;

            return (
              <Card key={order.id} className={`bg-white/70 backdrop-blur-sm border-2 ${priorityConfig.color} shadow-lg hover:shadow-xl transition-all duration-200`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-semibold text-gray-900">{order.orderNumber}</CardTitle>
                      <CardDescription className="text-sm text-gray-600 mt-1">{order.title}</CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={statusConfig.color}><StatusIcon className="h-3 w-3 mr-1" />{statusConfig.label}</Badge>
                      <Badge variant="outline" className="text-xs">{priorityConfig.label}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-gray-700">{order.description}</div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="flex items-center gap-1"><Wrench className="h-3 w-3 text-gray-500" /><span>{order.equipmentName || "N/A"}</span></div>
                    <div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-gray-500" /><span>{order.location || "Non spécifié"}</span></div>
                    <div className="flex items-center gap-1"><User className="h-3 w-3 text-gray-500" /><span>{userLabel(order.assignedTo)}</span></div>
                    <div className="flex items-center gap-1"><Calendar className="h-3 w-3 text-gray-500" /><span>{order.scheduledStart ? order.scheduledStart.slice(0, 10) : "Non programmé"}</span></div>
                  </div>

                  {order.status === "in_progress" && (
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between text-sm">
                        <span>Progression:</span>
                        <span>{Math.round((order.actualDuration || 0) / 60)}h / {Math.round((order.estimatedDuration || 120) / 60)}h</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                        <div className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(((order.actualDuration || 0) / (order.estimatedDuration || 120)) * 100, 100)}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setViewingOrder(order)}>
                        <Eye className="h-3 w-3 mr-1" />Voir
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEditForm(order)}>
                        <Edit className="h-3 w-3 mr-1" />Éditer
                      </Button>
                      <Link href={`/maintenance-execution/${order.id}`}>
                        <Button size="sm" variant="outline">
                          <ClipboardList className="h-3 w-3 mr-1" />Intervention
                        </Button>
                      </Link>
                    </div>

                    {order.status === "pending" && (
                      <Button size="sm" onClick={() => statusMutation.mutate({ id: order.id, status: "in_progress" })}
                        disabled={statusMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Play className="h-3 w-3 mr-1" />Démarrer
                      </Button>
                    )}
                    {order.status === "in_progress" && (
                      <Button size="sm" onClick={() => statusMutation.mutate({ id: order.id, status: "completed" })}
                        disabled={statusMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
                        <CheckSquare className="h-3 w-3 mr-1" />Terminer
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Order Modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{editingOrderId ? "Éditer l'Ordre de Travail" : "Créer un Ordre de Travail"}</h2>
              <Button variant="ghost" size="sm" onClick={closeForm}><X className="h-5 w-5" /></Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="title">Titre *</Label>
                <Input id="title" value={formState.title} onChange={(e) => setFormState({ ...formState, title: e.target.value })} placeholder="Ex: Maintenance préventive moteur" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={formState.description} onChange={(e) => setFormState({ ...formState, description: e.target.value })} placeholder="Description détaillée de l'intervention" rows={3} />
              </div>
              <div>
                <Label htmlFor="equipment">Équipement *</Label>
                <select id="equipment" value={formState.equipmentId} onChange={(e) => setFormState({ ...formState, equipmentId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Sélectionner un équipement</option>
                  {equipmentList.map(eq => <option key={eq.id} value={eq.id}>{eq.equipmentName}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="priority">Priorité</Label>
                <select id="priority" value={formState.priority} onChange={(e) => setFormState({ ...formState, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="low">Faible</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute</option>
                  <option value="critical">Critique</option>
                </select>
              </div>
              <div>
                <Label htmlFor="category">Catégorie</Label>
                <select id="category" value={formState.category} onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Correctif">Correctif</option>
                  <option value="Préventif">Préventif</option>
                </select>
              </div>
              <div>
                <Label htmlFor="assignedTo">Assigné à</Label>
                <select id="assignedTo" value={formState.assignedTo} onChange={(e) => setFormState({ ...formState, assignedTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Non assigné</option>
                  {users.map(u => <option key={u.id} value={u.id}>{[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="dueDate">Date d'échéance</Label>
                <Input id="dueDate" type="date" value={formState.dueDate} onChange={(e) => setFormState({ ...formState, dueDate: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="estimatedHours">Heures estimées</Label>
                <Input id="estimatedHours" type="number" step="0.5" value={formState.estimatedHours}
                  onChange={(e) => setFormState({ ...formState, estimatedHours: parseFloat(e.target.value) || 0 })} placeholder="0.0" />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={closeForm}>Annuler</Button>
              <Button onClick={handleSubmitForm} disabled={isSubmitting} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                {editingOrderId ? <Edit className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {editingOrderId ? "Enregistrer" : "Créer l'Ordre"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Order Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Détails - {viewingOrder.orderNumber}</h2>
              <Button variant="ghost" size="sm" onClick={() => setViewingOrder(null)}><X className="h-5 w-5" /></Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div><Label className="text-sm font-medium text-gray-600">Titre</Label><p className="text-lg font-semibold">{viewingOrder.title}</p></div>
                <div><Label className="text-sm font-medium text-gray-600">Description</Label><p className="text-gray-800">{viewingOrder.description || "—"}</p></div>
                <div><Label className="text-sm font-medium text-gray-600">Équipement</Label><p className="text-gray-800">{viewingOrder.equipmentName || "N/A"}</p></div>
                <div><Label className="text-sm font-medium text-gray-600">Localisation</Label><p className="text-gray-800">{viewingOrder.location || "Non spécifié"}</p></div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-sm font-medium text-gray-600">Statut</Label><br /><Badge className={getStatusConfig(viewingOrder.status).color}>{getStatusConfig(viewingOrder.status).label}</Badge></div>
                  <div><Label className="text-sm font-medium text-gray-600">Priorité</Label><br /><Badge variant="outline" className="text-xs">{getPriorityConfig(viewingOrder.priority).label}</Badge></div>
                </div>
                <div><Label className="text-sm font-medium text-gray-600">Assigné à</Label><p className="text-gray-800">{userLabel(viewingOrder.assignedTo)}</p></div>
                <div><Label className="text-sm font-medium text-gray-600">Demandeur</Label><p className="text-gray-800">{userLabel(viewingOrder.requestedBy)}</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-sm font-medium text-gray-600">Date création</Label><p className="text-gray-800">{viewingOrder.createdAt ? viewingOrder.createdAt.slice(0, 10) : "—"}</p></div>
                  <div><Label className="text-sm font-medium text-gray-600">Date échéance</Label><p className="text-gray-800">{viewingOrder.scheduledStart ? viewingOrder.scheduledStart.slice(0, 10) : "—"}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-sm font-medium text-gray-600">Heures estimées</Label><p className="text-gray-800">{viewingOrder.estimatedDuration ? (viewingOrder.estimatedDuration / 60).toFixed(1) : 0}h</p></div>
                  <div><Label className="text-sm font-medium text-gray-600">Heures réelles</Label><p className="text-gray-800">{viewingOrder.actualDuration ? (viewingOrder.actualDuration / 60).toFixed(1) : 0}h</p></div>
                </div>
              </div>
              <TrainingGapCheck workOrderId={viewingOrder.id} />
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={() => setViewingOrder(null)}>Fermer</Button>
              <Link href={`/maintenance-execution/${viewingOrder.id}`}>
                <Button variant="outline"><ClipboardList className="h-4 w-4 mr-2" />Suivre l'intervention</Button>
              </Link>
              <Button onClick={() => { openEditForm(viewingOrder); setViewingOrder(null); }} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                <Edit className="h-4 w-4 mr-2" />Éditer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
