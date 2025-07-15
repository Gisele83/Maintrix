import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wrench, Clock, Settings, Phone, MessageCircle, AlertTriangle, Check, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/hooks/use-language";
import { t } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";

interface RepairGuidanceProps {
  caseId: number;
}

export function RepairGuidance({ caseId }: RepairGuidanceProps) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());

  // Fetch repair procedures
  const { data: repairData, isLoading } = useQuery({
    queryKey: ["/api/repair", caseId],
    enabled: !!caseId,
  });

  // Update step completion
  const updateStepMutation = useMutation({
    mutationFn: async ({ stepId, completed }: { stepId: number; completed: boolean }) => {
      return apiRequest("PATCH", `/api/repair/step/${stepId}`, { completed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/repair", caseId] });
    },
  });

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDuration = (minutes: number | undefined) => {
    if (!minutes) return "";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (isLoading || !repairData) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2">
          <Card className="border border-carbon-gray-20 shadow-sm">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-carbon-gray-20 rounded w-3/4"></div>
                <div className="h-4 bg-carbon-gray-20 rounded w-1/2"></div>
                <div className="h-32 bg-carbon-gray-20 rounded"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { case: maintenanceCase, procedures } = repairData;
  const completedSteps = procedures.filter((p: any) => p.isCompleted).length;
  const totalSteps = procedures.length;
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const handleStepCompletion = (stepId: number, completed: boolean) => {
    updateStepMutation.mutate({ stepId, completed });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      {/* Repair Steps */}
      <div className="xl:col-span-2">
        <Card className="border border-carbon-gray-20 shadow-sm">
          <CardHeader className="border-b border-carbon-gray-20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-carbon-gray-90 flex items-center space-x-2">
                  <Wrench className="text-carbon-blue" />
                  <span>{t("repairProcedure", language)}</span>
                </CardTitle>
                <p className="text-carbon-gray-70 text-sm mt-1">
                  {maintenanceCase.diagnosis} - {maintenanceCase.equipmentType} {maintenanceCase.equipmentId}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-carbon-blue">{completedSteps}/{totalSteps}</div>
                <div className="text-xs text-carbon-gray-50">{t("stepsCompleted", language)}</div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4">
              <Progress value={progressPercentage} className="w-full h-2" />
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {/* Safety Warning */}
            <div className="bg-red-50 border border-carbon-red rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="text-carbon-red text-xl flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-carbon-red mb-1">{t("safetyWarning", language)}</h4>
                  <ul className="text-sm text-carbon-red space-y-1">
                    <li>• Couper l'alimentation électrique et consigner</li>
                    <li>• Porter les EPI (gants, lunettes, chaussures de sécurité)</li>
                    <li>• Vérifier l'absence de tension</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Repair Steps */}
            <div className="space-y-4">
              {procedures.map((procedure: any, index: number) => {
                const isCompleted = procedure.isCompleted;
                const isCurrent = !isCompleted && index === completedSteps;
                const isFuture = index > completedSteps;

                return (
                  <div
                    key={procedure.id}
                    className={`flex items-start space-x-4 p-4 rounded-lg border ${
                      isCompleted
                        ? "bg-green-50 border-carbon-green"
                        : isCurrent
                        ? "bg-blue-50 border-2 border-carbon-blue"
                        : "bg-gray-50 border-carbon-gray-20 opacity-60"
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        isCompleted
                          ? "bg-carbon-green text-white"
                          : isCurrent
                          ? "bg-carbon-blue text-white"
                          : "bg-carbon-gray-50 text-carbon-gray-70"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="text-sm" />
                      ) : (
                        <span className="text-sm font-bold">{procedure.stepNumber}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-carbon-gray-90 mb-1">
                        {procedure.stepNumber}. {language === "en" ? procedure.titleEn : procedure.title}
                      </h4>
                      <p className="text-sm text-carbon-gray-70 mb-3">
                        {language === "en" ? procedure.descriptionEn : procedure.description}
                      </p>
                      
                      {/* Tools Required */}
                      {procedure.toolsRequired && procedure.toolsRequired.length > 0 && (
                        <div className="bg-white border border-carbon-gray-20 rounded p-3 mb-3">
                          <h5 className="text-sm font-medium text-carbon-gray-90 mb-2">
                            {t("toolsRequired", language)}
                          </h5>
                          <ul className="text-sm text-carbon-gray-70 space-y-1">
                            {(language === "en" ? procedure.toolsRequiredEn : procedure.toolsRequired)?.map((tool: string, toolIndex: number) => (
                              <li key={toolIndex} className="flex items-center space-x-2">
                                <Settings className="text-xs" />
                                <span>{tool}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Completion Actions */}
                      {isCurrent && (
                        <div className="space-y-3">
                          <div className="flex space-x-3">
                            <Button
                              onClick={() => handleStepCompletion(procedure.id, true)}
                              disabled={updateStepMutation.isPending}
                              className="bg-carbon-blue text-white hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
                            >
                              <Check className="w-4 h-4 mr-2" />
                              {t("markAsCompleted", language)}
                            </Button>
                            <Button
                              variant="outline"
                              className="border-carbon-gray-20 text-carbon-gray-90 hover:bg-carbon-gray-10 transition-colors duration-200 text-sm"
                            >
                              <HelpCircle className="w-4 h-4 mr-2" />
                              {t("help", language)}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Completed Status */}
                      {isCompleted && (
                        <div className="flex items-center space-x-2 mt-2">
                          <span className="text-xs text-carbon-green font-medium">✓ {t("completed", language)}</span>
                          <span className="text-xs text-carbon-gray-50">{t("ago", language)} 15 {t("min", language)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Side Panel */}
      <div className="space-y-6">
        {/* Timer Card */}
        <Card className="border border-carbon-gray-20 shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-carbon-gray-90 mb-4 flex items-center space-x-2">
              <Clock className="text-carbon-blue" />
              <span>{t("repairTime", language)}</span>
            </h3>
            <div className="text-center">
              <div className="text-3xl font-bold text-carbon-blue mb-2">
                {formatTime(elapsedTime)}
              </div>
              <div className="text-sm text-carbon-gray-70">{t("elapsedTime", language)}</div>
            </div>
            <div className="mt-4 pt-4 border-t border-carbon-gray-20">
              <div className="flex justify-between text-sm">
                <span className="text-carbon-gray-70">{t("estimatedDuration", language)}</span>
                <span className="font-medium">{formatDuration(maintenanceCase.duration)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Parts Required */}
        <Card className="border border-carbon-gray-20 shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-carbon-gray-90 mb-4 flex items-center space-x-2">
              <Settings className="text-carbon-blue" />
              <span>{t("partsRequired", language)}</span>
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-carbon-gray-10 rounded">
                <div>
                  <div className="font-medium text-sm">Roulement 6206-2RS</div>
                  <div className="text-xs text-carbon-gray-70">Référence: SKF-6206-2RS1</div>
                </div>
                <span className="text-xs bg-carbon-green text-white px-2 py-1 rounded">
                  {t("stock", language)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-carbon-gray-10 rounded">
                <div>
                  <div className="font-medium text-sm">Joint d'étanchéité</div>
                  <div className="text-xs text-carbon-gray-70">Référence: SEAL-001</div>
                </div>
                <span className="text-xs bg-carbon-green text-white px-2 py-1 rounded">
                  {t("stock", language)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Support */}
        <Card className="bg-orange-50 border border-carbon-orange shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-carbon-gray-90 mb-3 flex items-center space-x-2">
              <Phone className="text-carbon-orange" />
              <span>{t("technicalSupport", language)}</span>
            </h3>
            <p className="text-sm text-carbon-gray-70 mb-4">{t("needHelp", language)}</p>
            <div className="space-y-2">
              <Button className="w-full bg-carbon-orange text-white hover:bg-orange-600 transition-colors duration-200 text-sm font-medium">
                <Phone className="w-4 h-4 mr-2" />
                {t("emergencyCall", language)}
              </Button>
              <Button
                variant="outline"
                className="w-full border-carbon-orange text-carbon-orange hover:bg-orange-50 transition-colors duration-200 text-sm"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                {t("chatSupport", language)}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
