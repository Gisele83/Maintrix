import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Loader2, Search, Eye, Trash2, CheckCircle2,
  AlertTriangle, Clock, XCircle, RefreshCw, Thermometer,
  Droplets, FileText, BarChart3, FlaskConical, Calendar
} from "lucide-react";
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Measurement { point: string; nominal?: number; measured?: number; deviation?: number; unit?: string; pass?: boolean; }
interface Calibration {
  id: number; calibrationNumber: string; instrumentName: string; instrumentTag?: string;
  equipmentName?: string; instrumentType?: string; manufacturer?: string; model?: string;
  serialNumber?: string; location?: string; calibrationDate: string; nextCalibrationDate: string;
  calibrationIntervalDays: number; performedBy?: string; externalLab?: string; certificateNumber?: string;
  standardUsed?: string; method?: string; temperatureC?: number; humidityPct?: number;
  result: string; tolerancePct?: number; asFound: Measurement[]; asLeft: Measurement[];
  notes?: string; correctiveAction?: string; outOfService: boolean;
  computedStatus?: string; daysUntilDue?: number;
}
interface CalStats {
  total: number; passCount: number; failCount: number; conditionalCount: number;
  outOfService: number; overdue: number; dueSoon: number; compliant: number;
  byType: { instrument_type: string; count: number }[];
  upcoming: { instrument_name: string; instrument_tag?: string; next_calibration_date: string; result: string }[];
}

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  compliant:     { label: "Conforme",       color: "bg-etat-nominal-fond text-etat-nominal-texte border-etat-nominal-filet",  icon: CheckCircle2 },
  due_soon:      { label: "Bientôt échu",   color: "bg-etat-alerte-fond text-etat-alerte-texte border-etat-alerte-filet", icon: Clock },
  overdue:       { label: "En retard",      color: "bg-etat-critique-fond text-etat-critique-texte border-etat-critique-filet",         icon: AlertTriangle },
  non_compliant: { label: "Non conforme",   color: "bg-etat-alerte-fond text-etat-alerte-texte border-etat-alerte-filet", icon: XCircle },
  out_of_service:{ label: "Hors service",   color: "bg-paper-deep text-ink-soft border-rule",      icon: XCircle },
};
const RESULT_CONFIG: Record<string, { label: string; color: string }> = {
  pass:        { label: "Réussi",       color: "bg-etat-nominal-fond text-etat-nominal-texte" },
  fail:        { label: "Échec",        color: "bg-etat-critique-fond text-etat-critique-texte" },
  conditional: { label: "Conditionnel", color: "bg-etat-alerte-fond text-etat-alerte-texte" },
};
const INSTRUMENT_TYPES = ["Manomètre", "Thermomètre", "Débitmètre", "Capteur de pression", "Capteur de température",
  "Analyseur", "Balance", "Voltmètre", "Ampèremètre", "pH-mètre", "Hygromètre", "Tachymètre", "Oscilloscope", "Autre"];

// ─── Schemas ──────────────────────────────────────────────────────────────────
const CreateSchema = z.object({
  instrumentName: z.string().min(2),
  instrumentTag: z.string().optional(),
  equipmentName: z.string().optional(),
  instrumentType: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  location: z.string().optional(),
  calibrationDate: z.string().min(1),
  nextCalibrationDate: z.string().min(1),
  calibrationIntervalDays: z.coerce.number().int().default(365),
  performedBy: z.string().optional(),
  externalLab: z.string().optional(),
  certificateNumber: z.string().optional(),
  standardUsed: z.string().optional(),
  method: z.string().optional(),
  temperatureC: z.coerce.number().optional(),
  humidityPct: z.coerce.number().optional(),
  result: z.enum(["pass", "fail", "conditional"]).default("pass"),
  tolerancePct: z.coerce.number().optional(),
  notes: z.string().optional(),
  correctiveAction: z.string().optional(),
  outOfService: z.boolean().default(false),
});
type CreateForm = z.infer<typeof CreateSchema>;

// ─── Status helper ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string }) {
  const conf = STATUS_CONFIG[status || "compliant"] || STATUS_CONFIG.compliant;
  const Icon = conf.icon;
  return (
    <Badge className={`gap-1 ${conf.color} border`}>
      <Icon className="h-3 w-3" />{conf.label}
    </Badge>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CalibrationPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterResult, setFilterResult] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Calibration | null>(null);
  const [showRenew, setShowRenew] = useState(false);

  const { data: cals = [], isLoading } = useQuery<Calibration[]>({ queryKey: ["/api/calibrations"] });
  const { data: stats } = useQuery<CalStats>({ queryKey: ["/api/calibrations/stats"] });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["/api/calibrations"] }); qc.invalidateQueries({ queryKey: ["/api/calibrations/stats"] }); };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/calibrations", { method: "POST", body: data }),
    onSuccess: () => { invalidate(); setShowCreate(false); form.reset(); toast({ title: "Calibration créée" }); },
    onError: () => toast({ title: "Erreur création", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest(`/api/calibrations/${id}`, { method: "PATCH", body: data }),
    onSuccess: async (res: any) => {
      invalidate(); setSelected(res);
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/calibrations/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); setSelected(null); toast({ title: "Calibration supprimée" }); },
  });

  const renewMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest(`/api/calibrations/${id}/renew`, { method: "POST", body: data }),
    onSuccess: async (res: any) => {
      invalidate(); setSelected(res); setShowRenew(false);
      toast({ title: "Renouvellement enregistré" });
    },
    onError: () => toast({ title: "Erreur renouvellement", variant: "destructive" }),
  });

  const form = useForm<CreateForm>({
    resolver: zodResolver(CreateSchema),
    defaultValues: {
      calibrationDate: new Date().toISOString().split("T")[0],
      nextCalibrationDate: new Date(Date.now() + 365 * 86400 * 1000).toISOString().split("T")[0],
      calibrationIntervalDays: 365, result: "pass", outOfService: false,
    },
  });

  const openDetail = async (cal: Calibration) => {
    try {
      const res = await apiRequest(`/api/calibrations/${cal.id}`);
      setSelected(res);
    } catch { setSelected(cal); }
  };

  const filtered = cals.filter(c => {
    const s = search.toLowerCase();
    return (!s || c.instrumentName.toLowerCase().includes(s) || (c.instrumentTag || "").toLowerCase().includes(s) || (c.calibrationNumber || "").toLowerCase().includes(s)) &&
      (filterStatus === "all" || c.computedStatus === filterStatus) &&
      (filterResult === "all" || c.result === filterResult);
  });

  const today = new Date().toISOString().split("T")[0];

  return (
    <AppShell filAriane={[{ libelle: "Conformité" }, { libelle: "Étalonnages" }]} largeur="large">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-none bg-paper-deep">
              <FlaskConical className="h-6 w-6 text-ink" />
            </div>
            <h1 className="text-3xl font-bold text-ink">Gestion des Calibrations</h1>
          </div>
          <p className="text-ink-mute ml-14 text-sm">Étalonnage et traçabilité des instruments de mesure · ISO 9001 / ISO 17025</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-ink text-white gap-2">
          <Plus className="h-4 w-4" /> Nouvelle calibration
        </Button>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ÉTAT DU PARC D'INSTRUMENTS
          ══════════════════════════════════════════════════════════
          Ces quatre tuiles portaient chacune un fragment de dégradé —
          `from-red-500 to-rose-600`, `from-green-500 to-teal-600` — resté
          sans le `bg-gradient-to-*` qui l'aurait activé. Aucun fond n'était
          donc posé, et une correction de secours leur avait donné à toutes
          le MÊME `bg-paper-deep` : « En retard » ne se distinguait plus de
          « Conformes ». Le retrait des dégradés avait supprimé
          l'information d'état au lieu de la reporter sur un aplat.
          Chaque tuile retrouve son registre, et le liseré ne s'allume que
          lorsqu'il y a quelque chose à faire. */}
      <div className="mb-6">
        <RangeeIndicateurs>
          <Indicateur
            libelle="En retard"
            valeur={stats?.overdue ?? 0}
            precision={(stats?.overdue ?? 0) > 0 ? "étalonnages dépassés" : "aucun étalonnage dépassé"}
            icone={AlertTriangle}
            alerte={(stats?.overdue ?? 0) > 0}
          />
          <Indicateur
            libelle="Échéance sous 30 jours"
            valeur={stats?.dueSoon ?? 0}
            precision={(stats?.dueSoon ?? 0) > 0 ? "à planifier" : "aucune échéance proche"}
            icone={Clock}
            alerte={(stats?.dueSoon ?? 0) > 0}
          />
          <Indicateur
            libelle="Conformes"
            valeur={stats?.compliant ?? 0}
            precision={(stats?.compliant ?? 0) > 0 ? "instruments à jour" : "aucun instrument à jour"}
            icone={CheckCircle2}
          />
          <Indicateur
            libelle="Hors service"
            valeur={stats?.outOfService ?? 0}
            precision={(stats?.outOfService ?? 0) > 0 ? "retirés de l'exploitation" : "aucun retrait"}
            icone={XCircle}
          />
        </RangeeIndicateurs>
      </div>

      {/* Upcoming */}
      {stats?.upcoming && stats.upcoming.length > 0 && (
        <div className="mb-6 bg-etat-alerte-fond border border-etat-alerte-filet rounded-none p-4">
          <h3 className="font-semibold text-etat-alerte-texte mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Prochaines calibrations (90 jours)
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.upcoming.map((u, i) => (
              <div key={i} className="bg-white rounded-lg border border-etat-alerte-filet px-3 py-1.5 text-sm">
                <span className="font-medium">{u.instrument_name}</span>
                {u.instrument_tag && <span className="text-ink-mute ml-1">({u.instrument_tag})</span>}
                <span className="text-etat-alerte-texte ml-2 text-xs">{new Date(u.next_calibration_date).toLocaleDateString("fr-FR")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-mute" />
          <Input placeholder="Rechercher un instrument..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterResult} onValueChange={setFilterResult}>
          <SelectTrigger className="w-40 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous résultats</SelectItem>
            {Object.entries(RESULT_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center h-48 items-center"><Loader2 className="h-8 w-8 animate-spin text-ink-mute" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FlaskConical className="h-12 w-12 text-ink-soft mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-ink-soft mb-1">Aucun instrument enregistré</h3>
          <Button onClick={() => setShowCreate(true)} className="bg-ink text-white gap-2 mt-4">
            <Plus className="h-4 w-4" /> Enregistrer le premier instrument
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(cal => {
            const statusConf = STATUS_CONFIG[cal.computedStatus || "compliant"];
            const StatusIcon = statusConf.icon;
            const overdue = (cal.daysUntilDue || 0) < 0;
            return (
              <Card key={cal.id} className={`border shadow-sm hover:shadow-none transition-all ${overdue ? "border-etat-critique-filet bg-etat-critique-fond/30" : "border-slate-100"}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`p-2.5 rounded-none shadow-sm ${overdue ? "bg-etat-critique-fond" : "bg-etat-encours-fond"}`}>
                        <FlaskConical className={`h-5 w-5 ${overdue ? "text-etat-critique-texte" : "text-etat-encours-texte"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-xs font-mono text-ink-mute">{cal.calibrationNumber}</span>
                          <StatusBadge status={cal.computedStatus} />
                          <Badge className={`${RESULT_CONFIG[cal.result]?.color} text-xs`}>{RESULT_CONFIG[cal.result]?.label}</Badge>
                          {cal.outOfService && <Badge className="bg-paper-deep text-ink-soft text-xs">Hors service</Badge>}
                        </div>
                        <h3 className="font-semibold text-ink truncate">{cal.instrumentName}</h3>
                        <div className="flex items-center gap-4 text-xs text-ink-mute mt-0.5 flex-wrap">
                          {cal.instrumentTag && <span className="font-mono">{cal.instrumentTag}</span>}
                          {cal.instrumentType && <span>{cal.instrumentType}</span>}
                          {cal.location && <span>{cal.location}</span>}
                          <span className={`font-medium ${overdue ? "text-etat-critique-texte" : "text-ink-soft"}`}>
                            Prochaine: {new Date(cal.nextCalibrationDate).toLocaleDateString("fr-FR")}
                            {cal.daysUntilDue !== undefined && (
                              <span className="ml-1">({overdue ? `${Math.abs(cal.daysUntilDue)}j retard` : `dans ${cal.daysUntilDue}j`})</span>
                            )}
                          </span>
                          {cal.performedBy && <span>{cal.performedBy}</span>}
                          {cal.certificateNumber && <span>{cal.certificateNumber}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(cal)}><Eye className="h-4 w-4 mr-1" />Détail</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── CREATE ─────────────────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-etat-encours-texte" /> Nouvelle calibration</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="instrumentName" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Nom de l'instrument *</FormLabel><FormControl><Input placeholder="Ex: Manomètre ligne haute pression" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="instrumentTag" render={({ field }) => (
                  <FormItem><FormLabel>Tag instrument</FormLabel><FormControl><Input placeholder="Ex: MAN-001" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="instrumentType" render={({ field }) => (
                  <FormItem><FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                      <SelectContent>{INSTRUMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="manufacturer" render={({ field }) => (
                  <FormItem><FormLabel>Fabricant</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="model" render={({ field }) => (
                  <FormItem><FormLabel>Modèle</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="serialNumber" render={({ field }) => (
                  <FormItem><FormLabel>N° de série</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem><FormLabel>Localisation</FormLabel><FormControl><Input placeholder="Ex: Atelier B" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="calibrationDate" render={({ field }) => (
                  <FormItem><FormLabel>Date de calibration *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="nextCalibrationDate" render={({ field }) => (
                  <FormItem><FormLabel>Prochaine calibration *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="calibrationIntervalDays" render={({ field }) => (
                  <FormItem><FormLabel>Intervalle (jours)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="performedBy" render={({ field }) => (
                  <FormItem><FormLabel>Réalisé par</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="externalLab" render={({ field }) => (
                  <FormItem><FormLabel>Laboratoire externe</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="certificateNumber" render={({ field }) => (
                  <FormItem><FormLabel>N° de certificat</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="result" render={({ field }) => (
                  <FormItem><FormLabel>Résultat *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="pass">Réussi</SelectItem>
                        <SelectItem value="fail">Échec</SelectItem>
                        <SelectItem value="conditional">Conditionnel</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="tolerancePct" render={({ field }) => (
                  <FormItem><FormLabel>Tolérance (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="temperatureC" render={({ field }) => (
                  <FormItem><FormLabel>Température (°C)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="humidityPct" render={({ field }) => (
                  <FormItem><FormLabel>Humidité (%)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="standardUsed" render={({ field }) => (
                  <FormItem><FormLabel>Étalon utilisé</FormLabel><FormControl><Input placeholder="Ex: BIPM Ref.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Observations</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="correctiveAction" render={({ field }) => (
                <FormItem><FormLabel>Action corrective</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="outOfService" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="!mt-0">Instrument hors service</FormLabel>
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
                <Button type="submit" disabled={createMutation.isPending} className="bg-ink text-white">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}Créer
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── DETAIL ─────────────────────────────────────────────────────────── */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 p-4 rounded-none bg-paper-deep border border-etat-encours-filet">
                <FlaskConical className="h-6 w-6 text-etat-encours-texte" />
                <div className="flex-1">
                  <DialogTitle>{selected.instrumentName}</DialogTitle>
                  <p className="text-xs text-ink-mute font-mono">{selected.calibrationNumber}{selected.instrumentTag ? ` · ${selected.instrumentTag}` : ""}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <StatusBadge status={selected.computedStatus} />
                  <Badge className={RESULT_CONFIG[selected.result]?.color}>{RESULT_CONFIG[selected.result]?.label}</Badge>
                </div>
              </div>
            </DialogHeader>

            <Tabs defaultValue="info">
              <TabsList className="w-full">
                <TabsTrigger value="info" className="flex-1">Informations</TabsTrigger>
                <TabsTrigger value="mesures" className="flex-1">Mesures</TabsTrigger>
                <TabsTrigger value="conditions" className="flex-1">Conditions</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  {[
                    { l: "Type", v: selected.instrumentType },
                    { l: "Fabricant", v: selected.manufacturer },
                    { l: "Modèle", v: selected.model },
                    { l: "N° de série", v: selected.serialNumber },
                    { l: "Localisation", v: selected.location },
                    { l: "Réalisé par", v: selected.performedBy },
                    { l: "Laboratoire", v: selected.externalLab },
                    { l: "N° certificat", v: selected.certificateNumber },
                    { l: "Étalon utilisé", v: selected.standardUsed },
                    { l: "Méthode", v: selected.method },
                    { l: "Tolérance", v: selected.tolerancePct ? `${selected.tolerancePct}%` : null },
                    { l: "Intervalle", v: `${selected.calibrationIntervalDays} jours` },
                  ].filter(i => i.v).map(({ l, v }) => (
                    <div key={l}><p className="text-xs text-ink-mute">{l}</p><p className="font-medium text-sm">{v}</p></div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-paper rounded-lg p-3">
                    <p className="text-xs text-ink-mute">Date de calibration</p>
                    <p className="font-semibold">{new Date(selected.calibrationDate).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${(selected.daysUntilDue || 0) < 0 ? "bg-etat-critique-fond" : (selected.daysUntilDue || 0) <= 30 ? "bg-etat-alerte-fond" : "bg-etat-nominal-fond"}`}>
                    <p className="text-xs text-ink-mute">Prochaine calibration</p>
                    <p className="font-semibold">{new Date(selected.nextCalibrationDate).toLocaleDateString("fr-FR")}</p>
                    {selected.daysUntilDue !== undefined && (
                      <p className="text-xs font-medium mt-0.5" style={{ color: (selected.daysUntilDue < 0) ? "#ef4444" : "#16a34a" }}>
                        {selected.daysUntilDue < 0 ? `${Math.abs(selected.daysUntilDue)} jours de retard` : `dans ${selected.daysUntilDue} jours`}
                      </p>
                    )}
                  </div>
                </div>
                {selected.notes && <div className="bg-paper rounded-lg p-3 text-sm"><p className="text-xs text-ink-mute mb-1">Observations</p>{selected.notes}</div>}
                {selected.correctiveAction && <div className="bg-etat-alerte-fond border border-etat-alerte-filet rounded-lg p-3 text-sm"><p className="text-xs text-etat-alerte-texte mb-1 font-medium">Action corrective</p>{selected.correctiveAction}</div>}
                <div className="flex items-center gap-3">
                  <Switch checked={selected.outOfService} onCheckedChange={v => updateMutation.mutate({ id: selected.id, data: { outOfService: v } })} />
                  <span className="text-sm">Instrument hors service</span>
                </div>

                {/* Quick status update */}
                <div>
                  <p className="text-sm font-medium text-ink-soft mb-2">Résultat</p>
                  <div className="flex gap-2">
                    {Object.entries(RESULT_CONFIG).map(([v, c]) => (
                      <Button key={v} variant={selected.result === v ? "default" : "outline"} size="sm"
                        className={selected.result === v ? "bg-etat-encours-vif text-white" : ""}
                        onClick={() => updateMutation.mutate({ id: selected.id, data: { result: v } })}>
                        {c.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="mesures" className="space-y-4 mt-4">
                {[
                  { key: "asFound", label: "Mesures avant calibration (As Found)", color: "border-etat-alerte-filet bg-etat-alerte-fond" },
                  { key: "asLeft", label: "Mesures après calibration (As Left)", color: "border-etat-nominal-filet bg-etat-nominal-fond" },
                ].map(({ key, label, color }) => {
                  const measurements: Measurement[] = (selected as any)[key] || [];
                  return (
                    <div key={key}>
                      <h4 className={`text-sm font-semibold text-ink-soft mb-2 p-2 rounded-lg border ${color}`}>{label}</h4>
                      {measurements.length === 0 ? (
                        <p className="text-xs text-ink-mute text-center py-4">Aucune mesure enregistrée</p>
                      ) : (
                        <table className="w-full text-sm border border-rule rounded-lg overflow-hidden">
                          <thead><tr className="bg-paper">{["Point", "Nominal", "Mesuré", "Écart", "Unité", "Résultat"].map(h => <th key={h} className="py-2 px-3 text-left text-xs font-semibold text-ink-soft">{h}</th>)}</tr></thead>
                          <tbody>
                            {measurements.map((m, i) => (
                              <tr key={i} className="border-t">
                                <td className="py-1.5 px-3 text-xs">{m.point}</td>
                                <td className="py-1.5 px-3 text-xs">{m.nominal ?? "—"}</td>
                                <td className="py-1.5 px-3 text-xs font-medium">{m.measured ?? "—"}</td>
                                <td className="py-1.5 px-3 text-xs" style={{ color: m.deviation && Math.abs(m.deviation) > 0 ? (m.pass ? "#16a34a" : "#ef4444") : undefined }}>
                                  {m.deviation != null ? (m.deviation > 0 ? "+" : "") + m.deviation : "—"}
                                </td>
                                <td className="py-1.5 px-3 text-xs text-ink-mute">{m.unit || "—"}</td>
                                <td className="py-1.5 px-3">
                                  {m.pass != null && <Badge className={m.pass ? "bg-etat-nominal-fond text-etat-nominal-texte text-xs" : "bg-etat-critique-fond text-etat-critique-texte text-xs"}>{m.pass ? "Conforme" : "Hors tolérance"}</Badge>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="conditions" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  {selected.temperatureC != null && (
                    <div className="flex items-center gap-3 bg-etat-encours-fond rounded-none p-4 border border-etat-encours-filet">
                      <Thermometer className="h-8 w-8 text-etat-encours-texte" />
                      <div><p className="text-xs text-etat-encours-texte">Température ambiante</p><p className="text-2xl font-bold text-etat-encours-texte">{selected.temperatureC} °C</p></div>
                    </div>
                  )}
                  {selected.humidityPct != null && (
                    <div className="flex items-center gap-3 bg-etat-encours-fond rounded-none p-4 border border-etat-encours-filet">
                      <Droplets className="h-8 w-8 text-etat-encours-texte" />
                      <div><p className="text-xs text-etat-encours-texte">Humidité relative</p><p className="text-2xl font-bold text-etat-encours-texte">{selected.humidityPct} %</p></div>
                    </div>
                  )}
                  {selected.standardUsed && (
                    <div className="col-span-2 bg-paper rounded-none p-4 border">
                      <p className="text-xs text-ink-mute mb-1">Étalon de référence utilisé</p>
                      <p className="font-medium">{selected.standardUsed}</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2">
              <Button variant="ghost" size="sm" className="text-etat-critique-texte mr-auto" onClick={() => { if (confirm("Supprimer cette calibration ?")) deleteMutation.mutate(selected.id); }}>
                <Trash2 className="h-4 w-4 mr-1" />Supprimer
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowRenew(true)} className="gap-2">
                <RefreshCw className="h-4 w-4" />Renouveler
              </Button>
              <Button variant="outline" onClick={() => setSelected(null)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Renew dialog */}
      {showRenew && selected && (
        <Dialog open={showRenew} onOpenChange={setShowRenew}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-etat-encours-texte" />Renouveler la calibration</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div><label className="text-sm font-medium">Date de calibration *</label><Input type="date" className="mt-1" id="ren-date" defaultValue={today} /></div>
              <div><label className="text-sm font-medium">Prochaine calibration *</label><Input type="date" className="mt-1" id="ren-next" /></div>
              <div><label className="text-sm font-medium">N° de certificat</label><Input className="mt-1" id="ren-cert" /></div>
              <div><label className="text-sm font-medium">Résultat</label>
                <Select defaultValue="pass">
                  <SelectTrigger className="mt-1" id="ren-result"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="pass">Réussi</SelectItem><SelectItem value="fail">Échec</SelectItem><SelectItem value="conditional">Conditionnel</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRenew(false)}>Annuler</Button>
              <Button disabled={renewMutation.isPending} className="bg-etat-encours-vif text-white" onClick={() => {
                const d = (document.getElementById("ren-date") as HTMLInputElement)?.value;
                const n = (document.getElementById("ren-next") as HTMLInputElement)?.value;
                const c = (document.getElementById("ren-cert") as HTMLInputElement)?.value;
                if (!d || !n) { toast({ title: "Renseignez les dates", variant: "destructive" }); return; }
                renewMutation.mutate({ id: selected.id, data: { calibrationDate: d, nextCalibrationDate: n, certificateNumber: c || undefined, result: "pass" } });
              }}>
                {renewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}Confirmer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
    </AppShell>
  );
}
