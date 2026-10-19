import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bug, List, NotebookPen, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { t } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const reportSchema = z.object({
  equipmentType: z.string().min(1, "Equipment type is required"),
  equipmentId: z.string().optional(),
  zone: z.string().optional(),
  contact: z.string().optional(),
  description: z.string().min(1, "Problem description is required"),
  attemptedSolutions: z.string().optional(),
  impact: z.enum(["low", "medium", "high"]),
});

type ReportForm = z.infer<typeof reportSchema>;

export function CaseReporting() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const form = useForm<ReportForm>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      equipmentType: "",
      equipmentId: "",
      zone: "",
      contact: "",
      description: "",
      attemptedSolutions: "",
      impact: "medium",
    },
  });

  // Submit report mutation
  const submitReportMutation = useMutation({
    mutationFn: async (data: ReportForm) => {
      return apiRequest("/api/report", { method: "POST", body: data });
    },
    onSuccess: () => {
      toast({
        title: t("success", language),
        description: "Rapport envoyé avec succès",
      });
      form.reset();
      setSelectedFiles([]);
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
    },
    onError: () => {
      toast({
        title: t("error", language),
        description: "Erreur lors de l'envoi du rapport",
        variant: "destructive",
      });
    },
  });

  // Fetch reported cases
  const { data: reportedCases = [] } = useQuery<any[]>({
    queryKey: ["/api/reports"],
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  const handleSubmit = (data: ReportForm) => {
    submitReportMutation.mutate(data);
  };

  const equipmentTypes = [
    { value: "moteur", label: t("electricMotor", language) },
    { value: "pompe", label: t("hydraulicPump", language) },
    { value: "compresseur", label: t("compressor", language) },
    { value: "convoyeur", label: t("conveyor", language) },
    { value: "variateur", label: t("variableSpeedDrive", language) },
    { value: "capteur", label: t("sensorInstrumentation", language) },
    { value: "automate", label: t("plc", language) },
    { value: "autre", label: t("other", language) },
  ];

  const zones = [
    { value: "production", label: t("production", language) },
    { value: "conditionnement", label: t("packaging", language) },
    { value: "stockage", label: t("storage", language) },
    { value: "utilites", label: t("utilities", language) },
    { value: "maintenance", label: t("maintenanceWorkshop", language) },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-etat-alerte-fond text-etat-alerte-texte border border-etat-alerte-filet hover:bg-etat-alerte-fond">{t("pending", language)}</Badge>;
      case "analyzing":
        return <Badge className="bg-etat-encours-fond text-etat-encours-texte border border-etat-encours-filet hover:bg-etat-encours-fond">{t("analyzing", language)}</Badge>;
      case "resolved":
        return <Badge className="bg-etat-nominal-fond text-etat-nominal-texte border border-etat-nominal-filet hover:bg-etat-nominal-fond">{t("resolved", language)}</Badge>;
      default:
        return <Badge className="bg-paper-deep text-ink">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return `${t("reportedAgo", language)} 1 jour`;
    } else if (diffDays < 7) {
      return `${t("reportedAgo", language)} ${diffDays} ${t("days", language)}`;
    } else {
      return date.toLocaleDateString(language === "fr" ? "fr-FR" : "en-US");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Report Form */}
      <Card className="border border-rule shadow-sm">
        <CardHeader className="border-b border-rule">
          <CardTitle className="text-xl font-semibold text-ink flex items-center space-x-2">
            <Bug className="text-etat-alerte-texte" />
            <span>{t("reportUnhandledCase", language)}</span>
          </CardTitle>
          <p className="text-ink-soft text-sm">
            {t("enrichKnowledgeBase", language)}
          </p>
        </CardHeader>
        
        <CardContent className="p-6">
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Equipment Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-ink mb-2">
                  {t("equipmentTypeRequired", language)}
                </Label>
                <Select onValueChange={(value) => form.setValue("equipmentType", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectEquipmentType", language)} />
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.equipmentType && (
                  <p className="text-etat-critique-texte text-sm mt-1">
                    {form.formState.errors.equipmentType.message}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium text-ink mb-2">
                  {t("equipmentId", language)}
                </Label>
                <Input
                  placeholder={t("equipmentIdPlaceholder", language)}
                  {...form.register("equipmentId")}
                  className="border-rule focus:ring-signal focus:border-transparent"
                />
              </div>
            </div>

            {/* Problem Description */}
            <div>
              <Label className="text-sm font-medium text-ink mb-2">
                {t("problemDescriptionRequired", language)}
              </Label>
              <Textarea
                rows={4}
                placeholder={t("problemPlaceholder", language)}
                {...form.register("description")}
                className="border-rule focus:ring-signal focus:border-transparent"
              />
              {form.formState.errors.description && (
                <p className="text-etat-critique-texte text-sm mt-1">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>

            {/* Attempted Solutions */}
            <div>
              <Label className="text-sm font-medium text-ink mb-2">
                {t("attemptedSolutions", language)}
              </Label>
              <Textarea
                rows={3}
                placeholder={t("attemptedSolutionsPlaceholder", language)}
                {...form.register("attemptedSolutions")}
                className="border-rule focus:ring-signal focus:border-transparent"
              />
            </div>

            {/* Impact */}
            <div>
              <Label className="text-sm font-medium text-ink mb-2">
                {t("productionImpact", language)}
              </Label>
              <RadioGroup
                defaultValue="medium"
                onValueChange={(value) => form.setValue("impact", value as "low" | "medium" | "high")}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="low" id="low" className="text-etat-nominal-texte" />
                  <Label htmlFor="low" className="text-sm">
                    {t("lowImpact", language)}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="medium" id="medium" className="text-etat-alerte-texte" />
                  <Label htmlFor="medium" className="text-sm">
                    {t("mediumImpact", language)}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="high" id="high" className="text-etat-critique-texte" />
                  <Label htmlFor="high" className="text-sm">
                    {t("highImpact", language)}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Additional Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-ink mb-2">
                  {t("zone", language)}
                </Label>
                <Select onValueChange={(value) => form.setValue("zone", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectZone", language)} />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((zone) => (
                      <SelectItem key={zone.value} value={zone.value}>
                        {zone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-ink mb-2">
                  {t("contact", language)}
                </Label>
                <Input
                  placeholder={t("contactPlaceholder", language)}
                  {...form.register("contact")}
                  className="border-rule focus:ring-signal focus:border-transparent"
                />
              </div>
            </div>

            {/* File Upload */}
            <div>
              <Label className="text-sm font-medium text-ink mb-2">
                {t("attachments", language)}
              </Label>
              <div className="border-2 border-dashed border-rule rounded-lg p-6 text-center hover:border-signal transition-colors duration-200">
                <Upload className="text-ink-mute text-2xl mb-2 mx-auto" />
                <p className="text-sm text-ink-soft mb-2">{t("dragDropFiles", language)}</p>
                <p className="text-xs text-ink-mute">{t("fileTypes", language)}</p>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  id="file-upload"
                />
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <Button type="button" variant="outline" className="mt-2">
                    Parcourir les fichiers
                  </Button>
                </Label>
              </div>
              {selectedFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {selectedFiles.map((file, index) => (
                    <p key={index} className="text-sm text-ink-soft">
                      {file.name} ({Math.round(file.size / 1024)} KB)
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitReportMutation.isPending}
              className="w-full bg-ink text-paper hover:bg-signal transition-colors duration-200 font-medium"
            >
              <NotebookPen className="w-4 h-4 mr-2" />
              {submitReportMutation.isPending ? t("loading", language) : t("sendReport", language)}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Reported Cases */}
      <Card className="border border-rule shadow-sm">
        <CardHeader className="border-b border-rule">
          <CardTitle className="text-xl font-semibold text-ink flex items-center space-x-2">
            <List className="text-signal" />
            <span>{t("recentReportedCases", language)}</span>
          </CardTitle>
          <p className="text-ink-soft text-sm">
            {t("reportTrackingSubtitle", language)}
          </p>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="space-y-4">
            {reportedCases.length === 0 ? (
              <div className="text-center py-8 text-ink-soft">
                Aucun cas signalé récemment
              </div>
            ) : (
              reportedCases.slice(0, 5).map((reportedCase: any) => (
                <div key={reportedCase.id} className="border border-rule rounded-lg p-4 hover:shadow-none transition-shadow duration-200">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-ink">
                        {reportedCase.equipmentId} - {reportedCase.description.substring(0, 50)}...
                      </h4>
                      <p className="text-sm text-ink-soft">{reportedCase.equipmentType}</p>
                    </div>
                    {getStatusBadge(reportedCase.status)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink-mute">
                    <span>{formatDate(reportedCase.createdAt)}</span>
                    <span>ID: #RPT-{reportedCase.id.toString().padStart(3, '0')}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Statistics */}
          <div className="mt-6 pt-6 border-t border-rule">
            <h4 className="font-medium text-ink mb-3">{t("reportStatistics", language)}</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-signal">
                  {reportedCases.filter((c: any) => c.status === "pending").length}
                </div>
                <div className="text-xs text-ink-soft">{t("inProgress", language)}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-etat-nominal-texte">
                  {reportedCases.filter((c: any) => c.status === "resolved").length}
                </div>
                <div className="text-xs text-ink-soft">{t("resolved", language)}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-etat-alerte-texte">
                  {reportedCases.filter((c: any) => {
                    const caseDate = new Date(c.createdAt);
                    const thisMonth = new Date();
                    return caseDate.getMonth() === thisMonth.getMonth() && 
                           caseDate.getFullYear() === thisMonth.getFullYear();
                  }).length}
                </div>
                <div className="text-xs text-ink-soft">{t("thisMonth", language)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
