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
import {
  Plus, Loader2, Search, Eye, Trash2, ShieldCheck,
  AlertTriangle, Clock, CheckCircle2, XCircle, FileText, DollarSign
} from "lucide-react";

interface Claim { id?: string; date: string; description: string; claimNumber?: string; status: string; amount?: number; resolution?: string; }
interface Warranty {
  id: number; warrantyNumber: string; title: string; equipmentName?: string; supplierName?: string;
  warrantyType: string; purchaseDate?: string; installationDate?: string; warrantyStart: string; warrantyEnd: string;
  extendedWarrantyEnd?: string; coverageDescription?: string; exclusions?: string; maxCoverageAmount?: number;
  deductible?: number; contactName?: string; contactEmail?: string; contactPhone?: string; contractNumber?: string;
  alertDaysBefore: number; notes?: string; claims: Claim[];
  computedStatus?: string; daysUntilExpiry?: number; openClaims?: number;
}
interface WStats { total: number; activeCount: number; expiredCount: number; expiring60d: number; totalCoverage: number; expiring: any[]; }

const STATUS_CFG: Record<string, { label: string; color: string; icon: any }> = {
  active:        { label: "Active",          color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  expiring_soon: { label: "Expire bientôt",  color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  expired:       { label: "Expirée",         color: "bg-red-100 text-red-700 border-red-200",       icon: XCircle },
};
const TYPE_CFG: Record<string, { label: string; color: string }> = {
  manufacturer: { label: "Fabricant", color: "bg-blue-100 text-blue-700" },
  extended: { label: "Étendue", color: "bg-purple-100 text-purple-700" },
  parts: { label: "Pièces", color: "bg-teal-100 text-teal-700" },
  service: { label: "Service", color: "bg-indigo-100 text-indigo-700" },
  performance: { label: "Performance", color: "bg-orange-100 text-orange-700" },
};
const CLAIM_STATUS: Record<string, string> = { open:"bg-blue-100 text-blue-700", in_progress:"bg-yellow-100 text-yellow-700", approved:"bg-green-100 text-green-700", rejected:"bg-red-100 text-red-700", closed:"bg-slate-100 text-slate-500" };
const CLAIM_LABEL: Record<string, string> = { open:"Ouvert", in_progress:"En cours", approved:"Approuvé", rejected:"Rejeté", closed:"Clôturé" };
const fmtEur = (n: any) => n != null ? `${Number(n).toLocaleString("fr-FR",{maximumFractionDigits:0})} €` : "—";

const CreateSchema = z.object({
  title: z.string().min(3),
  equipmentName: z.string().optional(),
  supplierName: z.string().optional(),
  warrantyType: z.string().default("manufacturer"),
  purchaseDate: z.string().optional(),
  installationDate: z.string().optional(),
  warrantyStart: z.string().min(1),
  warrantyEnd: z.string().min(1),
  extendedWarrantyEnd: z.string().optional(),
  coverageDescription: z.string().optional(),
  exclusions: z.string().optional(),
  maxCoverageAmount: z.coerce.number().optional(),
  deductible: z.coerce.number().default(0),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  contractNumber: z.string().optional(),
  alertDaysBefore: z.coerce.number().int().default(60),
  notes: z.string().optional(),
});
type CreateForm = z.infer<typeof CreateSchema>;

const ClaimFormSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(3),
  claimNumber: z.string().optional(),
  status: z.enum(["open","in_progress","approved","rejected","closed"]).default("open"),
  amount: z.coerce.number().optional(),
});
type ClaimForm = z.infer<typeof ClaimFormSchema>;

function StatusBadge({ status }: { status?: string }) {
  const conf = STATUS_CFG[status || "active"] || STATUS_CFG.active;
  const Icon = conf.icon;
  return <Badge className={`gap-1 border ${conf.color}`}><Icon className="h-3 w-3" />{conf.label}</Badge>;
}

export default function WarrantyPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Warranty | null>(null);
  const [showClaim, setShowClaim] = useState(false);

  const { data: warranties = [], isLoading } = useQuery<Warranty[]>({ queryKey: ["/api/warranties"] });
  const { data: stats } = useQuery<WStats>({ queryKey: ["/api/warranties/stats"] });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["/api/warranties"] }); qc.invalidateQueries({ queryKey: ["/api/warranties/stats"] }); };

  const createMut = useMutation({
    mutationFn: (d: any) => apiRequest("/api/warranties", { method: "POST", body: d }),
    onSuccess: () => { invalidate(); setShowCreate(false); form.reset(); toast({ title: "Garantie créée" }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest(`/api/warranties/${id}`, { method: "PATCH", body: data }),
    onSuccess: async (res: any) => { invalidate(); setSelected(res); },
  });
  const addClaimMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest(`/api/warranties/${id}/claims`, { method: "POST", body: data }),
    onSuccess: async (res: any) => { setSelected(res); invalidate(); setShowClaim(false); claimForm.reset(); toast({ title: "Réclamation ajoutée" }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/warranties/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); setSelected(null); toast({ title: "Garantie supprimée" }); },
  });

  const form = useForm<CreateForm>({ resolver: zodResolver(CreateSchema), defaultValues: { warrantyType: "manufacturer", deductible: 0, alertDaysBefore: 60 } });
  const claimForm = useForm<ClaimForm>({ resolver: zodResolver(ClaimFormSchema), defaultValues: { date: new Date().toISOString().split("T")[0], status: "open" } });

  const openDetail = async (w: Warranty) => { try { const res = await apiRequest(`/api/warranties/${w.id}`); setSelected(res); } catch { setSelected(w); } };

  const filtered = warranties.filter(w => {
    const q = search.toLowerCase();
    return (!q || w.title.toLowerCase().includes(q) || (w.equipmentName || "").toLowerCase().includes(q)) &&
      (filterStatus === "all" || w.computedStatus === filterStatus);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/20 to-teal-50/10 p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-600 to-teal-600 shadow-lg"><ShieldCheck className="h-6 w-6 text-white" /></div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Gestion des Garanties</h1>
          </div>
          <p className="text-slate-500 ml-14 text-sm">Suivi des garanties équipements · Gestion des réclamations</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-lg gap-2"><Plus className="h-4 w-4" />Nouvelle garantie</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Garanties actives", value: stats?.activeCount ?? 0, icon: ShieldCheck, color: "from-green-500 to-teal-600" },
          { label: "Expirent ≤ 60j", value: stats?.expiring60d ?? 0, icon: Clock, color: "from-yellow-400 to-orange-500" },
          { label: "Expirées", value: stats?.expiredCount ?? 0, icon: XCircle, color: "from-red-500 to-rose-600" },
          { label: "Couverture totale", value: fmtEur(stats?.totalCoverage), icon: DollarSign, color: "from-blue-500 to-indigo-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-md"><CardContent className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow`}><Icon className="h-5 w-5 text-white" /></div>
            <div><p className="text-2xl font-bold text-slate-800">{value}</p><p className="text-xs text-slate-500">{label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      {stats?.expiring && stats.expiring.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Garanties expirant dans les 90 jours</h3>
          <div className="flex flex-wrap gap-2">{stats.expiring.map((e: any, i: number) => (<div key={i} className="bg-white rounded-lg border border-amber-200 px-3 py-1.5 text-sm"><span className="font-medium">{e.title}</span>{e.equipment_name && <span className="text-slate-500 ml-1">({e.equipment_name})</span>}<span className="text-amber-700 ml-2 text-xs">{new Date(e.extended_warranty_end || e.warranty_end).toLocaleDateString("fr-FR")}</span></div>))}</div>
        </div>
      )}

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-60"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white" /></div>
        <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-44 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous statuts</SelectItem>{Object.entries(STATUS_CFG).map(([v,c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent></Select>
      </div>

      {isLoading ? <div className="flex justify-center h-48 items-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
      : filtered.length === 0 ? (
        <div className="text-center py-16"><ShieldCheck className="h-12 w-12 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-semibold text-slate-600">Aucune garantie enregistrée</h3><Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-green-600 to-teal-600 text-white gap-2 mt-4"><Plus className="h-4 w-4" />Créer la première garantie</Button></div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(w => {
            const typeConf = TYPE_CFG[w.warrantyType] || TYPE_CFG.manufacturer;
            const endDate = w.extendedWarrantyEnd || w.warrantyEnd;
            return (
              <Card key={w.id} className={`border shadow-sm hover:shadow-md transition-all ${w.computedStatus === "expired" ? "border-red-200 bg-red-50/20" : w.computedStatus === "expiring_soon" ? "border-yellow-200" : "border-slate-100"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2.5 rounded-xl shrink-0 ${w.computedStatus === "expired" ? "bg-red-100" : w.computedStatus === "expiring_soon" ? "bg-yellow-100" : "bg-green-100"}`}>
                        <ShieldCheck className={`h-5 w-5 ${w.computedStatus === "expired" ? "text-red-600" : w.computedStatus === "expiring_soon" ? "text-yellow-600" : "text-green-600"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-xs font-mono text-slate-400">{w.warrantyNumber}</span>
                          <StatusBadge status={w.computedStatus} />
                          <Badge className={typeConf.color + " text-xs"}>{typeConf.label}</Badge>
                          {w.openClaims ? <Badge className="bg-orange-100 text-orange-700 text-xs">📋 {w.openClaims} réclamation{w.openClaims > 1 ? "s" : ""} ouverte{w.openClaims > 1 ? "s" : ""}</Badge> : null}
                        </div>
                        <h3 className="font-semibold text-slate-800">{w.title}</h3>
                        <div className="flex items-center gap-4 text-xs text-slate-500 mt-0.5 flex-wrap">
                          {w.equipmentName && <span>⚙️ {w.equipmentName}</span>}
                          {w.supplierName && <span>🏢 {w.supplierName}</span>}
                          <span>📅 Échéance: <span className={`font-medium ${w.computedStatus === "expired" ? "text-red-600" : w.computedStatus === "expiring_soon" ? "text-yellow-600" : "text-green-700"}`}>{new Date(endDate).toLocaleDateString("fr-FR")}</span></span>
                          {w.daysUntilExpiry != null && <span className="font-medium" style={{ color: w.daysUntilExpiry < 0 ? "#ef4444" : w.daysUntilExpiry <= 60 ? "#f59e0b" : "#16a34a" }}>{w.daysUntilExpiry < 0 ? `${Math.abs(w.daysUntilExpiry)}j expirée` : `dans ${w.daysUntilExpiry}j`}</span>}
                          {w.maxCoverageAmount && <span className="text-blue-600 font-medium">💰 {fmtEur(w.maxCoverageAmount)}</span>}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openDetail(w)}><Eye className="h-4 w-4 mr-1" />Détail</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-green-600" />Nouvelle garantie</DialogTitle></DialogHeader>
          <Form {...form}><form onSubmit={form.handleSubmit(d => createMut.mutate(d))} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="title" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Intitulé *</FormLabel><FormControl><Input placeholder="Ex: Garantie compresseur K1" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="warrantyType" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{Object.entries(TYPE_CFG).map(([v,c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="equipmentName" render={({ field }) => (<FormItem><FormLabel>Équipement couvert</FormLabel><FormControl><Input placeholder="Ex: Compresseur K1" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="supplierName" render={({ field }) => (<FormItem><FormLabel>Fournisseur / Fabricant</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contractNumber" render={({ field }) => (<FormItem><FormLabel>N° contrat de garantie</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="purchaseDate" render={({ field }) => (<FormItem><FormLabel>Date d'achat</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="warrantyStart" render={({ field }) => (<FormItem><FormLabel>Début garantie *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="warrantyEnd" render={({ field }) => (<FormItem><FormLabel>Fin garantie *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="extendedWarrantyEnd" render={({ field }) => (<FormItem><FormLabel>Fin garantie étendue</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="maxCoverageAmount" render={({ field }) => (<FormItem><FormLabel>Plafond de couverture (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="deductible" render={({ field }) => (<FormItem><FormLabel>Franchise (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contactName" render={({ field }) => (<FormItem><FormLabel>Contact SAV</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contactPhone" render={({ field }) => (<FormItem><FormLabel>Téléphone SAV</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="alertDaysBefore" render={({ field }) => (<FormItem><FormLabel>Alerte avant expiration (jours)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="coverageDescription" render={({ field }) => (<FormItem><FormLabel>Description de la couverture</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="exclusions" render={({ field }) => (<FormItem><FormLabel>Exclusions</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter><Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button><Button type="submit" disabled={createMut.isPending} className="bg-green-600 text-white">{createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}Créer</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>

      {/* DETAIL */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-green-50 to-teal-50 border border-green-200">
                <ShieldCheck className="h-6 w-6 text-green-600" />
                <div className="flex-1"><DialogTitle>{selected.title}</DialogTitle><p className="text-xs text-slate-500 font-mono">{selected.warrantyNumber}</p></div>
                <StatusBadge status={selected.computedStatus} />
              </div>
            </DialogHeader>
            <Tabs defaultValue="info">
              <TabsList className="w-full"><TabsTrigger value="info" className="flex-1">Détails</TabsTrigger><TabsTrigger value="claims" className="flex-1">Réclamations ({selected.claims?.length || 0})</TabsTrigger></TabsList>
              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { l: "Type", v: TYPE_CFG[selected.warrantyType]?.label },
                    { l: "Équipement", v: selected.equipmentName },
                    { l: "Fournisseur", v: selected.supplierName },
                    { l: "N° contrat", v: selected.contractNumber },
                    { l: "Couverture max", v: fmtEur(selected.maxCoverageAmount) },
                    { l: "Franchise", v: selected.deductible ? fmtEur(selected.deductible) : "Aucune" },
                    { l: "Contact SAV", v: selected.contactName },
                    { l: "Téléphone SAV", v: selected.contactPhone },
                    { l: "Email SAV", v: selected.contactEmail },
                    { l: "Début garantie", v: new Date(selected.warrantyStart).toLocaleDateString("fr-FR") },
                    { l: "Fin garantie", v: new Date(selected.warrantyEnd).toLocaleDateString("fr-FR") },
                    { l: "Fin garantie étendue", v: selected.extendedWarrantyEnd ? new Date(selected.extendedWarrantyEnd).toLocaleDateString("fr-FR") : null },
                  ].filter(i => i.v).map(({ l, v }) => (<div key={l}><p className="text-xs text-slate-500">{l}</p><p className="font-medium">{v}</p></div>))}
                </div>
                {selected.coverageDescription && <div className="bg-green-50 border border-green-200 rounded-lg p-3"><p className="text-xs text-green-700 font-medium mb-1">Couverture</p><p className="text-sm">{selected.coverageDescription}</p></div>}
                {selected.exclusions && <div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-xs text-red-700 font-medium mb-1">Exclusions</p><p className="text-sm">{selected.exclusions}</p></div>}
                {selected.notes && <div className="bg-slate-50 rounded-lg p-3 text-sm">{selected.notes}</div>}
              </TabsContent>
              <TabsContent value="claims" className="space-y-3 mt-4">
                <Button size="sm" onClick={() => setShowClaim(true)} className="bg-green-600 text-white gap-2"><Plus className="h-4 w-4" />Déclarer une réclamation</Button>
                {(selected.claims || []).length === 0 ? <p className="text-slate-400 text-sm text-center py-8">Aucune réclamation</p>
                : (
                  <div className="space-y-3">{[...(selected.claims || [])].reverse().map((c, i) => (
                    <div key={i} className="bg-white border rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        {c.claimNumber && <span className="text-xs font-mono text-slate-400">{c.claimNumber}</span>}
                        <Badge className={CLAIM_STATUS[c.status] + " text-xs"}>{CLAIM_LABEL[c.status]}</Badge>
                        <span className="text-xs text-slate-500 ml-auto">{new Date(c.date).toLocaleDateString("fr-FR")}</span>
                        {c.amount && <span className="text-xs font-bold text-blue-600">{fmtEur(c.amount)}</span>}
                      </div>
                      <p className="text-sm">{c.description}</p>
                      {c.resolution && <p className="text-xs text-green-600 mt-1">✓ {c.resolution}</p>}
                    </div>
                  ))}</div>
                )}
                {showClaim && (
                  <Dialog open={showClaim} onOpenChange={setShowClaim}>
                    <DialogContent className="max-w-md">
                      <DialogHeader><DialogTitle>Nouvelle réclamation</DialogTitle></DialogHeader>
                      <Form {...claimForm}><form onSubmit={claimForm.handleSubmit(d => addClaimMut.mutate({ id: selected.id, data: d }))} className="space-y-3 mt-2">
                        <div className="grid grid-cols-2 gap-3">
                          <FormField control={claimForm.control} name="date" render={({ field }) => (<FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={claimForm.control} name="claimNumber" render={({ field }) => (<FormItem><FormLabel>N° réclamation</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={claimForm.control} name="status" render={({ field }) => (<FormItem><FormLabel>Statut</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="open">Ouvert</SelectItem><SelectItem value="in_progress">En cours</SelectItem><SelectItem value="approved">Approuvé</SelectItem><SelectItem value="rejected">Rejeté</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                          <FormField control={claimForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Montant (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={claimForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description *</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter><Button type="button" variant="outline" onClick={() => setShowClaim(false)}>Annuler</Button><Button type="submit" disabled={addClaimMut.isPending} className="bg-green-600 text-white">{addClaimMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Enregistrer</Button></DialogFooter>
                      </form></Form>
                    </DialogContent>
                  </Dialog>
                )}
              </TabsContent>
            </Tabs>
            <DialogFooter className="gap-2">
              <Button variant="ghost" size="sm" className="text-red-600 mr-auto" onClick={() => { if (confirm("Supprimer cette garantie ?")) deleteMut.mutate(selected.id); }}><Trash2 className="h-4 w-4 mr-1" />Supprimer</Button>
              <Button variant="outline" onClick={() => setSelected(null)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
