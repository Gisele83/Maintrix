import { useState, useCallback } from "react";
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
import { Slider } from "@/components/ui/slider";
import {
  Plus, Loader2, AlertTriangle, CheckCircle2, Eye, Trash2,
  Search, FileText, Activity, BarChart3, ChevronDown, ChevronUp,
  Save, XCircle, Info, Target
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FmeaEntry {
  id?: string;
  processStep?: string;
  component?: string;
  failureMode: string;
  failureEffect?: string;
  failureCause?: string;
  currentControls?: string;
  severity: number;
  occurrence: number;
  detection: number;
  rpn?: number;
  criticalityClass?: string;
  recommendedActions?: string;
  responsiblePerson?: string;
  targetDate?: string;
  actionTaken?: string;
  newSeverity?: number;
  newOccurrence?: number;
  newDetection?: number;
  newRpn?: number;
  status?: string;
}
interface Fmea {
  id: number;
  fmeaNumber: string;
  title: string;
  scope?: string;
  status: string;
  equipmentId?: number;
  equipmentName?: string;
  processStep?: string;
  revision: number;
  entries: FmeaEntry[];
  createdAt?: string;
  updatedAt?: string;
  eqName?: string;
}
interface FmeaStats {
  total: number;
  draft: number;
  inReview: number;
  approved: number;
  totalEntries: number;
  criticalEntries: number;
  highEntries: number;
  avgRpn: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const rpnColor = (rpn: number) => rpn >= 200 ? "#ef4444" : rpn >= 100 ? "#f97316" : rpn >= 50 ? "#eab308" : "#22c55e";
const rpnBg = (cls: string) => ({
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
})[cls] || "bg-slate-100 text-slate-700";

const rpnLabel = (cls: string) => ({ critical: "Critique", high: "Élevé", medium: "Moyen", low: "Faible" })[cls] || "";

const STATUSES = [
  { value: "draft", label: "Brouillon", color: "bg-slate-100 text-slate-600" },
  { value: "in_review", label: "En revue", color: "bg-blue-100 text-blue-700" },
  { value: "approved", label: "Approuvé", color: "bg-green-100 text-green-700" },
  { value: "obsolete", label: "Obsolète", color: "bg-gray-100 text-gray-500" },
];

const sodLabel: Record<number, string> = {
  1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10"
};

// ─── RPN Badge ────────────────────────────────────────────────────────────────
function RpnBadge({ rpn, cls }: { rpn: number; cls?: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xl font-black" style={{ color: rpnColor(rpn) }}>{rpn}</span>
      {cls && <Badge className={`text-xs mt-0.5 ${rpnBg(cls)}`}>{rpnLabel(cls)}</Badge>}
    </div>
  );
}

// ─── Criticality Matrix ────────────────────────────────────────────────────────
function CriticalityMatrix({ entries }: { entries: FmeaEntry[] }) {
  const grid: Record<string, number> = {};
  entries.forEach(e => {
    const key = `${e.occurrence}-${e.severity}`;
    grid[key] = (grid[key] || 0) + 1;
  });
  const cellColor = (s: number, o: number) => {
    const rpn = s * o * 5; // assume avg detection=5
    if (rpn >= 200) return "bg-red-400 text-white";
    if (rpn >= 100) return "bg-orange-300";
    if (rpn >= 50) return "bg-yellow-200";
    return "bg-green-100";
  };
  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-slate-500 mb-2">Matrice de criticité (Sévérité × Occurrence)</div>
      <div className="inline-block">
        <div className="flex">
          <div className="w-8" />
          {[1,2,3,4,5,6,7,8,9,10].map(s => (
            <div key={s} className="w-8 h-6 flex items-center justify-center text-xs font-bold text-slate-600">{s}</div>
          ))}
        </div>
        {[10,9,8,7,6,5,4,3,2,1].map(o => (
          <div key={o} className="flex">
            <div className="w-8 h-7 flex items-center justify-center text-xs font-bold text-slate-600">{o}</div>
            {[1,2,3,4,5,6,7,8,9,10].map(s => {
              const cnt = grid[`${o}-${s}`] || 0;
              return (
                <div key={s} className={`w-8 h-7 flex items-center justify-center text-xs rounded-sm border border-white ${cellColor(s, o)}`}>
                  {cnt > 0 ? <span className="font-bold">{cnt}</span> : ""}
                </div>
              );
            })}
          </div>
        ))}
        <div className="flex mt-1">
          <div className="w-8" />
          <div className="flex-1 text-center text-xs text-slate-500">← Sévérité →</div>
        </div>
      </div>
    </div>
  );
}

// ─── Form Schema ──────────────────────────────────────────────────────────────
const CreateSchema = z.object({
  title: z.string().min(3),
  scope: z.string().optional(),
  equipmentName: z.string().optional(),
  processStep: z.string().optional(),
});
type CreateForm = z.infer<typeof CreateSchema>;

// ─── Component ────────────────────────────────────────────────────────────────
export default function FmeaPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Fmea | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Partial<FmeaEntry> | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const { data: fmeas = [], isLoading } = useQuery<Fmea[]>({ queryKey: ["/api/fmea"] });
  const { data: stats } = useQuery<FmeaStats>({ queryKey: ["/api/fmea/stats"] });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["/api/fmea"] }); qc.invalidateQueries({ queryKey: ["/api/fmea/stats"] }); };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/fmea", { method: "POST", body: data }),
    onSuccess: () => { invalidate(); setShowCreate(false); form.reset(); toast({ title: "FMEA créé" }); },
    onError: () => toast({ title: "Erreur création", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest(`/api/fmea/${id}`, { method: "PATCH", body: data }),
    onSuccess: async (res: any, vars) => {
      invalidate();
      setSelected(res);
      toast({ title: "FMEA mis à jour" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/fmea/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); setSelected(null); toast({ title: "FMEA supprimé" }); },
  });

  const form = useForm<CreateForm>({ resolver: zodResolver(CreateSchema), defaultValues: {} });

  const openDetail = async (fmea: Fmea) => {
    try {
      const res = await apiRequest(`/api/fmea/${fmea.id}`);
      setSelected(res);
    } catch { setSelected(fmea); }
  };

  const saveEntries = (entries: FmeaEntry[]) => {
    if (!selected) return;
    updateMutation.mutate({ id: selected.id, data: { entries } });
  };

  const addOrUpdateEntry = () => {
    if (!selected || !editingEntry) return;
    const entry: FmeaEntry = {
      id: editingEntry.id || `e-${Date.now()}`,
      failureMode: editingEntry.failureMode || "",
      failureEffect: editingEntry.failureEffect || "",
      failureCause: editingEntry.failureCause || "",
      component: editingEntry.component || "",
      currentControls: editingEntry.currentControls || "",
      severity: editingEntry.severity || 5,
      occurrence: editingEntry.occurrence || 5,
      detection: editingEntry.detection || 5,
      recommendedActions: editingEntry.recommendedActions || "",
      status: (editingEntry.status as any) || "open",
    };
    const entries = [...(selected.entries || [])];
    if (editingIdx !== null) entries[editingIdx] = entry;
    else entries.push(entry);
    saveEntries(entries);
    setEditingEntry(null);
    setEditingIdx(null);
  };

  const removeEntry = (i: number) => {
    if (!selected) return;
    saveEntries(selected.entries.filter((_, j) => j !== i));
  };

  const filtered = fmeas.filter(f => {
    const s = search.toLowerCase();
    return (!s || f.title.toLowerCase().includes(s) || f.fmeaNumber.toLowerCase().includes(s)) &&
      (filterStatus === "all" || f.status === filterStatus);
  });

  const statusConf = (v: string) => STATUSES.find(s => s.value === v) || STATUSES[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/20 to-amber-50/10 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">FMEA / AMDEC</h1>
          </div>
          <p className="text-slate-500 ml-14 text-sm">Failure Mode & Effects Analysis — RPN = Sévérité × Occurrence × Détection</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg gap-2">
          <Plus className="h-4 w-4" /> Nouvelle FMEA
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Analyses FMEA", value: stats?.total ?? 0, icon: FileText, color: "from-slate-500 to-slate-600" },
          { label: "Modes de défaillance", value: stats?.totalEntries ?? 0, icon: Activity, color: "from-blue-500 to-indigo-600" },
          { label: "Entrées critiques", value: stats?.criticalEntries ?? 0, icon: AlertTriangle, color: "from-red-500 to-rose-600" },
          { label: "RPN moyen", value: stats?.avgRpn ?? 0, icon: BarChart3, color: "from-orange-500 to-amber-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-md">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow`}><Icon className="h-5 w-5 text-white" /></div>
              <div><p className="text-2xl font-bold text-slate-800">{value}</p><p className="text-xs text-slate-500">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* RPN legend */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {[
          { label: "Critique (RPN ≥ 200)", color: "bg-red-100 text-red-700" },
          { label: "Élevé (100–199)", color: "bg-orange-100 text-orange-700" },
          { label: "Moyen (50–99)", color: "bg-yellow-100 text-yellow-700" },
          { label: "Faible (< 50)", color: "bg-green-100 text-green-700" },
        ].map(({ label, color }) => (
          <Badge key={label} className={color + " px-3 py-1 text-xs"}>{label}</Badge>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Rechercher une FMEA..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center h-48 items-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <AlertTriangle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-1">Aucune analyse FMEA</h3>
          <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-orange-500 to-amber-600 text-white gap-2 mt-4">
            <Plus className="h-4 w-4" /> Créer la première FMEA
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(f => {
            const critical = f.entries?.filter(e => e.criticalityClass === "critical").length || 0;
            const high = f.entries?.filter(e => e.criticalityClass === "high").length || 0;
            const maxRpn = f.entries?.length ? Math.max(...f.entries.map(e => e.rpn || 0)) : 0;
            const sc = statusConf(f.status);
            return (
              <Card key={f.id} className="border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono text-slate-500">{f.fmeaNumber}</span>
                        <Badge className={sc.color + " text-xs"}>{sc.label}</Badge>
                        <Badge variant="outline" className="text-xs">Rev. {f.revision}</Badge>
                        {f.equipmentName && <Badge variant="outline" className="text-xs">📍 {f.equipmentName}</Badge>}
                      </div>
                      <h3 className="font-semibold text-slate-800">{f.title}</h3>
                      {f.scope && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{f.scope}</p>}
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <span className="text-xs text-slate-500">{f.entries?.length || 0} modes de défaillance</span>
                        {critical > 0 && <Badge className="bg-red-100 text-red-700 text-xs">⚠️ {critical} critique{critical > 1 ? "s" : ""}</Badge>}
                        {high > 0 && <Badge className="bg-orange-100 text-orange-700 text-xs">🔶 {high} élevé{high > 1 ? "s" : ""}</Badge>}
                        {maxRpn > 0 && <span className="text-xs font-medium" style={{ color: rpnColor(maxRpn) }}>RPN max: {maxRpn}</span>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openDetail(f)}>
                      <Eye className="h-4 w-4 mr-1" /> Analyser
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── CREATE ─────────────────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" /> Nouvelle analyse FMEA
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4 mt-2">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Titre *</FormLabel><FormControl><Input placeholder="Ex: FMEA Ligne d'embouteillage" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="equipmentName" render={({ field }) => (
                <FormItem><FormLabel>Équipement / Système</FormLabel><FormControl><Input placeholder="Ex: Compresseur K1" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="processStep" render={({ field }) => (
                <FormItem><FormLabel>Étape / Processus</FormLabel><FormControl><Input placeholder="Ex: Étape de remplissage" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="scope" render={({ field }) => (
                <FormItem><FormLabel>Périmètre d'analyse</FormLabel><FormControl><Textarea rows={2} placeholder="Description du périmètre..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
                <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-to-r from-orange-500 to-amber-600 text-white">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}Créer
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── DETAIL ─────────────────────────────────────────────────────────── */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setEditingEntry(null); setEditingIdx(null); }}>
          <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
                <div className="flex-1">
                  <DialogTitle>{selected.title}</DialogTitle>
                  <p className="text-xs text-slate-500 font-mono">{selected.fmeaNumber} · Rev. {selected.revision}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {STATUSES.map(s => (
                    <Button key={s.value} variant={selected.status === s.value ? "default" : "outline"} size="sm"
                      className={selected.status === s.value ? "bg-orange-500 text-white" : "text-xs"}
                      onClick={() => updateMutation.mutate({ id: selected.id, data: { status: s.value } })}>
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
            </DialogHeader>

            {/* Matrix toggle */}
            <Button variant="outline" size="sm" onClick={() => setShowMatrix(v => !v)} className="gap-2 self-start">
              <BarChart3 className="h-4 w-4" /> Matrice de criticité {showMatrix ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            {showMatrix && (
              <div className="bg-slate-50 rounded-xl p-4 border">
                <CriticalityMatrix entries={selected.entries || []} />
              </div>
            )}

            {/* Entries table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    {["Composant", "Mode de défaillance", "Effet", "Cause", "S", "O", "D", "RPN", "Criticité", "Actions", "Statut", ""].map(h => (
                      <th key={h} className="py-2 px-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(selected.entries || []).length === 0 && (
                    <tr><td colSpan={12} className="py-8 text-center text-slate-400 text-sm">Aucun mode de défaillance — ajoutez-en un ci-dessous</td></tr>
                  )}
                  {(selected.entries || []).map((e, i) => (
                    <tr key={e.id || i} className={`border-b hover:bg-slate-50 ${e.criticalityClass === "critical" ? "bg-red-50/30" : e.criticalityClass === "high" ? "bg-orange-50/30" : ""}`}>
                      <td className="py-2 px-3 text-xs">{e.component || "—"}</td>
                      <td className="py-2 px-3 font-medium text-sm max-w-36 truncate">{e.failureMode}</td>
                      <td className="py-2 px-3 text-xs max-w-28 truncate">{e.failureEffect || "—"}</td>
                      <td className="py-2 px-3 text-xs max-w-28 truncate">{e.failureCause || "—"}</td>
                      {[e.severity, e.occurrence, e.detection].map((v, j) => (
                        <td key={j} className="py-2 px-3 text-center">
                          <span className="font-bold text-sm" style={{ color: v && v >= 8 ? "#ef4444" : v && v >= 5 ? "#f97316" : "#22c55e" }}>{v}</span>
                        </td>
                      ))}
                      <td className="py-2 px-3 text-center"><RpnBadge rpn={e.rpn || 0} cls={e.criticalityClass} /></td>
                      <td className="py-2 px-3"><Badge className={`text-xs ${rpnBg(e.criticalityClass || "low")}`}>{rpnLabel(e.criticalityClass || "low")}</Badge></td>
                      <td className="py-2 px-3 text-xs max-w-36 truncate text-slate-600">{e.recommendedActions || "—"}</td>
                      <td className="py-2 px-3">
                        <Badge className={`text-xs ${e.status === "closed" ? "bg-green-100 text-green-700" : e.status === "in_progress" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                          {e.status === "closed" ? "Clôturé" : e.status === "in_progress" ? "En cours" : "Ouvert"}
                        </Badge>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingEntry(e); setEditingIdx(i); }}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => removeEntry(i)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add entry button */}
            <Button variant="outline" size="sm" onClick={() => { setEditingEntry({ severity: 5, occurrence: 5, detection: 5, status: "open" }); setEditingIdx(null); }} className="gap-2 w-fit">
              <Plus className="h-4 w-4" /> Ajouter un mode de défaillance
            </Button>

            {/* Entry editor */}
            {editingEntry && (
              <div className="border-2 border-orange-200 rounded-xl p-5 bg-orange-50/30 space-y-4">
                <h4 className="font-semibold text-orange-800">{editingIdx !== null ? "Modifier le mode de défaillance" : "Nouveau mode de défaillance"}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Composant</label>
                    <Input className="mt-1" value={editingEntry.component || ""} onChange={e => setEditingEntry(p => ({ ...p, component: e.target.value }))} placeholder="Ex: Roulement, Valve..." />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Mode de défaillance *</label>
                    <Input className="mt-1" value={editingEntry.failureMode || ""} onChange={e => setEditingEntry(p => ({ ...p, failureMode: e.target.value }))} placeholder="Ex: Fissure, Blocage..." />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Effet de la défaillance</label>
                    <Input className="mt-1" value={editingEntry.failureEffect || ""} onChange={e => setEditingEntry(p => ({ ...p, failureEffect: e.target.value }))} placeholder="Ex: Arrêt de production..." />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Cause de la défaillance</label>
                    <Input className="mt-1" value={editingEntry.failureCause || ""} onChange={e => setEditingEntry(p => ({ ...p, failureCause: e.target.value }))} placeholder="Ex: Fatigue matériaux..." />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { key: "severity", label: "Sévérité (S)", desc: "Impact de la défaillance" },
                    { key: "occurrence", label: "Occurrence (O)", desc: "Fréquence d'apparition" },
                    { key: "detection", label: "Détection (D)", desc: "Capacité de détection" },
                  ].map(({ key, label, desc }) => {
                    const val = (editingEntry as any)[key] || 5;
                    const previewRpn = (editingEntry.severity || 5) * (editingEntry.occurrence || 5) * (editingEntry.detection || 5);
                    return (
                      <div key={key} className="bg-white rounded-lg p-3 border">
                        <label className="text-xs font-semibold text-slate-700">{label}</label>
                        <p className="text-xs text-slate-400 mb-2">{desc}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-black w-8 text-center" style={{ color: rpnColor(val * val) }}>{val}</span>
                          <input type="range" min="1" max="10" value={val}
                            onChange={e => setEditingEntry(p => ({ ...p, [key]: Number(e.target.value) }))}
                            className="flex-1 accent-orange-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 p-3 bg-white rounded-lg border">
                  <div>
                    <span className="text-xs text-slate-500">RPN calculé</span>
                    <p className="text-3xl font-black" style={{ color: rpnColor((editingEntry.severity || 5) * (editingEntry.occurrence || 5) * (editingEntry.detection || 5)) }}>
                      {(editingEntry.severity || 5) * (editingEntry.occurrence || 5) * (editingEntry.detection || 5)}
                    </p>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-slate-700">Actions recommandées</label>
                    <Textarea rows={2} value={editingEntry.recommendedActions || ""} onChange={e => setEditingEntry(p => ({ ...p, recommendedActions: e.target.value }))} placeholder="Actions pour réduire le RPN..." className="mt-1" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addOrUpdateEntry} disabled={!editingEntry.failureMode || updateMutation.isPending} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
                    {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {editingIdx !== null ? "Mettre à jour" : "Ajouter"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditingEntry(null); setEditingIdx(null); }}>Annuler</Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => { if (confirm("Supprimer cette FMEA ?")) deleteMutation.mutate(selected.id); }}>
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
