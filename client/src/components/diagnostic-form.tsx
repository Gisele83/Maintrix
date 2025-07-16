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
    { value: "moteur", label: language === "fr" ? "Moteur électrique" : "Electric motor" },
    { value: "pompe", label: language === "fr" ? "Pompe hydraulique" : "Hydraulic pump" },
    { value: "compresseur", label: language === "fr" ? "Compresseur" : "Compressor" },
    { value: "convoyeur", label: language === "fr" ? "Convoyeur" : "Conveyor" },
    { value: "variateur", label: language === "fr" ? "Variateur de vitesse" : "Variable speed drive" },
    { value: "capteur", label: language === "fr" ? "Capteur/Instrumentation" : "Sensor/Instrumentation" },
    { value: "automate", label: language === "fr" ? "Automate programmable" : "PLC" },
    { value: "convertisseur", label: language === "fr" ? "Convertisseur de puissance" : "Power converter" },
    { value: "onduleur", label: language === "fr" ? "Onduleur/UPS" : "Inverter/UPS" },
    { value: "redresseur", label: language === "fr" ? "Redresseur" : "Rectifier" },
    { value: "carte_electronique", label: language === "fr" ? "Carte électronique" : "Electronic board" },
    { value: "alimentation", label: language === "fr" ? "Alimentation électronique" : "Power supply" },
    { value: "autre", label: language === "fr" ? "Autre" : "Other" },
  ];

  const zones = [
    { value: "production", label: language === "fr" ? "Production" : "Production" },
    { value: "conditionnement", label: language === "fr" ? "Conditionnement" : "Packaging" },
    { value: "stockage", label: language === "fr" ? "Stockage" : "Storage" },
    { value: "utilites", label: language === "fr" ? "Utilités" : "Utilities" },
    { value: "maintenance", label: language === "fr" ? "Atelier maintenance" : "Maintenance workshop" },
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

  // Symptômes spécifiques par type d'équipement
  const getSymptomsByEquipment = (equipmentType: string) => {
    const allSymptoms = {
      // Moteur électrique
      moteur: [
        { id: "motor_overheating", label: "Surchauffe moteur", category: "thermal", priority: "high" },
        { id: "motor_vibrations", label: "Vibrations anormales", category: "mechanical", priority: "high" },
        { id: "bearing_noise", label: "Bruit de roulement", category: "mechanical", priority: "high" },
        { id: "motor_humming", label: "Ronronnement sans démarrage", category: "electrical", priority: "high" },
        { id: "insulation_defect", label: "Défaut d'isolement", category: "electrical", priority: "medium" },
        { id: "phase_imbalance", label: "Déséquilibre des phases", category: "electrical", priority: "medium" },
        { id: "motor_misalignment", label: "Désalignement", category: "mechanical", priority: "medium" },
        { id: "coupling_wear", label: "Usure accouplement", category: "mechanical", priority: "medium" },
        { id: "motor_sparks", label: "Étincelles aux balais", category: "electrical", priority: "low" },
        { id: "cooling_fan_failure", label: "Défaut ventilation", category: "thermal", priority: "low" },
      ],
      
      // Pompe hydraulique
      pompe: [
        { id: "pump_cavitation", label: "Cavitation", category: "fluid", priority: "high" },
        { id: "hydraulic_leak", label: "Fuite hydraulique", category: "fluid", priority: "high" },
        { id: "pressure_loss", label: "Perte de pression", category: "fluid", priority: "high" },
        { id: "insufficient_flow", label: "Débit insuffisant", category: "performance", priority: "high" },
        { id: "pump_vibrations", label: "Vibrations", category: "mechanical", priority: "medium" },
        { id: "seal_failure", label: "Défaillance joints", category: "fluid", priority: "medium" },
        { id: "impeller_wear", label: "Usure roue", category: "mechanical", priority: "medium" },
        { id: "suction_problems", label: "Problème d'aspiration", category: "fluid", priority: "medium" },
        { id: "pump_overheating", label: "Surchauffe pompe", category: "thermal", priority: "low" },
        { id: "air_bubbles", label: "Bulles d'air", category: "fluid", priority: "low" },
      ],

      // Compresseur
      compresseur: [
        { id: "compressor_overheating", label: "Surchauffe compresseur", category: "thermal", priority: "high" },
        { id: "pressure_drop", label: "Chute de pression", category: "performance", priority: "high" },
        { id: "valve_problems", label: "Problème soupapes", category: "mechanical", priority: "high" },
        { id: "oil_leak", label: "Fuite d'huile", category: "fluid", priority: "medium" },
        { id: "compressor_noise", label: "Bruit excessif", category: "mechanical", priority: "medium" },
        { id: "vibration_excessive", label: "Vibrations excessives", category: "mechanical", priority: "medium" },
        { id: "filter_clogging", label: "Colmatage filtres", category: "fluid", priority: "medium" },
        { id: "belt_wear", label: "Usure courroies", category: "mechanical", priority: "low" },
        { id: "cooling_issues", label: "Problème refroidissement", category: "thermal", priority: "low" },
      ],

      // Convoyeur
      convoyeur: [
        { id: "belt_slippage", label: "Glissement courroie", category: "mechanical", priority: "high" },
        { id: "belt_misalignment", label: "Désalignement bande", category: "mechanical", priority: "high" },
        { id: "roller_seizure", label: "Grippage rouleau", category: "mechanical", priority: "high" },
        { id: "drive_motor_issues", label: "Problème moteur d'entraînement", category: "electrical", priority: "medium" },
        { id: "belt_wear", label: "Usure bande transporteuse", category: "mechanical", priority: "medium" },
        { id: "tensioning_problems", label: "Problème tension", category: "mechanical", priority: "medium" },
        { id: "bearing_failure", label: "Défaillance roulements", category: "mechanical", priority: "medium" },
        { id: "frame_vibration", label: "Vibration châssis", category: "mechanical", priority: "low" },
        { id: "speed_variation", label: "Variation vitesse", category: "performance", priority: "low" },
      ],

      // Variateur de vitesse / Convertisseur de puissance
      variateur: [
        { id: "drive_overheating", label: "Surchauffe variateur", category: "thermal", priority: "high" },
        { id: "igbt_failure", label: "Défaillance IGBT", category: "electrical", priority: "high" },
        { id: "dc_bus_overvoltage", label: "Surtension bus DC", category: "electrical", priority: "high" },
        { id: "overcurrent_trip", label: "Déclenchement surintensité", category: "electrical", priority: "high" },
        { id: "gate_driver_fault", label: "Défaut driver de grille", category: "electrical", priority: "high" },
        { id: "capacitor_aging", label: "Vieillissement condensateurs", category: "electrical", priority: "medium" },
        { id: "switching_frequency_noise", label: "Bruit fréquence découpage", category: "electrical", priority: "medium" },
        { id: "thermal_protection", label: "Protection thermique activée", category: "thermal", priority: "medium" },
        { id: "encoder_feedback_error", label: "Erreur retour codeur", category: "control", priority: "medium" },
        { id: "communication_timeout", label: "Timeout communication", category: "control", priority: "medium" },
        { id: "parameter_corruption", label: "Corruption paramètres", category: "control", priority: "medium" },
        { id: "power_stage_asymmetry", label: "Asymétrie étage puissance", category: "electrical", priority: "low" },
        { id: "cooling_fan_noise", label: "Bruit ventilateur", category: "mechanical", priority: "low" },
        { id: "display_flicker", label: "Scintillement affichage", category: "control", priority: "low" },
      ],

      // Capteur/Instrumentation
      capteur: [
        { id: "sensor_drift", label: "Dérive capteur", category: "control", priority: "high" },
        { id: "signal_loss", label: "Perte signal", category: "control", priority: "high" },
        { id: "calibration_error", label: "Erreur étalonnage", category: "control", priority: "high" },
        { id: "analog_output_error", label: "Erreur sortie analogique", category: "electrical", priority: "high" },
        { id: "digital_communication_fault", label: "Défaut communication digitale", category: "control", priority: "high" },
        { id: "sensor_overrange", label: "Dépassement gamme mesure", category: "control", priority: "medium" },
        { id: "temperature_drift", label: "Dérive thermique", category: "thermal", priority: "medium" },
        { id: "wiring_issues", label: "Problème câblage", category: "electrical", priority: "medium" },
        { id: "interference_emi", label: "Interférences EMI/RFI", category: "electrical", priority: "medium" },
        { id: "sensor_contamination", label: "Contamination capteur", category: "environmental", priority: "medium" },
        { id: "power_supply_noise", label: "Bruit alimentation", category: "electrical", priority: "medium" },
        { id: "linearization_error", label: "Erreur linéarisation", category: "control", priority: "low" },
        { id: "mounting_vibration", label: "Vibrations fixation", category: "mechanical", priority: "low" },
        { id: "humidity_ingress", label: "Infiltration humidité", category: "environmental", priority: "low" },
      ],

      // Automate (PLC)
      automate: [
        { id: "plc_fault", label: "Défaut automate", category: "control", priority: "high" },
        { id: "io_module_error", label: "Erreur module E/S", category: "control", priority: "high" },
        { id: "communication_timeout", label: "Timeout communication", category: "control", priority: "high" },
        { id: "memory_error", label: "Erreur mémoire", category: "control", priority: "medium" },
        { id: "watchdog_fault", label: "Défaut watchdog", category: "control", priority: "medium" },
        { id: "power_supply_issue", label: "Problème alimentation", category: "electrical", priority: "medium" },
        { id: "program_corruption", label: "Corruption programme", category: "control", priority: "medium" },
        { id: "battery_low", label: "Pile faible", category: "electrical", priority: "low" },
        { id: "fieldbus_error", label: "Erreur bus terrain", category: "control", priority: "low" },
      ],

      // Convertisseur de puissance
      convertisseur: [
        { id: "power_module_failure", label: "Défaillance module puissance", category: "electrical", priority: "high" },
        { id: "thyristor_scr_fault", label: "Défaut thyristor/SCR", category: "electrical", priority: "high" },
        { id: "commutation_failure", label: "Défaut commutation", category: "electrical", priority: "high" },
        { id: "ac_dc_imbalance", label: "Déséquilibre AC/DC", category: "electrical", priority: "high" },
        { id: "reactive_power_issue", label: "Problème puissance réactive", category: "electrical", priority: "medium" },
        { id: "harmonic_distortion", label: "Distorsion harmonique", category: "electrical", priority: "medium" },
        { id: "snubber_circuit_fault", label: "Défaut circuit écrêteur", category: "electrical", priority: "medium" },
        { id: "transformer_saturation", label: "Saturation transformateur", category: "electrical", priority: "medium" },
        { id: "cooling_system_fault", label: "Défaut système refroidissement", category: "thermal", priority: "low" },
        { id: "control_board_error", label: "Erreur carte contrôle", category: "control", priority: "low" },
      ],

      // Onduleur/UPS
      onduleur: [
        { id: "battery_failure", label: "Défaillance batterie", category: "electrical", priority: "high" },
        { id: "inverter_fault", label: "Défaut onduleur", category: "electrical", priority: "high" },
        { id: "bypass_activation", label: "Activation bypass", category: "electrical", priority: "high" },
        { id: "output_voltage_regulation", label: "Régulation tension sortie", category: "electrical", priority: "high" },
        { id: "frequency_drift", label: "Dérive fréquence", category: "electrical", priority: "medium" },
        { id: "charger_malfunction", label: "Dysfonctionnement chargeur", category: "electrical", priority: "medium" },
        { id: "static_switch_fault", label: "Défaut commutateur statique", category: "electrical", priority: "medium" },
        { id: "battery_temperature_high", label: "Température batterie élevée", category: "thermal", priority: "medium" },
        { id: "autonomy_reduced", label: "Autonomie réduite", category: "performance", priority: "low" },
        { id: "alarm_monitoring", label: "Alarme surveillance", category: "control", priority: "low" },
      ],

      // Redresseur
      redresseur: [
        { id: "diode_failure", label: "Défaillance diode", category: "electrical", priority: "high" },
        { id: "rectifier_bridge_fault", label: "Défaut pont redresseur", category: "electrical", priority: "high" },
        { id: "filter_capacitor_aging", label: "Vieillissement condensateur filtrage", category: "electrical", priority: "high" },
        { id: "regulation_error", label: "Erreur régulation", category: "electrical", priority: "high" },
        { id: "ripple_voltage_high", label: "Ondulation tension élevée", category: "electrical", priority: "medium" },
        { id: "transformer_heating", label: "Échauffement transformateur", category: "thermal", priority: "medium" },
        { id: "protection_tripping", label: "Déclenchement protections", category: "electrical", priority: "medium" },
        { id: "power_factor_low", label: "Facteur puissance faible", category: "electrical", priority: "medium" },
        { id: "cooling_ventilation", label: "Refroidissement/ventilation", category: "thermal", priority: "low" },
        { id: "connection_oxidation", label: "Oxydation connexions", category: "environmental", priority: "low" },
      ],

      // Carte électronique
      carte_electronique: [
        { id: "component_failure", label: "Défaillance composant", category: "electrical", priority: "high" },
        { id: "solder_joint_crack", label: "Fissure soudure", category: "mechanical", priority: "high" },
        { id: "electrolytic_capacitor_dry", label: "Condensateur électrolytique sec", category: "electrical", priority: "high" },
        { id: "microcontroller_lockup", label: "Blocage microcontrôleur", category: "control", priority: "high" },
        { id: "crystal_oscillator_drift", label: "Dérive oscillateur quartz", category: "electrical", priority: "medium" },
        { id: "pcb_trace_corrosion", label: "Corrosion piste PCB", category: "environmental", priority: "medium" },
        { id: "component_overheating", label: "Surchauffe composant", category: "thermal", priority: "medium" },
        { id: "esd_damage", label: "Dommage ESD", category: "electrical", priority: "medium" },
        { id: "firmware_corruption", label: "Corruption firmware", category: "control", priority: "medium" },
        { id: "connector_wear", label: "Usure connecteur", category: "mechanical", priority: "low" },
        { id: "led_indicator_fault", label: "Défaut LED indicateur", category: "control", priority: "low" },
        { id: "conformal_coating_damage", label: "Dommage vernis protection", category: "environmental", priority: "low" },
      ],

      // Alimentation électronique
      alimentation: [
        { id: "switching_regulator_fault", label: "Défaut régulateur à découpage", category: "electrical", priority: "high" },
        { id: "output_voltage_drift", label: "Dérive tension sortie", category: "electrical", priority: "high" },
        { id: "current_limiting_active", label: "Limitation courant active", category: "electrical", priority: "high" },
        { id: "thermal_shutdown", label: "Arrêt thermique", category: "thermal", priority: "high" },
        { id: "input_filter_failure", label: "Défaillance filtre entrée", category: "electrical", priority: "medium" },
        { id: "switching_noise", label: "Bruit de commutation", category: "electrical", priority: "medium" },
        { id: "isolation_breakdown", label: "Claquage isolation", category: "electrical", priority: "medium" },
        { id: "feedback_loop_instability", label: "Instabilité boucle retour", category: "control", priority: "medium" },
        { id: "power_good_signal_fault", label: "Défaut signal Power Good", category: "control", priority: "low" },
        { id: "standby_power_high", label: "Consommation veille élevée", category: "performance", priority: "low" },
        { id: "electromagnetic_interference", label: "Interférences électromagnétiques", category: "electrical", priority: "low" },
      ],

      // Autre équipement (symptômes génériques)
      autre: [
        { id: "general_malfunction", label: "Dysfonctionnement général", category: "performance", priority: "high" },
        { id: "unusual_noise", label: "Bruit inhabituel", category: "mechanical", priority: "medium" },
        { id: "temperature_rise", label: "Élévation température", category: "thermal", priority: "medium" },
        { id: "vibration_detected", label: "Vibrations détectées", category: "mechanical", priority: "medium" },
        { id: "electrical_fault", label: "Défaut électrique", category: "electrical", priority: "medium" },
        { id: "fluid_problems", label: "Problème fluide", category: "fluid", priority: "low" },
        { id: "control_issues", label: "Problème contrôle", category: "control", priority: "low" },
        { id: "environmental_damage", label: "Dommage environnemental", category: "environmental", priority: "low" },
      ],
    };

    return allSymptoms[equipmentType as keyof typeof allSymptoms] || allSymptoms.autre;
  };

  const currentSymptoms = getSymptomsByEquipment(form.watch("equipmentType"));

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
                <SelectValue placeholder={language === "fr" ? "Sélectionner un type d'équipement..." : "Select equipment type..."} />
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
                  <SelectValue placeholder={language === "fr" ? "Sélectionner une zone..." : "Select a zone..."} />
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
                {language === "fr" ? "Ligne/Secteur" : "Line/Sector"}
              </Label>
              <Select 
                value={form.watch("sector") || ""} 
                onValueChange={(value) => form.setValue("sector", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === "fr" ? "Sélectionner ligne/secteur..." : "Select line/sector..."} />
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

          {/* Symptoms - Dynamic based on Equipment Type */}
          <div>
            <Label className="text-sm font-medium text-carbon-gray-90 mb-3">
              {form.watch("equipmentType") 
                ? `Symptômes spécifiques - ${equipmentTypes.find(t => t.value === form.watch("equipmentType"))?.label || 'Équipement'}`
                : "Sélectionnez d'abord un type d'équipement"
              }
            </Label>
            
            {form.watch("equipmentType") ? (
              <div>
                {/* Symptômes prioritaires */}
                <div className="mb-4">
                  <h4 className="font-medium text-sm text-red-700 mb-2 flex items-center">
                    🚨 Symptômes critiques
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {currentSymptoms.filter(s => s.priority === "high").map((symptom) => (
                      <div key={symptom.id} className="flex items-center space-x-2 bg-red-50 p-2 rounded border-l-4 border-red-500">
                        <Checkbox
                          id={symptom.id}
                          checked={selectedSymptoms.includes(symptom.id)}
                          onCheckedChange={(checked) => 
                            handleSymptomChange(symptom.id, checked as boolean)
                          }
                          className="border-red-300 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                        />
                        <Label htmlFor={symptom.id} className="text-sm font-medium text-red-800">
                          {symptom.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Symptômes moyens */}
                <div className="mb-4">
                  <h4 className="font-medium text-sm text-orange-700 mb-2 flex items-center">
                    ⚠️ Symptômes moyens
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {currentSymptoms.filter(s => s.priority === "medium").map((symptom) => (
                      <div key={symptom.id} className="flex items-center space-x-2 bg-orange-50 p-2 rounded">
                        <Checkbox
                          id={symptom.id}
                          checked={selectedSymptoms.includes(symptom.id)}
                          onCheckedChange={(checked) => 
                            handleSymptomChange(symptom.id, checked as boolean)
                          }
                          className="border-orange-300 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                        />
                        <Label htmlFor={symptom.id} className="text-sm text-orange-800">
                          {symptom.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Symptômes mineurs */}
                <div>
                  <h4 className="font-medium text-sm text-blue-700 mb-2 flex items-center">
                    ℹ️ Symptômes mineurs
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {currentSymptoms.filter(s => s.priority === "low").map((symptom) => (
                      <div key={symptom.id} className="flex items-center space-x-2 bg-blue-50 p-2 rounded">
                        <Checkbox
                          id={symptom.id}
                          checked={selectedSymptoms.includes(symptom.id)}
                          onCheckedChange={(checked) => 
                            handleSymptomChange(symptom.id, checked as boolean)
                          }
                          className="border-blue-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                        <Label htmlFor={symptom.id} className="text-sm text-blue-800">
                          {symptom.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-600">Veuillez d'abord sélectionner un type d'équipement pour voir les symptômes spécifiques</p>
              </div>
            )}
          </div>

          {/* Detailed Symptoms Description */}
          <div>
            <Label className="text-sm font-medium text-carbon-gray-90 mb-2">
              {t("symptomsObservedRequired", language)}
            </Label>
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
