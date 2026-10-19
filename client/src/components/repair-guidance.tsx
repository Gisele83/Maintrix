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
  const { data: repairData, isLoading } = useQuery<any>({
    queryKey: ["/api/repair", caseId],
    enabled: !!caseId,
  });

  // Update step completion
  const updateStepMutation = useMutation({
    mutationFn: async ({ stepId, completed }: { stepId: number; completed: boolean }) => {
      return apiRequest(`/api/repair/step/${stepId}`, { method: "PATCH", body: { completed } });
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
          <Card className="border border-rule shadow-sm">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-rule rounded w-3/4"></div>
                <div className="h-4 bg-rule rounded w-1/2"></div>
                <div className="h-32 bg-rule rounded"></div>
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
        <Card className="border border-rule shadow-sm">
          <CardHeader className="border-b border-rule">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-ink flex items-center space-x-2">
                  <Wrench className="text-signal" />
                  <span>{t("repairProcedure", language)}</span>
                </CardTitle>
                <p className="text-ink-soft text-sm mt-1">
                  {maintenanceCase.diagnosis} - {maintenanceCase.equipmentType} {maintenanceCase.equipmentId}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-signal">{completedSteps}/{totalSteps}</div>
                <div className="text-xs text-ink-mute">{t("stepsCompleted", language)}</div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4">
              <Progress value={progressPercentage} className="w-full h-2" />
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {/* Safety Warning */}
            <div className="bg-etat-critique-fond border border-etat-critique-filet rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="text-etat-critique-texte text-xl flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-etat-critique-texte mb-1">{t("safetyWarning", language)}</h4>
                  <ul className="text-sm text-etat-critique-texte space-y-1">
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
                        ? "bg-etat-nominal-fond border-etat-nominal-filet"
                        : isCurrent
                        ? "bg-etat-encours-fond border-2 border-signal"
                        : "bg-paper border-rule opacity-60"
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        isCompleted
                          ? "bg-etat-nominal-vif text-white"
                          : isCurrent
                          ? "bg-signal text-white"
                          : "bg-paper-deep text-ink-soft"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="text-sm" />
                      ) : (
                        <span className="text-sm font-bold">{procedure.stepNumber}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-ink mb-1">
                        {procedure.stepNumber}. {language === "en" ? procedure.titleEn : procedure.title}
                      </h4>
                      <p className="text-sm text-ink-soft mb-3">
                        {language === "en" ? procedure.descriptionEn : procedure.description}
                      </p>
                      
                      {/* Tools Required */}
                      {procedure.toolsRequired && procedure.toolsRequired.length > 0 && (
                        <div className="bg-white border border-rule rounded p-3 mb-3">
                          <h5 className="text-sm font-medium text-ink mb-2">
                            {t("toolsRequired", language)}
                          </h5>
                          <ul className="text-sm text-ink-soft space-y-1">
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
                              className="bg-ink text-paper hover:bg-signal transition-colors duration-200 text-sm font-medium"
                            >
                              <Check className="w-4 h-4 mr-2" />
                              {t("markAsCompleted", language)}
                            </Button>
                            <Button
                              variant="outline"
                              className="border-rule text-ink hover:bg-paper transition-colors duration-200 text-sm"
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
                          <span className="text-xs text-etat-nominal-texte font-medium">{t("completed", language)}</span>
                          <span className="text-xs text-ink-mute">{t("ago", language)} 15 {t("min", language)}</span>
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
        <Card className="border border-rule shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-ink mb-4 flex items-center space-x-2">
              <Clock className="text-signal" />
              <span>{t("repairTime", language)}</span>
            </h3>
            <div className="text-center">
              <div className="text-3xl font-bold text-signal mb-2">
                {formatTime(elapsedTime)}
              </div>
              <div className="text-sm text-ink-soft">{t("elapsedTime", language)}</div>
            </div>
            <div className="mt-4 pt-4 border-t border-rule">
              <div className="flex justify-between text-sm">
                <span className="text-ink-soft">{t("estimatedDuration", language)}</span>
                <span className="font-medium">{formatDuration(maintenanceCase.duration)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Parts Required */}
        <Card className="border border-rule shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-ink mb-4 flex items-center space-x-2">
              <Settings className="text-signal" />
              <span>{t("partsRequired", language)}</span>
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-paper rounded">
                <div>
                  <div className="font-medium text-sm">Roulement 6206-2RS</div>
                  <div className="text-xs text-ink-soft">Référence: SKF-6206-2RS1</div>
                </div>
                <span className="text-xs bg-etat-nominal-fond text-etat-nominal-texte border border-etat-nominal-filet px-2 py-1">
                  {t("stock", language)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-paper rounded">
                <div>
                  <div className="font-medium text-sm">Joint d'étanchéité</div>
                  <div className="text-xs text-ink-soft">Référence: SEAL-001</div>
                </div>
                <span className="text-xs bg-etat-nominal-fond text-etat-nominal-texte border border-etat-nominal-filet px-2 py-1">
                  {t("stock", language)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Support */}
        <Card className="bg-etat-alerte-fond border border-etat-alerte-filet shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-ink mb-3 flex items-center space-x-2">
              <Phone className="text-etat-alerte-texte" />
              <span>{t("technicalSupport", language)}</span>
            </h3>
            <p className="text-sm text-ink-soft mb-4">{t("needHelp", language)}</p>
            <div className="space-y-2">
              <Button className="w-full bg-ink text-paper hover:bg-signal transition-colors duration-200 text-sm font-medium">
                <Phone className="w-4 h-4 mr-2" />
                {t("emergencyCall", language)}
              </Button>
              <Button
                variant="outline"
                className="w-full border-etat-alerte-filet text-etat-alerte-texte hover:bg-etat-alerte-fond transition-colors duration-200 text-sm"
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
