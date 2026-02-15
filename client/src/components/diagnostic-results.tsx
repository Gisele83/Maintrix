import { Lightbulb, Save, Wrench, Brain, AlertTriangle, Euro, Zap, Activity, TrendingUp, Shield, GitBranch, MessageSquare, Cloud, Globe, CheckCircle, Info, Clock, ArrowUpRight, History, Target, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { t } from "@/lib/i18n";
import { FeedbackModal } from "./feedback-modal";
import { useState } from "react";

interface ExplanationFactor {
  type: string;
  label: string;
  detail: string;
  impact: 'high' | 'medium' | 'low';
}

interface ContextSignal {
  type: string;
  label: string;
  detail: string;
}

interface SimilarIncident {
  date: string;
  equipmentType: string;
  diagnosis: string;
  resolution: string;
  daysAgo: number;
}

interface TrendInfo {
  failureCode: string;
  occurrences: number;
  direction: string;
  lastOccurrence: string;
}

interface DiagnosticSuggestion {
  diagnosis: string;
  solution: string;
  confidence: number;
  matchingCases: number;
  caseId?: number;
  duration?: number;
  riskLevel?: string;
  costEstimate?: string;
  aiInsights?: string;
  predictiveTips?: string[];
  source?: string;
  ruleId?: string;
  explanationFactors?: ExplanationFactor[];
  advancedML?: boolean;
  anomalyDetected?: boolean;
  anomalyScore?: number;
  failureRisk?: number;
  patternMatch?: any;
  maintenanceRecommendation?: any;
  ensembleML?: boolean;
  ensembleAgreement?: number;
  individualPredictions?: any;
  riskAssessment?: any;
  cloudSource?: boolean;
  repairSteps?: string[];
  safetyWarnings?: string[];
  tools?: string[];
  difficulty?: string;
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
  explanationSummary?: string;
  contextSignals?: ContextSignal[];
  similarIncidents?: SimilarIncident[];
  failureTrends?: TrendInfo[];
  engineSources?: string[];
}

export function DiagnosticResults({ 
  suggestions, 
  isLoading, 
  onStartRepair, 
  onSaveDiagnostic,
  sessionId,
  cloudSearchPerformed,
  cloudInsights,
  explanationSummary,
  contextSignals,
  similarIncidents,
  failureTrends,
  engineSources
}: DiagnosticResultsProps) {
  const { language } = useLanguage();
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<DiagnosticSuggestion | null>(null);
  const [showSimilarIncidents, setShowSimilarIncidents] = useState(false);
  const [showTrends, setShowTrends] = useState(false);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "bg-green-600";
    if (confidence >= 50) return "bg-orange-500";
    return "bg-gray-500";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 80) return "Haute";
    if (confidence >= 50) return "Moyenne";
    return "Faible";
  };

  const getSourceBadge = (source?: string) => {
    switch (source) {
      case 'rules': return { label: 'Règle Expert', color: 'bg-purple-600 text-white', icon: <Shield className="w-3 h-3 mr-1" /> };
      case 'historical': return { label: 'Historique', color: 'bg-blue-600 text-white', icon: <History className="w-3 h-3 mr-1" /> };
      case 'failure_memory': return { label: 'Mémoire Pannes', color: 'bg-amber-600 text-white', icon: <Brain className="w-3 h-3 mr-1" /> };
      case 'ai_structured': return { label: 'IA Claude', color: 'bg-cyan-600 text-white', icon: <Cloud className="w-3 h-3 mr-1" /> };
      default: return { label: 'Analyse', color: 'bg-gray-600 text-white', icon: <Target className="w-3 h-3 mr-1" /> };
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'border-red-300 bg-red-50 text-red-800';
      case 'medium': return 'border-orange-300 bg-orange-50 text-orange-800';
      default: return 'border-gray-300 bg-gray-50 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <Card className="border border-carbon-gray-20 shadow-sm">
        <CardHeader className="border-b border-carbon-gray-20">
          <CardTitle className="text-xl font-semibold text-carbon-gray-90 flex items-center space-x-2">
            <Lightbulb className="text-carbon-orange" />
            <span>{t("diagnosticSuggestions", language)}</span>
          </CardTitle>
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
    <div className="space-y-4">
      {explanationSummary && (
        <Card className="border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <Layers className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-blue-900 text-sm mb-1">Moteur Hybride de Diagnostic</h4>
                <p className="text-sm text-blue-800">{explanationSummary}</p>
                {engineSources && engineSources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {engineSources.map((source, i) => (
                      <Badge key={i} variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {source}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {contextSignals && contextSignals.length > 0 && (
        <Card className="border border-amber-200 bg-amber-50/50 shadow-sm">
          <CardContent className="p-4">
            <h4 className="font-semibold text-amber-900 text-sm mb-2 flex items-center">
              <Info className="w-4 h-4 mr-2" />
              Signaux Contextuels GMAO
            </h4>
            <div className="space-y-1.5">
              {contextSignals.map((signal, i) => (
                <div key={i} className="flex items-start space-x-2 text-sm">
                  <span className="text-amber-600 mt-0.5">
                    {signal.type === 'criticality' && <AlertTriangle className="w-3.5 h-3.5" />}
                    {signal.type === 'recent_intervention' && <Clock className="w-3.5 h-3.5" />}
                    {signal.type === 'recurrence' && <TrendingUp className="w-3.5 h-3.5" />}
                    {signal.type === 'operational_state' && <Activity className="w-3.5 h-3.5" />}
                  </span>
                  <div>
                    <span className="font-medium text-amber-800">{signal.label}</span>
                    <span className="text-amber-700"> — {signal.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border border-carbon-gray-20 shadow-sm">
        <CardHeader className="border-b border-carbon-gray-20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-carbon-gray-90 flex items-center space-x-2">
                <Lightbulb className="text-carbon-orange" />
                <span>{t("diagnosticSuggestions", language)}</span>
              </CardTitle>
              <p className="text-carbon-gray-70 text-sm mt-1">
                Top {suggestions.length} diagnostic(s) — moteur hybride (règles + historique + IA)
              </p>
            </div>
            <div className="flex gap-2">
              {similarIncidents && similarIncidents.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSimilarIncidents(!showSimilarIncidents)}
                  className="text-xs"
                >
                  <History className="w-3 h-3 mr-1" />
                  Incidents ({similarIncidents.length})
                </Button>
              )}
              {failureTrends && failureTrends.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTrends(!showTrends)}
                  className="text-xs"
                >
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Tendances ({failureTrends.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {showSimilarIncidents && similarIncidents && similarIncidents.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
              <h5 className="font-semibold text-slate-900 text-sm mb-3 flex items-center">
                <History className="w-4 h-4 mr-2" />
                Incidents Similaires Récents
              </h5>
              <div className="space-y-2">
                {similarIncidents.map((incident, i) => (
                  <div key={i} className="flex items-center justify-between bg-white p-2.5 rounded border text-sm">
                    <div className="flex-1">
                      <span className="text-slate-500 text-xs">{incident.date}</span>
                      <span className="mx-2 text-slate-300">|</span>
                      <span className="font-medium text-slate-800">{incident.equipmentType}</span>
                      <p className="text-xs text-slate-600 mt-0.5 truncate">{incident.diagnosis}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs ml-2">
                      il y a {incident.daysAgo}j
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showTrends && failureTrends && failureTrends.length > 0 && (
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 mb-6">
              <h5 className="font-semibold text-violet-900 text-sm mb-3 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" />
                Tendances de Pannes
              </h5>
              <div className="space-y-2">
                {failureTrends.map((trend, i) => (
                  <div key={i} className="flex items-center justify-between bg-white p-2.5 rounded border text-sm">
                    <div>
                      <span className="font-medium text-violet-800">{trend.failureCode}</span>
                      <span className="text-violet-600 text-xs ml-2">({trend.occurrences} occurrences)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-xs ${
                        trend.direction === 'increasing' ? 'bg-red-100 text-red-800' : 
                        trend.direction === 'decreasing' ? 'bg-green-100 text-green-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {trend.direction === 'increasing' ? 'En hausse' : 
                         trend.direction === 'decreasing' ? 'En baisse' : 'Stable'}
                      </Badge>
                      <span className="text-xs text-violet-500">{trend.lastOccurrence}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              {cloudInsights && (
                <p className="text-sm text-blue-700">{cloudInsights}</p>
              )}
            </div>
          )}

          <div className="space-y-6">
            {suggestions.map((suggestion, index) => {
              const sourceBadge = getSourceBadge(suggestion.source);

              return (
                <div key={index} className="border border-carbon-gray-20 rounded-lg p-6 hover:shadow-lg transition-all duration-200 bg-white">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3 flex-wrap gap-1">
                      <span className="text-lg font-bold text-carbon-gray-50 mr-1">#{index + 1}</span>
                      <h4 className="font-semibold text-carbon-gray-90 text-lg">{suggestion.diagnosis}</h4>
                      <Badge className={`${sourceBadge.color} text-xs`}>
                        {sourceBadge.icon}
                        {sourceBadge.label}
                      </Badge>
                      {suggestion.cloudSource && (
                        <Badge variant="secondary" className="bg-blue-500 text-white text-xs">
                          <Cloud className="w-3 h-3 mr-1" />
                          Cloud
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={`${getConfidenceColor(suggestion.confidence)} text-white text-xs px-3 py-1 rounded-full font-medium`}>
                        {suggestion.confidence}% {t("confidence", language)}
                      </Badge>
                      <span className="text-xs text-carbon-gray-50">
                        Confiance: {getConfidenceLabel(suggestion.confidence)}
                      </span>
                    </div>
                  </div>

                  {suggestion.explanationFactors && suggestion.explanationFactors.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-xs font-semibold text-carbon-gray-70 mb-1.5 uppercase tracking-wide">Facteurs explicatifs</h5>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestion.explanationFactors.map((factor, fi) => (
                          <span
                            key={fi}
                            className={`inline-flex items-center text-xs px-2 py-1 rounded-full border ${getImpactColor(factor.impact)}`}
                            title={factor.detail}
                          >
                            {factor.impact === 'high' && <ArrowUpRight className="w-3 h-3 mr-1" />}
                            {factor.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <h5 className="font-semibold text-carbon-gray-90 mb-2">Solution recommandée</h5>
                    <p className="text-sm text-carbon-gray-70 bg-carbon-gray-10 p-3 rounded-md leading-relaxed">{suggestion.solution}</p>
                  </div>

                  {suggestion.repairSteps && suggestion.repairSteps.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                      <h5 className="font-semibold text-green-800 text-sm mb-2 flex items-center">
                        <Wrench className="w-4 h-4 mr-2" />
                        Étapes de réparation
                      </h5>
                      <ol className="text-xs text-green-800 space-y-1 list-decimal list-inside">
                        {suggestion.repairSteps.map((step, si) => (
                          <li key={si}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {suggestion.safetyWarnings && suggestion.safetyWarnings.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                      <h5 className="font-semibold text-red-800 text-sm mb-2 flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Avertissements de sécurité
                      </h5>
                      <ul className="text-xs text-red-700 space-y-1">
                        {suggestion.safetyWarnings.map((warn, wi) => (
                          <li key={wi} className="flex items-start">
                            <span className="text-red-500 mr-2 font-bold">!</span>
                            {warn}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {suggestion.tools && suggestion.tools.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-xs font-semibold text-carbon-gray-70 mb-1.5">Outillage nécessaire</h5>
                      <div className="flex flex-wrap gap-1">
                        {suggestion.tools.map((tool, ti) => (
                          <Badge key={ti} variant="outline" className="text-xs">{tool}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {suggestion.aiInsights && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <div className="flex items-center space-x-2 mb-1">
                        <Brain className="text-carbon-blue w-4 h-4" />
                        <span className="text-sm font-medium text-carbon-blue">{t("aiInsights", language)}</span>
                      </div>
                      <p className="text-xs text-carbon-gray-70">{suggestion.aiInsights}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {suggestion.riskLevel && (
                      <div className="text-center p-2 bg-carbon-gray-10 rounded">
                        <AlertTriangle className={`w-4 h-4 mx-auto mb-1 ${
                          suggestion.riskLevel === "Élevé" ? "text-red-500" : 
                          suggestion.riskLevel === "Moyen" ? "text-orange-500" : "text-green-500"
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
                    {suggestion.difficulty && (
                      <div className="text-center p-2 bg-carbon-gray-10 rounded">
                        <Target className="w-4 h-4 mx-auto mb-1 text-purple-500" />
                        <div className="text-xs font-medium text-carbon-gray-90">Difficulté</div>
                        <div className="text-xs text-carbon-gray-70">{suggestion.difficulty}</div>
                      </div>
                    )}
                    {!suggestion.difficulty && suggestion.matchingCases > 0 && (
                      <div className="text-center p-2 bg-carbon-gray-10 rounded">
                        <Lightbulb className="w-4 h-4 mx-auto mb-1 text-carbon-gray-50" />
                        <div className="text-xs font-medium text-carbon-gray-90">{t("cases", language)}</div>
                        <div className="text-xs text-carbon-gray-70">{suggestion.matchingCases}</div>
                      </div>
                    )}
                  </div>

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

                  <div className="flex space-x-2 pt-4 border-t border-carbon-gray-20">
                    <Button
                      onClick={() => suggestion.caseId && onStartRepair(suggestion.caseId)}
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
              );
            })}
          </div>
        </CardContent>

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
    </div>
  );
}
