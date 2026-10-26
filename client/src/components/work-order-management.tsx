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
  /** Plan préventif qui a engendré cet ordre — migration 0024. */
  planId: number | null;
  /** « Intervention avec arrêt machine » — migration 0024. */
  requiresShutdown: boolean | null;
}
interface OptionEquipement { id: number; equipmentName: string; equipmentCode?: string; equipmentId?: string; }
interface OptionUtilisateur { id: number; firstName: string | null; lastName: string | null; username: string; }
interface OptionPlan {
  id: number;
  planName: string;
  equipmentType: string;
  frequency: string;
  frequencyValue: number | null;
  nextDue: string | null;
  isActive: boolean | null;
}
interface OptionPiece {
  id: number;
  partNumber: string;
  partName: string;
  currentStock: number | null;
}
interface CompteurUsage {
  id: number;
  counterType: string;
  description: string | null;
  currentValue: number | null;
  thresholdValue: number | null;
  lastResetValue: number | null;
  isActive: boolean | null;
}

/** Unités des compteurs d'usage, telles que `counter_type` les nomme. */
const UNITE_COMPTEUR: Record<string, string> = {
  hours: "h", cycles: "cycles", kilometers: "km", units: "unités",
};

/** Une référence manquante, telle que la route de clôture la renvoie en 409. */
interface ManquePiece {
  sparePartId: number;
  partNumber: string;
  partName: string;
  demande: number;
  disponible: number;
  manque: number;
}

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
  /** Identifiant du plan préventif, en chaîne — c'est ce que rend un `<select>`. */
  planId: string;
  requiresShutdown: boolean;
}
const FORMULAIRE_VIDE: EtatFormulaire = {
  title: "", description: "", equipmentId: "", priority: "medium", status: "pending",
  orderType: "corrective", assignedTo: "", requestedBy: "", dueDate: "", estimatedHours: "", notes: "",
  planId: "", requiresShutdown: false,
};

/**
 * Les fréquences de plan, en français.
 *
 * ⚠️ DEUX VOCABULAIRES coexistent réellement en base, et ce n'est pas une
 * précaution : le formulaire de maintenance préventive écrit
 * `days/weeks/months/years`, tandis que l'injecteur de démonstration et le
 * générateur de données écrivent `daily/weekly/monthly/quarterly/annually`.
 * Le serveur reconnaît les deux (shared/replanification-preventive.ts) ; ce
 * libellé doit donc les reconnaître aussi, sans quoi la moitié des plans
 * s'afficheraient avec leur clé technique dans le sélecteur.
 */
const LIBELLE_FREQUENCE: Record<string, string> = {
  days: "jour(s)", weeks: "semaine(s)", months: "mois", years: "an(s)",
  daily: "jour", weekly: "semaine", biweekly: "2 semaines", monthly: "mois",
  quarterly: "trimestre", semiannually: "semestre", annually: "an", annual: "an", yearly: "an",
  hours_based: "heures de fonctionnement", usage_based: "cycles d'usage",
};

/** « Plan graissage — tous les 2 mois ». */
function libellePlan(plan: OptionPlan): string {
  const unite = LIBELLE_FREQUENCE[(plan.frequency || "").toLowerCase()] ?? plan.frequency;
  const valeur = plan.frequencyValue ?? 1;
  const periode = valeur > 1 ? `tous les ${valeur} ${unite}` : `tous les ${unite}`;
  return `${plan.planName} — ${periode}`;
}

/**
 * Extrait la liste des manques d'un refus de clôture pour stock insuffisant.
 *
 * ⚠️ `apiRequest` APLATIT le corps de la réponse dans le message d'erreur :
 * `throw new Error(\`${res.status}: ${text}\`)` (client/src/lib/queryClient.ts).
 * Un 409 arrive donc ici sous la forme d'une chaîne
 * `"409: {\"error\":\"STOCK_INSUFFISANT\",\"manques\":[…]}"`, et il faut la
 * rouvrir pour retrouver la structure que le serveur a pris soin de rendre.
 *
 * On ne touche PAS à `apiRequest` : il sert tout le client, et lui faire porter
 * le corps des erreurs est un changement de contrat qui dépasse cet écran. La
 * lecture est donc faite ici, et défensivement — une chaîne qui ne se réanalyse
 * pas rend `null`, et l'appelant retombe sur l'affichage d'erreur ordinaire
 * plutôt que de masquer le refus.
 *
 * Rend `null` pour tout ce qui n'est pas un refus de stock reconnaissable.
 */
function lireRefusStock(e: Error): ManquePiece[] | null {
  const debut = e.message.indexOf("{");
  if (debut < 0) return null;
  try {
    const corps = JSON.parse(e.message.slice(debut));
    if (corps?.error !== "STOCK_INSUFFISANT" || !Array.isArray(corps.manques)) return null;
    return corps.manques as ManquePiece[];
  } catch {
    return null;
  }
}

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
  /** Ordre en cours de clôture — porte la boîte de déclaration des pièces. */
  const [ordreACloturer, setOrdreACloturer] = useState<OrdreTravail | null>(null);
  /** Quantités saisies, par identifiant de pièce. Chaînes : ce sont des champs. */
  const [quantites, setQuantites] = useState<Record<number, string>>({});
  /** Manques renvoyés par un refus 409, réaffichés dans la boîte. */
  const [manques, setManques] = useState<ManquePiece[] | null>(null);
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

  /**
   * Créer un ordre de travail engage la planification et le budget.
   *
   * Le serveur l'exige d'un chef d'équipe au moins depuis que la demande
   * d'intervention existe — même niveau que l'arbitrage d'une demande, parce
   * que les deux gestes engagent la même chose. Si créer directement était
   * plus permissif, la séparation DI / OT se contournerait par la porte d'à
   * côté.
   *
   * Reproduit ici par le référentiel de rôles, jamais par une égalité de
   * chaînes : `owner` est au-dessus d'`admin` et serait refusé par une
   * comparaison littérale.
   *
   * ⚠️ Ce drapeau commande l'AFFICHAGE, pas l'autorisation. Le serveur
   * revérifie — un bouton caché n'est pas un contrôle d'accès.
   */
  const peutCreerOrdre = auMoins(user?.role, "team_leader");

  const { data: ordres = [], isLoading, error } = useQuery<OrdreTravail[]>({
    queryKey: ["/api/work-orders"],
    retry: 2,
    staleTime: 30000,
  });
  const { data: equipements = [] } = useQuery<OptionEquipement[]>({ queryKey: ["/api/equipment"] });
  const { data: utilisateurs = [] } = useQuery<OptionUtilisateur[]>({ queryKey: ["/api/user-profiles"] });
  const { data: plans = [] } = useQuery<OptionPlan[]>({ queryKey: ["/api/preventive-maintenance-plans"] });
  const { data: pieces = [] } = useQuery<OptionPiece[]>({ queryKey: ["/api/spare-parts"] });

  /**
   * Les compteurs du plan de l'ordre en cours de clôture.
   *
   * ⚠️ La clé de requête est construite par `queryKey.join('/')` côté
   * `queryFn` par défaut de ce client : un filtre placé dans la clé comme
   * segment séparé produirait `/api/maintenance-counters/?planId=3` — un 404
   * muet. L'URL complète tient donc dans UN seul segment de clé.
   */
  const { data: compteursDuPlan = [] } = useQuery<CompteurUsage[]>({
    queryKey: [`/api/maintenance-counters?planId=${ordreACloturer?.planId ?? 0}`],
    enabled: Boolean(ordreACloturer?.planId),
  });

  // Un plan inactif ne doit pas être proposé — mais celui que l'ordre porte
  // DÉJÀ reste dans la liste, même désactivé depuis : sinon le sélecteur
  // s'afficherait vide sur une fiche existante et un simple enregistrement
  // effacerait son rattachement sans que personne ne l'ait demandé.
  const plansProposables = (planActuel: string) =>
    plans.filter((p) => p.isActive !== false || String(p.id) === planActuel);

  const nomPlan = (id: number | null) => {
    if (!id) return null;
    const p = plans.find((p) => p.id === id);
    return p ? p.planName : `Plan #${id}`;
  };

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
      /**
       * `planId` et `requiresShutdown` partent dès le POST — vérifié, le
       * handler les nomme tous les deux (gmao-routes.ts), contrairement à
       * `dueDate` / `requestedBy` / `orderType` qu'il faut compléter par PUT.
       *
       * Le rattachement au plan ne vaut QUE pour un préventif : un correctif
       * naît d'une panne, pas d'une échéance, et lui attacher un plan ferait
       * avancer à sa clôture une gamme qui n'a pas été exécutée. On n'envoie
       * donc pas la valeur si le type a changé entre-temps.
       */
      if (f.orderType === "preventive" && f.planId) corps.planId = parseInt(f.planId, 10);
      if (f.requiresShutdown) corps.requiresShutdown = true;

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
      // L'état de l'équipement change au DÉMARRAGE d'une intervention avec
      // arrêt machine : l'écran du parc doit cesser de l'annoncer en service.
      if (variables.status === "in_progress" && ordre.requiresShutdown) {
        queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      }
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  /**
   * LA CLÔTURE — distincte des autres changements de statut.
   *
   * Elle seule transmet quelque chose : consommation des pièces déclarées,
   * replanification du plan préventif, remise à zéro de ses compteurs, remise
   * en service de l'équipement. Elle seule, donc, peut être REFUSÉE pour un
   * motif de magasin (HTTP 409), et elle seule invalide les écrans du stock,
   * du préventif et du parc.
   */
  const cloturer = useMutation({
    mutationFn: ({ id, piecesUtilisees }: { id: number; piecesUtilisees: Array<{ sparePartId: number; quantity: number }> }) =>
      apiRequest(`/api/work-orders/${id}`, {
        method: "PUT",
        body: {
          status: "completed",
          // Le tableau n'est envoyé que s'il porte quelque chose : une clôture
          // sans pièces est le cas normal (tournée de graissage), et un
          // tableau vide n'a rien à dire de plus qu'une absence.
          ...(piecesUtilisees.length > 0 ? { partsUsed: piecesUtilisees } : {}),
        },
      }),
    onSuccess: (ordre: OrdreTravail, variables) => {
      rafraichir();
      // Ces quatre écrans lisent ce que la clôture vient d'écrire. Sans ces
      // invalidations, l'utilisateur voit un stock, une échéance et un état
      // d'équipement périmés — et conclut que la clôture n'a rien fait, ce qui
      // était précisément le défaut d'avant.
      queryClient.invalidateQueries({ queryKey: ["/api/spare-parts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/preventive-maintenance-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      // Les compteurs sont lus avec leur filtre DANS la clé
      // (`?planId=…`) : un `queryKey` exact ne les atteindrait pas. On
      // invalide donc par préfixe de chaîne.
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/maintenance-counters"),
      });
      if (ordreConsulte?.id === variables.id) setOrdreConsulte(ordre);
      fermerCloture();
      toast({
        title: "Ordre de travail clôturé",
        description: variables.piecesUtilisees.length > 0
          ? `${variables.piecesUtilisees.length} référence(s) sortie(s) du magasin.`
          : "Aucune pièce déclarée.",
      });
    },
    onError: (e: Error) => {
      const refus = lireRefusStock(e);
      if (refus) {
        // Le refus reste DANS la boîte de dialogue, avec la liste des manques :
        // l'utilisateur doit pouvoir corriger ses quantités sans tout ressaisir.
        setManques(refus);
        return;
      }
      toast({ title: "Clôture refusée", description: e.message, variant: "destructive" });
    },
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

  function ouvrirCloture(ordre: OrdreTravail) {
    setOrdreACloturer(ordre);
    setQuantites({});
    setManques(null);
  }

  function fermerCloture() {
    setOrdreACloturer(null);
    setQuantites({});
    setManques(null);
  }

  /**
   * Les quantités saisies, en entiers, sans les lignes laissées vides ou à
   * zéro. Le serveur refuse une quantité non entière ou nulle ; les écarter
   * ici évite un 400 pour une ligne que l'utilisateur n'a tout simplement pas
   * remplie.
   */
  function piecesDeclarees(): Array<{ sparePartId: number; quantity: number }> {
    return Object.entries(quantites)
      .map(([id, valeur]) => ({ sparePartId: Number(id), quantity: Number(valeur) }))
      .filter((p) => Number.isInteger(p.quantity) && p.quantity > 0);
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
      planId: ordre.planId ? String(ordre.planId) : "",
      requiresShutdown: ordre.requiresShutdown === true,
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
          // `null` explicite et non `undefined` : PUT recopie le corps, donc
          // `undefined` laisserait l'ancien rattachement en place. Il faut
          // pouvoir DÉTACHER un ordre de son plan, et passer son type de
          // préventif à correctif doit le détacher.
          planId: formulaire.orderType === "preventive" && formulaire.planId
            ? parseInt(formulaire.planId, 10)
            : null,
          requiresShutdown: formulaire.requiresShutdown,
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

      {/* ─── Créer, ou signaler ───────────────────────────────────────────
          Créer un ordre engage la planification et le budget : le serveur
          l'exige désormais d'un chef d'équipe au moins
          (gmao-routes.ts, même niveau que l'arbitrage d'une demande).

          En dessous, on NE MASQUE PAS en silence : on remplace le bouton par
          le geste qui revient à l'utilisateur. Cet écran a déjà eu le défaut
          inverse — la corbeille montrée à tout le monde, et un « Impossible de
          supprimer » sans raison. Un bouton absent sans explication est la
          même faute, en plus discret. */}
      <div className="flex justify-end">
        {peutCreerOrdre ? (
          <ActionPrincipale onClick={ouvrirCreation}>
            <Plus className="h-4 w-4" />
            Nouvel ordre de travail
          </ActionPrincipale>
        ) : (
          <div className="border border-rule bg-paper p-3 text-sm max-w-xl">
            <p className="text-ink">
              Créer un ordre de travail engage la planification et le budget : cela demande au
              moins un chef d'équipe.
            </p>
            <p className="text-ink-mute mt-1">
              Pour signaler ce que vous avez constaté,{" "}
              <Link
                href="/demandes-intervention"
                className="text-signal underline underline-offset-2 hover:text-ink"
              >
                créez une demande d'intervention
              </Link>{" "}
              — la maintenance l'arbitrera.
            </p>
          </div>
        )}
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
              ? peutCreerOrdre
                ? "Un ordre de travail porte une demande, une priorité et un responsable. C'est lui qui trace l'intervention, de la demande au retour d'expérience."
                : "Un ordre de travail porte une demande, une priorité et un responsable. Le créer engage la planification et le budget : cela demande au moins un chef d'équipe. Signalez votre constat par une demande d'intervention, que la maintenance arbitrera."
              : "Élargissez la recherche, ou remettez les filtres de statut et de priorité sur « tous »."
          }
          action={
            ordres.length === 0 ? (
              peutCreerOrdre ? (
                <ActionPrincipale onClick={ouvrirCreation}>
                  <Plus className="h-4 w-4" />
                  Créer le premier ordre
                </ActionPrincipale>
              ) : (
                // L'écran vide mène au geste possible, et non à une impasse.
                <ActionPrincipale href="/demandes-intervention">
                  <Plus className="h-4 w-4" />
                  Signaler une intervention
                </ActionPrincipale>
              )
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
                        onClick={() => ouvrirCloture(ordre)}
                        disabled={cloturer.isPending}
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

              {/* ─── Plan préventif ──────────────────────────────────────
                  Affiché UNIQUEMENT pour un préventif. C'est ce rattachement
                  qui permet à la clôture de replanifier l'échéance et de
                  remettre à zéro les compteurs du plan ; sans lui, exécuter
                  une gamme ne la fait pas avancer. Le champ reste facultatif :
                  un préventif ponctuel, hors gamme, est légitime. */}
              {formulaire.orderType === "preventive" && (
                <div className="md:col-span-2">
                  <Label htmlFor="ot-plan">Plan préventif (facultatif)</Label>
                  <select
                    id="ot-plan"
                    value={formulaire.planId}
                    onChange={(e) => setFormulaire({ ...formulaire, planId: e.target.value })}
                    className={CLASSE_CHAMP}
                    aria-describedby="ot-plan-aide"
                  >
                    <option value="">Aucun plan — intervention ponctuelle</option>
                    {plansProposables(formulaire.planId).map((p) => (
                      <option key={p.id} value={p.id}>{libellePlan(p)}</option>
                    ))}
                  </select>
                  <p id="ot-plan-aide" className="text-xs text-ink-mute mt-1">
                    {plans.length === 0
                      ? "Aucun plan de maintenance préventive enregistré."
                      : "À la clôture de cet ordre, l'échéance du plan avancera d'une période et ses compteurs d'usage repartiront de zéro."}
                  </p>
                </div>
              )}

              {/* ─── Arrêt machine ───────────────────────────────────────
                  Une case, et non une bascule automatique sur tout ordre :
                  une tournée de graissage ou un relevé vibratoire se font
                  machine en marche, et les compter comme un arrêt
                  déclarerait indisponible un équipement qui produit. */}
              <div className="md:col-span-2 border border-rule bg-paper p-3">
                <label htmlFor="ot-arret" className="flex items-start gap-3 cursor-pointer">
                  <input
                    id="ot-arret"
                    type="checkbox"
                    checked={formulaire.requiresShutdown}
                    onChange={(e) => setFormulaire({ ...formulaire, requiresShutdown: e.target.checked })}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-signal"
                    aria-describedby="ot-arret-aide"
                  />
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-ink">Intervention avec arrêt machine</span>
                    <span id="ot-arret-aide" className="block text-xs text-ink-mute mt-1">
                      L'équipement passera « en maintenance » au démarrage de l'intervention,
                      et ne reviendra « en service » à la clôture que s'il ne reste aucun autre
                      ordre ouvert avec arrêt sur lui. À ne pas cocher pour une intervention
                      réalisable machine en marche.
                    </span>
                  </span>
                </label>
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

      {/* ─── Clôture : déclaration des pièces consommées ──────────────────
          Les pièces ne peuvent venir que d'ici. Aucune table ne porte les
          pièces d'un ordre de travail — ni prévues, ni réservées — et
          `maintenance_reports.parts_used` est écrite après, donc trop tard
          pour décrémenter. C'est aussi la pratique du métier : on déclare ce
          qu'on a monté, pas ce qu'on avait prévu de monter. */}
      {ordreACloturer && (
        <div
          className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-cloture-ot"
        >
          <div className="bg-white border border-rule w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4 gap-4">
              <div className="min-w-0">
                <p className="font-mono text-sm text-ink-mute">{ordreACloturer.orderNumber}</p>
                <h2 id="titre-cloture-ot" className="font-serif text-page text-ink mt-1">
                  Clôturer l'intervention
                </h2>
              </div>
              <Button variant="ghost" size="sm" onClick={fermerCloture} aria-label="Fermer">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {/* Ce que la clôture va transmettre, annoncé AVANT de la demander.
                L'utilisateur doit savoir qu'il ne change pas qu'un statut. */}
            <div className="border border-rule bg-paper p-3 mb-5 text-sm text-ink">
              <p className="font-medium">Cette clôture va :</p>
              <ul className="mt-2 space-y-1 text-ink-mute">
                <li>• enregistrer la date de fin d'intervention ;</li>
                {ordreACloturer.planId && (
                  <li>
                    • faire avancer l'échéance du plan
                    {nomPlan(ordreACloturer.planId) ? ` « ${nomPlan(ordreACloturer.planId)} » ` : " "}
                    d'une période ;
                  </li>
                )}
                {ordreACloturer.requiresShutdown && (
                  <li>• remettre l'équipement en service, s'il ne reste aucun autre arrêt ouvert ;</li>
                )}
                <li>• sortir du magasin les pièces déclarées ci-dessous.</li>
              </ul>
            </div>

            {/* ─── Compteurs d'usage du plan ────────────────────────────
                Le relevé est montré AVANT la clôture, avec la valeur qu'il
                prendra après. C'est le seul endroit du produit où un compteur
                d'usage est lisible : aucune route ne les servait avant ce lot,
                et aucun écran ne les affiche. Sans cet encart, la remise à
                zéro serait un effet invisible, donc invérifiable — et un
                effet invisible sur un relevé d'usage, personne ne le découvre
                avant de s'étonner qu'une échéance soit passée. */}
            {compteursDuPlan.length > 0 && (
              <div className="border border-rule p-3 mb-5">
                <p className="text-sm font-medium text-ink">Compteurs d'usage du plan</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {compteursDuPlan.map((c) => {
                    const unite = UNITE_COMPTEUR[c.counterType] ?? c.counterType;
                    const apres = c.lastResetValue ?? 0;
                    const atteint = c.thresholdValue != null && (c.currentValue ?? 0) >= c.thresholdValue;
                    return (
                      <li key={c.id} className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-ink">{c.description || `Compteur ${unite}`} :</span>
                        <span className={atteint ? "text-etat-critique-texte font-medium" : "text-ink"}>
                          {(c.currentValue ?? 0).toLocaleString("fr-FR")} {unite}
                        </span>
                        {c.thresholdValue != null && (
                          <span className="text-ink-mute text-xs">
                            / {c.thresholdValue.toLocaleString("fr-FR")} {unite}
                            {atteint ? " — échéance atteinte" : ""}
                          </span>
                        )}
                        <span className="text-ink-mute">
                          → {apres.toLocaleString("fr-FR")} {unite} après clôture
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Le refus pour stock insuffisant s'affiche ICI, sur les lignes
                concernées : l'utilisateur corrige ses quantités sans ressaisir
                le reste. Un toast aurait disparu avant qu'il n'ait fini de
                lire quelle référence manquait. */}
            {manques && (
              <div className="border border-etat-critique-filet bg-etat-critique-fond p-4 mb-5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-etat-critique-texte shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-etat-critique-texte">
                      Clôture refusée — le magasin ne peut pas honorer cette déclaration
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-etat-critique-texte">
                      {manques.map((m) => (
                        <li key={m.sparePartId}>
                          <span className="font-mono">{m.partNumber}</span> — {m.partName} :
                          demandé {m.demande}, disponible {m.disponible}{" "}
                          (manque {m.manque})
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm text-etat-critique-texte mt-2">
                      Rien n'a été écrit : l'ordre est toujours ouvert et le stock n'a pas bougé.
                      Corrigez les quantités, ou régularisez l'inventaire depuis le magasin.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <p className="text-sm font-medium text-ink mb-2">Pièces consommées</p>
            {pieces.length === 0 ? (
              <p className="text-sm text-ink-mute border border-rule p-3">
                Aucune pièce détachée au magasin. La clôture reste possible sans déclaration.
              </p>
            ) : (
              <div className="border border-rule divide-y divide-rule max-h-72 overflow-y-auto">
                {pieces.map((piece) => {
                  const manquePiece = manques?.find((m) => m.sparePartId === piece.id);
                  return (
                    <div
                      key={piece.id}
                      className={`flex items-center gap-3 p-3 ${manquePiece ? "bg-etat-critique-fond" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink truncate">{piece.partName}</p>
                        <p className="text-xs text-ink-mute font-mono">
                          {piece.partNumber} · stock {piece.currentStock ?? 0}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        // `max` borne la saisie sur le stock connu, mais ne
                        // remplace PAS le contrôle du serveur : la valeur
                        // affichée peut être périmée, et c'est la transaction
                        // qui tranche sous verrou.
                        max={piece.currentStock ?? undefined}
                        value={quantites[piece.id] ?? ""}
                        onChange={(e) => setQuantites({ ...quantites, [piece.id]: e.target.value })}
                        placeholder="0"
                        aria-label={`Quantité consommée de ${piece.partName}`}
                        className="w-24 border-rule shrink-0"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={fermerCloture}>Annuler</Button>
              <Button
                onClick={() => cloturer.mutate({ id: ordreACloturer.id, piecesUtilisees: piecesDeclarees() })}
                disabled={cloturer.isPending}
                className="bg-ink text-white hover:bg-signal"
              >
                {cloturer.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                {piecesDeclarees().length > 0
                  ? `Clôturer et sortir ${piecesDeclarees().length} référence(s)`
                  : "Clôturer sans pièces"}
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
                {/* Le plan et l'arrêt machine décident de ce que la clôture va
                    transmettre. Les cacher reviendrait à faire dépendre d'un
                    champ invisible l'avancement d'une échéance et la remise en
                    service d'une machine. */}
                <div>
                  <Label className="text-sm text-ink-soft">Plan préventif</Label>
                  <p className="text-ink">
                    {ordreConsulte.planId
                      ? nomPlan(ordreConsulte.planId)
                      : "Aucun — la clôture ne replanifiera rien"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-ink-soft">Arrêt machine</Label>
                  <p className="text-ink">
                    {ordreConsulte.requiresShutdown
                      ? "Oui — l'équipement est immobilisé pendant l'intervention"
                      : "Non — réalisable machine en marche"}
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
                    /**
                     * « Terminé » passe par la BOÎTE DE CLÔTURE, comme le
                     * bouton « Terminer » de la vignette. C'était le second
                     * chemin vers `completed`, et le laisser muter directement
                     * donnait deux clôtures aux effets différents : par ici,
                     * aucune pièce ne pouvait être déclarée et un refus de
                     * magasin n'aurait eu nulle part où s'afficher. Deux
                     * chemins pour un même acte, aux conséquences inégales,
                     * c'est exactement la forme de défaut que cet écran a déjà
                     * eue une fois (deux implémentations d'ordres de travail).
                     */
                    onChange={(e) => {
                      if (e.target.value === "completed") {
                        ouvrirCloture(ordreConsulte);
                        return;
                      }
                      changerStatut.mutate({ id: ordreConsulte.id, status: e.target.value });
                    }}
                    disabled={changerStatut.isPending || cloturer.isPending}
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
