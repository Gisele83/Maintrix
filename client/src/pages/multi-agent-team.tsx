import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Users, Stethoscope, CalendarClock, ShieldCheck, HardHat, BookOpen, Package,
  Network, Boxes, GraduationCap, Zap, Crown, Loader2, AlertTriangle, CheckCircle2, HelpCircle,
} from "lucide-react";

type AgentStatus = "nominal" | "attention" | "alert" | "not_instrumented";

interface AgentSignal {
  label: string;
  value: number | string;
  severity: "info" | "warning" | "high" | "critical";
  detail?: string;
}

interface FunctionalAgentAssessment {
  domain: string;
  name: string;
  status: AgentStatus;
  summary: string;
  signals: AgentSignal[];
  recommendations: string[];
  computedAt: string;
}

interface SupervisorArbitration {
  computedAt: string;
  agents: FunctionalAgentAssessment[];
  domainsInAlert: string[];
  domainsNeedingAttention: string[];
  priorities: { domain: string; agentName: string; reason: string; recommendation: string }[];
}

interface CompetencyGap {
  workOrderId: number;
  orderNumber: string;
  technicianName: string;
  equipmentName: string;
  equipmentType: string;
}

interface TrainingRequestRow {
  id: number;
  first_name: string | null;
  last_name: string | null;
  order_number: string | null;
  equipment_type: string;
  status: string;
  techlearn_tp_title: string | null;
  techlearn_score: number | null;
  requested_at: string | null;
  completed_at: string | null;
}

const TRAINING_STATUS_LABEL: Record<string, string> = {
  detected: "Détecté",
  requested: "Formation demandée",
  in_progress: "En cours",
  completed: "Terminé",
  dismissed: "Ignoré",
};

const DOMAIN_ICONS: Record<string, any> = {
  diagnostic: Stethoscope,
  planning: CalendarClock,
  reliability: ShieldCheck,
  qhse: HardHat,
  documentation: BookOpen,
  procurement: Package,
  knowledge: Network,
  digital_twin: Boxes,
  training: GraduationCap,
  customer: Users,
  energy: Zap,
  supervisor: Crown,
};

const STATUS_STYLE: Record<AgentStatus, { label: string; badge: string; icon: any }> = {
  nominal: { label: "Nominal", badge: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  attention: { label: "Attention", badge: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertTriangle },
  alert: { label: "Alerte", badge: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
  not_instrumented: { label: "Non instrumenté", badge: "bg-gray-100 text-gray-500 border-gray-200", icon: HelpCircle },
};

const SEVERITY_DOT: Record<AgentSignal["severity"], string> = {
  info: "bg-gray-300",
  warning: "bg-orange-400",
  high: "bg-red-400",
  critical: "bg-red-600",
};

export default function MultiAgentTeamPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Équipe Multi-Agent
          </h1>
          <p className="text-gray-500">
            11 agents fonctionnels (spécialité métier) consomment les remontées des agents topologiques
            (Equipment/Site/Global) pour raisonner par domaine. Chaque signal ci-dessous est une requête réelle
            sur l'état actuel du système — pas une simulation.
          </p>
        </div>

        <Tabs defaultValue="team">
          <TabsList>
            <TabsTrigger value="team">Équipe</TabsTrigger>
            <TabsTrigger value="arbitration">Arbitrage (Supervisor)</TabsTrigger>
          </TabsList>
          <TabsContent value="team"><TeamTab /></TabsContent>
          <TabsContent value="arbitration"><ArbitrationTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: FunctionalAgentAssessment }) {
  const Icon = DOMAIN_ICONS[agent.domain] ?? HelpCircle;
  const style = STATUS_STYLE[agent.status];
  const StatusIcon = style.icon;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Icon className="w-4 h-4 text-blue-600" />
            {agent.name}
          </CardTitle>
          <Badge variant="outline" className={style.badge}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {style.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-gray-600">{agent.summary}</p>
        <div className="space-y-1">
          {agent.signals.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${SEVERITY_DOT[s.severity]}`} />
              <span className="text-gray-500">{s.label} : <span className="font-medium text-gray-700">{String(s.value)}</span></span>
            </div>
          ))}
        </div>
        {agent.recommendations.length > 0 && (
          <div className="pt-2 border-t border-gray-100 space-y-1">
            {agent.recommendations.map((r, i) => (
              <p key={i} className="text-xs text-blue-700">→ {r}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TeamTab() {
  const { data: agents, isLoading } = useQuery<FunctionalAgentAssessment[]>({ queryKey: ["/api/functional-agents"] });

  return (
    <div className="space-y-4 mt-4">
      {isLoading && <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Évaluation des 11 agents en cours…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(agents ?? []).map((a) => <AgentCard key={a.domain} agent={a} />)}
      </div>
      <TrainingGapsPanel />
    </div>
  );
}

function TrainingGapsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: gaps } = useQuery<CompetencyGap[]>({ queryKey: ["/api/techlearn-bridge/gaps"] });
  const { data: bridgeStatus } = useQuery<{ configured: boolean }>({ queryKey: ["/api/techlearn-bridge/status"] });

  const requestTraining = useMutation({
    mutationFn: (workOrderId: number) => apiRequest("/api/techlearn-bridge/request-training", { method: "POST", body: { workOrderId } }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/techlearn-bridge/gaps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/techlearn-bridge/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/functional-agents"] });
      toast({
        title: "Formation demandée",
        description: data.techlearnConnected
          ? `TP recommandé : ${data.request.techlearn_tp_title ?? "en cours de recherche côté TechLearn"}`
          : "Écart enregistré côté Maintrix — TechLearn n'est pas joignable pour le moment (dégradation gracieuse).",
      });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="bg-purple-50 border-purple-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-purple-700" />
          Training Agent — pont TechLearn
        </CardTitle>
        <CardDescription className="text-xs">
          {bridgeStatus && !bridgeStatus.configured && "TechLearn non configuré (TECHLEARN_API_URL / TECHLEARN_SERVICE_TOKEN absents) — la détection reste 100% réelle côté Maintrix, seule la recommandation de TP externe est indisponible."}
          {bridgeStatus?.configured && "Connecté à TechLearn (LearnSmartHub)."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {(gaps ?? []).length === 0 && <p className="text-xs text-purple-700">Aucun écart de compétence détecté sur les OT ouverts.</p>}
        {(gaps ?? []).map((g) => (
          <div key={g.workOrderId} className="flex items-center justify-between bg-white rounded-lg border border-purple-100 px-3 py-2">
            <div className="text-xs">
              <span className="font-medium">{g.technicianName}</span> n'a jamais traité un équipement de type
              <span className="font-medium"> "{g.equipmentType}"</span> — OT {g.orderNumber} ({g.equipmentName})
            </div>
            <Button size="sm" variant="outline" onClick={() => requestTraining.mutate(g.workOrderId)} disabled={requestTraining.isPending}>
              {requestTraining.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Former le technicien
            </Button>
          </div>
        ))}
        <TrainingRequestsList />
      </CardContent>
    </Card>
  );
}

function TrainingRequestsList() {
  const { data: requests } = useQuery<TrainingRequestRow[]>({ queryKey: ["/api/techlearn-bridge/requests"] });
  if (!requests || requests.length === 0) return null;

  return (
    <div className="pt-2 border-t border-purple-100 space-y-1">
      <p className="text-xs font-medium text-purple-800">Demandes de formation</p>
      {requests.map((r) => (
        <div key={r.id} className="flex items-center justify-between text-xs bg-white rounded-lg border border-purple-100 px-3 py-2">
          <span>
            {[r.first_name, r.last_name].filter(Boolean).join(" ")} — {r.equipment_type} {r.order_number ? `(OT ${r.order_number})` : ""}
            {r.techlearn_tp_title && <span className="text-gray-500"> · TP : {r.techlearn_tp_title}</span>}
            {r.techlearn_score !== null && <span className="text-gray-500"> · Score : {r.techlearn_score}%</span>}
          </span>
          <Badge variant="outline">{TRAINING_STATUS_LABEL[r.status] ?? r.status}</Badge>
        </div>
      ))}
    </div>
  );
}

function ArbitrationTab() {
  const { data, isLoading } = useQuery<SupervisorArbitration>({ queryKey: ["/api/functional-agents/arbitration"] });

  return (
    <div className="space-y-4 mt-4">
      {isLoading && <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Arbitrage en cours…</p>}

      <Card className="bg-blue-50 border-blue-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Crown className="w-4 h-4 text-blue-700" />Supervisor Agent</CardTitle>
          <CardDescription className="text-xs">
            Évolution du rôle tenu par cognitive-kernel/index.ts (portée topologique) vers l'arbitrage de la dimension
            fonctionnelle : agrège les 11 domaines et priorise ce qui mérite l'attention en premier.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-red-600">{data?.domainsInAlert.length ?? "—"}</div>
            <p className="text-xs text-gray-500">Domaines en alerte</p>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-500">{data?.domainsNeedingAttention.length ?? "—"}</div>
            <p className="text-xs text-gray-500">Domaines à surveiller</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(data?.priorities ?? []).map((p, i) => {
          const Icon = DOMAIN_ICONS[p.domain] ?? HelpCircle;
          return (
            <Card key={i}>
              <CardContent className="pt-4 flex items-start gap-3">
                <Badge variant="outline" className="flex-shrink-0">{i + 1}</Badge>
                <Icon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{p.agentName}</p>
                  <p className="text-xs text-gray-500">{p.reason}</p>
                  <p className="text-xs text-blue-700 mt-1">→ {p.recommendation}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {data && data.priorities.length === 0 && (
          <p className="text-sm text-gray-400">Aucune priorité — tous les domaines sont nominaux.</p>
        )}
      </div>
    </div>
  );
}
