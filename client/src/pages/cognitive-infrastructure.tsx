import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Brain, Cpu, Network, Activity, Shield, Database,
  GitBranch, Zap, Eye, Settings, BarChart3, AlertTriangle,
  CheckCircle, XCircle, Clock, Users, Globe, Server,
  ChevronRight, ArrowUpDown, Target, Gauge, Radio,
  TrendingUp, Workflow, Cog, RefreshCw
} from "lucide-react";
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

const AUTONOMY_LABELS: Record<number, { name: string; desc: string; color: string }> = {
  0: { name: "Monitoring", desc: "Observation pure — aucune action automatique", color: "bg-gray-500" },
  1: { name: "Diagnostic assiste", desc: "Suggestions avec validation humaine obligatoire", color: "bg-etat-encours-vif" },
  2: { name: "Recommandation auto", desc: "Creation automatique d'alertes et ordres de travail", color: "bg-etat-encours-vif" },
  3: { name: "Execution supervisee", desc: "Actions automatiques avec supervision humaine", color: "bg-etat-alerte-vif" },
  4: { name: "Autonomie partielle", desc: "Decisions autonomes sur incidents non-critiques", color: "bg-etat-alerte-vif" },
  5: { name: "Autonomie complete", desc: "Orchestration entierement autonome", color: "bg-etat-critique-vif" }
};

const MODULE_CONFIG = [
  {
    id: "a",
    title: "Reception de signaux capteurs",
    icon: Radio,
    color: "bg-etat-encours-vif",
    bgColor: "bg-etat-encours-fond border-etat-encours-filet",
    textColor: "text-etat-encours-texte",
    description: "Interface materielle recevant les signaux de capteurs physiques (vibratoires, thermiques, electriques, pression, debit, vitesse, acoustiques) via MQTT, Modbus, OPC-UA, LoRaWAN",
    metrics: ["SensorSignal types", "Protocoles actifs", "Qualite signal"]
  },
  {
    id: "b",
    title: "Detection de variations anormales",
    icon: AlertTriangle,
    color: "bg-etat-alerte-vif",
    bgColor: "bg-etat-alerte-fond border-etat-alerte-filet",
    textColor: "text-etat-alerte-texte",
    description: "Comparaison en temps reel des signaux capteurs a des seuils adaptatifs (warning, critical) avec classification par type et severite",
    metrics: ["threshold_breach", "trend_deviation", "pattern_anomaly", "correlation_anomaly"]
  },
  {
    id: "c",
    title: "Modelisation causale dynamique",
    icon: GitBranch,
    color: "bg-signal-deep",
    bgColor: "bg-paper-deep border-rule",
    textColor: "text-signal-deep",
    description: "Graphe de connaissances industriel avec 5 types de noeuds, 7 types de relations ponderees, raisonnement par parcours de graphe et prediction de cascades",
    metrics: ["Noeuds", "Relations", "Confiance moyenne"]
  },
  {
    id: "d",
    title: "Module decisionnel adaptatif",
    icon: Cog,
    color: "bg-etat-nominal-vif",
    bgColor: "bg-etat-nominal-fond border-etat-nominal-filet",
    textColor: "text-etat-nominal-texte",
    description: "Generation de signaux de commande avec moteur de politiques a 6 niveaux d'autonomie graduee, ciblant PLC, SCADA, DCS, ERP, GMAO",
    metrics: ["Niveau autonomie", "Politiques actives", "Decisions auditees"]
  },
  {
    id: "e",
    title: "Adaptation dynamique du modele",
    icon: RefreshCw,
    color: "bg-etat-critique-vif",
    bgColor: "bg-etat-critique-fond border-etat-critique-filet",
    textColor: "text-etat-critique-texte",
    description: "Modification de la structure causale selon les resultats d'interventions : ajustement des poids (+0.02/+0.03 succes, -0.05 echec), capitalisation memoire de pannes",
    metrics: ["Interventions capitalisees", "Poids ajustes", "Patterns decouverts"]
  }
];

const COOPERATIVE_OBJECTIVES = [
  {
    icon: TrendingUp,
    title: "Limiter les derives techniques",
    description: "Detection continue des variations anormales et declenchement d'actions correctives avant que les parametres ne sortent des plages nominales",
    color: "text-etat-encours-texte",
    bgColor: "bg-etat-encours-fond border-etat-encours-filet"
  },
  {
    icon: Workflow,
    title: "Reduire les defaillances en cascade",
    description: "Raisonnement causal predictif identifiant les effets en cascade avec probabilite cumulative, permettant des interventions preventives ciblees",
    color: "text-signal-deep",
    bgColor: "bg-paper-deep border-rule"
  },
  {
    icon: Activity,
    title: "Stabiliser le comportement operationnel",
    description: "Boucle fermee a 6 phases (Detection → Diagnostic → Decision → Action → Retroaction → Apprentissage) assurant l'amelioration continue du modele causal",
    color: "text-etat-nominal-texte",
    bgColor: "bg-etat-nominal-fond border-etat-nominal-filet"
  }
];

export default function CognitiveInfrastructure() {
  const { toast } = useToast();
  const [whatIfEquipmentId, setWhatIfEquipmentId] = useState("1");
  const [whatIfTempIncrease, setWhatIfTempIncrease] = useState("10");
  const [whatIfVibIncrease, setWhatIfVibIncrease] = useState("2");
  const [reasoningSymptoms, setReasoningSymptoms] = useState("vibration");

  const { data: status, isLoading: statusLoading } = useQuery<any>({
    queryKey: ["/api/cognitive/status"],
    refetchInterval: 10000
  });

  const { data: autonomy } = useQuery<any>({ queryKey: ["/api/cognitive/autonomy"] });
  const { data: agents } = useQuery<any>({ queryKey: ["/api/cognitive/agents"] });
  const { data: policies } = useQuery<any>({ queryKey: ["/api/cognitive/policies"] });
  const { data: auditLog } = useQuery<any>({ queryKey: ["/api/cognitive/audit-log"] });
  const { data: knowledgeGraph } = useQuery<any>({ queryKey: ["/api/cognitive/knowledge-graph"] });
  const { data: globalLearning } = useQuery<any>({ queryKey: ["/api/cognitive/global-learning"] });

  const setAutonomyMutation = useMutation({
    mutationFn: async (level: number) => {
      return apiRequest("/api/cognitive/autonomy", { method: "PUT", body: { level } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cognitive/autonomy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cognitive/status"] });
      toast({ title: "Niveau d'autonomie mis a jour" });
    }
  });

  const whatIfMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/cognitive/what-if", {
        method: "POST",
        body: {
          equipmentId: parseInt(whatIfEquipmentId),
          conditions: {
            temperatureIncrease: parseFloat(whatIfTempIncrease),
            vibrationIncrease: parseFloat(whatIfVibIncrease)
          }
        }
      });
    }
  });

  const reasoningMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/cognitive/knowledge-graph/reason", {
        method: "POST",
        body: { symptoms: reasoningSymptoms.split(",").map(s => s.trim()) }
      });
    }
  });

  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-16 h-16 text-signal-deep animate-pulse mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Chargement du systeme de supervision...</h2>
        </div>
      </div>
    );
  }

  const kernelStatus = status?.kernel;
  const kgStats = knowledgeGraph?.stats;

  return (
    <AppShell filAriane={[{ libelle: "Supervision" }, { libelle: "Supervision adaptative" }]} largeur="large">
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-ink">
              Supervision & Controle Adaptatif
            </h1>
            <p className="text-ink-mute mt-1">Systeme a modelisation causale dynamique — 5 modules cooperatifs — Autonomie graduee</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`${kernelStatus?.isRunning ? 'bg-etat-nominal-fond text-etat-nominal-texte border border-etat-nominal-filet' : 'bg-etat-critique-fond text-etat-critique-texte border border-etat-critique-filet'} text-sm px-3 py-1`}>
              {kernelStatus?.isRunning ? "SYSTEME ACTIF" : "SYSTEME INACTIF"}
            </Badge>
            <Badge className="bg-paper-deep text-signal-deep border border-rule text-sm px-3 py-1">
              <Gauge className="w-4 h-4 mr-1 inline" />
              Autonomie: {AUTONOMY_LABELS[kernelStatus?.autonomyLevel || 0]?.name}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <MetricCard icon={<Radio className="w-5 h-5 text-etat-encours-texte" />} label="Capteurs actifs" value={kernelStatus?.agents?.active || 0} />
          {/* Ces deux compteurs décrivent le RÉFÉRENTIEL livré, pas le parc du
              locataire. Côte à côte avec « Capteurs actifs », qui lui est bien
              mesuré, l'intitulé seul les distinguait mal. */}
          <MetricCard icon={<Network className="w-5 h-5 text-etat-encours-texte" />} label="Noeuds du référentiel" value={kernelStatus?.knowledgeGraph?.nodes || 0} />
          <MetricCard icon={<GitBranch className="w-5 h-5 text-signal-deep" />} label="Relations du référentiel" value={kernelStatus?.knowledgeGraph?.edges || 0} />
          {/* Les politiques livrées par défaut comptent ici au même titre que
              celles qu'une organisation définirait — or elle n'en a défini
              aucune. L'intitulé le dit désormais. */}
          <MetricCard icon={<Shield className="w-5 h-5 text-etat-nominal-texte" />} label="Politiques par défaut" value={kernelStatus?.policyCount || 0} />
          <MetricCard icon={<Activity className="w-5 h-5 text-etat-alerte-texte" />} label="Decisions auditees" value={kernelStatus?.decisionAuditCount || 0} />
          <MetricCard icon={<RefreshCw className="w-5 h-5 text-etat-critique-texte" />} label="Adaptations" value={kernelStatus?.modelCount || 0} />
        </div>

        <Tabs defaultValue="modules" className="space-y-4">
          <TabsList className="bg-white border border-rule shadow-sm">
            <TabsTrigger value="modules" className="data-[state=active]:bg-signal-deep data-[state=active]:text-white">5 Modules</TabsTrigger>
            <TabsTrigger value="objectives" className="data-[state=active]:bg-signal-deep data-[state=active]:text-white">3 Objectifs</TabsTrigger>
            <TabsTrigger value="agents" className="data-[state=active]:bg-signal-deep data-[state=active]:text-white">Agents</TabsTrigger>
            <TabsTrigger value="autonomy" className="data-[state=active]:bg-signal-deep data-[state=active]:text-white">Autonomie</TabsTrigger>
            <TabsTrigger value="knowledge" className="data-[state=active]:bg-signal-deep data-[state=active]:text-white">Modele Causal</TabsTrigger>
            <TabsTrigger value="reasoning" className="data-[state=active]:bg-signal-deep data-[state=active]:text-white">Raisonnement</TabsTrigger>
            <TabsTrigger value="governance" className="data-[state=active]:bg-signal-deep data-[state=active]:text-white">Gouvernance</TabsTrigger>
          </TabsList>

          <TabsContent value="modules" className="space-y-4">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2">
              <Cpu className="w-5 h-5 text-signal-deep" /> Architecture a 5 modules cooperatifs
            </h2>
            <p className="text-sm text-ink-mute">Chaque module du systeme de supervision et controle adaptatif est operationnel et interconnecte.</p>

            <div className="grid gap-3">
              {MODULE_CONFIG.map((mod, idx) => {
                const Icon = mod.icon;
                return (
                  <Card key={mod.id} className={`${mod.bgColor} shadow-sm`}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className={`w-12 h-12 rounded-lg ${mod.color} shadow-sm flex items-center justify-center`}>
                        <Icon className="w-6 h-6 text-ink" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink-mute font-bold uppercase">Module ({mod.id})</span>
                          <ChevronRight className="w-3 h-3 text-ink-mute" />
                          <span className="font-semibold text-ink">{mod.title}</span>
                        </div>
                        <p className="text-sm text-ink-soft mt-0.5">{mod.description}</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {mod.metrics.map((m, i) => (
                            <Badge key={i} className="bg-white text-ink-soft border border-rule text-xs">{m}</Badge>
                          ))}
                        </div>
                      </div>
                      <Badge className="bg-etat-nominal-fond text-etat-nominal-texte border border-etat-nominal-filet">Actif</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className="bg-white border border-rule shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-ink flex items-center gap-2"><Activity className="w-5 h-5 text-etat-encours-texte" /> Boucle fermee industrielle</CardTitle>
                <CardDescription className="text-ink-mute">Les 5 modules cooperent dans une boucle a 6 phases continues</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {['Detection', 'Diagnostic', 'Decision', 'Action', 'Retroaction', 'Apprentissage'].map((phase, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="px-3 py-2 rounded-lg bg-paper-deep border border-rule text-sm font-medium text-signal-deep">
                        {phase}
                      </div>
                      {i < 5 && <ChevronRight className="w-4 h-4 text-signal" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="objectives" className="space-y-4">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2">
              <Target className="w-5 h-5 text-etat-nominal-texte" /> 3 Objectifs cooperatifs
            </h2>
            <p className="text-sm text-ink-mute">Les 5 modules cooperent pour atteindre ces 3 objectifs fondamentaux de supervision industrielle.</p>

            <div className="grid gap-4">
              {COOPERATIVE_OBJECTIVES.map((obj, idx) => {
                const Icon = obj.icon;
                return (
                  <Card key={idx} className={`${obj.bgColor} shadow-sm`}>
                    <CardContent className="flex items-start gap-4 py-5">
                      <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center flex-shrink-0">
                        <Icon className={`w-6 h-6 ${obj.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-ink text-lg">{obj.title}</h3>
                        <p className="text-sm text-ink-soft mt-1">{obj.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="agents" className="space-y-4">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2"><Users className="w-5 h-5 text-etat-encours-texte" /> Systeme multi-agent hierarchique</h2>

            <div className="grid md:grid-cols-3 gap-4">
              <Card className="bg-etat-encours-fond border border-etat-encours-filet shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-ink flex items-center gap-2"><Cpu className="w-4 h-4 text-etat-encours-texte" /> Agents Equipement</CardTitle>
                  <CardDescription className="text-ink-mute">Perception locale, memoire par machine</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-etat-encours-texte">{kernelStatus?.agents?.byType?.equipment || 0}</div>
                  <p className="text-sm text-ink-mute mt-1">Un agent par equipement surveille</p>
                </CardContent>
              </Card>

              <Card className="bg-etat-encours-fond border border-etat-encours-filet shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-ink flex items-center gap-2"><Network className="w-4 h-4 text-etat-encours-texte" /> Agents Site</CardTitle>
                  <CardDescription className="text-ink-mute">Coordination locale, prevention cascade</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-etat-encours-texte">{kernelStatus?.agents?.byType?.site || 0}</div>
                  <p className="text-sm text-ink-mute mt-1">Correlation inter-equipements</p>
                </CardContent>
              </Card>

              <Card className="bg-paper-deep border border-rule shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-ink flex items-center gap-2"><Globe className="w-4 h-4 text-signal-deep" /> Agent Global</CardTitle>
                  <CardDescription className="text-ink-mute">Apprentissage federe inter-sites</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-signal-deep">{kernelStatus?.agents?.byType?.global || 0}</div>
                  <p className="text-sm text-ink-mute mt-1">Diffusion patterns globaux</p>
                </CardContent>
              </Card>
            </div>

            {agents?.agents && (
              <Card className="bg-white border border-rule shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-ink">Registre des agents actifs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {agents.agents.map((agent: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-paper border border-slate-100">
                        <div className="flex items-center gap-2">
                          {agent.agentType === 'equipment' ? <Cpu className="w-4 h-4 text-etat-encours-texte" /> :
                           agent.agentType === 'site' ? <Network className="w-4 h-4 text-etat-encours-texte" /> :
                           <Globe className="w-4 h-4 text-signal-deep" />}
                          <span className="text-sm font-mono text-ink-soft">{agent.agentId}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={agent.status === 'active' ? 'bg-etat-nominal-fond text-etat-nominal-texte border border-etat-nominal-filet' : 'bg-etat-critique-fond text-etat-critique-texte border border-etat-critique-filet'}>{agent.status}</Badge>
                          <span className="text-xs text-ink-mute">Events: {agent.processedEvents}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {globalLearning && (
              <Card className="bg-white border border-rule shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-ink flex items-center gap-2"><BarChart3 className="w-4 h-4 text-etat-nominal-texte" /> Apprentissage federe</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div><span className="text-ink-mute text-sm">Sites</span><div className="text-xl font-bold text-ink">{globalLearning.siteCount}</div></div>
                    <div><span className="text-ink-mute text-sm">Equipements</span><div className="text-xl font-bold text-ink">{globalLearning.totalEquipment}</div></div>
                    <div><span className="text-ink-mute text-sm">Patterns</span><div className="text-xl font-bold text-ink">{globalLearning.patternsDiscovered}</div></div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="autonomy" className="space-y-4">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2"><ArrowUpDown className="w-5 h-5 text-etat-alerte-texte" /> 6 niveaux d'autonomie graduee</h2>
            <p className="text-sm text-ink-mute">Le module decisionnel (d) utilise ces niveaux pour determiner le degre d'autonomie des actions correctives.</p>

            <div className="grid gap-3">
              {autonomy?.levels?.map((level: any) => {
                const config = AUTONOMY_LABELS[level.level];
                const isCurrent = level.level === kernelStatus?.autonomyLevel;
                return (
                  <Card key={level.level} className={`border transition-all shadow-sm ${isCurrent ? 'bg-paper-deep border-rule ring-2 ring-signal' : 'bg-white border-rule hover:border-rule'}`}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className={`w-10 h-10 rounded-full ${config?.color || 'bg-gray-500'} flex items-center justify-center text-lg font-bold text-white`}>
                        {level.level}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-ink">{level.name}</div>
                        <div className="text-sm text-ink-mute">{level.description}</div>
                      </div>
                      {isCurrent ? (
                        <Badge className="bg-signal-deep text-white">ACTUEL</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-rule text-ink-soft hover:bg-paper"
                          onClick={() => setAutonomyMutation.mutate(level.level)}
                          disabled={setAutonomyMutation.isPending}
                        >
                          Activer
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="knowledge" className="space-y-4">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2"><Database className="w-5 h-5 text-etat-critique-texte" /> Modele causal — Graphe de connaissances</h2>
            <p className="text-sm text-ink-mute">Module (c) : modelisation causale structurant les relations entre parametres et defaillances.</p>

            {/* ⚠️ Ces 49 nœuds et 50 relations ne proviennent PAS des données du
                locataire : c'est un référentiel d'ingénierie livré avec la
                plateforme, identique pour tous. Affiché sans mention, au milieu
                de compteurs réels (« 0 capteurs actifs », « 0 décisions
                auditées »), il se lit comme une mesure du parc — un exploitant
                sans la moindre saisie y voyait un graphe de connaissances
                abondant. Signalé le 2026-10-13. */}
            <div className="border border-rule bg-paper rounded px-4 py-3 text-sm text-ink-soft">
              <span className="font-medium text-ink">Référentiel livré avec la plateforme.</span>{" "}
              Ce graphe encode des relations de cause à effet établies en ingénierie de
              maintenance — « vibration élevée indique un roulement usé », par exemple.
              Il est <strong>identique pour toutes les organisations</strong> et ne reflète
              pas vos équipements. Il sert de point de départ au diagnostic ; votre
              historique l'enrichit au fil des interventions.
            </div>

            {kgStats && (
              <>
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="bg-white border border-rule shadow-sm">
                    <CardContent className="pt-4">
                      <div className="text-3xl font-bold text-etat-critique-texte">{kgStats.totalNodes}</div>
                      <p className="text-sm text-ink-mute">Noeuds causaux (5 types)</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white border border-rule shadow-sm">
                    <CardContent className="pt-4">
                      <div className="text-3xl font-bold text-etat-encours-texte">{kgStats.totalEdges}</div>
                      <p className="text-sm text-ink-mute">Relations ponderees (7 types)</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white border border-rule shadow-sm">
                    <CardContent className="pt-4">
                      {/* ⚠️ Ce n'est pas une confiance MESURÉE : c'est la moyenne des
                          poids attribués a priori par des experts aux relations du
                          référentiel. Intitulée « confiance », elle se lisait comme une
                          précision de modèle — « notre IA est fiable à 78 % ». */}
                      <div className="text-3xl font-bold text-etat-nominal-texte">{(kgStats.avgConfidence * 100).toFixed(0)}%</div>
                      <p className="text-sm text-ink-mute">Poids moyen attribué aux relations</p>
                      <p className="text-xs text-ink-mute mt-1">
                        Valeurs d'expert du référentiel, non mesurées sur votre parc
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="bg-white border border-rule shadow-sm">
                    <CardHeader><CardTitle className="text-base text-ink">Types de noeuds</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(kgStats.nodesByType || {}).map(([type, count]: [string, any]) => (
                          <div key={type} className="flex justify-between items-center p-2 bg-paper rounded border border-slate-100">
                            <span className="text-sm text-ink-soft capitalize">{type}</span>
                            <Badge className="bg-paper-deep text-signal-deep border border-rule">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border border-rule shadow-sm">
                    <CardHeader><CardTitle className="text-base text-ink">Types de relations</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(kgStats.edgesByType || {}).map(([type, count]: [string, any]) => (
                          <div key={type} className="flex justify-between items-center p-2 bg-paper rounded border border-slate-100">
                            <span className="text-sm text-ink-soft">{type}</span>
                            <Badge className="bg-etat-encours-fond text-etat-encours-texte border border-etat-encours-filet">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-white border border-rule shadow-sm">
                  <CardHeader><CardTitle className="text-base text-ink">Noeuds les plus connectes</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {kgStats.mostConnectedNodes?.slice(0, 8).map((node: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-paper rounded border border-slate-100">
                          <span className="text-sm text-ink-soft">{node.label}</span>
                          <span className="text-sm text-signal-deep font-mono">{node.connections} connexions</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="reasoning" className="space-y-4">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2"><Brain className="w-5 h-5 text-signal-deep" /> Raisonnement causal & Simulation</h2>
            <p className="text-sm text-ink-mute">Interrogez le module de modelisation causale (c) avec des symptomes ou simulez des conditions hypothetiques.</p>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-white border border-rule shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-ink flex items-center gap-2"><Target className="w-4 h-4 text-etat-encours-texte" /> Raisonnement par symptomes</CardTitle>
                  <CardDescription className="text-ink-mute">Parcours du graphe causal : Symptome → Cause → Intervention</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    className="border-rule text-ink"
                    placeholder="vibration, surchauffe, bruit..."
                    value={reasoningSymptoms}
                    onChange={(e) => setReasoningSymptoms(e.target.value)}
                  />
                  <Button
                    onClick={() => reasoningMutation.mutate()}
                    disabled={reasoningMutation.isPending}
                    className="bg-signal-deep hover:bg-signal-deep w-full text-white"
                  >
                    {reasoningMutation.isPending ? "Analyse causale..." : "Lancer le raisonnement causal"}
                  </Button>

                  {reasoningMutation.data && (
                    <div className="mt-4 space-y-3">
                      {(reasoningMutation.data as any).diagnosis?.map((d: any, i: number) => (
                        <div key={i} className="p-3 bg-paper rounded border-l-4 border-rule">
                          <div className="flex justify-between">
                            <span className="font-semibold text-ink">{d.cause}</span>
                            <Badge className={d.confidence > 0.7 ? 'bg-etat-critique-fond text-etat-critique-texte border border-etat-critique-filet' : 'bg-etat-alerte-fond text-etat-alerte-texte border border-etat-alerte-filet'}>{(d.confidence * 100).toFixed(0)}%</Badge>
                          </div>
                          {d.evidence?.map((e: string, j: number) => (
                            <p key={j} className="text-xs text-ink-mute mt-1">{e}</p>
                          ))}
                        </div>
                      ))}
                      {(reasoningMutation.data as any).cascadeRisks?.length > 0 && (
                        <div className="p-3 bg-etat-critique-fond rounded border border-etat-critique-filet">
                          <h4 className="font-semibold text-etat-critique-texte text-sm mb-1">Risques de cascade detectes</h4>
                          {(reasoningMutation.data as any).cascadeRisks.map((r: any, i: number) => (
                            <p key={i} className="text-xs text-etat-critique-texte">{r.effect} — probabilite: {(r.probability * 100).toFixed(0)}%</p>
                          ))}
                        </div>
                      )}
                      {(reasoningMutation.data as any).recommendedActions?.map((a: any, i: number) => (
                        <div key={i} className="p-2 bg-etat-nominal-fond rounded border border-etat-nominal-filet text-sm">
                          <span className="text-etat-nominal-texte font-medium">{a.action}</span>
                          <span className="text-ink-mute ml-2">({a.duration}min, {a.cost}EUR)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white border border-rule shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-ink flex items-center gap-2"><Zap className="w-4 h-4 text-etat-alerte-texte" /> Simulation What-If</CardTitle>
                  <CardDescription className="text-ink-mute">Simulez des conditions pour predire les defaillances en cascade</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-ink-mute font-medium">Equipment ID</label>
                      <Input className="border-rule text-ink" value={whatIfEquipmentId} onChange={e => setWhatIfEquipmentId(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-ink-mute font-medium">Hausse temperature (C)</label>
                      <Input className="border-rule text-ink" value={whatIfTempIncrease} onChange={e => setWhatIfTempIncrease(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-ink-mute font-medium">Hausse vibration (mm/s)</label>
                    <Input className="border-rule text-ink" value={whatIfVibIncrease} onChange={e => setWhatIfVibIncrease(e.target.value)} />
                  </div>
                  <Button
                    onClick={() => whatIfMutation.mutate()}
                    disabled={whatIfMutation.isPending}
                    className="bg-etat-alerte-vif hover:bg-etat-alerte-vif w-full text-white"
                  >
                    {whatIfMutation.isPending ? "Simulation..." : "Lancer la simulation"}
                  </Button>

                  {whatIfMutation.data && (
                    <div className="mt-4 space-y-2 p-3 bg-paper rounded border border-rule">
                      <div className="flex justify-between">
                        <span className="text-sm text-ink-soft">Probabilite de defaillance</span>
                        <span className="font-bold text-etat-critique-texte">{((whatIfMutation.data as any).failureProbability * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-ink-soft">Temps avant defaillance</span>
                        <span className="font-bold text-etat-alerte-texte">{(whatIfMutation.data as any).estimatedTimeToFailure}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-ink-soft">Impact financier</span>
                        <span className="font-bold text-etat-alerte-texte">{(whatIfMutation.data as any).costImplication}EUR</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-ink-soft">Tendance risque</span>
                        <Badge className={(whatIfMutation.data as any).riskChange === 'INCREASED' ? 'bg-etat-critique-fond text-etat-critique-texte border border-etat-critique-filet' : 'bg-etat-nominal-fond text-etat-nominal-texte border border-etat-nominal-filet'}>
                          {(whatIfMutation.data as any).riskChange}
                        </Badge>
                      </div>
                      <div className="mt-2">
                        <span className="text-xs text-ink-mute font-medium">Actions recommandees:</span>
                        {(whatIfMutation.data as any).recommendedActions?.map((a: string, i: number) => (
                          <p key={i} className="text-sm text-etat-nominal-texte mt-1">• {a}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="governance" className="space-y-4">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2"><Shield className="w-5 h-5 text-etat-nominal-texte" /> Gouvernance & Tracabilite decisionnelle</h2>
            <p className="text-sm text-ink-mute">Journal d'audit du module decisionnel (d) — tracabilite conforme ISO 55000 / CCTP.</p>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-white border border-rule shadow-sm">
                <CardHeader><CardTitle className="text-base text-ink">Moteur de politiques ({policies?.policies?.length || 0} regles)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {policies?.policies?.map((p: any, i: number) => (
                      <div key={i} className="p-3 bg-paper rounded border border-slate-100">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm text-ink">{p.name}</span>
                          <div className="flex gap-2">
                            <Badge className={p.enabled ? 'bg-etat-nominal-fond text-etat-nominal-texte border border-etat-nominal-filet' : 'bg-paper-deep text-ink-mute border border-rule'}>{p.enabled ? 'Active' : 'Inactive'}</Badge>
                            <Badge className="bg-paper-deep text-ink-soft border border-rule">P{p.priority}</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-ink-mute mt-1">{p.description}</p>
                        {p.requiresApproval && <Badge className="bg-etat-alerte-fond text-etat-alerte-texte border border-etat-alerte-filet text-xs mt-1">Approbation requise</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-rule shadow-sm">
                <CardHeader><CardTitle className="text-base text-ink">Journal d'audit decisionnel</CardTitle></CardHeader>
                <CardContent>
                  {auditLog?.auditLog?.length === 0 ? (
                    <p className="text-sm text-ink-mute text-center py-8">Aucune decision enregistree. Le journal se remplira au fur et a mesure que le systeme prend des decisions automatiques.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {auditLog?.auditLog?.map((entry: any, i: number) => (
                        <div key={i} className="p-2 bg-paper rounded border border-slate-100 text-sm">
                          <div className="flex justify-between">
                            <span className="font-mono text-xs text-ink-soft">{entry.diagnosisId}</span>
                            <Badge className={entry.decision === 'approved' ? 'bg-etat-nominal-fond text-etat-nominal-texte border border-etat-nominal-filet' : entry.decision === 'escalated' ? 'bg-etat-alerte-fond text-etat-alerte-texte border border-etat-alerte-filet' : 'bg-etat-encours-fond text-etat-encours-texte border border-etat-encours-filet'}>
                              {entry.decision}
                            </Badge>
                          </div>
                          <p className="text-xs text-ink-mute mt-1">{entry.evidenceSummary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </AppShell>
  );
}

function MetricCard({ icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card className="bg-white border border-rule shadow-sm">
      <CardContent className="flex items-center gap-3 py-3 px-4">
        {icon}
        <div>
          <div className="text-lg font-bold text-ink">{value}</div>
          <div className="text-xs text-ink-mute">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
