import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useLanguage } from "@/hooks/use-language";
import { t } from "@/lib/i18n";

const diagnosticSchema = z.object({
  equipmentType: z.string().min(1, "Equipment type is required"),
  equipmentId: z.string().optional(),
  zone: z.string().optional(),
  sector: z.string().optional(),
  symptoms: z.string().min(1, "Symptoms description is required"),
  symptomsChecked: z.array(z.string()),
  urgency: z.enum(["low", "medium", "high"]),
});

type DiagnosticForm = z.infer<typeof diagnosticSchema>;

interface DiagnosticFormProps {
  onSubmit: (data: DiagnosticForm) => void;
  isLoading: boolean;
}

export function DiagnosticForm({ onSubmit, isLoading }: DiagnosticFormProps) {
  const { language } = useLanguage();
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  const form = useForm<DiagnosticForm>({
    resolver: zodResolver(diagnosticSchema),
    defaultValues: {
      equipmentType: "",
      equipmentId: "",
      zone: "",
      sector: "",
      symptoms: "",
      symptomsChecked: [],
      urgency: "medium",
    },
  });

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

  const sectors = [
    { value: "ligne1", label: "Ligne 1" },
    { value: "ligne2", label: "Ligne 2" },
    { value: "ligne3", label: "Ligne 3" },
    { value: "secteur_a", label: "Secteur A" },
    { value: "secteur_b", label: "Secteur B" },
    { value: "secteur_c", label: "Secteur C" },
    { value: "atelier_mecanique", label: "Atelier Mécanique" },
    { value: "atelier_electrique", label: "Atelier Électrique" },
    { value: "reception", label: "Réception" },
    { value: "expedition", label: "Expédition" },
    { value: "qualite", label: "Contrôle Qualité" },
    { value: "transfert", label: "Transfert" },
  ];

  const symptomOptions = [
    { id: "bruit_anormal", label: t("abnormalNoise", language) },
    { id: "vibrations", label: t("vibrations", language) },
    { id: "surchauffe", label: t("overheating", language) },
    { id: "panne_electrique", label: t("electricalFailure", language) },
    { id: "fuite", label: t("leak", language) },
    { id: "performance_degradee", label: t("degradedPerformance", language) },
  ];

  const handleSymptomChange = (symptomId: string, checked: boolean) => {
    const updated = checked 
      ? [...selectedSymptoms, symptomId]
      : selectedSymptoms.filter(id => id !== symptomId);
    
    setSelectedSymptoms(updated);
    form.setValue("symptomsChecked", updated);
  };

  const handleSubmit = (data: DiagnosticForm) => {
    onSubmit({ ...data, symptomsChecked: selectedSymptoms });
  };

  return (
    <Card className="border border-carbon-gray-20 shadow-sm">
      <CardHeader className="border-b border-carbon-gray-20">
        <CardTitle className="text-xl font-semibold text-carbon-gray-90 flex items-center space-x-2">
          <Search className="text-carbon-blue" />
          <span>{t("newDiagnostic", language)}</span>
        </CardTitle>
        <p className="text-carbon-gray-70 text-sm">
          {t("diagnosticSubtitle", language)}
        </p>
      </CardHeader>
      
      <CardContent className="p-6">
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Equipment Type */}
          <div>
            <Label className="text-sm font-medium text-carbon-gray-90 mb-2">
              {t("equipmentTypeRequired", language)}
            </Label>
            <Select onValueChange={(value) => form.setValue("equipmentType", value)}>
              <SelectTrigger className="w-full">
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
              <p className="text-carbon-red text-sm mt-1">
                {form.formState.errors.equipmentType.message}
              </p>
            )}
          </div>

          {/* Equipment ID */}
          <div>
            <Label className="text-sm font-medium text-carbon-gray-90 mb-2">
              {t("equipmentId", language)}
            </Label>
            <Input
              placeholder={t("equipmentIdPlaceholder", language)}
              {...form.register("equipmentId")}
              className="border-carbon-gray-20 focus:ring-carbon-blue focus:border-transparent"
            />
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-carbon-gray-90 mb-2">
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
              <Label className="text-sm font-medium text-carbon-gray-90 mb-2">
                Ligne/Secteur
              </Label>
              <Select onValueChange={(value) => form.setValue("sector", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner ligne/secteur" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((sector) => (
                    <SelectItem key={sector.value} value={sector.value}>
                      {sector.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Symptoms */}
          <div>
            <Label className="text-sm font-medium text-carbon-gray-90 mb-2">
              {t("symptomsObservedRequired", language)}
            </Label>
            <div className="space-y-2 mb-3">
              {symptomOptions.map((symptom) => (
                <div key={symptom.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={symptom.id}
                    checked={selectedSymptoms.includes(symptom.id)}
                    onCheckedChange={(checked) => 
                      handleSymptomChange(symptom.id, checked as boolean)
                    }
                    className="border-carbon-gray-20 data-[state=checked]:bg-carbon-blue data-[state=checked]:border-carbon-blue"
                  />
                  <Label htmlFor={symptom.id} className="text-sm">
                    {symptom.label}
                  </Label>
                </div>
              ))}
            </div>
            <Textarea
              placeholder={t("symptomsPlaceholder", language)}
              rows={4}
              {...form.register("symptoms")}
              className="border-carbon-gray-20 focus:ring-carbon-blue focus:border-transparent"
            />
            {form.formState.errors.symptoms && (
              <p className="text-carbon-red text-sm mt-1">
                {form.formState.errors.symptoms.message}
              </p>
            )}
          </div>

          {/* Urgency Level */}
          <div>
            <Label className="text-sm font-medium text-carbon-gray-90 mb-2">
              {t("urgencyLevel", language)}
            </Label>
            <RadioGroup
              defaultValue="medium"
              onValueChange={(value) => form.setValue("urgency", value as "low" | "medium" | "high")}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="low" id="low" className="text-carbon-green" />
                <Label htmlFor="low" className="text-sm text-carbon-green font-medium">
                  {t("urgencyLow", language)}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium" id="medium" className="text-carbon-orange" />
                <Label htmlFor="medium" className="text-sm text-carbon-orange font-medium">
                  {t("urgencyMedium", language)}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="high" id="high" className="text-carbon-red" />
                <Label htmlFor="high" className="text-sm text-carbon-red font-medium">
                  {t("urgencyHigh", language)}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-carbon-blue text-white hover:bg-blue-700 focus:ring-carbon-blue transition-colors duration-200 font-medium"
          >
            <Search className="w-4 h-4 mr-2" />
            {isLoading ? t("analyzing", language) : t("analyzeAndDiagnose", language)}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
