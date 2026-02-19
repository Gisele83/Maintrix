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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/80 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Infrastructure Cognitive Maintrix
            </h1>
            <p className="text-slate-500 mt-1">Architecture 6 couches — Intelligence distribuee — Autonomie graduee</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`${kernelStatus?.isRunning ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-red-100 text-red-700 border border-red-200'} text-sm px-3 py-1`}>
              {kernelStatus?.isRunning ? "KERNEL ACTIF" : "KERNEL INACTIF"}
            </Badge>
            <Badge className="bg-violet-100 text-violet-700 border border-violet-200 text-sm px-3 py-1">
              <Gauge className="w-4 h-4 mr-1 inline" />
              Autonomie: {AUTONOMY_LABELS[kernelStatus?.autonomyLevel || 0]?.name}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <MetricCard icon={<Brain className="w-5 h-5 text-violet-600" />} label="Agents actifs" value={kernelStatus?.agents?.active || 0} />
          <MetricCard icon={<Network className="w-5 h-5 text-sky-600" />} label="Noeuds KG" value={kernelStatus?.knowledgeGraph?.nodes || 0} />
          <MetricCard icon={<GitBranch className="w-5 h-5 text-blue-600" />} label="Relations KG" value={kernelStatus?.knowledgeGraph?.edges || 0} />
          <MetricCard icon={<Shield className="w-5 h-5 text-emerald-600" />} label="Policies" value={kernelStatus?.policyCount || 0} />
          <MetricCard icon={<Activity className="w-5 h-5 text-amber-600" />} label="Audit entries" value={kernelStatus?.decisionAuditCount || 0} />
          <MetricCard icon={<Database className="w-5 h-5 text-rose-600" />} label="Modeles" value={kernelStatus?.modelCount || 0} />
        </div>

        <Tabs defaultValue="architecture" className="space-y-4">
          <TabsList className="bg-white border border-slate-200 shadow-sm">
            <TabsTrigger value="architecture" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">Architecture</TabsTrigger>
            <TabsTrigger value="agents" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">Agents</TabsTrigger>
            <TabsTrigger value="autonomy" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">Autonomie</TabsTrigger>
            <TabsTrigger value="knowledge" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">Knowledge Graph</TabsTrigger>
            <TabsTrigger value="reasoning" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">Raisonnement</TabsTrigger>
            <TabsTrigger value="governance" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">Gouvernance</TabsTrigger>
          </TabsList>

          <TabsContent value="architecture" className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2"><Layers className="w-5 h-5 text-violet-600" /> Architecture 6 couches formelles</h2>
            <div className="grid gap-3">
              {layersList.map((layer: any, idx: number) => {
                const Icon = LAYER_ICONS[layer.name] || Cpu;
                const layerColors = ['bg-slate-50 border-slate-200', 'bg-blue-50 border-blue-200', 'bg-violet-50 border-violet-200', 'bg-sky-50 border-sky-200', 'bg-indigo-50 border-indigo-200', 'bg-emerald-50 border-emerald-200'];
                return (
                  <Card key={idx} className={`${layerColors[idx] || 'bg-white border-slate-200'} shadow-sm`}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="w-12 h-12 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-violet-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium">Couche {idx + 1}</span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                          <span className="font-semibold text-slate-800">{layer.name}</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">{layer.description}</p>
                      </div>
                      <Badge className={layer.status === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}>{layer.status}</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800 flex items-center gap-2"><Activity className="w-5 h-5 text-sky-600" /> Boucle fermee industrielle</CardTitle>
                <CardDescription className="text-slate-500">Detection → Diagnostic → Decision → Action → Feedback → Apprentissage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {['Detection', 'Diagnostic', 'Decision', 'Action', 'Feedback', 'Apprentissage'].map((phase, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="px-3 py-2 rounded-lg bg-violet-50 border border-violet-200 text-sm font-medium text-violet-700">
                        {phase}
                      </div>
                      {i < 5 && <ChevronRight className="w-4 h-4 text-violet-400" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agents" className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-sky-600" /> Architecture multi-agent distribuee</h2>

            <div className="grid md:grid-cols-3 gap-4">
              <Card className="bg-blue-50 border border-blue-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-slate-800 flex items-center gap-2"><Cpu className="w-4 h-4 text-blue-600" /> Agents Equipement</CardTitle>
                  <CardDescription className="text-slate-500">Perception locale, detection anomalies</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">{kernelStatus?.agents?.byType?.equipment || 0}</div>
                  <p className="text-sm text-slate-500 mt-1">Modele local + memoire par machine</p>
                </CardContent>
              </Card>

              <Card className="bg-sky-50 border border-sky-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-slate-800 flex items-center gap-2"><Network className="w-4 h-4 text-sky-600" /> Agents Site</CardTitle>
                  <CardDescription className="text-slate-500">Coordination locale, prevention cascade</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-sky-600">{kernelStatus?.agents?.byType?.site || 0}</div>
                  <p className="text-sm text-slate-500 mt-1">Correlation alertes inter-equipements</p>
                </CardContent>
              </Card>

              <Card className="bg-violet-50 border border-violet-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-slate-800 flex items-center gap-2"><Globe className="w-4 h-4 text-violet-600" /> Agent Global</CardTitle>
                  <CardDescription className="text-slate-500">Apprentissage inter-sites, patterns globaux</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-violet-600">{kernelStatus?.agents?.byType?.global || 0}</div>
                  <p className="text-sm text-slate-500 mt-1">Federated learning cross-tenant</p>
                </CardContent>
              </Card>
            </div>

            {agents?.agents && (
              <Card className="bg-white border border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-slate-800">Registre des agents</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {agents.agents.map((agent: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2">
                          {agent.agentType === 'equipment' ? <Cpu className="w-4 h-4 text-blue-600" /> :
                           agent.agentType === 'site' ? <Network className="w-4 h-4 text-sky-600" /> :
                           <Globe className="w-4 h-4 text-violet-600" />}
                          <span className="text-sm font-mono text-slate-700">{agent.agentId}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={agent.status === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-red-100 text-red-700 border border-red-200'}>{agent.status}</Badge>
                          <span className="text-xs text-slate-500">Events: {agent.processedEvents}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {globalLearning && (
              <Card className="bg-white border border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-slate-800 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-emerald-600" /> Apprentissage global</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div><span className="text-slate-500 text-sm">Sites</span><div className="text-xl font-bold text-slate-800">{globalLearning.siteCount}</div></div>
                    <div><span className="text-slate-500 text-sm">Equipements</span><div className="text-xl font-bold text-slate-800">{globalLearning.totalEquipment}</div></div>
                    <div><span className="text-slate-500 text-sm">Patterns decouverts</span><div className="text-xl font-bold text-slate-800">{globalLearning.patternsDiscovered}</div></div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="autonomy" className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2"><ArrowUpDown className="w-5 h-5 text-amber-600" /> Niveaux d'autonomie gradues (0-5)</h2>

            <div className="grid gap-3">
              {autonomy?.levels?.map((level: any) => {
                const config = AUTONOMY_LABELS[level.level];
                const isCurrent = level.level === kernelStatus?.autonomyLevel;
                return (
                  <Card key={level.level} className={`border transition-all shadow-sm ${isCurrent ? 'bg-violet-50 border-violet-300 ring-2 ring-violet-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className={`w-10 h-10 rounded-full ${config?.color || 'bg-gray-500'} flex items-center justify-center text-lg font-bold text-white`}>
                        {level.level}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800">{level.name}</div>
                        <div className="text-sm text-slate-500">{level.description}</div>
                      </div>
                      {isCurrent ? (
                        <Badge className="bg-violet-600 text-white">ACTUEL</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-300 text-slate-600 hover:bg-slate-50"
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
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2"><Database className="w-5 h-5 text-rose-600" /> Knowledge Graph industriel</h2>

            {kgStats && (
              <>
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="bg-white border border-slate-200 shadow-sm">
                    <CardContent className="pt-4">
                      <div className="text-3xl font-bold text-rose-600">{kgStats.totalNodes}</div>
                      <p className="text-sm text-slate-500">Noeuds totaux</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white border border-slate-200 shadow-sm">
                    <CardContent className="pt-4">
                      <div className="text-3xl font-bold text-sky-600">{kgStats.totalEdges}</div>
                      <p className="text-sm text-slate-500">Relations totales</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white border border-slate-200 shadow-sm">
                    <CardContent className="pt-4">
                      <div className="text-3xl font-bold text-emerald-600">{(kgStats.avgConfidence * 100).toFixed(0)}%</div>
                      <p className="text-sm text-slate-500">Confiance moyenne</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="bg-white border border-slate-200 shadow-sm">
                    <CardHeader><CardTitle className="text-base text-slate-800">Noeuds par type</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(kgStats.nodesByType || {}).map(([type, count]: [string, any]) => (
                          <div key={type} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                            <span className="text-sm text-slate-700 capitalize">{type}</span>
                            <Badge className="bg-violet-100 text-violet-700 border border-violet-200">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border border-slate-200 shadow-sm">
                    <CardHeader><CardTitle className="text-base text-slate-800">Relations par type</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(kgStats.edgesByType || {}).map(([type, count]: [string, any]) => (
                          <div key={type} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                            <span className="text-sm text-slate-700">{type}</span>
                            <Badge className="bg-sky-100 text-sky-700 border border-sky-200">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-white border border-slate-200 shadow-sm">
                  <CardHeader><CardTitle className="text-base text-slate-800">Noeuds les plus connectes</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {kgStats.mostConnectedNodes?.slice(0, 8).map((node: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                          <span className="text-sm text-slate-700">{node.label}</span>
                          <span className="text-sm text-violet-600 font-mono">{node.connections} connexions</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="reasoning" className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2"><Brain className="w-5 h-5 text-violet-600" /> Raisonnement causal & Simulation</h2>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-white border border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-slate-800 flex items-center gap-2"><Target className="w-4 h-4 text-sky-600" /> Raisonnement par symptomes</CardTitle>
                  <CardDescription className="text-slate-500">Interrogez le Knowledge Graph avec des symptomes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    className="border-slate-300 text-slate-800"
                    placeholder="vibration, surchauffe, bruit..."
                    value={reasoningSymptoms}
                    onChange={(e) => setReasoningSymptoms(e.target.value)}
                  />
                  <Button
                    onClick={() => reasoningMutation.mutate()}
                    disabled={reasoningMutation.isPending}
                    className="bg-violet-600 hover:bg-violet-700 w-full text-white"
                  >
                    {reasoningMutation.isPending ? "Analyse..." : "Analyser les symptomes"}
                  </Button>

                  {reasoningMutation.data && (
                    <div className="mt-4 space-y-3">
                      {(reasoningMutation.data as any).diagnosis?.map((d: any, i: number) => (
                        <div key={i} className="p-3 bg-slate-50 rounded border-l-4 border-violet-500">
                          <div className="flex justify-between">
                            <span className="font-semibold text-slate-800">{d.cause}</span>
                            <Badge className={d.confidence > 0.7 ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}>{(d.confidence * 100).toFixed(0)}%</Badge>
                          </div>
                          {d.evidence?.map((e: string, j: number) => (
                            <p key={j} className="text-xs text-slate-500 mt-1">{e}</p>
                          ))}
                        </div>
                      ))}
                      {(reasoningMutation.data as any).recommendedActions?.map((a: any, i: number) => (
                        <div key={i} className="p-2 bg-emerald-50 rounded border border-emerald-200 text-sm">
                          <span className="text-emerald-700 font-medium">{a.action}</span>
                          <span className="text-slate-500 ml-2">({a.duration}min, {a.cost}EUR)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white border border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-slate-800 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-600" /> Simulation What-If</CardTitle>
                  <CardDescription className="text-slate-500">Simulez des conditions hypothetiques</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 font-medium">Equipment ID</label>
                      <Input className="border-slate-300 text-slate-800" value={whatIfEquipmentId} onChange={e => setWhatIfEquipmentId(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-medium">Hausse temperature (C)</label>
                      <Input className="border-slate-300 text-slate-800" value={whatIfTempIncrease} onChange={e => setWhatIfTempIncrease(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium">Hausse vibration (mm/s)</label>
                    <Input className="border-slate-300 text-slate-800" value={whatIfVibIncrease} onChange={e => setWhatIfVibIncrease(e.target.value)} />
                  </div>
                  <Button
                    onClick={() => whatIfMutation.mutate()}
                    disabled={whatIfMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 w-full text-white"
                  >
                    {whatIfMutation.isPending ? "Simulation..." : "Lancer la simulation"}
                  </Button>

                  {whatIfMutation.data && (
                    <div className="mt-4 space-y-2 p-3 bg-slate-50 rounded border border-slate-200">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">Probabilite de defaillance</span>
                        <span className="font-bold text-red-600">{((whatIfMutation.data as any).failureProbability * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">Temps avant defaillance</span>
                        <span className="font-bold text-amber-600">{(whatIfMutation.data as any).estimatedTimeToFailure}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">Impact financier</span>
                        <span className="font-bold text-orange-600">{(whatIfMutation.data as any).costImplication}EUR</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">Tendance risque</span>
                        <Badge className={(whatIfMutation.data as any).riskChange === 'INCREASED' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}>
                          {(whatIfMutation.data as any).riskChange}
                        </Badge>
                      </div>
                      <div className="mt-2">
                        <span className="text-xs text-slate-500 font-medium">Actions recommandees:</span>
                        {(whatIfMutation.data as any).recommendedActions?.map((a: string, i: number) => (
                          <p key={i} className="text-sm text-emerald-700 mt-1">• {a}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="governance" className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2"><Shield className="w-5 h-5 text-emerald-600" /> Gouvernance & Confiance</h2>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-white border border-slate-200 shadow-sm">
                <CardHeader><CardTitle className="text-base text-slate-800">Policy Engine ({policies?.policies?.length || 0} policies)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {policies?.policies?.map((p: any, i: number) => (
                      <div key={i} className="p-3 bg-slate-50 rounded border border-slate-100">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm text-slate-800">{p.name}</span>
                          <div className="flex gap-2">
                            <Badge className={p.enabled ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}>{p.enabled ? 'Active' : 'Inactive'}</Badge>
                            <Badge className="bg-slate-100 text-slate-600 border border-slate-200">P{p.priority}</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{p.description}</p>
                        {p.requiresApproval && <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-xs mt-1">Approbation requise</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-slate-200 shadow-sm">
                <CardHeader><CardTitle className="text-base text-slate-800">Journal d'audit decisionnel</CardTitle></CardHeader>
                <CardContent>
                  {auditLog?.auditLog?.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">Aucune decision enregistree. Le journal se remplira au fur et a mesure que le systeme prend des decisions.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {auditLog?.auditLog?.map((entry: any, i: number) => (
                        <div key={i} className="p-2 bg-slate-50 rounded border border-slate-100 text-sm">
                          <div className="flex justify-between">
                            <span className="font-mono text-xs text-slate-600">{entry.diagnosisId}</span>
                            <Badge className={entry.decision === 'approved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : entry.decision === 'escalated' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}>
                              {entry.decision}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{entry.decisionReason}</p>
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
    <Card className="bg-white border border-slate-200 shadow-sm">
      <CardContent className="flex items-center gap-3 py-3 px-4">
        {icon}
        <div>
          <div className="text-lg font-bold text-slate-800">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
