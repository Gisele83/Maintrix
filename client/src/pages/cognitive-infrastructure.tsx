import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Brain, Cpu, Network, Activity, Shield, Database, Layers,
  GitBranch, Zap, Eye, Settings, BarChart3, AlertTriangle,
  CheckCircle, XCircle, Clock, Users, Globe, Server,
  ChevronRight, ArrowUpDown, Target, Gauge
} from "lucide-react";

const AUTONOMY_LABELS: Record<number, { name: string; desc: string; color: string }> = {
  0: { name: "Monitoring", desc: "Observation pure — aucune action automatique", color: "bg-gray-500" },
  1: { name: "Diagnostic assiste", desc: "Suggestions avec validation humaine obligatoire", color: "bg-blue-500" },
  2: { name: "Recommandation auto", desc: "Creation automatique d'alertes et ordres de travail", color: "bg-cyan-500" },
  3: { name: "Execution supervisee", desc: "Actions automatiques avec supervision humaine", color: "bg-yellow-500" },
  4: { name: "Autonomie partielle", desc: "Decisions autonomes sur incidents non-critiques", color: "bg-orange-500" },
  5: { name: "Autonomie complete", desc: "Orchestration entierement autonome", color: "bg-red-500" }
};

const LAYER_ICONS: Record<string, any> = {
  "Physical Layer": Server,
  "Edge Intelligence Layer": Cpu,
  "Cognitive Core Layer": Brain,
  "Orchestration & Execution Layer": GitBranch,
  "Learning & Knowledge Layer": Database,
  "Governance & Trust Layer": Shield
};

export default function CognitiveInfrastructure() {
  const { toast } = useToast();
  const [whatIfEquipmentId, setWhatIfEquipmentId] = useState("1");
  const [whatIfTempIncrease, setWhatIfTempIncrease] = useState("10");
  const [whatIfVibIncrease, setWhatIfVibIncrease] = useState("2");
  const [reasoningSymptoms, setReasoningSymptoms] = useState("vibration");

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["/api/cognitive/status"],
    refetchInterval: 10000
  });

  const { data: autonomy } = useQuery({ queryKey: ["/api/cognitive/autonomy"] });
  const { data: agents } = useQuery({ queryKey: ["/api/cognitive/agents"] });
  const { data: policies } = useQuery({ queryKey: ["/api/cognitive/policies"] });
  const { data: auditLog } = useQuery({ queryKey: ["/api/cognitive/audit-log"] });
  const { data: knowledgeGraph } = useQuery({ queryKey: ["/api/cognitive/knowledge-graph"] });
  const { data: globalLearning } = useQuery({ queryKey: ["/api/cognitive/global-learning"] });

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
          <Brain className="w-16 h-16 text-purple-500 animate-pulse mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Chargement de l'infrastructure cognitive...</h2>
        </div>
      </div>
    );
  }

  const kernelStatus = status?.kernel;
  const layersList = status?.architecture?.layers || [];
  const kgStats = knowledgeGraph?.stats;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Infrastructure Cognitive Maintrix
            </h1>
            <p className="text-slate-400 mt-1">Architecture 6 couches — Intelligence distribuee — Autonomie graduee</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`${kernelStatus?.isRunning ? 'bg-green-600' : 'bg-red-600'} text-white text-sm px-3 py-1`}>
              {kernelStatus?.isRunning ? "KERNEL ACTIF" : "KERNEL INACTIF"}
            </Badge>
            <Badge className="bg-purple-600 text-white text-sm px-3 py-1">
              <Gauge className="w-4 h-4 mr-1 inline" />
              Autonomie: {AUTONOMY_LABELS[kernelStatus?.autonomyLevel || 0]?.name}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <MetricCard icon={<Brain className="w-5 h-5 text-purple-400" />} label="Agents actifs" value={kernelStatus?.agents?.active || 0} />
          <MetricCard icon={<Network className="w-5 h-5 text-cyan-400" />} label="Noeuds KG" value={kernelStatus?.knowledgeGraph?.nodes || 0} />
          <MetricCard icon={<GitBranch className="w-5 h-5 text-blue-400" />} label="Relations KG" value={kernelStatus?.knowledgeGraph?.edges || 0} />
          <MetricCard icon={<Shield className="w-5 h-5 text-green-400" />} label="Policies" value={kernelStatus?.policyCount || 0} />
          <MetricCard icon={<Activity className="w-5 h-5 text-yellow-400" />} label="Audit entries" value={kernelStatus?.decisionAuditCount || 0} />
          <MetricCard icon={<Database className="w-5 h-5 text-pink-400" />} label="Modeles" value={kernelStatus?.modelCount || 0} />
        </div>

        <Tabs defaultValue="architecture" className="space-y-4">
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="architecture" className="data-[state=active]:bg-purple-600">Architecture</TabsTrigger>
            <TabsTrigger value="agents" className="data-[state=active]:bg-purple-600">Agents</TabsTrigger>
            <TabsTrigger value="autonomy" className="data-[state=active]:bg-purple-600">Autonomie</TabsTrigger>
            <TabsTrigger value="knowledge" className="data-[state=active]:bg-purple-600">Knowledge Graph</TabsTrigger>
            <TabsTrigger value="reasoning" className="data-[state=active]:bg-purple-600">Raisonnement</TabsTrigger>
            <TabsTrigger value="governance" className="data-[state=active]:bg-purple-600">Gouvernance</TabsTrigger>
          </TabsList>

          <TabsContent value="architecture" className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2"><Layers className="w-5 h-5 text-purple-400" /> Architecture 6 couches formelles</h2>
            <div className="grid gap-3">
              {layersList.map((layer: any, idx: number) => {
                const Icon = LAYER_ICONS[layer.name] || Cpu;
                const layerColors = ['from-slate-700 to-slate-800', 'from-blue-900/50 to-blue-800/30', 'from-purple-900/50 to-purple-800/30', 'from-cyan-900/50 to-cyan-800/30', 'from-indigo-900/50 to-indigo-800/30', 'from-green-900/50 to-green-800/30'];
                return (
                  <Card key={idx} className={`bg-gradient-to-r ${layerColors[idx] || 'from-slate-800 to-slate-700'} border-slate-600/50`}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="w-12 h-12 rounded-lg bg-slate-700/50 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Couche {idx + 1}</span>
                          <ChevronRight className="w-3 h-3 text-slate-500" />
                          <span className="font-semibold text-white">{layer.name}</span>
                        </div>
                        <p className="text-sm text-slate-400 mt-0.5">{layer.description}</p>
                      </div>
                      <Badge className={layer.status === 'active' ? 'bg-green-600/80' : 'bg-yellow-600/80'}>{layer.status}</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Activity className="w-5 h-5 text-cyan-400" /> Boucle fermee industrielle</CardTitle>
                <CardDescription className="text-slate-400">Detection → Diagnostic → Decision → Action → Feedback → Apprentissage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {['Detection', 'Diagnostic', 'Decision', 'Action', 'Feedback', 'Apprentissage'].map((phase, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="px-3 py-2 rounded-lg bg-gradient-to-b from-purple-600/40 to-purple-800/40 border border-purple-500/30 text-sm font-medium">
                        {phase}
                      </div>
                      {i < 5 && <ChevronRight className="w-4 h-4 text-purple-400" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agents" className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2"><Users className="w-5 h-5 text-cyan-400" /> Architecture multi-agent distribuee</h2>

            <div className="grid md:grid-cols-3 gap-4">
              <Card className="bg-blue-900/30 border-blue-700/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Cpu className="w-4 h-4" /> Agents Equipement</CardTitle>
                  <CardDescription className="text-blue-300">Perception locale, detection anomalies</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-400">{kernelStatus?.agents?.byType?.equipment || 0}</div>
                  <p className="text-sm text-blue-300/70 mt-1">Modele local + memoire par machine</p>
                </CardContent>
              </Card>

              <Card className="bg-cyan-900/30 border-cyan-700/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Network className="w-4 h-4" /> Agents Site</CardTitle>
                  <CardDescription className="text-cyan-300">Coordination locale, prevention cascade</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-cyan-400">{kernelStatus?.agents?.byType?.site || 0}</div>
                  <p className="text-sm text-cyan-300/70 mt-1">Correlation alertes inter-equipements</p>
                </CardContent>
              </Card>

              <Card className="bg-purple-900/30 border-purple-700/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4" /> Agent Global</CardTitle>
                  <CardDescription className="text-purple-300">Apprentissage inter-sites, patterns globaux</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-400">{kernelStatus?.agents?.byType?.global || 0}</div>
                  <p className="text-sm text-purple-300/70 mt-1">Federated learning cross-tenant</p>
                </CardContent>
              </Card>
            </div>

            {agents?.agents && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-base">Registre des agents</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {agents.agents.map((agent: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-700/50">
                        <div className="flex items-center gap-2">
                          {agent.agentType === 'equipment' ? <Cpu className="w-4 h-4 text-blue-400" /> :
                           agent.agentType === 'site' ? <Network className="w-4 h-4 text-cyan-400" /> :
                           <Globe className="w-4 h-4 text-purple-400" />}
                          <span className="text-sm font-mono">{agent.agentId}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={agent.status === 'active' ? 'bg-green-600/80' : 'bg-red-600/80'}>{agent.status}</Badge>
                          <span className="text-xs text-slate-400">Events: {agent.processedEvents}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {globalLearning && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-green-400" /> Apprentissage global</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div><span className="text-slate-400 text-sm">Sites</span><div className="text-xl font-bold">{globalLearning.siteCount}</div></div>
                    <div><span className="text-slate-400 text-sm">Equipements</span><div className="text-xl font-bold">{globalLearning.totalEquipment}</div></div>
                    <div><span className="text-slate-400 text-sm">Patterns decouverts</span><div className="text-xl font-bold">{globalLearning.patternsDiscovered}</div></div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="autonomy" className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2"><ArrowUpDown className="w-5 h-5 text-yellow-400" /> Niveaux d'autonomie gradues (0-5)</h2>

            <div className="grid gap-3">
              {autonomy?.levels?.map((level: any) => {
                const config = AUTONOMY_LABELS[level.level];
                const isCurrent = level.level === kernelStatus?.autonomyLevel;
                return (
                  <Card key={level.level} className={`border transition-all ${isCurrent ? 'bg-purple-900/40 border-purple-500 ring-2 ring-purple-500/30' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className={`w-10 h-10 rounded-full ${config?.color || 'bg-gray-500'} flex items-center justify-center text-lg font-bold`}>
                        {level.level}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{level.name}</div>
                        <div className="text-sm text-slate-400">{level.description}</div>
                      </div>
                      {isCurrent ? (
                        <Badge className="bg-purple-600">ACTUEL</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-600 text-slate-300 hover:bg-slate-700"
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
            <h2 className="text-xl font-semibold flex items-center gap-2"><Database className="w-5 h-5 text-pink-400" /> Knowledge Graph industriel</h2>

            {kgStats && (
              <>
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="pt-4">
                      <div className="text-3xl font-bold text-pink-400">{kgStats.totalNodes}</div>
                      <p className="text-sm text-slate-400">Noeuds totaux</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="pt-4">
                      <div className="text-3xl font-bold text-cyan-400">{kgStats.totalEdges}</div>
                      <p className="text-sm text-slate-400">Relations totales</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="pt-4">
                      <div className="text-3xl font-bold text-green-400">{(kgStats.avgConfidence * 100).toFixed(0)}%</div>
                      <p className="text-sm text-slate-400">Confiance moyenne</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader><CardTitle className="text-base">Noeuds par type</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(kgStats.nodesByType || {}).map(([type, count]: [string, any]) => (
                          <div key={type} className="flex justify-between items-center p-2 bg-slate-700/50 rounded">
                            <span className="text-sm capitalize">{type}</span>
                            <Badge className="bg-purple-600/80">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader><CardTitle className="text-base">Relations par type</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(kgStats.edgesByType || {}).map(([type, count]: [string, any]) => (
                          <div key={type} className="flex justify-between items-center p-2 bg-slate-700/50 rounded">
                            <span className="text-sm">{type}</span>
                            <Badge className="bg-cyan-600/80">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader><CardTitle className="text-base">Noeuds les plus connectes</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {kgStats.mostConnectedNodes?.slice(0, 8).map((node: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-slate-700/30 rounded">
                          <span className="text-sm">{node.label}</span>
                          <span className="text-sm text-purple-400 font-mono">{node.connections} connexions</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="reasoning" className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2"><Brain className="w-5 h-5 text-purple-400" /> Raisonnement causal & Simulation</h2>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4 text-cyan-400" /> Raisonnement par symptomes</CardTitle>
                  <CardDescription className="text-slate-400">Interrogez le Knowledge Graph avec des symptomes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    className="bg-slate-700 border-slate-600 text-white"
                    placeholder="vibration, surchauffe, bruit..."
                    value={reasoningSymptoms}
                    onChange={(e) => setReasoningSymptoms(e.target.value)}
                  />
                  <Button
                    onClick={() => reasoningMutation.mutate()}
                    disabled={reasoningMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-500 w-full"
                  >
                    {reasoningMutation.isPending ? "Analyse..." : "Analyser les symptomes"}
                  </Button>

                  {reasoningMutation.data && (
                    <div className="mt-4 space-y-3">
                      {(reasoningMutation.data as any).diagnosis?.map((d: any, i: number) => (
                        <div key={i} className="p-3 bg-slate-700/50 rounded border-l-4 border-purple-500">
                          <div className="flex justify-between">
                            <span className="font-semibold">{d.cause}</span>
                            <Badge className={d.confidence > 0.7 ? 'bg-red-600/80' : 'bg-yellow-600/80'}>{(d.confidence * 100).toFixed(0)}%</Badge>
                          </div>
                          {d.evidence?.map((e: string, j: number) => (
                            <p key={j} className="text-xs text-slate-400 mt-1">{e}</p>
                          ))}
                        </div>
                      ))}
                      {(reasoningMutation.data as any).recommendedActions?.map((a: any, i: number) => (
                        <div key={i} className="p-2 bg-green-900/30 rounded text-sm">
                          <span className="text-green-400 font-medium">{a.action}</span>
                          <span className="text-slate-400 ml-2">({a.duration}min, {a.cost}EUR)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" /> Simulation What-If</CardTitle>
                  <CardDescription className="text-slate-400">Simulez des conditions hypothetiques</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-400">Equipment ID</label>
                      <Input className="bg-slate-700 border-slate-600 text-white" value={whatIfEquipmentId} onChange={e => setWhatIfEquipmentId(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Hausse temperature (C)</label>
                      <Input className="bg-slate-700 border-slate-600 text-white" value={whatIfTempIncrease} onChange={e => setWhatIfTempIncrease(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Hausse vibration (mm/s)</label>
                    <Input className="bg-slate-700 border-slate-600 text-white" value={whatIfVibIncrease} onChange={e => setWhatIfVibIncrease(e.target.value)} />
                  </div>
                  <Button
                    onClick={() => whatIfMutation.mutate()}
                    disabled={whatIfMutation.isPending}
                    className="bg-yellow-600 hover:bg-yellow-500 w-full"
                  >
                    {whatIfMutation.isPending ? "Simulation..." : "Lancer la simulation"}
                  </Button>

                  {whatIfMutation.data && (
                    <div className="mt-4 space-y-2 p-3 bg-slate-700/50 rounded">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-400">Probabilite de defaillance</span>
                        <span className="font-bold text-red-400">{((whatIfMutation.data as any).failureProbability * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-400">Temps avant defaillance</span>
                        <span className="font-bold text-yellow-400">{(whatIfMutation.data as any).estimatedTimeToFailure}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-400">Impact financier</span>
                        <span className="font-bold text-orange-400">{(whatIfMutation.data as any).costImplication}EUR</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-400">Tendance risque</span>
                        <Badge className={(whatIfMutation.data as any).riskChange === 'INCREASED' ? 'bg-red-600/80' : 'bg-green-600/80'}>
                          {(whatIfMutation.data as any).riskChange}
                        </Badge>
                      </div>
                      <div className="mt-2">
                        <span className="text-xs text-slate-400">Actions recommandees:</span>
                        {(whatIfMutation.data as any).recommendedActions?.map((a: string, i: number) => (
                          <p key={i} className="text-sm text-green-300 mt-1">• {a}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="governance" className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-green-400" /> Gouvernance & Confiance</h2>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader><CardTitle className="text-base">Policy Engine ({policies?.policies?.length || 0} policies)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {policies?.policies?.map((p: any, i: number) => (
                      <div key={i} className="p-3 bg-slate-700/50 rounded">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">{p.name}</span>
                          <div className="flex gap-2">
                            <Badge className={p.enabled ? 'bg-green-600/80' : 'bg-gray-600/80'}>{p.enabled ? 'Active' : 'Inactive'}</Badge>
                            <Badge className="bg-slate-600">P{p.priority}</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{p.description}</p>
                        {p.requiresApproval && <Badge className="bg-yellow-600/50 text-xs mt-1">Approbation requise</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader><CardTitle className="text-base">Journal d'audit decisionnel</CardTitle></CardHeader>
                <CardContent>
                  {auditLog?.auditLog?.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8">Aucune decision enregistree. Le journal se remplira au fur et a mesure que le systeme prend des decisions.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {auditLog?.auditLog?.map((entry: any, i: number) => (
                        <div key={i} className="p-2 bg-slate-700/50 rounded text-sm">
                          <div className="flex justify-between">
                            <span className="font-mono text-xs">{entry.diagnosisId}</span>
                            <Badge className={entry.decision === 'approved' ? 'bg-green-600/80' : entry.decision === 'escalated' ? 'bg-yellow-600/80' : 'bg-blue-600/80'}>
                              {entry.decision}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">{entry.decisionReason}</p>
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
  );
}

function MetricCard({ icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardContent className="flex items-center gap-3 py-3 px-4">
        {icon}
        <div>
          <div className="text-lg font-bold text-white">{value}</div>
          <div className="text-xs text-slate-400">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
