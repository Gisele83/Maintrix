import React, { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { auMoins } from "@shared/roles";
import { EnTetePage, ActionPrincipale, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import {
  ETAT,
  STATUTS_OT,
  PRIORITES_OT,
  definitionStatutOT,
  definitionPrioriteOT,
  libelleStatutOT,
  libellePrioriteOT,
  statutCanoniqueOT,
  prioriteCanoniqueOT,
  type RegistreEtat,
} from "@/lib/etats";
import {
  Wrench, Clock, CheckCircle, AlertCircle, Plus, Search, Calendar, User, MapPin,
  FileText, X, Edit, Eye, Play, Pause, CheckSquare, ClipboardList, GraduationCap,
  Loader2, Trash2, UserCheck,
} from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════════
 * ORDRES DE TRAVAIL — une seule implémentation
 * ═══════════════════════════════════════════════════════════════════
 *
 * Il existait DEUX écrans d'ordres de travail, aux capacités différentes
 * et aux contrats de champs différents :
 *
 *   • la page /work-orders (638 lignes) — filtre par priorité, tuiles
 *     d'indicateurs, affectation par sélecteur d'utilisateur, fiche de
 *     détail, écart de compétence, suggestion de cycle de vie ;
 *   • l'onglet « Ordres de travail » de la GMAO (820 lignes) — suppression,
 *     création d'équipement en place, notes, sept types d'ordre.
 *
 * Ce module les réunit. Chaque capacité des deux côtés est conservée, mais
 * aucune n'est reprise sans avoir été VÉRIFIÉE contre le serveur : la
 * moitié de celles de l'onglet ne fonctionnaient pas.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE LE SERVEUR ACCEPTE RÉELLEMENT (mesuré le 20/10/2026)
 * ═══════════════════════════════════════════════════════════════════
 * `POST /api/work-orders` ne recopie PAS le corps reçu : il reconstruit un
 * objet champ par champ (gmao-routes.ts). Tout ce qu'il ne nomme pas est
 * perdu sans erreur. Envoyé le payload exact de l'onglet GMAO, le serveur
 * a répondu 201 « créé avec succès » et enregistré :
 *
 *   orderType: "calibration"            →  "corrective"   (réécrit)
 *   requestedBy: 1                      →  null           (perdu)
 *   estimatedDuration: 4                →  null           (perdu)
 *   scheduledStart: "2026-11-15T09:00"  →  null           (perdu)
 *
 * Autrement dit : on choisissait « Étalonnage », on saisissait une durée et
 * une date, on lisait « Ordre de travail créé avec succès », et l'ordre
 * était correctif, sans échéance et sans durée. Les deux champs texte
 * « Demandeur » et « Assigné à » aggravaient le tout : la colonne attend un
 * identifiant numérique d'utilisateur, le formulaire acceptait un nom, et
 * `parseInt("Jean Dupont")` vaut NaN — donc écarté avant même l'envoi.
 *
 * Côté page, deux échecs francs et non deux pertes silencieuses :
 *
 *   dueDate rempli      →  HTTP 400, « Expected date, received string »
 *   description vide    →  HTTP 400, « description Required »
 *
 * Or le formulaire n'exigeait que le titre et l'équipement, et proposait un
 * champ « Date d'échéance ». Remplir l'échéance — le geste normal — rendait
 * la création impossible.
 *
 * ═══════════════════════════════════════════════════════════════════
 * COMMENT LES CAPACITÉS SONT CONSERVÉES SANS TOUCHER AU SERVEUR
 * ═══════════════════════════════════════════════════════════════════
 * `PUT /api/work-orders/:id`, lui, recopie le corps (`{ ...updates }`) puis
 * traduit les alias. Vérifié : il accepte `dueDate` en chaîne, `requestedBy`,
 * et les sept valeurs d'`orderType`.
 *
 * La création procède donc en deux temps : un POST avec ce que POST sait
 * lire, puis — UNIQUEMENT si l'une de ces trois informations a été saisie —
 * un PUT qui la complète. Si le PUT échoue, l'ordre existe : on le dit, et
 * on rouvre le formulaire au lieu de laisser croire que tout a été pris.
 *
 * Le type est d'abord posé via `category`, qui est ce que POST lit : l'ordre
 * naît donc « correctif » ou « préventif », jamais indéterminé, et le PUT ne
 * fait que préciser « étalonnage » ou « inspection » le cas échéant.
 *
 * ⚠️ Ce détour appartient au client. La correction propre est serveur :
 *    que POST lise `dueDate`, `orderType` et `requestedBy` comme PUT le fait
 *    déjà. Elle est signalée dans docs/audit-ux/AUDIT_GMAO.md.
 */

// ─── Types : les champs réellement renvoyés par /api/work-orders ─────────────
interface OrdreTravail {
  id: number;
  orderNumber: string;
  equipmentId: number | null;
  equipmentName: string | null;
  orderType: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assignedTo: number | null;
  requestedBy: number | null;
  estimatedDuration: number | null; // minutes
  actualDuration: number | null; // minutes
  scheduledStart: string | null;
  location: string | null;
  notes: string | null;
  createdAt: string;
}
interface OptionEquipement { id: number; equipmentName: string; equipmentCode?: string; equipmentId?: string; }
interface OptionUtilisateur { id: number; firstName: string | null; lastName: string | null; username: string; }

interface EcartCompetence {
  workOrderId: number;
  technicianName: string;
  equipmentName: string;
  equipmentType: string;
}
interface SuggestionCycleVie {
  suggestedState: string;
  reason: string;
  currentState: string;
}

/**
 * Les sept types d'ordre que la colonne accepte. Les deux premiers passent
 * par `category` au POST ; les cinq autres exigent le PUT de complément.
 */
const TYPES_ORDRE = [
  { id: "corrective", libelle: "Maintenance corrective" },
  { id: "preventive", libelle: "Maintenance préventive" },
  { id: "emergency", libelle: "Urgence" },
  { id: "inspection", libelle: "Inspection" },
  { id: "calibration", libelle: "Étalonnage" },
  { id: "modification", libelle: "Modification" },
  { id: "installation", libelle: "Installation" },
] as const;

/** Types d'équipement proposés à la création en place. */
const TYPES_EQUIPEMENT = [
  { id: "pump", libelle: "Pompe" },
  { id: "motor", libelle: "Moteur" },
  { id: "compressor", libelle: "Compresseur" },
  { id: "conveyor", libelle: "Convoyeur" },
  { id: "generator", libelle: "Générateur" },
  { id: "transformer", libelle: "Transformateur" },
  { id: "valve", libelle: "Vanne" },
  { id: "turbine", libelle: "Turbine" },
  { id: "hvac", libelle: "HVAC / Climatisation" },
  { id: "electrical", libelle: "Électrique" },
  { id: "hydraulic", libelle: "Hydraulique" },
  { id: "pneumatic", libelle: "Pneumatique" },
  { id: "other", libelle: "Autre" },
] as const;

const CLASSE_CHAMP =
  "w-full h-10 px-3 border border-rule bg-white text-sm text-ink focus:outline-none " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal";

/**
 * Minutes stockées → heures lisibles. Une durée absente se dit « — » et non
 * « 0 h » : zéro heure estimée et pas d'estimation ne sont pas la même chose.
 */
function enHeures(minutes: number | null): string {
  if (!minutes) return "—";
  const heures = minutes / 60;
  return `${heures.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;
}

interface EtatFormulaire {
  title: string;
  description: string;
  equipmentId: string;
  priority: string;
  status: string;
  orderType: string;
  assignedTo: string;
  requestedBy: string;
  dueDate: string;
  estimatedHours: string;
  notes: string;
}
const FORMULAIRE_VIDE: EtatFormulaire = {
  title: "", description: "", equipmentId: "", priority: "medium", status: "pending",
  orderType: "corrective", assignedTo: "", requestedBy: "", dueDate: "", estimatedHours: "", notes: "",
};

/**
 * Erreur du PUT de complément : l'ordre EXISTE, mais une partie de la saisie
 * n'a pas été enregistrée. Distinguée d'un échec de création, qui ne laisse
 * rien derrière lui.
 */
class ComplementNonEnregistre extends Error {
  constructor(readonly ordre: OrdreTravail, readonly cause: Error) {
    super(cause.message);
  }
}

// ─── Écart de compétence (venait de la page) ─────────────────────────────────
function EcartCompetenceOT({ workOrderId }: { workOrderId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: ecart } = useQuery<EcartCompetence | null>({
    queryKey: [`/api/techlearn-bridge/gaps/${workOrderId}`],
  });

  const demanderFormation = useMutation({
    mutationFn: () =>
      apiRequest("/api/techlearn-bridge/request-training", { method: "POST", body: { workOrderId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/techlearn-bridge/gaps/${workOrderId}`] });
      toast({ title: "Formation demandée", description: "La demande a été transmise." });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  if (!ecart) return null;

  return (
    <div className="md:col-span-2 border border-etat-alerte-filet bg-etat-alerte-fond p-4">
      <div className="flex items-start gap-3">
        <GraduationCap className="h-5 w-5 text-etat-alerte-texte shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-etat-alerte-texte">Écart de compétence</p>
          <p className="text-sm text-etat-alerte-texte mt-1">
            {ecart.technicianName} n'a pas d'habilitation enregistrée pour {ecart.equipmentType}
            {ecart.equipmentName ? ` (${ecart.equipmentName})` : ""}.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => demanderFormation.mutate()}
            disabled={demanderFormation.isPending}
          >
            {demanderFormation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Demander une formation
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Suggestion de cycle de vie (venait de la page) ──────────────────────────
function SuggestionCycleVieOT({ workOrderId, equipmentId }: { workOrderId: number; equipmentId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const cle = `/api/equipment-lifecycle/${equipmentId}/suggestion?workOrderId=${workOrderId}`;
  const { data: suggestion } = useQuery<SuggestionCycleVie | null>({ queryKey: [cle] });

  const appliquer = useMutation({
    mutationFn: () =>
      apiRequest(`/api/equipment-lifecycle/${equipmentId}/transition`, {
        method: "POST",
        body: { newState: suggestion?.suggestedState, workOrderId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [cle] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      toast({ title: "État mis à jour", description: "Le cycle de vie de l'équipement a été ajusté." });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  if (!suggestion) return null;

  return (
    <div className="md:col-span-2 border border-etat-encours-filet bg-etat-encours-fond p-4">
      <p className="text-sm font-medium text-etat-encours-texte">Cycle de vie de l'équipement</p>
      <p className="text-sm text-etat-encours-texte mt-1">
        {suggestion.reason} — passage de « {suggestion.currentState} » à « {suggestion.suggestedState} ».
      </p>
      <Button
        size="sm"
        variant="outline"
        className="mt-3"
        onClick={() => appliquer.mutate()}
        disabled={appliquer.isPending}
      >
        {appliquer.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
        Appliquer
      </Button>
    </div>
  );
}

// ─── Création d'équipement en place (venait de l'onglet GMAO) ────────────────
function NouvelEquipement({ onCree }: { onCree: (id: number) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [type, setType] = useState("");
  const [emplacement, setEmplacement] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const creer = useMutation({
    mutationFn: () =>
      apiRequest("/api/equipment", {
        method: "POST",
        body: {
          equipmentName: nom.trim(),
          equipmentType: type.trim(),
          location: emplacement.trim() || "Non spécifié",
          operationalState: "operational",
          criticalityLevel: "medium",
        },
      }),
    onSuccess: (equipement: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      toast({ title: "Équipement créé", description: `${nom} a été ajouté au registre.` });
      if (equipement?.id) onCree(equipement.id);
      setOuvert(false);
      setNom("");
      setType("");
      setEmplacement("");
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        className="inline-flex items-center gap-1 mt-1 text-xs text-signal hover:underline"
      >
        <Plus className="h-3 w-3" aria-hidden="true" />
        {ouvert ? "Annuler l'ajout d'équipement" : "L'équipement n'est pas dans la liste"}
      </button>

      {ouvert && (
        <div className="md:col-span-2 border border-rule bg-paper p-4 mt-2">
          <p className="text-sm font-medium text-ink">Nouvel équipement</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <Label htmlFor="eq-nom" className="text-xs">Nom *</Label>
              <Input
                id="eq-nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex : Pompe P-003"
                className="border-rule"
              />
            </div>
            <div>
              <Label htmlFor="eq-type" className="text-xs">Type *</Label>
              <select
                id="eq-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={CLASSE_CHAMP}
              >
                <option value="">Sélectionner un type</option>
                {TYPES_EQUIPEMENT.map((t) => (
                  <option key={t.id} value={t.id}>{t.libelle}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="eq-lieu" className="text-xs">Emplacement</Label>
              <Input
                id="eq-lieu"
                value={emplacement}
                onChange={(e) => setEmplacement(e.target.value)}
                placeholder="Ex : Zone production A"
                className="border-rule"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={creer.isPending || !nom.trim() || !type}
              onClick={() => creer.mutate()}
              className="bg-ink text-white hover:bg-signal"
            >
              {creer.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Créer l'équipement
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

interface ProprietesOT {
  /**
   * En-tête fourni par l'écran hôte. La page /work-orders et l'onglet de la
   * GMAO montent le MÊME composant ; chacun pose son titre, sans quoi
   * l'onglet affichait deux titres superposés — un `<h1>` « Ordres de
   * travail » suivi d'un `<h2>` « Ordres de Travail ».
   */
  enTete?: React.ReactNode;
}

export function WorkOrderManagement({ enTete }: ProprietesOT) {
  const [recherche, setRecherche] = useState("");
  const [statutFiltre, setStatutFiltre] = useState("all");
  const [prioriteFiltre, setPrioriteFiltre] = useState("all");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [ordreEdite, setOrdreEdite] = useState<number | null>(null);
  const [formulaire, setFormulaire] = useState<EtatFormulaire>(FORMULAIRE_VIDE);
  const [ordreConsulte, setOrdreConsulte] = useState<OrdreTravail | null>(null);
  const [suppressionDemandee, setSuppressionDemandee] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  /**
   * La suppression est refusée par le serveur en dessous de directeur
   * technique : `hasRole(req, 'admin', 'director', 'technical_director',
   * 'owner')` (gmao-routes.ts). Vérifié : un technicien reçoit 403, un
   * administrateur 200.
   *
   * L'onglet GMAO montrait pourtant la corbeille à TOUT LE MONDE — trente-cinq
   * boutons relevés à l'écran — et un technicien n'obtenait qu'un « Impossible
   * de supprimer » sans raison. Le contrôle est reproduit ici par le
   * référentiel de rôles plutôt qu'en comparant des chaînes : `owner` est
   * au-dessus d'`admin` et serait refusé par une égalité littérale.
   */
  const peutSupprimer = auMoins(user?.role, "technical_director");

  const { data: ordres = [], isLoading, error } = useQuery<OrdreTravail[]>({
    queryKey: ["/api/work-orders"],
    retry: 2,
    staleTime: 30000,
  });
  const { data: equipements = [] } = useQuery<OptionEquipement[]>({ queryKey: ["/api/equipment"] });
  const { data: utilisateurs = [] } = useQuery<OptionUtilisateur[]>({ queryKey: ["/api/user-profiles"] });

  const nomUtilisateur = (id: number | null) => {
    if (!id) return "Non assigné";
    const u = utilisateurs.find((u) => u.id === id);
    if (!u) return `Utilisateur #${id}`;
    return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username;
  };

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });

  /**
   * Création en deux temps. Voir l'en-tête du fichier : POST reconstruit son
   * objet champ par champ et ignore `dueDate`, `requestedBy` et `orderType`.
   */
  const creer = useMutation({
    mutationFn: async (f: EtatFormulaire): Promise<OrdreTravail> => {
      const corps: Record<string, unknown> = {
        title: f.title.trim(),
        description: f.description.trim(),
        priority: f.priority,
        status: f.status,
        // `category` est le seul alias que POST lit pour le type.
        category: f.orderType === "preventive" ? "Préventif" : "Correctif",
      };
      if (f.equipmentId) corps.equipmentId = parseInt(f.equipmentId, 10);
      if (f.assignedTo) corps.assignedTo = f.assignedTo;
      if (f.estimatedHours) corps.estimatedHours = parseFloat(f.estimatedHours);
      if (f.notes.trim()) corps.notes = f.notes.trim();

      const ordre: OrdreTravail = await apiRequest("/api/work-orders", { method: "POST", body: corps });

      // Complément : uniquement ce que POST ne sait pas enregistrer.
      const complement: Record<string, unknown> = {};
      if (f.dueDate) complement.dueDate = f.dueDate;
      if (f.requestedBy) complement.requestedBy = parseInt(f.requestedBy, 10);
      if (f.orderType !== "corrective" && f.orderType !== "preventive") {
        complement.orderType = f.orderType;
      }
      /**
       * Demi-heures : POST calcule `parseInt(estimatedHours) * 60`, donc
       * 3,5 h était enregistré comme 180 minutes — la demi-heure disparaissait
       * alors que le champ propose un pas de 0,5. PUT, lui, fait
       * `Math.round(parseFloat(...) * 60)` et tombe juste. Le complément ne
       * part donc que si la saisie n'est pas un nombre entier d'heures.
       */
      const heures = parseFloat(f.estimatedHours);
      if (!Number.isNaN(heures) && !Number.isInteger(heures)) {
        complement.estimatedHours = heures;
      }
      if (Object.keys(complement).length > 0) {
        try {
          return await apiRequest(`/api/work-orders/${ordre.id}`, { method: "PUT", body: complement });
        } catch (e) {
          throw new ComplementNonEnregistre(ordre, e as Error);
        }
      }
      return ordre;
    },
    onSuccess: (ordre) => {
      rafraichir();
      toast({ title: "Ordre de travail créé", description: ordre.orderNumber });
      fermerFormulaire();
    },
    onError: (e: Error) => {
      rafraichir();
      if (e instanceof ComplementNonEnregistre) {
        // L'ordre existe : on le dit, et on rouvre dessus pour finir la saisie.
        toast({
          title: `Ordre ${e.ordre.orderNumber} créé, complément non enregistré`,
          description: "L'échéance, le demandeur ou le type précis n'ont pas été pris. Complétez la fiche.",
          variant: "destructive",
        });
        ouvrirEdition(e.ordre);
        return;
      }
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  const modifier = useMutation({
    mutationFn: ({ id, corps }: { id: number; corps: Record<string, unknown> }) =>
      apiRequest(`/api/work-orders/${id}`, { method: "PUT", body: corps }),
    onSuccess: () => {
      rafraichir();
      toast({ title: "Ordre de travail mis à jour" });
      fermerFormulaire();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const changerStatut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/api/work-orders/${id}`, { method: "PUT", body: { status } }),
    onSuccess: (ordre: OrdreTravail, variables) => {
      rafraichir();
      if (ordreConsulte?.id === variables.id) setOrdreConsulte(ordre);
      toast({ title: "Statut mis à jour", description: libelleStatutOT(variables.status) });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const supprimer = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/work-orders/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      rafraichir();
      toast({ title: "Ordre de travail supprimé" });
      setSuppressionDemandee(false);
      setOrdreConsulte(null);
    },
    onError: (e: Error) => {
      setSuppressionDemandee(false);
      toast({ title: "Suppression refusée", description: e.message, variant: "destructive" });
    },
  });

  const ordresFiltres = ordres.filter((o) => {
    const terme = recherche.toLowerCase();
    const correspondRecherche =
      (o.title || "").toLowerCase().includes(terme) ||
      (o.orderNumber || "").toLowerCase().includes(terme) ||
      (o.description || "").toLowerCase().includes(terme) ||
      (o.equipmentName || "").toLowerCase().includes(terme);
    // La comparaison passe par la valeur canonique : un ordre `on_hold` et un
    // ordre `paused` sont le même état et doivent sortir du même filtre.
    const correspondStatut = statutFiltre === "all" || statutCanoniqueOT(o.status) === statutFiltre;
    const correspondPriorite = prioriteFiltre === "all" || prioriteCanoniqueOT(o.priority) === prioriteFiltre;
    return correspondRecherche && correspondStatut && correspondPriorite;
  });

  function registreStatut(statut: string): RegistreEtat {
    return definitionStatutOT(statut)?.registre ?? "neutre";
  }
  function registrePriorite(priorite: string): RegistreEtat {
    return definitionPrioriteOT(priorite)?.registre ?? "neutre";
  }
  function iconeStatut(statut: string) {
    switch (statutCanoniqueOT(statut)) {
      case "pending": return Clock;
      case "assigned": return UserCheck;
      case "in_progress": return Play;
      case "paused": return Pause;
      case "completed": return CheckCircle;
      case "cancelled": return X;
      default: return Clock;
    }
  }

  const compteur = (statut: string) =>
    ordres.filter((o) => statutCanoniqueOT(o.status) === statut).length;
  const stats = {
    total: ordres.length,
    enAttente: compteur("pending"),
    enCours: compteur("in_progress"),
    critiques: ordres.filter((o) => prioriteCanoniqueOT(o.priority) === "urgent").length,
  };

  function fermerFormulaire() {
    setFormulaireOuvert(false);
    setOrdreEdite(null);
    setFormulaire(FORMULAIRE_VIDE);
  }

  function ouvrirCreation() {
    setFormulaire(FORMULAIRE_VIDE);
    setOrdreEdite(null);
    setFormulaireOuvert(true);
  }

  function ouvrirEdition(ordre: OrdreTravail) {
    setFormulaire({
      title: ordre.title || "",
      description: ordre.description || "",
      equipmentId: ordre.equipmentId ? String(ordre.equipmentId) : "",
      priority: prioriteCanoniqueOT(ordre.priority) ?? "medium",
      status: statutCanoniqueOT(ordre.status) ?? "pending",
      orderType: ordre.orderType || "corrective",
      assignedTo: ordre.assignedTo ? String(ordre.assignedTo) : "",
      requestedBy: ordre.requestedBy ? String(ordre.requestedBy) : "",
      dueDate: ordre.scheduledStart ? ordre.scheduledStart.slice(0, 10) : "",
      estimatedHours: ordre.estimatedDuration ? String(ordre.estimatedDuration / 60) : "",
      notes: ordre.notes || "",
    });
    setOrdreEdite(ordre.id);
    setOrdreConsulte(null);
    setFormulaireOuvert(true);
  }

  function soumettre() {
    /**
     * La description est OBLIGATOIRE côté serveur (`description` est
     * `notNull`, et le schéma Zod la refuse absente : HTTP 400
     * « description Required »). L'ancien formulaire de la page ne
     * contrôlait que le titre et l'équipement : laisser la description vide
     * produisait un échec brut, affiché tel quel à l'utilisateur.
     */
    if (!formulaire.title.trim() || !formulaire.description.trim() || !formulaire.equipmentId) {
      toast({
        title: "Champs obligatoires",
        description: "Le titre, la description et l'équipement sont requis.",
        variant: "destructive",
      });
      return;
    }

    if (ordreEdite) {
      // PUT recopie le corps : tous les champs y passent directement.
      modifier.mutate({
        id: ordreEdite,
        corps: {
          title: formulaire.title.trim(),
          description: formulaire.description.trim(),
          equipmentId: parseInt(formulaire.equipmentId, 10),
          priority: formulaire.priority,
          status: formulaire.status,
          orderType: formulaire.orderType,
          assignedTo: formulaire.assignedTo,
          requestedBy: formulaire.requestedBy ? parseInt(formulaire.requestedBy, 10) : null,
          dueDate: formulaire.dueDate || undefined,
          estimatedHours: formulaire.estimatedHours || undefined,
          notes: formulaire.notes.trim(),
        },
      });
    } else {
      creer.mutate(formulaire);
    }
  }

  const enCoursEnvoi = creer.isPending || modifier.isPending;

  return (
    <div className="space-y-6">
      {/* L'en-tête vient de l'écran hôte — même convention que la maintenance
          préventive et les équipements. L'action principale reste ici : elle
          ouvre un état interne au composant, que l'hôte ne peut pas déclencher. */}
      {enTete ?? (
        <EnTetePage
          surTitre="GMAO"
          titre="Ordres de travail"
          phrase="Les interventions demandées, leur priorité, leur responsable et leur avancement."
        />
      )}

      <div className="flex justify-end">
        <ActionPrincipale onClick={ouvrirCreation}>
          <Plus className="h-4 w-4" />
          Nouvel ordre de travail
        </ActionPrincipale>
      </div>

      <RangeeIndicateurs colonnes={4}>
        <Indicateur
          libelle="Total"
          valeur={stats.total}
          precision={stats.total > 0 ? "ordres enregistrés" : "aucun ordre à ce jour"}
          icone={FileText}
        />
        <Indicateur
          libelle="En attente"
          valeur={stats.enAttente}
          precision={stats.enAttente > 0 ? "à affecter ou à planifier" : "rien en attente"}
          icone={Clock}
          alerte={stats.enAttente > 0}
        />
        <Indicateur
          libelle="En cours"
          valeur={stats.enCours}
          precision={stats.enCours > 0 ? "interventions engagées" : "aucune intervention engagée"}
          icone={Play}
        />
        <Indicateur
          libelle="Critiques"
          valeur={stats.critiques}
          precision={stats.critiques > 0 ? "à traiter sans délai" : "aucune urgence"}
          icone={AlertCircle}
          alerte={stats.critiques > 0}
        />
      </RangeeIndicateurs>

      {/* Recherche et filtres */}
      <div className="border border-rule bg-white p-5">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute h-4 w-4" aria-hidden="true" />
            <Input
              id="recherche-ordres"
              aria-label="Rechercher un ordre de travail"
              placeholder="Rechercher par numéro, titre, description ou équipement..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="pl-10 border-rule"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={statutFiltre}
              onChange={(e) => setStatutFiltre(e.target.value)}
              aria-label="Filtrer par statut"
              className="h-10 px-3 border border-rule bg-white text-sm text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal"
            >
              <option value="all">Tous les statuts</option>
              {STATUTS_OT.map((s) => (
                <option key={s.id} value={s.id}>{s.libelle}</option>
              ))}
            </select>
            <select
              value={prioriteFiltre}
              onChange={(e) => setPrioriteFiltre(e.target.value)}
              aria-label="Filtrer par priorité"
              className="h-10 px-3 border border-rule bg-white text-sm text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal"
            >
              <option value="all">Toutes priorités</option>
              {PRIORITES_OT.map((p) => (
                <option key={p.id} value={p.id}>{p.libelle}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-white border border-rule animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-paper-deep w-3/4 mb-2" />
                <div className="h-3 bg-paper-deep w-full" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-3 bg-paper-deep w-full" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-3 bg-paper-deep" />
                  <div className="h-3 bg-paper-deep" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <div className="border border-etat-critique-filet bg-etat-critique-fond p-6">
          <AlertCircle className="h-5 w-5 text-etat-critique-texte" aria-hidden="true" />
          <h3 className="font-serif text-title font-medium text-etat-critique-texte mt-3">
            Les ordres de travail n'ont pas pu être chargés
          </h3>
          <p className="text-sm text-etat-critique-texte mt-2">
            Vérifiez votre connexion, puis réessayez. Aucun ordre n'est affiché tant que les
            données réelles ne sont pas disponibles.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 h-10 px-4 mt-4 border border-etat-critique-filet bg-white text-sm text-etat-critique-texte hover:bg-etat-critique-fond transition-colors"
          >
            Réessayer
          </button>
        </div>
      ) : ordresFiltres.length === 0 ? (
        <EtatVide
          icone={FileText}
          titre={ordres.length === 0 ? "Aucun ordre de travail" : "Aucun ordre ne correspond aux filtres"}
          phrase={
            ordres.length === 0
              ? "Un ordre de travail porte une demande, une priorité et un responsable. C'est lui qui trace l'intervention, de la demande au retour d'expérience."
              : "Élargissez la recherche, ou remettez les filtres de statut et de priorité sur « tous »."
          }
          action={
            ordres.length === 0 ? (
              <ActionPrincipale onClick={ouvrirCreation}>
                <Plus className="h-4 w-4" />
                Créer le premier ordre
              </ActionPrincipale>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {ordresFiltres.map((ordre) => {
            const IconeStatut = iconeStatut(ordre.status);
            const statut = statutCanoniqueOT(ordre.status);
            return (
              <Card key={ordre.id} className="bg-white border border-rule shadow-none relative">
                <span
                  className={`absolute left-0 top-0 bottom-0 w-0.5 ${ETAT[registrePriorite(ordre.priority)].filet}`}
                  aria-hidden="true"
                />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="font-mono text-sm text-ink-mute">{ordre.orderNumber}</CardTitle>
                      <CardDescription className="font-serif text-title text-ink mt-1">{ordre.title}</CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <PuceEtat registre={registreStatut(ordre.status)}>
                        <IconeStatut className="h-3 w-3" aria-hidden="true" />
                        {libelleStatutOT(ordre.status)}
                      </PuceEtat>
                      <PuceEtat registre={registrePriorite(ordre.priority)}>
                        {libellePrioriteOT(ordre.priority)}
                      </PuceEtat>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-ink-soft line-clamp-2">{ordre.description}</div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="flex items-center gap-1"><Wrench className="h-3 w-3 text-ink-mute" aria-hidden="true" /><span>{ordre.equipmentName || "Équipement non précisé"}</span></div>
                    <div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-ink-mute" aria-hidden="true" /><span>{ordre.location || "Non spécifié"}</span></div>
                    <div className="flex items-center gap-1"><User className="h-3 w-3 text-ink-mute" aria-hidden="true" /><span>{nomUtilisateur(ordre.assignedTo)}</span></div>
                    <div className="flex items-center gap-1"><Calendar className="h-3 w-3 text-ink-mute" aria-hidden="true" /><span>{ordre.scheduledStart ? ordre.scheduledStart.slice(0, 10) : "Non programmé"}</span></div>
                  </div>

                  {statut === "in_progress" && (
                    <div className="bg-paper-deep border border-rule p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>Progression :</span>
                        <span>
                          {Math.round((ordre.actualDuration || 0) / 60)} h / {Math.round((ordre.estimatedDuration || 120) / 60)} h
                        </span>
                      </div>
                      <div className="w-full bg-white border border-rule h-2 mt-2">
                        <div
                          className="bg-signal h-2 transition-all duration-300"
                          style={{ width: `${Math.min(((ordre.actualDuration || 0) / (ordre.estimatedDuration || 120)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setOrdreConsulte(ordre)}>
                        <Eye className="h-3 w-3 mr-1" aria-hidden="true" />Voir
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => ouvrirEdition(ordre)}>
                        <Edit className="h-3 w-3 mr-1" aria-hidden="true" />Éditer
                      </Button>
                      <Link href={`/maintenance-execution/${ordre.id}`}>
                        <Button size="sm" variant="outline">
                          <ClipboardList className="h-3 w-3 mr-1" aria-hidden="true" />Intervention
                        </Button>
                      </Link>
                    </div>

                    {statut === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => changerStatut.mutate({ id: ordre.id, status: "in_progress" })}
                        disabled={changerStatut.isPending}
                        className="bg-ink text-paper hover:bg-signal"
                      >
                        <Play className="h-3 w-3 mr-1" aria-hidden="true" />Démarrer
                      </Button>
                    )}
                    {statut === "in_progress" && (
                      <Button
                        size="sm"
                        onClick={() => changerStatut.mutate({ id: ordre.id, status: "completed" })}
                        disabled={changerStatut.isPending}
                        className="bg-ink text-paper hover:bg-signal"
                      >
                        <CheckSquare className="h-3 w-3 mr-1" aria-hidden="true" />Terminer
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── Formulaire de création / édition ───────────────────────────── */}
      {formulaireOuvert && (
        <div
          className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-formulaire-ot"
        >
          <div className="bg-white border border-rule w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-6 gap-4">
              <h2 id="titre-formulaire-ot" className="font-serif text-page text-ink">
                {ordreEdite ? "Modifier l'ordre de travail" : "Nouvel ordre de travail"}
              </h2>
              <Button variant="ghost" size="sm" onClick={fermerFormulaire} aria-label="Fermer">
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="ot-titre">Titre *</Label>
                <Input
                  id="ot-titre"
                  value={formulaire.title}
                  onChange={(e) => setFormulaire({ ...formulaire, title: e.target.value })}
                  placeholder="Ex : Remplacement garniture pompe P-102"
                  className="border-rule"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="ot-description">Description *</Label>
                <Textarea
                  id="ot-description"
                  value={formulaire.description}
                  onChange={(e) => setFormulaire({ ...formulaire, description: e.target.value })}
                  placeholder="Le travail à effectuer, les conditions d'intervention."
                  rows={3}
                  className="border-rule"
                />
              </div>

              <div>
                <Label htmlFor="ot-equipement">Équipement *</Label>
                <select
                  id="ot-equipement"
                  value={formulaire.equipmentId}
                  onChange={(e) => setFormulaire({ ...formulaire, equipmentId: e.target.value })}
                  className={CLASSE_CHAMP}
                >
                  <option value="">Sélectionner un équipement</option>
                  {equipements.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.equipmentName}
                      {eq.equipmentCode || eq.equipmentId ? ` (${eq.equipmentCode || eq.equipmentId})` : ""}
                    </option>
                  ))}
                </select>
                <NouvelEquipement
                  onCree={(id) => setFormulaire((f) => ({ ...f, equipmentId: String(id) }))}
                />
              </div>

              <div>
                <Label htmlFor="ot-type">Type d'ordre</Label>
                <select
                  id="ot-type"
                  value={formulaire.orderType}
                  onChange={(e) => setFormulaire({ ...formulaire, orderType: e.target.value })}
                  className={CLASSE_CHAMP}
                >
                  {TYPES_ORDRE.map((t) => (
                    <option key={t.id} value={t.id}>{t.libelle}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="ot-priorite">Priorité</Label>
                <select
                  id="ot-priorite"
                  value={formulaire.priority}
                  onChange={(e) => setFormulaire({ ...formulaire, priority: e.target.value })}
                  className={CLASSE_CHAMP}
                >
                  {PRIORITES_OT.map((p) => (
                    <option key={p.id} value={p.id}>{p.libelle}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="ot-statut">Statut</Label>
                <select
                  id="ot-statut"
                  value={formulaire.status}
                  onChange={(e) => setFormulaire({ ...formulaire, status: e.target.value })}
                  className={CLASSE_CHAMP}
                >
                  {STATUTS_OT.map((s) => (
                    <option key={s.id} value={s.id}>{s.libelle}</option>
                  ))}
                </select>
              </div>

              {/* Affectation et demande : des SÉLECTEURS, pas des champs libres.
                  Les colonnes `assigned_to` et `requested_by` sont des clés
                  étrangères numériques vers user_profiles ; l'onglet GMAO
                  proposait « Nom du demandeur » en texte libre, converti par
                  `parseInt` — donc NaN, donc écarté avant l'envoi. */}
              <div>
                <Label htmlFor="ot-assigne">Assigné à</Label>
                <select
                  id="ot-assigne"
                  value={formulaire.assignedTo}
                  onChange={(e) => setFormulaire({ ...formulaire, assignedTo: e.target.value })}
                  className={CLASSE_CHAMP}
                >
                  <option value="">Non assigné</option>
                  {utilisateurs.map((u) => (
                    <option key={u.id} value={u.id}>
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="ot-demandeur">Demandeur</Label>
                <select
                  id="ot-demandeur"
                  value={formulaire.requestedBy}
                  onChange={(e) => setFormulaire({ ...formulaire, requestedBy: e.target.value })}
                  className={CLASSE_CHAMP}
                >
                  <option value="">Non précisé</option>
                  {utilisateurs.map((u) => (
                    <option key={u.id} value={u.id}>
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="ot-echeance">Date d'échéance</Label>
                <Input
                  id="ot-echeance"
                  type="date"
                  value={formulaire.dueDate}
                  onChange={(e) => setFormulaire({ ...formulaire, dueDate: e.target.value })}
                  className="border-rule"
                />
              </div>

              <div>
                <Label htmlFor="ot-heures">Heures estimées</Label>
                <Input
                  id="ot-heures"
                  type="number"
                  step="0.5"
                  min="0"
                  value={formulaire.estimatedHours}
                  onChange={(e) => setFormulaire({ ...formulaire, estimatedHours: e.target.value })}
                  placeholder="Ex : 4"
                  className="border-rule"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="ot-notes">Notes</Label>
                <Textarea
                  id="ot-notes"
                  value={formulaire.notes}
                  onChange={(e) => setFormulaire({ ...formulaire, notes: e.target.value })}
                  placeholder="Consignes, pièces à prévoir, précautions."
                  rows={3}
                  className="border-rule"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={fermerFormulaire}>Annuler</Button>
              <Button onClick={soumettre} disabled={enCoursEnvoi} className="bg-ink text-white hover:bg-signal">
                {enCoursEnvoi && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                {ordreEdite ? "Enregistrer" : "Créer l'ordre"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Fiche de détail ────────────────────────────────────────────── */}
      {ordreConsulte && (
        <div
          className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-detail-ot"
        >
          <div className="bg-white border border-rule w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-6 gap-4">
              <div className="min-w-0">
                <p className="font-mono text-sm text-ink-mute">{ordreConsulte.orderNumber}</p>
                <h2 id="titre-detail-ot" className="font-serif text-page text-ink mt-1">{ordreConsulte.title}</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setOrdreConsulte(null); setSuppressionDemandee(false); }} aria-label="Fermer">
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div><Label className="text-sm text-ink-soft">Description</Label><p className="text-ink">{ordreConsulte.description || "—"}</p></div>
                <div><Label className="text-sm text-ink-soft">Équipement</Label><p className="text-ink">{ordreConsulte.equipmentName || "Non précisé"}</p></div>
                <div><Label className="text-sm text-ink-soft">Emplacement</Label><p className="text-ink">{ordreConsulte.location || "Non spécifié"}</p></div>
                <div>
                  <Label className="text-sm text-ink-soft">Type</Label>
                  <p className="text-ink">
                    {TYPES_ORDRE.find((t) => t.id === ordreConsulte.orderType)?.libelle || ordreConsulte.orderType || "—"}
                  </p>
                </div>
                {ordreConsulte.notes && (
                  <div><Label className="text-sm text-ink-soft">Notes</Label><p className="text-ink whitespace-pre-line">{ordreConsulte.notes}</p></div>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-ink-soft">Statut</Label>
                    <div className="mt-1">
                      <PuceEtat registre={registreStatut(ordreConsulte.status)}>
                        {libelleStatutOT(ordreConsulte.status)}
                      </PuceEtat>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-ink-soft">Priorité</Label>
                    <div className="mt-1">
                      <Badge variant="outline" className="text-xs">{libellePrioriteOT(ordreConsulte.priority)}</Badge>
                    </div>
                  </div>
                </div>
                <div><Label className="text-sm text-ink-soft">Assigné à</Label><p className="text-ink">{nomUtilisateur(ordreConsulte.assignedTo)}</p></div>
                <div><Label className="text-sm text-ink-soft">Demandeur</Label><p className="text-ink">{ordreConsulte.requestedBy ? nomUtilisateur(ordreConsulte.requestedBy) : "Non précisé"}</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-sm text-ink-soft">Créé le</Label><p className="text-ink">{ordreConsulte.createdAt ? ordreConsulte.createdAt.slice(0, 10) : "—"}</p></div>
                  <div><Label className="text-sm text-ink-soft">Échéance</Label><p className="text-ink">{ordreConsulte.scheduledStart ? ordreConsulte.scheduledStart.slice(0, 10) : "—"}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-sm text-ink-soft">Heures estimées</Label><p className="text-ink">{enHeures(ordreConsulte.estimatedDuration)}</p></div>
                  <div><Label className="text-sm text-ink-soft">Heures réelles</Label><p className="text-ink">{enHeures(ordreConsulte.actualDuration)}</p></div>
                </div>

                {/* Changement de statut complet. La carte ne porte que la
                    transition attendue (Démarrer, Terminer) ; suspendre,
                    annuler ou réaffecter sont des gestes plus rares, qui
                    trouvent leur place ici plutôt que sur chaque vignette. */}
                <div>
                  <Label htmlFor="ot-statut-detail" className="text-sm text-ink-soft">Changer le statut</Label>
                  <select
                    id="ot-statut-detail"
                    value={statutCanoniqueOT(ordreConsulte.status) ?? ""}
                    onChange={(e) => changerStatut.mutate({ id: ordreConsulte.id, status: e.target.value })}
                    disabled={changerStatut.isPending}
                    className={CLASSE_CHAMP + " mt-1"}
                  >
                    {STATUTS_OT.map((s) => (
                      <option key={s.id} value={s.id}>{s.libelle}</option>
                    ))}
                  </select>
                </div>
              </div>

              <EcartCompetenceOT workOrderId={ordreConsulte.id} />
              {ordreConsulte.equipmentId && (
                <SuggestionCycleVieOT workOrderId={ordreConsulte.id} equipmentId={ordreConsulte.equipmentId} />
              )}
            </div>

            {/* Suppression : visible seulement pour les rôles que le serveur
                autorise, et confirmée sur place plutôt que par un `confirm()`
                du navigateur, qui ne rappelle ni le numéro ni le titre. */}
            {peutSupprimer && (
              <div className="border-t border-rule mt-6 pt-4">
                {suppressionDemandee ? (
                  <div className="border border-etat-critique-filet bg-etat-critique-fond p-4">
                    <p className="text-sm text-etat-critique-texte">
                      Supprimer définitivement l'ordre {ordreConsulte.orderNumber} — « {ordreConsulte.title} » ?
                      Cette action est irréversible.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" onClick={() => setSuppressionDemandee(false)}>
                        Conserver
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => supprimer.mutate(ordreConsulte.id)}
                        disabled={supprimer.isPending}
                        className="bg-etat-critique-texte text-white hover:bg-etat-critique-texte"
                      >
                        {supprimer.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />}
                        Supprimer
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSuppressionDemandee(true)}
                    className="text-etat-critique-texte hover:text-etat-critique-texte"
                  >
                    <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
                    Supprimer cet ordre
                  </Button>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => { setOrdreConsulte(null); setSuppressionDemandee(false); }}>
                Fermer
              </Button>
              <Link href={`/maintenance-execution/${ordreConsulte.id}`}>
                <Button variant="outline">
                  <ClipboardList className="h-4 w-4 mr-2" aria-hidden="true" />Suivre l'intervention
                </Button>
              </Link>
              <Button onClick={() => ouvrirEdition(ordreConsulte)} className="bg-ink text-white hover:bg-signal">
                <Edit className="h-4 w-4 mr-2" aria-hidden="true" />Éditer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkOrderManagement;
