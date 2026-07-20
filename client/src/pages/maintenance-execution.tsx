import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, uploadFile } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2, Circle, XCircle, Loader2, ArrowRight, ClipboardList,
  Search, Wrench, Gauge, ShieldCheck, Truck, BookOpen, PackageCheck, ClipboardCheck, Network,
  Upload as UploadIcon, File as FileIcon,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type StepType = "reception" | "inspection" | "diagnostic" | "reparation" | "essais" | "controle_qualite" | "livraison" | "rex";

interface WorkOrderSummary {
  id: number;
  orderNumber: string;
  title: string;
  equipmentId: number | null;
  status: string;
}

interface InterventionExecution {
  id: number;
  workOrderId: number;
  equipmentId: number;
  currentStep: StepType | "terminee";
  overallStatus: "in_progress" | "completed" | "on_hold";
  startedAt: string;
  completedAt: string | null;
}

interface InterventionStep {
  id: number;
  executionId: number;
  stepType: StepType;
  sequenceOrder: number;
  status: "pending" | "in_progress" | "completed" | "rejected" | "skipped";
  technicianId: number | null;
  diagnosticSessionId: number | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  notes: string | null;
  structuredData: Record<string, unknown> | null;
  rejectionReason: string | null;
}

interface Measurement {
  id: number;
  measurementType: string;
  value: number;
  unit: string | null;
  expectedMin: number | null;
  expectedMax: number | null;
  withinTolerance: boolean | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const STEP_ORDER: StepType[] = ["reception", "inspection", "diagnostic", "reparation", "essais", "controle_qualite", "livraison", "rex"];

const STEP_META: Record<StepType, { label: string; icon: any }> = {
  reception: { label: "Réception", icon: ClipboardList },
  inspection: { label: "Inspection", icon: Search },
  diagnostic: { label: "Diagnostic", icon: Gauge },
  reparation: { label: "Réparation", icon: Wrench },
  essais: { label: "Essais", icon: ClipboardCheck },
  controle_qualite: { label: "Contrôle Qualité", icon: ShieldCheck },
  livraison: { label: "Livraison", icon: Truck },
  rex: { label: "Retour d'expérience", icon: BookOpen },
};

const STATUS_BADGE: Record<InterventionStep["status"], { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-gray-100 text-gray-600" },
  in_progress: { label: "En cours", className: "bg-blue-100 text-blue-700" },
  completed: { label: "Terminée", className: "bg-green-100 text-green-700" },
  rejected: { label: "Rejetée", className: "bg-red-100 text-red-700" },
  skipped: { label: "Ignorée", className: "bg-gray-100 text-gray-500" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MaintenanceExecutionPage({ workOrderId: workOrderIdParam }: { workOrderId?: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<number | null>(
    workOrderIdParam ? parseInt(workOrderIdParam, 10) : null
  );

  const { data: workOrders } = useQuery<WorkOrderSummary[]>({ queryKey: ["/api/work-orders"] });

  const { data: executions } = useQuery<InterventionExecution[]>({
    queryKey: ["/api/interventions/by-work-order", selectedWorkOrderId],
    queryFn: () => apiRequest(`/api/interventions/by-work-order/${selectedWorkOrderId}`),
    enabled: !!selectedWorkOrderId,
  });
  const execution = executions?.[0];

  const { data: executionDetail, refetch: refetchDetail } = useQuery<{ execution: InterventionExecution; steps: InterventionStep[] }>({
    queryKey: ["/api/interventions", execution?.id],
    queryFn: () => apiRequest(`/api/interventions/${execution!.id}`),
    enabled: !!execution?.id,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/interventions/by-work-order", selectedWorkOrderId] });
    if (execution?.id) queryClient.invalidateQueries({ queryKey: ["/api/interventions", execution.id] });
  };

  const createExecution = useMutation({
    mutationFn: (wo: WorkOrderSummary) => apiRequest("/api/interventions", {
      method: "POST",
      body: { workOrderId: wo.id, equipmentId: wo.equipmentId },
    }),
    onSuccess: () => {
      toast({ title: "Intervention créée", description: "Étape de réception démarrée." });
      invalidateAll();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const startStep = useMutation({
    mutationFn: (diagnosticSessionId?: number) => apiRequest(`/api/interventions/${execution!.id}/steps/start`, {
      method: "POST",
      body: diagnosticSessionId ? { diagnosticSessionId } : {},
    }),
    onSuccess: () => invalidateAll(),
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const completeStep = useMutation({
    mutationFn: (params: { stepId: number; structuredData?: Record<string, unknown>; rejectionReason?: string; notes?: string }) =>
      apiRequest(`/api/interventions/${execution!.id}/steps/${params.stepId}/complete`, {
        method: "POST",
        body: { structuredData: params.structuredData, rejectionReason: params.rejectionReason, notes: params.notes },
      }),
    onSuccess: (res) => {
      const nextStep = res.execution.currentStep;
      toast({
        title: res.step.status === "rejected" ? "Étape rejetée" : "Étape complétée",
        description: nextStep === "terminee" ? "Intervention terminée." : `Étape suivante : ${STEP_META[nextStep as StepType]?.label ?? nextStep}`,
      });
      invalidateAll();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const currentInProgressStep = executionDetail?.steps.find(s => s.status === "in_progress");

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Maintenance Execution</h1>
            <p className="text-gray-500">Réception → Inspection → Diagnostic → Réparation → Essais → Contrôle Qualité → Livraison → REX</p>
          </div>
          <Link href="/knowledge-graph">
            <Button variant="outline" size="sm">
              <Network className="w-4 h-4 mr-2" />
              Voir le Knowledge Graph
            </Button>
          </Link>
        </div>

        {/* Sélection de l'ordre de travail */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ordre de travail</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedWorkOrderId ? String(selectedWorkOrderId) : undefined}
              onValueChange={(v) => setSelectedWorkOrderId(parseInt(v, 10))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir un ordre de travail" />
              </SelectTrigger>
              <SelectContent>
                {(workOrders ?? []).map(wo => (
                  <SelectItem key={wo.id} value={String(wo.id)}>{wo.orderNumber} — {wo.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedWorkOrderId && !execution && (() => {
          const wo = workOrders?.find(w => w.id === selectedWorkOrderId);
          const missingEquipment = wo && !wo.equipmentId;
          return (
            <Card>
              <CardContent className="pt-6 flex items-center justify-between">
                <p className="text-gray-600">
                  {missingEquipment
                    ? "Cet ordre de travail n'a aucun équipement associé — impossible de démarrer une intervention."
                    : "Aucune exécution d'intervention pour cet OT."}
                </p>
                <Button
                  onClick={() => wo && createExecution.mutate(wo)}
                  disabled={createExecution.isPending || missingEquipment}
                >
                  {createExecution.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Démarrer l'intervention
                </Button>
              </CardContent>
            </Card>
          );
        })()}

        {executionDetail && (
          <>
            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  Progression
                  <Badge variant={executionDetail.execution.overallStatus === "completed" ? "default" : "secondary"}>
                    {executionDetail.execution.overallStatus === "completed" ? "Terminée" : "En cours"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {STEP_ORDER.map((stepType, idx) => {
                    const Icon = STEP_META[stepType].icon;
                    const isCurrent = executionDetail.execution.currentStep === stepType;
                    const stepsOfType = executionDetail.steps.filter(s => s.stepType === stepType);
                    const lastOfType = stepsOfType[stepsOfType.length - 1];
                    return (
                      <div key={stepType} className="flex items-center">
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm ${
                          isCurrent ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 text-gray-500"
                        }`}>
                          <Icon className="w-3.5 h-3.5" />
                          {STEP_META[stepType].label}
                          {lastOfType && (
                            lastOfType.status === "completed" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> :
                            lastOfType.status === "rejected" ? <XCircle className="w-3.5 h-3.5 text-red-500" /> :
                            <Circle className="w-3.5 h-3.5" />
                          )}
                        </div>
                        {idx < STEP_ORDER.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-gray-300 mx-1" />}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Action sur l'étape courante */}
            {executionDetail.execution.currentStep !== "terminee" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Étape courante : {STEP_META[executionDetail.execution.currentStep as StepType]?.label}
                  </CardTitle>
                  <CardDescription>
                    {currentInProgressStep ? "Complétez les informations ci-dessous puis validez." : "Démarrez cette étape pour commencer."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!currentInProgressStep ? (
                    <Button onClick={() => startStep.mutate(undefined)} disabled={startStep.isPending}>
                      {startStep.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Démarrer l'étape
                    </Button>
                  ) : (
                    <StepCompletionForm
                      step={currentInProgressStep}
                      executionId={executionDetail.execution.id}
                      onComplete={(structuredData, rejectionReason, notes) =>
                        completeStep.mutate({ stepId: currentInProgressStep.id, structuredData, rejectionReason, notes })
                      }
                      isPending={completeStep.isPending}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {executionDetail.execution.currentStep === "terminee" && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-6 flex items-center gap-2 text-green-700">
                  <PackageCheck className="w-5 h-5" />
                  Intervention terminée — le graphe de connaissance a été enrichi automatiquement à chaque étape.
                </CardContent>
              </Card>
            )}

            {/* Historique */}
            <Card>
              <CardHeader><CardTitle className="text-base">Historique des étapes</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {executionDetail.steps.map(step => (
                  <div key={step.id} className="flex items-center justify-between text-sm border-b border-gray-100 py-2 last:border-0">
                    <span className="font-medium">{STEP_META[step.stepType].label}</span>
                    <div className="flex items-center gap-2 text-gray-500">
                      {step.durationMinutes !== null && <span>{step.durationMinutes} min</span>}
                      <Badge className={STATUS_BADGE[step.status].className}>{STATUS_BADGE[step.status].label}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Formulaire de complétion, adapté au type d'étape ─────────────────────────
function StepCompletionForm({
  step, executionId, onComplete, isPending,
}: {
  step: InterventionStep;
  executionId: number;
  onComplete: (structuredData?: Record<string, unknown>, rejectionReason?: string, notes?: string) => void;
  isPending: boolean;
}) {
  const [notes, setNotes] = useState("");

  // Réception
  const [etatApparent, setEtatApparent] = useState("");
  // Inspection
  const [aucunDefautTrouve, setAucunDefautTrouve] = useState(false);
  // Réparation
  const [procedureUtilisee, setProcedureUtilisee] = useState("");
  // Contrôle qualité
  const [verdict, setVerdict] = useState<"pass" | "fail">("pass");
  const [rejectionReason, setRejectionReason] = useState("");
  // Livraison
  const [signatureClient, setSignatureClient] = useState("");
  // REX
  const [causeRacine, setCauseRacine] = useState("");
  const [lecons, setLecons] = useState("");

  const submit = () => {
    let structuredData: Record<string, unknown> | undefined;
    switch (step.stepType) {
      case "reception": structuredData = { etatApparent }; break;
      case "inspection": structuredData = { aucunDefautTrouve }; break;
      case "reparation": structuredData = { procedureUtilisee }; break;
      case "essais": structuredData = undefined; break; // mesures ajoutées séparément
      case "controle_qualite": structuredData = { verdict }; break;
      case "livraison": structuredData = { signatureClient }; break;
      case "rex": structuredData = { causeRacine, lecons }; break;
      default: structuredData = undefined;
    }
    onComplete(structuredData, step.stepType === "controle_qualite" && verdict === "fail" ? (rejectionReason || "Non conforme") : undefined, notes || undefined);
  };

  return (
    <div className="space-y-4">
      {step.stepType === "reception" && (
        <div>
          <Label>État apparent de l'équipement</Label>
          <Input value={etatApparent} onChange={e => setEtatApparent(e.target.value)} placeholder="Ex: correct, pièce manquante..." />
        </div>
      )}

      {step.stepType === "inspection" && (
        <div className="flex items-center gap-2">
          <input type="checkbox" id="aucunDefaut" checked={aucunDefautTrouve} onChange={e => setAucunDefautTrouve(e.target.checked)} />
          <Label htmlFor="aucunDefaut">Aucun défaut trouvé (passe directement à la livraison)</Label>
        </div>
      )}

      {step.stepType === "diagnostic" && (
        <p className="text-sm text-gray-500">
          {step.diagnosticSessionId
            ? `Rattaché à la session de diagnostic #${step.diagnosticSessionId}.`
            : "Aucune session de diagnostic rattachée — l'étape sera complétée sans enrichissement du graphe pour cette étape."}
        </p>
      )}

      {step.stepType === "reparation" && (
        <div>
          <Label>Procédure utilisée</Label>
          <Input value={procedureUtilisee} onChange={e => setProcedureUtilisee(e.target.value)} placeholder="Ex: Remplacement roulement SKF-6205" />
        </div>
      )}

      {step.stepType === "essais" && <EssaisMeasurements executionId={executionId} stepId={step.id} />}

      {step.stepType === "controle_qualite" && (
        <div className="space-y-2">
          <Label>Verdict</Label>
          <Select value={verdict} onValueChange={(v) => setVerdict(v as "pass" | "fail")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pass">Conforme</SelectItem>
              <SelectItem value="fail">Non conforme (retour en réparation)</SelectItem>
            </SelectContent>
          </Select>
          {verdict === "fail" && (
            <Input value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Motif de non-conformité" />
          )}
        </div>
      )}

      {step.stepType === "livraison" && (
        <div>
          <Label>Signature client / mode de livraison</Label>
          <Input value={signatureClient} onChange={e => setSignatureClient(e.target.value)} placeholder="Ex: J. Dupont — remise en main propre" />
        </div>
      )}

      {step.stepType === "rex" && (
        <div className="space-y-2">
          <div>
            <Label>Cause racine</Label>
            <Input value={causeRacine} onChange={e => setCauseRacine(e.target.value)} />
          </div>
          <div>
            <Label>Leçons capitalisées</Label>
            <Textarea value={lecons} onChange={e => setLecons(e.target.value)} placeholder="Ce qui alimentera le Knowledge Graph" />
          </div>
        </div>
      )}

      <AttachmentsUploader executionId={executionId} stepId={step.id} />

      <div>
        <Label>Notes libres</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <Button onClick={submit} disabled={isPending}>
        {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {step.stepType === "controle_qualite" && verdict === "fail" ? "Rejeter et renvoyer en réparation" : "Compléter l'étape"}
      </Button>
    </div>
  );
}

// ─── Sous-composant : pièces jointes (photos, vidéos, documents) ─────────────
interface Attachment {
  id: number;
  type: "photo" | "video" | "document";
  url: string;
  caption: string | null;
}

function AttachmentsUploader({ executionId, stepId }: { executionId: number; stepId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [caption, setCaption] = useState("");

  const { data: attachments } = useQuery<Attachment[]>({
    queryKey: ["/api/interventions", executionId, "steps", stepId, "attachments"],
    queryFn: () => apiRequest(`/api/interventions/${executionId}/steps/${stepId}/attachments`),
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      if (caption) formData.append("caption", caption);
      return uploadFile(`/api/interventions/${executionId}/steps/${stepId}/attachments`, formData);
    },
    onSuccess: () => {
      setCaption("");
      queryClient.invalidateQueries({ queryKey: ["/api/interventions", executionId, "steps", stepId, "attachments"] });
      toast({ title: "Pièce jointe ajoutée" });
    },
    onError: (e: any) => toast({ title: "Erreur d'upload", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-2">
      <Label>Photos / documents</Label>
      {(attachments ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments!.map(a => (
            <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block">
              {a.type === "photo" ? (
                <img src={a.url} alt={a.caption ?? ""} className="w-16 h-16 object-cover rounded border border-gray-200" />
              ) : (
                <div className="w-16 h-16 flex items-center justify-center rounded border border-gray-200 bg-gray-50">
                  <FileIcon className="w-6 h-6 text-gray-400" />
                </div>
              )}
            </a>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-center">
        <Input placeholder="Légende (optionnel)" value={caption} onChange={e => setCaption(e.target.value)} className="flex-1" />
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md cursor-pointer hover:bg-gray-50">
          {upload.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadIcon className="w-4 h-4" />}
          Ajouter un fichier
          <input
            type="file"
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx"
            disabled={upload.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

// ─── Sous-composant : mesures d'essais ─────────────────────────────────────────
function EssaisMeasurements({ executionId, stepId }: { executionId: number; stepId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [measurementType, setMeasurementType] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");

  const { data: measurements } = useQuery<Measurement[]>({
    queryKey: ["/api/interventions", executionId, "steps", stepId, "measurements"],
    queryFn: () => apiRequest(`/api/interventions/${executionId}/steps/${stepId}/measurements`),
  });

  const addMeasurement = useMutation({
    mutationFn: () => apiRequest(`/api/interventions/${executionId}/steps/${stepId}/measurements`, {
      method: "POST",
      body: { measurementType, value: parseFloat(value), unit: unit || undefined },
    }),
    onSuccess: () => {
      setMeasurementType(""); setValue(""); setUnit("");
      queryClient.invalidateQueries({ queryKey: ["/api/interventions", executionId, "steps", stepId, "measurements"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      {(measurements ?? []).length > 0 && (
        <div className="space-y-1">
          {measurements!.map(m => (
            <div key={m.id} className="text-sm flex items-center gap-2">
              <span className="font-medium">{m.measurementType}</span>
              <span>{m.value} {m.unit}</span>
              {m.withinTolerance !== null && (
                <Badge className={m.withinTolerance ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                  {m.withinTolerance ? "Conforme" : "Hors tolérance"}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input placeholder="Type (ex: vibration)" value={measurementType} onChange={e => setMeasurementType(e.target.value)} className="flex-1" />
        <Input placeholder="Valeur" value={value} onChange={e => setValue(e.target.value)} className="w-24" />
        <Input placeholder="Unité" value={unit} onChange={e => setUnit(e.target.value)} className="w-20" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addMeasurement.mutate()}
          disabled={!measurementType || !value || addMeasurement.isPending}
        >
          Ajouter
        </Button>
      </div>
    </div>
  );
}
