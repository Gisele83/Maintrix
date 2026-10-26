/**
 * Réglage des seuils d'alarme d'une machine.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CET ÉCRAN EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * La supervision compare chaque capteur à son propre historique et signale ce
 * qui CHANGE. C'est robuste, cela ne demande aucun paramétrage, et cela a
 * remplacé quatre constantes universelles qui rendaient toute usine réelle
 * « critique » en permanence.
 *
 * Mais cette méthode ne voit pas ce qui est mauvais DEPUIS TOUJOURS : une
 * machine qui tourne à 95 °C depuis son installation a 95 °C pour référence, et
 * aucun écart n'apparaît. Seul un seuil posé par quelqu'un qui connaît la
 * machine répond à cette question-là.
 *
 * Les deux coexistent donc, et l'écran dit toujours laquelle a décidé.
 *
 * ⚠️ Ce formulaire ne propose AUCUNE valeur par défaut. Un seuil suggéré par
 * la plateforme serait exactement la faute qu'on vient de corriger, avec une
 * légitimité en plus puisqu'il apparaîtrait comme « configuré ». La valeur
 * doit venir de la documentation du constructeur, d'une norme, ou de
 * l'expérience de l'équipe — pas d'un programme qui ne connaît pas la machine.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";

interface SeuilEnregistre {
  id: number;
  equipmentId: number | null;
  metricType: string;
  warningLevel: number;
  criticalLevel: number;
  sens: "au-dessus" | "au-dessous";
  unit: string;
}

const GRANDEURS: Array<{ id: string; libelle: string; sensUsuel: "au-dessus" | "au-dessous" }> = [
  { id: "temperature", libelle: "Température", sensUsuel: "au-dessus" },
  { id: "vibration", libelle: "Vibration", sensUsuel: "au-dessus" },
  // La panne d'un circuit hydraulique est la CHUTE de pression : le sens usuel
  // de ces trois grandeurs est donc « au-dessous ». Le proposer évite l'erreur
  // la plus coûteuse de cet écran, sans l'imposer.
  { id: "pressure", libelle: "Pression", sensUsuel: "au-dessous" },
  { id: "flow", libelle: "Débit", sensUsuel: "au-dessous" },
  { id: "speed", libelle: "Vitesse", sensUsuel: "au-dessous" },
  { id: "current", libelle: "Courant", sensUsuel: "au-dessus" },
  { id: "voltage", libelle: "Tension", sensUsuel: "au-dessus" },
  { id: "humidity", libelle: "Humidité", sensUsuel: "au-dessus" },
];

export function ReglageSeuils({
  equipementId,
  equipementNom,
  ouvert,
  onFermer,
}: {
  equipementId: number | null;
  equipementNom: string;
  ouvert: boolean;
  onFermer: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [grandeur, setGrandeur] = useState<string>("temperature");
  const [sens, setSens] = useState<"au-dessus" | "au-dessous">("au-dessus");
  const [alerte, setAlerte] = useState("");
  const [critique, setCritique] = useState("");
  const [unite, setUnite] = useState("");

  const { data: seuils = [] } = useQuery<SeuilEnregistre[]>({
    queryKey: ["/api/sensor-thresholds"],
    enabled: ouvert,
  });

  const seuilsDeCetEquipement = seuils.filter((s) => s.equipmentId === equipementId);
  const seuilsParDefaut = seuils.filter((s) => s.equipmentId === null);

  const invalider = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/sensor-thresholds"] });
    // L'écran de santé recalcule ses états à partir des seuils : sans cette
    // seconde invalidation, le réglage ne se verrait qu'au prochain
    // rechargement de la page.
    queryClient.invalidateQueries({ queryKey: ["/api/equipment/health"], exact: false });
  };

  const enregistrer = useMutation({
    mutationFn: async () => apiRequest("/api/sensor-thresholds", {
      method: "PUT",
      body: {
        equipmentId: equipementId,
        metricType: grandeur,
        warningLevel: Number(alerte),
        criticalLevel: Number(critique),
        sens,
        unit: unite,
      },
    }),
    onSuccess: () => {
      invalider();
      setAlerte("");
      setCritique("");
      toast({ title: "Seuil enregistré", description: `${equipementNom} — ${grandeur}` });
    },
    onError: (e: any) => {
      // Le message du serveur est affiché TEL QUEL : il explique précisément
      // l'incohérence (critique du mauvais côté, niveaux identiques…), ce
      // qu'un « échec de l'enregistrement » générique ne ferait pas.
      toast({
        title: "Seuil refusé",
        description: e?.message ?? "Enregistrement impossible.",
        variant: "destructive",
      });
    },
  });

  const retirer = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/sensor-thresholds/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalider();
      toast({
        title: "Seuil retiré",
        description: "Cette grandeur repasse à la détection statistique.",
      });
    },
  });

  const choisirGrandeur = (valeur: string) => {
    setGrandeur(valeur);
    const connue = GRANDEURS.find((g) => g.id === valeur);
    if (connue) setSens(connue.sensUsuel);
  };

  return (
    <Dialog open={ouvert} onOpenChange={(o) => !o && onFermer()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Seuils d'alarme — {equipementNom}</DialogTitle>
          <DialogDescription>
            Une grandeur sans seuil réglé reste surveillée par comparaison à son propre
            historique. Un seuil ajoute ce que cette comparaison ne peut pas voir : une
            valeur dangereuse mais stable depuis toujours.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Grandeur</Label>
              <Select value={grandeur} onValueChange={choisirGrandeur}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRANDEURS.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sens du franchissement</Label>
              <Select value={sens} onValueChange={(v) => setSens(v as typeof sens)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="au-dessus">Au-dessus — c'est la montée qui alarme</SelectItem>
                  <SelectItem value="au-dessous">Au-dessous — c'est la chute qui alarme</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Niveau d'alerte</Label>
              <Input
                type="number"
                step="any"
                value={alerte}
                onChange={(e) => setAlerte(e.target.value)}
                placeholder="—"
              />
            </div>

            <div className="space-y-2">
              <Label>Niveau critique</Label>
              <Input
                type="number"
                step="any"
                value={critique}
                onChange={(e) => setCritique(e.target.value)}
                placeholder="—"
              />
            </div>

            <div className="space-y-2">
              <Label>Unité</Label>
              <Input
                value={unite}
                onChange={(e) => setUnite(e.target.value)}
                placeholder="°C, bar, mm/s, A…"
              />
            </div>
          </div>

          <p className="text-sm text-ink-soft">
            {sens === "au-dessous"
              ? "Le niveau critique doit être INFÉRIEUR au niveau d'alerte : la pression chute d'abord sous l'alerte, puis sous le critique."
              : "Le niveau critique doit être SUPÉRIEUR au niveau d'alerte."}
          </p>

          <Button
            onClick={() => enregistrer.mutate()}
            disabled={enregistrer.isPending || alerte === "" || critique === "" || unite.trim() === ""}
          >
            {enregistrer.isPending ? "Enregistrement…" : "Enregistrer ce seuil"}
          </Button>

          <div className="space-y-3 border-t border-rule pt-4">
            <h4 className="font-medium text-ink">Seuils réglés pour cette machine</h4>
            {seuilsDeCetEquipement.length === 0 ? (
              <p className="text-sm text-ink-mute">
                Aucun. Toutes les grandeurs de cette machine sont évaluées par comparaison
                à leur propre historique.
              </p>
            ) : (
              seuilsDeCetEquipement.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 border border-rule rounded-lg">
                  <div className="text-sm">
                    <span className="font-medium capitalize text-ink">{s.metricType}</span>
                    <span className="text-ink-soft">
                      {" "}— alerte {s.warningLevel} {s.unit}, critique {s.criticalLevel} {s.unit}
                      {s.sens === "au-dessous" ? " (chute)" : ""}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => retirer.mutate(s.id)}
                    disabled={retirer.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}

            {seuilsParDefaut.length > 0 && (
              <p className="text-sm text-ink-mute">
                {seuilsParDefaut.length} seuil{seuilsParDefaut.length > 1 ? "s" : ""} par défaut
                de l'organisation s'applique{seuilsParDefaut.length > 1 ? "nt" : ""} aux grandeurs
                non réglées ici.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
