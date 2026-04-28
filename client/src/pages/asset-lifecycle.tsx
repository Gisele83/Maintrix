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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Loader2, Search, Filter, Eye, Trash2, TrendingDown,
  DollarSign, Activity, Clock, Package, Wrench, CheckCircle2,
  AlertTriangle, Calendar, MapPin, Tag, BarChart3, ArrowRight
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LifecycleEvent {
  id?: string;
  date: string;
  type: string;
  description: string;
  cost?: number;
  performedBy?: string;
}
interface Asset {
  id: number;
  assetTag: string;
  name: string;
  category?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  equipmentId?: number;
  lifecycleStage: string;
  purchaseDate?: string;
  commissioningDate?: string;
  plannedReplacementDate?: string;
  usefulLifeYears?: number;
  purchaseCost?: number;
  currentValue?: number;
  salvageValue?: number;
  depreciationMethod?: string;
  totalMaintenanceCost?: number;
  totalDowntimeHours?: number;
  mtbfHours?: number;
  mttrHours?: number;
  failureCount?: number;
  maintenanceCount?: number;
  location?: string;
  criticality: string;
  conditionScore: number;
  notes?: string;
  lifecycleEvents: LifecycleEvent[];
  createdAt?: string;
}
interface AssetStats {
  total: number;
  inOperation: number;
  decommissioned: number;
  criticalCount: number;
  poorCondition: number;
  totalAssetValue: number;
  totalCurrentValue: number;
  totalMaintCost: number;
  avgCondition: number;
  avgMtbf: number;
  avgMttr: number;
  byStage: { lifecycleStage: string; count: number }[];
  byCat: { category: string; count: number }[];
}

// ─── Config ───────────────────────────────────────────────────────────────────
const STAGES = [
  { value: "procurement", label: "Approvisionnement", color: "bg-slate-100 text-slate-700", icon: Package },
  { value: "commissioning", label: "Mise en service", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  { value: "operation", label: "En exploitation", color: "bg-green-100 text-green-700", icon: Activity },
  { value: "maintenance", label: "En maintenance", color: "bg-yellow-100 text-yellow-700", icon: Wrench },
  { value: "degradation", label: "Dégradé", color: "bg-orange-100 text-orange-700", icon: TrendingDown },
  { value: "decommission", label: "Déclassé", color: "bg-red-100 text-red-700", icon: AlertTriangle },
  { value: "disposal", label: "Éliminé", color: "bg-gray-100 text-gray-500", icon: Trash2 },
];
const EVENT_TYPES = [
  { value: "purchase", label: "Achat", icon: "💳" },
  { value: "commissioning", label: "Mise en service", icon: "🚀" },
  { value: "maintenance", label: "Maintenance", icon: "🔧" },
  { value: "repair", label: "Réparation", icon: "🛠️" },
  { value: "inspection", label: "Inspection", icon: "🔍" },
  { value: "upgrade", label: "Amélioration", icon: "⬆️" },
  { value: "incident", label: "Incident", icon: "⚠️" },
  { value: "decommission", label: "Déclassement", icon: "🚫" },
  { value: "disposal", label: "Élimination", icon: "♻️" },
  { value: "other", label: "Autre", icon: "📌" },
];
const CRITICALITIES = [
  { value: "low", label: "Faible", color: "bg-green-100 text-green-700" },
  { value: "medium", label: "Moyen", color: "bg-yellow-100 text-yellow-700" },
  { value: "high", label: "Élevé", color: "bg-orange-100 text-orange-700" },
  { value: "critical", label: "Critique", color: "bg-red-100 text-red-700" },
];

const getStage = (v: string) => STAGES.find(s => s.value === v) || STAGES[2];
const getCrit = (v: string) => CRITICALITIES.find(c => c.value === v) || CRITICALITIES[1];
const fmt = (n: number | null | undefined, decimals = 0) => n != null ? Number(n).toLocaleString("fr-FR", { maximumFractionDigits: decimals }) : "—";
const fmtEur = (n: number | null | undefined) => n != null ? `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €` : "—";

function conditionColor(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

// ─── Schemas ──────────────────────────────────────────────────────────────────
const CreateSchema = z.object({
  name: z.string().min(2),
  assetTag: z.string().optional(),
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  lifecycleStage: z.string().default("operation"),
  purchaseDate: z.string().optional(),
  commissioningDate: z.string().optional(),
  plannedReplacementDate: z.string().optional(),
  usefulLifeYears: z.string().optional(),
  purchaseCost: z.string().optional(),
  salvageValue: z.string().optional(),
  depreciationMethod: z.string().default("linear"),
  location: z.string().optional(),
  criticality: z.string().default("medium"),
  notes: z.string().optional(),
});
type CreateForm = z.infer<typeof CreateSchema>;

const EventSchema = z.object({
  date: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(3),
  cost: z.string().optional(),
  performedBy: z.string().optional(),
});
type EventForm = z.infer<typeof EventSchema>;

// ─── Component ────────────────────────────────────────────────────────────────
export default function AssetLifecyclePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [filterCrit, setFilterCrit] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editStage, setEditStage] = useState<string>("");

  const { data: assets = [], isLoading } = useQuery<Asset[]>({ queryKey: ["/api/assets"] });
  const { data: stats } = useQuery<AssetStats>({ queryKey: ["/api/assets/stats"] });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["/api/assets"] }); qc.invalidateQueries({ queryKey: ["/api/assets/stats"] }); };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/assets", data),
    onSuccess: () => { invalidate(); setShowCreate(false); form.reset(); toast({ title: "Actif créé" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message || "Création impossible", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/assets/${id}`, data),
    onSuccess: async (res: any) => {
      invalidate();
      const d = await res.json();
      setSelected(d);
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const addEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("POST", `/api/assets/${id}/events`, data),
    onSuccess: async (res: any) => {
      invalidate();
      const d = await res.json();
      setSelected(d);
      setShowAddEvent(false);
      evtForm.reset();
      toast({ title: "Événement ajouté" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/assets/${id}`),
    onSuccess: () => { invalidate(); setSelected(null); toast({ title: "Actif supprimé" }); },
  });

  const form = useForm<CreateForm>({ resolver: zodResolver(CreateSchema), defaultValues: { lifecycleStage: "operation", criticality: "medium", depreciationMethod: "linear" } });
  const evtForm = useForm<EventForm>({ resolver: zodResolver(EventSchema), defaultValues: { date: new Date().toISOString().split("T")[0], type: "maintenance" } });

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate({
      ...data,
      usefulLifeYears: data.usefulLifeYears ? parseFloat(data.usefulLifeYears) : undefined,
      purchaseCost: data.purchaseCost ? parseFloat(data.purchaseCost) : undefined,
      salvageValue: data.salvageValue ? parseFloat(data.salvageValue) : undefined,
    });
  };

  const openDetail = async (asset: Asset) => {
    try {
      const res = await apiRequest("GET", `/api/assets/${asset.id}`);
      setSelected(await (res as any).json());
    } catch { setSelected(asset); }
  };

  const filtered = assets.filter(a => {
    const s = search.toLowerCase();
    return (!s || a.name.toLowerCase().includes(s) || a.assetTag.toLowerCase().includes(s) || (a.category || "").toLowerCase().includes(s)) &&
      (filterStage === "all" || a.lifecycleStage === filterStage) &&
      (filterCrit === "all" || a.criticality === filterCrit);
  });

  // Depreciation chart data
  const depreciationData = (asset: Asset) => {
    if (!asset.purchaseCost || !asset.usefulLifeYears) return [];
    const years = Math.ceil(Number(asset.usefulLifeYears));
    const salvage = Number(asset.salvageValue || 0);
    return Array.from({ length: years + 1 }, (_, i) => {
      const rate = 2 / years;
      const declining = Math.max(salvage, Number(asset.purchaseCost) * Math.pow(1 - rate, i));
      const linear = Math.max(salvage, Number(asset.purchaseCost) - (Number(asset.purchaseCost) - salvage) / years * i);
      return { year: `An ${i}`, linéaire: Math.round(linear), dégressif: Math.round(declining) };
    });
  };

  const eventIcon = (type: string) => EVENT_TYPES.find(e => e.value === type)?.icon || "📌";
  const eventLabel = (type: string) => EVENT_TYPES.find(e => e.value === type)?.label || type;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-cyan-50/10 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 shadow-lg">
              <Package className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Cycle de Vie des Actifs
            </h1>
          </div>
          <p className="text-slate-500 ml-14 text-sm">Asset Lifecycle Management — TCO · Amortissement · MTBF/MTTR</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg gap-2">
          <Plus className="h-4 w-4" /> Nouvel actif
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Actifs totaux", value: stats?.total ?? 0, icon: Package, color: "from-slate-500 to-slate-600" },
          { label: "Valeur d'achat", value: fmtEur(stats?.totalAssetValue), icon: DollarSign, color: "from-blue-500 to-indigo-600" },
          { label: "Valeur actuelle", value: fmtEur(stats?.totalCurrentValue), icon: TrendingDown, color: "from-teal-500 to-cyan-600" },
          { label: "Coûts maintenance", value: fmtEur(stats?.totalMaintCost), icon: Wrench, color: "from-orange-500 to-amber-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-md">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow`}><Icon className="h-5 w-5 text-white" /></div>
              <div><p className="text-xl font-bold text-slate-800 leading-tight">{value}</p><p className="text-xs text-slate-500">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "En exploitation", value: stats?.inOperation ?? 0, color: "text-green-600" },
          { label: "État moyen", value: `${Math.round(Number(stats?.avgCondition ?? 0))}%`, color: "text-blue-600" },
          { label: "MTBF moyen", value: `${fmt(stats?.avgMtbf, 1)} h`, color: "text-purple-600" },
          { label: "MTTR moyen", value: `${fmt(stats?.avgMttr, 1)} h`, color: "text-orange-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Stage funnel */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {STAGES.map(({ value, label, color, icon: Icon }) => {
          const cnt = stats?.byStage?.find(s => s.lifecycleStage === value)?.count ?? 0;
          return (
            <button key={value} onClick={() => setFilterStage(filterStage === value ? "all" : value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-sm ${
                filterStage === value ? `${color} border-current shadow-md scale-105` : "bg-white border-slate-200 hover:border-slate-300"
              }`}>
              <Icon className="h-4 w-4" />
              <span className="font-medium">{label}</span>
              <span className="font-bold">{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Rechercher un actif..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white" />
        </div>
        <Select value={filterCrit} onValueChange={setFilterCrit}>
          <SelectTrigger className="w-40 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes criticités</SelectItem>
            {CRITICALITIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Asset list */}
      {isLoading ? (
        <div className="flex justify-center h-48 items-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-1">Aucun actif référencé</h3>
          <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white gap-2 mt-4">
            <Plus className="h-4 w-4" /> Créer le premier actif
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(asset => {
            const stage = getStage(asset.lifecycleStage);
            const crit = getCrit(asset.criticality);
            const StageIcon = stage.icon;
            const hasReplacement = asset.plannedReplacementDate && new Date(asset.plannedReplacementDate) < new Date(Date.now() + 180 * 24 * 3600 * 1000);

            return (
              <Card key={asset.id} className="border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-2.5 rounded-xl shadow-sm bg-gradient-to-br from-blue-500 to-cyan-600`}>
                        <StageIcon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono text-slate-500">{asset.assetTag}</span>
                          <Badge className={stage.color + " text-xs"}>{stage.label}</Badge>
                          <Badge className={crit.color + " text-xs"}>{crit.label}</Badge>
                          {hasReplacement && <Badge className="bg-red-100 text-red-700 text-xs">⏰ Remplacement prévu</Badge>}
                        </div>
                        <h3 className="font-semibold text-slate-800">{asset.name}</h3>
                        <div className="flex items-center gap-4 mt-1 flex-wrap text-xs text-slate-500">
                          {asset.category && <span><Tag className="h-3 w-3 inline mr-1" />{asset.category}</span>}
                          {asset.manufacturer && <span>{asset.manufacturer}{asset.model ? ` — ${asset.model}` : ""}</span>}
                          {asset.location && <span><MapPin className="h-3 w-3 inline mr-1" />{asset.location}</span>}
                          {asset.purchaseCost && <span className="text-blue-600 font-medium">💰 {fmtEur(asset.purchaseCost)}</span>}
                          {asset.currentValue && asset.purchaseCost && (
                            <span className="text-teal-600">📉 {fmtEur(asset.currentValue)} actuel</span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 max-w-48">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-slate-500">État</span>
                              <span className="text-xs font-bold" style={{ color: asset.conditionScore >= 80 ? "#22c55e" : asset.conditionScore >= 60 ? "#f59e0b" : "#ef4444" }}>{asset.conditionScore}%</span>
                            </div>
                            <Progress value={asset.conditionScore} className="h-1.5" />
                          </div>
                          {asset.mtbfHours && <span className="text-xs text-purple-600">MTBF: {fmt(asset.mtbfHours, 0)}h</span>}
                          {asset.mttrHours && <span className="text-xs text-orange-600">MTTR: {fmt(asset.mttrHours, 1)}h</span>}
                          {asset.failureCount ? <span className="text-xs text-red-600">⚠️ {asset.failureCount} pannes</span> : null}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openDetail(asset)}>
                      <Eye className="h-4 w-4 mr-1" /> Détail
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── CREATE ────────────────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-blue-600" /> Nouvel actif</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Nom *</FormLabel><FormControl><Input placeholder="Ex: Compresseur K1 - Hall A" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Catégorie</FormLabel><FormControl><Input placeholder="Ex: Compresseur" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="assetTag" render={({ field }) => (
                  <FormItem><FormLabel>Tag actif (auto si vide)</FormLabel><FormControl><Input placeholder="Ex: AST-25-001" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="manufacturer" render={({ field }) => (
                  <FormItem><FormLabel>Fabricant</FormLabel><FormControl><Input placeholder="Ex: Atlas Copco" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="model" render={({ field }) => (
                  <FormItem><FormLabel>Modèle</FormLabel><FormControl><Input placeholder="Ex: GA 55+" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="serialNumber" render={({ field }) => (
                  <FormItem><FormLabel>Numéro de série</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem><FormLabel>Localisation</FormLabel><FormControl><Input placeholder="Ex: Atelier B, Zone 2" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lifecycleStage" render={({ field }) => (
                  <FormItem><FormLabel>Stade de vie</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="criticality" render={({ field }) => (
                  <FormItem><FormLabel>Criticité</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{CRITICALITIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                  <FormItem><FormLabel>Date d'achat</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="commissioningDate" render={({ field }) => (
                  <FormItem><FormLabel>Mise en service</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="plannedReplacementDate" render={({ field }) => (
                  <FormItem><FormLabel>Remplacement prévu</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="purchaseCost" render={({ field }) => (
                  <FormItem><FormLabel>Coût d'achat (€)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="salvageValue" render={({ field }) => (
                  <FormItem><FormLabel>Valeur résiduelle (€)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="usefulLifeYears" render={({ field }) => (
                  <FormItem><FormLabel>Durée de vie (ans)</FormLabel><FormControl><Input type="number" placeholder="10" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="depreciationMethod" render={({ field }) => (
                  <FormItem><FormLabel>Méthode d'amortissement</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="linear">Linéaire</SelectItem>
                        <SelectItem value="declining">Dégressif</SelectItem>
                        <SelectItem value="units_of_production">Unités de production</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
                <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}Créer
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── DETAIL ────────────────────────────────────────────────────────── */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
                <Package className="h-6 w-6 text-blue-600" />
                <div className="flex-1">
                  <DialogTitle>{selected.name}</DialogTitle>
                  <p className="text-xs text-slate-500 font-mono">{selected.assetTag}</p>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  {/* Stage change */}
                  <Select value={selected.lifecycleStage} onValueChange={v => updateMutation.mutate({ id: selected.id, data: { lifecycleStage: v } })}>
                    <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {/* Condition score */}
                  <div className="flex items-center gap-2 bg-white rounded-lg border px-3 py-1">
                    <span className="text-xs text-slate-500">État:</span>
                    <input type="range" min="0" max="100" value={selected.conditionScore}
                      onChange={e => updateMutation.mutate({ id: selected.id, data: { conditionScore: Number(e.target.value) } })}
                      className="w-20 accent-blue-500" />
                    <span className="text-sm font-bold" style={{ color: selected.conditionScore >= 80 ? "#22c55e" : selected.conditionScore >= 60 ? "#f59e0b" : "#ef4444" }}>
                      {selected.conditionScore}%
                    </span>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <Tabs defaultValue="overview">
              <TabsList className="w-full">
                <TabsTrigger value="overview" className="flex-1">Vue d'ensemble</TabsTrigger>
                <TabsTrigger value="financial" className="flex-1">Financier</TabsTrigger>
                <TabsTrigger value="performance" className="flex-1">Performance</TabsTrigger>
                <TabsTrigger value="history" className="flex-1">Historique ({(selected.lifecycleEvents || []).length})</TabsTrigger>
              </TabsList>

              {/* Overview */}
              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  {[
                    { label: "Catégorie", value: selected.category },
                    { label: "Fabricant", value: selected.manufacturer },
                    { label: "Modèle", value: selected.model },
                    { label: "N° de série", value: selected.serialNumber },
                    { label: "Localisation", value: selected.location },
                    { label: "Criticité", value: <Badge className={getCrit(selected.criticality).color}>{getCrit(selected.criticality).label}</Badge> },
                    { label: "Date d'achat", value: selected.purchaseDate ? new Date(selected.purchaseDate).toLocaleDateString("fr-FR") : null },
                    { label: "Mise en service", value: selected.commissioningDate ? new Date(selected.commissioningDate).toLocaleDateString("fr-FR") : null },
                    { label: "Remplacement prévu", value: selected.plannedReplacementDate ? new Date(selected.plannedReplacementDate).toLocaleDateString("fr-FR") : null },
                  ].filter(i => i.value).map(({ label, value }) => (
                    <div key={label}><p className="text-slate-500 text-xs">{label}</p><p className="font-medium">{value}</p></div>
                  ))}
                </div>
                <div className="mt-2">
                  <p className="text-xs text-slate-500 mb-1">État général</p>
                  <Progress value={selected.conditionScore} className="h-3" />
                  <p className="text-xs text-slate-500 mt-1">{selected.conditionScore}% — {selected.conditionScore >= 80 ? "Bon état" : selected.conditionScore >= 60 ? "État acceptable" : selected.conditionScore >= 40 ? "Dégradé" : "Critique"}</p>
                </div>
                {selected.notes && (
                  <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">{selected.notes}</div>
                )}
              </TabsContent>

              {/* Financial */}
              <TabsContent value="financial" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: "Valeur d'achat", value: fmtEur(selected.purchaseCost), color: "text-blue-600" },
                    { label: "Valeur actuelle (estimée)", value: fmtEur(selected.currentValue), color: "text-teal-600" },
                    { label: "Valeur résiduelle", value: fmtEur(selected.salvageValue), color: "text-slate-600" },
                    { label: "Durée de vie utile", value: selected.usefulLifeYears ? `${selected.usefulLifeYears} ans` : null, color: "text-purple-600" },
                    { label: "Méthode d'amortissement", value: selected.depreciationMethod === "linear" ? "Linéaire" : selected.depreciationMethod === "declining" ? "Dégressif" : "Unités de prod.", color: "text-slate-600" },
                    { label: "Coûts maintenance cumulés", value: fmtEur(selected.totalMaintenanceCost), color: "text-orange-600" },
                  ].filter(i => i.value).map(({ label, value, color }) => (
                    <div key={label} className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
                {/* TCO */}
                {selected.purchaseCost && selected.totalMaintenanceCost != null && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">Coût Total de Possession (TCO)</h4>
                    <p className="text-2xl font-black text-blue-700">
                      {fmtEur(Number(selected.purchaseCost) + Number(selected.totalMaintenanceCost || 0))}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">Achat + Maintenance cumulée</p>
                  </div>
                )}
                {/* Depreciation chart */}
                {selected.purchaseCost && selected.usefulLifeYears && (
                  <>
                    <p className="text-sm font-semibold text-slate-700">Courbe d'amortissement</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={depreciationData(selected)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: any) => `${Number(v).toLocaleString("fr-FR")} €`} />
                        <Area type="monotone" dataKey="linéaire" stroke="#6366f1" fill="#e0e7ff" strokeWidth={2} />
                        <Area type="monotone" dataKey="dégressif" stroke="#f97316" fill="#fed7aa" strokeWidth={2} fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </>
                )}
              </TabsContent>

              {/* Performance */}
              <TabsContent value="performance" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Pannes totales", value: selected.failureCount ?? 0, icon: "⚠️", color: "text-red-600" },
                    { label: "Nb maintenances", value: selected.maintenanceCount ?? 0, icon: "🔧", color: "text-blue-600" },
                    { label: "MTBF (h)", value: fmt(selected.mtbfHours, 1), icon: "⏱️", color: "text-purple-600" },
                    { label: "MTTR (h)", value: fmt(selected.mttrHours, 1), icon: "⌚", color: "text-orange-600" },
                  ].map(({ label, value, icon, color }) => (
                    <div key={label} className="bg-white rounded-xl p-4 border shadow-sm text-center">
                      <span className="text-2xl">{icon}</span>
                      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                      <p className="text-xs text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">MTBF (heures)</label>
                    <Input type="number" className="mt-1" defaultValue={selected.mtbfHours || ""}
                      onBlur={e => updateMutation.mutate({ id: selected.id, data: { mtbfHours: parseFloat(e.target.value) || null } })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">MTTR (heures)</label>
                    <Input type="number" className="mt-1" defaultValue={selected.mttrHours || ""}
                      onBlur={e => updateMutation.mutate({ id: selected.id, data: { mttrHours: parseFloat(e.target.value) || null } })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Heures d'arrêt totales</label>
                    <Input type="number" className="mt-1" defaultValue={selected.totalDowntimeHours || ""}
                      onBlur={e => updateMutation.mutate({ id: selected.id, data: { totalDowntimeHours: parseFloat(e.target.value) || null } })} />
                  </div>
                </div>
              </TabsContent>

              {/* History / Timeline */}
              <TabsContent value="history" className="space-y-4 mt-4">
                <Button size="sm" onClick={() => setShowAddEvent(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                  <Plus className="h-4 w-4" /> Ajouter un événement
                </Button>

                {(selected.lifecycleEvents || []).length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">Aucun événement enregistré</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />
                    <div className="space-y-4">
                      {[...(selected.lifecycleEvents || [])].reverse().map((evt, i) => (
                        <div key={evt.id || i} className="flex items-start gap-4 relative">
                          <div className="w-10 h-10 rounded-full bg-white border-2 border-blue-200 flex items-center justify-center text-lg shadow-sm shrink-0 z-10">
                            {eventIcon(evt.type)}
                          </div>
                          <div className="flex-1 bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">{eventLabel(evt.type)}</Badge>
                              <span className="text-xs text-slate-500">{new Date(evt.date).toLocaleDateString("fr-FR")}</span>
                              {evt.cost && <span className="text-xs text-orange-600 font-medium">💸 {fmtEur(evt.cost)}</span>}
                            </div>
                            <p className="text-sm text-slate-700">{evt.description}</p>
                            {evt.performedBy && <p className="text-xs text-slate-400 mt-1">Par: {evt.performedBy}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add event inline dialog */}
                <Dialog open={showAddEvent} onOpenChange={setShowAddEvent}>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Ajouter un événement</DialogTitle></DialogHeader>
                    <Form {...evtForm}>
                      <form onSubmit={evtForm.handleSubmit(d => addEventMutation.mutate({ id: selected.id, data: { ...d, cost: d.cost ? parseFloat(d.cost) : undefined } }))} className="space-y-3 mt-2">
                        <div className="grid grid-cols-2 gap-3">
                          <FormField control={evtForm.control} name="date" render={({ field }) => (
                            <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={evtForm.control} name="type" render={({ field }) => (
                            <FormItem><FormLabel>Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{EVENT_TYPES.map(e => <SelectItem key={e.value} value={e.value}>{e.icon} {e.label}</SelectItem>)}</SelectContent>
                              </Select><FormMessage /></FormItem>
                          )} />
                        </div>
                        <FormField control={evtForm.control} name="description" render={({ field }) => (
                          <FormItem><FormLabel>Description *</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-3">
                          <FormField control={evtForm.control} name="cost" render={({ field }) => (
                            <FormItem><FormLabel>Coût (€)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={evtForm.control} name="performedBy" render={({ field }) => (
                            <FormItem><FormLabel>Réalisé par</FormLabel><FormControl><Input placeholder="Technicien..." {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setShowAddEvent(false)}>Annuler</Button>
                          <Button type="submit" disabled={addEventMutation.isPending} className="bg-blue-600 text-white">
                            {addEventMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Ajouter
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => { if (confirm("Supprimer cet actif ?")) deleteMutation.mutate(selected.id); }}>
                <Trash2 className="h-4 w-4 mr-1" /> Supprimer
              </Button>
              <Button variant="outline" onClick={() => setSelected(null)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
