import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  ClipboardList, FileText, ShieldCheck, AlertTriangle, Wrench, Plus, Network,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SmmDocument {
  id: number; documentType: string; title: string; content: string;
  version: string; status: string; equipmentType: string | null;
}
interface SmmChecklist {
  id: number; title: string; description: string | null; status: string;
  items: { label: string; required: boolean }[];
}
interface SmmAudit {
  id: number; auditNumber: string; title: string; auditType: string;
  status: string; score: number | null;
}
interface SmmNonConformity {
  id: number; ncNumber: string; title: string; description: string | null;
  severity: string; source: string; status: string; detectedAt: string;
}
interface SmmImprovementAction {
  id: number; title: string; description: string | null; actionType: string; status: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  manuel_qualite: "Manuel Qualité", manuel_maintenance: "Manuel Maintenance",
  procedure: "Procédure", mode_operatoire: "Mode opératoire", instruction: "Instruction",
};
const SEVERITY_BADGE: Record<string, string> = {
  mineure: "bg-yellow-100 text-yellow-700", majeure: "bg-orange-100 text-orange-700", critique: "bg-red-100 text-red-700",
};
const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600", published: "bg-green-100 text-green-700", archived: "bg-gray-100 text-gray-400",
  planned: "bg-gray-100 text-gray-600", in_progress: "bg-blue-100 text-blue-700", completed: "bg-green-100 text-green-700",
  ouverte: "bg-red-100 text-red-700", en_traitement: "bg-blue-100 text-blue-700", cloturee: "bg-green-100 text-green-700",
  a_faire: "bg-gray-100 text-gray-600", en_cours: "bg-blue-100 text-blue-700", terminee: "bg-green-100 text-green-700", verifiee: "bg-emerald-100 text-emerald-700",
};

export default function SmmPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-600" />
            SMM — Système de Management de Maintenance
          </h1>
          <p className="text-gray-500">
            Manuels, procédures, checklists, audits, non-conformités, amélioration continue.
            Les procédures publiées alimentent automatiquement le Knowledge Graph.
          </p>
        </div>

        <Tabs defaultValue="documents">
          <TabsList>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="checklists">Checklists</TabsTrigger>
            <TabsTrigger value="audits">Audits</TabsTrigger>
            <TabsTrigger value="nc">Non-conformités</TabsTrigger>
            <TabsTrigger value="actions">Actions d'amélioration</TabsTrigger>
          </TabsList>
          <TabsContent value="documents"><DocumentsTab /></TabsContent>
          <TabsContent value="checklists"><ChecklistsTab /></TabsContent>
          <TabsContent value="audits"><AuditsTab /></TabsContent>
          <TabsContent value="nc"><NonConformitiesTab /></TabsContent>
          <TabsContent value="actions"><ImprovementActionsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Documents ──────────────────────────────────────────────────────────────
function DocumentsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ documentType: "procedure", title: "", content: "", equipmentType: "", status: "draft" });

  const { data: documents } = useQuery<SmmDocument[]>({ queryKey: ["/api/smm/documents"] });

  const create = useMutation({
    mutationFn: () => apiRequest("/api/smm/documents", { method: "POST", body: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smm/documents"] });
      toast({ title: "Document créé", description: form.status === "published" && form.documentType === "procedure" ? "Synchronisé vers le Knowledge Graph." : undefined });
      setOpen(false);
      setForm({ documentType: "procedure", title: "", content: "", equipmentType: "", status: "draft" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const publish = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/smm/documents/${id}`, { method: "PATCH", body: { status: "published" } }),
    onSuccess: (doc: SmmDocument) => {
      queryClient.invalidateQueries({ queryKey: ["/api/smm/documents"] });
      toast({ title: "Document publié", description: doc.documentType === "procedure" ? "Synchronisé vers le Knowledge Graph." : undefined });
    },
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nouveau document</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau document</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Type</Label>
                <Select value={form.documentType} onValueChange={v => setForm({ ...form, documentType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOC_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Titre</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Contenu</Label><Textarea rows={5} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></div>
              <div><Label>Type d'équipement (optionnel)</Label><Input value={form.equipmentType} onChange={e => setForm({ ...form, equipmentType: e.target.value })} /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="publishNow" checked={form.status === "published"} onChange={e => setForm({ ...form, status: e.target.checked ? "published" : "draft" })} />
                <Label htmlFor="publishNow">Publier immédiatement</Label>
              </div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.title || !form.content || create.isPending}>Créer</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(documents ?? []).map(doc => (
          <Card key={doc.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <Badge variant="outline" className="text-xs mb-1">{DOC_TYPE_LABELS[doc.documentType]}</Badge>
                  <CardTitle className="text-base">{doc.title}</CardTitle>
                </div>
                <Badge className={STATUS_BADGE[doc.status]}>{doc.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-gray-500 line-clamp-2">{doc.content}</p>
              {doc.documentType === "procedure" && doc.status === "published" && (
                <p className="text-xs text-blue-600 flex items-center gap-1"><Network className="w-3 h-3" />Dans le Knowledge Graph</p>
              )}
              {doc.status === "draft" && (
                <Button size="sm" variant="outline" onClick={() => publish.mutate(doc.id)} disabled={publish.isPending}>Publier</Button>
              )}
            </CardContent>
          </Card>
        ))}
        {(documents ?? []).length === 0 && <p className="text-sm text-gray-400 col-span-2">Aucun document.</p>}
      </div>
    </div>
  );
}

// ─── Checklists ─────────────────────────────────────────────────────────────
function ChecklistsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [itemsText, setItemsText] = useState("");

  const { data: checklists } = useQuery<SmmChecklist[]>({ queryKey: ["/api/smm/checklists"] });

  const create = useMutation({
    mutationFn: () => apiRequest("/api/smm/checklists", {
      method: "POST",
      body: { title, items: itemsText.split("\n").map(l => l.trim()).filter(Boolean).map(label => ({ label, required: true })) },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smm/checklists"] });
      toast({ title: "Checklist créée" });
      setOpen(false); setTitle(""); setItemsText("");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nouvelle checklist</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle checklist</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Titre</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
              <div><Label>Items (un par ligne)</Label><Textarea rows={6} value={itemsText} onChange={e => setItemsText(e.target.value)} placeholder={"Vérifier le niveau d'huile\nContrôler la tension des courroies"} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!title || create.isPending}>Créer</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(checklists ?? []).map(c => (
          <Card key={c.id}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{c.title}</CardTitle></CardHeader>
            <CardContent><p className="text-xs text-gray-500">{c.items.length} item(s)</p></CardContent>
          </Card>
        ))}
        {(checklists ?? []).length === 0 && <p className="text-sm text-gray-400 col-span-2">Aucune checklist.</p>}
      </div>
    </div>
  );
}

// ─── Audits ─────────────────────────────────────────────────────────────────
function AuditsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [auditType, setAuditType] = useState("interne");

  const { data: audits } = useQuery<SmmAudit[]>({ queryKey: ["/api/smm/audits"] });

  const create = useMutation({
    mutationFn: () => apiRequest("/api/smm/audits", { method: "POST", body: { title, auditType } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smm/audits"] });
      toast({ title: "Audit créé" });
      setOpen(false); setTitle("");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nouvel audit</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvel audit</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Titre</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
              <div>
                <Label>Type</Label>
                <Select value={auditType} onValueChange={setAuditType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interne">Interne</SelectItem>
                    <SelectItem value="externe">Externe</SelectItem>
                    <SelectItem value="fournisseur">Fournisseur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!title || create.isPending}>Créer</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(audits ?? []).map(a => (
          <Card key={a.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div><Badge variant="outline" className="text-xs mb-1">{a.auditNumber}</Badge><CardTitle className="text-base">{a.title}</CardTitle></div>
                <Badge className={STATUS_BADGE[a.status]}>{a.status}</Badge>
              </div>
            </CardHeader>
            <CardContent><p className="text-xs text-gray-500">{a.auditType} {a.score !== null ? `— score ${a.score}%` : ""}</p></CardContent>
          </Card>
        ))}
        {(audits ?? []).length === 0 && <p className="text-sm text-gray-400 col-span-2">Aucun audit.</p>}
      </div>
    </div>
  );
}

// ─── Non-conformités ────────────────────────────────────────────────────────
function NonConformitiesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("mineure");

  const { data: ncs } = useQuery<SmmNonConformity[]>({ queryKey: ["/api/smm/non-conformities"] });

  const create = useMutation({
    mutationFn: () => apiRequest("/api/smm/non-conformities", { method: "POST", body: { title, description, severity, source: "autre" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smm/non-conformities"] });
      toast({ title: "Non-conformité créée" });
      setOpen(false); setTitle(""); setDescription("");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => apiRequest(`/api/smm/non-conformities/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smm/non-conformities"] });
      toast({ title: "Statut mis à jour" });
    },
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nouvelle non-conformité</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle non-conformité</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Titre</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
              <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
              <div>
                <Label>Sévérité</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mineure">Mineure</SelectItem>
                    <SelectItem value="majeure">Majeure</SelectItem>
                    <SelectItem value="critique">Critique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!title || create.isPending}>Créer</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(ncs ?? []).map(nc => (
          <Card key={nc.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <Badge variant="outline" className="text-xs mb-1">{nc.ncNumber}</Badge>
                  <CardTitle className="text-base">{nc.title}</CardTitle>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={SEVERITY_BADGE[nc.severity]}>{nc.severity}</Badge>
                  <Badge className={STATUS_BADGE[nc.status]}>{nc.status}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {nc.description && <p className="text-xs text-gray-500">{nc.description}</p>}
              <p className="text-xs text-gray-400 flex items-center gap-1">
                {nc.source === "controle_qualite" && <AlertTriangle className="w-3 h-3 text-orange-500" />}
                Source : {nc.source === "controle_qualite" ? "Contrôle qualité (Maintenance Execution)" : nc.source}
              </p>
              {nc.status !== "cloturee" && (
                <div className="flex gap-2">
                  {nc.status === "ouverte" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: nc.id, status: "en_traitement" })}>Traiter</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: nc.id, status: "cloturee" })}>Clôturer</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {(ncs ?? []).length === 0 && <p className="text-sm text-gray-400 col-span-2">Aucune non-conformité.</p>}
      </div>
    </div>
  );
}

// ─── Actions d'amélioration ─────────────────────────────────────────────────
function ImprovementActionsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [actionType, setActionType] = useState("corrective");

  const { data: actions } = useQuery<SmmImprovementAction[]>({ queryKey: ["/api/smm/improvement-actions"] });

  const create = useMutation({
    mutationFn: () => apiRequest("/api/smm/improvement-actions", { method: "POST", body: { title, actionType } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smm/improvement-actions"] });
      toast({ title: "Action créée" });
      setOpen(false); setTitle("");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nouvelle action</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle action d'amélioration</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Titre</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
              <div>
                <Label>Type</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrective">Corrective</SelectItem>
                    <SelectItem value="preventive">Préventive</SelectItem>
                    <SelectItem value="amelioration">Amélioration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!title || create.isPending}>Créer</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(actions ?? []).map(a => (
          <Card key={a.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{a.title}</CardTitle>
                <Badge className={STATUS_BADGE[a.status]}>{a.status}</Badge>
              </div>
            </CardHeader>
            <CardContent><Badge variant="outline" className="text-xs">{a.actionType}</Badge></CardContent>
          </Card>
        ))}
        {(actions ?? []).length === 0 && <p className="text-sm text-gray-400 col-span-2">Aucune action.</p>}
      </div>
    </div>
  );
}
