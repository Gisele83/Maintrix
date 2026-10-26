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
  Gauge, Plus, X, Loader2, History, RotateCcw, Edit, Trash2, AlertCircle, Search,
} from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPTEURS D'USAGE — SUIVI ET RELEVÉS
 * ═══════════════════════════════════════════════════════════════════
 *
 * CE QUI ÉTAIT, ET MESURÉ
 * ───────────────────────────────────────────────────────────────────
 * Le module des compteurs était écrit en entier et joignable par rien.
 * Recensement du 2026-10-26 : aucune route du serveur ne servait
 * `maintenance_counters`, et six méthodes de stockage n'avaient aucun appelant
 * — dont `incrementCounter()`. Un compteur pouvait être créé (le formulaire de
 * plan préventif en envoie un) mais jamais consulté, jamais relevé, jamais
 * corrigé. Il ne franchissait son seuil que si quelqu'un éditait la base à la
 * main, et la remise à zéro à la clôture d'un ordre de travail n'avait alors
 * rien à remettre.
 *
 * POURQUOI L'INCRÉMENTATION EST UN RELEVÉ SAISI
 * ───────────────────────────────────────────────────────────────────
 * La colonne `increment_rate` invitait à faire croître les compteurs tout
 * seuls, à tant d'heures par jour. Ce serait un usage INVENTÉ, et il
 * déclencherait de vraies alertes de maintenance sur de vraies machines. Rien
 * dans la plateforme ne mesure le temps de marche réel d'un équipement.
 *
 * Le relevé saisi est donc la seule source honnête — et c'est la pratique : un
 * compteur horaire se lit sur la machine.
 *
 * LE PIÈGE DE LA SAISIE, ET CE QUI LE DÉSAMORCE
 * ───────────────────────────────────────────────────────────────────
 * On demande un ÉCART (« 40 h depuis le dernier relevé »), pas la valeur
 * absolue affichée par la machine. Un opérateur qui saisirait 1 240 au lieu de
 * 40 porterait le compteur très au-delà de son seuil et déclencherait une
 * alerte fausse — exactement le noyage d'alarmes que cette plateforme corrige
 * ailleurs.
 *
 * Trois choses le désamorcent, et elles sont dans cet écran :
 *   • le champ est nommé « usage depuis le dernier relevé », pas « relevé » ;
 *   • la date du dernier relevé est affichée à côté, pour que l'écart ait une
 *     borne de départ lisible ;
 *   • la valeur RÉSULTANTE est calculée sous le champ, avec son seuil, avant
 *     toute confirmation. On voit donc ce qu'on va écrire.
 */

// ─── Types : les champs réellement servis par /api/maintenance-counters ──────
interface Compteur {
  id: number;
  equipmentId: number | null;
  equipmentName: string | null;
  counterType: string;
  description: string | null;
  currentValue: number | null;
  thresholdValue: number | null;
  lastResetValue: number | null;
  lastResetDate: string | null;
  warningThresholdPct: number | null;
  alertLevel: string | null;
  maintenanceType: string | null;
  planId: number | null;
  isActive: boolean | null;
  updatedAt: string | null;
  /**
   * L'ordre de travail préventif déjà ouvert pour la gamme de ce compteur.
   *
   * Sans lui, un compteur annonce « échéance atteinte » sans dire qu'un ordre
   * a déjà été créé pour elle — et l'exploitant en saisit un second à la main,
   * pour un travail déjà programmé.
   */
  ordreTravailOuvert: { id: number; orderNumber: string } | null;
}
interface LigneHistorique {
  genre: "releve" | "remise_a_zero";
  date: string | null;
  valeurAvant: number;
  valeurApres: number;
  usage: number | null;
  motif: string | null;
  parQui: number | null;
  ordreTravail: number | null;
}
interface OptionEquipement { id: number; equipmentName: string; equipmentId?: string }
interface OptionPlan { id: number; planName: string; isActive: boolean | null }

/** Unités, telles que `counter_type` les nomme. */
const UNITES: Record<string, string> = {
  hours: "h", cycles: "cycles", kilometers: "km", units: "unités",
};
const TYPES_COMPTEUR = [
  { id: "hours", libelle: "Heures de fonctionnement" },
  { id: "cycles", libelle: "Cycles d'utilisation" },
  { id: "kilometers", libelle: "Kilomètres parcourus" },
  { id: "units", libelle: "Unités produites" },
] as const;

const CLASSE_CHAMP =
  "w-full h-10 px-3 border border-rule bg-white text-sm text-ink focus:outline-none " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal";

const unite = (type: string) => UNITES[type] ?? type;
const nombre = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/**
 * Part du seuil déjà consommée, en pourcentage — ou `null`.
 *
 * `null` quand il n'y a pas de seuil, et c'est le point important : un
 * compteur sans seuil n'est pas « à 0 % », il est SANS ÉCHÉANCE. Rendre zéro
 * ici afficherait une jauge rassurante là où il n'y a aucune mesure.
 */
function partConsommee(c: Compteur): number | null {
  if (!c.thresholdValue || c.thresholdValue <= 0) return null;
  return ((c.currentValue ?? 0) / c.thresholdValue) * 100;
}

/**
 * Registre d'état d'un compteur, déduit de sa part consommée.
 *
 * Le seuil d'alerte vient de `warningThresholdPct` du compteur, et non d'une
 * constante de cet écran : c'est un paramètre par compteur, et le serveur
 * l'utilise déjà pour décider de son `alertLevel`. Une constante ici
 * donnerait une pastille qui contredit l'alerte réellement émise.
 */
function registre(c: Compteur): RegistreEtat {
  if (c.isActive === false) return "neutre";
  const part = partConsommee(c);
  if (part == null) return "neutre";
  const alerteA = c.warningThresholdPct ?? 90;
  if (part >= 100) return "critique";
  if (part >= alerteA) return "alerte";
  return "nominal";
}
function libelleEtat(c: Compteur): string {
  if (c.isActive === false) return "Suivi suspendu";
  const part = partConsommee(c);
  if (part == null) return "Sans échéance";
  if (part >= 100) return "Échéance atteinte";
  if (part >= (c.warningThresholdPct ?? 90)) return "Bientôt due";
  return "Dans les limites";
}

const jour = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const jourHeure = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

// ═══════════════════════════════════════════════════════════════════
export default function CompteursPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<"tous" | "dus" | "actifs" | "suspendus">("tous");
  const [compteurReleve, setCompteurReleve] = useState<Compteur | null>(null);
  const [usageSaisi, setUsageSaisi] = useState("");
  const [noteReleve, setNoteReleve] = useState("");
  const [compteurHistorique, setCompteurHistorique] = useState<Compteur | null>(null);
  const [compteurRemise, setCompteurRemise] = useState<Compteur | null>(null);
  const [motifRemise, setMotifRemise] = useState("");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [compteurEdite, setCompteurEdite] = useState<Compteur | null>(null);
  const [suppression, setSuppression] = useState<Compteur | null>(null);

  /**
   * Les droits reproduisent ceux du serveur, par le référentiel de rôles et
   * non par comparaison de chaînes : `owner` est au-dessus d'`admin` et serait
   * refusé par une égalité littérale. Montrer un bouton que le serveur refuse
   * ne donne qu'un « droits insuffisants » sans raison.
   */
  const peutRegler = auMoins(user?.role, "team_leader");
  const peutSupprimer = auMoins(user?.role, "technical_director");

  const { data: compteurs = [], isLoading, error } = useQuery<Compteur[]>({
    queryKey: ["/api/maintenance-counters"],
  });
  const { data: equipements = [] } = useQuery<OptionEquipement[]>({ queryKey: ["/api/equipment"] });
  const { data: plans = [] } = useQuery<OptionPlan[]>({ queryKey: ["/api/preventive-maintenance-plans"] });

  // L'URL complète tient dans UN seul segment de clé : la `queryFn` par défaut
  // fait `queryKey.join("/")`, donc un filtre en segment séparé produirait
  // `/api/maintenance-counters/3/history/` et un 404 muet.
  const { data: historique = [], isLoading: historiqueEnCours } = useQuery<LigneHistorique[]>({
    queryKey: [`/api/maintenance-counters/${compteurHistorique?.id ?? 0}/history`],
    enabled: Boolean(compteurHistorique),
  });

  const rafraichir = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/maintenance-counters"] });
    // L'historique est lu sous une clé qui porte l'identifiant : une clé
    // exacte ne l'atteindrait pas.
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/maintenance-counters/"),
    });
    // Un relevé peut faire franchir un seuil, donc produire une alerte ET un
    // ordre de travail préventif. Sans cette seconde invalidation, l'écran des
    // ordres de travail resterait périmé et l'ordre qui vient de naître
    // paraîtrait absent.
    queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
  };

  const releverMutation = useMutation({
    mutationFn: ({ id, usage, notes }: { id: number; usage: number; notes: string }) =>
      apiRequest(`/api/maintenance-counters/${id}/readings`, {
        method: "POST",
        body: { usage, ...(notes.trim() ? { notes: notes.trim() } : {}) },
      }),
    onSuccess: (reponse: { compteur: Compteur }) => {
      rafraichir();
      const c = reponse.compteur;
      const part = partConsommee(c);
      const seuilAlerte = c.warningThresholdPct ?? 90;
      // Le message dit ce qui VIENT DE SE PASSER, pas seulement que la saisie
      // est prise : si le relevé a déclenché un ordre de travail, c'est la
      // seule information qui compte pour la suite du travail.
      const aFranchi = part != null && part >= seuilAlerte;
      toast({
        title: "Relevé enregistré",
        description: `${c.description || "Compteur"} : ${nombre(c.currentValue)} ${unite(c.counterType)}`
          + (part != null && part >= 100 ? " — échéance atteinte." : "")
          + (aFranchi && c.planId
            ? " Un ordre de travail préventif a été créé, ou existait déjà pour cette gamme."
            : ""),
      });
      fermerReleve();
    },
    onError: (e: Error) => toast({ title: "Relevé refusé", description: e.message, variant: "destructive" }),
  });

  const remiseMutation = useMutation({
    mutationFn: ({ id, motif }: { id: number; motif: string }) =>
      apiRequest(`/api/maintenance-counters/${id}/reset`, { method: "POST", body: { motif } }),
    onSuccess: () => {
      rafraichir();
      toast({ title: "Compteur remis à zéro" });
      setCompteurRemise(null);
      setMotifRemise("");
    },
    onError: (e: Error) => toast({ title: "Remise à zéro refusée", description: e.message, variant: "destructive" }),
  });

  const enregistrerMutation = useMutation({
    mutationFn: ({ id, corps }: { id: number | null; corps: Record<string, unknown> }) =>
      id
        ? apiRequest(`/api/maintenance-counters/${id}`, { method: "PUT", body: corps })
        : apiRequest("/api/maintenance-counters", { method: "POST", body: corps }),
    onSuccess: () => {
      rafraichir();
      toast({ title: compteurEdite ? "Compteur modifié" : "Compteur créé" });
      fermerFormulaire();
    },
    onError: (e: Error) => toast({ title: "Enregistrement refusé", description: e.message, variant: "destructive" }),
  });

  const supprimerMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/maintenance-counters/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      rafraichir();
      toast({ title: "Compteur supprimé" });
      setSuppression(null);
    },
    onError: (e: Error) => {
      setSuppression(null);
      toast({ title: "Suppression refusée", description: e.message, variant: "destructive" });
    },
  });

  // ─── Formulaire de création / modification ────────────────────────
  const [form, setForm] = useState({
    equipmentId: "", counterType: "hours", description: "",
    currentValue: "0", thresholdValue: "", warningThresholdPct: "90", planId: "",
  });

  function fermerFormulaire() {
    setFormulaireOuvert(false);
    setCompteurEdite(null);
    setForm({ equipmentId: "", counterType: "hours", description: "", currentValue: "0", thresholdValue: "", warningThresholdPct: "90", planId: "" });
  }
  function ouvrirCreation() {
    fermerFormulaire();
    setFormulaireOuvert(true);
  }
  function ouvrirEdition(c: Compteur) {
    setCompteurEdite(c);
    setForm({
      equipmentId: c.equipmentId ? String(c.equipmentId) : "",
      counterType: c.counterType,
      description: c.description || "",
      currentValue: String(c.currentValue ?? 0),
      thresholdValue: c.thresholdValue != null ? String(c.thresholdValue) : "",
      warningThresholdPct: String(c.warningThresholdPct ?? 90),
      planId: c.planId ? String(c.planId) : "",
    });
    setFormulaireOuvert(true);
  }

  function soumettreFormulaire() {
    if (!form.description.trim() || !form.thresholdValue) {
      toast({ title: "Champs obligatoires", description: "Le libellé et le seuil sont requis.", variant: "destructive" });
      return;
    }
    if (compteurEdite) {
      // La valeur courante n'est PAS modifiable : le serveur la refuse, et
      // c'est voulu — faire bouger un usage par une édition de champ le
      // laisserait changer sans trace. On relève, ou on remet à zéro.
      enregistrerMutation.mutate({
        id: compteurEdite.id,
        corps: {
          description: form.description.trim(),
          counterType: form.counterType,
          thresholdValue: Number(form.thresholdValue),
          warningThresholdPct: Number(form.warningThresholdPct),
        },
      });
      return;
    }
    if (!form.equipmentId) {
      toast({ title: "Champs obligatoires", description: "L'équipement est requis.", variant: "destructive" });
      return;
    }
    enregistrerMutation.mutate({
      id: null,
      corps: {
        equipmentId: Number(form.equipmentId),
        counterType: form.counterType,
        description: form.description.trim(),
        currentValue: Number(form.currentValue || 0),
        thresholdValue: Number(form.thresholdValue),
        warningThresholdPct: Number(form.warningThresholdPct),
        ...(form.planId ? { planId: Number(form.planId) } : {}),
      },
    });
  }

  function fermerReleve() {
    setCompteurReleve(null);
    setUsageSaisi("");
    setNoteReleve("");
  }

  // ─── Filtrage ─────────────────────────────────────────────────────
  const filtres = compteurs.filter((c) => {
    const terme = recherche.toLowerCase();
    const correspond =
      (c.description || "").toLowerCase().includes(terme) ||
      (c.equipmentName || "").toLowerCase().includes(terme) ||
      (c.maintenanceType || "").toLowerCase().includes(terme);
    if (!correspond) return false;
    const part = partConsommee(c);
    if (filtre === "dus") return c.isActive !== false && part != null && part >= (c.warningThresholdPct ?? 90);
    if (filtre === "actifs") return c.isActive !== false;
    if (filtre === "suspendus") return c.isActive === false;
    return true;
  });

  const actifs = compteurs.filter((c) => c.isActive !== false);
  const dus = actifs.filter((c) => { const p = partConsommee(c); return p != null && p >= 100; });
  const bientot = actifs.filter((c) => {
    const p = partConsommee(c);
    return p != null && p >= (c.warningThresholdPct ?? 90) && p < 100;
  });
  const sansSeuil = actifs.filter((c) => partConsommee(c) == null);

  // Valeur résultante du relevé en cours de saisie — c'est ce qui empêche de
  // confondre un écart avec un relevé absolu.
  const usageNombre = Number(usageSaisi);
  const usageValide = Number.isFinite(usageNombre) && usageNombre > 0;
  const valeurApres = compteurReleve && usageValide
    ? (compteurReleve.currentValue ?? 0) + usageNombre
    : null;
  const franchiraSeuil =
    compteurReleve?.thresholdValue != null && valeurApres != null &&
    valeurApres >= compteurReleve.thresholdValue &&
    (compteurReleve.currentValue ?? 0) < compteurReleve.thresholdValue;

  return (
    <AppShell filAriane={[{ libelle: "GMAO", href: "/gmao" }, { libelle: "Compteurs d'usage" }]} largeur="large">
      <div className="space-y-6">
        <EnTetePage
          surTitre="GMAO"
          titre="Compteurs d'usage"
          phrase="Les heures, cycles et kilomètres qui déclenchent la maintenance périodique. Les relevés sont saisis : rien ne les fabrique."
          action={
            peutRegler ? (
              <ActionPrincipale onClick={ouvrirCreation}>
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />Nouveau compteur
              </ActionPrincipale>
            ) : undefined
          }
        />

        <RangeeIndicateurs>
          <Indicateur
            libelle="Suivis"
            valeur={String(actifs.length)}
            precision={actifs.length === 0 ? "aucun compteur actif" : `sur ${compteurs.length} enregistré(s)`}
            icone={Gauge}
          />
          <Indicateur
            libelle="Échéance atteinte"
            valeur={String(dus.length)}
            precision={dus.length === 0 ? "aucune échéance dépassée" : "intervention à programmer"}
            alerte={dus.length > 0}
          />
          <Indicateur
            libelle="Bientôt dues"
            valeur={String(bientot.length)}
            precision={bientot.length === 0 ? "rien en approche" : "au-delà du seuil d'alerte"}
            alerte={bientot.length > 0}
          />
          <Indicateur
            libelle="Sans échéance"
            valeur={String(sansSeuil.length)}
            // Un compteur sans seuil ne déclenche rien : il compte dans le vide.
            precision={sansSeuil.length === 0 ? "tous ont un seuil" : "aucun seuil défini"}
          />
        </RangeeIndicateurs>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[16rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-mute" aria-hidden="true" />
            <Input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher par libellé, équipement ou gamme..."
              aria-label="Rechercher un compteur"
              className="pl-9 border-rule"
            />
          </div>
          <select
            value={filtre}
            onChange={(e) => setFiltre(e.target.value as typeof filtre)}
            aria-label="Filtrer les compteurs"
            className={CLASSE_CHAMP + " sm:w-64"}
          >
            <option value="tous">Tous les compteurs</option>
            <option value="dus">À échéance ou bientôt</option>
            <option value="actifs">Suivis</option>
            <option value="suspendus">Suivi suspendu</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-5 w-5 animate-spin text-ink-mute" aria-hidden="true" />
          </div>
        ) : error ? (
          <div className="border border-etat-critique-filet bg-etat-critique-fond p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-etat-critique-texte shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-etat-critique-texte">
              Les compteurs n'ont pas pu être chargés. {(error as Error).message}
            </p>
          </div>
        ) : filtres.length === 0 ? (
          <EtatVide
            icone={Gauge}
            titre={compteurs.length === 0 ? "Aucun compteur d'usage" : "Aucun compteur ne correspond"}
            phrase={
              compteurs.length === 0
                ? "Un compteur mesure l'usage d'un équipement — heures, cycles, kilomètres — et déclenche sa maintenance périodique quand il atteint son seuil. Les relevés sont saisis par les techniciens."
                : "Modifiez la recherche ou le filtre."
            }
            action={
              compteurs.length === 0 && peutRegler ? (
                <ActionPrincipale onClick={ouvrirCreation}>
                  <Plus className="h-4 w-4 mr-2" aria-hidden="true" />Créer un compteur
                </ActionPrincipale>
              ) : undefined
            }
          />
        ) : (
          <div className="border border-rule bg-white divide-y divide-rule">
            {filtres.map((c) => {
              const part = partConsommee(c);
              const reg = registre(c);
              const u = unite(c.counterType);
              return (
                <div key={c.id} className="p-4 flex flex-wrap gap-4 items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-ink font-medium">{c.description || `Compteur ${u}`}</p>
                      <PuceEtat registre={reg}>{libelleEtat(c)}</PuceEtat>
                    </div>
                    <p className="text-sm text-ink-mute mt-0.5">
                      {c.equipmentName || "Équipement non précisé"}
                      {c.maintenanceType ? ` · ${c.maintenanceType}` : ""}
                    </p>

                    <div className="flex items-baseline gap-2 mt-2 flex-wrap">
                      <span className="font-serif text-2xl text-ink leading-none">{nombre(c.currentValue)} {u}</span>
                      {c.thresholdValue != null ? (
                        <span className="text-sm text-ink-mute">
                          / {nombre(c.thresholdValue)} {u}
                          {part != null ? ` — ${part.toFixed(0)} %` : ""}
                        </span>
                      ) : (
                        // Pas de jauge rassurante quand il n'y a rien à mesurer.
                        <span className="text-sm text-ink-mute">aucun seuil défini</span>
                      )}
                    </div>

                    {part != null && (
                      <div className="w-full max-w-sm bg-paper border border-rule h-2 mt-2" role="presentation">
                        <div
                          className={`h-2 ${reg === "critique" ? "bg-etat-critique-vif" : reg === "alerte" ? "bg-etat-alerte-vif" : "bg-etat-nominal-vif"}`}
                          style={{ width: `${Math.min(part, 100)}%` }}
                        />
                      </div>
                    )}

                    <p className="text-xs text-ink-mute mt-2">
                      Dernière remise à zéro : {jour(c.lastResetDate)}
                      {c.planId ? " · rattaché à une gamme préventive" : " · aucune gamme rattachée"}
                    </p>

                    {/* L'ordre de travail né de ce compteur. C'est le bout de la
                        boucle : le franchissement du seuil l'a créé, et sa
                        clôture remettra ce compteur à zéro. Le montrer évite
                        qu'on en saisisse un second à la main. */}
                    {c.ordreTravailOuvert && (
                      <p className="text-sm mt-2">
                        <Link
                          href="/work-orders"
                          className="text-signal underline underline-offset-2 hover:text-ink"
                        >
                          Ordre de travail {c.ordreTravailOuvert.orderNumber} ouvert
                        </Link>
                        <span className="text-ink-mute"> — sa clôture remettra ce compteur à zéro.</span>
                      </p>
                    )}

                    {/* Le cas qui empêche la boucle de se fermer, dit
                        explicitement : sans gamme, aucun ordre ne peut être
                        créé, car sa clôture n'aurait pas de quoi remettre ce
                        compteur à zéro. */}
                    {!c.planId && reg !== "neutre" && part != null && part >= (c.warningThresholdPct ?? 90) && (
                      <p className="text-sm text-etat-alerte-texte mt-2">
                        Échéance atteinte, mais aucun ordre de travail ne sera créé : ce compteur
                        n'est rattaché à aucune gamme préventive. Rattachez-le pour que la boucle
                        se ferme.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setCompteurHistorique(c)}>
                      <History className="h-3 w-3 mr-1" aria-hidden="true" />Historique
                    </Button>
                    {/* Relever est ouvert à tous : c'est le travail quotidien
                        d'un technicien. Le serveur n'exige aucun niveau. */}
                    <Button
                      size="sm"
                      onClick={() => setCompteurReleve(c)}
                      disabled={c.isActive === false}
                      title={c.isActive === false ? "Suivi suspendu : aucun relevé possible" : undefined}
                      className="bg-ink text-paper hover:bg-signal"
                    >
                      <Plus className="h-3 w-3 mr-1" aria-hidden="true" />Relever
                    </Button>
                    {peutRegler && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => ouvrirEdition(c)}>
                          <Edit className="h-3 w-3 mr-1" aria-hidden="true" />Régler
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setCompteurRemise(c)}>
                          <RotateCcw className="h-3 w-3 mr-1" aria-hidden="true" />Remettre à zéro
                        </Button>
                      </>
                    )}
                    {peutSupprimer && (
                      <Button size="sm" variant="outline" onClick={() => setSuppression(c)}>
                        <Trash2 className="h-3 w-3 mr-1" aria-hidden="true" />Supprimer
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Relevé ────────────────────────────────────────────────────── */}
      {compteurReleve && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="titre-releve">
          <div className="bg-white border border-rule w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4 gap-4">
              <div className="min-w-0">
                <p className="text-sm text-ink-mute">{compteurReleve.equipmentName || "Équipement non précisé"}</p>
                <h2 id="titre-releve" className="font-serif text-page text-ink mt-1">
                  {compteurReleve.description || "Compteur"}
                </h2>
              </div>
              <Button variant="ghost" size="sm" onClick={fermerReleve} aria-label="Fermer">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="border border-rule bg-paper p-3 text-sm text-ink-soft mb-4">
              Valeur actuelle : <strong className="text-ink">{nombre(compteurReleve.currentValue)} {unite(compteurReleve.counterType)}</strong>
              {compteurReleve.thresholdValue != null && <> · seuil {nombre(compteurReleve.thresholdValue)} {unite(compteurReleve.counterType)}</>}
              <br />
              Dernière remise à zéro : {jour(compteurReleve.lastResetDate)}
            </div>

            <div>
              {/* Le libellé dit ÉCART, pas relevé : c'est la première des trois
                  parades contre la saisie d'une valeur absolue. */}
              <Label htmlFor="releve-usage">
                Usage depuis le dernier relevé ({unite(compteurReleve.counterType)}) *
              </Label>
              <Input
                id="releve-usage"
                type="number"
                min="0"
                step="any"
                value={usageSaisi}
                onChange={(e) => setUsageSaisi(e.target.value)}
                placeholder="Ex : 40"
                aria-describedby="releve-apercu"
                className="border-rule"
              />
              {/* Deuxième parade : la valeur résultante, avant de confirmer. */}
              <p id="releve-apercu" className="text-sm mt-2">
                {valeurApres == null ? (
                  <span className="text-ink-mute">
                    Saisissez l'écart constaté, et non la valeur affichée par la machine.
                  </span>
                ) : (
                  <span className={franchiraSeuil ? "text-etat-alerte-texte" : "text-ink-soft"}>
                    Le compteur passera à <strong>{nombre(valeurApres)} {unite(compteurReleve.counterType)}</strong>
                    {compteurReleve.thresholdValue != null && <> sur {nombre(compteurReleve.thresholdValue)}</>}
                    {franchiraSeuil && " — l'échéance sera atteinte et une alerte sera émise."}
                  </span>
                )}
              </p>
            </div>

            <div className="mt-4">
              <Label htmlFor="releve-note">Note (facultatif)</Label>
              <Textarea
                id="releve-note"
                value={noteReleve}
                onChange={(e) => setNoteReleve(e.target.value)}
                placeholder="Provenance du relevé, conditions particulières."
                rows={2}
                className="border-rule"
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={fermerReleve}>Annuler</Button>
              <Button
                onClick={() => releverMutation.mutate({ id: compteurReleve.id, usage: usageNombre, notes: noteReleve })}
                disabled={!usageValide || releverMutation.isPending}
                className="bg-ink text-white hover:bg-signal"
              >
                {releverMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                Enregistrer le relevé
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Historique ────────────────────────────────────────────────── */}
      {compteurHistorique && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="titre-histo">
          <div className="bg-white border border-rule w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4 gap-4">
              <div className="min-w-0">
                <p className="text-sm text-ink-mute">{compteurHistorique.equipmentName || "Équipement non précisé"}</p>
                <h2 id="titre-histo" className="font-serif text-page text-ink mt-1">
                  {compteurHistorique.description || "Compteur"} — historique
                </h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCompteurHistorique(null)} aria-label="Fermer">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {historiqueEnCours ? (
              <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-ink-mute" aria-hidden="true" /></div>
            ) : historique.length === 0 ? (
              <p className="text-sm text-ink-mute border border-rule p-4">
                Aucun relevé ni remise à zéro enregistré pour ce compteur.
              </p>
            ) : (
              <ol className="border border-rule divide-y divide-rule">
                {historique.map((l, i) => (
                  <li key={i} className="p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <PuceEtat registre={l.genre === "remise_a_zero" ? "encours" : "neutre"}>
                        {l.genre === "remise_a_zero" ? "Remise à zéro" : "Relevé"}
                      </PuceEtat>
                      <span className="text-sm text-ink-mute">{jourHeure(l.date)}</span>
                    </div>
                    <p className="text-sm text-ink mt-1">
                      {nombre(l.valeurAvant)} → {nombre(l.valeurApres)} {unite(compteurHistorique.counterType)}
                      {l.usage != null && <> (+{nombre(l.usage)})</>}
                    </p>
                    {l.motif && <p className="text-sm text-ink-soft mt-1">{l.motif}</p>}
                    {l.ordreTravail && (
                      <p className="text-xs text-ink-mute mt-1">Ordre de travail #{l.ordreTravail}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      {/* ─── Remise à zéro manuelle ────────────────────────────────────── */}
      {compteurRemise && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="titre-remise">
          <div className="bg-white border border-rule w-full max-w-lg p-6">
            <h2 id="titre-remise" className="font-serif text-page text-ink">Remettre le compteur à zéro</h2>
            <p className="text-sm text-ink-soft mt-2">
              {compteurRemise.description || "Compteur"} — {nombre(compteurRemise.currentValue)} {unite(compteurRemise.counterType)} seront
              enregistrés dans l'historique, puis le compteur repartira de {nombre(compteurRemise.lastResetValue ?? 0)}.
            </p>
            {/* La clôture d'un OT le fait automatiquement : le dire évite une
                remise à zéro manuelle qui doublerait celle de l'intervention. */}
            {compteurRemise.planId && (
              <p className="text-sm text-ink-mute mt-2">
                Ce compteur est rattaché à une gamme préventive : la clôture d'un ordre de travail
                portant cette gamme le remet à zéro automatiquement. Cette remise manuelle sert aux
                interventions faites hors GMAO, ou à corriger une saisie.
              </p>
            )}
            <div className="mt-4">
              <Label htmlFor="remise-motif">Motif *</Label>
              <Textarea
                id="remise-motif"
                value={motifRemise}
                onChange={(e) => setMotifRemise(e.target.value)}
                placeholder="Ex : graissage réalisé hors GMAO le 12/10, relevé erroné corrigé."
                rows={2}
                className="border-rule"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => { setCompteurRemise(null); setMotifRemise(""); }}>Annuler</Button>
              <Button
                onClick={() => remiseMutation.mutate({ id: compteurRemise.id, motif: motifRemise.trim() })}
                disabled={motifRemise.trim().length < 3 || remiseMutation.isPending}
                className="bg-ink text-white hover:bg-signal"
              >
                {remiseMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                Remettre à zéro
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Création / réglage ────────────────────────────────────────── */}
      {formulaireOuvert && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="titre-form-compteur">
          <div className="bg-white border border-rule w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-6 gap-4">
              <h2 id="titre-form-compteur" className="font-serif text-page text-ink">
                {compteurEdite ? "Régler le compteur" : "Nouveau compteur d'usage"}
              </h2>
              <Button variant="ghost" size="sm" onClick={fermerFormulaire} aria-label="Fermer">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="cpt-libelle">Libellé *</Label>
                <Input
                  id="cpt-libelle"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ex : Heures depuis dernier graissage"
                  className="border-rule"
                />
              </div>

              {!compteurEdite && (
                <div>
                  <Label htmlFor="cpt-equipement">Équipement *</Label>
                  <select
                    id="cpt-equipement"
                    value={form.equipmentId}
                    onChange={(e) => setForm({ ...form, equipmentId: e.target.value })}
                    className={CLASSE_CHAMP}
                  >
                    <option value="">Sélectionner un équipement</option>
                    {equipements.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.equipmentName}{e.equipmentId ? ` (${e.equipmentId})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <Label htmlFor="cpt-type">Unité comptée</Label>
                <select
                  id="cpt-type"
                  value={form.counterType}
                  onChange={(e) => setForm({ ...form, counterType: e.target.value })}
                  className={CLASSE_CHAMP}
                >
                  {TYPES_COMPTEUR.map((t) => (
                    <option key={t.id} value={t.id}>{t.libelle}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="cpt-seuil">Périodicité — seuil ({unite(form.counterType)}) *</Label>
                <Input
                  id="cpt-seuil"
                  type="number"
                  min="0"
                  step="any"
                  value={form.thresholdValue}
                  onChange={(e) => setForm({ ...form, thresholdValue: e.target.value })}
                  placeholder="Ex : 500"
                  aria-describedby="cpt-seuil-aide"
                  className="border-rule"
                />
                <p id="cpt-seuil-aide" className="text-xs text-ink-mute mt-1">
                  L'usage au-delà duquel l'intervention est due.
                </p>
              </div>

              <div>
                <Label htmlFor="cpt-alerte">Seuil d'alerte (% du seuil)</Label>
                <Input
                  id="cpt-alerte"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={form.warningThresholdPct}
                  onChange={(e) => setForm({ ...form, warningThresholdPct: e.target.value })}
                  aria-describedby="cpt-alerte-aide"
                  className="border-rule"
                />
                <p id="cpt-alerte-aide" className="text-xs text-ink-mute mt-1">
                  À partir de quelle part du seuil prévenir, pour laisser le temps de programmer.
                </p>
              </div>

              {!compteurEdite && (
                <>
                  <div>
                    <Label htmlFor="cpt-valeur">Usage déjà accumulé ({unite(form.counterType)})</Label>
                    <Input
                      id="cpt-valeur"
                      type="number"
                      min="0"
                      step="any"
                      value={form.currentValue}
                      onChange={(e) => setForm({ ...form, currentValue: e.target.value })}
                      aria-describedby="cpt-valeur-aide"
                      className="border-rule"
                    />
                    <p id="cpt-valeur-aide" className="text-xs text-ink-mute mt-1">
                      Valeur de départ, pour reprendre un suivi existant. Ensuite, elle ne change que
                      par un relevé ou une remise à zéro.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="cpt-plan">Gamme préventive rattachée</Label>
                    <select
                      id="cpt-plan"
                      value={form.planId}
                      onChange={(e) => setForm({ ...form, planId: e.target.value })}
                      className={CLASSE_CHAMP}
                      aria-describedby="cpt-plan-aide"
                    >
                      <option value="">Aucune</option>
                      {plans.filter((p) => p.isActive !== false).map((p) => (
                        <option key={p.id} value={p.id}>{p.planName}</option>
                      ))}
                    </select>
                    <p id="cpt-plan-aide" className="text-xs text-ink-mute mt-1">
                      Rattaché à une gamme, ce compteur sera remis à zéro automatiquement à la clôture
                      d'un ordre de travail portant cette gamme.
                    </p>
                  </div>
                </>
              )}
            </div>

            {compteurEdite && (
              <p className="text-sm text-ink-mute mt-4 border border-rule bg-paper p-3">
                L'usage accumulé ({nombre(compteurEdite.currentValue)} {unite(compteurEdite.counterType)}) ne se
                modifie pas ici : il n'avance que par un relevé, et ne revient à zéro que par une remise
                à zéro. Les deux laissent une ligne dans l'historique.
              </p>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={fermerFormulaire}>Annuler</Button>
              <Button
                onClick={soumettreFormulaire}
                disabled={enregistrerMutation.isPending}
                className="bg-ink text-white hover:bg-signal"
              >
                {enregistrerMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                {compteurEdite ? "Enregistrer" : "Créer le compteur"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Suppression ───────────────────────────────────────────────── */}
      {suppression && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="titre-suppr">
          <div className="bg-white border border-rule w-full max-w-lg p-6">
            <h2 id="titre-suppr" className="font-serif text-page text-ink">Supprimer le compteur</h2>
            <p className="text-sm text-ink-soft mt-2">
              « {suppression.description || "Compteur"} » et tout son historique d'usage seront supprimés
              définitivement. L'usage accumulé de cet équipement sera perdu.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
              <Button
                onClick={() => supprimerMutation.mutate(suppression.id)}
                disabled={supprimerMutation.isPending}
                className="bg-etat-critique-vif text-white hover:bg-etat-critique-texte"
              >
                {supprimerMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                Supprimer définitivement
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
