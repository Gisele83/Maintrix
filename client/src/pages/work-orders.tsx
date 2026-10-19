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
import { AppShell, EnTetePage, ActionPrincipale, EtatVide } from '@/components/app-shell';
import { Indicateur, RangeeIndicateurs, PuceEtat } from '@/components/indicateurs';
import { ETAT, type RegistreEtat } from '@/lib/etats';
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
    <div className="md:col-span-2 flex items-center justify-between bg-paper-deep border border-rule rounded-lg px-4 py-3">
      <div className="text-xs text-signal-deep flex items-center gap-2">
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

interface LifecycleSuggestion {
  toStage: string;
  reason: string;
}

function LifecycleSuggestionBanner({ workOrderId, equipmentId }: { workOrderId: number; equipmentId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: suggestion } = useQuery<LifecycleSuggestion | null>({
    queryKey: [`/api/equipment-lifecycle/${equipmentId}/suggestion?workOrderId=${workOrderId}`],
  });

  const applyTransition = useMutation({
    mutationFn: () => apiRequest(`/api/equipment-lifecycle/${equipmentId}/transition`, {
      method: 'POST',
      body: { toStage: suggestion?.toStage, reason: suggestion?.reason, workOrderId },
    }),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/equipment-lifecycle/${equipmentId}/suggestion?workOrderId=${workOrderId}`] });
      toast({ title: 'Cycle de vie mis à jour', description: `Nouvelle étape : ${result.equipment.lifecycleStage}` });
    },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  if (!suggestion) return null;

  return (
    <div className="md:col-span-2 flex items-center justify-between bg-etat-encours-fond border border-etat-encours-filet px-4 py-3">
      <div className="text-xs text-etat-encours-texte flex items-center gap-2">
        <ClipboardList className="h-4 w-4 flex-shrink-0" />
        Cycle de vie ISO 55000 — {suggestion.reason}. Faire transiter l'équipement vers « {suggestion.toStage} » ?
      </div>
      <Button size="sm" variant="outline" onClick={() => applyTransition.mutate()} disabled={applyTransition.isPending}>
        {applyTransition.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
        Appliquer
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

  /**
   * Statuts et priorités passent par les jetons d'état partagés
   * (`lib/etats.ts`). Ils étaient écrits ici en aplats bruts de Tailwind —
   * `bg-etat-alerte-fond text-etat-alerte-texte`, `border-etat-critique-filet bg-etat-critique-fond text-etat-critique-texte` —
   * différents de ceux de la GMAO pour le MÊME statut : « En attente » était
   * ambre ici, jaune là-bas. Un statut doit avoir une seule couleur dans
   * toute l'application, sinon il ne se reconnaît plus d'un écran à l'autre.
   */
  function getStatusConfig(status: string): { label: string; registre: RegistreEtat; icon: typeof Clock } {
    switch (status) {
      case "pending": return { label: "En attente", registre: "alerte", icon: Clock };
      case "assigned": return { label: "Assigné", registre: "encours", icon: User };
      case "in_progress": return { label: "En cours", registre: "encours", icon: Play };
      case "paused": return { label: "Suspendu", registre: "alerte", icon: Pause };
      case "completed": return { label: "Terminé", registre: "nominal", icon: CheckCircle };
      case "cancelled": return { label: "Annulé", registre: "neutre", icon: X };
      default: return { label: status, registre: "neutre", icon: Clock };
    }
  }
  function getPriorityConfig(priority: string): { label: string; registre: RegistreEtat } {
    switch (priority) {
      case "urgent": case "critical": return { label: "Critique", registre: "critique" };
      case "high": return { label: "Haute", registre: "alerte" };
      case "medium": return { label: "Moyenne", registre: "encours" };
      case "low": return { label: "Faible", registre: "nominal" };
      default: return { label: priority, registre: "neutre" };
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
    <AppShell filAriane={[{ libelle: "GMAO", href: "/gmao" }, { libelle: "Ordres de travail" }]} largeur="large">
    <div className="space-y-6">
      <EnTetePage
        surTitre="GMAO"
        titre="Ordres de travail"
        action={
          <ActionPrincipale onClick={openCreateForm}>
            <Plus className="h-4 w-4" />
            Nouvel ordre de travail
          </ActionPrincipale>
        }
      />

      {/* Cinq tuiles à filet, comme la GMAO et l'ingénierie. Elles étaient
          cinq cartes blanches à grosse icône de couleur, dont la teinte ne
          disait rien — une icône bleue pour « Total », une autre bleue pour
          « En cours ». La couleur revient là où elle informe : le liseré ne
          s'allume que s'il y a quelque chose à faire. */}
      <RangeeIndicateurs colonnes={4}>
        <Indicateur libelle="Total" valeur={stats.total} precision={stats.total > 0 ? "ordres enregistrés" : "aucun ordre à ce jour"} icone={FileText} />
        <Indicateur libelle="En attente" valeur={stats.pending} precision={stats.pending > 0 ? "à assigner ou à planifier" : "rien en attente"} icone={Clock} alerte={stats.pending > 0} />
        <Indicateur libelle="En cours" valeur={stats.inProgress} precision={stats.inProgress > 0 ? "interventions engagées" : "aucune intervention engagée"} icone={Play} />
        <Indicateur libelle="Critiques" valeur={stats.critical} precision={stats.critical > 0 ? "à traiter sans délai" : "aucune urgence"} icone={AlertCircle} alerte={stats.critical > 0} />
      </RangeeIndicateurs>

      {/* Recherche et filtres */}
      <div className="border border-rule bg-white p-5">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute h-4 w-4" aria-hidden="true" />
            <Input
              id="recherche-ordres"
              aria-label="Rechercher un ordre de travail"
              placeholder="Rechercher par numéro, titre ou équipement..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-rule"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Filtrer par statut"
              className="h-10 px-3 border border-rule bg-white text-sm text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="assigned">Assigné</option>
              <option value="in_progress">En cours</option>
              <option value="paused">Suspendu</option>
              <option value="completed">Terminé</option>
              <option value="cancelled">Annulé</option>
            </select>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              aria-label="Filtrer par priorité"
              className="h-10 px-3 border border-rule bg-white text-sm text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal"
            >
              <option value="all">Toutes priorités</option>
              <option value="critical">Critique</option>
              <option value="high">Haute</option>
              <option value="medium">Moyenne</option>
              <option value="low">Faible</option>
            </select>
          </div>
        </div>
      </div>

      {/* Work Orders List */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <Card key={index} className="bg-white border border-rule animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-paper-deep w-3/4 mb-2"></div>
                <div className="h-3 bg-paper-deep w-full"></div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-3 bg-paper-deep w-full"></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-3 bg-paper-deep"></div>
                  <div className="h-3 bg-paper-deep"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        /* L'échec de chargement est un état critique : il passe par les jetons
           d'état, dont le contraste est mesuré, et non par un `bg-etat-critique-fond`
           choisi à l'œil. */
        <div className="border border-etat-critique-filet bg-etat-critique-fond p-6">
          <AlertCircle className="h-5 w-5 text-etat-critique-texte" aria-hidden="true" />
          <h3 className="font-serif text-title font-medium text-etat-critique-texte mt-3">
            Les ordres de travail n'ont pas pu être chargés
          </h3>
          <p className="text-sm text-etat-critique-texte mt-2">
            Vérifiez votre connexion, puis réessayez. Aucun ordre n'est affiché tant que les
            données réelles ne sont pas disponibles.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 h-10 px-4 mt-4 border border-etat-critique-filet bg-white text-sm text-etat-critique-texte hover:bg-etat-critique-fond transition-colors"
          >
            Réessayer
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <EtatVide
          icone={FileText}
          titre={workOrders.length === 0 ? "Aucun ordre de travail" : "Aucun ordre ne correspond aux filtres"}
          phrase={
            workOrders.length === 0
              ? "Un ordre de travail porte une demande, une priorité et un responsable. C'est lui qui trace l'intervention, de la demande au retour d'expérience."
              : "Élargissez la recherche, ou remettez les filtres de statut et de priorité sur « tous »."
          }
          action={
            workOrders.length === 0 ? (
              <ActionPrincipale onClick={openCreateForm}>
                <Plus className="h-4 w-4" />
                Créer le premier ordre
              </ActionPrincipale>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredOrders.map((order) => {
            const statusConfig = getStatusConfig(order.status);
            const priorityConfig = getPriorityConfig(order.priority);
            const StatusIcon = statusConfig.icon;

            return (
              /* La priorité tenait la bordure ENTIÈRE de la carte en couleur
                 vive (`border-2 border-etat-critique-filet`) : sur une grille de cartes,
                 cela produisait un damier bariolé où plus rien ne ressortait.
                 Elle passe sur un liseré de gauche, comme les indicateurs. */
              <Card key={order.id} className="bg-white border border-rule shadow-none relative">
                <span
                  className={`absolute left-0 top-0 bottom-0 w-0.5 ${ETAT[priorityConfig.registre].filet}`}
                  aria-hidden="true"
                />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="font-mono text-sm text-ink-mute">{order.orderNumber}</CardTitle>
                      <CardDescription className="font-serif text-title text-ink mt-1">{order.title}</CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <PuceEtat registre={statusConfig.registre}>
                        <StatusIcon className="h-3 w-3" aria-hidden="true" />
                        {statusConfig.label}
                      </PuceEtat>
                      <PuceEtat registre={priorityConfig.registre}>{priorityConfig.label}</PuceEtat>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-ink-soft">{order.description}</div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="flex items-center gap-1"><Wrench className="h-3 w-3 text-ink-mute" /><span>{order.equipmentName || "N/A"}</span></div>
                    <div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-ink-mute" /><span>{order.location || "Non spécifié"}</span></div>
                    <div className="flex items-center gap-1"><User className="h-3 w-3 text-ink-mute" /><span>{userLabel(order.assignedTo)}</span></div>
                    <div className="flex items-center gap-1"><Calendar className="h-3 w-3 text-ink-mute" /><span>{order.scheduledStart ? order.scheduledStart.slice(0, 10) : "Non programmé"}</span></div>
                  </div>

                  {order.status === "in_progress" && (
                    <div className="bg-paper-deep border border-rule p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>Progression:</span>
                        <span>{Math.round((order.actualDuration || 0) / 60)}h / {Math.round((order.estimatedDuration || 120) / 60)}h</span>
                      </div>
                      <div className="w-full bg-paper-deep h-2 mt-2">
                        <div className="bg-signal h-2 transition-all duration-300"
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
                        disabled={statusMutation.isPending} className="bg-ink text-paper hover:bg-signal">
                        <Play className="h-3 w-3 mr-1" />Démarrer
                      </Button>
                    )}
                    {order.status === "in_progress" && (
                      <Button size="sm" onClick={() => statusMutation.mutate({ id: order.id, status: "completed" })}
                        disabled={statusMutation.isPending} className="bg-ink text-paper hover:bg-signal">
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
              <h2 className="text-2xl font-bold text-ink">{editingOrderId ? "Éditer l'Ordre de Travail" : "Créer un Ordre de Travail"}</h2>
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
                  className="w-full px-3 py-2 border border-rule rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Sélectionner un équipement</option>
                  {equipmentList.map(eq => <option key={eq.id} value={eq.id}>{eq.equipmentName}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="priority">Priorité</Label>
                <select id="priority" value={formState.priority} onChange={(e) => setFormState({ ...formState, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-rule rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="low">Faible</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute</option>
                  <option value="critical">Critique</option>
                </select>
              </div>
              <div>
                <Label htmlFor="category">Catégorie</Label>
                <select id="category" value={formState.category} onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                  className="w-full px-3 py-2 border border-rule rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Correctif">Correctif</option>
                  <option value="Préventif">Préventif</option>
                </select>
              </div>
              <div>
                <Label htmlFor="assignedTo">Assigné à</Label>
                <select id="assignedTo" value={formState.assignedTo} onChange={(e) => setFormState({ ...formState, assignedTo: e.target.value })}
                  className="w-full px-3 py-2 border border-rule rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
              <Button onClick={handleSubmitForm} disabled={isSubmitting} className="bg-ink text-white">
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
              <h2 className="text-2xl font-bold text-ink">Détails - {viewingOrder.orderNumber}</h2>
              <Button variant="ghost" size="sm" onClick={() => setViewingOrder(null)}><X className="h-5 w-5" /></Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div><Label className="text-sm font-medium text-ink-soft">Titre</Label><p className="text-lg font-semibold">{viewingOrder.title}</p></div>
                <div><Label className="text-sm font-medium text-ink-soft">Description</Label><p className="text-ink">{viewingOrder.description || "—"}</p></div>
                <div><Label className="text-sm font-medium text-ink-soft">Équipement</Label><p className="text-ink">{viewingOrder.equipmentName || "N/A"}</p></div>
                <div><Label className="text-sm font-medium text-ink-soft">Localisation</Label><p className="text-ink">{viewingOrder.location || "Non spécifié"}</p></div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-sm font-medium text-ink-soft">Statut</Label><br /><PuceEtat registre={getStatusConfig(viewingOrder.status).registre}>{getStatusConfig(viewingOrder.status).label}</PuceEtat></div>
                  <div><Label className="text-sm font-medium text-ink-soft">Priorité</Label><br /><Badge variant="outline" className="text-xs">{getPriorityConfig(viewingOrder.priority).label}</Badge></div>
                </div>
                <div><Label className="text-sm font-medium text-ink-soft">Assigné à</Label><p className="text-ink">{userLabel(viewingOrder.assignedTo)}</p></div>
                <div><Label className="text-sm font-medium text-ink-soft">Demandeur</Label><p className="text-ink">{userLabel(viewingOrder.requestedBy)}</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-sm font-medium text-ink-soft">Date création</Label><p className="text-ink">{viewingOrder.createdAt ? viewingOrder.createdAt.slice(0, 10) : "—"}</p></div>
                  <div><Label className="text-sm font-medium text-ink-soft">Date échéance</Label><p className="text-ink">{viewingOrder.scheduledStart ? viewingOrder.scheduledStart.slice(0, 10) : "—"}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-sm font-medium text-ink-soft">Heures estimées</Label><p className="text-ink">{viewingOrder.estimatedDuration ? (viewingOrder.estimatedDuration / 60).toFixed(1) : 0}h</p></div>
                  <div><Label className="text-sm font-medium text-ink-soft">Heures réelles</Label><p className="text-ink">{viewingOrder.actualDuration ? (viewingOrder.actualDuration / 60).toFixed(1) : 0}h</p></div>
                </div>
              </div>
              <TrainingGapCheck workOrderId={viewingOrder.id} />
              {viewingOrder.equipmentId && <LifecycleSuggestionBanner workOrderId={viewingOrder.id} equipmentId={viewingOrder.equipmentId} />}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={() => setViewingOrder(null)}>Fermer</Button>
              <Link href={`/maintenance-execution/${viewingOrder.id}`}>
                <Button variant="outline"><ClipboardList className="h-4 w-4 mr-2" />Suivre l'intervention</Button>
              </Link>
              <Button onClick={() => { openEditForm(viewingOrder); setViewingOrder(null); }} className="bg-ink text-white">
                <Edit className="h-4 w-4 mr-2" />Éditer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AppShell>
  );
}
