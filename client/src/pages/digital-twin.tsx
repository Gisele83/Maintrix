import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Box, RefreshCw, Gauge, Clock, Settings2, Loader2 } from "lucide-react";

interface Equipment {
  id: number;
  equipmentName: string;
  equipmentType: string;
}
interface PhysicsModelResult {
  modelName: string;
  equipmentType: string;
  predictedBehavior: string;
  deviationFromNormal: number;
  physicalExplanation: string;
  confidence: number;
  parameters: Record<string, number>;
  remainingUsefulLife?: number;
}
interface DigitalTwin {
  id: number;
  equipmentId: number;
  calibration: Record<string, number>;
  isCalibrated: boolean;
  lastComputedAt: string | null;
}

// Noms de paramètres alignés sur server/cognitive-layers/physics-models.ts — varient selon le
// modèle physique réellement sélectionné pour le type d'équipement (moteur/pompe/compresseur/palier).
const CALIBRATION_FIELDS = [
  { key: "ratedCurrent", label: "Courant nominal (A) — moteur" },
  { key: "inletPressure", label: "Pression d'entrée (bar) — pompe/compresseur" },
  { key: "outletPressure", label: "Pression de sortie (bar) — pompe/compresseur" },
  { key: "flowRate", label: "Débit (m³/h) — pompe/compresseur" },
  { key: "load", label: "Charge (%) — palier" },
  { key: "speed", label: "Vitesse (tr/min) — palier" },
  { key: "operatingHours", label: "Heures de fonctionnement — moteur/palier" },
];

function deviationColor(d: number) {
  if (d > 0.7) return "text-red-600 bg-red-50";
  if (d > 0.4) return "text-orange-600 bg-orange-50";
  return "text-green-600 bg-green-50";
}

export default function DigitalTwinPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [calibration, setCalibration] = useState<Record<string, string>>({});

  const { data: equipmentList } = useQuery<Equipment[]>({ queryKey: ["/api/equipment"] });

  const { data: twinData, isFetching } = useQuery<{ twin: DigitalTwin; result: PhysicsModelResult | null }>({
    queryKey: ["/api/digital-twin", selectedId],
    queryFn: () => apiRequest(`/api/digital-twin/${selectedId}`),
    enabled: !!selectedId,
  });

  const refresh = useMutation({
    mutationFn: () => apiRequest(`/api/digital-twin/${selectedId}`),
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/digital-twin", selectedId], data);
      toast({ title: "Jumeau recalculé" });
    },
  });

  const calibrate = useMutation({
    mutationFn: () => {
      const payload: Record<string, number> = {};
      for (const [k, v] of Object.entries(calibration)) {
        if (v.trim() !== "") payload[k] = parseFloat(v);
      }
      return apiRequest(`/api/digital-twin/${selectedId}/calibration`, { method: "PATCH", body: payload });
    },
    onSuccess: () => {
      toast({ title: "Calibration enregistrée" });
      refresh.mutate();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const selectedEquipment = equipmentList?.find(e => e.id === selectedId);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Box className="w-6 h-6 text-blue-600" />
            Digital Twin
          </h1>
          <p className="text-gray-500">
            Chaque équipement possède son jumeau numérique — un modèle physique calibré pour LUI, pas un modèle générique par type.
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Équipement</CardTitle></CardHeader>
          <CardContent>
            <Select value={selectedId ? String(selectedId) : undefined} onValueChange={v => setSelectedId(parseInt(v, 10))}>
              <SelectTrigger><SelectValue placeholder="Choisir un équipement" /></SelectTrigger>
              <SelectContent>
                {(equipmentList ?? []).map(eq => (
                  <SelectItem key={eq.id} value={String(eq.id)}>{eq.equipmentName} ({eq.equipmentType})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedId && isFetching && !twinData && (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        )}

        {twinData && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base flex items-center gap-2"><Gauge className="w-4 h-4" />État du jumeau</CardTitle>
                  <CardDescription>
                    {twinData.twin.isCalibrated ? "Calibré pour cet équipement" : "Non calibré — paramètres par défaut génériques utilisés"}
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
                  {refresh.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {twinData.result ? (
                  <>
                    <div className={`rounded-lg p-4 ${deviationColor(twinData.result.deviationFromNormal)}`}>
                      <div className="font-semibold">{twinData.result.predictedBehavior}</div>
                      <div className="text-sm mt-1">{twinData.result.physicalExplanation}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div><span className="text-gray-500">Modèle</span><p className="font-medium">{twinData.result.modelName}</p></div>
                      <div><span className="text-gray-500">Confiance</span><p className="font-medium">{Math.round(twinData.result.confidence * 100)}%</p></div>
                      <div><span className="text-gray-500">Déviation</span><p className="font-medium">{Math.round(twinData.result.deviationFromNormal * 100)}%</p></div>
                    </div>
                    {twinData.result.remainingUsefulLife !== undefined && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Durée de vie résiduelle estimée : {Math.round(twinData.result.remainingUsefulLife)}h
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Aucun modèle physique disponible pour ce type d'équipement ({selectedEquipment?.equipmentType}).</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Settings2 className="w-4 h-4" />Calibration</CardTitle>
                <CardDescription>Paramètres physiques propres à cet équipement — surchargent les valeurs par défaut génériques du type.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {CALIBRATION_FIELDS.map(f => (
                    <div key={f.key}>
                      <Label>{f.label}</Label>
                      <Input
                        type="number"
                        placeholder={String(twinData.twin.calibration?.[f.key] ?? "")}
                        value={calibration[f.key] ?? ""}
                        onChange={e => setCalibration({ ...calibration, [f.key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                <Button size="sm" onClick={() => calibrate.mutate()} disabled={calibrate.isPending}>
                  {calibrate.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Enregistrer la calibration
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
