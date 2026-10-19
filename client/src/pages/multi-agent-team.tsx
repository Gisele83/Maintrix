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
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

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
  nominal: { label: "Nominal", badge: "bg-etat-nominal-fond text-etat-nominal-texte border-etat-nominal-filet", icon: CheckCircle2 },
  attention: { label: "Attention", badge: "bg-etat-alerte-fond text-etat-alerte-texte border-etat-alerte-filet", icon: AlertTriangle },
  alert: { label: "Alerte", badge: "bg-etat-critique-fond text-etat-critique-texte border-etat-critique-filet", icon: AlertTriangle },
  not_instrumented: { label: "Non instrumenté", badge: "bg-paper-deep text-ink-mute border-rule", icon: HelpCircle },
};

const SEVERITY_DOT: Record<AgentSignal["severity"], string> = {
  info: "bg-gray-300",
  warning: "bg-etat-alerte-vif",
  high: "bg-etat-critique-vif",
  critical: "bg-etat-critique-vif",
};

export default function MultiAgentTeamPage() {
  return (
    <AppShell filAriane={[{ libelle: "Exploitation" }, { libelle: "Équipe multi-agent" }]} largeur="large">
    <div className="space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
            <Users className="w-6 h-6 text-etat-encours-texte" />
            Équipe Multi-Agent
          </h1>
          <p className="text-ink-mute">
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
    </AppShell>
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
            <Icon className="w-4 h-4 text-etat-encours-texte" />
            {agent.name}
          </CardTitle>
          <Badge variant="outline" className={style.badge}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {style.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-ink-soft">{agent.summary}</p>
        <div className="space-y-1">
          {agent.signals.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${SEVERITY_DOT[s.severity]}`} />
              <span className="text-ink-mute">{s.label} : <span className="font-medium text-ink-soft">{String(s.value)}</span></span>
            </div>
          ))}
        </div>
        {agent.recommendations.length > 0 && (
          <div className="pt-2 border-t border-gray-100 space-y-1">
            {agent.recommendations.map((r, i) => (
              <p key={i} className="text-xs text-etat-encours-texte">→ {r}</p>
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
      {isLoading && <p className="text-sm text-ink-mute flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Évaluation des 11 agents en cours…</p>}
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
    <Card className="bg-paper-deep border-rule">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-signal-deep" />
          Training Agent — pont TechLearn
        </CardTitle>
        {/* ⚠️ Ce message nommait les deux variables d'environnement manquantes
            — TECHLEARN_API_URL et TECHLEARN_SERVICE_TOKEN — et rassurait
            l'utilisateur sur le fait que « la détection reste 100 % réelle
            côté Maintrix ». C'est une note d'exploitation destinée à
            l'administrateur du serveur, pas au responsable de maintenance qui
            lit cet écran : il n'a ni accès au serveur ni moyen d'agir dessus.
            On lui dit ce que cela change POUR LUI. */}
        <CardDescription className="text-xs">
          {bridgeStatus && !bridgeStatus.configured && "La liaison avec le catalogue de formation n'est pas activée : les écarts de compétence sont détectés, mais aucune formation ne peut être recommandée. Votre administrateur peut activer cette liaison."}
          {bridgeStatus?.configured && "Liaison active avec le catalogue de formation."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {(gaps ?? []).length === 0 && <p className="text-xs text-signal-deep">Aucun écart de compétence détecté sur les OT ouverts.</p>}
        {(gaps ?? []).map((g) => (
          <div key={g.workOrderId} className="flex items-center justify-between bg-white rounded-lg border border-rule px-3 py-2">
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
    <div className="pt-2 border-t border-rule space-y-1">
      <p className="text-xs font-medium text-signal-deep">Demandes de formation</p>
      {requests.map((r) => (
        <div key={r.id} className="flex items-center justify-between text-xs bg-white rounded-lg border border-rule px-3 py-2">
          <span>
            {[r.first_name, r.last_name].filter(Boolean).join(" ")} — {r.equipment_type} {r.order_number ? `(OT ${r.order_number})` : ""}
            {r.techlearn_tp_title && <span className="text-ink-mute"> · TP : {r.techlearn_tp_title}</span>}
            {r.techlearn_score !== null && <span className="text-ink-mute"> · Score : {r.techlearn_score}%</span>}
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
      {isLoading && <p className="text-sm text-ink-mute flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Arbitrage en cours…</p>}

      <Card className="bg-etat-encours-fond border-etat-encours-filet">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Crown className="w-4 h-4 text-etat-encours-texte" />Supervisor Agent</CardTitle>
          <CardDescription className="text-xs">
            Évolution du rôle tenu par cognitive-kernel/index.ts (portée topologique) vers l'arbitrage de la dimension
            fonctionnelle : agrège les 11 domaines et priorise ce qui mérite l'attention en premier.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-etat-critique-texte">{data?.domainsInAlert.length ?? "—"}</div>
            <p className="text-xs text-ink-mute">Domaines en alerte</p>
          </div>
          <div>
            <div className="text-2xl font-bold text-etat-alerte-texte">{data?.domainsNeedingAttention.length ?? "—"}</div>
            <p className="text-xs text-ink-mute">Domaines à surveiller</p>
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
                <Icon className="w-4 h-4 text-etat-encours-texte mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{p.agentName}</p>
                  <p className="text-xs text-ink-mute">{p.reason}</p>
                  <p className="text-xs text-etat-encours-texte mt-1">→ {p.recommendation}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {data && data.priorities.length === 0 && (
          <p className="text-sm text-ink-mute">Aucune priorité — tous les domaines sont nominaux.</p>
        )}
      </div>
    </div>
  );
}
