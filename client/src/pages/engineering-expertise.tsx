import { useState } from "react";
import { Link } from "wouter";
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
import {
  BookOpen, GitBranch, ClipboardList, Network, Wrench, ArrowRight, ExternalLink, Loader2,
} from "lucide-react";

interface Overview {
  expertRules: { count: number; description: string };
  rca: { count: number; methodologies: string[] };
  fmea: { count: number; description: string };
  rcm: { count: number; description: string };
}
interface ExpertRule {
  id: string; name: string; equipmentPatterns: string[]; symptomPatterns: string[];
  diagnosis: string; solution: string; confidence: number;
}
interface RcmAnalysis {
  id: number; functionDescription: string; failureMode: string;
  consequenceCategory: string; recommendedTaskType: string; reasoning: string; status: string;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  condition_based: "Maintenance conditionnelle", scheduled_restoration: "Restauration programmée",
  scheduled_discard: "Remplacement programmé", failure_finding: "Recherche de panne",
  run_to_failure: "Run-to-failure", redesign: "Reconception",
};
const TASK_TYPE_COLOR: Record<string, string> = {
  condition_based: "bg-green-100 text-green-700", scheduled_restoration: "bg-orange-100 text-orange-700",
  scheduled_discard: "bg-blue-100 text-blue-700", failure_finding: "bg-purple-100 text-purple-700",
  run_to_failure: "bg-gray-100 text-gray-600", redesign: "bg-red-100 text-red-700",
};

export default function EngineeringExpertisePage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            Engineering Expertise
          </h1>
          <p className="text-gray-500">
            Expert Rules, RCA (5 Why / Fishbone / Fault Tree), FMEA/AMDEC, RCM. Ce n'est pas de l'IA générative — c'est de l'ingénierie déterministe, l'expérience capitalisée des ingénieurs.
          </p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="rules">Expert Rules</TabsTrigger>
            <TabsTrigger value="rcm">RCM</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="rules"><RulesTab /></TabsContent>
          <TabsContent value="rcm"><RcmTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function OverviewTab() {
  const { data } = useQuery<Overview>({ queryKey: ["/api/engineering-expertise/overview"] });

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{data?.expertRules.count ?? "—"}</div><p className="text-xs text-gray-500">Règles expertes</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{data?.rca.count ?? "—"}</div><p className="text-xs text-gray-500">Analyses RCA</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{data?.fmea.count ?? "—"}</div><p className="text-xs text-gray-500">AMDEC</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{data?.rcm.count ?? "—"}</div><p className="text-xs text-gray-500">Analyses RCM</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><GitBranch className="w-4 h-4" />RCA — Root Cause Analysis</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-gray-500">Méthodologies : 5 Why, Fishbone (Ishikawa), FMEA, Fault Tree.</p>
            <Link href="/rca"><Button size="sm" variant="outline" className="w-full justify-between">Ouvrir RCA<ExternalLink className="w-3 h-3" /></Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="w-4 h-4" />FMEA / AMDEC</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-gray-500">{data?.fmea.description ?? "Criticité RPN = Sévérité × Occurrence × Détectabilité"}</p>
            <Link href="/fmea"><Button size="sm" variant="outline" className="w-full justify-between">Ouvrir FMEA<ExternalLink className="w-3 h-3" /></Button></Link>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-blue-50 border-blue-100">
        <CardContent className="pt-6 text-sm text-blue-800 flex items-start gap-2">
          <Network className="w-4 h-4 mt-0.5 flex-shrink-0" />
          Une RCA clôturée avec une cause racine identifiée enrichit automatiquement le
          <Link href="/knowledge-graph" className="underline mx-1">Knowledge Graph</Link>
          — la capitalisation d'ingénierie devient une mémoire technique consultable, pas un rapport isolé.
        </CardContent>
      </Card>
    </div>
  );
}

function RulesTab() {
  const { data: rules } = useQuery<ExpertRule[]>({ queryKey: ["/api/engineering-expertise/rules"] });

  return (
    <div className="space-y-3 mt-4">
      <p className="text-sm text-gray-500">
        {rules?.length ?? 0} règles déterministes — consultées par le pipeline diagnostic (server/diagnostic-rules-engine.ts), pas générées par IA.
      </p>
      {(rules ?? []).map(rule => (
        <Card key={rule.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{rule.id} — {rule.name}</CardTitle>
              <Badge variant="outline">{Math.round(rule.confidence * 100)}% confiance</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-gray-600">
            <p><span className="font-medium">Équipements :</span> {rule.equipmentPatterns.join(", ")}</p>
            <p><span className="font-medium">Symptômes :</span> {rule.symptomPatterns.join(", ")}</p>
            <p><span className="font-medium">Diagnostic :</span> {rule.diagnosis}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RcmTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    functionDescription: "", functionalFailure: "", failureMode: "",
    evident: true, safetyOrEnvironmental: false, operationalImpact: false, conditionMonitoringPossible: false,
  });
  const [preview, setPreview] = useState<{ consequenceCategory: string; recommendedTaskType: string; reasoning: string } | null>(null);

  const { data: analyses } = useQuery<RcmAnalysis[]>({ queryKey: ["/api/rcm"] });

  const evaluate = useMutation({
    mutationFn: () => apiRequest("/api/rcm/evaluate", {
      method: "POST",
      body: {
        evident: form.evident, safetyOrEnvironmental: form.safetyOrEnvironmental,
        operationalImpact: form.operationalImpact, conditionMonitoringPossible: form.conditionMonitoringPossible,
      },
    }),
    onSuccess: (data) => setPreview(data),
  });

  const save = useMutation({
    mutationFn: () => apiRequest("/api/rcm", { method: "POST", body: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rcm"] });
      queryClient.invalidateQueries({ queryKey: ["/api/engineering-expertise/overview"] });
      toast({ title: "Analyse RCM enregistrée" });
      setForm({ functionDescription: "", functionalFailure: "", failureMode: "", evident: true, safetyOrEnvironmental: false, operationalImpact: false, conditionMonitoringPossible: false });
      setPreview(null);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Nouvelle analyse RCM</CardTitle>
          <CardDescription>Arbre de décision classique (Moubray) — la stratégie recommandée est calculée, pas choisie.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Fonction de l'équipement</Label><Input value={form.functionDescription} onChange={e => setForm({ ...form, functionDescription: e.target.value })} placeholder="Ex: Fournir un débit de 50 m³/h à 3 bar" /></div>
          <div><Label>Défaillance fonctionnelle</Label><Input value={form.functionalFailure} onChange={e => setForm({ ...form, functionalFailure: e.target.value })} placeholder="Ex: Incapable de fournir le débit requis" /></div>
          <div><Label>Mode de défaillance</Label><Input value={form.failureMode} onChange={e => setForm({ ...form, failureMode: e.target.value })} placeholder="Ex: Usure de la roue" /></div>

          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2"><input type="checkbox" id="evident" checked={form.evident} onChange={e => setForm({ ...form, evident: e.target.checked })} /><Label htmlFor="evident">Q1 — La panne est évidente en exploitation normale</Label></div>
            <div className="flex items-center gap-2"><input type="checkbox" id="safety" checked={form.safetyOrEnvironmental} onChange={e => setForm({ ...form, safetyOrEnvironmental: e.target.checked })} /><Label htmlFor="safety">Q2 — Conséquence sécurité/environnement</Label></div>
            <div className="flex items-center gap-2"><input type="checkbox" id="ops" checked={form.operationalImpact} onChange={e => setForm({ ...form, operationalImpact: e.target.checked })} /><Label htmlFor="ops">Q3 — Impact opérationnel (production/qualité)</Label></div>
            <div className="flex items-center gap-2"><input type="checkbox" id="cm" checked={form.conditionMonitoringPossible} onChange={e => setForm({ ...form, conditionMonitoringPossible: e.target.checked })} /><Label htmlFor="cm">Un intervalle P-F est détectable (surveillance possible)</Label></div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => evaluate.mutate()} disabled={evaluate.isPending}>
              {evaluate.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Prévisualiser
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={!form.functionDescription || !form.failureMode || save.isPending}>
              {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Enregistrer
            </Button>
          </div>

          {preview && (
            <div className="rounded-lg border border-gray-200 p-3 space-y-1">
              <Badge className={TASK_TYPE_COLOR[preview.recommendedTaskType]}>{TASK_TYPE_LABELS[preview.recommendedTaskType]}</Badge>
              <p className="text-xs text-gray-600">{preview.reasoning}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(analyses ?? []).map(a => (
          <Card key={a.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{a.failureMode}</CardTitle>
                <Badge className={TASK_TYPE_COLOR[a.recommendedTaskType]}>{TASK_TYPE_LABELS[a.recommendedTaskType]}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500 flex items-center gap-1"><ArrowRight className="w-3 h-3" />{a.functionDescription}</p>
              <p className="text-xs text-gray-400 mt-1">{a.reasoning}</p>
            </CardContent>
          </Card>
        ))}
        {(analyses ?? []).length === 0 && <p className="text-sm text-gray-400">Aucune analyse RCM enregistrée.</p>}
      </div>
    </div>
  );
}
