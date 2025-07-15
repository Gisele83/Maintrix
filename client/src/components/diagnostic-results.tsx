import { Lightbulb, Save, Wrench, Brain, AlertTriangle, Euro, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { t } from "@/lib/i18n";

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
}

interface DiagnosticResultsProps {
  suggestions: DiagnosticSuggestion[];
  isLoading: boolean;
  onStartRepair: (caseId: number) => void;
  onSaveDiagnostic: (suggestion: DiagnosticSuggestion) => void;
}

export function DiagnosticResults({ 
  suggestions, 
  isLoading, 
  onStartRepair, 
  onSaveDiagnostic 
}: DiagnosticResultsProps) {
  const { language } = useLanguage();

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
        <div className="space-y-4">
          {suggestions.map((suggestion, index) => (
            <div key={index} className="border border-carbon-gray-20 rounded-lg p-5 hover:shadow-lg transition-all duration-200 bg-white">
              {/* Header with diagnosis and confidence */}
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-carbon-gray-90 text-lg">{suggestion.diagnosis}</h4>
                <Badge 
                  className={`${getConfidenceColor(suggestion.confidence)} ${getConfidenceTextColor(suggestion.confidence)} text-xs px-3 py-1 rounded-full font-medium`}
                >
                  {suggestion.confidence}% {t("confidence", language)}
                </Badge>
              </div>

              {/* Solution */}
              <p className="text-sm text-carbon-gray-70 mb-4 leading-relaxed">{suggestion.solution}</p>

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
              <div className="flex items-center justify-between pt-3 border-t border-carbon-gray-20">
                <span className="text-xs text-carbon-gray-50">
                  {t("basedOnCases", language)} {suggestion.matchingCases} {t("cases", language)}
                </span>
                <button 
                  className="text-carbon-blue text-sm font-medium hover:underline flex items-center space-x-1"
                  onClick={() => onStartRepair(suggestion.caseId)}
                >
                  <span>{t("viewProcedure", language)}</span>
                </button>
              </div>
            </div>
          ))}
          
          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4 border-t border-carbon-gray-20">
            <Button 
              className="flex-1 bg-carbon-green text-white hover:bg-green-700 transition-colors duration-200 font-medium"
              onClick={() => suggestions.length > 0 && onStartRepair(suggestions[0].caseId)}
            >
              <Wrench className="w-4 h-4 mr-2" />
              {t("startRepair", language)}
            </Button>
            <Button 
              variant="outline"
              className="flex-1 border-carbon-gray-20 text-carbon-gray-90 hover:bg-carbon-gray-10 transition-colors duration-200 font-medium"
              onClick={() => suggestions.length > 0 && onSaveDiagnostic(suggestions[0])}
            >
              <Save className="w-4 h-4 mr-2" />
              {t("saveDiagnostic", language)}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
