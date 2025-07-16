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
    // Symptômes mécaniques
    { id: "bruit_anormal", label: t("abnormalNoise", language), category: "mechanical" },
    { id: "vibrations", label: t("vibrations", language), category: "mechanical" },
    { id: "vibrations_excessives", label: "Vibrations excessives", category: "mechanical" },
    { id: "blocage_mecanique", label: "Blocage mécanique", category: "mechanical" },
    { id: "jeu_excessif", label: "Jeu excessif", category: "mechanical" },
    { id: "desalignement", label: "Désalignement", category: "mechanical" },
    { id: "usure_anormale", label: "Usure anormale", category: "mechanical" },
    { id: "roulement_defaillant", label: "Roulement défaillant", category: "mechanical" },
    
    // Symptômes thermiques
    { id: "surchauffe", label: t("overheating", language), category: "thermal" },
    { id: "temperature_elevee", label: "Température élevée", category: "thermal" },
    { id: "points_chauds", label: "Points chauds détectés", category: "thermal" },
    { id: "refroidissement_insuffisant", label: "Refroidissement insuffisant", category: "thermal" },
    { id: "ventilation_defaillante", label: "Ventilation défaillante", category: "thermal" },
    
    // Symptômes électriques
    { id: "panne_electrique", label: t("electricalFailure", language), category: "electrical" },
    { id: "disjonction_frequente", label: "Disjonction fréquente", category: "electrical" },
    { id: "tension_anormale", label: "Tension anormale", category: "electrical" },
    { id: "intensite_elevee", label: "Intensité élevée", category: "electrical" },
    { id: "etincelles", label: "Étincelles", category: "electrical" },
    { id: "odeur_brule", label: "Odeur de brûlé", category: "electrical" },
    { id: "defaut_terre", label: "Défaut de terre", category: "electrical" },
    { id: "court_circuit", label: "Court-circuit", category: "electrical" },
    
    // Symptômes hydrauliques/pneumatiques
    { id: "fuite", label: t("leak", language), category: "fluid" },
    { id: "pression_faible", label: "Pression faible", category: "fluid" },
    { id: "pression_instable", label: "Pression instable", category: "fluid" },
    { id: "debit_reduit", label: "Débit réduit", category: "fluid" },
    { id: "cavitation", label: "Cavitation", category: "fluid" },
    { id: "amorcage_difficile", label: "Amorçage difficile", category: "fluid" },
    { id: "perte_amorcage", label: "Perte d'amorçage", category: "fluid" },
    { id: "claquement_valves", label: "Claquement de valves", category: "fluid" },
    
    // Symptômes de performance
    { id: "performance_degradee", label: t("degradedPerformance", language), category: "performance" },
    { id: "rendement_faible", label: "Rendement faible", category: "performance" },
    { id: "vitesse_incorrecte", label: "Vitesse incorrecte", category: "performance" },
    { id: "arret_intempestif", label: "Arrêt intempestif", category: "performance" },
    { id: "demarrage_difficile", label: "Démarrage difficile", category: "performance" },
    { id: "fonctionnement_intermittent", label: "Fonctionnement intermittent", category: "performance" },
    { id: "perte_couple", label: "Perte de couple", category: "performance" },
    
    // Symptômes de commande/contrôle
    { id: "defaut_capteur", label: "Défaut capteur", category: "control" },
    { id: "erreur_communication", label: "Erreur de communication", category: "control" },
    { id: "ecran_defaillant", label: "Écran défaillant", category: "control" },
    { id: "reglage_perdu", label: "Réglage perdu", category: "control" },
    { id: "alarme_active", label: "Alarme active", category: "control" },
    { id: "voyant_defaut", label: "Voyant défaut", category: "control" },
    
    // Symptômes environnementaux
    { id: "corrosion", label: "Corrosion", category: "environmental" },
    { id: "encrassement", label: "Encrassement", category: "environmental" },
    { id: "humidite_excessive", label: "Humidité excessive", category: "environmental" },
    { id: "poussiere_excessive", label: "Poussière excessive", category: "environmental" },
    { id: "contamination", label: "Contamination", category: "environmental" },
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
            <Select 
              value={form.watch("equipmentType") || ""} 
              onValueChange={(value) => form.setValue("equipmentType", value)}
            >
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
              <Select 
                value={form.watch("zone") || ""} 
                onValueChange={(value) => form.setValue("zone", value)}
              >
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
              <Select 
                value={form.watch("sector") || ""} 
                onValueChange={(value) => form.setValue("sector", value)}
              >
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
            <Label className="text-sm font-medium text-carbon-gray-90 mb-3">
              {t("symptomsObservedRequired", language)}
            </Label>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
              {/* Mechanical Symptoms */}
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <h4 className="font-medium text-sm text-carbon-gray-90 mb-2 flex items-center">
                  ⚙️ Symptômes mécaniques
                </h4>
                <div className="space-y-2">
                  {symptomOptions.filter(s => s.category === "mechanical").map((symptom) => (
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
              </div>

              {/* Thermal Symptoms */}
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <h4 className="font-medium text-sm text-carbon-gray-90 mb-2 flex items-center">
                  🌡️ Symptômes thermiques
                </h4>
                <div className="space-y-2">
                  {symptomOptions.filter(s => s.category === "thermal").map((symptom) => (
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
              </div>

              {/* Electrical Symptoms */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                <h4 className="font-medium text-sm text-carbon-gray-90 mb-2 flex items-center">
                  ⚡ Symptômes électriques
                </h4>
                <div className="space-y-2">
                  {symptomOptions.filter(s => s.category === "electrical").map((symptom) => (
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
              </div>

              {/* Fluid Symptoms */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <h4 className="font-medium text-sm text-carbon-gray-90 mb-2 flex items-center">
                  💧 Symptômes hydrauliques/pneumatiques
                </h4>
                <div className="space-y-2">
                  {symptomOptions.filter(s => s.category === "fluid").map((symptom) => (
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
              </div>

              {/* Performance Symptoms */}
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                <h4 className="font-medium text-sm text-carbon-gray-90 mb-2 flex items-center">
                  📈 Symptômes de performance
                </h4>
                <div className="space-y-2">
                  {symptomOptions.filter(s => s.category === "performance").map((symptom) => (
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
              </div>

              {/* Control Symptoms */}
              <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                <h4 className="font-medium text-sm text-carbon-gray-90 mb-2 flex items-center">
                  🎛️ Symptômes de commande/contrôle
                </h4>
                <div className="space-y-2">
                  {symptomOptions.filter(s => s.category === "control").map((symptom) => (
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
              </div>
            </div>

            {/* Environmental Symptoms - Full width */}
            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg mb-3">
              <h4 className="font-medium text-sm text-carbon-gray-90 mb-2 flex items-center">
                🌿 Symptômes environnementaux
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {symptomOptions.filter(s => s.category === "environmental").map((symptom) => (
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
