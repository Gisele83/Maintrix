import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, 
  TrendingUp, 
  Activity, 
  Zap, 
  RefreshCcw, 
  BarChart3, 
  Target,
  CheckCircle,
  AlertTriangle,
  Clock,
  Settings,
  Layers,
  FlaskConical,
  Sigma,
  GitMerge,
  ShieldCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface LearningMetrics {
  id: number;
  equipmentType: string;
  successRate: number;
  avgConfidence: number;
  totalCases: number;
  successfulCases: number;
  lastUpdated: string;
  improvementSuggestions: string[];
}

interface ModelPerformance {
  id: number;
  modelType: string;
  equipmentType: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainingDate: string;
  sampleSize: number;
  crossValidationScore: number;
}

export default function LearningDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");

  const { data: learningMetrics = [], isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/learning-metrics", selectedEquipment !== "all" ? selectedEquipment : undefined],
    retry: false,
  });

  const { data: modelPerformance = [], isLoading: performanceLoading } = useQuery({
    queryKey: ["/api/model-performance"],
    retry: false,
  });

  // Φ_i ISC summary — Brevet N°3
  const { data: iscSummary, isLoading: iscLoading } = useQuery<{
    totalPatterns: number;
    avgPhi: number;
    avgFiabilite: number;
    avgMaturite: number;
    avgISC: number;
    phiDistribution: { high: number; medium: number; low: number };
    topCategory: string | null;
    categoryBreakdown: Record<string, number>;
    iscWeights: { D1: number; D2: number; D3: number; D4: number };
    phiConfig: { alpha: number; beta: number; gamma: number };
  }>({
    queryKey: ["/api/isc/summary"],
    retry: false,
  });

  const autoImproveMutation = useMutation({
    mutationFn: async (data: { equipmentType?: string; forceRetrain: boolean }) => {
      return await apiRequest("/api/auto-improve", { method: "POST", body: data });
    },
    onSuccess: (data) => {
      toast({
        title: "Auto-amélioration terminée",
        description: `${data.improvements?.length || 0} optimisations appliquées`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/learning-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/model-performance"] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Échec de l'auto-amélioration",
        variant: "destructive",
      });
    },
  });

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 85) return "text-green-600";
    if (rate >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getSuccessRateBg = (rate: number) => {
    if (rate >= 85) return "bg-green-100";
    if (rate >= 70) return "bg-yellow-100";
    return "bg-red-100";
  };

  const equipmentTypes = Array.from(new Set(learningMetrics.map((m: LearningMetrics) => m.equipmentType)));

  const handleAutoImprove = (equipmentType?: string) => {
    autoImproveMutation.mutate({
      equipmentType,
      forceRetrain: false
    });
  };

  const handleForceRetrain = () => {
    autoImproveMutation.mutate({
      forceRetrain: true
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Tableau de Bord - Apprentissage Continu
            </h1>
            <p className="text-gray-600">
              Suivi des performances IA et amélioration automatique du système
            </p>
          </div>
          
          <div className="flex space-x-3">
            <Button
              onClick={() => handleAutoImprove()}
              disabled={autoImproveMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              <Brain className="w-4 h-4 mr-2" />
              {autoImproveMutation.isPending ? "Amélioration..." : "Auto-Amélioration"}
            </Button>
            
            <Button
              onClick={handleForceRetrain}
              disabled={autoImproveMutation.isPending}
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Réentraîner Tout
            </Button>
          </div>
        </div>

        {/* Equipment Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedEquipment === "all" ? "default" : "outline"}
                onClick={() => setSelectedEquipment("all")}
                size="sm"
              >
                Tous les équipements
              </Button>
              {equipmentTypes.map((type) => (
                <Button
                  key={type}
                  variant={selectedEquipment === type ? "default" : "outline"}
                  onClick={() => setSelectedEquipment(type)}
                  size="sm"
                  className="capitalize"
                >
                  {type}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 mb-1">Taux de succès moyen</p>
                  <p className="text-2xl font-bold text-green-800">
                    {learningMetrics.length > 0 
                      ? Math.round(learningMetrics.reduce((acc: number, m: LearningMetrics) => acc + m.successRate, 0) / learningMetrics.length)
                      : 0}%
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 mb-1">Confiance moyenne</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {learningMetrics.length > 0 
                      ? Math.round(learningMetrics.reduce((acc: number, m: LearningMetrics) => acc + m.avgConfidence, 0) / learningMetrics.length * 100)
                      : 0}%
                  </p>
                </div>
                <Target className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 mb-1">Total cas traités</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {learningMetrics.reduce((acc: number, m: LearningMetrics) => acc + m.totalCases, 0)}
                  </p>
                </div>
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600 mb-1">Modèles actifs</p>
                  <p className="text-2xl font-bold text-orange-800">
                    {modelPerformance.length}
                  </p>
                </div>
                <Brain className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Learning Metrics by Equipment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span>Métriques d'Apprentissage par Équipement</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Chargement des métriques...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {learningMetrics.map((metric: LearningMetrics) => (
                  <div key={metric.id} className={`p-4 rounded-lg border ${getSuccessRateBg(metric.successRate)}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg capitalize flex items-center space-x-2">
                          <span>{metric.equipmentType}</span>
                          <Badge variant={metric.successRate >= 85 ? "default" : metric.successRate >= 70 ? "secondary" : "destructive"}>
                            {metric.successRate >= 85 ? "Excellent" : metric.successRate >= 70 ? "Bon" : "À améliorer"}
                          </Badge>
                        </h3>
                        <p className="text-sm text-gray-600">
                          Dernière mise à jour: {new Date(metric.lastUpdated).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${getSuccessRateColor(metric.successRate)}`}>
                          {Math.round(metric.successRate)}%
                        </div>
                        <div className="text-sm text-gray-600">de réussite</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-800">{metric.totalCases}</div>
                        <div className="text-xs text-gray-600">Total cas</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-green-600">{metric.successfulCases}</div>
                        <div className="text-xs text-gray-600">Succès</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-blue-600">{Math.round(metric.avgConfidence * 100)}%</div>
                        <div className="text-xs text-gray-600">Confiance</div>
                      </div>
                      <div className="text-center">
                        <Button
                          onClick={() => handleAutoImprove(metric.equipmentType)}
                          disabled={autoImproveMutation.isPending}
                          size="sm"
                          variant="outline"
                        >
                          <Settings className="w-3 h-3 mr-1" />
                          Optimiser
                        </Button>
                      </div>
                    </div>

                    <Progress value={metric.successRate} className="mb-3" />

                    {metric.improvementSuggestions && metric.improvementSuggestions.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                          <span className="font-medium text-yellow-800">Suggestions d'amélioration:</span>
                        </div>
                        <ul className="text-sm text-yellow-700 space-y-1">
                          {metric.improvementSuggestions.map((suggestion, index) => (
                            <li key={index} className="flex items-start">
                              <span className="text-yellow-600 mr-2">•</span>
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Brevet N°3 : ISC 4D + Φ_i Agrégation Fédérée ───────────────────── */}
        <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-violet-600 rounded-lg">
                  <Sigma className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-violet-800 font-bold">ISC 4D + Φ_i — Agrégation Fédérée</span>
                  <p className="text-xs font-normal text-violet-500 mt-0.5">Brevet N°3 · MAINTRIX-SCA-FED · Φ_i = α·ISC + β·Fiabilité + γ·Maturité</p>
                </div>
              </div>
              {iscSummary && (
                <Badge className="bg-violet-600 text-white text-sm px-3 py-1">
                  {iscSummary.totalPatterns} patterns fédérés
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {iscLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
                <p className="text-violet-500 mt-2">Calcul des indices ISC et Φ_i...</p>
              </div>
            ) : !iscSummary || iscSummary.totalPatterns === 0 ? (
              <div className="text-center py-10">
                <GitMerge className="w-12 h-12 text-violet-300 mx-auto mb-3" />
                <p className="text-violet-600 font-medium">Aucun pattern fédéré disponible</p>
                <p className="text-sm text-violet-400 mt-1">Les patterns seront collectés lors des diagnostics</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Φ_i KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-violet-100 text-center">
                    <div className="text-3xl font-black text-violet-700">{(iscSummary.avgPhi * 100).toFixed(0)}%</div>
                    <div className="text-xs font-semibold text-violet-500 mt-1">Φ_i moyen</div>
                    <div className="text-xs text-gray-400">α·ISC + β·F + γ·M</div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-emerald-100 text-center">
                    <div className="text-3xl font-black text-emerald-700">{(iscSummary.avgFiabilite * 100).toFixed(0)}%</div>
                    <div className="text-xs font-semibold text-emerald-500 mt-1">Fiabilité (β)</div>
                    <div className="text-xs text-gray-400">eff. + succès + consistance</div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100 text-center">
                    <div className="text-3xl font-black text-amber-700">{(iscSummary.avgMaturite * 100).toFixed(0)}%</div>
                    <div className="text-xs font-semibold text-amber-500 mt-1">Maturité (γ)</div>
                    <div className="text-xs text-gray-400">confirmations + âge + diversité</div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100 text-center">
                    <div className="text-3xl font-black text-blue-700">4D</div>
                    <div className="text-xs font-semibold text-blue-500 mt-1">Dimensions ISC</div>
                    <div className="text-xs text-gray-400">D1·D2·D3·D4</div>
                  </div>
                </div>

                {/* Φ_i Distribution */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-violet-100">
                  <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-violet-500" />
                    Distribution Φ_i des patterns fédérés
                  </h4>
                  <div className="space-y-2">
                    {[
                      { label: "Haute pertinence (Φ ≥ 0.7)", count: iscSummary.phiDistribution.high, color: "bg-emerald-500", text: "text-emerald-700" },
                      { label: "Pertinence modérée (0.4 ≤ Φ < 0.7)", count: iscSummary.phiDistribution.medium, color: "bg-amber-400", text: "text-amber-700" },
                      { label: "Faible pertinence (Φ < 0.4)", count: iscSummary.phiDistribution.low, color: "bg-rose-400", text: "text-rose-700" },
                    ].map(({ label, count, color, text }) => {
                      const pct = iscSummary.totalPatterns > 0 ? (count / iscSummary.totalPatterns) * 100 : 0;
                      return (
                        <div key={label} className="flex items-center gap-3">
                          <div className="w-40 text-xs text-gray-600 flex-shrink-0">{label}</div>
                          <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                            <div className={`h-3 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className={`w-12 text-xs font-bold text-right ${text}`}>{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ISC 4 dimensions weights + Φ_i config */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
                    <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-blue-500" />
                      Poids ISC 4 Dimensions
                    </h4>
                    <div className="space-y-2">
                      {[
                        { d: "D1", label: "Type d'équipement", w: iscSummary.iscWeights.D1 },
                        { d: "D2", label: "Profil d'usage", w: iscSummary.iscWeights.D2 },
                        { d: "D3", label: "Stress opérationnel", w: iscSummary.iscWeights.D3 },
                        { d: "D4", label: "Historique défaillances", w: iscSummary.iscWeights.D4, isNew: true },
                      ].map(({ d, label, w, isNew }) => (
                        <div key={d} className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${isNew ? "bg-violet-600" : "bg-blue-500"}`}>{d}</span>
                          <span className="text-xs text-gray-600 flex-1">{label}{isNew && <Badge className="ml-1 text-[10px] bg-violet-100 text-violet-700 px-1 py-0">4e dim.</Badge>}</span>
                          <div className="w-20 bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full bg-blue-500" style={{ width: `${w * 100}%` }} />
                          </div>
                          <span className="text-xs font-bold text-blue-700 w-10 text-right">{(w * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-4 shadow-sm border border-violet-100">
                    <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-violet-500" />
                      Coefficients Φ_i
                    </h4>
                    <div className="space-y-2">
                      {[
                        { lbl: "α — ISC (similarité contextuelle)", val: iscSummary.phiConfig.alpha, color: "bg-blue-500" },
                        { lbl: "β — Fiabilité", val: iscSummary.phiConfig.beta, color: "bg-emerald-500" },
                        { lbl: "γ — Maturité", val: iscSummary.phiConfig.gamma, color: "bg-amber-500" },
                      ].map(({ lbl, val, color }) => (
                        <div key={lbl} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 flex-1">{lbl}</span>
                          <div className="w-20 bg-gray-100 rounded-full h-2">
                            <div className={`h-2 rounded-full ${color}`} style={{ width: `${val * 100}%` }} />
                          </div>
                          <span className="text-xs font-bold text-violet-700 w-10 text-right">{(val * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                    {iscSummary.topCategory && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500">Catégorie dominante :</p>
                        <p className="text-sm font-semibold text-violet-700 capitalize mt-0.5">{iscSummary.topCategory}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Model Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-purple-600" />
              <span>Performance des Modèles ML</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {performanceLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Chargement des performances...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {modelPerformance.map((perf: ModelPerformance) => (
                  <div key={perf.id} className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold capitalize">{perf.equipmentType}</h3>
                        <Badge variant="outline" className="mt-1">
                          {perf.modelType.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-purple-700">
                          {Math.round(perf.accuracy * 100)}%
                        </div>
                        <div className="text-xs text-gray-600">Précision</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-center p-2 bg-white rounded">
                        <div className="font-semibold">{Math.round(perf.precision * 100)}%</div>
                        <div className="text-xs text-gray-600">Précision</div>
                      </div>
                      <div className="text-center p-2 bg-white rounded">
                        <div className="font-semibold">{Math.round(perf.recall * 100)}%</div>
                        <div className="text-xs text-gray-600">Rappel</div>
                      </div>
                      <div className="text-center p-2 bg-white rounded">
                        <div className="font-semibold">{Math.round(perf.f1Score * 100)}%</div>
                        <div className="text-xs text-gray-600">F1-Score</div>
                      </div>
                      <div className="text-center p-2 bg-white rounded">
                        <div className="font-semibold">{perf.sampleSize}</div>
                        <div className="text-xs text-gray-600">Échantillons</div>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-gray-600 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      Entraîné le {new Date(perf.trainingDate).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}