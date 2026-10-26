import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { auMoins } from "@shared/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppShell, EnTetePage, ActionPrincipale, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import type { RegistreEtat } from "@/lib/etats";
import {
  ClipboardList, Plus, X, Loader2, Check, Ban, Search, AlertCircle, Bell,
} from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════════
 * DEMANDES D'INTERVENTION — l'exploitant signale, la maintenance arbitre
 * ═══════════════════════════════════════════════════════════════════
 *
 * CE QUI MANQUAIT
 * ───────────────────────────────────────────────────────────────────
 * Aucune table ne portait la demande d'intervention (audit du 2026-10-25,
 * section 1). Trois conséquences, que cet écran referme :
 *
 *   1. n'importe qui devait créer directement un ordre de travail, c'est-à-dire
 *      engager la planification et le budget ;
 *   2. le refus motivé n'existait pas, donc la charge non traitée n'était pas
 *      mesurable ;
 *   3. le dispositif de validation a dû être greffé après coup sur l'OT.
 *
 * LES DEUX ÉCHELLES, ET POURQUOI L'ÉCRAN LES MONTRE SÉPARÉMENT
 * ───────────────────────────────────────────────────────────────────
 * L'urgence affichée sur une demande est celle PERÇUE PAR LE DEMANDEUR. La
 * priorité de l'ordre de travail est DÉCIDÉE à l'arbitrage, et le formulaire
 * d'acceptation la demande explicitement au lieu de reprendre l'urgence. Les
 * confondre rendrait la séparation DI / OT décorative : celui qui signale
 * fixerait la priorité d'un travail qu'il ne planifie pas.
 *
 * LA CHARGE ÉCARTÉE EST AFFICHÉE
 * ───────────────────────────────────────────────────────────────────
 * Le compteur « refusées » est là pour une raison précise : c'est la mesure
 * que l'absence de table rendait impossible. Un refus sans trace est
 * indistinguable d'un oubli.
 */

// ─── Types : les champs réellement servis par /api/demandes-intervention ─────
interface Demande {
  id: number;
  requestNumber: string;
  equipmentId: number | null;
  equipmentName: string | null;
  alertId: number | null;
  title: string;
  description: string;
  urgency: string;
  status: string;
  requestedBy: number | null;
  reportedLocation: string | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  reviewNotes: string | null;
  workOrderId: number | null;
  workOrderNumber: string | null;
  createdAt: string;
}
interface Charge { pending: number; accepted: number; rejected: number; cancelled: number }
interface ReponseListe { demandes: Demande[]; charge: Charge }
interface OptionEquipement { id: number; equipmentName: string; equipmentId?: string }
interface OptionUtilisateur { id: number; firstName: string | null; lastName: string | null; username: string }
interface AlerteActive {
  id: number; title: string; message: string; severity: string | null;
  status: string | null; alertType: string; equipmentId: number | null;
}

const URGENCES = [
  { id: "low", libelle: "Faible — peut attendre" },
  { id: "medium", libelle: "Moyenne" },
  { id: "high", libelle: "Haute — gêne la production" },
  { id: "urgent", libelle: "Immédiate — arrêt ou danger" },
] as const;

const TYPES_ORDRE = [
  { id: "corrective", libelle: "Maintenance corrective" },
  { id: "preventive", libelle: "Maintenance préventive" },
  { id: "emergency", libelle: "Urgence" },
  { id: "inspection", libelle: "Inspection" },
  { id: "calibration", libelle: "Étalonnage" },
  { id: "modification", libelle: "Modification" },
  { id: "installation", libelle: "Installation" },
] as const;

const PRIORITES = [
  { id: "low", libelle: "Faible" },
  { id: "medium", libelle: "Moyenne" },
  { id: "high", libelle: "Haute" },
  { id: "urgent", libelle: "Critique" },
] as const;

const CLASSE_CHAMP =
  "w-full h-10 px-3 border border-rule bg-white text-sm text-ink focus:outline-none " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal";

const libelleUrgence = (u: string) => URGENCES.find((x) => x.id === u)?.libelle.split(" —")[0] ?? u;

/** Registre d'état d'une demande. L'urgence n'y entre PAS : c'est l'état qui compte. */
function registreEtat(status: string): RegistreEtat {
  switch (status) {
    case "pending": return "alerte";
    case "accepted": return "nominal";
    case "rejected": return "critique";
    default: return "neutre";
  }
}
const libelleEtat = (status: string) => ({
  pending: "En attente d'arbitrage",
  accepted: "Acceptée",
  rejected: "Refusée",
  cancelled: "Annulée",
}[status] ?? status);

/** L'urgence perçue, en registre — distinct de l'état de la demande. */
function registreUrgence(u: string): RegistreEtat {
  switch (u) {
    case "urgent": return "critique";
    case "high": return "alerte";
    case "low": return "neutre";
    default: return "encours";
  }
}

const jourHeure = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

// ═══════════════════════════════════════════════════════════════════
export default function DemandesInterventionPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<"tous" | "pending" | "accepted" | "rejected" | "cancelled">("pending");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [demandeArbitree, setDemandeArbitree] = useState<Demande | null>(null);
  const [demandeRefusee, setDemandeRefusee] = useState<Demande | null>(null);
  const [motifRefus, setMotifRefus] = useState("");
  const [sourceAlerte, setSourceAlerte] = useState<AlerteActive | null>(null);

  /**
   * Les droits reproduisent ceux du serveur, par le référentiel de rôles et
   * non par comparaison de chaînes : `owner` est au-dessus d'`admin` et serait
   * refusé par une égalité littérale.
   *
   * SIGNALER n'a aucun garde : c'est le point de toute cette séparation. Un
   * opérateur qui voit une fuite doit pouvoir la signaler sans habilitation.
   */
  const peutArbitrer = auMoins(user?.role, "team_leader");

  const { data, isLoading, error } = useQuery<ReponseListe>({
    queryKey: ["/api/demandes-intervention"],
  });
  const demandes = data?.demandes ?? [];
  const charge = data?.charge ?? { pending: 0, accepted: 0, rejected: 0, cancelled: 0 };

  const { data: equipements = [] } = useQuery<OptionEquipement[]>({ queryKey: ["/api/equipment"] });
  const { data: utilisateurs = [] } = useQuery<OptionUtilisateur[]>({ queryKey: ["/api/user-profiles"] });
  const { data: alertes = [] } = useQuery<AlerteActive[]>({ queryKey: ["/api/alerts"] });

  const alertesActives = alertes.filter((a) => a.status === "active");

  const nomUtilisateur = (id: number | null) => {
    if (!id) return "—";
    const u = utilisateurs.find((u) => u.id === id);
    if (!u) return `Utilisateur #${id}`;
    return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username;
  };

  const rafraichir = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/demandes-intervention"] });
    // Une acceptation crée un ordre de travail : l'écran des OT doit le voir.
    queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
  };

  const [form, setForm] = useState({
    title: "", description: "", urgency: "medium", equipmentId: "", reportedLocation: "",
  });
  const [decision, setDecision] = useState({
    orderType: "corrective", priority: "medium", requiresShutdown: false,
    assignedTo: "", estimatedHours: "", reviewNotes: "",
  });

  function fermerFormulaire() {
    setFormulaireOuvert(false);
    setSourceAlerte(null);
    setForm({ title: "", description: "", urgency: "medium", equipmentId: "", reportedLocation: "" });
  }

  const signaler = useMutation({
    mutationFn: () =>
      apiRequest("/api/demandes-intervention", {
        method: "POST",
        body: {
          title: form.title.trim(),
          description: form.description.trim(),
          urgency: form.urgency,
          ...(form.equipmentId ? { equipmentId: Number(form.equipmentId) } : {}),
          ...(form.reportedLocation.trim() ? { reportedLocation: form.reportedLocation.trim() } : {}),
        },
      }),
    onSuccess: (d: Demande) => {
      rafraichir();
      toast({
        title: "Demande enregistrée",
        description: `${d.requestNumber} — la maintenance l'arbitrera.`,
      });
      fermerFormulaire();
    },
    onError: (e: Error) => toast({ title: "Demande refusée", description: e.message, variant: "destructive" }),
  });

  const signalerAlerte = useMutation({
    mutationFn: (alertId: number) =>
      apiRequest(`/api/alerts/${alertId}/demande-intervention`, { method: "POST" }),
    onSuccess: (d: Demande) => {
      rafraichir();
      toast({
        title: "Alerte signalée",
        description: `${d.requestNumber} — la maintenance l'arbitrera.`,
      });
      setSourceAlerte(null);
      setFormulaireOuvert(false);
    },
    onError: (e: Error) => {
      // Le 409 « déjà signalée » n'est pas une erreur de l'utilisateur : c'est
      // une information. On ne le présente pas comme un échec rouge.
      const dejaSignalee = /ALERTE_DEJA_SIGNALEE|déjà fait l'objet/.test(e.message);
      toast({
        title: dejaSignalee ? "Alerte déjà signalée" : "Signalement refusé",
        description: e.message,
        variant: dejaSignalee ? undefined : "destructive",
      });
      if (dejaSignalee) { rafraichir(); setSourceAlerte(null); setFormulaireOuvert(false); }
    },
  });

  const accepter = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/demandes-intervention/${id}/accepter`, {
        method: "POST",
        body: {
          orderType: decision.orderType,
          priority: decision.priority,
          requiresShutdown: decision.requiresShutdown,
          ...(decision.assignedTo ? { assignedTo: Number(decision.assignedTo) } : {}),
          ...(decision.estimatedHours ? { estimatedHours: Number(decision.estimatedHours) } : {}),
          ...(decision.reviewNotes.trim() ? { reviewNotes: decision.reviewNotes.trim() } : {}),
        },
      }),
    onSuccess: (r: { demande: Demande; ordre: { orderNumber: string } }) => {
      rafraichir();
      toast({
        title: "Demande acceptée",
        description: `Ordre de travail ${r.ordre.orderNumber} créé.`,
      });
      setDemandeArbitree(null);
      setDecision({ orderType: "corrective", priority: "medium", requiresShutdown: false, assignedTo: "", estimatedHours: "", reviewNotes: "" });
    },
    onError: (e: Error) => toast({ title: "Acceptation refusée", description: e.message, variant: "destructive" }),
  });

  const refuser = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/demandes-intervention/${id}/refuser`, {
        method: "POST",
        body: { rejectionReason: motifRefus.trim() },
      }),
    onSuccess: () => {
      rafraichir();
      toast({ title: "Demande refusée", description: "Le motif est enregistré." });
      setDemandeRefusee(null);
      setMotifRefus("");
    },
    onError: (e: Error) => toast({ title: "Refus impossible", description: e.message, variant: "destructive" }),
  });

  const annuler = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/demandes-intervention/${id}/annuler`, { method: "POST" }),
    onSuccess: () => { rafraichir(); toast({ title: "Demande annulée" }); },
    onError: (e: Error) => toast({ title: "Annulation refusée", description: e.message, variant: "destructive" }),
  });

  function soumettreSignalement() {
    if (!form.title.trim() || !form.description.trim()) {
      toast({
        title: "Champs obligatoires",
        description: "Un titre et une description de ce que vous avez constaté sont requis.",
        variant: "destructive",
      });
      return;
    }
    signaler.mutate();
  }

  const filtrees = demandes.filter((d) => {
    const terme = recherche.toLowerCase();
    const correspond =
      d.title.toLowerCase().includes(terme) ||
      d.requestNumber.toLowerCase().includes(terme) ||
      d.description.toLowerCase().includes(terme) ||
      (d.equipmentName ?? "").toLowerCase().includes(terme) ||
      (d.reportedLocation ?? "").toLowerCase().includes(terme);
    if (!correspond) return false;
    return filtre === "tous" || d.status === filtre;
  });

  return (
    <AppShell filAriane={[{ libelle: "GMAO", href: "/gmao" }, { libelle: "Demandes d'intervention" }]} largeur="large">
      <div className="space-y-6">
        <EnTetePage
          surTitre="GMAO"
          titre="Demandes d'intervention"
          phrase="Ce que l'exploitation signale, et ce que la maintenance en décide. Une demande acceptée devient un ordre de travail ; une demande refusée garde son motif."
          action={
            <ActionPrincipale onClick={() => { fermerFormulaire(); setFormulaireOuvert(true); }}>
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" />Signaler
            </ActionPrincipale>
          }
        />

        <RangeeIndicateurs>
          <Indicateur
            libelle="En attente"
            valeur={String(charge.pending)}
            precision={charge.pending === 0 ? "rien à arbitrer" : "à arbitrer par la maintenance"}
            alerte={charge.pending > 0}
            icone={ClipboardList}
          />
          <Indicateur
            libelle="Acceptées"
            valeur={String(charge.accepted)}
            precision={charge.accepted === 0 ? "aucune conversion" : "converties en ordre de travail"}
          />
          <Indicateur
            libelle="Refusées"
            valeur={String(charge.rejected)}
            // C'est LA mesure que l'absence de table rendait impossible : la
            // charge écartée, et le motif de chaque refus.
            precision={charge.rejected === 0 ? "aucun refus" : "charge écartée, avec motif"}
          />
          <Indicateur
            libelle="Annulées"
            valeur={String(charge.cancelled)}
            precision={charge.cancelled === 0 ? "aucune annulation" : "retirées par leur auteur"}
          />
        </RangeeIndicateurs>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[16rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-mute" aria-hidden="true" />
            <Input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher par numéro, titre, équipement ou lieu..."
              aria-label="Rechercher une demande"
              className="pl-9 border-rule"
            />
          </div>
          <select
            value={filtre}
            onChange={(e) => setFiltre(e.target.value as typeof filtre)}
            aria-label="Filtrer les demandes"
            className={CLASSE_CHAMP + " sm:w-64"}
          >
            <option value="pending">En attente d'arbitrage</option>
            <option value="accepted">Acceptées</option>
            <option value="rejected">Refusées</option>
            <option value="cancelled">Annulées</option>
            <option value="tous">Toutes</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-ink-mute" aria-hidden="true" /></div>
        ) : error ? (
          <div className="border border-etat-critique-filet bg-etat-critique-fond p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-etat-critique-texte shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-etat-critique-texte">
              Les demandes n'ont pas pu être chargées. {(error as Error).message}
            </p>
          </div>
        ) : filtrees.length === 0 ? (
          <EtatVide
            icone={ClipboardList}
            titre={demandes.length === 0 ? "Aucune demande d'intervention" : "Aucune demande ne correspond"}
            phrase={
              demandes.length === 0
                ? "Une demande d'intervention est un signalement : l'exploitation décrit ce qu'elle a constaté, la maintenance arbitre et la convertit en ordre de travail — ou la refuse en motivant. Signaler n'engage ni planification ni budget."
                : "Modifiez la recherche ou le filtre."
            }
            action={
              demandes.length === 0 ? (
                <ActionPrincipale onClick={() => { fermerFormulaire(); setFormulaireOuvert(true); }}>
                  <Plus className="h-4 w-4 mr-2" aria-hidden="true" />Signaler une intervention
                </ActionPrincipale>
              ) : undefined
            }
          />
        ) : (
          <div className="border border-rule bg-white divide-y divide-rule">
            {filtrees.map((d) => (
              <div key={d.id} className="p-4 flex flex-wrap gap-4 items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-ink-mute">{d.requestNumber}</span>
                    <PuceEtat registre={registreEtat(d.status)}>{libelleEtat(d.status)}</PuceEtat>
                    {/* L'urgence est PERÇUE : le libellé le dit, pour qu'on ne
                        la confonde pas avec la priorité décidée de l'ordre. */}
                    <PuceEtat registre={registreUrgence(d.urgency)}>
                      Urgence perçue : {libelleUrgence(d.urgency)}
                    </PuceEtat>
                    {d.alertId && (
                      <span className="inline-flex items-center gap-1 text-xs text-ink-mute">
                        <Bell className="h-3 w-3" aria-hidden="true" />née d'une alerte
                      </span>
                    )}
                  </div>

                  <p className="text-ink font-medium mt-1">{d.title}</p>
                  <p className="text-sm text-ink-soft mt-1 whitespace-pre-line">{d.description}</p>
                  <p className="text-xs text-ink-mute mt-2">
                    {d.equipmentName ?? (d.reportedLocation ? `Lieu signalé : ${d.reportedLocation}` : "Équipement non précisé")}
                    {" · "}signalée par {nomUtilisateur(d.requestedBy)} le {jourHeure(d.createdAt)}
                  </p>

                  {/* L'issue de l'arbitrage, et sa justification. */}
                  {d.status === "accepted" && d.workOrderNumber && (
                    <p className="text-sm mt-2">
                      <Link href="/work-orders" className="text-signal underline underline-offset-2 hover:text-ink">
                        Ordre de travail {d.workOrderNumber}
                      </Link>
                      <span className="text-ink-mute">
                        {" "}— arbitrée par {nomUtilisateur(d.reviewedBy)} le {jourHeure(d.reviewedAt)}.
                      </span>
                    </p>
                  )}
                  {d.status === "rejected" && (
                    <div className="border border-etat-critique-filet bg-etat-critique-fond p-3 mt-2">
                      <p className="text-sm text-etat-critique-texte">
                        <strong>Refusée</strong> par {nomUtilisateur(d.reviewedBy)} le {jourHeure(d.reviewedAt)} :
                        {" "}{d.rejectionReason}
                      </p>
                    </div>
                  )}
                  {d.reviewNotes && d.status === "accepted" && (
                    <p className="text-sm text-ink-soft mt-1">Note d'arbitrage : {d.reviewNotes}</p>
                  )}
                </div>

                {d.status === "pending" && (
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {peutArbitrer && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setDemandeArbitree(d)}
                          className="bg-ink text-paper hover:bg-signal"
                        >
                          <Check className="h-3 w-3 mr-1" aria-hidden="true" />Accepter
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDemandeRefusee(d)}>
                          <Ban className="h-3 w-3 mr-1" aria-hidden="true" />Refuser
                        </Button>
                      </>
                    )}
                    {/* L'auteur peut retirer sa propre demande ; le serveur
                        revérifie, l'affichage n'est pas le contrôle. */}
                    {(d.requestedBy === user?.id || peutArbitrer) && (
                      <Button size="sm" variant="outline" onClick={() => annuler.mutate(d.id)} disabled={annuler.isPending}>
                        <X className="h-3 w-3 mr-1" aria-hidden="true" />Annuler
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Signaler ──────────────────────────────────────────────────── */}
      {formulaireOuvert && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="titre-signalement">
          <div className="bg-white border border-rule w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-2 gap-4">
              <h2 id="titre-signalement" className="font-serif text-page text-ink">Signaler une intervention</h2>
              <Button variant="ghost" size="sm" onClick={fermerFormulaire} aria-label="Fermer">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <p className="text-sm text-ink-soft mb-5">
              Décrivez ce que vous avez constaté. La maintenance arbitrera : signaler n'engage ni
              planification ni budget, et l'urgence que vous indiquez reste une information — la
              priorité du travail est décidée à l'arbitrage.
            </p>

            {/* ─── À partir d'une alerte ───────────────────────────────
                C'est la boucle « alerte → OT » de l'audit, et elle passe
                par l'arbitrage. L'alerte fournit le titre, le message et
                l'équipement : le signalement ne se ressaisit pas. */}
            {alertesActives.length > 0 && (
              <div className="border border-rule bg-paper p-3 mb-5">
                <Label htmlFor="di-alerte" className="text-sm">
                  <Bell className="h-4 w-4 inline mr-1 -mt-0.5" aria-hidden="true" />
                  Signaler une alerte active
                </Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  <select
                    id="di-alerte"
                    value={sourceAlerte?.id ?? ""}
                    onChange={(e) => setSourceAlerte(alertesActives.find((a) => String(a.id) === e.target.value) ?? null)}
                    className={CLASSE_CHAMP + " flex-1 min-w-[14rem]"}
                  >
                    <option value="">Choisir une alerte…</option>
                    {alertesActives.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}{a.severity ? ` (${a.severity})` : ""}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={() => sourceAlerte && signalerAlerte.mutate(sourceAlerte.id)}
                    disabled={!sourceAlerte || signalerAlerte.isPending}
                    className="bg-ink text-white hover:bg-signal shrink-0"
                  >
                    {signalerAlerte.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                    Signaler cette alerte
                  </Button>
                </div>
                <p className="text-xs text-ink-mute mt-2">
                  Le titre, le message et l'équipement de l'alerte sont reportés automatiquement.
                  Une alerte déjà signalée ne produit pas de doublon.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="di-titre">Que constatez-vous ? *</Label>
                <Input
                  id="di-titre"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex : fuite d'huile sous la presse 2"
                  className="border-rule"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="di-description">Description *</Label>
                <Textarea
                  id="di-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ce que vous voyez, entendez ou mesurez, depuis quand, et ce que cela empêche."
                  rows={4}
                  className="border-rule"
                />
              </div>

              <div>
                <Label htmlFor="di-equipement">Équipement</Label>
                <select
                  id="di-equipement"
                  value={form.equipmentId}
                  onChange={(e) => setForm({ ...form, equipmentId: e.target.value })}
                  className={CLASSE_CHAMP}
                  aria-describedby="di-equipement-aide"
                >
                  <option value="">Je ne sais pas / pas dans la liste</option>
                  {equipements.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.equipmentName}{e.equipmentId ? ` (${e.equipmentId})` : ""}
                    </option>
                  ))}
                </select>
                <p id="di-equipement-aide" className="text-xs text-ink-mute mt-1">
                  Facultatif : précisez le lieu si la machine n'est pas identifiée.
                </p>
              </div>

              <div>
                <Label htmlFor="di-lieu">Lieu signalé</Label>
                <Input
                  id="di-lieu"
                  value={form.reportedLocation}
                  onChange={(e) => setForm({ ...form, reportedLocation: e.target.value })}
                  placeholder="Ex : atelier B, près du convoyeur"
                  className="border-rule"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="di-urgence">Urgence telle que vous la percevez</Label>
                <select
                  id="di-urgence"
                  value={form.urgency}
                  onChange={(e) => setForm({ ...form, urgency: e.target.value })}
                  className={CLASSE_CHAMP}
                  aria-describedby="di-urgence-aide"
                >
                  {URGENCES.map((u) => (
                    <option key={u.id} value={u.id}>{u.libelle}</option>
                  ))}
                </select>
                <p id="di-urgence-aide" className="text-xs text-ink-mute mt-1">
                  C'est une information pour la maintenance, pas la priorité du travail : celle-ci
                  est décidée à l'arbitrage.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={fermerFormulaire}>Annuler</Button>
              <Button onClick={soumettreSignalement} disabled={signaler.isPending} className="bg-ink text-white hover:bg-signal">
                {signaler.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                Envoyer la demande
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Arbitrer : accepter ───────────────────────────────────────── */}
      {demandeArbitree && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="titre-arbitrage">
          <div className="bg-white border border-rule w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4 gap-4">
              <div className="min-w-0">
                <p className="font-mono text-sm text-ink-mute">{demandeArbitree.requestNumber}</p>
                <h2 id="titre-arbitrage" className="font-serif text-page text-ink mt-1">
                  Accepter et convertir en ordre de travail
                </h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDemandeArbitree(null)} aria-label="Fermer">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="border border-rule bg-paper p-3 mb-5 text-sm">
              <p className="text-ink font-medium">{demandeArbitree.title}</p>
              <p className="text-ink-soft mt-1 whitespace-pre-line">{demandeArbitree.description}</p>
              <p className="text-ink-mute mt-2 text-xs">
                {demandeArbitree.equipmentName ?? (demandeArbitree.reportedLocation ? `Lieu : ${demandeArbitree.reportedLocation}` : "Équipement non précisé")}
                {" · "}urgence perçue par le demandeur : <strong>{libelleUrgence(demandeArbitree.urgency)}</strong>
              </p>
            </div>

            {/* La priorité est DEMANDÉE, pas reprise de l'urgence : c'est
                l'arbitrage, et c'est toute la raison d'être de la séparation
                DI / OT. Reprendre l'urgence rendrait la séparation
                décorative. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="arb-type">Type d'ordre</Label>
                <select id="arb-type" value={decision.orderType}
                  onChange={(e) => setDecision({ ...decision, orderType: e.target.value })}
                  className={CLASSE_CHAMP}>
                  {TYPES_ORDRE.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="arb-priorite">Priorité décidée</Label>
                <select id="arb-priorite" value={decision.priority}
                  onChange={(e) => setDecision({ ...decision, priority: e.target.value })}
                  className={CLASSE_CHAMP} aria-describedby="arb-priorite-aide">
                  {PRIORITES.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
                </select>
                <p id="arb-priorite-aide" className="text-xs text-ink-mute mt-1">
                  C'est la maintenance qui la fixe, pas le demandeur.
                </p>
              </div>
              <div>
                <Label htmlFor="arb-assigne">Assigné à</Label>
                <select id="arb-assigne" value={decision.assignedTo}
                  onChange={(e) => setDecision({ ...decision, assignedTo: e.target.value })}
                  className={CLASSE_CHAMP}>
                  <option value="">Non assigné</option>
                  {utilisateurs.map((u) => (
                    <option key={u.id} value={u.id}>
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="arb-heures">Heures estimées</Label>
                <Input id="arb-heures" type="number" step="0.5" min="0"
                  value={decision.estimatedHours}
                  onChange={(e) => setDecision({ ...decision, estimatedHours: e.target.value })}
                  placeholder="Ex : 4" className="border-rule" />
              </div>

              <div className="md:col-span-2 border border-rule bg-paper p-3">
                <label htmlFor="arb-arret" className="flex items-start gap-3 cursor-pointer">
                  <input id="arb-arret" type="checkbox" checked={decision.requiresShutdown}
                    onChange={(e) => setDecision({ ...decision, requiresShutdown: e.target.checked })}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-signal" />
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-ink">Intervention avec arrêt machine</span>
                    <span className="block text-xs text-ink-mute mt-1">
                      L'équipement passera « en maintenance » au démarrage, et ne reviendra en service
                      à la clôture que s'il ne reste aucun autre arrêt ouvert sur lui.
                    </span>
                  </span>
                </label>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="arb-note">Note d'arbitrage</Label>
                <Textarea id="arb-note" value={decision.reviewNotes}
                  onChange={(e) => setDecision({ ...decision, reviewNotes: e.target.value })}
                  placeholder="Ce que vous avez retenu du signalement, ou ce qui reste à vérifier."
                  rows={2} className="border-rule" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setDemandeArbitree(null)}>Annuler</Button>
              <Button onClick={() => accepter.mutate(demandeArbitree.id)} disabled={accepter.isPending}
                className="bg-ink text-white hover:bg-signal">
                {accepter.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                Créer l'ordre de travail
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Arbitrer : refuser ────────────────────────────────────────── */}
      {demandeRefusee && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="titre-refus">
          <div className="bg-white border border-rule w-full max-w-lg p-6">
            <p className="font-mono text-sm text-ink-mute">{demandeRefusee.requestNumber}</p>
            <h2 id="titre-refus" className="font-serif text-page text-ink mt-1">Refuser la demande</h2>
            <p className="text-sm text-ink-soft mt-2">
              « {demandeRefusee.title} » — signalée par {nomUtilisateur(demandeRefusee.requestedBy)}.
            </p>
            <div className="mt-4">
              {/* Le motif est OBLIGATOIRE, et c'est le défaut n° 2 de l'audit
                  qu'on referme : sans lui, un refus est indistinguable d'un
                  oubli, et la charge écartée n'est pas analysable. */}
              <Label htmlFor="refus-motif">Motif du refus *</Label>
              <Textarea
                id="refus-motif"
                value={motifRefus}
                onChange={(e) => setMotifRefus(e.target.value)}
                placeholder="Ex : constat relève du réglage de production, pas de la maintenance ; doublon de DI-…"
                rows={3}
                className="border-rule"
                aria-describedby="refus-aide"
              />
              <p id="refus-aide" className="text-xs text-ink-mute mt-1">
                Le motif est conservé et comptabilisé : c'est ce qui rend la charge écartée
                analysable. Il est rendu au demandeur.
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => { setDemandeRefusee(null); setMotifRefus(""); }}>Annuler</Button>
              <Button
                onClick={() => refuser.mutate(demandeRefusee.id)}
                disabled={motifRefus.trim().length < 5 || refuser.isPending}
                className="bg-etat-critique-vif text-white hover:bg-etat-critique-texte"
              >
                {refuser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                Refuser avec ce motif
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
