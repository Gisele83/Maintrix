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
  Plus, Loader2, Search, Eye, Trash2, Building2,
  Star, Phone, Mail, Globe, MapPin, FileText,
  TrendingUp, Award, Clock, AlertTriangle, Tag, CheckCircle2
} from "lucide-react";

interface Supplier {
  id: number; supplierCode: string; name: string; supplierType: string; status: string;
  contactName?: string; contactEmail?: string; contactPhone?: string; address?: string; city?: string; country?: string;
  siret?: string; vatNumber?: string; website?: string; paymentTermsDays?: number; currency?: string;
  certifications: string[]; specialties: string[]; rating?: number; totalOrders?: number; totalSpend?: number;
  onTimeDeliveryPct?: number; qualityScore?: number; lastOrderDate?: string;
  contractStart?: string; contractEnd?: string; contractNumber?: string;
  insuranceExpiry?: string; insuranceAmount?: number; notes?: string;
}
interface SupplierStats { total: number; active: number; blacklisted: number; contractors: number; avgRating: number; totalSpend: number; contractsExpiring: number; byType: any[]; topSuppliers: any[]; }

const TYPE_CFG: Record<string, { label: string; color: string }> = {
  supplier: { label: "Fournisseur", color: "bg-blue-100 text-blue-700" },
  contractor: { label: "Prestataire", color: "bg-purple-100 text-purple-700" },
  subcontractor: { label: "Sous-traitant", color: "bg-indigo-100 text-indigo-700" },
  consultant: { label: "Consultant", color: "bg-teal-100 text-teal-700" },
  manufacturer: { label: "Fabricant", color: "bg-orange-100 text-orange-700" },
};
const STATUS_CFG: Record<string, { label: string; color: string }> = {
  active: { label: "Actif", color: "bg-green-100 text-green-700" },
  inactive: { label: "Inactif", color: "bg-slate-100 text-slate-500" },
  blacklisted: { label: "Blacklisté", color: "bg-red-100 text-red-700" },
  pending_approval: { label: "En attente", color: "bg-yellow-100 text-yellow-700" },
};
const fmtEur = (n: any) => n != null ? `${Number(n).toLocaleString("fr-FR",{maximumFractionDigits:0})} €` : "—";

function StarRating({ rating, onChange }: { rating?: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">{[1,2,3,4,5].map(s => (
      <Star key={s} className={`h-4 w-4 ${(rating || 0) >= s ? "fill-yellow-400 text-yellow-400" : "text-slate-300"} ${onChange ? "cursor-pointer" : ""}`} onClick={() => onChange?.(s)} />
    ))}</div>
  );
}

const CreateSchema = z.object({
  name: z.string().min(2),
  supplierCode: z.string().optional(),
  supplierType: z.string().default("supplier"),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default("France"),
  siret: z.string().optional(),
  vatNumber: z.string().optional(),
  website: z.string().optional(),
  paymentTermsDays: z.coerce.number().int().default(30),
  contractStart: z.string().optional(),
  contractEnd: z.string().optional(),
  contractNumber: z.string().optional(),
  insuranceExpiry: z.string().optional(),
  insuranceAmount: z.coerce.number().optional(),
  notes: z.string().optional(),
});
type CreateForm = z.infer<typeof CreateSchema>;

export default function SupplierPortalPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [newSpecialty, setNewSpecialty] = useState("");
  const [newCert, setNewCert] = useState("");

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({ queryKey: ["/api/suppliers"] });
  const { data: stats } = useQuery<SupplierStats>({ queryKey: ["/api/suppliers/stats"] });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["/api/suppliers"] }); qc.invalidateQueries({ queryKey: ["/api/suppliers/stats"] }); };

  const createMut = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/suppliers", d),
    onSuccess: () => { invalidate(); setShowCreate(false); form.reset(); toast({ title: "Fournisseur ajouté" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/suppliers/${id}`, data),
    onSuccess: async (res: any) => { invalidate(); const d = await res.json(); setSelected(d); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/suppliers/${id}`),
    onSuccess: () => { invalidate(); setSelected(null); toast({ title: "Fournisseur supprimé" }); },
  });

  const form = useForm<CreateForm>({ resolver: zodResolver(CreateSchema), defaultValues: { supplierType: "supplier", paymentTermsDays: 30, country: "France" } });

  const openDetail = async (s: Supplier) => {
    try { const res = await apiRequest("GET", `/api/suppliers/${s.id}`); setSelected(await (res as any).json()); } catch { setSelected(s); }
  };

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase();
    return (!q || s.name.toLowerCase().includes(q) || s.supplierCode.toLowerCase().includes(q)) &&
      (filterType === "all" || s.supplierType === filterType) &&
      (filterStatus === "all" || s.status === filterStatus);
  });

  const contractsExpiring = suppliers.filter(s => s.contractEnd && new Date(s.contractEnd) < new Date(Date.now() + 60 * 24 * 3600 * 1000) && new Date(s.contractEnd) > new Date()).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-indigo-50/10 p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg"><Building2 className="h-6 w-6 text-white" /></div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Portail Fournisseurs</h1>
          </div>
          <p className="text-slate-500 ml-14 text-sm">Gestion des fournisseurs, sous-traitants et prestataires</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg gap-2"><Plus className="h-4 w-4" />Nouveau fournisseur</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Fournisseurs actifs", value: stats?.active ?? 0, icon: Building2, color: "from-purple-500 to-indigo-600" },
          { label: "Prestataires", value: stats?.contractors ?? 0, icon: Award, color: "from-blue-500 to-indigo-600" },
          { label: "Dépenses totales", value: fmtEur(stats?.totalSpend), icon: TrendingUp, color: "from-emerald-500 to-teal-600" },
          { label: "Contrats expirant", value: contractsExpiring, icon: AlertTriangle, color: "from-orange-400 to-amber-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-md"><CardContent className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow`}><Icon className="h-5 w-5 text-white" /></div>
            <div><p className="text-2xl font-bold text-slate-800">{value}</p><p className="text-xs text-slate-500">{label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      {/* Type filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[{ v: "all", l: "Tous" }, ...Object.entries(TYPE_CFG).map(([v, c]) => ({ v, l: c.label }))].map(({ v, l }) => {
          const cnt = v === "all" ? suppliers.length : suppliers.filter(s => s.supplierType === v).length;
          return <button key={v} onClick={() => setFilterType(v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${filterType === v ? "bg-purple-600 text-white border-purple-600" : "bg-white border-slate-200 hover:border-slate-300"}`}>{l} ({cnt})</button>;
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-60"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white" /></div>
        <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-40 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous statuts</SelectItem>{Object.entries(STATUS_CFG).map(([v,c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent></Select>
      </div>

      {isLoading ? <div className="flex justify-center h-48 items-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
      : filtered.length === 0 ? (
        <div className="text-center py-16"><Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-semibold text-slate-600 mb-1">Aucun fournisseur référencé</h3><Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white gap-2 mt-4"><Plus className="h-4 w-4" />Ajouter le premier</Button></div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(s => {
            const typeConf = TYPE_CFG[s.supplierType] || TYPE_CFG.supplier;
            const statusConf = STATUS_CFG[s.status] || STATUS_CFG.active;
            const contractExpiring = s.contractEnd && new Date(s.contractEnd) < new Date(Date.now() + 60 * 24 * 3600 * 1000) && new Date(s.contractEnd) > new Date();
            return (
              <Card key={s.id} className={`border shadow-sm hover:shadow-md transition-all ${s.status === "blacklisted" ? "border-red-200 bg-red-50/20" : "border-slate-100"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-xl bg-purple-50 shadow-sm shrink-0"><Building2 className="h-5 w-5 text-purple-600" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-xs font-mono text-slate-400">{s.supplierCode}</span>
                          <Badge className={typeConf.color + " text-xs"}>{typeConf.label}</Badge>
                          <Badge className={statusConf.color + " text-xs"}>{statusConf.label}</Badge>
                          {contractExpiring && <Badge className="bg-orange-100 text-orange-700 text-xs">⏰ Contrat bientôt échu</Badge>}
                        </div>
                        <h3 className="font-semibold text-slate-800">{s.name}</h3>
                        <div className="flex items-center gap-4 mt-0.5 flex-wrap text-xs text-slate-500">
                          {s.city && <span><MapPin className="h-3 w-3 inline mr-0.5" />{s.city}</span>}
                          {s.contactName && <span>👤 {s.contactName}</span>}
                          {s.contactPhone && <span>📞 {s.contactPhone}</span>}
                          {s.totalSpend ? <span className="text-purple-600 font-medium">💰 {fmtEur(s.totalSpend)}</span> : null}
                          {s.totalOrders ? <span>{s.totalOrders} commandes</span> : null}
                          {s.onTimeDeliveryPct != null && <span>⏱️ {s.onTimeDeliveryPct}% ponctualité</span>}
                        </div>
                        {s.rating && <div className="mt-1"><StarRating rating={s.rating} /></div>}
                        {s.specialties?.length > 0 && <div className="flex gap-1 mt-1 flex-wrap">{s.specialties.slice(0, 3).map((sp, i) => <Badge key={i} variant="outline" className="text-xs">{sp}</Badge>)}</div>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openDetail(s)}><Eye className="h-4 w-4 mr-1" />Détail</Button>
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
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-purple-600" />Nouveau fournisseur</DialogTitle></DialogHeader>
          <Form {...form}><form onSubmit={form.handleSubmit(d => createMut.mutate(d))} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Raison sociale *</FormLabel><FormControl><Input placeholder="Ex: Techni-Maint SARL" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="supplierType" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{Object.entries(TYPE_CFG).map(([v,c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="supplierCode" render={({ field }) => (<FormItem><FormLabel>Code fournisseur (auto si vide)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contactName" render={({ field }) => (<FormItem><FormLabel>Contact principal</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contactEmail" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contactPhone" render={({ field }) => (<FormItem><FormLabel>Téléphone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="city" render={({ field }) => (<FormItem><FormLabel>Ville</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="country" render={({ field }) => (<FormItem><FormLabel>Pays</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="siret" render={({ field }) => (<FormItem><FormLabel>SIRET</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="paymentTermsDays" render={({ field }) => (<FormItem><FormLabel>Délai paiement (jours)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contractNumber" render={({ field }) => (<FormItem><FormLabel>N° contrat</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contractStart" render={({ field }) => (<FormItem><FormLabel>Début contrat</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contractEnd" render={({ field }) => (<FormItem><FormLabel>Fin contrat</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="insuranceExpiry" render={({ field }) => (<FormItem><FormLabel>Expiration assurance</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="insuranceAmount" render={({ field }) => (<FormItem><FormLabel>Montant assurance (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter><Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button><Button type="submit" disabled={createMut.isPending} className="bg-purple-600 text-white">{createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}Créer</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>

      {/* DETAIL */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200">
                <Building2 className="h-6 w-6 text-purple-600" />
                <div className="flex-1"><DialogTitle>{selected.name}</DialogTitle><p className="text-xs text-slate-500 font-mono">{selected.supplierCode}</p></div>
                <div className="flex gap-2 flex-wrap">
                  {Object.keys(STATUS_CFG).map(s => (
                    <Button key={s} variant={selected.status === s ? "default" : "outline"} size="sm" className={`text-xs ${selected.status === s ? "bg-purple-600 text-white" : ""}`} onClick={() => updateMut.mutate({ id: selected.id, data: { status: s } })}>{STATUS_CFG[s].label}</Button>
                  ))}
                </div>
              </div>
            </DialogHeader>
            <Tabs defaultValue="info">
              <TabsList className="w-full"><TabsTrigger value="info" className="flex-1">Informations</TabsTrigger><TabsTrigger value="performance" className="flex-1">Performance</TabsTrigger><TabsTrigger value="contract" className="flex-1">Contrat</TabsTrigger></TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { l: "Type", v: TYPE_CFG[selected.supplierType]?.label },
                    { l: "Contact", v: selected.contactName },
                    { l: "Email", v: selected.contactEmail },
                    { l: "Téléphone", v: selected.contactPhone },
                    { l: "Ville", v: selected.city },
                    { l: "Pays", v: selected.country },
                    { l: "SIRET", v: selected.siret },
                    { l: "TVA intracommunautaire", v: selected.vatNumber },
                    { l: "Site web", v: selected.website },
                    { l: "Délai paiement", v: selected.paymentTermsDays ? `${selected.paymentTermsDays} jours` : null },
                  ].filter(i => i.v).map(({ l, v }) => (<div key={l}><p className="text-xs text-slate-500">{l}</p><p className="font-medium">{v}</p></div>))}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Note globale</p>
                  <div className="flex items-center gap-3"><StarRating rating={selected.rating} onChange={v => updateMut.mutate({ id: selected.id, data: { rating: v } })} /><span className="text-sm text-slate-500">{selected.rating ? `${selected.rating}/5` : "Non noté"}</span></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Spécialités</p>
                  <div className="flex flex-wrap gap-2 mb-2">{(selected.specialties || []).map((sp, i) => <Badge key={i} variant="outline">{sp}<button className="ml-1 text-slate-400 hover:text-red-500" onClick={() => updateMut.mutate({ id: selected.id, data: { specialties: selected.specialties.filter((_, j) => j !== i) } })}>×</button></Badge>)}</div>
                  <div className="flex gap-2"><Input value={newSpecialty} onChange={e => setNewSpecialty(e.target.value)} placeholder="Ajouter une spécialité..." className="max-w-xs" onKeyDown={e => { if (e.key === "Enter" && newSpecialty) { updateMut.mutate({ id: selected.id, data: { specialties: [...(selected.specialties || []), newSpecialty] } }); setNewSpecialty(""); } }} /><Button size="sm" variant="outline" onClick={() => { if (newSpecialty) { updateMut.mutate({ id: selected.id, data: { specialties: [...(selected.specialties || []), newSpecialty] } }); setNewSpecialty(""); } }}>Ajouter</Button></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Certifications</p>
                  <div className="flex flex-wrap gap-2 mb-2">{(selected.certifications || []).map((c, i) => <Badge key={i} className="bg-green-100 text-green-700">{c}<button className="ml-1" onClick={() => updateMut.mutate({ id: selected.id, data: { certifications: selected.certifications.filter((_, j) => j !== i) } })}>×</button></Badge>)}</div>
                  <div className="flex gap-2"><Input value={newCert} onChange={e => setNewCert(e.target.value)} placeholder="Ex: ISO 9001, MASE..." className="max-w-xs" /><Button size="sm" variant="outline" onClick={() => { if (newCert) { updateMut.mutate({ id: selected.id, data: { certifications: [...(selected.certifications || []), newCert] } }); setNewCert(""); } }}>Ajouter</Button></div>
                </div>
                {selected.notes && <div className="bg-slate-50 rounded-lg p-3 text-sm">{selected.notes}</div>}
              </TabsContent>

              <TabsContent value="performance" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { l: "Commandes totales", v: selected.totalOrders ?? 0, c: "text-blue-600" },
                    { l: "Dépenses totales", v: fmtEur(selected.totalSpend), c: "text-purple-600" },
                    { l: "Ponctualité livraison", v: selected.onTimeDeliveryPct != null ? `${selected.onTimeDeliveryPct}%` : "—", c: "text-green-600" },
                    { l: "Score qualité", v: selected.qualityScore != null ? `${selected.qualityScore}/100` : "—", c: "text-teal-600" },
                  ].map(({ l, v, c }) => (<div key={l} className="bg-white rounded-xl border p-4 text-center"><p className={`text-2xl font-bold ${c}`}>{v}</p><p className="text-xs text-slate-500 mt-1">{l}</p></div>))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Ponctualité (%)</label><Input type="number" min="0" max="100" className="mt-1" defaultValue={selected.onTimeDeliveryPct || ""} onBlur={e => updateMut.mutate({ id: selected.id, data: { onTimeDeliveryPct: parseFloat(e.target.value) || null } })} /></div>
                  <div><label className="text-sm font-medium">Score qualité (/100)</label><Input type="number" min="0" max="100" className="mt-1" defaultValue={selected.qualityScore || ""} onBlur={e => updateMut.mutate({ id: selected.id, data: { qualityScore: parseFloat(e.target.value) || null } })} /></div>
                  <div><label className="text-sm font-medium">Nb commandes</label><Input type="number" className="mt-1" defaultValue={selected.totalOrders || ""} onBlur={e => updateMut.mutate({ id: selected.id, data: { totalOrders: parseInt(e.target.value) || 0 } })} /></div>
                  <div><label className="text-sm font-medium">Dépenses totales (€)</label><Input type="number" className="mt-1" defaultValue={selected.totalSpend || ""} onBlur={e => updateMut.mutate({ id: selected.id, data: { totalSpend: parseFloat(e.target.value) || 0 } })} /></div>
                </div>
              </TabsContent>

              <TabsContent value="contract" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { l: "N° de contrat", v: selected.contractNumber },
                    { l: "Début contrat", v: selected.contractStart ? new Date(selected.contractStart).toLocaleDateString("fr-FR") : null },
                    { l: "Fin contrat", v: selected.contractEnd ? new Date(selected.contractEnd).toLocaleDateString("fr-FR") : null },
                    { l: "Assurance expiration", v: selected.insuranceExpiry ? new Date(selected.insuranceExpiry).toLocaleDateString("fr-FR") : null },
                    { l: "Montant assurance", v: fmtEur(selected.insuranceAmount) },
                    { l: "Délai paiement", v: selected.paymentTermsDays ? `${selected.paymentTermsDays} jours` : null },
                  ].filter(i => i.v && i.v !== "—").map(({ l, v }) => (<div key={l}><p className="text-xs text-slate-500">{l}</p><p className="font-medium">{v}</p></div>))}
                </div>
              </TabsContent>
            </Tabs>
            <DialogFooter className="gap-2">
              <Button variant="ghost" size="sm" className="text-red-600 mr-auto" onClick={() => { if (confirm("Supprimer ce fournisseur ?")) deleteMut.mutate(selected.id); }}><Trash2 className="h-4 w-4 mr-1" />Supprimer</Button>
              <Button variant="outline" onClick={() => setSelected(null)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
