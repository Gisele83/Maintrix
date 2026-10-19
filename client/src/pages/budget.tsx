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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Loader2, Search, Eye, Trash2, DollarSign,
  TrendingUp, TrendingDown, CheckCircle2, Clock, AlertTriangle,
  BarChart3, FileText, ArrowUpRight, PieChart, Wallet
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePie, Pie, Cell, Legend
} from "recharts";
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

interface BudgetLine { id?: string; category: string; description: string; allocated: number; spent: number; committed: number; unit?: string; quantity?: number; unitCost?: number; }
interface Budget { id: number; budgetNumber: string; title: string; fiscalYear: number; department?: string; budgetType: string; status: string; totalAllocated: number; totalSpent: number; totalCommitted: number; contingencyPct: number; currency: string; startDate?: string; endDate?: string; approvedBy?: string; lines: BudgetLine[]; notes?: string; availableBudget: number; contingency: number; consumptionPct: number; }
interface BudgetStats { total: number; totalAllocated: number; totalSpent: number; totalCommitted: number; approved: number; draft: number; byType: any[]; monthly: any[]; }
interface Transaction { id: number; transactionType: string; amount: number; description: string; supplierName?: string; transactionDate: string; category?: string; reference?: string; }

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-paper-deep text-ink-soft" },
  in_review: { label: "En révision", color: "bg-etat-encours-fond text-etat-encours-texte" },
  approved: { label: "Approuvé", color: "bg-etat-nominal-fond text-etat-nominal-texte" },
  closed: { label: "Clôturé", color: "bg-paper-deep text-ink-mute" },
};
const TYPE_CFG: Record<string, { label: string; color: string }> = {
  maintenance: { label: "Maintenance", color: "bg-etat-encours-fond text-etat-encours-texte" },
  capex: { label: "CAPEX", color: "bg-paper-deep text-signal-deep" },
  opex: { label: "OPEX", color: "bg-etat-encours-fond text-etat-encours-texte" },
  emergency: { label: "Urgence", color: "bg-etat-critique-fond text-etat-critique-texte" },
  project: { label: "Projet", color: "bg-etat-encours-fond text-etat-encours-texte" },
};
const COLORS = ["#6366f1","#22c55e","#f97316","#3b82f6","#ec4899","#14b8a6"];
const fmtEur = (n: number | undefined | null) => n != null ? `${Number(n).toLocaleString("fr-FR",{maximumFractionDigits:0})} €` : "—";
const pctColor = (p: number) => p >= 90 ? "text-etat-critique-texte" : p >= 75 ? "text-etat-alerte-texte" : "text-etat-nominal-texte";

const CreateSchema = z.object({
  title: z.string().min(3),
  fiscalYear: z.coerce.number().int(),
  department: z.string().optional(),
  budgetType: z.string().default("maintenance"),
  totalAllocated: z.coerce.number().default(0),
  contingencyPct: z.coerce.number().default(10),
  currency: z.string().default("EUR"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});
type CreateForm = z.infer<typeof CreateSchema>;

const TxSchema = z.object({
  transactionType: z.enum(["expense","commitment","adjustment","refund"]),
  amount: z.coerce.number().positive(),
  description: z.string().min(2),
  reference: z.string().optional(),
  supplierName: z.string().optional(),
  transactionDate: z.string().min(1),
  category: z.string().optional(),
});
type TxForm = z.infer<typeof TxSchema>;

export default function BudgetPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Budget & { transactions?: Transaction[] } | null>(null);
  const [showTx, setShowTx] = useState(false);
  const [newLine, setNewLine] = useState<Partial<BudgetLine> | null>(null);

  const { data: budgets = [], isLoading } = useQuery<Budget[]>({ queryKey: [`/api/budgets?year=${year}`] });
  const { data: stats } = useQuery<BudgetStats>({ queryKey: [`/api/budgets/stats?year=${year}`] });
  // Les clés ci-dessus embarquent l'année dans l'URL (un seul élément) — invalidateQueries({queryKey:["/api/budgets"]})
  // ne les matcherait plus par préfixe (comparaison élément par élément, pas sous-chaîne). On invalide donc par
  // prédicat sur le préfixe réel de l'URL, qui couvre à la fois /api/budgets et /api/budgets/stats en un seul appel.
  const invalidate = () => {
    qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith("/api/budgets") });
  };

  const createMut = useMutation({
    mutationFn: (d: any) => apiRequest("/api/budgets", { method: "POST", body: d }),
    onSuccess: () => { invalidate(); setShowCreate(false); form.reset(); toast({ title: "Budget créé" }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest(`/api/budgets/${id}`, { method: "PATCH", body: data }),
    onSuccess: async (res: any) => { invalidate(); setSelected(res); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });
  const addTxMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest(`/api/budgets/${id}/transactions`, { method: "POST", body: data }),
    onSuccess: async () => { if (selected) { const res = await apiRequest(`/api/budgets/${selected.id}`); setSelected(res); } invalidate(); setShowTx(false); txForm.reset(); toast({ title: "Transaction enregistrée" }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/budgets/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); setSelected(null); toast({ title: "Budget supprimé" }); },
  });

  const form = useForm<CreateForm>({ resolver: zodResolver(CreateSchema), defaultValues: { fiscalYear: new Date().getFullYear(), budgetType: "maintenance", totalAllocated: 0, contingencyPct: 10, currency: "EUR" } });
  const txForm = useForm<TxForm>({ resolver: zodResolver(TxSchema), defaultValues: { transactionType: "expense", transactionDate: new Date().toISOString().split("T")[0] } });

  const openDetail = async (b: Budget) => {
    const res = await apiRequest(`/api/budgets/${b.id}`);
    setSelected(res);
  };

  const saveLine = () => {
    if (!selected || !newLine?.category) return;
    const lines = [...(selected.lines || []), { ...newLine, id: `line-${Date.now()}`, allocated: Number(newLine.allocated || 0), spent: 0, committed: 0 } as BudgetLine];
    updateMut.mutate({ id: selected.id, data: { lines } });
    setNewLine(null);
  };

  const filtered = budgets.filter(b => !search || b.title.toLowerCase().includes(search.toLowerCase()) || b.budgetNumber.includes(search));
  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 2 + i));

  const pieData = stats?.byType?.map(t => ({ name: TYPE_CFG[t.budget_type]?.label || t.budget_type, value: Number(t.allocated) })) || [];
  const monthNames = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
  const monthlyData = Array.from({ length: 12 }, (_, i) => ({ month: monthNames[i], dépenses: 0, ...stats?.monthly?.find((m: any) => Number(m.month) === i + 1 && (m.total = Number(m.total))) }));

  return (
    <AppShell filAriane={[{ libelle: "Analyse" }, { libelle: "Budget" }]} largeur="large">
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-none bg-paper-deep"><Wallet className="h-6 w-6 text-ink" /></div>
            <h1 className="text-3xl font-bold text-ink">Gestion de Budget</h1>
          </div>
          <p className="text-ink-mute ml-14 text-sm">Suivi des budgets de maintenance, CAPEX et dépenses</p>
        </div>
        <div className="flex gap-2">
          <Select value={year} onValueChange={setYear}><SelectTrigger className="w-28 bg-white"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
          <Button onClick={() => setShowCreate(true)} className="bg-ink text-white gap-2"><Plus className="h-4 w-4" />Nouveau budget</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Budget alloué", value: fmtEur(stats?.totalAllocated), icon: DollarSign, color: "" },
          { label: "Dépenses réelles", value: fmtEur(stats?.totalSpent), icon: TrendingDown, color: "" },
          { label: "Engagements", value: fmtEur(stats?.totalCommitted), icon: Clock, color: "" },
          { label: "Disponible", value: fmtEur((stats?.totalAllocated || 0) - (stats?.totalSpent || 0) - (stats?.totalCommitted || 0)), icon: TrendingUp, color: "" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-none"><CardContent className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-none bg-paper-deep ${color} shadow`}><Icon className="h-5 w-5 text-ink" /></div>
            <div><p className="text-lg font-bold text-ink leading-tight">{value}</p><p className="text-xs text-ink-mute">{label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      {/* Charts */}
      {(pieData.length > 0 || monthlyData.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="border-0 shadow-none"><CardHeader className="pb-2"><CardTitle className="text-sm text-ink-soft">Répartition par type</CardTitle></CardHeader>
            <CardContent><ResponsiveContainer width="100%" height={180}><RePie><Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}>{pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: any) => fmtEur(Number(v))} /></RePie></ResponsiveContainer></CardContent>
          </Card>
          <Card className="border-0 shadow-none"><CardHeader className="pb-2"><CardTitle className="text-sm text-ink-soft">Dépenses mensuelles</CardTitle></CardHeader>
            <CardContent><ResponsiveContainer width="100%" height={180}><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v: any) => fmtEur(Number(v))} /><Bar dataKey="total" fill="#6366f1" radius={[3,3,0,0]} /></BarChart></ResponsiveContainer></CardContent>
          </Card>
        </div>
      )}

      {/* Filters + List */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 min-w-60"><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-mute" /><Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white" /></div>
      </div>

      {isLoading ? <div className="flex justify-center h-48 items-center"><Loader2 className="h-8 w-8 animate-spin text-ink-mute" /></div>
      : filtered.length === 0 ? (
        <div className="text-center py-16"><Wallet className="h-12 w-12 text-ink-soft mx-auto mb-4" /><h3 className="text-lg font-semibold text-ink-soft">Aucun budget pour {year}</h3><Button onClick={() => setShowCreate(true)} className="bg-ink text-white gap-2 mt-4"><Plus className="h-4 w-4" />Créer le premier budget</Button></div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(b => {
            const typeConf = TYPE_CFG[b.budgetType] || TYPE_CFG.maintenance;
            const statusConf = STATUS_CFG[b.status] || STATUS_CFG.draft;
            return (
              <Card key={b.id} className="border border-slate-100 shadow-sm hover:shadow-none transition-all">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono text-ink-mute">{b.budgetNumber}</span>
                        <Badge className={statusConf.color + " text-xs"}>{statusConf.label}</Badge>
                        <Badge className={typeConf.color + " text-xs"}>{typeConf.label}</Badge>
                        <Badge variant="outline" className="text-xs">{b.fiscalYear}</Badge>
                        {b.department && <span className="text-xs text-ink-mute">{b.department}</span>}
                      </div>
                      <h3 className="font-semibold text-ink">{b.title}</h3>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs text-ink-mute">
                          <span>Consommation: {b.consumptionPct}%</span>
                          <span className={`font-bold ${pctColor(b.consumptionPct)}`}>{fmtEur(b.totalSpent)} / {fmtEur(b.totalAllocated)}</span>
                        </div>
                        <Progress value={b.consumptionPct} className="h-2" />
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-ink-mute flex-wrap">
                        <span className="text-etat-alerte-texte">Engagements: {fmtEur(b.totalCommitted)}</span>
                        <span className="text-etat-nominal-texte">Disponible: {fmtEur(b.availableBudget)}</span>
                        <span>Provision: {b.contingencyPct}% ({fmtEur(b.contingency)})</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openDetail(b)}><Eye className="h-4 w-4 mr-1" />Détail</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-etat-nominal-texte" />Nouveau budget</DialogTitle></DialogHeader>
          <Form {...form}><form onSubmit={form.handleSubmit(d => createMut.mutate(d))} className="space-y-3 mt-2">
            <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Intitulé *</FormLabel><FormControl><Input placeholder="Ex: Budget maintenance préventive 2025" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="fiscalYear" render={({ field }) => (<FormItem><FormLabel>Année fiscale *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="budgetType" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{Object.entries(TYPE_CFG).map(([v,c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="department" render={({ field }) => (<FormItem><FormLabel>Service</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="totalAllocated" render={({ field }) => (<FormItem><FormLabel>Montant alloué (€) *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contingencyPct" render={({ field }) => (<FormItem><FormLabel>Provision (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem><FormLabel>Début</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="endDate" render={({ field }) => (<FormItem><FormLabel>Fin</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter><Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button><Button type="submit" disabled={createMut.isPending} className="bg-etat-nominal-vif text-white">{createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}Créer</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>

      {/* DETAIL */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 p-4 rounded-none bg-paper-deep border border-etat-nominal-filet">
                <Wallet className="h-6 w-6 text-etat-nominal-texte" />
                <div className="flex-1"><DialogTitle>{selected.title}</DialogTitle><p className="text-xs text-ink-mute font-mono">{selected.budgetNumber} · {selected.fiscalYear}</p></div>
                <div className="flex gap-2">
                  {["draft","in_review","approved","closed"].map(s => (
                    <Button key={s} variant={selected.status === s ? "default" : "outline"} size="sm" className={selected.status === s ? "bg-etat-nominal-vif text-white text-xs" : "text-xs"} onClick={() => updateMut.mutate({ id: selected.id, data: { status: s } })}>{STATUS_CFG[s]?.label}</Button>
                  ))}
                </div>
              </div>
            </DialogHeader>
            <Tabs defaultValue="overview">
              <TabsList className="w-full"><TabsTrigger value="overview" className="flex-1">Vue d'ensemble</TabsTrigger><TabsTrigger value="lines" className="flex-1">Lignes budgétaires</TabsTrigger><TabsTrigger value="transactions" className="flex-1">Transactions ({(selected as any).transactions?.length || 0})</TabsTrigger></TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { l: "Alloué", v: fmtEur(selected.totalAllocated), c: "text-etat-encours-texte" },
                    { l: "Dépensé", v: fmtEur(selected.totalSpent), c: "text-etat-critique-texte" },
                    { l: "Engagé", v: fmtEur(selected.totalCommitted), c: "text-etat-alerte-texte" },
                    { l: "Disponible", v: fmtEur(selected.availableBudget), c: "text-etat-nominal-texte" },
                  ].map(({ l, v, c }) => (<div key={l} className="bg-white rounded-none border p-3 text-center"><p className="text-xs text-ink-mute">{l}</p><p className={`text-xl font-bold ${c}`}>{v}</p></div>))}
                </div>
                <div><div className="flex justify-between text-sm mb-1"><span>Consommation</span><span className={`font-bold ${pctColor(selected.consumptionPct)}`}>{selected.consumptionPct}%</span></div><Progress value={selected.consumptionPct} className="h-3" /></div>
                {selected.notes && <div className="bg-paper p-3 rounded-lg text-sm">{selected.notes}</div>}
              </TabsContent>

              <TabsContent value="lines" className="space-y-3 mt-4">
                <Button size="sm" variant="outline" onClick={() => setNewLine({ allocated: 0, spent: 0, committed: 0 })} className="gap-2"><Plus className="h-4 w-4" />Ajouter une ligne</Button>
                {newLine && (
                  <div className="border-2 border-etat-nominal-filet rounded-none p-4 bg-etat-nominal-fond/30 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs font-medium text-ink-soft">Catégorie *</label><Input className="mt-1" value={newLine.category || ""} onChange={e => setNewLine(p => ({ ...p, category: e.target.value }))} placeholder="Ex: Pièces de rechange" /></div>
                      <div><label className="text-xs font-medium text-ink-soft">Description</label><Input className="mt-1" value={newLine.description || ""} onChange={e => setNewLine(p => ({ ...p, description: e.target.value }))} /></div>
                      <div><label className="text-xs font-medium text-ink-soft">Montant alloué (€)</label><Input type="number" className="mt-1" value={newLine.allocated || 0} onChange={e => setNewLine(p => ({ ...p, allocated: Number(e.target.value) }))} /></div>
                    </div>
                    <div className="flex gap-2"><Button size="sm" onClick={saveLine} className="bg-etat-nominal-vif text-white"><Plus className="h-4 w-4 mr-1" />Ajouter</Button><Button size="sm" variant="outline" onClick={() => setNewLine(null)}>Annuler</Button></div>
                  </div>
                )}
                <div className="overflow-x-auto rounded-none border">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-paper border-b">{["Catégorie","Description","Alloué","Dépensé","Engagé","Disponible","Consommation"].map(h => <th key={h} className="py-2 px-3 text-left text-xs font-semibold text-ink-soft whitespace-nowrap">{h}</th>)}</tr></thead>
                    <tbody>{(selected.lines || []).map((l, i) => {
                      const avail = (l.allocated || 0) - (l.spent || 0) - (l.committed || 0);
                      const pct = l.allocated > 0 ? Math.round((l.spent / l.allocated) * 100) : 0;
                      return (<tr key={i} className="border-b hover:bg-paper">
                        <td className="py-2 px-3 font-medium">{l.category}</td>
                        <td className="py-2 px-3 text-ink-mute text-xs">{l.description || "—"}</td>
                        <td className="py-2 px-3 text-etat-encours-texte font-medium">{fmtEur(l.allocated)}</td>
                        <td className="py-2 px-3 text-etat-critique-texte">{fmtEur(l.spent)}</td>
                        <td className="py-2 px-3 text-etat-alerte-texte">{fmtEur(l.committed)}</td>
                        <td className={`py-2 px-3 font-medium ${avail < 0 ? "text-etat-critique-texte" : "text-etat-nominal-texte"}`}>{fmtEur(avail)}</td>
                        <td className="py-2 px-3"><div className="flex items-center gap-2"><Progress value={pct} className="h-1.5 w-20" /><span className={`text-xs ${pctColor(pct)}`}>{pct}%</span></div></td>
                      </tr>);
                    })}</tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="transactions" className="space-y-3 mt-4">
                <Button size="sm" onClick={() => setShowTx(true)} className="bg-etat-nominal-vif text-white gap-2"><Plus className="h-4 w-4" />Enregistrer une transaction</Button>
                <div className="space-y-2">
                  {((selected as any).transactions || []).map((tx: Transaction) => (
                    <div key={tx.id} className="flex items-center gap-3 bg-white border rounded-none px-4 py-2.5">
                      <div className={`w-2 h-2 rounded-full ${tx.transactionType === "expense" ? "bg-etat-critique-vif" : tx.transactionType === "commitment" ? "bg-etat-alerte-vif" : tx.transactionType === "refund" ? "bg-etat-nominal-vif" : "bg-slate-400"}`} />
                      <div className="flex-1"><p className="text-sm font-medium">{tx.description}</p><p className="text-xs text-ink-mute">{tx.category} · {tx.supplierName} · {new Date(tx.transactionDate).toLocaleDateString("fr-FR")}</p></div>
                      <span className={`font-bold ${tx.transactionType === "expense" ? "text-etat-critique-texte" : tx.transactionType === "refund" ? "text-etat-nominal-texte" : "text-etat-alerte-texte"}`}>{tx.transactionType === "refund" ? "+" : "-"}{fmtEur(tx.amount)}</span>
                    </div>
                  ))}
                  {!((selected as any).transactions?.length) && <p className="text-ink-mute text-sm text-center py-8">Aucune transaction</p>}
                </div>
              </TabsContent>
            </Tabs>
            <DialogFooter className="gap-2">
              <Button variant="ghost" size="sm" className="text-etat-critique-texte mr-auto" onClick={() => { if (confirm("Supprimer ce budget ?")) deleteMut.mutate(selected.id); }}><Trash2 className="h-4 w-4 mr-1" />Supprimer</Button>
              <Button variant="outline" onClick={() => setSelected(null)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Transaction dialog */}
      {showTx && selected && (
        <Dialog open={showTx} onOpenChange={setShowTx}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Enregistrer une transaction</DialogTitle></DialogHeader>
            <Form {...txForm}><form onSubmit={txForm.handleSubmit(d => addTxMut.mutate({ id: selected.id, data: d }))} className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={txForm.control} name="transactionType" render={({ field }) => (<FormItem><FormLabel>Type *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="expense">Dépense</SelectItem><SelectItem value="commitment">Engagement</SelectItem><SelectItem value="adjustment">Ajustement</SelectItem><SelectItem value="refund">↩Remboursement</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={txForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Montant (€) *</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={txForm.control} name="transactionDate" render={({ field }) => (<FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={txForm.control} name="category" render={({ field }) => (<FormItem><FormLabel>Catégorie</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={txForm.control} name="supplierName" render={({ field }) => (<FormItem><FormLabel>Fournisseur</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={txForm.control} name="reference" render={({ field }) => (<FormItem><FormLabel>Référence</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={txForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter><Button type="button" variant="outline" onClick={() => setShowTx(false)}>Annuler</Button><Button type="submit" disabled={addTxMut.isPending} className="bg-etat-nominal-vif text-white">{addTxMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Enregistrer</Button></DialogFooter>
            </form></Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
    </AppShell>
  );
}
