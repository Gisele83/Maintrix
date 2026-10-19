import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Factory, Wrench, Package, CalendarCheck, Bell, BarChart3,
  AlertTriangle, TrendingUp, Activity, Cog, Smartphone, Brain, Zap, Plus,
  ShoppingCart, DollarSign, Gauge, ClipboardCheck, FileText, ArrowUpRight,
  Heart, Timer, Radio, QrCode, ExternalLink, Shield, Fish,
  FlaskConical, UserCheck, Building2, ShieldCheck
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModernNavigation } from "@/components/modern-navigation";
import { EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, IndicateurCalcule, PuceEtat, PointEtat } from "@/components/indicateurs";
import { ETAT, registreStatutOT, registrePriorite, registreGravite } from "@/lib/etats";
import { ProcurementDashboard } from "@/components/procurement-dashboard";
import { EquipmentManagement } from "@/components/equipment-management";
import { WorkOrderManagement } from "@/components/work-order-management";
import { PreventiveMaintenance } from "@/components/preventive-maintenance";
import InventorySimple from "@/components/inventory-simple";
import { MaintenanceReports } from "@/components/maintenance-reports";
import ValidationDashboard from "@/components/validation-dashboard-simple";
import PurchaseOrderWorkflowDemo from "@/components/purchase-order-workflow-demo";
import { CompanyLetterheadConfig } from "@/components/company-letterhead-config";
import ThresholdConfiguration from "@/components/threshold-configuration";
import PurchaseOrderCreator from "@/components/purchase-order-creator";
import { EquipmentHealthDashboard } from "@/components/equipment-health-dashboard";
import { HistoryManagement } from "@/components/history-management";


interface RecentWorkOrder {
  id: number;
  orderNumber: string;
  title: string;
  status: string;
  priority: string;
  equipmentName?: string;
  assignedTo?: string;
  scheduledStart?: string;
  createdAt?: string;
}

interface RecentAlert {
  id: number;
  alertType: string;
  severity: string;
  title: string;
  message?: string;
  status: string;
  createdAt?: string;
}

/**
 * Contexte des indicateurs, calculé en base (gmaoStorage.getDashboardContexte).
 * Un grand nombre seul ne renseigne sur rien : c'est la deuxième ligne qui
 * oriente la journée d'un responsable maintenance.
 */
interface ContexteGMAO {
  equipementsIndisponibles: number;
  equipementsAjoutesCeMois: number;
  otEnRetard: number;
  otUrgents: number;
  alertesDernieres24h: number;
  piecesEnRupture: number;
  preventifEnRetard: number;
  preventifSous7Jours: number;
}

/** Un mois d'activité, tel que `getEvolutionMensuelle` le rapporte. */
interface PointMensuel {
  mois: string;
  termines: number;
  enCours: number;
  urgents: number;
  preventif: number;
  correctif: number;
}

interface GMAODashboardData {
  contexte?: ContexteGMAO;
  /** Activité réelle mois par mois, telle que le serveur l'agrège. */
  evolution?: PointMensuel[];
  /** Les seuls indicateurs que les données permettent de calculer. */
  indicateurs?: {
    tauxResolution: number | null;
    tauxPreventif: number | null;
    mttrHeures: number | null;
    totalInterventions: number;
  };
  equipmentCount: number;
  activeWorkOrdersCount: number;
  pendingWorkOrdersCount: number;
  criticalAlertsCount: number;
  lowStockPartsCount: number;
  recentWorkOrders: RecentWorkOrder[];
  recentAlerts: RecentAlert[];
  equipmentByType: Record<string, number>;
  workOrdersByStatus: Record<string, number>;
}

type GMAOTab = "overview" | "work-orders" | "equipment" | "inventory" | "alerts";
type AdminTab = "maintenance" | "history" | "procurement" | "reports" | "analytics" | "health-dashboard" | "validation" | "company-config";

/**
 * Libellés français des statuts et priorités renvoyés par le serveur.
 * Ils étaient traduits en ligne, dans trois chaînes ternaires différentes
 * qui ne couvraient pas les mêmes cas : « cancelled » s'affichait tel quel
 * dans une liste et « Annulé » dans une autre.
 */
const LIBELLE_STATUT_OT: Record<string, string> = {
  pending: "En attente",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
};

const LIBELLE_PRIORITE: Record<string, string> = {
  urgent: "Urgent",
  high: "Haute",
  medium: "Moyenne",
  low: "Basse",
};

/**
 * Couleurs de séries du graphique d'activité. Trois teintes, reprises des
 * jetons d'état : le préventif est nominal, le correctif est en cours,
 * l'urgent est critique. Recharts n'accepte pas de classe Tailwind, d'où
 * les valeurs littérales — elles doivent rester synchronisées avec
 * `tailwind.config.ts`.
 */
const COULEUR_SERIE = {
  preventif: "#2E7D4F",
  correctif: "#006B97",
  urgent: "#C0392B",
} as const;

export default function GMAODashboard() {
  const [activeTab, setActiveTab] = useState<GMAOTab>("overview");
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  // Fetch GMAO dashboard data
  const { data: dashboardData, isLoading, isError } = useQuery<GMAODashboardData>({
    queryKey: ["/api/gmao-dashboard"],
    retry: 2,
  });

  // ⚠️ Ces deux graphiques contenaient des CONSTANTES INVENTÉES : cinq mois
  // sur six pour le premier, douze sur douze pour le second. Le dernier point
  // valait « … || 45 », si bien que le chiffre fabriqué apparaissait
  // UNIQUEMENT quand la vraie valeur était zéro. Un locataire sans la moindre
  // saisie voyait donc une courbe d'activité fournie, précisément parce qu'il
  // n'avait rien saisi. Montrer cela à un industriel qui évalue l'outil est le
  // plus sûr moyen de perdre sa confiance. Signalé le 2026-10-11.
  const evolution: PointMensuel[] = dashboardData?.evolution ?? [];
  const evolutionDouzeMois = evolution;
  const evolutionSixMois = evolution.slice(-6);

  const indicateurs = dashboardData?.indicateurs;

  /** Un pourcentage mesuré, ou un tiret. Jamais un nombre plausible. */
  const pourcent = (v: number | null | undefined) => (v == null ? '—' : `${v}%`);
  /** Idem pour une durée. */
  const heures = (v: number | null | undefined) => (v == null ? '—' : `${v} h`);
  /** Une barre de progression ne peut rien représenter sans mesure. */
  const jauge = (v: number | null | undefined) => (v == null ? 0 : v);
  /** La mention qui remplace une comparaison inventée. */
  const NON_MESURE = (
    <span className="text-xs text-ink-mute">non mesuré sur cet environnement</span>
  );

  // « Aucune donnée » n'est pas « en cours de chargement » : on ne l'affirme
  // qu'une fois la réponse reçue, et seulement si tout est réellement à zéro.
  const aucuneActivite = !isLoading && evolution.length > 0
    && evolution.every((m) => m.termines + m.enCours + m.preventif + m.correctif === 0);

  const tabs = [
    {
      id: "overview" as GMAOTab,
      label: "Vue d'ensemble",
      icon: BarChart3,
    },
    {
      id: "work-orders" as GMAOTab,
      label: "Ordres de travail",
      icon: Wrench,
    },
    {
      id: "equipment" as GMAOTab,
      label: "Équipements",
      icon: Factory,
    },
    {
      id: "inventory" as GMAOTab,
      label: "Inventaire",
      icon: Package,
    },
    {
      id: "alerts" as GMAOTab,
      label: "Alertes",
      icon: Bell,
    },
  ];

  const adminTabs = [
    { id: "maintenance" as AdminTab, label: "Maintenance préventive", icon: CalendarCheck },
    { id: "history" as AdminTab, label: "Historique", icon: FileText },
    { id: "procurement" as AdminTab, label: "Achats", icon: ShoppingCart },
    { id: "reports" as AdminTab, label: "Rapports", icon: BarChart3 },
    { id: "analytics" as AdminTab, label: "Analytiques", icon: TrendingUp },
    { id: "health-dashboard" as AdminTab, label: "Santé des équipements", icon: Activity },
    { id: "validation" as AdminTab, label: "Validation multi-niveaux", icon: ClipboardCheck },
    { id: "company-config" as AdminTab, label: "Configuration de l'entreprise", icon: Cog },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-ink-soft';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-ink-soft';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper">
        <ModernNavigation />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-rule border-t-signal"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <ModernNavigation />

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-rule sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setShowAdminModal(false);
                    setActiveAdminTab(null);
                  }}
                  className={`flex items-center space-x-2 px-3 py-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id && !showAdminModal
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${
                    activeTab === tab.id && !showAdminModal ? "text-primary" : "text-muted-foreground"
                  }`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
            
            {/* Menu Plus/Admin */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowAdminModal(!showAdminModal);
                  if (!showAdminModal) {
                    setActiveAdminTab("maintenance");
                  }
                }}
                className={`flex items-center space-x-2 px-3 py-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  showAdminModal
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                }`}
              >
                <Cog className={`w-4 h-4 ${
                  showAdminModal ? "text-primary" : "text-muted-foreground"
                }`} />
                <span>Plus</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Menu Admin Dropdown */}
      {showAdminModal && (
        <div className="bg-card border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-4 py-3 overflow-x-auto">
              {adminTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveAdminTab(tab.id)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md font-medium text-sm whitespace-nowrap transition-colors ${
                      activeAdminTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Échec de chargement. Aucun chiffre n'est affiché en dessous tant
            que la réponse n'est pas arrivée : les écrans qui comblent le vide
            avec des valeurs de repli font croire à des données réelles. */}
        {isError && (
          <div className="mb-6 flex items-start gap-3 border border-etat-critique-filet bg-etat-critique-fond px-5 py-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-etat-critique-texte" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-etat-critique-texte">
                Les données de la GMAO n'ont pas pu être chargées
              </p>
              <p className="text-sm text-etat-critique-texte mt-0.5">
                Vérifiez votre connexion, puis rechargez la page. Aucun indicateur n'est affiché
                tant que les données réelles ne sont pas disponibles.
              </p>
            </div>
          </div>
        )}
        {/* Vue d'ensemble uniquement */}
        {!showAdminModal && activeTab === "overview" && (
          <div className="space-y-6">
            {/* ══════════════════════════════════════════════════════════
                EN-TÊTE
                ══════════════════════════════════════════════════════════
                Un titre, une date, deux actions. La version précédente
                enfermait cela dans un grand cadre teinté qui n'apportait
                rien et repoussait les chiffres sous la ligne de flottaison. */}
            <EnTetePage
              surTitre="GMAO"
              titre="Vue d'ensemble"
              phrase={new Date()
                .toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                .replace(/^./, (c) => c.toUpperCase())}
              actionsSecondaires={
                <ActionSecondaire onClick={() => { setShowAdminModal(true); setActiveAdminTab("reports"); }}>
                  <BarChart3 className="w-4 h-4" />
                  Rapports
                </ActionSecondaire>
              }
              action={
                <ActionPrincipale onClick={() => setActiveTab("work-orders")}>
                  <Plus className="w-4 h-4" />
                  Nouvel ordre de travail
                </ActionPrincipale>
              }
            />

            {/* ══════════════════════════════════════════════════════════
                INDICATEURS
                ══════════════════════════════════════════════════════════
                Cartes claires à filet, chiffre en romain, et un liseré
                gauche qui ne s'allume QUE lorsqu'il y a quelque chose à
                faire. Les quatre cartes étaient auparavant des aplats
                sombres identiques, ornés d'un disque blanc décoratif : la
                couleur ne disait rien, et rien ne distinguait « 0 alerte »
                de « 12 alertes ».
                Le gabarit est désormais partagé (`components/indicateurs`),
                pour que ces quatre tuiles soient rigoureusement identiques
                à celles de l'écran d'ingénierie — et chaque tuile mène à
                l'écran qui permet d'agir, ce qui manquait. */}
            {(() => {
              const c = dashboardData?.contexte;
              /** Assemble les précisions non nulles ; à défaut, une phrase neutre. */
              const detail = (parts: Array<[number, string]>, aDefaut: string) => {
                const dits = parts.filter(([n]) => n > 0).map(([n, libelle]) => `${n} ${libelle}`);
                return dits.length ? dits.join(" · ") : aDefaut;
              };
              return (
                <RangeeIndicateurs>
                  <Indicateur
                    libelle="Équipements"
                    valeur={dashboardData?.equipmentCount ?? "—"}
                    precision={detail(
                      [
                        [c?.equipementsIndisponibles || 0, "indisponible(s)"],
                        [c?.equipementsAjoutesCeMois || 0, "ajouté(s) ce mois"],
                      ],
                      (dashboardData?.equipmentCount || 0) > 0 ? "tous en service" : "parc à déclarer",
                    )}
                    icone={Factory}
                    alerte={(c?.equipementsIndisponibles || 0) > 0}
                    href="/equipment-management"
                  />
                  <Indicateur
                    libelle="Ordres de travail"
                    valeur={dashboardData?.activeWorkOrdersCount ?? "—"}
                    precision={detail(
                      [
                        [c?.otUrgents || 0, "urgent(s)"],
                        [c?.otEnRetard || 0, "en retard"],
                        [dashboardData?.pendingWorkOrdersCount || 0, "en attente"],
                      ],
                      "rien en cours",
                    )}
                    icone={Wrench}
                    alerte={(c?.otEnRetard || 0) > 0 || (c?.otUrgents || 0) > 0}
                    href="/work-orders"
                  />
                  <Indicateur
                    libelle="Alertes critiques"
                    valeur={dashboardData?.criticalAlertsCount ?? "—"}
                    precision={detail(
                      [[c?.alertesDernieres24h || 0, "depuis 24 h"]],
                      (dashboardData?.criticalAlertsCount || 0) > 0 ? "à traiter sans délai" : "aucune en cours",
                    )}
                    icone={AlertTriangle}
                    alerte={(dashboardData?.criticalAlertsCount || 0) > 0}
                    href="/smart-alerts"
                  />
                  <Indicateur
                    libelle="Stock sous seuil"
                    valeur={dashboardData?.lowStockPartsCount ?? "—"}
                    precision={detail(
                      [[c?.piecesEnRupture || 0, "en rupture"]],
                      (dashboardData?.lowStockPartsCount || 0) > 0 ? "à réapprovisionner" : "aucun seuil franchi",
                    )}
                    icone={Package}
                    alerte={(c?.piecesEnRupture || 0) > 0}
                    href="/inventaire"
                  />
                </RangeeIndicateurs>
              );
            })()}

            {/* ══════════════════════════════════════════════════════════
                À TRAITER
                ══════════════════════════════════════════════════════════
                Prend la place du bloc « Commencer » dès que le parc existe.
                N'affiche que ce qui appelle une décision aujourd'hui, du plus
                urgent au moins pressant, et disparaît quand il n'y a rien —
                un écran qui dit « rien à signaler » vaut mieux qu'une liste
                remplie pour ne pas paraître vide. */}
            {(dashboardData?.equipmentCount || 0) > 0 && (() => {
              const c = dashboardData?.contexte;
              const points = [
                { n: c?.otUrgents || 0, libelle: 'ordre(s) de travail urgent(s)', href: '/work-orders', grave: true },
                { n: dashboardData?.criticalAlertsCount || 0, libelle: 'alerte(s) critique(s)', href: '/smart-alerts', grave: true },
                { n: c?.otEnRetard || 0, libelle: 'intervention(s) en retard', href: '/work-orders', grave: true },
                { n: c?.preventifEnRetard || 0, libelle: 'préventif(s) en retard', href: '/maintenance-plan', grave: true },
                { n: c?.equipementsIndisponibles || 0, libelle: 'équipement(s) indisponible(s)', href: '/equipment-management', grave: false },
                { n: c?.piecesEnRupture || 0, libelle: 'référence(s) en rupture', href: '/inventaire', grave: false },
                { n: c?.preventifSous7Jours || 0, libelle: 'préventif(s) sous 7 jours', href: '/maintenance-plan', grave: false },
              ].filter((point) => point.n > 0);

              return (
                <div className="border border-rule bg-white">
                  <div className="flex items-baseline justify-between px-5 py-4 border-b border-rule">
                    <h2 className="font-serif text-title font-medium text-ink">À traiter</h2>
                    <span className="font-mono text-eyebrow uppercase text-ink-mute">
                      {points.length > 0 ? `${points.length} point(s)` : 'rien à signaler'}
                    </span>
                  </div>

                  {points.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-ink-soft">
                      Aucune urgence, aucun retard, aucun seuil franchi. Le parc tourne.
                    </p>
                  ) : (
                    <ul>
                      {points.map((point) => (
                        <li key={point.libelle} className="border-b border-rule last:border-b-0">
                          <Link href={point.href}>
                            <span className="flex items-baseline gap-4 px-5 py-3 cursor-pointer transition-colors hover:bg-paper group">
                              <span
                                className={`font-serif text-2xl leading-none w-10 shrink-0 ${point.grave ? 'text-ink' : 'text-ink-soft'}`}
                              >
                                {point.n}
                              </span>
                              <span className="text-sm text-ink group-hover:text-signal transition-colors">
                                {point.libelle}
                              </span>
                              {point.grave && (
                                <span className="ml-auto font-mono text-eyebrow uppercase text-amber-700 shrink-0">
                                  priorité
                                </span>
                              )}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })()}

            {/* Parc vide : on dit quoi faire, au lieu d'afficher quatre zéros
                sans suite. C'est le premier écran que voit un testeur. */}
            {(dashboardData?.equipmentCount || 0) === 0 && (
              <div className="border border-rule bg-white p-6">
                <h2 className="font-serif text-title font-medium text-ink">Commencer</h2>
                <p className="text-sm text-ink-soft mt-2 max-w-2xl">
                  Votre parc est encore vide. Trois étapes suffisent pour que ce tableau de bord
                  reflète votre atelier.
                </p>
                <ol className="mt-5 grid gap-px bg-rule border border-rule sm:grid-cols-3">
                  {[
                    { n: '01', titre: 'Déclarer un équipement', texte: 'Nom, emplacement, criticité.', href: '/equipment-management' },
                    { n: '02', titre: 'Créer un ordre de travail', texte: 'Une demande, une priorité, un responsable.', href: '/work-orders' },
                    { n: '03', titre: 'Poser un plan préventif', texte: 'Une échéance calendaire ou au compteur.', href: '/maintenance-plan' },
                  ].map((etape) => (
                    <li key={etape.n} className="bg-white p-4">
                      <Link href={etape.href}>
                        <span className="block cursor-pointer group">
                          <span className="font-mono text-sm text-signal">{etape.n}</span>
                          <span className="block font-medium text-ink mt-1 group-hover:text-signal transition-colors">
                            {etape.titre}
                          </span>
                          <span className="block text-sm text-ink-soft mt-1">{etape.texte}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                MODULES
                ══════════════════════════════════════════════════════════
                Ils étaient présentés en une grille unique de seize tuiles
                équivalentes, chacune avec une pastille d'icône en dégradé.
                Une fois les dégradés retirés, il restait seize cases pâles
                indiscernables. On les regroupe donc par usage : on cherche
                d'abord un domaine, ensuite un écran. */}
            {[
              {
                groupe: 'Exploitation',
                items: [
                  { icon: Heart, label: 'Santé des machines', href: '/machine-health' },
                  { icon: Radio, label: 'Capteurs', href: '/sensor-hub' },
                  { icon: Bell, label: 'Alertes', href: '/smart-alerts' },
                  { icon: Timer, label: 'Engagements de service', href: '/sla-management' },
                  { icon: QrCode, label: 'Codes QR', href: '/equipment-qr' },
                  { icon: CalendarCheck, label: 'Plan de maintenance', href: '/maintenance-plan' },
                ],
              },
              {
                groupe: 'Analyse',
                items: [
                  { icon: Gauge, label: 'OEE', href: '/oee' },
                  { icon: Fish, label: 'Causes racines', href: '/rca' },
                  { icon: AlertTriangle, label: 'AMDEC', href: '/fmea' },
                  { icon: Package, label: 'Cycle de vie des actifs', href: '/asset-lifecycle' },
                  { icon: DollarSign, label: 'Budget', href: '/budget' },
                  { icon: Brain, label: 'Supervision adaptative', href: '/cognitive-infrastructure' },
                ],
              },
              {
                groupe: 'Conformité et partenaires',
                items: [
                  { icon: Shield, label: 'Permis de travail', href: '/permit-to-work' },
                  { icon: FlaskConical, label: 'Étalonnages', href: '/calibration' },
                  { icon: UserCheck, label: 'Habilitations', href: '/habilitation' },
                  { icon: ShieldCheck, label: 'Garanties', href: '/warranty' },
                  { icon: Building2, label: 'Fournisseurs', href: '/supplier-portal' },
                  { icon: ExternalLink, label: 'Portail client', href: '/client-portal' },
                ],
              },
              {
                groupe: 'Données et échanges',
                items: [
                  { icon: Zap, label: 'Intégrations', href: '/advanced-integrations' },
                  { icon: Bell, label: 'Communications', href: '/communication-integrations' },
                  // ⚠️ « Application à installer » occupait la troisième case.
                  // C'est une formulation de notice d'installation, pas un
                  // module de maintenance — et elle était nommément visée par
                  // la demande de l'utilisateur. L'écran de téléchargement
                  // reste accessible par « Ressources → Télécharger » dans la
                  // barre de navigation, où il est à sa place.
                  { icon: Smartphone, label: 'Application mobile', href: '/download' },
                ],
              },
            ].map((section) => (
              <div key={section.groupe}>
                <p className="font-mono text-eyebrow uppercase text-ink-mute mb-3">{section.groupe}</p>
                {/* Le nombre de colonnes suit le nombre d'entrées : une grille
                    figée à six colonnes laissait trois cases grises vides sous
                    « Données et échanges », que rien n'expliquait. */}
                <div
                  className={`grid grid-cols-2 md:grid-cols-3 gap-px bg-rule border border-rule ${
                    section.items.length >= 6 ? 'lg:grid-cols-6' : 'lg:grid-cols-3'
                  }`}
                >
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group bg-white h-full p-4 transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal"
                    >
                      <item.icon className="w-5 h-5 text-ink-mute group-hover:text-signal transition-colors" />
                      <span className="block text-sm text-ink mt-3 leading-snug">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            {/* ══════════════════════════════════════════════════════════
                ACTIVITÉ DU JOUR
                ══════════════════════════════════════════════════════════
                Cette moitié de page parlait une autre langue que celle du
                haut : boîtes teintées à coins arrondis, pastilles rondes de
                couleur, disques d'icônes bleu, vert et turquoise, et trois
                cartes voisines dont deux portaient une ombre et la
                troisième non. Deux vocabulaires visuels sur un même écran
                suffisent à faire paraître l'outil assemblé à la hâte.
                Tout passe au filet, au chiffre en romain et aux jetons
                d'état partagés de lib/etats.ts. */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Répartition des ordres de travail */}
              <section className="lg:col-span-1 border border-rule bg-white" aria-labelledby="titre-repartition">
                <h2 id="titre-repartition" className="font-serif text-title font-medium text-ink px-5 py-4 border-b border-rule">
                  Répartition des ordres
                </h2>
                <div className="p-5">
                  {dashboardData?.workOrdersByStatus && Object.keys(dashboardData.workOrdersByStatus).length > 0 ? (
                    <ul className="space-y-4">
                      {Object.entries(dashboardData.workOrdersByStatus).map(([statut, nombre]) => {
                        const total = Object.values(dashboardData.workOrdersByStatus).reduce((a, b) => a + b, 0);
                        const part = total > 0 ? Math.round((nombre / total) * 100) : 0;
                        const registre = registreStatutOT(statut);
                        return (
                          <li key={statut}>
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-2 text-sm text-ink">
                                <PointEtat registre={registre} />
                                {LIBELLE_STATUT_OT[statut] ?? statut}
                              </span>
                              <span className="font-serif text-xl text-ink leading-none">{nombre}</span>
                            </div>
                            <div className="mt-2 h-1 bg-paper-deep" role="presentation">
                              <div className={`h-full ${ETAT[registre].filet}`} style={{ width: `${part}%` }} />
                            </div>
                            <p className="text-xs text-ink-mute mt-1">{part} % du total</p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-ink-soft">Aucun ordre de travail enregistré.</p>
                  )}
                </div>
              </section>

              {/* Ordres de travail récents */}
              <section className="lg:col-span-2 border border-rule bg-white" aria-labelledby="titre-recents">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-rule">
                  <h2 id="titre-recents" className="font-serif text-title font-medium text-ink">
                    Derniers ordres de travail
                  </h2>
                  <button
                    onClick={() => setActiveTab("work-orders")}
                    className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-signal transition-colors"
                  >
                    Voir tout
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {dashboardData?.recentWorkOrders && dashboardData.recentWorkOrders.length > 0 ? (
                  <ul>
                    {dashboardData.recentWorkOrders.slice(0, 5).map((ordre) => (
                      <li key={ordre.id} className="border-b border-rule last:border-b-0">
                        <Link
                          href="/work-orders"
                          className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm text-ink truncate">{ordre.title}</span>
                            <span className="block font-mono text-xs text-ink-mute mt-0.5">
                              {ordre.orderNumber}
                              {ordre.equipmentName && ` · ${ordre.equipmentName}`}
                              {ordre.createdAt && ` · ${new Date(ordre.createdAt).toLocaleDateString("fr-FR")}`}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            <PuceEtat registre={registrePriorite(ordre.priority)}>
                              {LIBELLE_PRIORITE[ordre.priority] ?? ordre.priority}
                            </PuceEtat>
                            <PuceEtat registre={registreStatutOT(ordre.status)}>
                              {LIBELLE_STATUT_OT[ordre.status] ?? ordre.status}
                            </PuceEtat>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-5 py-8">
                    <p className="text-sm text-ink-soft">Aucun ordre de travail enregistré.</p>
                    <button
                      onClick={() => setActiveTab("work-orders")}
                      className="inline-flex items-center gap-2 h-10 px-4 mt-4 border border-rule text-sm text-ink-soft hover:text-ink hover:border-ink transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Créer un ordre de travail
                    </button>
                  </div>
                )}
              </section>
            </div>

            {/* ⚠️ Une bande « Accès rapide » de quatre cartes — Équipements,
                Préventif, Inventaire, Santé — occupait ici toute la largeur,
                chacune ornée d'un disque de couleur. Les quatre destinations
                figurent déjà dans les onglets de la page ET dans la grille
                de modules ci-dessus : c'était le troisième chemin vers les
                mêmes écrans. Retirée le 19/10/2026. */}

            {/* ══════════════════════════════════════════════════════════
                INDICATEURS CALCULÉS
                ══════════════════════════════════════════════════════════
                Trois mesures, et la phrase qui dit d'où elles viennent.
                Quand la mesure n'existe pas, on écrit « — » : une jauge à
                zéro laisse croire à une performance nulle, ce qui est faux
                et injuste pour le locataire. */}
            <section aria-labelledby="titre-indicateurs">
              <h2 id="titre-indicateurs" className="font-mono text-eyebrow uppercase text-ink-mute mb-3">
                Indicateurs de maintenance
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <IndicateurCalcule
                  libelle="Taux de résolution"
                  valeur={pourcent(indicateurs?.tauxResolution)}
                  origine={
                    indicateurs?.tauxResolution == null
                      ? "aucune intervention enregistrée"
                      : `sur ${indicateurs.totalInterventions} intervention(s)`
                  }
                  jauge={indicateurs?.tauxResolution ?? null}
                />
                <IndicateurCalcule
                  libelle="Temps moyen de réparation"
                  valeur={heures(indicateurs?.mttrHeures)}
                  origine={
                    indicateurs?.mttrHeures == null
                      ? "aucun correctif clos avec sa durée réelle"
                      : "moyenne des correctifs clos"
                  }
                  /* Une durée n'a pas de maximum : la jauge serait arbitraire. */
                  jauge={null}
                />
                <IndicateurCalcule
                  libelle="Part du préventif"
                  valeur={pourcent(indicateurs?.tauxPreventif)}
                  origine={
                    indicateurs?.tauxPreventif == null
                      ? "aucune intervention enregistrée"
                      : "des interventions créées"
                  }
                  jauge={indicateurs?.tauxPreventif ?? null}
                />
              </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                ACTIVITÉ SUR DOUZE MOIS
                ══════════════════════════════════════════════════════════
                Deux graphiques traçaient la MÊME série : une aire sur six
                mois, puis des barres sur douze. On garde les douze mois,
                qui portent la saisonnalité. Les aplats en dégradé des
                aires ont disparu avec le premier. */}
            {aucuneActivite && (
              <p className="border border-rule bg-paper px-5 py-4 text-sm text-ink-soft">
                <span className="font-medium text-ink">Aucune intervention enregistrée à ce jour.</span>{" "}
                La courbe ci-dessous restera à zéro tant qu'aucun ordre de travail n'aura été créé.
                Elle reflète vos données, et rien d'autre.
              </p>
            )}
            <section className="border border-rule bg-white" aria-labelledby="titre-activite">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-rule">
                <h2 id="titre-activite" className="font-serif text-title font-medium text-ink">
                  Activité sur douze mois
                </h2>
                <span className="font-mono text-eyebrow uppercase text-ink-mute">Interventions créées</span>
              </div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={evolutionDouzeMois} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="#D3DCE5" vertical={false} />
                    <XAxis dataKey="mois" tick={{ fontSize: 12, fill: "#56657A" }} axisLine={{ stroke: "#D3DCE5" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#56657A" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: "#F4F7FA" }}
                      contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#D3DCE5", borderRadius: 0, fontSize: 13 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 13, color: "#3A4A60" }} />
                    <Bar dataKey="preventif" name="Préventif" fill={COULEUR_SERIE.preventif} />
                    <Bar dataKey="correctif" name="Correctif" fill={COULEUR_SERIE.correctif} />
                    <Bar dataKey="urgent" name="Urgent" fill={COULEUR_SERIE.urgent} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                RÉPARTITION DU PARC
                ══════════════════════════════════════════════════════════
                ⚠️ Ce camembert retombait sur un jeu de données fabriqué —
                « Moteurs 12, Pompes 8, Compresseurs 5, Convoyeurs 6,
                Autres 4 » — dès que dashboardData était absent, c'est-à-dire
                PRÉCISÉMENT en cas d'échec de l'API : la page affichait alors
                son bandeau rouge d'erreur et, juste en dessous, 35
                équipements qui n'existent pas. Le camembert à sept teintes
                cède en outre la place à des barres : sur un parc réel, un
                nombre se lit, une part d'anneau se devine. */}
            {dashboardData?.equipmentByType && Object.keys(dashboardData.equipmentByType).length > 0 && (
              <section className="border border-rule bg-white" aria-labelledby="titre-parc-type">
                <h2 id="titre-parc-type" className="font-serif text-title font-medium text-ink px-5 py-4 border-b border-rule">
                  Répartition du parc par type
                </h2>
                <ul className="divide-y divide-rule">
                  {Object.entries(dashboardData.equipmentByType)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, nombre]) => {
                      const total = Object.values(dashboardData.equipmentByType).reduce((a, b) => a + b, 0);
                      const part = total > 0 ? Math.round((nombre / total) * 100) : 0;
                      return (
                        <li key={type} className="flex items-center gap-4 px-5 py-3">
                          <span className="text-sm text-ink w-48 shrink-0 truncate first-letter:uppercase">{type}</span>
                          <span className="flex-1 h-1.5 bg-paper-deep" role="presentation">
                            <span className="block h-full bg-signal" style={{ width: `${part}%` }} />
                          </span>
                          <span className="font-serif text-lg text-ink w-10 text-right shrink-0">{nombre}</span>
                          <span className="font-mono text-xs text-ink-mute w-12 text-right shrink-0">{part} %</span>
                        </li>
                      );
                    })}
                </ul>
              </section>
            )}
          </div>
        )}

        {/* Équipements uniquement */}
        {!showAdminModal && activeTab === "equipment" && (
          <EquipmentManagement />
        )}

        {/* Ordres de travail uniquement */}
        {!showAdminModal && activeTab === "work-orders" && (
          <WorkOrderManagement />
        )}

        {/* Inventaire uniquement */}
        {!showAdminModal && activeTab === "inventory" && (
          <InventorySimple />
        )}
        
        {/* ══════════════════════════════════════════════════════════
            ALERTES
            ══════════════════════════════════════════════════════════
            Cet onglet — l'un des cinq de la navigation principale de la
            GMAO — affichait « Gestion des alertes système en cours de
            développement », alors que l'écran `/smart-alerts` existe et
            fonctionne. Annoncer un chantier à un industriel qui évalue
            l'outil est le plus sûr moyen de perdre sa confiance.
            On montre donc les alertes réellement remontées par l'API du
            tableau de bord, et on renvoie vers l'écran complet. */}
        {!showAdminModal && activeTab === "alerts" && (
          <div className="space-y-6">
            <EnTetePage
              surTitre="GMAO"
              titre="Alertes"
              phrase="Les remontées des équipements et des capteurs qui demandent une décision."
              action={
                <ActionPrincipale href="/smart-alerts">
                  <Bell className="w-4 h-4" />
                  Centre d'alertes
                </ActionPrincipale>
              }
            />

            {dashboardData?.recentAlerts && dashboardData.recentAlerts.length > 0 ? (
              <ul className="border border-rule bg-white">
                {dashboardData.recentAlerts.map((alerte) => (
                  <li key={alerte.id} className="border-b border-rule last:border-b-0 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{alerte.title}</p>
                        {alerte.message && (
                          <p className="text-sm text-ink-soft mt-1">{alerte.message}</p>
                        )}
                        <p className="font-mono text-xs text-ink-mute mt-2">
                          {alerte.alertType}
                          {alerte.createdAt &&
                            ` · ${new Date(alerte.createdAt).toLocaleString("fr-FR")}`}
                        </p>
                      </div>
                      <PuceEtat registre={registreGravite(alerte.severity)}>{alerte.severity}</PuceEtat>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EtatVide
                icone={Bell}
                titre="Aucune alerte en cours"
                phrase="Les alertes apparaissent ici dès qu'un seuil est franchi sur un équipement ou qu'un capteur sort de sa plage nominale."
                action={
                  <ActionSecondaire href="/sensor-hub">
                    <Radio className="w-4 h-4" />
                    Configurer les capteurs
                  </ActionSecondaire>
                }
              />
            )}
          </div>
        )}

        {/* Admin Tabs - Only show if activeAdminTab is set */}
        {showAdminModal && activeAdminTab === "maintenance" && (
          <PreventiveMaintenance />
        )}

        {showAdminModal && activeAdminTab === "history" && (
          <HistoryManagement />
        )}

        {showAdminModal && activeAdminTab === "procurement" && (
          <div className="space-y-6">
            <PurchaseOrderCreator />
            <ProcurementDashboard />
          </div>
        )}

        {showAdminModal && activeAdminTab === "reports" && (
          <MaintenanceReports />
        )}

        {showAdminModal && activeAdminTab === "analytics" && (
          <div className="space-y-6">
            <EnTetePage
              surTitre="GMAO"
              titre="Indicateurs"
              phrase="Ce que la plateforme mesure sur votre parc, et ce qu'elle ne mesure pas encore."
              action={
                <ActionPrincipale onClick={() => setShowAnalyticsModal(true)}>
                  <BarChart3 className="w-4 h-4" />
                  Analyses détaillées
                </ActionPrincipale>
              }
            />

            <div className="grid md:grid-cols-2 gap-4">
              <div className="border border-rule bg-white p-5">
                <h3 className="font-serif text-title font-medium text-ink">Part du préventif</h3>
                {/* ⚠️ « Efficacité maintenance » et « satisfaction qualité »
                    étaient écrites en dur. Elles n'ont aucune source dans
                    cette base ; le taux préventif, lui, se calcule vraiment. */}
                <p className={`font-serif text-3xl mt-3 leading-none ${indicateurs?.tauxPreventif == null ? 'text-ink-mute' : 'text-ink'}`}>
                  {pourcent(indicateurs?.tauxPreventif)}
                </p>
                <p className="text-sm text-ink-soft mt-2">
                  {indicateurs?.tauxPreventif == null
                    ? 'aucune intervention enregistrée'
                    : `des ${indicateurs.totalInterventions} intervention(s) créées`}
                </p>
                {indicateurs?.tauxPreventif != null && (
                  <div className="mt-3 h-1 bg-paper-deep" role="presentation">
                    <div className="h-full bg-signal" style={{ width: `${jauge(indicateurs.tauxPreventif)}%` }} />
                  </div>
                )}
                <p className="text-sm text-ink-mute mt-4 pt-4 border-t border-rule">
                  L'efficacité de la maintenance et la satisfaction qualité ne sont pas encore
                  mesurées par la plateforme.
                </p>
              </div>

              <div className="border border-rule bg-white p-5">
                <h3 className="font-serif text-title font-medium text-ink">Objectifs</h3>
                {/* ⚠️ Cibles ET mesures étaient inventées : « disponibilité
                    94,7 % pour une cible de 95 % », « MTBF 168 h », « budget
                    47,2 k€ sur 50 k€ ». Aucune cible n'est configurable dans
                    Maintrix aujourd'hui, et aucune de ces mesures n'existe. */}
                <div className="space-y-2 text-sm text-ink-soft mt-3">
                  <p>Aucun objectif n'est défini pour cette organisation.</p>
                  <p className="text-ink-mute">
                    Disponibilité, MTBF et budget ne sont pas encore mesurés : aucun écart à une
                    cible ne peut être affiché ici.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}


        {showAdminModal && activeAdminTab === "health-dashboard" && (
          <EquipmentHealthDashboard />
        )}

        {showAdminModal && activeAdminTab === "validation" && (
          <div className="space-y-6">
            <PurchaseOrderWorkflowDemo 
              currentUserRole="Chef de Service"
              validationLevel={1}
            />
            <ValidationDashboard
              userId={1}
              userRole="Chef de Service"
              validationLevel={1}
              canValidateWorkOrders={true}
              canValidatePurchaseOrders={true}
            />
          </div>
        )}

        {showAdminModal && activeAdminTab === "company-config" && (
          <div className="space-y-6">
            <ThresholdConfiguration />
            <CompanyLetterheadConfig />
          </div>
        )}
      </main>

      {/* ⚠️ Une modale « Toutes les alertes » occupait ici 45 lignes. Elle
          était elle aussi inatteignable — rien n'appelait
          `setShowAlertsModal(true)` — et son contenu faisait doublon avec
          l'onglet « Alertes », qui affiche désormais les mêmes alertes à
          plat, sans boîte de dialogue à ouvrir. Retirée le 19/10/2026. */}

      {/* Analyses détaillées */}
      <Dialog open={showAnalyticsModal} onOpenChange={setShowAnalyticsModal}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-title font-medium text-ink flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-ink-mute" />
              Analyses détaillées
            </DialogTitle>
            <DialogDescription className="text-ink-soft">
              Ce que la plateforme mesure aujourd'hui sur votre parc, et ce qu'elle ne mesure pas encore.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Advanced KPIs */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Efficacité Globale</h3>
                  <Gauge className="w-5 h-5 text-blue-600" />
                </div>
                {/* ⚠️ OEE, taux d'utilisation et taux de performance ne sont
                    calculés nulle part dans cette base. Les deux derniers
                    étaient écrits en dur — « 85,2 % » et « 92,1 % », avec
                    leurs jauges — juste à côté d'un OEE honnêtement laissé à
                    « — ». La passe de nettoyage du 11/10 avait traité la
                    première ligne et laissé les deux suivantes. */}
                <div className="space-y-2 text-sm text-ink-soft">
                  <p>Aucun de ces trois taux n'est mesuré sur cet environnement.</p>
                  <p className="text-ink-mute">
                    L'efficacité globale se calcule à partir des temps d'ouverture, d'arrêt et
                    de cadence des équipements. Ces relevés ne sont pas encore collectés.
                  </p>
                  <Link href="/oee" className="inline-flex items-center gap-1 text-signal hover:underline">
                    Saisir les données OEE
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-title font-medium text-ink">Coûts et budget</h3>
                  <DollarSign className="w-5 h-5 text-ink-mute" />
                </div>
                {/* ⚠️ « Coût par heure productive 127 € », « Économies
                    préventif vs correctif 12,3 k€ », « ROI maintenance
                    prédictive +24 % » : trois constantes. Un ROI annoncé à un
                    industriel sur un chiffre inventé est la faute la plus
                    coûteuse que puisse commettre cet écran. */}
                <div className="space-y-2 text-sm text-ink-soft">
                  <p>Aucun coût de maintenance n'est rattaché aux interventions.</p>
                  <p className="text-ink-mute">
                    Les coûts se calculent à partir des heures passées, des pièces consommées et
                    des prestations externes renseignées sur chaque ordre de travail.
                  </p>
                  <Link href="/budget" className="inline-flex items-center gap-1 text-signal hover:underline">
                    Ouvrir le budget
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Prédictions IA</h3>
                  <Brain className="w-5 h-5 text-signal-deep" />
                </div>
                {/* ⚠️ « 7 pannes évitées », « 94,3 % de précision » : des
                    résultats annoncés pour un module qui n'a rien produit.
                    C'est le pire endroit pour inventer — on y promet ce que la
                    plateforme sait faire. */}
                <div className="space-y-2 text-sm text-ink-soft">
                  <p>Aucune prédiction disponible.</p>
                  <p className="text-ink-mute">
                    Le diagnostic prédictif a besoin d'un historique d'interventions
                    et de relevés avant de produire des résultats.
                  </p>
                </div>
              </Card>
            </div>

            {/* ⚠️ Deux cartes ont été retirées ici le 19/10/2026.
                « Analyse des tendances » affichait trois constats écrits en
                dur — « MTBF en hausse de 12 % sur 3 mois », « réduction de
                8 % des coûts de maintenance », « modèles prédictifs
                améliorés de 15 % » — présentés comme des mesures de
                l'installation du client. Aucune de ces trois valeurs n'a de
                source dans cette base, et le MTBF n'y est même pas calculé.
                « Recommandations prioritaires » listait trois conseils
                numérotés, eux aussi fixes, identiques pour tous les
                locataires : « réduire MTTR de 15 % », « ajouter des capteurs
                sur 3 équipements critiques ». Des recommandations réelles
                existent — elles vivent sur /maintenance-recommendations et
                dérivent des données du locataire. */}
            <Card className="p-6">
              <h3 className="font-serif text-title font-medium text-ink mb-2">Tendances et recommandations</h3>
              <p className="text-sm text-ink-soft max-w-2xl">
                Les tendances de fiabilité et les recommandations d'intervention se construisent à
                partir de l'historique des ordres de travail et des relevés de capteurs. Elles sont
                présentées sur leur écran dédié, avec le détail de ce qui les justifie.
              </p>
              <Link
                href="/maintenance-recommendations"
                className="inline-flex items-center gap-1 text-sm text-signal hover:underline mt-3"
              >
                Voir les recommandations
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </Card>

            {/* ⚠️ Une carte « Comparaison Sectorielle » annonçait « votre
                disponibilité 94,7 %, +2,1 % vs secteur », « votre MTBF 168 h,
                +18 h vs secteur », « coût/h 127 €, -15 € vs secteur ». Ni ces
                mesures ni ce référentiel sectoriel n'existent dans Maintrix :
                tout était écrit en dur. Promettre à un industriel qu'il fait
                mieux que son secteur, sur des chiffres inventés, est la faute
                la plus grave de ce tableau de bord. Carte retirée le
                2026-10-11 ; elle reviendra le jour où ces données existeront. */}
          </div>
        </DialogContent>
      </Dialog>

      {/* ⚠️ Une SECONDE modale « Centre d'Alertes Intelligent » occupait
          ici une soixantaine de lignes, pilotée par le MÊME état
          `showAlertsModal` que la modale « Toutes les alertes »
          ci-dessus : les deux se seraient affichées l'une sur l'autre.
          Elle affichait quatre compteurs écrits en dur — 3 critiques,
          7 importantes, 5 prédictives, 12 résolues — qu'aucun locataire
          n'avait produits. Et elle était inatteignable :
          `setShowAlertsModal(true)` n'est appelé nulle part. Code mort
          et chiffres inventés, retirés le 19/10/2026. Les alertes réelles
          sont dans l'onglet « Alertes » et sur /smart-alerts. */}
    </div>
  );
}
