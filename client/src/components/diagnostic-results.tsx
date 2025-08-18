import { Lightbulb, Save, Wrench, Brain, AlertTriangle, Euro, Zap, Activity, TrendingUp, Shield, GitBranch, MessageSquare, Cloud, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { t } from "@/lib/i18n";
import { FeedbackModal } from "./feedback-modal";
import { useState } from "react";

interface DiagnosticSuggestion {
  diagnosis: string;
  solution: string;
  confidence: number;
  matchingCases: number;
  caseId: number;
  duration?: number;
  riskLevel?: string;
  costEstimate?: string;
  aiInsights?: string;
  predictiveTips?: string[];
  // Advanced ML fields
  advancedML?: boolean;
  anomalyDetected?: boolean;
  anomalyScore?: number;
  failureRisk?: number;
  patternMatch?: any;
  maintenanceRecommendation?: any;
  // Ensemble ML fields
  ensembleML?: boolean;
  ensembleAgreement?: number;
  individualPredictions?: any;
  riskAssessment?: any;
  // Cloud diagnostic fields
  cloudSource?: boolean;
  repairSteps?: string[];
  safetyWarnings?: string[];
  tools?: string[];
  difficulty?: string;
  // Advanced reliability fields
  evidenceChain?: any[];
  sensorTrends?: any[];
  recommendedAction?: string;
  nextSteps?: string[];
}

interface DiagnosticResultsProps {
  suggestions: DiagnosticSuggestion[];
  isLoading: boolean;
  onStartRepair: (caseId: number) => void;
  onSaveDiagnostic: (suggestion: DiagnosticSuggestion) => void;
  sessionId?: number;
  cloudSearchPerformed?: boolean;
  cloudInsights?: string;
}

export function DiagnosticResults({ 
  suggestions, 
  isLoading, 
  onStartRepair, 
  onSaveDiagnostic,
  sessionId,
  cloudSearchPerformed,
  cloudInsights
}: DiagnosticResultsProps) {
  const { language } = useLanguage();
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<DiagnosticSuggestion | null>(null);
  
  console.log("DiagnosticResults props:", { suggestions, isLoading, suggestionsLength: suggestions.length });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return "bg-carbon-green";
    if (confidence >= 70) return "bg-carbon-orange";
    return "bg-carbon-gray-50";
  };

  const getConfidenceTextColor = (confidence: number) => {
    if (confidence >= 85) return "text-white";
    if (confidence >= 70) return "text-white";
    return "text-carbon-gray-90";
  };

  if (isLoading) {
    return (
      <Card className="border border-carbon-gray-20 shadow-sm">
        <CardHeader className="border-b border-carbon-gray-20">
          <CardTitle className="text-xl font-semibold text-carbon-gray-90 flex items-center space-x-2">
            <Lightbulb className="text-carbon-orange" />
            <span>{t("diagnosticSuggestions", language)}</span>
          </CardTitle>
          <p className="text-carbon-gray-70 text-sm">
            {t("basedOnHistoryAndAI", language)}
          </p>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-carbon-blue"></div>
            <p className="text-carbon-gray-70 mt-2">{t("analyzing", language)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card className="border border-carbon-gray-20 shadow-sm">
        <CardHeader className="border-b border-carbon-gray-20">
          <CardTitle className="text-xl font-semibold text-carbon-gray-90 flex items-center space-x-2">
            <Lightbulb className="text-carbon-orange" />
            <span>{t("diagnosticSuggestions", language)}</span>
          </CardTitle>
          <p className="text-carbon-gray-70 text-sm">
            {t("basedOnHistoryAndAI", language)}
          </p>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="text-center py-8">
            <Lightbulb className="text-carbon-gray-50 text-4xl mb-4 mx-auto" />
            <p className="text-carbon-gray-70">{t("enterInfoForDiagnosis", language)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-carbon-gray-20 shadow-sm">
      <CardHeader className="border-b border-carbon-gray-20">
        <CardTitle className="text-xl font-semibold text-carbon-gray-90 flex items-center space-x-2">
          <Lightbulb className="text-carbon-orange" />
          <span>{t("diagnosticSuggestions", language)}</span>
        </CardTitle>
        <p className="text-carbon-gray-70 text-sm">
          {t("basedOnHistoryAndAI", language)}
        </p>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* Cloud Search Indicator */}
        {cloudSearchPerformed && (
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2 mb-2">
              <Cloud className="text-blue-500 w-5 h-5" />
              <span className="font-medium text-blue-800">Recherche Cloud Effectuée</span>
              <Badge className="bg-blue-500 text-white text-xs">
                <Globe className="w-3 h-3 mr-1" />
                IA Cloud
              </Badge>
            </div>
            <p className="text-sm text-blue-700">
              Analyse intelligente effectuée dans le cloud pour les symptômes non reconnus dans la base locale.
            </p>
            {cloudInsights && (
              <div className="mt-2 p-2 bg-blue-100/50 rounded text-xs text-blue-800">
                <strong>Insights IA:</strong> {cloudInsights}
              </div>
            )}
          </div>
        )}

        <div className="space-y-6">
          {suggestions.map((suggestion, index) => (
            <div key={index} className="border border-carbon-gray-20 rounded-lg p-6 hover:shadow-lg transition-all duration-200 bg-white">
              {/* Header with diagnosis and confidence */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <h4 className="font-semibold text-carbon-gray-90 text-lg">{suggestion.diagnosis}</h4>
                  {suggestion.cloudSource && (
                    <Badge variant="secondary" className="bg-blue-500 text-white text-xs">
                      <Cloud className="w-3 h-3 mr-1" />
                      Cloud IA
                    </Badge>
                  )}
                  {suggestion.advancedML && (
                    <Badge variant="secondary" className="bg-carbon-blue text-white text-xs">
                      <Brain className="w-3 h-3 mr-1" />
                      ML Avancé
                    </Badge>
                  )}
                </div>
                <Badge 
                  className={`${getConfidenceColor(suggestion.confidence)} ${getConfidenceTextColor(suggestion.confidence)} text-xs px-3 py-1 rounded-full font-medium`}
                >
                  {suggestion.confidence}% {t("confidence", language)}
                </Badge>
              </div>

              {/* Advanced ML Metrics */}
              {suggestion.advancedML && (
                <div className="bg-gradient-to-r from-carbon-blue/10 to-purple-100 p-4 rounded-lg border border-carbon-blue/20 mb-4">
                  <h5 className="font-semibold text-carbon-gray-90 mb-3 flex items-center">
                    <Brain className="w-4 h-4 mr-2 text-carbon-blue" />
                    Métriques ML Avancées
                  </h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {suggestion.anomalyDetected && (
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-red-700 font-medium">Anomalie détectée</span>
                      </div>
                    )}
                    {suggestion.failureRisk && (
                      <div className="flex items-center space-x-2">
                        <Activity className="w-4 h-4 text-orange-500" />
                        <span>Risque de panne: {Math.round(suggestion.failureRisk * 100)}%</span>
                      </div>
                    )}
                    {suggestion.patternMatch && (
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        <span>Correspondance: {Math.round(suggestion.patternMatch.match_score * 100)}%</span>
                      </div>
                    )}
                    {suggestion.maintenanceRecommendation && (
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-green-500" />
                        <span>Maintenance: {suggestion.maintenanceRecommendation.next_maintenance_days} jours</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Solution */}
              <div className="mb-4">
                <h5 className="font-semibold text-carbon-gray-90 mb-2">Solution recommandée</h5>
                <p className="text-sm text-carbon-gray-70 bg-carbon-gray-10 p-3 rounded-md leading-relaxed">{suggestion.solution}</p>
              </div>

              {/* AI Insights */}
              {suggestion.aiInsights && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Brain className="text-carbon-blue w-4 h-4" />
                    <span className="text-sm font-medium text-carbon-blue">{t("aiInsights", language)}</span>
                  </div>
                  <p className="text-xs text-carbon-gray-70">{suggestion.aiInsights}</p>
                </div>
              )}

              {/* Enhanced Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {suggestion.riskLevel && (
                  <div className="text-center p-2 bg-carbon-gray-10 rounded">
                    <AlertTriangle className={`w-4 h-4 mx-auto mb-1 ${
                      suggestion.riskLevel === "Élevé" ? "text-carbon-red" : 
                      suggestion.riskLevel === "Moyen" ? "text-carbon-orange" : "text-carbon-green"
                    }`} />
                    <div className="text-xs font-medium text-carbon-gray-90">{t("riskLevel", language)}</div>
                    <div className="text-xs text-carbon-gray-70">{suggestion.riskLevel}</div>
                  </div>
                )}
                
                {suggestion.costEstimate && (
                  <div className="text-center p-2 bg-carbon-gray-10 rounded">
                    <Euro className="w-4 h-4 mx-auto mb-1 text-carbon-blue" />
                    <div className="text-xs font-medium text-carbon-gray-90">{t("costEstimate", language)}</div>
                    <div className="text-xs text-carbon-gray-70">{suggestion.costEstimate}</div>
                  </div>
                )}
                
                {suggestion.duration && (
                  <div className="text-center p-2 bg-carbon-gray-10 rounded">
                    <Zap className="w-4 h-4 mx-auto mb-1 text-carbon-orange" />
                    <div className="text-xs font-medium text-carbon-gray-90">Durée</div>
                    <div className="text-xs text-carbon-gray-70">
                      {suggestion.duration > 60 ? 
                        `${Math.floor(suggestion.duration / 60)}h ${suggestion.duration % 60}m` : 
                        `${suggestion.duration}m`
                      }
                    </div>
                  </div>
                )}
                
                <div className="text-center p-2 bg-carbon-gray-10 rounded">
                  <Lightbulb className="w-4 h-4 mx-auto mb-1 text-carbon-gray-50" />
                  <div className="text-xs font-medium text-carbon-gray-90">{t("cases", language)}</div>
                  <div className="text-xs text-carbon-gray-70">{suggestion.matchingCases}</div>
                </div>
              </div>

              {/* Ensemble ML Metrics */}
              {suggestion.ensembleML && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <GitBranch className="text-purple-600 w-4 h-4" />
                    <span className="text-sm font-medium text-purple-800">Ensemble ML - Analyse Multi-Modèles</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="text-center p-2 bg-purple-100 rounded">
                      <div className="text-xs font-medium text-purple-900">Accord des modèles</div>
                      <div className="text-sm font-bold text-purple-700">
                        {suggestion.ensembleAgreement || 0}/9
                      </div>
                    </div>
                    {suggestion.riskAssessment && (
                      <div className="text-center p-2 bg-purple-100 rounded">
                        <div className="text-xs font-medium text-purple-900">Facteur de risque</div>
                        <div className="text-sm font-bold text-purple-700">
                          {Math.round((suggestion.riskAssessment.risk_factor || 0) * 100)}%
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Individual Model Predictions */}
                  {suggestion.individualPredictions && Object.keys(suggestion.individualPredictions).length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-purple-800 mb-2">
                        Prédictions des 9 algorithmes ML:
                      </div>
                      <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                        {Object.entries(suggestion.individualPredictions).map(([model, pred]: [string, any]) => (
                          <div key={model} className="flex justify-between items-center text-xs p-1 bg-purple-100 rounded">
                            <span className="text-purple-700 capitalize font-medium">
                              {model.replace('_', ' ')}
                            </span>
                            <div className="flex items-center space-x-2">
                              <span className="text-purple-900 truncate max-w-20 text-right">
                                {pred.prediction}
                              </span>
                              <span className="text-purple-600 font-bold min-w-8 text-right">
                                {Math.round(pred.confidence * 100)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Predictive Maintenance Tips */}
              {suggestion.predictiveTips && suggestion.predictiveTips.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Wrench className="text-carbon-green w-4 h-4" />
                    <span className="text-sm font-medium text-carbon-green">{t("predictiveMaintenance", language)}</span>
                  </div>
                  <ul className="text-xs text-carbon-gray-70 space-y-1">
                    {suggestion.predictiveTips.map((tip, tipIndex) => (
                      <li key={tipIndex} className="flex items-start">
                        <span className="text-carbon-green mr-2">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2 pt-4 border-t border-carbon-gray-20">
                <Button
                  onClick={() => onStartRepair(suggestion.caseId)}
                  className="flex-1 bg-carbon-blue text-white hover:bg-blue-700 transition-colors"
                >
                  <Wrench className="w-4 h-4 mr-2" />
                  Commencer la réparation
                </Button>
                <Button
                  onClick={() => {
                    setSelectedSuggestion(suggestion);
                    setFeedbackModalOpen(true);
                  }}
                  variant="outline"
                  className="border-green-300 text-green-700 hover:bg-green-50"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Feedback
                </Button>
                <Button
                  onClick={() => onSaveDiagnostic(suggestion)}
                  variant="outline"
                  className="border-carbon-gray-30 text-carbon-gray-90 hover:bg-carbon-gray-10"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Sauvegarder
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Feedback Modal */}
      {selectedSuggestion && sessionId && (
        <FeedbackModal
          isOpen={feedbackModalOpen}
          onClose={() => {
            setFeedbackModalOpen(false);
            setSelectedSuggestion(null);
          }}
          sessionId={sessionId}
          diagnosis={selectedSuggestion.diagnosis}
          solution={selectedSuggestion.solution}
        />
      )}
    </Card>
  );
}
