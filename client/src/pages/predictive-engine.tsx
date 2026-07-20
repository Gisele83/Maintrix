import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity, Gauge, Clock, AlertTriangle, Wrench, ClipboardCheck, ArrowRight, Loader2, PlayCircle,
} from "lucide-react";

interface Equipment { id: number; equipmentName: string; equipmentType: string; }

interface UnifiedResult {
  equipmentId: number;
  equipmentName: string;
  equipmentType: string;
  healthScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  rul: { available: boolean; result?: any; nReadings?: number; message?: string };
  anomaly: { available: boolean; detections: any[]; agentHealthScore?: number; message?: string };
  predictedFailures: any[];
  recommendations: any[];
  autoWorkOrder: { created: boolean; workOrderId?: number; orderNumber?: string; reason: string };
}

const RISK_COLOR: Record<string, string> = {
  low: "bg-green-100 text-green-700", medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-700",
};

function StageCard({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Icon className="w-4 h-4 text-blue-600" />{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function PredictiveEnginePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: equipmentList } = useQuery<Equipment[]>({ queryKey: ["/api/equipment"] });

  const run = useMutation({
    mutationFn: () => apiRequest(`/api/predictive-engine/${selectedId}`),
    onSuccess: (data: UnifiedResult) => {
      queryClient.setQueryData(["/api/predictive-engine", selectedId], data);
      if (data.autoWorkOrder.created) {
        toast({ title: "OT créé automatiquement", description: data.autoWorkOrder.orderNumber });
      } else {
        toast({ title: "Analyse terminée" });
      }
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const result = queryClient.getQueryData<UnifiedResult>(["/api/predictive-engine", selectedId]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Predictive Maintenance Engine
          </h1>
          <p className="text-gray-500">
            Health Score → RUL → Anomaly Detection → Failure Prediction → Automatic Work Order — un seul pipeline, pas 5 briques dispersées.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 flex gap-3 items-end">
            <div className="flex-1">
              <Select value={selectedId ? String(selectedId) : undefined} onValueChange={v => setSelectedId(parseInt(v, 10))}>
                <SelectTrigger><SelectValue placeholder="Choisir un équipement" /></SelectTrigger>
                <SelectContent>
                  {(equipmentList ?? []).map(eq => (
                    <SelectItem key={eq.id} value={String(eq.id)}>{eq.equipmentName} ({eq.equipmentType})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => run.mutate()} disabled={!selectedId || run.isPending}>
              {run.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
              Analyser
            </Button>
          </CardContent>
        </Card>

        {result && result.equipmentId === selectedId && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{result.equipmentName}</CardTitle>
                <Badge className={RISK_COLOR[result.riskLevel]}>Risque {result.riskLevel}</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{result.healthScore}<span className="text-base text-gray-400">/100</span></div>
                <p className="text-xs text-gray-500">Health Score</p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StageCard icon={Clock} title="Remaining Useful Life (RUL)">
                {result.rul.available ? (
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-500">Modèle :</span> {result.rul.result?.recommendedModel}</p>
                    <p><span className="text-gray-500">Médiane :</span> {Math.round(result.rul.result?.recommended?.median ?? 0)}h</p>
                    <p><span className="text-gray-500">P10 (pessimiste) :</span> {Math.round(result.rul.result?.recommended?.confidenceIntervals?.p10 ?? 0)}h</p>
                    <p className="text-xs text-gray-400">{result.rul.nReadings} lectures IoT utilisées</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">{result.rul.message}</p>
                )}
              </StageCard>

              <StageCard icon={AlertTriangle} title="Anomaly Detection">
                {result.anomaly.available ? (
                  result.anomaly.detections.length > 0 ? (
                    <div className="space-y-1">
                      {result.anomaly.detections.map((a: any, i: number) => (
                        <div key={i} className="text-sm">
                          <Badge variant="outline" className="text-xs mr-1">{a.rawData?.sensorType ?? a.anomalyType}</Badge>
                          <Badge className={a.severity === "critical" ? "bg-red-100 text-red-700 mr-1" : "bg-orange-100 text-orange-700 mr-1"}>{a.severity}</Badge>
                          {a.description}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-green-600">Aucune anomalie détectée (agent health score : {result.anomaly.agentHealthScore})</p>
                  )
                ) : (
                  <p className="text-sm text-gray-400">{result.anomaly.message}</p>
                )}
              </StageCard>

              <StageCard icon={Gauge} title="Failure Prediction">
                {result.predictedFailures.length > 0 ? (
                  <ul className="text-sm space-y-1">
                    {result.predictedFailures.map((f: any, i: number) => (
                      <li key={i}>{f.name ?? f.patternId} — {Math.round((f.probability ?? 0) * 100)}%</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400">Aucune panne anticipée.</p>
                )}
              </StageCard>

              <StageCard icon={Wrench} title="Automatic Work Order">
                {result.autoWorkOrder.created ? (
                  <div className="text-sm">
                    <Badge className="bg-green-100 text-green-700 mb-1">Créé : {result.autoWorkOrder.orderNumber}</Badge>
                    <p className="text-gray-500">{result.autoWorkOrder.reason}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">{result.autoWorkOrder.reason}</p>
                )}
              </StageCard>
            </div>

            {result.recommendations.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ClipboardCheck className="w-4 h-4" />Recommandations</CardTitle></CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {result.recommendations.map((r: any, i: number) => (
                      <li key={i} className="flex items-center gap-1">
                        <ArrowRight className="w-3 h-3 text-gray-400" />{r.action ?? JSON.stringify(r)}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
