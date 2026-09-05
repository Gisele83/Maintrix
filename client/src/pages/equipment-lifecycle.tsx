import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { GitCommitHorizontal, Clock, ArrowRight, Loader2, History } from "lucide-react";

interface Stage {
  key: string;
  label: string;
}
interface OverviewStage extends Stage {
  count: number;
}
interface Overview {
  total: number;
  byStage: OverviewStage[];
}
interface Equipment {
  id: number;
  equipmentName: string;
  equipmentType: string;
  lifecycleStage: string;
}
interface Transition {
  id: number;
  fromStage: string;
  toStage: string;
  reason: string | null;
  transitionedAt: string;
  relatedWorkOrderId: number | null;
}
interface LifecycleDetail {
  equipmentId: number;
  equipmentName: string;
  currentStage: string;
  currentStageLabel: string;
  stageSince: string;
  allowedNextStages: Stage[];
  history: Transition[];
}

const TERMINAL_COLOR = "bg-gray-200 text-gray-600 border-gray-300";
const ACTIVE_COLOR = "bg-blue-600 text-white border-blue-600";
const REACHED_COLOR = "bg-blue-50 text-blue-700 border-blue-200";

export default function EquipmentLifecyclePage() {
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null);

  const { data: stages } = useQuery<Stage[]>({ queryKey: ["/api/equipment-lifecycle/stages"] });
  const { data: overview } = useQuery<Overview>({ queryKey: ["/api/equipment-lifecycle/overview"] });
  const { data: equipmentList } = useQuery<Equipment[]>({ queryKey: ["/api/equipment"] });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GitCommitHorizontal className="w-6 h-6 text-blue-600" />
            Cycle de vie de l'actif — ISO 55000
          </h1>
          <p className="text-gray-500">
            12 étapes, transitions contraintes, historique tracé. La colonne vertébrale temporelle qui relie
            GMAO, Digital Twin, Predictive Engine et Engineering Expertise.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Vue d'ensemble ({overview?.total ?? "—"} équipements)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(overview?.byStage ?? []).map((s) => (
                <div key={s.key} className="flex flex-col items-center gap-1 min-w-[90px] rounded-lg border border-gray-200 px-3 py-2">
                  <span className="text-lg font-bold">{s.count}</span>
                  <span className="text-[11px] text-gray-500 text-center leading-tight">{s.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sélectionner un équipement</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={selectedEquipmentId ?? ""}
              onChange={(e) => setSelectedEquipmentId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— Choisir un équipement —</option>
              {(equipmentList ?? []).map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.equipmentName} ({eq.equipmentType})</option>
              ))}
            </select>
          </CardContent>
        </Card>

        {selectedEquipmentId && <EquipmentDetail equipmentId={selectedEquipmentId} stages={stages ?? []} />}
      </div>
    </div>
  );
}

function EquipmentDetail({ equipmentId, stages }: { equipmentId: number; stages: Stage[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  const { data, isLoading } = useQuery<LifecycleDetail>({ queryKey: [`/api/equipment-lifecycle/${equipmentId}`] });

  const transition = useMutation({
    mutationFn: (toStage: string) => apiRequest(`/api/equipment-lifecycle/${equipmentId}/transition`, {
      method: "POST",
      body: { toStage, reason: reason || undefined },
    }),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/equipment-lifecycle/${equipmentId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-lifecycle/overview"] });
      toast({ title: "Transition effectuée", description: `Nouvelle étape : ${result.equipment.lifecycleStage}` });
      setReason("");
      setPendingTarget(null);
    },
    onError: (e: any) => toast({ title: "Transition refusée", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !data) {
    return <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Chargement du cycle de vie…</p>;
  }

  const currentIndex = stages.findIndex(s => s.key === data.currentStage);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{data.equipmentName}</CardTitle>
          <CardDescription className="text-xs flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Dans l'étape « {data.currentStageLabel} » depuis le {data.stageSince ? new Date(data.stageSince).toLocaleString("fr-FR") : "—"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-1">
            {stages.map((s, i) => {
              const isCurrent = s.key === data.currentStage;
              const isPast = currentIndex >= 0 && i < currentIndex;
              return (
                <div key={s.key} className="flex items-center">
                  <Badge variant="outline" className={`text-[11px] ${isCurrent ? ACTIVE_COLOR : isPast ? REACHED_COLOR : TERMINAL_COLOR}`}>
                    {s.label}
                  </Badge>
                  {i < stages.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300 mx-0.5" />}
                </div>
              );
            })}
          </div>

          {data.allowedNextStages.length === 0 ? (
            <p className="text-xs text-gray-400">Étape terminale — aucune transition possible.</p>
          ) : (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <Label className="text-xs">Motif de la transition (optionnel)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex : dérive vibratoire détectée, seuil critique franchi" className="text-sm" />
              <div className="flex flex-wrap gap-2 pt-1">
                {data.allowedNextStages.map((s) => (
                  <Button
                    key={s.key}
                    size="sm"
                    variant="outline"
                    disabled={transition.isPending}
                    onClick={() => { setPendingTarget(s.key); transition.mutate(s.key); }}
                  >
                    {transition.isPending && pendingTarget === s.key && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                    → {s.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4" />Historique des transitions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.history.length === 0 && <p className="text-xs text-gray-400">Aucune transition enregistrée pour cet équipement.</p>}
          {data.history.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-xs border-b border-gray-100 pb-2 last:border-0">
              <div>
                <span className="font-medium">{t.fromStage}</span>
                <ArrowRight className="w-3 h-3 inline mx-1 text-gray-400" />
                <span className="font-medium">{t.toStage}</span>
                {t.reason && <span className="text-gray-500"> — {t.reason}</span>}
              </div>
              <span className="text-gray-400 flex-shrink-0 ml-2">{new Date(t.transitionedAt).toLocaleString("fr-FR")}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
