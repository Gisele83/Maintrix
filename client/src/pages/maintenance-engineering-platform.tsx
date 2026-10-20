import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes, Wrench, Gauge, ClipboardList, BookOpen, Box, Brain, BarChart3,
  ArrowRight, Lock, ChevronDown, Factory, AlertTriangle, Package, Fish, Plus, CalendarCheck,
} from "lucide-react";
import { useEntitlements } from "@/hooks/useEntitlements";
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs } from "@/components/indicateurs";

/**
 * ═══════════════════════════════════════════════════════════════════
 * INGÉNIERIE DE MAINTENANCE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Cet écran était un document d'architecture : 497 mots de texte, aucune
 * requête, aucune donnée. Il s'ouvrait sur une dénégation (« Ce n'est plus
 * une GMAO — c'est une plateforme d'ingénierie de maintenance à 8 piliers »)
 * suivie d'un état d'avancement du développement (« 8 / 8 piliers ont du
 * code réel aujourd'hui — voir ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md
 * pour le détail »). Chaque carte portait ensuite son propre journal de
 * chantier : « CRUD équipements opérationnel », « Cœur historique de
 * Maintrix », « les 5 briques (Health Score → RUL → Anomaly → Failure
 * Prediction → OT auto) tournent maintenant ensemble », « embeddings
 * OpenAI », « consulté par le pipeline diagnostic avant l'appel à Claude ».
 *
 * Ce sont des notes d'équipe de développement. Un ingénieur de maintenance
 * qui ouvre cet écran ne cherche pas à savoir ce qui a été codé : il cherche
 * l'état de son parc et l'outil qui lui permet d'agir.
 *
 * La page devient donc un espace de travail : l'état réel du parc en haut,
 * les méthodes d'ingénierie et leur volume réel au milieu, les domaines en
 * accès direct en bas. Le détail d'architecture est replié derrière un
 * dépliant pour qui le cherche — il n'ouvre plus l'écran.
 */

interface Domaine {
  cle: string;
  titre: string;
  /** UNE ligne. Ce qu'on vient y faire, pas comment c'est construit. */
  resume: string;
  icone: React.ComponentType<{ className?: string }>;
  liens: { libelle: string; href: string }[];
}

const DOMAINES: Domaine[] = [
  {
    cle: "actifs",
    titre: "Gestion des actifs",
    resume: "Registre des équipements, de l'acquisition à la réforme.",
    icone: Boxes,
    liens: [
      { libelle: "Équipements", href: "/equipment-management" },
      { libelle: "Cycle de vie", href: "/asset-lifecycle" },
    ],
  },
  {
    cle: "gmao",
    titre: "GMAO",
    resume: "Ordres de travail, planification et exécution sur le terrain.",
    icone: Wrench,
    liens: [
      { libelle: "Vue d'ensemble", href: "/gmao" },
      { libelle: "Ordres de travail", href: "/work-orders" },
      { libelle: "Exécution", href: "/maintenance-execution" },
    ],
  },
  {
    cle: "apm",
    titre: "Performance des actifs",
    resume: "Santé des machines, durée de vie restante, prédiction de panne.",
    icone: Gauge,
    liens: [
      { libelle: "Maintenance prédictive", href: "/predictive-engine" },
      { libelle: "Santé des machines", href: "/machine-health" },
    ],
  },
  {
    cle: "smm",
    titre: "Management de la maintenance",
    resume: "Procédures, contrôles qualité, non-conformités et audits.",
    icone: ClipboardList,
    liens: [{ libelle: "Ouvrir", href: "/smm" }],
  },
  {
    cle: "knowledge_hub",
    titre: "Documentation technique",
    resume: "Schémas, notices, bulletins techniques et normes IEC/ISO.",
    icone: BookOpen,
    liens: [{ libelle: "Ouvrir", href: "/knowledge-hub" }],
  },
  {
    cle: "digital_twin",
    titre: "Jumeau numérique",
    resume: "Un modèle par équipement, alimenté par les relevés de capteurs.",
    icone: Box,
    liens: [{ libelle: "Ouvrir", href: "/digital-twin" }],
  },
  {
    cle: "ia",
    titre: "Diagnostic assisté",
    resume: "Hypothèses de panne, assistant de maintenance, graphe de causalité.",
    icone: Brain,
    liens: [
      { libelle: "Diagnostic", href: "/smart-diagnostic" },
      { libelle: "Assistant", href: "/ai-assistant" },
      { libelle: "Graphe de causalité", href: "/knowledge-graph" },
    ],
  },
  {
    cle: "analytics",
    titre: "Indicateurs et rapports",
    resume: "Tableaux de bord consolidés et rapports de maintenance.",
    icone: BarChart3,
    liens: [{ libelle: "Ouvrir", href: "/advanced-reporting" }],
  },
];

/** Enchaînement des domaines, replié par défaut. */
const ENCHAINEMENT = [
  "Actif", "Surveillance", "Détection d'anomalie", "Ordre de travail",
  "Exécution", "Contrôle qualité", "Retour d'expérience", "Documentation",
  "Diagnostic", "Maintenance prédictive", "Indicateurs",
];

interface ParcGMAO {
  equipmentCount: number;
  activeWorkOrdersCount: number;
  pendingWorkOrdersCount: number;
  criticalAlertsCount: number;
  lowStockPartsCount: number;
  contexte?: {
    equipementsIndisponibles: number;
    otEnRetard: number;
    otUrgents: number;
    preventifSous7Jours: number;
    piecesEnRupture: number;
  };
}

interface MethodesIngenierie {
  expertRules: { count: number };
  rca: { count: number };
  fmea: { count: number };
  rcm: { count: number };
}

export default function MaintenanceEngineeringPlatformPage() {
  const { enabledDomains, minEditionFor, isLoading: chargeLicence } = useEntitlements();
  const [detailOuvert, setDetailOuvert] = useState(false);

  // L'écran affiche l'état réel du parc : c'est la seule chose qui justifie
  // de l'ouvrir chaque matin. Les deux requêtes existent déjà et sont
  // cloisonnées par locataire côté serveur.
  const { data: parc } = useQuery<ParcGMAO>({ queryKey: ["/api/gmao-dashboard"] });
  const { data: methodes } = useQuery<MethodesIngenierie>({
    queryKey: ["/api/engineering-expertise/overview"],
  });

  const c = parc?.contexte;
  /** Assemble les précisions non nulles ; à défaut, une phrase neutre. */
  const precision = (parts: Array<[number, string]>, aDefaut: string) => {
    const dits = parts.filter(([n]) => n > 0).map(([n, libelle]) => `${n} ${libelle}`);
    return dits.length ? dits.join(" · ") : aDefaut;
  };

  return (
    <AppShell filAriane={[{ libelle: "Ingénierie de maintenance" }]}>
      <div className="space-y-8">
        <EnTetePage
          surTitre="Plateforme"
          titre="Ingénierie de maintenance"
          phrase="Les méthodes, les référentiels et les outils qui gouvernent la maintenance du parc."
          actionsSecondaires={
            <ActionSecondaire href="/maintenance-plan">
              <CalendarCheck className="w-4 h-4" />
              Plan de maintenance
            </ActionSecondaire>
          }
          action={
            <ActionPrincipale href="/rca">
              <Plus className="w-4 h-4" />
              Nouvelle analyse
            </ActionPrincipale>
          }
        />

        {/* ══════════════════════════════════════════════════════════
            LE PARC AUJOURD'HUI
            ══════════════════════════════════════════════════════════
            Quatre chiffres mesurés, chacun suivi de ce qu'il implique.
            Chaque tuile mène à l'écran qui permet d'agir : un indicateur
            qu'on ne peut pas suivre d'un clic n'est qu'une décoration. */}
        <section aria-labelledby="titre-parc">
          <h2 id="titre-parc" className="font-mono text-eyebrow uppercase text-ink-mute mb-3">
            Le parc aujourd'hui
          </h2>
          <RangeeIndicateurs>
            <Indicateur
              libelle="Équipements"
              valeur={parc?.equipmentCount ?? "—"}
              precision={precision(
                [[c?.equipementsIndisponibles ?? 0, "indisponible(s)"]],
                (parc?.equipmentCount ?? 0) > 0 ? "tous en service" : "parc à déclarer",
              )}
              icone={Factory}
              alerte={(c?.equipementsIndisponibles ?? 0) > 0}
              href="/equipment-management"
            />
            {/* ⚠️ Même défaut que sur la GMAO, et même correction :
                `activeWorkOrdersCount` ne compte que `status = 'in_progress'`.
                Cet écran affichait donc « Ordres de travail : 0 » à un parc
                qui comptait 26 interventions en attente d'affectation. */}
            <Indicateur
              libelle="Ordres ouverts"
              valeur={
                parc ? (parc.pendingWorkOrdersCount ?? 0) + (parc.activeWorkOrdersCount ?? 0) : "—"
              }
              precision={precision(
                [
                  [c?.otUrgents ?? 0, "urgent(s)"],
                  [c?.otEnRetard ?? 0, "en retard"],
                  [parc?.pendingWorkOrdersCount ?? 0, "en attente"],
                  [parc?.activeWorkOrdersCount ?? 0, "en cours"],
                ],
                "aucun ordre ouvert",
              )}
              icone={Wrench}
              alerte={
                (c?.otEnRetard ?? 0) > 0 ||
                (c?.otUrgents ?? 0) > 0 ||
                (parc?.pendingWorkOrdersCount ?? 0) > 0
              }
              href="/work-orders"
            />
            <Indicateur
              libelle="Alertes critiques"
              valeur={parc?.criticalAlertsCount ?? "—"}
              precision={
                (parc?.criticalAlertsCount ?? 0) > 0 ? "à traiter sans délai" : "aucune en cours"
              }
              icone={AlertTriangle}
              alerte={(parc?.criticalAlertsCount ?? 0) > 0}
              href="/smart-alerts"
            />
            <Indicateur
              libelle="Préventif sous 7 jours"
              valeur={c?.preventifSous7Jours ?? "—"}
              precision={
                (c?.preventifSous7Jours ?? 0) > 0 ? "à planifier cette semaine" : "aucune échéance proche"
              }
              icone={CalendarCheck}
              alerte={(c?.preventifSous7Jours ?? 0) > 0}
              href="/maintenance-plan"
            />
          </RangeeIndicateurs>
        </section>

        {/* ══════════════════════════════════════════════════════════
            MÉTHODES D'INGÉNIERIE
            ══════════════════════════════════════════════════════════
            Ce que l'ingénieur a réellement produit, compté en base. Un
            volume à zéro reste affiché : c'est une information, et il mène
            vers l'écran qui permet de créer la première analyse. */}
        <section aria-labelledby="titre-methodes">
          <h2 id="titre-methodes" className="font-mono text-eyebrow uppercase text-ink-mute mb-3">
            Méthodes d'ingénierie
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-rule border border-rule">
            {[
              { libelle: "Analyses de causes racines", valeur: methodes?.rca.count, href: "/rca", icone: Fish },
              { libelle: "AMDEC", valeur: methodes?.fmea.count, href: "/fmea", icone: AlertTriangle },
              { libelle: "Maintenance basée fiabilité", valeur: methodes?.rcm.count, href: "/engineering-expertise", icone: ClipboardList },
              { libelle: "Règles de diagnostic", valeur: methodes?.expertRules.count, href: "/engineering-expertise", icone: Brain },
            ].map((m) => (
              <Link
                key={m.libelle}
                href={m.href}
                className="bg-white p-5 group transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-mono text-eyebrow uppercase text-ink-mute">{m.libelle}</p>
                  <m.icone className="w-4 h-4 text-ink-mute shrink-0" />
                </div>
                <p className="font-serif text-3xl text-ink mt-3 leading-none">{m.valeur ?? "—"}</p>
                <span className="inline-flex items-center gap-1 text-sm text-ink-soft mt-2 group-hover:text-signal transition-colors">
                  Ouvrir
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            DOMAINES
            ══════════════════════════════════════════════════════════
            Huit entrées, une ligne de description chacune, et les écrans
            en accès direct. Le badge de licence n'apparaît QUE lorsqu'un
            domaine n'est pas compris dans l'abonnement : répéter
            « Inclus — Starter » sur sept cartes sur huit n'apprenait rien
            et occupait un tiers de chaque carte. */}
        <section aria-labelledby="titre-domaines">
          <h2 id="titre-domaines" className="font-mono text-eyebrow uppercase text-ink-mute mb-3">
            Domaines
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-px bg-rule border border-rule">
            {DOMAINES.map((domaine) => {
              const Icone = domaine.icone;
              const inclus = chargeLicence || enabledDomains.length === 0 || enabledDomains.includes(domaine.cle);
              const edition = minEditionFor(domaine.cle);
              return (
                <div key={domaine.cle} className="bg-white p-5 flex flex-col">
                  <Icone className="w-5 h-5 text-ink-mute" />
                  <h3 className="font-serif text-title font-medium text-ink mt-3">{domaine.titre}</h3>
                  <p className="text-sm text-ink-soft mt-1.5 flex-1">{domaine.resume}</p>

                  {!inclus && edition && (
                    <p className="inline-flex items-center gap-1.5 mt-3 text-xs text-ink-mute">
                      <Lock className="w-3 h-3 shrink-0" />
                      Nécessite l'édition {edition.displayName}
                    </p>
                  )}

                  <ul className="mt-4 border-t border-rule">
                    {domaine.liens.map((lien) => (
                      <li key={lien.href} className="border-b border-rule last:border-b-0">
                        <Link
                          href={lien.href}
                          className="flex items-center justify-between gap-2 py-2 text-sm text-ink-soft hover:text-signal transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                        >
                          {lien.libelle}
                          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            ENCHAÎNEMENT — replié
            ══════════════════════════════════════════════════════════
            L'information est utile à qui prend ses marques, inutile tous
            les autres jours. Divulgation progressive : un dépliant, pas
            un bandeau permanent en haut de page. */}
        <section className="border border-rule bg-white">
          <button
            type="button"
            onClick={() => setDetailOuvert((v) => !v)}
            aria-expanded={detailOuvert}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal"
          >
            <span className="text-sm font-medium text-ink">Comment ces domaines s'enchaînent</span>
            <ChevronDown
              className={`w-4 h-4 text-ink-mute shrink-0 transition-transform ${detailOuvert ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {detailOuvert && (
            <div className="px-5 pb-5 border-t border-rule pt-4">
              <p className="text-sm text-ink-soft mb-4 max-w-3xl">
                Du signal capté sur l'équipement jusqu'aux indicateurs, chaque étape alimente la
                suivante : une anomalie détectée crée un ordre de travail, dont l'exécution produit
                un retour d'expérience qui enrichit le diagnostic.
              </p>
              <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
                {ENCHAINEMENT.map((etape, i) => (
                  <li key={etape} className="flex items-center gap-2">
                    <span className="text-sm text-ink-soft bg-paper-deep border border-rule px-2.5 py-1 whitespace-nowrap">
                      {etape}
                    </span>
                    {i < ENCHAINEMENT.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-ink-mute shrink-0" aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        {/* Stock sous seuil : rangé ici parce qu'il concerne la préparation
            des interventions, pas le pilotage du parc. */}
        {(parc?.lowStockPartsCount ?? 0) > 0 && (
          <Link
            href="/inventaire"
            className="flex items-center gap-3 border border-rule bg-white px-5 py-4 text-sm transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal"
          >
            <Package className="w-4 h-4 text-ink-mute shrink-0" aria-hidden="true" />
            <span className="text-ink">
              <span className="font-medium">{parc?.lowStockPartsCount}</span> référence(s) sous le
              seuil de réapprovisionnement
              {(c?.piecesEnRupture ?? 0) > 0 && `, dont ${c?.piecesEnRupture} en rupture`}.
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-ink-mute ml-auto shrink-0" aria-hidden="true" />
          </Link>
        )}
      </div>
    </AppShell>
  );
}
