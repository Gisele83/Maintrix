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
  Settings
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

  const autoImproveMutation = useMutation({
    mutationFn: async (data: { equipmentType?: string; forceRetrain: boolean }) => {
      const response = await apiRequest("POST", "/api/auto-improve", data);
      return await response.json();
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