import { Lightbulb, Save, Wrench } from "lucide-react";
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
            <div key={index} className="border border-carbon-gray-20 rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-carbon-gray-90">{suggestion.diagnosis}</h4>
                <Badge 
                  className={`${getConfidenceColor(suggestion.confidence)} ${getConfidenceTextColor(suggestion.confidence)} text-xs px-2 py-1 rounded-full`}
                >
                  {suggestion.confidence}% {t("confidence", language)}
                </Badge>
              </div>
              <p className="text-sm text-carbon-gray-70 mb-3">{suggestion.solution}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-carbon-gray-50">
                  {t("basedOnCases", language)} {suggestion.matchingCases} {t("cases", language)}
                </span>
                <button 
                  className="text-carbon-blue text-sm font-medium hover:underline"
                  onClick={() => onStartRepair(suggestion.caseId)}
                >
                  {t("viewProcedure", language)}
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
