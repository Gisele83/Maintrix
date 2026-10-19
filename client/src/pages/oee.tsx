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
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from "recharts";
import {
  Plus, Loader2, TrendingUp, TrendingDown, Activity, Gauge,
  CheckCircle2, AlertTriangle, Trash2, Calendar, Search, Filter
} from "lucide-react";
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, registreDepuisLibelle, type RegistreEtat } from "@/lib/etats";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OeeRecord {
  id: number;
  equipmentId: number;
  equipmentName?: string;
  recordDate: string;
  shift: string;
  plannedTime: number;
  downtime: number;
  speedLoss: number;
  plannedProduction: number;
  actualProduction: number;
  defectiveUnits: number;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  notes?: string;
  createdAt?: string;
}
interface OeeStats {
  totalRecords: number;
  avgOee: number;
  avgAvailability: number;
  avgPerformance: number;
  avgQuality: number;
  worldClassCount: number;
  criticalCount: number;
  totalProduction: number;
  totalDefects: number;
  totalDowntime: number;
  byEquipment: { equipmentId: number; equipmentName: string; avgOee: number; avgAvailability: number; avgPerformance: number; avgQuality: number; recordCount: number; }[];
  trend: { recordDate: string; avgOee: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pct = (v: number | null | undefined) => v ? Math.round(Number(v) * 100) : 0;
const oeeColor = (v: number) => v >= 0.85 ? "#22c55e" : v >= 0.65 ? "#f59e0b" : "#ef4444";
const oeeLabel = (v: number) => v >= 0.85 ? "Classe mondiale" : v >= 0.65 ? "Acceptable" : "Critique";
const oeeBg = (v: number) => v >= 0.85 ? "" : v >= 0.65 ? "" : "";
const shiftLabel: Record<string, string> = { day: "Matin", evening: "Après-midi", night: "Nuit", all: "Journée" };

// ─── Form Schema ──────────────────────────────────────────────────────────────
const CreateSchema = z.object({
  equipmentId: z.string().min(1),
  equipmentName: z.string().optional(),
  recordDate: z.string().min(1),
  shift: z.enum(["day", "evening", "night", "all"]),
  plannedTime: z.string().default("480"),
  downtime: z.string().default("0"),
  speedLoss: z.string().default("0"),
  plannedProduction: z.string().default("0"),
  actualProduction: z.string().default("0"),
  defectiveUnits: z.string().default("0"),
  notes: z.string().optional(),
});
type CreateForm = z.infer<typeof CreateSchema>;

// ─── OEE Gauge ────────────────────────────────────────────────────────────────
function OEEGauge({ value, size = 120, label }: { value: number; size?: number; label?: string }) {
  const pctVal = pct(value);
  const color = oeeColor(value);
  const radius = size / 2 - 10;
  const circumference = Math.PI * radius;
  const dash = (pctVal / 100) * circumference;
  const gap = circumference - dash;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        <path d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
        <path d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`} style={{ transition: "stroke-dasharray 0.8s ease" }} />
        <text x={size / 2} y={size / 2 + 2} textAnchor="middle" className="font-bold"
          fill={color} fontSize={size / 6} fontWeight="700">{pctVal}%</text>
        {label && <text x={size / 2} y={size / 2 + 16} textAnchor="middle" fill="#94a3b8" fontSize={size / 12}>{label}</text>}
      </svg>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function OeePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [filterEquip, setFilterEquip] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [liveCalc, setLiveCalc] = useState({ plannedTime: 480, downtime: 0, speedLoss: 0, plannedProduction: 100, actualProduction: 0, defectiveUnits: 0 });
  const [liveResult, setLiveResult] = useState<any>(null);

  const statsQKey = ["/api/oee/stats", dateFrom, dateTo];
  const { data: stats } = useQuery<OeeStats>({
    queryKey: statsQKey,
    queryFn: async () => {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      return await apiRequest(`/api/oee/stats?${params}`);
    },
  });

  const { data: records = [], isLoading } = useQuery<OeeRecord[]>({
    queryKey: ["/api/oee", dateFrom, dateTo, filterEquip],
    queryFn: async () => {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      if (filterEquip) params.set("equipmentId", filterEquip);
      return await apiRequest(`/api/oee?${params}`);
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/oee"] });
    qc.invalidateQueries({ queryKey: statsQKey });
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/oee", { method: "POST", body: data }),
    onSuccess: () => { invalidate(); setShowCreate(false); form.reset(); toast({ title: "Enregistrement OEE ajouté" }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/oee/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); toast({ title: "Enregistrement supprimé" }); },
  });

  const calcMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/oee/calculate", { method: "POST", body: data }),
    onSuccess: async (res: any) => { setLiveResult(res); },
  });

  const form = useForm<CreateForm>({
    resolver: zodResolver(CreateSchema),
    defaultValues: { shift: "day", plannedTime: "480", downtime: "0", speedLoss: "0", plannedProduction: "0", actualProduction: "0", defectiveUnits: "0" },
  });

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate({
      equipmentId: parseInt(data.equipmentId),
      equipmentName: data.equipmentName,
      recordDate: data.recordDate,
      shift: data.shift,
      plannedTime: parseFloat(data.plannedTime),
      downtime: parseFloat(data.downtime),
      speedLoss: parseFloat(data.speedLoss),
      plannedProduction: parseInt(data.plannedProduction),
      actualProduction: parseInt(data.actualProduction),
      defectiveUnits: parseInt(data.defectiveUnits),
      notes: data.notes,
    });
  };

  const trendData = (stats?.trend || []).map(t => ({
    date: new Date(t.recordDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    oee: pct(t.avgOee),
  }));

  const equipData = (stats?.byEquipment || []).map(e => ({
    name: (e.equipmentName || `Éq. ${e.equipmentId}`).slice(0, 15),
    OEE: pct(e.avgOee),
    Disponibilité: pct(e.avgAvailability),
    Performance: pct(e.avgPerformance),
    Qualité: pct(e.avgQuality),
  }));

  const avgOee = Number(stats?.avgOee || 0);

  return (
    <AppShell filAriane={[{ libelle: "Analyse" }, { libelle: "OEE" }]} largeur="large">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-none bg-paper-deep">
              <Gauge className="h-6 w-6 text-ink" />
            </div>
            <h1 className="text-3xl font-bold text-ink">
              OEE — Efficacité Globale
            </h1>
          </div>
          <p className="text-ink-mute ml-14 text-sm">Overall Equipment Effectiveness · Disponibilité × Performance × Qualité</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-ink text-white gap-2">
          <Plus className="h-4 w-4" /> Nouvelle saisie
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 bg-white rounded-lg border border-rule px-3">
          <Calendar className="h-4 w-4 text-ink-mute" />
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border-0 w-32 p-0 text-sm" />
          <span className="text-ink-mute">→</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border-0 w-32 p-0 text-sm" />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-2.5 h-4 w-4 text-ink-mute" />
          <Input placeholder="ID équipement..." value={filterEquip} onChange={e => setFilterEquip(e.target.value)} className="pl-9 w-40 bg-white" />
        </div>
      </div>

      {/* OEE Formula Banner */}
      <Card className="border-0 shadow-none mb-8 overflow-hidden">
        <div className="bg-paper-deep p-4">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className="text-center">
              <p className="text-ink-mute text-xs mb-1">OEE</p>
              <OEEGauge value={avgOee} size={100} />
              <Badge className={`mt-1 text-xs ${avgOee >= 0.85 ? "bg-etat-nominal-vif" : avgOee >= 0.65 ? "bg-etat-alerte-vif" : "bg-etat-critique-vif"} text-white`}>
                {oeeLabel(avgOee)}
              </Badge>
            </div>
            <div className="text-ink text-2xl font-light">=</div>
            {[
              { label: "Disponibilité", value: stats?.avgAvailability, color: "" },
              { label: "Performance", value: stats?.avgPerformance, color: " " },
              { label: "Qualité", value: stats?.avgQuality, color: "" },
            ].map(({ label, value, color }, i) => (
              <div key={label} className="flex items-center gap-4">
                {i > 0 && <span className="text-ink-mute text-2xl">×</span>}
                <div className="text-center">
                  <p className="text-ink-mute text-xs mb-1">{label}</p>
                  <OEEGauge value={Number(value || 0)} size={90} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Enregistrements", value: stats?.totalRecords ?? 0, icon: Activity, color: "" },
          { label: "Classe mondiale ≥85%", value: stats?.worldClassCount ?? 0, icon: CheckCircle2, color: "" },
          { label: "Critiques <65%", value: stats?.criticalCount ?? 0, icon: AlertTriangle, color: "" },
          { label: "Production totale", value: Number(stats?.totalProduction ?? 0).toLocaleString("fr-FR"), icon: TrendingUp, color: "" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-none">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-3 ${ETAT[registreDepuisLibelle(label)].fond}`}><Icon className={`h-5 w-5 ${ETAT[registreDepuisLibelle(label)].texte}`} /></div>
              <div><p className="text-2xl font-bold text-ink">{value}</p><p className="text-xs text-ink-mute">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Trend */}
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-ink-soft flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-etat-nominal-texte" /> Tendance OEE
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-ink-mute text-sm">Pas encore de données</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="oeeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v: any) => [`${v}%`, "OEE"]} />
                  <ReferenceLine y={85} stroke="#22c55e" strokeDasharray="4 2" label={{ value: "85% WC", position: "insideTopRight", fontSize: 10, fill: "#22c55e" }} />
                  <ReferenceLine y={65} stroke="#ef4444" strokeDasharray="4 2" label={{ value: "65%", position: "insideTopRight", fontSize: 10, fill: "#ef4444" }} />
                  <Area type="monotone" dataKey="oee" stroke="#10b981" fill="url(#oeeGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* By equipment */}
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-ink-soft flex items-center gap-2">
              <Activity className="h-4 w-4 text-etat-encours-texte" /> OEE par équipement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {equipData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-ink-mute text-sm">Pas encore de données</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={equipData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any, name: any) => [`${v}%`, name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="OEE" fill="#10b981" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Disponibilité" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Performance" fill="#a855f7" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Qualité" fill="#ec4899" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Calculator */}
      {/* ⚠️ Cette carte était restée en fond bleu nuit après le passage de
          l'application au thème clair, mais ses textes, eux, avaient suivi :
          titre en encre sur encre, donc invisible, et six étiquettes de champ
          en `text-ink-mute` sur `bg-ink`, mesurées à 3,05:1. Le calculateur
          OEE est l'outil même de cet écran — on ne lisait plus ce qu'on
          saisissait. La carte rejoint le fond clair des autres. */}
      <Card className="border border-rule shadow-none mb-8 bg-white">
        <CardHeader>
          <CardTitle className="font-serif text-title font-medium text-ink flex items-center gap-2">
            <Gauge className="h-4 w-4 text-ink-mute" /> Calculateur OEE en temps réel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {[
              { key: "plannedTime", label: "Temps planifié (min)", unit: "min" },
              { key: "downtime", label: "Temps d'arrêt", unit: "min" },
              { key: "speedLoss", label: "Pertes vitesse", unit: "min" },
              { key: "plannedProduction", label: "Prod. planifiée", unit: "pcs" },
              { key: "actualProduction", label: "Prod. réelle", unit: "pcs" },
              { key: "defectiveUnits", label: "Défauts", unit: "pcs" },
            ].map(({ key, label, unit }) => (
              <div key={key}>
                <label className="text-ink-soft text-xs">{label}</label>
                <Input type="number" aria-label={label} className="bg-white border-rule text-ink mt-1"
                  value={(liveCalc as any)[key]}
                  onChange={e => setLiveCalc(prev => ({ ...prev, [key]: Number(e.target.value) }))} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <Button onClick={() => calcMutation.mutate(liveCalc)} className="bg-etat-nominal-vif hover:bg-etat-nominal-vif text-white">
              {calcMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Calculer
            </Button>
            {liveResult && (
              <div className="flex gap-6 flex-wrap">
                {[
                  { label: "OEE", value: liveResult.oee, highlight: true },
                  { label: "Disponibilité", value: liveResult.availability },
                  { label: "Performance", value: liveResult.performance },
                  { label: "Qualité", value: liveResult.quality },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="text-center">
                    <p className={`font-bold ${highlight ? "text-2xl" : "text-xl"}`} style={{ color: oeeColor(value) }}>
                      {pct(value)}%
                    </p>
                    <p className="text-ink-mute text-xs">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Records table */}
      <Card className="border-0 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-ink-soft">Historique des enregistrements</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center h-24 items-center"><Loader2 className="h-6 w-6 animate-spin text-ink-mute" /></div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-ink-mute">
              <Gauge className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Aucun enregistrement — saisissez vos premières données OEE</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Date", "Équipement", "Poste", "Disponib.", "Perf.", "Qualité", "OEE", "Actions"].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-ink-mute font-medium text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 50).map(r => (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-paper transition-colors">
                      <td className="py-2 px-3 font-mono text-xs text-ink-soft">
                        {new Date(r.recordDate).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-2 px-3 text-ink-soft font-medium">
                        {r.equipmentName || `Éq. ${r.equipmentId}`}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-xs">{shiftLabel[r.shift] || r.shift}</Badge>
                      </td>
                      {[r.availability, r.performance, r.quality].map((v, i) => (
                        <td key={i} className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <Progress value={pct(v)} className="w-16 h-1.5" />
                            <span className="text-xs font-medium" style={{ color: oeeColor(v) }}>{pct(v)}%</span>
                          </div>
                        </td>
                      ))}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold" style={{ color: oeeColor(r.oee) }}>{pct(r.oee)}%</span>
                          <Badge className={`text-xs text-white bg-ink ${oeeBg(r.oee)}`}>
                            {oeeLabel(r.oee)}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <button onClick={() => { if (confirm("Supprimer ?")) deleteMutation.mutate(r.id); }}
                          className="text-etat-critique-texte hover:text-etat-critique-texte transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── CREATE DIALOG ──────────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-etat-nominal-texte" /> Nouvelle saisie OEE
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="equipmentId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID Équipement *</FormLabel>
                    <FormControl><Input placeholder="Ex: 1" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="equipmentName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom équipement</FormLabel>
                    <FormControl><Input placeholder="Ex: Compresseur K1" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="recordDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="shift" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Poste</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="day">Matin</SelectItem>
                        <SelectItem value="evening">Après-midi</SelectItem>
                        <SelectItem value="night">Nuit</SelectItem>
                        <SelectItem value="all">Journée</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <Separator2 label="Disponibilité" />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="plannedTime" render={({ field }) => (
                  <FormItem><FormLabel>Temps planifié (min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="downtime" render={({ field }) => (
                  <FormItem><FormLabel>Temps d'arrêt (min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <Separator2 label="Performance" />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="plannedProduction" render={({ field }) => (
                  <FormItem><FormLabel>Production planifiée</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="actualProduction" render={({ field }) => (
                  <FormItem><FormLabel>Production réelle</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="speedLoss" render={({ field }) => (
                  <FormItem><FormLabel>Pertes de vitesse (min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <Separator2 label="Qualité" />
              <FormField control={form.control} name="defectiveUnits" render={({ field }) => (
                <FormItem><FormLabel>Unités défectueuses</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} placeholder="Observations..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
                <Button type="submit" disabled={createMutation.isPending} className="bg-ink text-white">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Enregistrer
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
    </AppShell>
  );
}

function Separator2({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px bg-paper-deep flex-1" />
      <span className="text-xs text-ink-mute font-medium">{label}</span>
      <div className="h-px bg-paper-deep flex-1" />
    </div>
  );
}

function Separator() {
  return <div className="h-px bg-paper-deep" />;
}
