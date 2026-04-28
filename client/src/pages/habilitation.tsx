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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Plus, Loader2, Search, Eye, Trash2, RefreshCw,
  UserCheck, AlertTriangle, Clock, CheckCircle2, XCircle,
  Award, Zap, Shield, HardHat, Flame, Building2
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface RenewalRecord { date: string; previousExpiry?: string; issueDate: string; expiryDate?: string; certificateNumber?: string; notes?: string; }
interface Habilitation {
  id: number; habilitationNumber: string; technicianName: string; technicianEmail?: string;
  department?: string; habilitationType: string; category?: string; level?: string; title: string;
  issuingBody?: string; certificateNumber?: string; issueDate: string; expiryDate?: string;
  isPermanent: boolean; renewalAlertDays: number; trainingDurationHours?: number;
  trainingLocation?: string; assessor?: string; scope?: string; restrictions?: string;
  computedStatus?: string; daysUntilExpiry?: number | null;
  renewalHistory: RenewalRecord[];
}
interface HabStats {
  total: number; totalTechnicians: number; permanentCount: number;
  expiredCount: number; expiring60d: number; expiring30d: number;
  byType: { habilitation_type: string; count: number }[];
  byTech: { technician_name: string; count: number }[];
  expiringSoon: { technician_name: string; title: string; habilitation_type: string; expiry_date: string }[];
}

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; icon: any }> = {
  valid:         { label: "Valide",             color: "bg-green-100 text-green-700 border-green-200",  icon: CheckCircle2 },
  expiring_soon: { label: "Expire bientôt",     color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  expired:       { label: "Expirée",            color: "bg-red-100 text-red-700 border-red-200",        icon: XCircle },
};

const HAB_TYPES = [
  { value: "Électrique B/BR/H", label: "Électrique B/BR/H", icon: Zap },
  { value: "Électrique BC/BE/HE", label: "Électrique BC/BE/HE", icon: Zap },
  { value: "ATEX/Zone ATEX", label: "ATEX / Zone explosible", icon: Flame },
  { value: "Travaux en hauteur", label: "Travaux en hauteur", icon: Building2 },
  { value: "Espaces confinés", label: "Espaces confinés", icon: Shield },
  { value: "Conduite d'engins", label: "Conduite d'engins", icon: HardHat },
  { value: "CACES R482 (Engins)", label: "CACES R482 (Engins de chantier)", icon: HardHat },
  { value: "CACES R489 (Chariots)", label: "CACES R489 (Chariots élévateurs)", icon: HardHat },
  { value: "CACES R484 (Ponts roulants)", label: "CACES R484 (Ponts roulants)", icon: HardHat },
  { value: "Travaux sous tension", label: "Travaux sous tension", icon: Zap },
  { value: "Soudage", label: "Qualification soudeur", icon: Flame },
  { value: "Gaz dangereux", label: "Gaz dangereux", icon: Shield },
  { value: "Radioprotection", label: "Radioprotection", icon: Shield },
  { value: "SST / Sauveteur secouriste", label: "SST / Sauveteur secouriste", icon: Award },
  { value: "ISO 9001", label: "Auditeur ISO 9001", icon: Award },
  { value: "Autre", label: "Autre", icon: Award },
];

// ─── Schemas ──────────────────────────────────────────────────────────────────
const CreateSchema = z.object({
  technicianName: z.string().min(2),
  technicianEmail: z.string().optional(),
  department: z.string().optional(),
  habilitationType: z.string().min(1),
  category: z.string().optional(),
  level: z.string().optional(),
  title: z.string().min(3),
  issuingBody: z.string().optional(),
  certificateNumber: z.string().optional(),
  issueDate: z.string().min(1),
  expiryDate: z.string().optional(),
  isPermanent: z.boolean().default(false),
  renewalAlertDays: z.coerce.number().int().default(60),
  trainingDurationHours: z.coerce.number().optional(),
  trainingLocation: z.string().optional(),
  assessor: z.string().optional(),
  scope: z.string().optional(),
  restrictions: z.string().optional(),
});
type CreateForm = z.infer<typeof CreateSchema>;

const RenewSchema = z.object({
  issueDate: z.string().min(1),
  expiryDate: z.string().optional(),
  certificateNumber: z.string().optional(),
  issuingBody: z.string().optional(),
  assessor: z.string().optional(),
  notes: z.string().optional(),
});
type RenewForm = z.infer<typeof RenewSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string }) {
  const conf = STATUS_CFG[status || "valid"] || STATUS_CFG.valid;
  const Icon = conf.icon;
  return <Badge className={`gap-1 border ${conf.color}`}><Icon className="h-3 w-3" />{conf.label}</Badge>;
}

function DaysProgress({ days, alertDays }: { days: number | null | undefined; alertDays: number }) {
  if (days == null) return null;
  const pct = days < 0 ? 0 : Math.min(100, (days / (alertDays * 3)) * 100);
  return (
    <div className="flex items-center gap-2">
      <Progress value={pct} className="h-1.5 flex-1 max-w-24" />
      <span className={`text-xs font-medium ${days < 0 ? "text-red-600" : days <= alertDays ? "text-yellow-600" : "text-green-600"}`}>
        {days < 0 ? `${Math.abs(days)}j expirée` : `${days}j restants`}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function HabilitationPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [groupByTech, setGroupByTech] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Habilitation | null>(null);
  const [showRenew, setShowRenew] = useState(false);

  const { data: habs = [], isLoading } = useQuery<Habilitation[]>({ queryKey: ["/api/habilitations"] });
  const { data: stats } = useQuery<HabStats>({ queryKey: ["/api/habilitations/stats"] });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["/api/habilitations"] }); qc.invalidateQueries({ queryKey: ["/api/habilitations/stats"] }); };

  const createMutation = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/habilitations", d),
    onSuccess: () => { invalidate(); setShowCreate(false); form.reset(); toast({ title: "Habilitation créée" }); },
    onError: () => toast({ title: "Erreur création", variant: "destructive" }),
  });

  const renewMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("POST", `/api/habilitations/${id}/renew`, data),
    onSuccess: async (res: any) => {
      invalidate(); const d = await res.json(); setSelected(d); setShowRenew(false);
      toast({ title: "Habilitation renouvelée" });
    },
    onError: () => toast({ title: "Erreur renouvellement", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/habilitations/${id}`),
    onSuccess: () => { invalidate(); setSelected(null); toast({ title: "Habilitation supprimée" }); },
  });

  const form = useForm<CreateForm>({
    resolver: zodResolver(CreateSchema),
    defaultValues: { issueDate: new Date().toISOString().split("T")[0], isPermanent: false, renewalAlertDays: 60 },
  });
  const renewForm = useForm<RenewForm>({
    resolver: zodResolver(RenewSchema),
    defaultValues: { issueDate: new Date().toISOString().split("T")[0] },
  });

  const isPermanentWatch = form.watch("isPermanent");

  const openDetail = async (h: Habilitation) => {
    try { const res = await apiRequest("GET", `/api/habilitations/${h.id}`); setSelected(await (res as any).json()); }
    catch { setSelected(h); }
  };

  const filtered = habs.filter(h => {
    const s = search.toLowerCase();
    return (!s || h.technicianName.toLowerCase().includes(s) || h.title.toLowerCase().includes(s) || (h.habilitationType || "").toLowerCase().includes(s)) &&
      (filterStatus === "all" || h.computedStatus === filterStatus) &&
      (filterType === "all" || h.habilitationType === filterType);
  });

  // Group by technician
  const grouped: Record<string, Habilitation[]> = {};
  if (groupByTech) {
    filtered.forEach(h => { if (!grouped[h.technicianName]) grouped[h.technicianName] = []; grouped[h.technicianName].push(h); });
  }

  const habTypes = [...new Set(habs.map(h => h.habilitationType))].sort();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-purple-50/10 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg">
              <UserCheck className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Habilitations Techniciens</h1>
          </div>
          <p className="text-slate-500 ml-14 text-sm">Certifications, qualifications et compétences réglementaires</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg gap-2">
          <Plus className="h-4 w-4" /> Nouvelle habilitation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Habilitations", value: stats?.total ?? 0, icon: Award, color: "from-indigo-500 to-purple-600" },
          { label: "Techniciens", value: stats?.totalTechnicians ?? 0, icon: UserCheck, color: "from-blue-500 to-indigo-600" },
          { label: "Expirent ≤ 30j", value: stats?.expiring30d ?? 0, icon: Clock, color: "from-yellow-500 to-orange-500" },
          { label: "Expirées", value: stats?.expiredCount ?? 0, icon: XCircle, color: "from-red-500 to-rose-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-md">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow`}><Icon className="h-5 w-5 text-white" /></div>
              <div><p className="text-2xl font-bold text-slate-800">{value}</p><p className="text-xs text-slate-500">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alert: expiring soon */}
      {stats?.expiringSoon && stats.expiringSoon.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Habilitations expirant dans les 60 jours
          </h3>
          <div className="space-y-2">
            {stats.expiringSoon.map((e, i) => (
              <div key={i} className="flex items-center gap-3 bg-white rounded-lg border border-amber-200 px-3 py-2">
                <UserCheck className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="font-medium text-sm">{e.technician_name}</span>
                <span className="text-slate-500 text-sm flex-1">{e.title}</span>
                <Badge variant="outline" className="text-xs">{e.habilitation_type}</Badge>
                <span className="text-amber-700 font-medium text-sm">{new Date(e.expiry_date).toLocaleDateString("fr-FR")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Rechercher technicien, habilitation..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {Object.entries(STATUS_CFG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-52 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            {habTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={groupByTech ? "default" : "outline"} size="sm" onClick={() => setGroupByTech(v => !v)} className="gap-2">
          <UserCheck className="h-4 w-4" />{groupByTech ? "Par technicien" : "Grouper par technicien"}
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center h-48 items-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <UserCheck className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-1">Aucune habilitation enregistrée</h3>
          <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white gap-2 mt-4">
            <Plus className="h-4 w-4" /> Créer la première habilitation
          </Button>
        </div>
      ) : groupByTech ? (
        // Grouped view
        <div className="space-y-4">
          {Object.entries(grouped).map(([tech, techHabs]) => {
            const expired = techHabs.filter(h => h.computedStatus === "expired").length;
            const expiring = techHabs.filter(h => h.computedStatus === "expiring_soon").length;
            return (
              <Card key={tech} className="border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 p-4 border-b bg-slate-50 rounded-t-xl">
                  <div className="p-2 rounded-lg bg-indigo-100"><UserCheck className="h-4 w-4 text-indigo-600" /></div>
                  <h3 className="font-semibold text-slate-800">{tech}</h3>
                  {techHabs[0]?.department && <Badge variant="outline" className="text-xs">{techHabs[0].department}</Badge>}
                  <span className="text-xs text-slate-500 ml-auto">{techHabs.length} habilitation{techHabs.length > 1 ? "s" : ""}</span>
                  {expired > 0 && <Badge className="bg-red-100 text-red-700 text-xs">⚠️ {expired} expirée{expired > 1 ? "s" : ""}</Badge>}
                  {expiring > 0 && <Badge className="bg-yellow-100 text-yellow-700 text-xs">⏰ {expiring} bientôt</Badge>}
                </div>
                <div className="divide-y">
                  {techHabs.map(h => (
                    <div key={h.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="font-medium text-sm">{h.title}</span>
                            <Badge variant="outline" className="text-xs">{h.habilitationType}</Badge>
                            {h.level && <Badge className="bg-indigo-100 text-indigo-700 text-xs">{h.level}</Badge>}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <StatusBadge status={h.computedStatus} />
                            {h.isPermanent ? <Badge className="bg-blue-100 text-blue-700 text-xs">Permanent</Badge> :
                              h.expiryDate ? <DaysProgress days={h.daysUntilExpiry} alertDays={h.renewalAlertDays} /> : null}
                            {h.certificateNumber && <span className="text-xs text-slate-400">{h.certificateNumber}</span>}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openDetail(h)}><Eye className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        // Flat list
        <div className="grid gap-3">
          {filtered.map(h => (
            <Card key={h.id} className={`border shadow-sm hover:shadow-md transition-all ${h.computedStatus === "expired" ? "border-red-200 bg-red-50/20" : h.computedStatus === "expiring_soon" ? "border-yellow-200" : "border-slate-100"}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2.5 rounded-xl shadow-sm shrink-0 ${h.computedStatus === "expired" ? "bg-red-100" : h.computedStatus === "expiring_soon" ? "bg-yellow-100" : "bg-indigo-50"}`}>
                      <Award className={`h-5 w-5 ${h.computedStatus === "expired" ? "text-red-600" : h.computedStatus === "expiring_soon" ? "text-yellow-600" : "text-indigo-600"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-xs font-mono text-slate-400">{h.habilitationNumber}</span>
                        <StatusBadge status={h.computedStatus} />
                        {h.isPermanent && <Badge className="bg-blue-100 text-blue-700 text-xs">Permanent</Badge>}
                      </div>
                      <h3 className="font-semibold text-slate-800">{h.title}</h3>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-slate-500">
                        <span className="font-medium text-slate-700">👤 {h.technicianName}</span>
                        {h.department && <span>🏢 {h.department}</span>}
                        <Badge variant="outline" className="text-xs">{h.habilitationType}</Badge>
                        {h.level && <Badge className="bg-indigo-100 text-indigo-700 text-xs">{h.level}</Badge>}
                        {h.issuingBody && <span>🏛️ {h.issuingBody}</span>}
                        {h.certificateNumber && <span>📋 {h.certificateNumber}</span>}
                      </div>
                      <div className="mt-1.5 flex items-center gap-4 flex-wrap text-xs">
                        <span>Délivré: {new Date(h.issueDate).toLocaleDateString("fr-FR")}</span>
                        {!h.isPermanent && h.expiryDate && (
                          <>
                            <span>Expire: {new Date(h.expiryDate).toLocaleDateString("fr-FR")}</span>
                            <DaysProgress days={h.daysUntilExpiry} alertDays={h.renewalAlertDays} />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openDetail(h)}><Eye className="h-4 w-4 mr-1" />Détail</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── CREATE ─────────────────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-indigo-600" />Nouvelle habilitation</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="technicianName" render={({ field }) => (
                  <FormItem><FormLabel>Nom du technicien *</FormLabel><FormControl><Input placeholder="Ex: Jean Martin" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="technicianEmail" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="department" render={({ field }) => (
                  <FormItem><FormLabel>Service / Département</FormLabel><FormControl><Input placeholder="Ex: Maintenance électrique" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="habilitationType" render={({ field }) => (
                  <FormItem><FormLabel>Type d'habilitation *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                      <SelectContent>{HAB_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Intitulé complet *</FormLabel><FormControl><Input placeholder="Ex: Habilitation électrique B2V - Travaux sous tension BT" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="level" render={({ field }) => (
                  <FormItem><FormLabel>Niveau / Indice</FormLabel><FormControl><Input placeholder="Ex: B2V, H1, BC..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Catégorie</FormLabel><FormControl><Input placeholder="Ex: Basse tension" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="issuingBody" render={({ field }) => (
                  <FormItem><FormLabel>Organisme délivrant</FormLabel><FormControl><Input placeholder="Ex: AFNOR, employeur..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="certificateNumber" render={({ field }) => (
                  <FormItem><FormLabel>N° de certificat</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="issueDate" render={({ field }) => (
                  <FormItem><FormLabel>Date de délivrance *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="renewalAlertDays" render={({ field }) => (
                  <FormItem><FormLabel>Alerte renouvellement (jours avant)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="isPermanent" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="!mt-0">Habilitation permanente (sans date d'expiration)</FormLabel>
                </FormItem>
              )} />

              {!isPermanentWatch && (
                <FormField control={form.control} name="expiryDate" render={({ field }) => (
                  <FormItem><FormLabel>Date d'expiration</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              )}

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="trainingDurationHours" render={({ field }) => (
                  <FormItem><FormLabel>Durée formation (heures)</FormLabel><FormControl><Input type="number" step="0.5" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="trainingLocation" render={({ field }) => (
                  <FormItem><FormLabel>Lieu de formation</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="assessor" render={({ field }) => (
                  <FormItem><FormLabel>Évaluateur / Examinateur</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="scope" render={({ field }) => (
                <FormItem><FormLabel>Périmètre / Habilitation valable pour</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="restrictions" render={({ field }) => (
                <FormItem><FormLabel>Restrictions</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
                <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
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
          <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <div className={`flex items-start gap-3 p-4 rounded-xl border ${selected.computedStatus === "expired" ? "bg-red-50 border-red-200" : selected.computedStatus === "expiring_soon" ? "bg-yellow-50 border-yellow-200" : "bg-indigo-50 border-indigo-200"}`}>
                <Award className={`h-6 w-6 mt-0.5 ${selected.computedStatus === "expired" ? "text-red-600" : selected.computedStatus === "expiring_soon" ? "text-yellow-600" : "text-indigo-600"}`} />
                <div className="flex-1">
                  <DialogTitle>{selected.title}</DialogTitle>
                  <p className="text-sm text-slate-600 mt-0.5">👤 {selected.technicianName}{selected.department ? ` · ${selected.department}` : ""}</p>
                  <p className="text-xs text-slate-400 font-mono">{selected.habilitationNumber}</p>
                </div>
                <StatusBadge status={selected.computedStatus} />
              </div>
            </DialogHeader>

            <Tabs defaultValue="info">
              <TabsList className="w-full">
                <TabsTrigger value="info" className="flex-1">Informations</TabsTrigger>
                <TabsTrigger value="validity" className="flex-1">Validité</TabsTrigger>
                <TabsTrigger value="history" className="flex-1">Historique ({selected.renewalHistory?.length || 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { l: "Type", v: selected.habilitationType },
                    { l: "Niveau", v: selected.level },
                    { l: "Catégorie", v: selected.category },
                    { l: "Organisme", v: selected.issuingBody },
                    { l: "N° Certificat", v: selected.certificateNumber },
                    { l: "Évaluateur", v: selected.assessor },
                    { l: "Durée formation", v: selected.trainingDurationHours ? `${selected.trainingDurationHours}h` : null },
                    { l: "Lieu formation", v: selected.trainingLocation },
                    { l: "Email", v: selected.technicianEmail },
                  ].filter(i => i.v).map(({ l, v }) => (
                    <div key={l}><p className="text-xs text-slate-500">{l}</p><p className="font-medium">{v}</p></div>
                  ))}
                </div>
                {selected.scope && <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">Périmètre</p><p className="text-sm">{selected.scope}</p></div>}
                {selected.restrictions && <div className="bg-orange-50 border border-orange-200 rounded-lg p-3"><p className="text-xs text-orange-600 font-medium mb-1">Restrictions</p><p className="text-sm">{selected.restrictions}</p></div>}
              </TabsContent>

              <TabsContent value="validity" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4 border">
                    <p className="text-xs text-slate-500">Date de délivrance</p>
                    <p className="text-xl font-bold text-slate-800">{new Date(selected.issueDate).toLocaleDateString("fr-FR")}</p>
                  </div>
                  {selected.isPermanent ? (
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                      <p className="text-xs text-blue-500">Validité</p>
                      <p className="text-xl font-bold text-blue-700">Permanente</p>
                    </div>
                  ) : selected.expiryDate ? (
                    <div className={`rounded-xl p-4 border ${selected.computedStatus === "expired" ? "bg-red-50 border-red-200" : selected.computedStatus === "expiring_soon" ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200"}`}>
                      <p className="text-xs text-slate-500">Date d'expiration</p>
                      <p className="text-xl font-bold">{new Date(selected.expiryDate).toLocaleDateString("fr-FR")}</p>
                      <DaysProgress days={selected.daysUntilExpiry} alertDays={selected.renewalAlertDays} />
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                  <span className="text-sm text-slate-600">Alerte renouvellement:</span>
                  <span className="font-semibold">{selected.renewalAlertDays} jours avant expiration</span>
                </div>
              </TabsContent>

              <TabsContent value="history" className="space-y-4 mt-4">
                {(selected.renewalHistory || []).length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">Aucun renouvellement enregistré</p>
                ) : (
                  <div className="space-y-3">
                    {[...(selected.renewalHistory || [])].reverse().map((r, i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <RefreshCw className="h-4 w-4 text-indigo-500" />
                          <span className="text-sm font-medium">Renouvellement du {new Date(r.date).toLocaleDateString("fr-FR")}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                          <span>Nouveau départ: {new Date(r.issueDate).toLocaleDateString("fr-FR")}</span>
                          {r.expiryDate && <span>Nouveau terme: {new Date(r.expiryDate).toLocaleDateString("fr-FR")}</span>}
                          {r.previousExpiry && <span>Ancien terme: {new Date(r.previousExpiry).toLocaleDateString("fr-FR")}</span>}
                          {r.certificateNumber && <span>Certificat: {r.certificateNumber}</span>}
                        </div>
                        {r.notes && <p className="text-xs text-slate-400 mt-1">{r.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2">
              <Button variant="ghost" size="sm" className="text-red-600 mr-auto" onClick={() => { if (confirm("Supprimer cette habilitation ?")) deleteMutation.mutate(selected.id); }}>
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

      {/* ── RENEW ──────────────────────────────────────────────────────────── */}
      {showRenew && selected && (
        <Dialog open={showRenew} onOpenChange={setShowRenew}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-indigo-600" />Renouveler l'habilitation</DialogTitle></DialogHeader>
            <p className="text-sm text-slate-500">{selected.title} — {selected.technicianName}</p>
            <Form {...renewForm}>
              <form onSubmit={renewForm.handleSubmit(d => renewMutation.mutate({ id: selected.id, data: d }))} className="space-y-3 mt-2">
                <FormField control={renewForm.control} name="issueDate" render={({ field }) => (
                  <FormItem><FormLabel>Nouvelle date de délivrance *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                {!selected.isPermanent && (
                  <FormField control={renewForm.control} name="expiryDate" render={({ field }) => (
                    <FormItem><FormLabel>Nouvelle date d'expiration</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
                <FormField control={renewForm.control} name="certificateNumber" render={({ field }) => (
                  <FormItem><FormLabel>Nouveau N° de certificat</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={renewForm.control} name="issuingBody" render={({ field }) => (
                  <FormItem><FormLabel>Organisme</FormLabel><FormControl><Input placeholder={selected.issuingBody || ""} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={renewForm.control} name="assessor" render={({ field }) => (
                  <FormItem><FormLabel>Évaluateur</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={renewForm.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowRenew(false)}>Annuler</Button>
                  <Button type="submit" disabled={renewMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {renewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}Confirmer
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
