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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, Plus, Loader2, AlertTriangle, CheckCircle2, Clock, TrendingDown,
  ChevronRight, Eye, Trash2, Target, FileText, Users, DollarSign,
  GitBranch, Fish, List, ArrowRight, Save, XCircle
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface WhyStep { why: string; answer: string; }
interface Fishbone {
  manpower: string[]; machine: string[]; material: string[];
  method: string[]; environment: string[]; measurement: string[];
}
interface ActionPlan {
  id?: string; action: string; responsible?: string;
  dueDate?: string; status: "pending" | "in_progress" | "done"; priority: "low" | "medium" | "high";
}
interface RCA {
  id: number; rcaNumber: string; title: string; description?: string;
  status: string; methodology: string; severity: string;
  failureDate?: string; failureMode?: string; immediateCause?: string; rootCause?: string;
  contributingFactors: string[]; whyChain: WhyStep[]; fishbone: Fishbone;
  actionPlans: ActionPlan[]; lessonsLearned?: string; preventiveMeasures?: string;
  recurrenceRisk?: string; estimatedLoss?: number; currency?: string;
  createdAt?: string; equipmentName?: string; equipmentLocation?: string;
}
interface Stats {
  total: number; open: number; in_progress: number; closed: number;
  critical: number; high: number; highRecurrence: number; totalLoss: number;
  byMethodology: Record<string, number>;
}

// ─── Config ──────────────────────────────────────────────────────────────────
const METHODOLOGIES = [
  { value: "5_whys", label: "5 Pourquoi", icon: List, color: "from-blue-500 to-indigo-600", badge: "bg-blue-100 text-blue-700" },
  { value: "fishbone", label: "Ishikawa", icon: Fish, color: "from-orange-500 to-amber-600", badge: "bg-orange-100 text-orange-700" },
  { value: "fmea", label: "FMEA/AMDEC", icon: GitBranch, color: "from-purple-500 to-violet-600", badge: "bg-purple-100 text-purple-700" },
  { value: "fault_tree", label: "Arbre de défaillance", icon: Target, color: "from-rose-500 to-pink-600", badge: "bg-rose-100 text-rose-700" },
];
const SEVERITIES = [
  { value: "low", label: "Faible", color: "bg-green-100 text-green-700" },
  { value: "medium", label: "Moyen", color: "bg-yellow-100 text-yellow-700" },
  { value: "high", label: "Élevé", color: "bg-orange-100 text-orange-700" },
  { value: "critical", label: "Critique", color: "bg-red-100 text-red-700" },
];
const STATUSES = [
  { value: "open", label: "Ouvert", icon: AlertTriangle, color: "bg-yellow-100 text-yellow-700" },
  { value: "in_progress", label: "En cours", icon: Clock, color: "bg-blue-100 text-blue-700" },
  { value: "closed", label: "Clôturé", icon: CheckCircle2, color: "bg-green-100 text-green-700" },
  { value: "verified", label: "Vérifié", icon: CheckCircle2, color: "bg-slate-100 text-slate-700" },
];
const FISHBONE_CATEGORIES = [
  { key: "manpower", label: "Main-d'œuvre", emoji: "👷" },
  { key: "machine", label: "Machine", emoji: "⚙️" },
  { key: "material", label: "Matière", emoji: "📦" },
  { key: "method", label: "Méthode", emoji: "📋" },
  { key: "environment", label: "Milieu", emoji: "🌿" },
  { key: "measurement", label: "Mesure", emoji: "📏" },
];

const getMethodology = (v: string) => METHODOLOGIES.find(m => m.value === v) || METHODOLOGIES[0];
const getSeverity = (v: string) => SEVERITIES.find(s => s.value === v) || SEVERITIES[1];
const getStatus = (v: string) => STATUSES.find(s => s.value === v) || STATUSES[0];

// ─── Form Schema ──────────────────────────────────────────────────────────────
const CreateSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  methodology: z.enum(["5_whys", "fishbone", "fmea", "fault_tree"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  failureDate: z.string().optional(),
  failureMode: z.string().optional(),
  estimatedLoss: z.string().optional(),
});
type CreateForm = z.infer<typeof CreateSchema>;

// ─── Component ───────────────────────────────────────────────────────────────
export default function RcaPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<RCA | null>(null);
  const [activeTab, setActiveTab] = useState("whys");

  const { data: rcas = [], isLoading } = useQuery<RCA[]>({ queryKey: ["/api/rca"] });
  const { data: stats } = useQuery<Stats>({ queryKey: ["/api/rca/stats"] });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["/api/rca"] }); qc.invalidateQueries({ queryKey: ["/api/rca/stats"] }); };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/rca", data),
    onSuccess: () => { invalidate(); setShowCreate(false); form.reset(); toast({ title: "RCA créé avec succès" }); },
    onError: () => toast({ title: "Erreur", description: "Création impossible", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/rca/${id}`, data),
    onSuccess: (_, vars) => {
      invalidate();
      apiRequest("GET", `/api/rca/${vars.id}`).then((r: any) => r.json().then((d: any) => setSelected(d)));
      toast({ title: "RCA mis à jour" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/rca/${id}`),
    onSuccess: () => { invalidate(); setSelected(null); toast({ title: "RCA supprimé" }); },
  });

  const form = useForm<CreateForm>({
    resolver: zodResolver(CreateSchema),
    defaultValues: { methodology: "5_whys", severity: "medium" },
  });

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate({
      ...data,
      failureDate: data.failureDate ? new Date(data.failureDate).toISOString() : undefined,
      estimatedLoss: data.estimatedLoss ? parseFloat(data.estimatedLoss) : undefined,
    });
  };

  const openDetail = async (rca: RCA) => {
    try {
      const res = await apiRequest("GET", `/api/rca/${rca.id}`);
      const d = await (res as any).json();
      setSelected(d);
      setActiveTab(d.methodology === "fishbone" ? "fishbone" : "whys");
    } catch { setSelected(rca); }
  };

  const saveWhyChain = (chain: WhyStep[]) => {
    if (!selected) return;
    updateMutation.mutate({ id: selected.id, data: { whyChain: chain } });
  };

  const saveFishbone = (fb: Fishbone) => {
    if (!selected) return;
    updateMutation.mutate({ id: selected.id, data: { fishbone: fb } });
  };

  const saveActionPlan = (plans: ActionPlan[]) => {
    if (!selected) return;
    updateMutation.mutate({ id: selected.id, data: { actionPlans: plans } });
  };

  const filtered = rcas.filter(r => {
    const s = search.toLowerCase();
    const matchSearch = !s || r.title.toLowerCase().includes(s) || r.rcaNumber.toLowerCase().includes(s);
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    const matchSev = filterSeverity === "all" || r.severity === filterSeverity;
    return matchSearch && matchStatus && matchSev;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-indigo-50/10 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg">
              <Fish className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Analyse des Causes Racines
            </h1>
          </div>
          <p className="text-slate-500 ml-14 text-sm">Root Cause Analysis — 5 Pourquoi · Ishikawa · FMEA</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg gap-2">
          <Plus className="h-4 w-4" /> Nouvelle RCA
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total", value: stats?.total ?? 0, icon: FileText, color: "from-slate-500 to-slate-600" },
          { label: "Ouvertes", value: stats?.open ?? 0, icon: AlertTriangle, color: "from-yellow-500 to-amber-600" },
          { label: "Critiques", value: stats?.critical ?? 0, icon: XCircle, color: "from-red-500 to-rose-600" },
          { label: "Perte estimée", value: stats?.totalLoss ? `${Number(stats.totalLoss).toLocaleString("fr-FR")} €` : "—", icon: DollarSign, color: "from-blue-500 to-indigo-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-md overflow-hidden">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow`}><Icon className="h-5 w-5 text-white" /></div>
              <div><p className="text-2xl font-bold text-slate-800">{value}</p><p className="text-xs text-slate-500">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Methodology cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {METHODOLOGIES.map(({ value, label, icon: Icon, color }) => (
          <div key={value} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gradient-to-br ${color}`}><Icon className="h-4 w-4 text-white" /></div>
            <div>
              <p className="text-lg font-bold text-slate-800">{stats?.byMethodology?.[value] ?? 0}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Rechercher une RCA..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-40 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes sévérités</SelectItem>
            {SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* RCA List */}
      {isLoading ? (
        <div className="flex justify-center h-48 items-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Fish className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-1">Aucune analyse RCA</h3>
          <p className="text-slate-400 text-sm mb-6">Créez une première analyse de causes racines</p>
          <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white gap-2">
            <Plus className="h-4 w-4" /> Nouvelle RCA
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(rca => {
            const methodConf = getMethodology(rca.methodology);
            const sevConf = getSeverity(rca.severity);
            const statusConf = getStatus(rca.status);
            const MethodIcon = methodConf.icon;
            const StatusIcon = statusConf.icon;
            const completedActions = (rca.actionPlans || []).filter(a => a.status === "done").length;
            const totalActions = (rca.actionPlans || []).length;

            return (
              <Card key={rca.id} className="border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${methodConf.color} shadow-sm`}>
                        <MethodIcon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono text-slate-500">{rca.rcaNumber}</span>
                          <Badge className={statusConf.color + " text-xs"}><StatusIcon className="h-3 w-3 mr-1" />{statusConf.label}</Badge>
                          <Badge className={methodConf.badge + " text-xs"}>{methodConf.label}</Badge>
                          <Badge className={sevConf.color + " text-xs"}>{sevConf.label}</Badge>
                        </div>
                        <h3 className="font-semibold text-slate-800 truncate">{rca.title}</h3>
                        <div className="flex items-center gap-4 mt-2 flex-wrap text-xs text-slate-500">
                          {rca.equipmentName && <span>📍 {rca.equipmentName}</span>}
                          {rca.failureDate && <span>📅 {new Date(rca.failureDate).toLocaleDateString("fr-FR")}</span>}
                          {rca.estimatedLoss && <span className="text-red-600 font-medium">💸 {Number(rca.estimatedLoss).toLocaleString("fr-FR")} {rca.currency}</span>}
                          {totalActions > 0 && (
                            <span className={completedActions === totalActions ? "text-green-600" : ""}>
                              ✅ {completedActions}/{totalActions} actions
                            </span>
                          )}
                        </div>
                        {rca.rootCause && (
                          <p className="mt-2 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded border-l-2 border-purple-300 truncate">
                            <span className="font-medium text-purple-700">Cause racine:</span> {rca.rootCause}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(rca)}>
                        <Eye className="h-4 w-4 mr-1" /> Analyser
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── CREATE DIALOG ─────────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fish className="h-5 w-5 text-purple-600" /> Nouvelle analyse RCA
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <FormField control={form.control} name="methodology" render={({ field }) => (
                <FormItem>
                  <FormLabel>Méthodologie</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {METHODOLOGIES.map(({ value, label, icon: Icon, color }) => (
                      <button type="button" key={value}
                        onClick={() => field.onChange(value)}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                          field.value === value
                            ? `border-purple-400 bg-purple-50 shadow`
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${color}`}><Icon className="h-3.5 w-3.5 text-white" /></div>
                        <span className="text-xs font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Titre *</FormLabel>
                    <FormControl><Input placeholder="Ex: Arrêt compresseur ligne 3" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="severity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sévérité</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="failureDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de défaillance</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="estimatedLoss" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perte estimée (€)</FormLabel>
                    <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="failureMode" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Mode de défaillance</FormLabel>
                    <FormControl><Input placeholder="Ex: Surchauffe moteur" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="Contexte de la défaillance..." rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
                <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Créer
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── DETAIL / ANALYSIS DIALOG ──────────────────────────────────────── */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200">
                <div className={`p-2.5 bg-gradient-to-br ${getMethodology(selected.methodology).color} rounded-xl shadow-sm`}>
                  {(() => { const I = getMethodology(selected.methodology).icon; return <I className="h-5 w-5 text-white" />; })()}
                </div>
                <div className="flex-1">
                  <DialogTitle>{selected.title}</DialogTitle>
                  <p className="text-xs text-slate-500 font-mono">{selected.rcaNumber}</p>
                </div>
                <div className="flex gap-2">
                  <Badge className={getStatus(selected.status).color}>{getStatus(selected.status).label}</Badge>
                  <Badge className={getSeverity(selected.severity).color}>{getSeverity(selected.severity).label}</Badge>
                </div>
              </div>
            </DialogHeader>

            {/* Status update */}
            <div className="flex gap-2 flex-wrap">
              {STATUSES.map(s => (
                <Button key={s.value} variant={selected.status === s.value ? "default" : "outline"} size="sm"
                  className={selected.status === s.value ? "bg-purple-600" : ""}
                  onClick={() => updateMutation.mutate({ id: selected.id, data: { status: s.value } })}
                >{s.label}</Button>
              ))}
              <div className="ml-auto">
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700"
                  onClick={() => { if (confirm("Supprimer cette RCA ?")) deleteMutation.mutate(selected.id); }}>
                  <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="whys" className="flex-1">5 Pourquoi</TabsTrigger>
                <TabsTrigger value="fishbone" className="flex-1">Ishikawa</TabsTrigger>
                <TabsTrigger value="actions" className="flex-1">Actions ({(selected.actionPlans || []).length})</TabsTrigger>
                <TabsTrigger value="synthesis" className="flex-1">Synthèse</TabsTrigger>
              </TabsList>

              {/* ── 5 Whys ── */}
              <TabsContent value="whys" className="space-y-4 mt-4">
                <div className="text-sm text-slate-500 mb-2">Renseignez chaque étape jusqu'à la cause racine</div>
                <WhyChainEditor chain={selected.whyChain || []} onSave={saveWhyChain} isSaving={updateMutation.isPending} />
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Cause immédiate</label>
                    <Textarea className="mt-1" rows={2} defaultValue={selected.immediateCause || ""}
                      onBlur={e => updateMutation.mutate({ id: selected.id, data: { immediateCause: e.target.value } })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                      <Target className="h-4 w-4 text-purple-600" /> Cause racine identifiée
                    </label>
                    <Textarea className="mt-1 border-purple-200" rows={2} defaultValue={selected.rootCause || ""}
                      onBlur={e => updateMutation.mutate({ id: selected.id, data: { rootCause: e.target.value } })} />
                  </div>
                </div>
              </TabsContent>

              {/* ── Fishbone / Ishikawa ── */}
              <TabsContent value="fishbone" className="mt-4">
                <FishboneEditor fishbone={selected.fishbone || defaultFishbone()} onSave={saveFishbone} isSaving={updateMutation.isPending} />
              </TabsContent>

              {/* ── Action Plans ── */}
              <TabsContent value="actions" className="mt-4">
                <ActionPlanEditor plans={selected.actionPlans || []} onSave={saveActionPlan} isSaving={updateMutation.isPending} />
              </TabsContent>

              {/* ── Synthesis ── */}
              <TabsContent value="synthesis" className="space-y-4 mt-4">
                {selected.rootCause && (
                  <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                    <h4 className="font-semibold text-purple-800 mb-1 flex items-center gap-2"><Target className="h-4 w-4" />Cause racine</h4>
                    <p className="text-slate-700">{selected.rootCause}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Enseignements tirés</label>
                    <Textarea className="mt-1" rows={3} defaultValue={selected.lessonsLearned || ""}
                      onBlur={e => updateMutation.mutate({ id: selected.id, data: { lessonsLearned: e.target.value } })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Mesures préventives</label>
                    <Textarea className="mt-1" rows={3} defaultValue={selected.preventiveMeasures || ""}
                      onBlur={e => updateMutation.mutate({ id: selected.id, data: { preventiveMeasures: e.target.value } })} />
                  </div>
                </div>
                <div className="flex gap-4 flex-wrap">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Risque de récurrence</label>
                    <Select value={selected.recurrenceRisk || "medium"}
                      onValueChange={v => updateMutation.mutate({ id: selected.id, data: { recurrenceRisk: v } })}>
                      <SelectTrigger className="w-40 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Faible</SelectItem>
                        <SelectItem value="medium">Moyen</SelectItem>
                        <SelectItem value="high">Élevé</SelectItem>
                        <SelectItem value="critical">Critique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {selected.estimatedLoss && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-xs text-red-600 font-medium">Perte estimée</p>
                      <p className="text-xl font-bold text-red-700">{Number(selected.estimatedLoss).toLocaleString("fr-FR")} {selected.currency}</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelected(null)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WhyChainEditor({ chain, onSave, isSaving }: { chain: WhyStep[]; onSave: (c: WhyStep[]) => void; isSaving: boolean }) {
  const [local, setLocal] = useState<WhyStep[]>(chain.length ? chain : [1,2,3,4,5].map(i => ({ why: `Pourquoi ${i} ?`, answer: "" })));
  const update = (i: number, field: "why" | "answer", val: string) => setLocal(prev => prev.map((s, j) => j === i ? { ...s, [field]: val } : s));

  return (
    <div className="space-y-3">
      {local.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow">{i + 1}</div>
            {i < local.length - 1 && <div className="w-0.5 h-full bg-purple-200 mt-1 min-h-8" />}
          </div>
          <div className="flex-1 space-y-2">
            <Input value={step.why} onChange={e => update(i, "why", e.target.value)} className="text-sm font-medium" placeholder={`Pourquoi ${i + 1} ?`} />
            <Textarea value={step.answer} onChange={e => update(i, "answer", e.target.value)} rows={2}
              className={`text-sm transition-colors ${step.answer ? "border-purple-200 bg-purple-50/30" : ""}`}
              placeholder="Réponse / explication..." />
          </div>
          {i < local.length - 1 && <ArrowRight className="h-5 w-5 text-slate-400 mt-3 shrink-0" />}
        </div>
      ))}
      <Button size="sm" onClick={() => onSave(local)} disabled={isSaving} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Enregistrer la chaîne
      </Button>
    </div>
  );
}

function FishboneEditor({ fishbone, onSave, isSaving }: { fishbone: Fishbone; onSave: (f: Fishbone) => void; isSaving: boolean }) {
  const [local, setLocal] = useState<Fishbone>(fishbone || defaultFishbone());
  const addItem = (cat: keyof Fishbone, val: string) => {
    if (!val.trim()) return;
    setLocal(prev => ({ ...prev, [cat]: [...(prev[cat] || []), val.trim()] }));
  };
  const removeItem = (cat: keyof Fishbone, i: number) => {
    setLocal(prev => ({ ...prev, [cat]: prev[cat].filter((_, j) => j !== i) }));
  };

  return (
    <div className="space-y-4">
      <div className="text-center py-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg">
        <p className="text-sm font-semibold text-orange-800">Diagramme d'Ishikawa — Causes par catégorie (6M)</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {FISHBONE_CATEGORIES.map(({ key, label, emoji }) => (
          <div key={key} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <h4 className="font-semibold text-slate-700 mb-3">{emoji} {label}</h4>
            <div className="space-y-1.5 mb-3 min-h-8">
              {(local[key as keyof Fishbone] || []).map((item, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <span className="text-xs bg-orange-50 border border-orange-200 rounded px-2 py-0.5 flex-1">{item}</span>
                  <button onClick={() => removeItem(key as keyof Fishbone, i)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600">
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <AddItemInput onAdd={val => addItem(key as keyof Fishbone, val)} />
          </div>
        ))}
      </div>
      <Button size="sm" onClick={() => onSave(local)} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Enregistrer Ishikawa
      </Button>
    </div>
  );
}

function AddItemInput({ onAdd }: { onAdd: (v: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex gap-1">
      <Input value={val} onChange={e => setVal(e.target.value)} placeholder="Ajouter..." className="text-xs h-7 px-2"
        onKeyDown={e => { if (e.key === "Enter") { onAdd(val); setVal(""); } }} />
      <Button size="sm" className="h-7 px-2" variant="outline" onClick={() => { onAdd(val); setVal(""); }}>+</Button>
    </div>
  );
}

function ActionPlanEditor({ plans, onSave, isSaving }: { plans: ActionPlan[]; onSave: (p: ActionPlan[]) => void; isSaving: boolean }) {
  const [local, setLocal] = useState<ActionPlan[]>(plans);
  const [newAction, setNewAction] = useState("");

  const add = () => {
    if (!newAction.trim()) return;
    setLocal(prev => [...prev, { id: Date.now().toString(), action: newAction.trim(), status: "pending", priority: "medium" }]);
    setNewAction("");
  };
  const update = (i: number, field: keyof ActionPlan, val: any) => setLocal(prev => prev.map((p, j) => j === i ? { ...p, [field]: val } : p));
  const remove = (i: number) => setLocal(prev => prev.filter((_, j) => j !== i));

  const pBadge = { low: "bg-green-100 text-green-700", medium: "bg-yellow-100 text-yellow-700", high: "bg-red-100 text-red-700" };
  const sBadge = { pending: "bg-gray-100 text-gray-600", in_progress: "bg-blue-100 text-blue-700", done: "bg-green-100 text-green-700" };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {local.map((plan, i) => (
          <div key={plan.id || i} className={`p-4 rounded-xl border-2 transition-all ${plan.status === "done" ? "border-green-200 bg-green-50/30" : "border-slate-200 bg-white"}`}>
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-2">
                <Input value={plan.action} onChange={e => update(i, "action", e.target.value)} className="font-medium" />
                <div className="flex gap-2 flex-wrap">
                  <Input placeholder="Responsable" value={plan.responsible || ""} onChange={e => update(i, "responsible", e.target.value)} className="w-36 text-sm h-8" />
                  <Input type="date" value={plan.dueDate || ""} onChange={e => update(i, "dueDate", e.target.value)} className="w-36 text-sm h-8" />
                  <Select value={plan.priority} onValueChange={v => update(i, "priority", v)}>
                    <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Faible</SelectItem>
                      <SelectItem value="medium">Moyen</SelectItem>
                      <SelectItem value="high">Élevé</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={plan.status} onValueChange={v => update(i, "status", v)}>
                    <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="in_progress">En cours</SelectItem>
                      <SelectItem value="done">Terminé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 mt-1"><XCircle className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input value={newAction} onChange={e => setNewAction(e.target.value)} placeholder="Nouvelle action corrective..."
          onKeyDown={e => { if (e.key === "Enter") add(); }} />
        <Button onClick={add} variant="outline"><Plus className="h-4 w-4" /></Button>
      </div>

      <Button size="sm" onClick={() => onSave(local)} disabled={isSaving} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Enregistrer les actions
      </Button>
    </div>
  );
}

function defaultFishbone(): Fishbone {
  return { manpower: [], machine: [], material: [], method: [], environment: [], measurement: [] };
}
