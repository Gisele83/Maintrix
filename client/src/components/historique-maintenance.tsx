import React, { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadFile } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { type RegistreEtat } from "@/lib/etats";
import { ImportReserve, usePeutImporterEnMasse } from "@/components/import-reserve";
import {
  History, Download, Upload, FileText, Search, AlertCircle, X,
  CheckCircle, Clock, Wrench, Loader2,
} from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════════
 * HISTORIQUE DE MAINTENANCE — une seule implémentation
 * ═══════════════════════════════════════════════════════════════════
 *
 * Trois écrans portaient le nom « Historique », sur DEUX sources de données
 * différentes, et un seul montrait réellement un historique :
 *
 *   • /historique (440 l.)                    → /api/maintenance-history ✓
 *   • onglet « Historique » de la GMAO (501 l.) → RIEN : une console
 *     d'import/export, sans la moindre ligne d'historique à l'écran ;
 *   • onglet « Historique » du tableau de bord (408 l.) → /api/history.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI C'EST /api/maintenance-history QUI RESTE
 * ═══════════════════════════════════════════════════════════════════
 * Pas pour son volume : parce que l'autre est structurellement inutilisable
 * en multi-locataire.
 *
 * `/api/history` compose sa réponse à partir de `storage.getDiagnosticSessions()`,
 * qui fait `db.select().from(diagnosticSessions)` SANS filtre de locataire.
 * `antiLeakageValidator` le détecte et remplace le corps par
 * `{ error: 'CROSS_TENANT_DATA_DETECTED', … }` — à l'époque en laissant le
 * statut à 200 ; ce refus répond 403 depuis le 2026-10-21. Cela ne rend pas
 * `/api/history` utilisable : le filet n'attrape cette charge QUE parce que
 * ses lignes portent un `tenantId` au premier niveau, et il resterait aveugle
 * à la même fuite servie sous une clé ou en projection.
 *
 * Mesuré le 20/10/2026 : il a suffi d'insérer UNE session de diagnostic
 * appartenant à un second locataire pour que la réponse passe de 20
 * enregistrements à cet objet d'erreur, et que /dashboard rende une page
 * ENTIÈREMENT BLANCHE — « TypeError: a.map is not a function ». Le défaut est
 * invisible sur un jeu de données mono-locataire, ce qui explique qu'il ait
 * survécu.
 *
 * `/api/maintenance-history` construit sa réponse avec
 * `gmaoStorage.getWorkOrders(tenantId)` : correctement cloisonnée. Elle est en
 * outre plus riche sur l'intervention elle-même — nom du technicien résolu
 * depuis user_profiles, pièces consommées lues dans les mouvements de stock,
 * coût.
 *
 * CE QUI EST PERDU, ET QUI DOIT REVENIR : `/api/history` agrégeait aussi les
 * sessions de diagnostic et les exécutions de plans préventifs des 90 derniers
 * jours. Aucune route cloisonnée ne les expose aujourd'hui — il n'existe pas de
 * `GET /api/diagnostic-sessions`. C'est un chantier serveur, signalé dans
 * docs/audit-ux/AUDIT_GMAO.md ; tant qu'il n'est pas fait, afficher ces lignes
 * reviendrait à montrer à un client les diagnostics de ses voisins.
 */

// ─── Ce que renvoie /api/maintenance-history ────────────────────────────────
export interface LigneHistorique {
  id: number;
  workOrderNumber: string;
  equipmentName: string;
  equipmentId: string;
  maintenanceType: "preventive" | "corrective" | "emergency" | string;
  description: string;
  technicianName: string;
  startDate: string;
  endDate: string;
  duration: number;
  status: "completed" | "in_progress" | "cancelled" | string;
  cost: number;
  spareParts: string[];
  notes: string;
  createdAt: string;
}

/**
 * Statuts et types d'intervention : un seul dictionnaire, comme pour les
 * ordres de travail. Les trois écrans traduisaient chacun les siens, par des
 * ternaires imbriqués qui ne couvraient pas les mêmes cas.
 */
const STATUTS: Record<string, { libelle: string; registre: RegistreEtat }> = {
  completed: { libelle: "Terminé", registre: "nominal" },
  /**
   * « Non clôturé » et non « En cours », parce que c'est tout ce que la donnée
   * permet d'affirmer : `mapWorkOrderStatus` (server/diagnostic-ml-engine.ts)
   * ne distingue que `completed` et `cancelled`, et renvoie `in_progress` pour
   * TOUT le reste. Relevé le 20/10/2026 sur le locataire de test : 45 ordres
   * « pending », 1 « paused » et 1 « on_hold » arrivaient ici en `in_progress`.
   * Écrire « En cours » aurait affirmé que 47 interventions étaient engagées
   * alors que 45 n'avaient pas commencé.
   */
  in_progress: { libelle: "Non clôturé", registre: "encours" },
  pending: { libelle: "En attente", registre: "alerte" },
  paused: { libelle: "Suspendu", registre: "alerte" },
  on_hold: { libelle: "Suspendu", registre: "alerte" },
  cancelled: { libelle: "Annulé", registre: "neutre" },
};
const TYPES: Record<string, { libelle: string; registre: RegistreEtat }> = {
  preventive: { libelle: "Préventif", registre: "encours" },
  corrective: { libelle: "Correctif", registre: "alerte" },
  emergency: { libelle: "Urgence", registre: "critique" },
  inspection: { libelle: "Inspection", registre: "encours" },
  calibration: { libelle: "Étalonnage", registre: "encours" },
};

const libelleStatut = (v: string) => STATUTS[v]?.libelle ?? v ?? "—";
const registreStatut = (v: string): RegistreEtat => STATUTS[v]?.registre ?? "neutre";
const libelleType = (v: string) => TYPES[v]?.libelle ?? v ?? "—";
const registreType = (v: string): RegistreEtat => TYPES[v]?.registre ?? "neutre";

const CLASSE_CHAMP =
  "h-10 px-3 border border-rule bg-white text-sm text-ink focus:outline-none " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal";

/** Minutes → heures lisibles. Une durée absente se dit « — », pas « 0 h ». */
function enHeures(minutes: number | null | undefined): string {
  if (!minutes) return "—";
  return `${(minutes / 60).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;
}

function enEuros(montant: number | null | undefined): string {
  if (montant == null) return "—";
  return montant.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

/**
 * L'import et l'export passent par `/api/data-import-export/*`.
 *
 * ⚠️ Une TROISIÈME implémentation, `pages/data-import-export.tsx` (587 lignes,
 * route /data-import-export), appelle une famille `/api/data/*` qui N'EXISTE
 * PAS sur le serveur. Vérifié le 20/10/2026 : export, template et historique
 * d'import y répondent tous **404**. Aucun de ses boutons n'a jamais rien
 * produit. C'est signalé dans l'audit ; cet écran-ci ne s'appuie que sur la
 * famille qui répond 200.
 */
const BASE_IMPORT_EXPORT = "/api/data-import-export";

interface ProprietesHistorique {
  /**
   * En-tête fourni par l'écran hôte — même convention que les ordres de
   * travail, le préventif et les équipements : un seul titre par écran.
   */
  enTete?: React.ReactNode;
}

export function HistoriqueMaintenance({ enTete }: ProprietesHistorique) {
  const peutImporter = usePeutImporterEnMasse();
  const [recherche, setRecherche] = useState("");
  const [typeFiltre, setTypeFiltre] = useState("all");
  const [statutFiltre, setStatutFiltre] = useState("all");
  const [periodeFiltre, setPeriodeFiltre] = useState("all");
  const [importOuvert, setImportOuvert] = useState(false);
  const champFichier = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lignes = [], isLoading, error } = useQuery<LigneHistorique[]>({
    queryKey: ["/api/maintenance-history"],
    staleTime: 30000,
  });

  /**
   * `uploadFile` pose l'en-tête X-CSRF-Token et `credentials: include`. Le
   * `fetch` brut qu'utilisait /historique ne faisait ni l'un ni l'autre :
   * l'import échouait en 403 depuis que la route n'est plus exemptée de CSRF
   * (F06). L'onglet de la GMAO, lui, avait déjà été corrigé — c'est l'une des
   * divergences que cette réunion supprime.
   */
  const importer = useMutation({
    mutationFn: (fichier: File) => {
      const corps = new FormData();
      corps.append("file", fichier);
      corps.append("type", "maintenance-history");
      return uploadFile(`${BASE_IMPORT_EXPORT}/import`, corps);
    },
    onSuccess: (resultat: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-history"] });
      const nb = resultat?.processed ?? resultat?.recordsImported ?? 0;
      toast({ title: "Import terminé", description: `${nb} enregistrement(s) repris.` });
      setImportOuvert(false);
    },
    onError: (e: Error) => toast({ title: "Import impossible", description: e.message, variant: "destructive" }),
  });

  async function telecharger(chemin: string, nomFichier: string, echec: string) {
    try {
      const reponse = await fetch(chemin, { credentials: "include" });
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      const blob = await reponse.blob();
      const url = window.URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = nomFichier;
      document.body.appendChild(lien);
      lien.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(lien);
    } catch (e) {
      toast({ title: echec, description: (e as Error).message, variant: "destructive" });
    }
  }

  const aujourdhui = new Date().toISOString().split("T")[0];

  const exporter = (format: "excel" | "csv") =>
    telecharger(
      `${BASE_IMPORT_EXPORT}/export?type=maintenance-history&format=${format}`,
      `historique_maintenance_${aujourdhui}.${format === "excel" ? "xlsx" : "csv"}`,
      "Export impossible",
    );

  const telechargerModele = (format: "excel" | "csv") =>
    telecharger(
      `${BASE_IMPORT_EXPORT}/template?type=maintenance-history&format=${format}`,
      `modele_historique_maintenance.${format === "excel" ? "xlsx" : "csv"}`,
      "Téléchargement impossible",
    );

  /**
   * Export de la VUE filtrée, calculé dans le navigateur. Il vient de l'onglet
   * du tableau de bord et ne fait pas double emploi avec l'export serveur :
   * celui-ci sort tout l'historique, celui-là exactement ce qui est à l'écran.
   */
  function exporterLaVue() {
    if (lignesFiltrees.length === 0) {
      toast({ title: "Rien à exporter", description: "Aucune ligne ne correspond aux filtres.", variant: "destructive" });
      return;
    }
    const entetes = ["N° OT", "Date", "Équipement", "Type", "Statut", "Technicien", "Durée (min)", "Coût", "Pièces", "Description"];
    const echapper = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const contenu = [
      entetes.join(","),
      ...lignesFiltrees.map((l) =>
        [
          l.workOrderNumber, l.startDate ? l.startDate.slice(0, 10) : "", l.equipmentName,
          libelleType(l.maintenanceType), libelleStatut(l.status), l.technicianName,
          l.duration ?? "", l.cost ?? "", (l.spareParts || []).join(" / "), l.description,
        ].map(echapper).join(","),
      ),
    ].join("\n");
    // Le BOM garde les accents lisibles à l'ouverture dans Excel.
    const blob = new Blob(["﻿" + contenu], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `historique_vue_filtree_${aujourdhui}.csv`;
    document.body.appendChild(lien);
    lien.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(lien);
    toast({ title: "Vue exportée", description: `${lignesFiltrees.length} ligne(s).` });
  }

  function choisirFichier(evenement: React.ChangeEvent<HTMLInputElement>) {
    const fichier = evenement.target.files?.[0];
    if (!fichier) return;
    if (!/\.(xlsx|xls|csv)$/i.test(fichier.name)) {
      toast({
        title: "Format non reconnu",
        description: "Utilisez un fichier Excel (.xlsx, .xls) ou CSV.",
        variant: "destructive",
      });
      return;
    }
    importer.mutate(fichier);
  }

  const limitePeriode = (() => {
    if (periodeFiltre === "all") return null;
    const jours = periodeFiltre === "7d" ? 7 : periodeFiltre === "30d" ? 30 : 90;
    return new Date(Date.now() - jours * 24 * 60 * 60 * 1000);
  })();

  const lignesFiltrees = lignes.filter((l) => {
    const terme = recherche.toLowerCase();
    const correspond =
      (l.equipmentName || "").toLowerCase().includes(terme) ||
      (l.technicianName || "").toLowerCase().includes(terme) ||
      (l.workOrderNumber || "").toLowerCase().includes(terme) ||
      (l.description || "").toLowerCase().includes(terme);
    const type = typeFiltre === "all" || l.maintenanceType === typeFiltre;
    const statut = statutFiltre === "all" || l.status === statutFiltre;
    const date = l.startDate || l.createdAt;
    const periode = !limitePeriode || (date ? new Date(date) >= limitePeriode : false);
    return correspond && type && statut && periode;
  });

  const terminees = lignes.filter((l) => l.status === "completed").length;
  const enCours = lignes.filter((l) => l.status === "in_progress").length;
  const coutTotal = lignes.reduce((somme, l) => somme + (Number(l.cost) || 0), 0);
  /** Aucun coût saisi n'est différent d'un coût nul : la tuile le dit. */
  const auMoinsUnCout = lignes.some((l) => Number(l.cost) > 0);

  return (
    <div className="space-y-6">
      {enTete ?? (
        <EnTetePage
          surTitre="GMAO"
          titre="Historique de maintenance"
          phrase="Les interventions réalisées, leur durée, leur coût et les pièces consommées."
        />
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <ActionSecondaire onClick={() => exporter("csv")}>
          <Download className="h-4 w-4" />
          Export CSV
        </ActionSecondaire>
        <ActionSecondaire onClick={() => exporter("excel")}>
          <Download className="h-4 w-4" />
          Export Excel
        </ActionSecondaire>
        {peutImporter && (
          <ActionPrincipale onClick={() => setImportOuvert(true)}>
            <Upload className="h-4 w-4" />
            Importer
          </ActionPrincipale>
        )}
      </div>

      {/* Sous la barre, et non dans la barre : un paragraphe aligné avec des
          boutons casserait la rangée. Le refus reste visible, pas deviné. */}
      {!peutImporter && <ImportReserve quoi="un historique de maintenance" />}

      <RangeeIndicateurs colonnes={4}>
        <Indicateur
          libelle="Interventions"
          valeur={lignes.length}
          precision={lignes.length > 0 ? "au total" : "aucune à ce jour"}
          icone={History}
        />
        <Indicateur
          libelle="Terminées"
          valeur={terminees}
          precision={lignes.length > 0 ? `sur ${lignes.length}` : "—"}
          icone={CheckCircle}
        />
        <Indicateur
          libelle="Non clôturées"
          valeur={enCours}
          precision={enCours > 0 ? "ni terminées ni annulées" : "tout est clôturé"}
          icone={Clock}
          alerte={enCours > 0}
        />
        <Indicateur
          libelle="Coût cumulé"
          valeur={auMoinsUnCout ? enEuros(coutTotal) : "—"}
          precision={auMoinsUnCout ? "sur la période enregistrée" : "aucun coût saisi"}
          icone={Wrench}
        />
      </RangeeIndicateurs>

      {/* Recherche et filtres */}
      <div className="border border-rule bg-white p-5">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute h-4 w-4" aria-hidden="true" />
            <Input
              id="recherche-historique"
              aria-label="Rechercher dans l'historique"
              placeholder="Rechercher par équipement, technicien, n° d'ordre ou description..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="pl-10 border-rule"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={typeFiltre}
              onChange={(e) => setTypeFiltre(e.target.value)}
              aria-label="Filtrer par type d'intervention"
              className={CLASSE_CHAMP}
            >
              <option value="all">Tous les types</option>
              <option value="preventive">Préventif</option>
              <option value="corrective">Correctif</option>
              <option value="emergency">Urgence</option>
            </select>
            {/* Trois choix seulement : ce sont les trois seules valeurs que
                l'API sait produire. Proposer « En attente » ou « Suspendu »
                donnerait un filtre qui ne ramène jamais rien. */}
            <select
              value={statutFiltre}
              onChange={(e) => setStatutFiltre(e.target.value)}
              aria-label="Filtrer par statut"
              className={CLASSE_CHAMP}
            >
              <option value="all">Tous les statuts</option>
              <option value="completed">Terminé</option>
              <option value="in_progress">Non clôturé</option>
              <option value="cancelled">Annulé</option>
            </select>
            {/* Le filtre par période venait de l'onglet du tableau de bord, où
                il était appliqué par le serveur. Il l'est ici dans le
                navigateur : même capacité pour qui consulte. */}
            <select
              value={periodeFiltre}
              onChange={(e) => setPeriodeFiltre(e.target.value)}
              aria-label="Filtrer par période"
              className={CLASSE_CHAMP}
            >
              <option value="all">Toute la période</option>
              <option value="7d">7 derniers jours</option>
              <option value="30d">30 derniers jours</option>
              <option value="90d">90 derniers jours</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-white border border-rule animate-pulse">
              <CardContent className="p-6 space-y-3">
                <div className="h-4 bg-paper-deep w-1/3" />
                <div className="h-3 bg-paper-deep w-full" />
                <div className="h-3 bg-paper-deep w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        /* Cet état n'était pas atteignable : une réponse de refus arrivait en
           HTTP 200 et l'écran se contentait de blanchir. Voir l'en-tête de
           lib/queryClient.ts. */
        <div className="border border-etat-critique-filet bg-etat-critique-fond p-6">
          <AlertCircle className="h-5 w-5 text-etat-critique-texte" aria-hidden="true" />
          <h3 className="font-serif text-title font-medium text-etat-critique-texte mt-3">
            L'historique n'a pas pu être chargé
          </h3>
          <p className="text-sm text-etat-critique-texte mt-2">{(error as Error).message}</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/maintenance-history"] })}
            className="inline-flex items-center gap-2 h-10 px-4 mt-4 border border-etat-critique-filet bg-white text-sm text-etat-critique-texte hover:bg-etat-critique-fond transition-colors"
          >
            Réessayer
          </button>
        </div>
      ) : lignesFiltrees.length === 0 ? (
        <EtatVide
          icone={History}
          titre={lignes.length === 0 ? "Aucune intervention enregistrée" : "Aucune intervention ne correspond aux filtres"}
          phrase={
            lignes.length === 0
              // La phrase ne propose la reprise d'un fichier qu'à qui peut
              // réellement l'effectuer : l'annoncer puis refuser serait pire
              // que se taire.
              ? peutImporter
                ? "L'historique se remplit à mesure que les ordres de travail sont traités. Vous pouvez aussi reprendre un historique existant depuis un fichier Excel ou CSV."
                : "L'historique se remplit à mesure que les ordres de travail sont traités."
              : "Élargissez la recherche, ou remettez les filtres sur « tous »."
          }
          action={
            lignes.length === 0 && peutImporter ? (
              <ActionPrincipale onClick={() => setImportOuvert(true)}>
                <Upload className="h-4 w-4" />
                Importer un historique
              </ActionPrincipale>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-ink-soft">
              {lignesFiltrees.length === lignes.length
                ? `${lignes.length} intervention(s)`
                : `${lignesFiltrees.length} intervention(s) sur ${lignes.length}`}
            </p>
            <ActionSecondaire onClick={exporterLaVue}>
              <FileText className="h-4 w-4" />
              Exporter la vue filtrée
            </ActionSecondaire>
          </div>

          <div className="grid gap-4">
            {lignesFiltrees.map((ligne) => (
              <Card key={ligne.id} className="bg-white border border-rule shadow-none">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm text-ink-mute">{ligne.workOrderNumber}</span>
                        <PuceEtat registre={registreStatut(ligne.status)}>{libelleStatut(ligne.status)}</PuceEtat>
                        <PuceEtat registre={registreType(ligne.maintenanceType)}>{libelleType(ligne.maintenanceType)}</PuceEtat>
                      </div>
                      <p className="text-ink mt-2">{ligne.description || "Sans description"}</p>
                    </div>
                    <div className="text-right text-sm text-ink-mute shrink-0">
                      <p>{ligne.startDate ? new Date(ligne.startDate).toLocaleDateString("fr-FR") : "—"}</p>
                      <p>{enHeures(ligne.duration)} · {enEuros(ligne.cost)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-4 pt-4 border-t border-rule">
                    <div>
                      <p className="text-ink-mute">Équipement</p>
                      <p className="text-ink">{ligne.equipmentName || "Non précisé"}</p>
                      {ligne.equipmentId && <p className="text-ink-mute font-mono text-xs">{ligne.equipmentId}</p>}
                    </div>
                    <div>
                      <p className="text-ink-mute">Technicien</p>
                      <p className="text-ink">{ligne.technicianName || "Non assigné"}</p>
                    </div>
                    <div>
                      <p className="text-ink-mute">Pièces consommées</p>
                      <p className="text-ink">
                        {ligne.spareParts && ligne.spareParts.length > 0 ? ligne.spareParts.join(", ") : "Aucune"}
                      </p>
                    </div>
                  </div>

                  {ligne.notes && (
                    <div className="mt-4 pt-4 border-t border-rule">
                      <p className="text-ink-mute text-sm">Notes</p>
                      <p className="text-ink-soft text-sm whitespace-pre-line">{ligne.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ─── Import ──────────────────────────────────────────────────── */}
      {importOuvert && (
        <div
          className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-import-historique"
        >
          <div className="bg-white border border-rule w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-6 gap-4">
              <h2 id="titre-import-historique" className="font-serif text-page text-ink">
                Importer un historique
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setImportOuvert(false)} aria-label="Fermer">
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>

            <p className="text-sm text-ink-soft">
              Fichier Excel (.xlsx, .xls) ou CSV. Les exports des principaux ERP du marché —
              SAGE, SAP, Oracle, Dynamics, Maximo — sont reconnus automatiquement.
            </p>

            <div className="mt-5">
              <Label className="text-sm text-ink-soft">Commencez par le modèle de colonnes</Label>
              <div className="flex gap-2 mt-2">
                <ActionSecondaire onClick={() => telechargerModele("excel")}>
                  <FileText className="h-4 w-4" />
                  Modèle Excel
                </ActionSecondaire>
                <ActionSecondaire onClick={() => telechargerModele("csv")}>
                  <FileText className="h-4 w-4" />
                  Modèle CSV
                </ActionSecondaire>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-rule">
              <input
                ref={champFichier}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={choisirFichier}
                className="hidden"
                aria-label="Fichier à importer"
              />
              <Button
                onClick={() => champFichier.current?.click()}
                disabled={importer.isPending}
                className="w-full bg-ink text-white hover:bg-signal"
              >
                {importer.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                    Import en cours...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
                    Choisir un fichier
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoriqueMaintenance;
