import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Flame, Droplets, Zap, MountainSnow, Wind, FlaskConical,
  Plus, Search, Filter, CheckCircle2, XCircle, Clock, PlayCircle,
  ShieldCheck, AlertTriangle, FileText, Eye, ChevronRight, Loader2,
  ClipboardList, Users, MapPin, Calendar, Lock
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Permit {
  id: number;
  permitNumber: string;
  type: string;
  status: string;
  riskLevel: string;
  title: string;
  description?: string;
  location?: string;
  equipmentId?: number;
  workOrderId?: number;
  requestedById?: number;
  requestedByName?: string;
  approvedByName?: string;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  hazards?: string[];
  precautions?: string[];
  safetyEquipment?: string[];
  isolationPoints?: any[];
  authorizedPersonnel?: any[];
  checklistItems?: { label: string; checked: boolean }[];
  permitConditions?: string;
  rejectionReason?: string;
  completionNotes?: string;
  createdAt?: string;
  equipment?: { name: string; location?: string };
  workOrder?: { orderNumber: string; title: string };
}

interface Stats {
  total: number;
  active: number;
  pending: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byRisk: Record<string, number>;
}

// ─── Config ─────────────────────────────────────────────────────────────────

const PERMIT_TYPES = [
  { value: "hot_work", label: "Travaux à chaud", icon: Flame, color: "text-orange-600", bg: "bg-orange-50 border-orange-200", badge: "bg-orange-100 text-orange-700" },
  { value: "confined_space", label: "Espace confiné", icon: Wind, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", badge: "bg-yellow-100 text-yellow-700" },
  { value: "electrical_loto", label: "Consignation LOTO", icon: Zap, color: "text-blue-600", bg: "bg-blue-50 border-blue-200", badge: "bg-blue-100 text-blue-700" },
  { value: "height_work", label: "Travaux en hauteur", icon: MountainSnow, color: "text-purple-600", bg: "bg-purple-50 border-purple-200", badge: "bg-purple-100 text-purple-700" },
  { value: "cold_work", label: "Travaux à froid", icon: Droplets, color: "text-cyan-600", bg: "bg-cyan-50 border-cyan-200", badge: "bg-cyan-100 text-cyan-700" },
  { value: "chemical", label: "Risque chimique", icon: FlaskConical, color: "text-green-600", bg: "bg-green-50 border-green-200", badge: "bg-green-100 text-green-700" },
];

const STATUSES = [
  { value: "draft", label: "Brouillon", icon: FileText, color: "bg-gray-100 text-gray-700" },
  { value: "submitted", label: "En attente", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  { value: "approved", label: "Approuvé", icon: CheckCircle2, color: "bg-blue-100 text-blue-700" },
  { value: "active", label: "Actif", icon: PlayCircle, color: "bg-green-100 text-green-700" },
  { value: "completed", label: "Clôturé", icon: CheckCircle2, color: "bg-slate-100 text-slate-600" },
  { value: "rejected", label: "Rejeté", icon: XCircle, color: "bg-red-100 text-red-700" },
  { value: "cancelled", label: "Annulé", icon: XCircle, color: "bg-gray-100 text-gray-500" },
];

const RISK_LEVELS = [
  { value: "low", label: "Faible", color: "bg-green-100 text-green-700" },
  { value: "medium", label: "Moyen", color: "bg-yellow-100 text-yellow-700" },
  { value: "high", label: "Élevé", color: "bg-orange-100 text-orange-700" },
  { value: "critical", label: "Critique", color: "bg-red-100 text-red-700" },
];

const getTypeConfig = (type: string) => PERMIT_TYPES.find(t => t.value === type) || PERMIT_TYPES[0];
const getStatusConfig = (status: string) => STATUSES.find(s => s.value === status) || STATUSES[0];
const getRiskConfig = (risk: string) => RISK_LEVELS.find(r => r.value === risk) || RISK_LEVELS[1];

// ─── Create Form Schema ──────────────────────────────────────────────────────

const createSchema = z.object({
  type: z.string().min(1, "Type requis"),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  title: z.string().min(3, "Titre requis (min 3 caractères)"),
  description: z.string().optional(),
  location: z.string().optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  hazards: z.string().optional(),
  precautions: z.string().optional(),
  authorizedPersonnel: z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

// ─── Component ──────────────────────────────────────────────────────────────

export default function PermitToWork() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPermit, setSelectedPermit] = useState<Permit | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [actionDialog, setActionDialog] = useState<{ type: string; permitId: number } | null>(null);
  const [actionNote, setActionNote] = useState("");

  // ── Queries ──
  const { data: permits = [], isLoading } = useQuery<Permit[]>({
    queryKey: ["/api/permits"],
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/permits/stats"],
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/permits", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/permits/stats"] });
      setShowCreate(false);
      form.reset();
      toast({ title: "Permis créé", description: "Le brouillon a été créé avec succès." });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de créer le permis.", variant: "destructive" }),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action, body }: { id: number; action: string; body?: any }) =>
      apiRequest("POST", `/api/permits/${id}/${action}`, body || {}),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/permits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/permits/stats"] });
      setActionDialog(null);
      setActionNote("");
      const labels: Record<string, string> = { submit: "soumis", approve: "approuvé", activate: "activé", complete: "clôturé", reject: "rejeté", cancel: "annulé" };
      toast({ title: "Mis à jour", description: `Permis ${labels[vars.action] || "mis à jour"}.` });
      // Refresh detail if open
      if (selectedPermit?.id === vars.id) {
        apiRequest("GET", `/api/permits/${vars.id}`).then((p: any) => p.json().then((d: any) => setSelectedPermit(d)));
      }
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message || "Action impossible.", variant: "destructive" }),
  });

  const checklistMutation = useMutation({
    mutationFn: ({ id, checklistItems }: { id: number; checklistItems: any[] }) =>
      apiRequest("PATCH", `/api/permits/${id}/checklist`, { checklistItems }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/permits"] });
      if (selectedPermit?.id === vars.id) {
        setSelectedPermit(prev => prev ? { ...prev, checklistItems: vars.checklistItems } : null);
      }
    },
  });

  // ── Form ──
  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { type: "", riskLevel: "medium", title: "", description: "", location: "" },
  });

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate({
      ...data,
      plannedStart: data.plannedStart ? new Date(data.plannedStart).toISOString() : undefined,
      plannedEnd: data.plannedEnd ? new Date(data.plannedEnd).toISOString() : undefined,
      hazards: data.hazards ? data.hazards.split("\n").filter(Boolean) : [],
      precautions: data.precautions ? data.precautions.split("\n").filter(Boolean) : [],
      authorizedPersonnel: data.authorizedPersonnel
        ? data.authorizedPersonnel.split("\n").filter(Boolean).map((name: string) => ({ name, role: "" }))
        : [],
    });
  };

  // ── Filtering ──
  const filtered = permits.filter(p => {
    const matchSearch = !searchTerm ||
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.permitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.location || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    const matchType = filterType === "all" || p.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  // ── Actions available per status ──
  const getActions = (permit: Permit) => {
    switch (permit.status) {
      case "draft": return [{ action: "submit", label: "Soumettre", color: "bg-blue-600 hover:bg-blue-700" }];
      case "submitted": return [
        { action: "approve", label: "Approuver", color: "bg-green-600 hover:bg-green-700" },
        { action: "reject", label: "Rejeter", color: "bg-red-600 hover:bg-red-700" },
      ];
      case "approved": return [
        { action: "activate", label: "Démarrer les travaux", color: "bg-green-600 hover:bg-green-700" },
        { action: "reject", label: "Rejeter", color: "bg-red-600 hover:bg-red-700" },
      ];
      case "active": return [{ action: "complete", label: "Clôturer", color: "bg-slate-700 hover:bg-slate-800" }];
      default: return [];
    }
  };

  const handleChecklist = (permit: Permit, idx: number, checked: boolean) => {
    const items = (permit.checklistItems || []).map((item, i) => i === idx ? { ...item, checked } : item);
    checklistMutation.mutate({ id: permit.id, checklistItems: items });
    if (selectedPermit?.id === permit.id) {
      setSelectedPermit(prev => prev ? { ...prev, checklistItems: items } : null);
    }
  };

  const openDetail = async (permit: Permit) => {
    try {
      const res = await apiRequest("GET", `/api/permits/${permit.id}`);
      const detail = await (res as any).json();
      setSelectedPermit(detail);
    } catch {
      setSelectedPermit(permit);
    }
    setShowDetail(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg">
              <Lock className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Permis de Travail
            </h1>
          </div>
          <p className="text-slate-500 ml-14 text-sm">Permit-to-Work — Contrôle des travaux à risque</p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-lg gap-2"
        >
          <Plus className="h-4 w-4" /> Nouveau permis
        </Button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total", value: stats?.total ?? 0, icon: FileText, color: "from-slate-500 to-slate-600" },
          { label: "Actifs", value: stats?.active ?? 0, icon: PlayCircle, color: "from-green-500 to-emerald-600" },
          { label: "En attente", value: stats?.pending ?? 0, icon: Clock, color: "from-yellow-500 to-amber-600" },
          { label: "Critiques", value: stats?.byRisk?.critical ?? 0, icon: AlertTriangle, color: "from-red-500 to-rose-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-md overflow-hidden">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Type breakdown ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
        {PERMIT_TYPES.map(({ value, label, icon: Icon, color, bg }) => (
          <button
            key={value}
            onClick={() => setFilterType(filterType === value ? "all" : value)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all cursor-pointer ${
              filterType === value ? bg + " shadow-md scale-105" : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <Icon className={`h-5 w-5 ${filterType === value ? color : "text-slate-400"}`} />
            <span className="text-xs font-medium text-slate-600 text-center leading-tight">{label}</span>
            <span className={`text-xs font-bold ${filterType === value ? color : "text-slate-400"}`}>
              {stats?.byType?.[value] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* ── Filters bar ── */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Rechercher un permis..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 bg-white">
            <Filter className="h-4 w-4 mr-2 text-slate-400" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* ── Permits list ── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Lock className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-1">Aucun permis</h3>
          <p className="text-slate-400 text-sm mb-6">Créez votre premier permis de travail pour commencer</p>
          <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-red-500 to-orange-500 text-white gap-2">
            <Plus className="h-4 w-4" /> Nouveau permis
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(permit => {
            const typeConf = getTypeConfig(permit.type);
            const statusConf = getStatusConfig(permit.status);
            const riskConf = getRiskConfig(permit.riskLevel);
            const TypeIcon = typeConf.icon;
            const actions = getActions(permit);

            return (
              <Card key={permit.id} className={`border-2 shadow-sm hover:shadow-md transition-all ${typeConf.bg}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-2.5 rounded-xl bg-white shadow-sm`}>
                        <TypeIcon className={`h-5 w-5 ${typeConf.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono text-slate-500">{permit.permitNumber}</span>
                          <Badge className={statusConf.color + " text-xs"}>{statusConf.label}</Badge>
                          <Badge className={typeConf.badge + " text-xs"}>{typeConf.label}</Badge>
                          <Badge className={riskConf.color + " text-xs"}>Risque {riskConf.label}</Badge>
                        </div>
                        <h3 className="font-semibold text-slate-800 truncate">{permit.title}</h3>
                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                          {permit.location && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{permit.location}
                            </span>
                          )}
                          {permit.requestedByName && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Users className="h-3 w-3" />{permit.requestedByName}
                            </span>
                          )}
                          {permit.plannedStart && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(permit.plannedStart).toLocaleDateString("fr-FR")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {actions.map(a => (
                        <Button
                          key={a.action}
                          size="sm"
                          className={`text-white text-xs ${a.color}`}
                          onClick={() => setActionDialog({ type: a.action, permitId: permit.id })}
                        >
                          {a.label}
                        </Button>
                      ))}
                      <Button variant="ghost" size="sm" onClick={() => openDetail(permit)}>
                        <Eye className="h-4 w-4 mr-1" /> Détail
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          CREATE PERMIT DIALOG
      ══════════════════════════════════════════════ */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-red-500" />
              Nouveau permis de travail
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-2">
              {/* Type */}
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de permis *</FormLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PERMIT_TYPES.map(({ value, label, icon: Icon, color, bg }) => (
                      <button type="button" key={value}
                        onClick={() => field.onChange(value)}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                          field.value === value ? bg + " shadow" : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${field.value === value ? color : "text-slate-400"}`} />
                        <span className="text-xs font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                {/* Title */}
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Titre *</FormLabel>
                    <FormControl><Input placeholder="Ex: Soudure sur canalisation vapeur Hall 3" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Risk level */}
                <FormField control={form.control} name="riskLevel" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Niveau de risque</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RISK_LEVELS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Location */}
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localisation</FormLabel>
                    <FormControl><Input placeholder="Ex: Atelier B, zone 4" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Planned start */}
                <FormField control={form.control} name="plannedStart" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Début prévu</FormLabel>
                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Planned end */}
                <FormField control={form.control} name="plannedEnd" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fin prévue</FormLabel>
                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Description */}
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description des travaux</FormLabel>
                  <FormControl><Textarea placeholder="Description détaillée des opérations à réaliser..." rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Hazards */}
              <FormField control={form.control} name="hazards" render={({ field }) => (
                <FormItem>
                  <FormLabel>Dangers identifiés <span className="text-slate-400 text-xs">(un par ligne)</span></FormLabel>
                  <FormControl>
                    <Textarea placeholder={"Risque d'incendie\nFumées toxiques\nProjections métalliques"} rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Authorized personnel */}
              <FormField control={form.control} name="authorizedPersonnel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Personnel autorisé <span className="text-slate-400 text-xs">(un par ligne)</span></FormLabel>
                  <FormControl>
                    <Textarea placeholder={"Jean Dupont — Soudeur\nMarie Martin — Chef d'équipe"} rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-gradient-to-r from-red-500 to-orange-500 text-white"
                >
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Créer le permis
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════
          PERMIT DETAIL DIALOG
      ══════════════════════════════════════════════ */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedPermit && (() => {
            const typeConf = getTypeConfig(selectedPermit.type);
            const statusConf = getStatusConfig(selectedPermit.status);
            const riskConf = getRiskConfig(selectedPermit.riskLevel);
            const TypeIcon = typeConf.icon;
            const StatusIcon = statusConf.icon;
            const actions = getActions(selectedPermit);

            return (
              <>
                <DialogHeader>
                  <div className={`flex items-center gap-3 p-4 rounded-xl ${typeConf.bg} mb-2`}>
                    <div className="p-2.5 bg-white rounded-xl shadow-sm">
                      <TypeIcon className={`h-6 w-6 ${typeConf.color}`} />
                    </div>
                    <div className="flex-1">
                      <DialogTitle className="text-lg">{selectedPermit.title}</DialogTitle>
                      <p className="text-xs text-slate-500 font-mono">{selectedPermit.permitNumber}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge className={statusConf.color}><StatusIcon className="h-3 w-3 mr-1" />{statusConf.label}</Badge>
                      <Badge className={riskConf.color}>Risque {riskConf.label}</Badge>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {selectedPermit.location && (
                      <div><span className="text-slate-500">Lieu</span><p className="font-medium">{selectedPermit.location}</p></div>
                    )}
                    {selectedPermit.requestedByName && (
                      <div><span className="text-slate-500">Demandeur</span><p className="font-medium">{selectedPermit.requestedByName}</p></div>
                    )}
                    {selectedPermit.approvedByName && (
                      <div><span className="text-slate-500">Approuvé par</span><p className="font-medium">{selectedPermit.approvedByName}</p></div>
                    )}
                    {selectedPermit.plannedStart && (
                      <div><span className="text-slate-500">Période prévue</span>
                        <p className="font-medium">
                          {new Date(selectedPermit.plannedStart).toLocaleString("fr-FR")}
                          {selectedPermit.plannedEnd && ` → ${new Date(selectedPermit.plannedEnd).toLocaleString("fr-FR")}`}
                        </p>
                      </div>
                    )}
                    {selectedPermit.equipment && (
                      <div><span className="text-slate-500">Équipement</span><p className="font-medium">{selectedPermit.equipment.name}</p></div>
                    )}
                    {selectedPermit.workOrder && (
                      <div><span className="text-slate-500">Ordre de travail</span><p className="font-medium">{selectedPermit.workOrder.orderNumber}</p></div>
                    )}
                  </div>

                  {/* Description */}
                  {selectedPermit.description && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-2">Description des travaux</h4>
                        <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{selectedPermit.description}</p>
                      </div>
                    </>
                  )}

                  {/* Checklist */}
                  {(selectedPermit.checklistItems || []).length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-blue-600" /> Checklist de sécurité
                          <span className="text-xs text-slate-400 font-normal">
                            ({(selectedPermit.checklistItems || []).filter(i => i.checked).length}/{(selectedPermit.checklistItems || []).length} vérifiés)
                          </span>
                        </h4>
                        <div className="space-y-2">
                          {(selectedPermit.checklistItems || []).map((item, idx) => (
                            <label key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer">
                              <Checkbox
                                checked={item.checked}
                                onCheckedChange={checked => handleChecklist(selectedPermit, idx, !!checked)}
                                disabled={!['active', 'approved'].includes(selectedPermit.status)}
                              />
                              <span className={`text-sm ${item.checked ? "line-through text-slate-400" : "text-slate-700"}`}>
                                {item.label}
                              </span>
                              {item.checked && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Hazards */}
                  {(selectedPermit.hazards || []).length > 0 && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-500" /> Dangers
                          </h4>
                          <ul className="space-y-1">
                            {(selectedPermit.hazards || []).map((h, i) => (
                              <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-orange-400 rounded-full" />{h}
                              </li>
                            ))}
                          </ul>
                        </div>
                        {(selectedPermit.safetyEquipment || []).length > 0 && (
                          <div>
                            <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-green-600" /> EPI requis
                            </h4>
                            <ul className="space-y-1">
                              {(selectedPermit.safetyEquipment || []).map((s: string, i: number) => (
                                <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />{s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Authorized personnel */}
                  {(selectedPermit.authorizedPersonnel || []).length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                          <Users className="h-4 w-4 text-indigo-600" /> Personnel autorisé
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {(selectedPermit.authorizedPersonnel || []).map((p: any, i: number) => (
                            <Badge key={i} variant="secondary" className="text-sm">
                              {typeof p === "string" ? p : `${p.name}${p.role ? ` — ${p.role}` : ""}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Rejection reason */}
                  {selectedPermit.rejectionReason && (
                    <>
                      <Separator />
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <h4 className="font-semibold text-red-700 mb-1 flex items-center gap-2">
                          <XCircle className="h-4 w-4" /> Motif de rejet
                        </h4>
                        <p className="text-sm text-red-600">{selectedPermit.rejectionReason}</p>
                      </div>
                    </>
                  )}

                  {/* Completion notes */}
                  {selectedPermit.completionNotes && (
                    <>
                      <Separator />
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <h4 className="font-semibold text-green-700 mb-1">Notes de clôture</h4>
                        <p className="text-sm text-green-700">{selectedPermit.completionNotes}</p>
                      </div>
                    </>
                  )}
                </div>

                <DialogFooter className="mt-4 gap-2">
                  <Button variant="outline" onClick={() => setShowDetail(false)}>Fermer</Button>
                  {actions.map(a => (
                    <Button
                      key={a.action}
                      className={`text-white ${a.color}`}
                      onClick={() => { setShowDetail(false); setActionDialog({ type: a.action, permitId: selectedPermit.id }); }}
                    >
                      {a.label}
                    </Button>
                  ))}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════
          ACTION CONFIRMATION DIALOG
      ══════════════════════════════════════════════ */}
      <AlertDialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setActionNote(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog?.type === "submit" && "Soumettre le permis ?"}
              {actionDialog?.type === "approve" && "Approuver le permis ?"}
              {actionDialog?.type === "activate" && "Démarrer les travaux ?"}
              {actionDialog?.type === "complete" && "Clôturer le permis ?"}
              {actionDialog?.type === "reject" && "Rejeter le permis ?"}
              {actionDialog?.type === "cancel" && "Annuler le permis ?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {actionDialog?.type === "approve" && (
                  <p className="text-sm text-slate-600 mb-3">Confirmez que toutes les conditions de sécurité ont été vérifiées.</p>
                )}
                {actionDialog?.type === "activate" && (
                  <p className="text-sm text-slate-600 mb-3">Confirmez que tous les EPI sont en place et la checklist est vérifiée.</p>
                )}
                {(["reject", "complete"].includes(actionDialog?.type || "")) && (
                  <div className="mt-3">
                    <label className="text-sm font-medium text-slate-700">
                      {actionDialog?.type === "reject" ? "Motif du rejet *" : "Notes de clôture"}
                    </label>
                    <Textarea
                      className="mt-1"
                      value={actionNote}
                      onChange={e => setActionNote(e.target.value)}
                      placeholder={actionDialog?.type === "reject" ? "Décrivez la raison du rejet..." : "Observations, travaux effectués..."}
                      rows={3}
                    />
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className={`text-white ${
                actionDialog?.type === "reject" || actionDialog?.type === "cancel" ? "bg-red-600 hover:bg-red-700" :
                actionDialog?.type === "approve" || actionDialog?.type === "activate" ? "bg-green-600 hover:bg-green-700" :
                "bg-slate-700 hover:bg-slate-800"
              }`}
              disabled={actionDialog?.type === "reject" && !actionNote.trim()}
              onClick={() => {
                if (!actionDialog) return;
                const body =
                  actionDialog.type === "reject" ? { reason: actionNote } :
                  actionDialog.type === "complete" ? { notes: actionNote } : {};
                actionMutation.mutate({ id: actionDialog.permitId, action: actionDialog.type, body });
              }}
            >
              {actionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
