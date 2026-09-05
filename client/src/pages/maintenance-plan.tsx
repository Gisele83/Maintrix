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
import {
  Plus, Loader2, Search, Eye, Trash2, CalendarCheck,
  CheckCircle2, Clock, AlertTriangle, Wrench, Activity,
  BarChart3, ChevronDown, ChevronUp, Save, Calendar
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

interface PlanTask {
  id?: string; title: string; description?: string; equipmentName?: string; taskType: string;
  priority: string; status: string; plannedMonth: number; plannedWeek?: number; plannedDate?: string;
  completedDate?: string; estimatedHours?: number; actualHours?: number; estimatedCost?: number;
  actualCost?: number; assignedTo?: string; supplierName?: string; requiredSkills?: string;
  spareParts?: string; frequency?: string; notes?: string;
}
interface Plan {
  id: number; planNumber: string; title: string; fiscalYear: number; department?: string; status: string;
  budgetAllocated: number; budgetSpent: number; totalTasks: number; completedTasks: number;
  inProgressTasks: number; overdueTasks: number; completionPct: number;
  tasks: PlanTask[]; monthlyData: { month: string; monthNum: number; planned: number; completed: number }[];
  notes?: string;
}
interface PlanStats { total: number; approved: number; totalTasks: any; completedTasks: any; budgetAllocated: any; budgetSpent: any; }

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-600" },
  in_review: { label: "En révision", color: "bg-blue-100 text-blue-700" },
  approved: { label: "Approuvé", color: "bg-green-100 text-green-700" },
  closed: { label: "Clôturé", color: "bg-gray-200 text-gray-500" },
};
const TASK_STATUS: Record<string, { label: string; color: string }> = {
  planned: { label: "Planifiée", color: "bg-slate-100 text-slate-600" },
  in_progress: { label: "En cours", color: "bg-blue-100 text-blue-700" },
  completed: { label: "Réalisée", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Annulée", color: "bg-gray-200 text-gray-400" },
  postponed: { label: "Reportée", color: "bg-yellow-100 text-yellow-700" },
};
const TASK_TYPES = ["preventive","corrective","inspection","calibration","lubrication","cleaning","replacement","overhaul"];
const TASK_TYPE_LABELS: Record<string, string> = { preventive:"Préventive", corrective:"Corrective", inspection:"Inspection", calibration:"Calibration", lubrication:"Lubrification", cleaning:"Nettoyage", replacement:"Remplacement", overhaul:"Révision générale" };
const PRIORITY_CFG: Record<string, string> = { low:"bg-green-100 text-green-700", medium:"bg-yellow-100 text-yellow-700", high:"bg-orange-100 text-orange-700", critical:"bg-red-100 text-red-700" };
const PRIORITY_LABELS: Record<string, string> = { low:"Faible", medium:"Moyen", high:"Élevé", critical:"Critique" };
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const fmtEur = (n: any) => n != null ? `${Number(n).toLocaleString("fr-FR",{maximumFractionDigits:0})} €` : "—";

const CreateSchema = z.object({
  title: z.string().min(3),
  fiscalYear: z.coerce.number().int(),
  department: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budgetAllocated: z.coerce.number().default(0),
  approvedBy: z.string().optional(),
  notes: z.string().optional(),
});
type CreateForm = z.infer<typeof CreateSchema>;

const TaskSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  equipmentName: z.string().optional(),
  taskType: z.string().default("preventive"),
  priority: z.string().default("medium"),
  plannedMonth: z.coerce.number().int().min(1).max(12),
  plannedWeek: z.coerce.number().int().min(1).max(53).optional(),
  estimatedHours: z.coerce.number().optional(),
  estimatedCost: z.coerce.number().optional(),
  assignedTo: z.string().optional(),
  supplierName: z.string().optional(),
  frequency: z.string().optional(),
  spareParts: z.string().optional(),
  notes: z.string().optional(),
});
type TaskFormData = z.infer<typeof TaskSchema>;

export default function MaintenancePlanPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editTaskIdx, setEditTaskIdx] = useState<number | null>(null);
  const [filterMonth, setFilterMonth] = useState(0);
  const [showGantt, setShowGantt] = useState(false);

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/maintenance-plans", year],
    queryFn: () => apiRequest(`/api/maintenance-plans?year=${year}`),
  });
  const { data: stats } = useQuery<PlanStats>({
    queryKey: ["/api/maintenance-plans/stats", year],
    queryFn: () => apiRequest(`/api/maintenance-plans/stats?year=${year}`),
  });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["/api/maintenance-plans"] }); qc.invalidateQueries({ queryKey: ["/api/maintenance-plans/stats"] }); };

  const createMut = useMutation({
    mutationFn: (d: any) => apiRequest("/api/maintenance-plans", { method: "POST", body: d }),
    onSuccess: () => { invalidate(); setShowCreate(false); form.reset(); toast({ title: "Plan créé" }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest(`/api/maintenance-plans/${id}`, { method: "PATCH", body: data }),
    onSuccess: async (res: any) => { invalidate(); setSelected(res); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/maintenance-plans/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); setSelected(null); toast({ title: "Plan supprimé" }); },
  });

  const form = useForm<CreateForm>({ resolver: zodResolver(CreateSchema), defaultValues: { fiscalYear: new Date().getFullYear(), budgetAllocated: 0 } });
  const taskForm = useForm<TaskFormData>({ resolver: zodResolver(TaskSchema), defaultValues: { taskType: "preventive", priority: "medium", plannedMonth: new Date().getMonth() + 1 } });

  const openDetail = async (p: Plan) => { try { const res = await apiRequest(`/api/maintenance-plans/${p.id}`); setSelected(res); } catch { setSelected(p); } };

  const addTask = (data: TaskFormData) => {
    if (!selected) return;
    const task: PlanTask = { ...data, id: `task-${Date.now()}`, status: "planned" };
    const tasks = [...(selected.tasks || []), task];
    if (editTaskIdx !== null) tasks[editTaskIdx] = { ...selected.tasks[editTaskIdx], ...data };
    updateMut.mutate({ id: selected.id, data: { tasks } });
    setShowAddTask(false); setEditTaskIdx(null); taskForm.reset();
  };

  const setTaskStatus = (idx: number, status: string) => {
    if (!selected) return;
    const tasks = [...selected.tasks];
    tasks[idx] = { ...tasks[idx], status, ...(status === "completed" ? { completedDate: new Date().toISOString().split("T")[0] } : {}) };
    updateMut.mutate({ id: selected.id, data: { tasks } });
  };

  const removeTask = (idx: number) => {
    if (!selected) return;
    updateMut.mutate({ id: selected.id, data: { tasks: selected.tasks.filter((_, i) => i !== idx) } });
  };

  const filtered = plans.filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.planNumber.includes(search));
  const displayedTasks = selected ? (filterMonth > 0 ? selected.tasks.filter(t => t.plannedMonth === filterMonth) : selected.tasks) : [];
  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 2 + i));
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/20 to-blue-50/10 p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 shadow-lg"><CalendarCheck className="h-6 w-6 text-white" /></div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Plan de Maintenance Annuel</h1>
          </div>
          <p className="text-slate-500 ml-14 text-sm">Planification et suivi des opérations de maintenance préventive</p>
        </div>
        <div className="flex gap-2">
          <Select value={year} onValueChange={setYear}><SelectTrigger className="w-28 bg-white"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
          <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg gap-2"><Plus className="h-4 w-4" />Nouveau plan</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Plans", value: stats?.total ?? 0, icon: CalendarCheck, color: "from-cyan-500 to-blue-600" },
          { label: "Tâches planifiées", value: Number(stats?.totalTasks) || 0, icon: Activity, color: "from-indigo-500 to-purple-600" },
          { label: "Tâches réalisées", value: Number(stats?.completedTasks) || 0, icon: CheckCircle2, color: "from-green-500 to-emerald-600" },
          { label: "Budget alloué", value: fmtEur(stats?.budgetAllocated), icon: BarChart3, color: "from-orange-500 to-amber-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-md"><CardContent className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow`}><Icon className="h-5 w-5 text-white" /></div>
            <div><p className="text-2xl font-bold text-slate-800">{value}</p><p className="text-xs text-slate-500">{label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-60"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input placeholder="Rechercher un plan..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white" /></div>
      </div>

      {isLoading ? <div className="flex justify-center h-48 items-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
      : filtered.length === 0 ? (
        <div className="text-center py-16"><CalendarCheck className="h-12 w-12 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-semibold text-slate-600">Aucun plan de maintenance pour {year}</h3><Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white gap-2 mt-4"><Plus className="h-4 w-4" />Créer le premier plan</Button></div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(p => {
            const sc = STATUS_CFG[p.status] || STATUS_CFG.draft;
            return (
              <Card key={p.id} className="border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono text-slate-400">{p.planNumber}</span>
                        <Badge className={sc.color + " text-xs"}>{sc.label}</Badge>
                        <Badge variant="outline" className="text-xs">{p.fiscalYear}</Badge>
                        {p.department && <span className="text-xs text-slate-500">🏢 {p.department}</span>}
                      </div>
                      <h3 className="font-semibold text-slate-800">{p.title}</h3>
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-slate-500"><span>Avancement: {p.completionPct}%</span><span className="font-medium">{p.completedTasks}/{p.totalTasks} tâches</span></div>
                        <Progress value={p.completionPct} className="h-2.5" />
                      </div>
                      <div className="flex gap-4 mt-2 text-xs flex-wrap">
                        {p.inProgressTasks > 0 && <span className="text-blue-600">🔧 {p.inProgressTasks} en cours</span>}
                        {p.overdueTasks > 0 && <span className="text-red-600">⚠️ {p.overdueTasks} en retard</span>}
                        <span className="text-slate-500">💰 {fmtEur(p.budgetAllocated)}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openDetail(p)}><Eye className="h-4 w-4 mr-1" />Planifier</Button>
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
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-cyan-600" />Nouveau plan de maintenance</DialogTitle></DialogHeader>
          <Form {...form}><form onSubmit={form.handleSubmit(d => createMut.mutate(d))} className="space-y-3 mt-2">
            <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Intitulé *</FormLabel><FormControl><Input placeholder="Ex: Plan de maintenance préventive 2025" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="fiscalYear" render={({ field }) => (<FormItem><FormLabel>Année *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="department" render={({ field }) => (<FormItem><FormLabel>Service</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="budgetAllocated" render={({ field }) => (<FormItem><FormLabel>Budget alloué (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="approvedBy" render={({ field }) => (<FormItem><FormLabel>Approuvé par</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem><FormLabel>Date début</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="endDate" render={({ field }) => (<FormItem><FormLabel>Date fin</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter><Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button><Button type="submit" disabled={createMut.isPending} className="bg-cyan-600 text-white">{createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}Créer</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>

      {/* DETAIL / PLANNING */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setShowAddTask(false); }}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200">
                <CalendarCheck className="h-6 w-6 text-cyan-600" />
                <div className="flex-1"><DialogTitle>{selected.title}</DialogTitle><p className="text-xs text-slate-500 font-mono">{selected.planNumber} · {selected.fiscalYear}</p></div>
                <div className="flex gap-2">
                  {Object.keys(STATUS_CFG).map(s => (<Button key={s} variant={selected.status === s ? "default" : "outline"} size="sm" className={`text-xs ${selected.status === s ? "bg-cyan-600 text-white" : ""}`} onClick={() => updateMut.mutate({ id: selected.id, data: { status: s } })}>{STATUS_CFG[s].label}</Button>))}
                </div>
              </div>
            </DialogHeader>

            {/* Summary + chart */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
              {[
                { l: "Total tâches", v: selected.totalTasks, c: "text-slate-800" },
                { l: "Réalisées", v: selected.completedTasks, c: "text-green-700" },
                { l: "En cours", v: selected.inProgressTasks, c: "text-blue-700" },
                { l: "En retard", v: selected.overdueTasks, c: "text-red-600" },
              ].map(({ l, v, c }) => (<div key={l} className="bg-white border rounded-xl p-3 text-center"><p className={`text-2xl font-bold ${c}`}>{v}</p><p className="text-xs text-slate-500">{l}</p></div>))}
            </div>
            <div className="mb-2"><div className="flex justify-between text-sm mb-1"><span>Avancement global</span><span className="font-bold text-cyan-700">{selected.completionPct}%</span></div><Progress value={selected.completionPct} className="h-3" /></div>

            {/* Monthly chart */}
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={selected.monthlyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="planned" fill="#94a3b8" name="Planifié" radius={[2,2,0,0]} />
                <Bar dataKey="completed" fill="#22c55e" name="Réalisé" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Month filter */}
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setFilterMonth(0)} className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${filterMonth === 0 ? "bg-cyan-600 text-white border-cyan-600" : "bg-white border-slate-200"}`}>Tous</button>
              {MONTHS.map((m, i) => {
                const mNum = i + 1;
                const mData = selected.monthlyData.find(d => d.monthNum === mNum);
                return (
                  <button key={m} onClick={() => setFilterMonth(filterMonth === mNum ? 0 : mNum)} className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${filterMonth === mNum ? "bg-cyan-600 text-white border-cyan-600" : mNum === currentMonth ? "border-cyan-300 bg-cyan-50" : "bg-white border-slate-200"}`}>
                    {m} {mData && mData.planned > 0 ? <span className="opacity-70">({mData.completed}/{mData.planned})</span> : ""}
                  </button>
                );
              })}
            </div>

            {/* Tasks */}
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-700">{filterMonth > 0 ? `Tâches — ${MONTHS[filterMonth-1]}` : "Toutes les tâches"} ({displayedTasks.length})</h4>
              <Button size="sm" onClick={() => { setShowAddTask(true); setEditTaskIdx(null); taskForm.reset({ taskType: "preventive", priority: "medium", plannedMonth: filterMonth || currentMonth }); }} className="bg-cyan-600 text-white gap-2"><Plus className="h-4 w-4" />Ajouter</Button>
            </div>

            {showAddTask && (
              <div className="border-2 border-cyan-200 rounded-xl p-4 bg-cyan-50/30 space-y-3">
                <h4 className="font-semibold text-cyan-800">{editTaskIdx !== null ? "Modifier la tâche" : "Nouvelle tâche"}</h4>
                <Form {...taskForm}><form onSubmit={taskForm.handleSubmit(addTask)} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={taskForm.control} name="title" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Intitulé *</FormLabel><FormControl><Input placeholder="Ex: Remplacement filtre compresseur" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={taskForm.control} name="taskType" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{TASK_TYPES.map(t => <SelectItem key={t} value={t}>{TASK_TYPE_LABELS[t]}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={taskForm.control} name="priority" render={({ field }) => (<FormItem><FormLabel>Priorité</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="low">Faible</SelectItem><SelectItem value="medium">Moyen</SelectItem><SelectItem value="high">Élevé</SelectItem><SelectItem value="critical">Critique</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={taskForm.control} name="equipmentName" render={({ field }) => (<FormItem><FormLabel>Équipement</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={taskForm.control} name="plannedMonth" render={({ field }) => (<FormItem><FormLabel>Mois planifié *</FormLabel><Select onValueChange={v => field.onChange(Number(v))} defaultValue={String(field.value)}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={taskForm.control} name="plannedWeek" render={({ field }) => (<FormItem><FormLabel>Semaine (optionnel)</FormLabel><FormControl><Input type="number" min="1" max="53" placeholder="1–53" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={taskForm.control} name="estimatedHours" render={({ field }) => (<FormItem><FormLabel>Durée estimée (h)</FormLabel><FormControl><Input type="number" step="0.5" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={taskForm.control} name="estimatedCost" render={({ field }) => (<FormItem><FormLabel>Coût estimé (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={taskForm.control} name="assignedTo" render={({ field }) => (<FormItem><FormLabel>Assigné à</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={taskForm.control} name="frequency" render={({ field }) => (<FormItem><FormLabel>Fréquence</FormLabel><FormControl><Input placeholder="Ex: Annuel, Semestriel..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <FormField control={taskForm.control} name="spareParts" render={({ field }) => (<FormItem><FormLabel>Pièces de rechange nécessaires</FormLabel><FormControl><Input placeholder="Ex: Filtre A-001, Joint K-002" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <div className="flex gap-2"><Button type="submit" size="sm" disabled={updateMut.isPending} className="bg-cyan-600 text-white"><Save className="h-3.5 w-3.5 mr-1" />{editTaskIdx !== null ? "Mettre à jour" : "Ajouter"}</Button><Button type="button" size="sm" variant="outline" onClick={() => { setShowAddTask(false); setEditTaskIdx(null); }}>Annuler</Button></div>
                </form></Form>
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {displayedTasks.length === 0 ? <p className="text-slate-400 text-sm text-center py-6">Aucune tâche{filterMonth > 0 ? ` en ${MONTHS[filterMonth-1]}` : ""}</p>
              : displayedTasks.map((task, i) => {
                const realIdx = selected.tasks.indexOf(task);
                const ts = TASK_STATUS[task.status] || TASK_STATUS.planned;
                const isOverdue = task.status === "planned" && task.plannedDate && new Date(task.plannedDate) < new Date();
                return (
                  <div key={task.id || i} className={`flex items-center gap-3 border rounded-xl px-4 py-2.5 ${isOverdue ? "bg-red-50 border-red-200" : "bg-white"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{task.title}</span>
                        <Badge className={ts.color + " text-xs"}>{ts.label}</Badge>
                        <Badge className={`${PRIORITY_CFG[task.priority]} text-xs`}>{PRIORITY_LABELS[task.priority]}</Badge>
                        <Badge variant="outline" className="text-xs">{MONTHS[task.plannedMonth - 1]}{task.plannedWeek ? ` S${task.plannedWeek}` : ""}</Badge>
                        {task.equipmentName && <span className="text-xs text-slate-500">⚙️ {task.equipmentName}</span>}
                        {task.assignedTo && <span className="text-xs text-slate-500">👤 {task.assignedTo}</span>}
                        {task.estimatedHours && <span className="text-xs text-slate-500">⏱️ {task.estimatedHours}h</span>}
                        {task.estimatedCost && <span className="text-xs text-blue-600">{fmtEur(task.estimatedCost)}</span>}
                        {isOverdue && <Badge className="bg-red-100 text-red-700 text-xs">⚠️ Retard</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {task.status !== "completed" && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-green-700" onClick={() => setTaskStatus(realIdx, "completed")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Réalisé</Button>}
                      {task.status === "planned" && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-blue-700" onClick={() => setTaskStatus(realIdx, "in_progress")}><Clock className="h-3.5 w-3.5" /></Button>}
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => removeTask(realIdx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" size="sm" className="text-red-600 mr-auto" onClick={() => { if (confirm("Supprimer ce plan ?")) deleteMut.mutate(selected.id); }}><Trash2 className="h-4 w-4 mr-1" />Supprimer</Button>
              <Button variant="outline" onClick={() => setSelected(null)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
