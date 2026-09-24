import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Menu, X } from "lucide-react";
import { BILLING_ENABLED, IS_TEST_ENVIRONMENT } from "@/lib/feature-flags";

/**
 * Page d'accueil publique.
 *
 * Positionnement : Maintrix est une plateforme de SUPERVISION et de CONTRÔLE
 * ADAPTATIF des installations industrielles, avec GMAO et maintenance
 * prédictive intégrées. La GMAO est un module — le plus utilisé au quotidien,
 * d'où la place qu'elle garde ici — mais le visiteur doit comprendre dès
 * l'ouverture que la plateforme ne s'y limite pas.
 *
 * Parti pris éditorial : dire concrètement ce que fait l'outil, sans chiffre
 * qu'on ne peut pas prouver. Chaque capacité citée correspond à un module
 * existant du serveur :
 *   supervision      server/integrations/{iot,advanced-iot,scada}-connector.ts
 *                    (OPC UA, Modbus, MQTT), /api/machine-health, /api/smart-alerts
 *   contrôle adaptatif  server/cognitive-kernel — niveaux d'autonomie 0 à 5,
 *                    verrouillage par permis de travail dès l'exécution supervisée
 *   prédictif        server/predictive-maintenance-engine.ts (santé, anomalies,
 *                    durée de vie résiduelle Wiener/Gamma), jumeau numérique
 *   adaptation       server/federated-adaptation.ts
 *
 * Parti pris visuel : une page qui se lit comme un document technique soigné
 * (fond clair, filets fins, numérotation, titres à empattements) plutôt que les
 * codes génériques du SaaS.
 */

const CONTACT_EMAIL = "contact@techlearn-saem.com";

type Lien = { href: string; label: string };

const LIENS_NAV: Lien[] = [
  { href: "#plateforme", label: "Plateforme" },
  { href: "#supervision", label: "Supervision" },
  { href: "#predictif", label: "Prédictif" },
  { href: "#gmao", label: "GMAO" },
  ...(BILLING_ENABLED ? [{ href: "#tarifs", label: "Tarifs" }] : []),
];

const PILIERS = [
  {
    ancre: "#supervision",
    titre: "Supervision et contrôle adaptatif",
    texte:
      "Les mesures de vos installations en temps réel, des alertes qui tiennent compte du contexte, et des actions de pilotage dont vous réglez le degré d'autonomie.",
  },
  {
    ancre: "#predictif",
    titre: "Maintenance prédictive",
    texte:
      "L'état de santé de chaque équipement, les dérives détectées avant la panne et une estimation de la durée de vie restante, avec sa marge d'incertitude.",
  },
  {
    ancre: "#gmao",
    titre: "GMAO intégrée",
    texte:
      "Équipements, ordres de travail, préventif, pièces, budget et conformité : l'organisation complète du service maintenance.",
  },
];

const SUPERVISION = [
  {
    titre: "Connexion aux installations",
    texte: "Capteurs et systèmes existants raccordés par OPC UA, Modbus, MQTT ou via votre SCADA.",
  },
  {
    titre: "État en temps réel",
    texte: "Mesures, santé des machines et écarts à la normale, équipement par équipement.",
  },
  {
    titre: "Alertes contextualisées",
    texte: "Une alerte rapproche la mesure de l'historique de la machine, pas seulement d'un seuil.",
  },
  {
    titre: "Autonomie graduée",
    texte:
      "Six niveaux, de la simple surveillance à l'exécution supervisée. Par défaut, la plateforme propose et l'humain décide.",
  },
  {
    titre: "Sécurité des commandes",
    texte: "Toute action exécutée sur une installation est verrouillée par le permis de travail en vigueur.",
  },
  {
    titre: "Apprentissage par site",
    texte: "Les modèles s'ajustent au comportement propre de chaque site sans perdre ce que les autres ont appris.",
  },
];

const PREDICTIF = [
  {
    titre: "Indice de santé",
    texte: "Une note par équipement, calculée à partir de ses mesures et de ses interventions.",
  },
  {
    titre: "Détection d'anomalies",
    texte: "Les écarts au comportement habituel de la machine, repérés avant qu'ils ne deviennent une panne.",
  },
  {
    titre: "Durée de vie résiduelle",
    texte: "Une estimation assortie d'un intervalle de confiance, et non une date présentée comme certaine.",
  },
  {
    titre: "Jumeau numérique",
    texte: "Un modèle physique calé sur chaque équipement, confronté en continu à ses mesures réelles.",
  },
];

const MODULES_GMAO = [
  {
    titre: "Équipements",
    texte: "Le parc, ses emplacements, ses documents et son historique, machine par machine.",
  },
  {
    titre: "Ordres de travail",
    texte: "Demandes, planification, affectation, exécution et clôture des interventions.",
  },
  {
    titre: "Maintenance préventive",
    texte: "Des plans à échéance calendaire ou au compteur, transformés en ordres de travail.",
  },
  {
    titre: "Pièces et budget",
    texte: "Le stock de pièces détachées, les consommations et le suivi des dépenses.",
  },
  {
    titre: "Analyses",
    texte: "Disponibilité et OEE, analyse des causes racines, AMDEC.",
  },
  {
    titre: "Conformité",
    texte: "Étalonnages des instruments, habilitations des techniciens et permis de travail, avec leurs échéances.",
  },
];

const BOUCLE = [
  {
    n: "01",
    titre: "Mesurer",
    texte: "Les capteurs et les systèmes de conduite remontent l'état réel de l'installation.",
  },
  {
    n: "02",
    titre: "Anticiper",
    texte: "Les dérives sont détectées, la durée de vie restante estimée, la cause probable proposée.",
  },
  {
    n: "03",
    titre: "Agir",
    texte: "Ajustement du pilotage dans les limites autorisées, ou ordre de travail créé et planifié dans la GMAO.",
  },
  {
    n: "04",
    titre: "Apprendre",
    texte: "Chaque intervention clôturée enrichit l'historique et affine les modèles du site.",
  },
];

const SOURCES_DIAGNOSTIC = [
  {
    titre: "Mesures de l'installation",
    texte: "Les signaux de la machine au moment où le symptôme apparaît.",
  },
  {
    titre: "Interventions passées",
    texte: "Les cas proches déjà résolus sur vos équipements, et les règles de maintenance connues.",
  },
  {
    titre: "Assistance IA",
    texte: "Une aide à la formulation des hypothèses, jamais une réponse sans source.",
  },
];

const PLANS = [
  { id: "solo", nom: "Solo", prix: "29,99 €", periode: "par mois", public: "1 utilisateur", points: ["Équipements illimités", "GMAO complète", "Diagnostic assisté", "Rapports PDF"] },
  { id: "equipe", nom: "Équipe", prix: "89,99 €", periode: "par mois", public: "2 à 5 utilisateurs", points: ["Tout le plan Solo", "Travail en équipe", "OEE et analyse des causes", "AMDEC"] },
  { id: "business", nom: "Entreprise S", prix: "189,99 €", periode: "par mois", public: "6 à 11 utilisateurs", points: ["Tout le plan Équipe", "Supervision des équipements", "Capteurs connectés", "Maintenance prédictive"] },
  { id: "enterprise", nom: "Entreprise L", prix: "Sur devis", periode: "", public: "21 utilisateurs et plus", points: ["Plusieurs sites", "Contrôle adaptatif", "Intégrations ERP et SCADA", "Support dédié"] },
];

function Filet() {
  return <div className="h-px bg-rule" aria-hidden="true" />;
}

function EnTeteSection({ numero, titre, id }: { numero: string; titre: string; id?: string }) {
  return (
    <div id={id} className="scroll-mt-24">
      <Filet />
      <div className="flex items-baseline gap-4 pt-4 pb-10">
        <span className="font-mono text-eyebrow text-signal">{numero}</span>
        <span className="font-mono text-eyebrow uppercase text-ink-mute">{titre}</span>
      </div>
    </div>
  );
}

function ListeDefinitions({ items, colonnes = 2 }: { items: { titre: string; texte: string }[]; colonnes?: 2 | 3 }) {
  return (
    <dl className={`grid gap-x-10 sm:grid-cols-2 ${colonnes === 3 ? "lg:grid-cols-3" : ""}`}>
      {items.map((m) => (
        <div key={m.titre} className="border-t border-rule py-6">
          <dt className="font-medium text-ink">{m.titre}</dt>
          <dd className="text-ink-soft mt-2 leading-relaxed">{m.texte}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Figure d'ouverture : la chaîne complète sur un cas, de la mesure à l'ordre
 * de travail. Données d'EXEMPLE, signalées comme telles.
 */
function FicheExemple() {
  return (
    <figure className="bg-white border border-rule">
      <figcaption className="flex items-center justify-between border-b border-rule px-5 py-3">
        <span className="font-mono text-eyebrow uppercase text-ink-mute">Compresseur C-02</span>
        <span className="font-mono text-eyebrow text-ink-mute">Exemple</span>
      </figcaption>

      <ol className="divide-y divide-rule">
        <li className="px-5 py-4">
          <p className="font-mono text-eyebrow uppercase text-signal">Supervision</p>
          <div className="mt-2 flex items-baseline justify-between gap-4">
            <span className="text-ink">Vibration palier moteur</span>
            <span className="font-mono text-sm text-ink">7,8 mm/s</span>
          </div>
          <p className="text-sm text-ink-mute mt-1">En hausse depuis 6 jours — habituel : 3,2 mm/s</p>
        </li>

        <li className="px-5 py-4">
          <p className="font-mono text-eyebrow uppercase text-signal">Prédiction</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-ink-mute">Santé</dt>
              <dd className="text-ink font-medium">58 / 100</dd>
            </div>
            <div>
              <dt className="text-ink-mute">Durée de vie restante</dt>
              <dd className="text-ink font-medium">18 à 31 jours</dd>
            </div>
          </dl>
          <p className="text-sm text-ink mt-3">
            Cause probable : roulement usé
            <span className="block text-ink-mute">d'après deux interventions similaires sur ce modèle</span>
          </p>
        </li>

        <li className="px-5 py-4">
          <p className="font-mono text-eyebrow uppercase text-signal">GMAO</p>
          <div className="mt-2 flex items-baseline justify-between gap-4">
            <span className="text-ink">OT-2026-0412 — remplacement du roulement</span>
          </div>
          <p className="text-sm text-ink-mute mt-1">Planifié à l'arrêt de ligne de jeudi · pièce réservée</p>
        </li>
      </ol>
    </figure>
  );
}

export default function LandingPage() {
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [contactOuvert, setContactOuvert] = useState(false);

  return (
    <div className="min-h-screen bg-paper text-ink font-sans antialiased">
      {IS_TEST_ENVIRONMENT && (
        <div className="bg-ink text-paper">
          <p className="mx-auto max-w-6xl px-5 sm:px-8 py-2 text-sm">
            <span className="font-mono text-eyebrow uppercase text-signal-light mr-3">Version de test</span>
            Les données saisies pendant les tests sont conservées lors du passage en production.
          </p>
        </div>
      )}

      {/* ── En-tête ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-paper/95 border-b border-rule">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" aria-label="Maintrix — accueil">
            <img src="/logo-maintrix.png" alt="Maintrix" width={640} height={213} className="h-9 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center gap-7" aria-label="Navigation principale">
            {LIENS_NAV.map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-ink-soft hover:text-ink transition-colors">
                {l.label}
              </a>
            ))}
            <Link href="/download" className="text-sm text-ink-soft hover:text-ink transition-colors">
              Télécharger
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/login" className="text-sm text-ink hover:text-signal transition-colors">
              Se connecter
            </Link>
            {/* ⚠️ « Créer un compte » menait à une inscription en libre service
                qui plaçait TOUS les nouveaux venus dans le même espace de travail.
                Les accès sont ouverts par l'équipe, qui crée en même temps
                l'organisation — donc un espace cloisonné. */}
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Demande d'accès à Maintrix")}`}
              className="inline-flex items-center h-10 px-4 bg-ink text-paper text-sm font-medium hover:bg-signal transition-colors"
            >
              Demander un accès
            </a>
          </div>

          <button
            className="md:hidden -mr-2 p-2 text-ink"
            onClick={() => setMenuOuvert(!menuOuvert)}
            aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOuvert}
          >
            {menuOuvert ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {menuOuvert && (
          <div className="md:hidden border-t border-rule bg-paper">
            <nav className="mx-auto max-w-6xl px-5 py-2" aria-label="Navigation principale">
              {LIENS_NAV.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOuvert(false)}
                  className="block py-3 border-b border-rule text-ink"
                >
                  {l.label}
                </a>
              ))}
              <Link href="/download" className="block py-3 border-b border-rule text-ink">
                Télécharger
              </Link>
              <div className="flex gap-3 py-4">
                <Link href="/login" className="flex-1 inline-flex items-center justify-center h-11 border border-ink text-ink text-sm font-medium">
                  Se connecter
                </Link>
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Demande d'accès à Maintrix")}`}
                  className="flex-1 inline-flex items-center justify-center h-11 bg-ink text-paper text-sm font-medium"
                >
                  Demander un accès
                </a>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* ── Ouverture ─────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="grid gap-14 lg:grid-cols-12 lg:gap-12 items-start">
            <div className="lg:col-span-7">
              <p className="font-mono text-eyebrow uppercase text-ink-mute mb-6">
                Supervision et contrôle adaptatif des installations industrielles
              </p>
              <h1 className="font-serif text-display text-ink font-medium">
                Voir vos installations en temps réel, anticiper les pannes, organiser la maintenance.
              </h1>
              <p className="text-lede text-ink-soft mt-8 max-w-xl">
                Maintrix supervise vos équipements, détecte leurs dérives et adapte leur pilotage
                dans les limites que vous fixez. La GMAO et la maintenance prédictive sont
                intégrées : de la mesure à l'intervention, tout se passe sur une seule plateforme.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-3">
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Demande d'accès à Maintrix")}`}
                  className="group inline-flex items-center justify-center gap-2 h-12 px-6 bg-ink text-paper font-medium hover:bg-signal transition-colors"
                >
                  Demander un accès
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </a>
                <a
                  href="#plateforme"
                  className="inline-flex items-center justify-center h-12 px-6 border border-ink text-ink font-medium hover:bg-ink hover:text-paper transition-colors"
                >
                  Découvrir la plateforme
                </a>
              </div>
            </div>

            <div className="lg:col-span-5 lg:pt-3">
              <FicheExemple />
            </div>
          </div>
        </section>

        {/* ── 01 · Plateforme ───────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 sm:px-8 pb-24">
          <EnTeteSection id="plateforme" numero="01" titre="Plateforme" />
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className="font-serif text-headline text-ink font-medium">
                Plus qu'une GMAO : trois fonctions, un même référentiel.
              </h2>
              <p className="text-ink-soft mt-5 leading-relaxed">
                Ce que mesurent les capteurs, ce que prévoient les modèles et ce que font les
                techniciens portent sur les mêmes équipements. Maintrix les réunit au lieu de les
                répartir entre un superviseur, un outil d'analyse et une GMAO.
              </p>
            </div>
            <ol className="lg:col-span-8 grid gap-px bg-rule border border-rule sm:grid-cols-3">
              {PILIERS.map((p, i) => (
                <li key={p.titre} className="bg-white p-6 flex flex-col">
                  <span className="font-mono text-sm text-signal">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="font-serif text-title text-ink font-medium mt-2">{p.titre}</h3>
                  <p className="text-ink-soft mt-3 leading-relaxed flex-1">{p.texte}</p>
                  <a href={p.ancre} className="mt-5 text-sm text-signal hover:text-signal-deep inline-flex items-center gap-1.5">
                    En savoir plus <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 02 · Supervision et contrôle adaptatif ────────── */}
        <section className="bg-paper-deep">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-2 pb-24">
            <EnTeteSection id="supervision" numero="02" titre="Supervision et contrôle adaptatif" />
            <div className="grid gap-12 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <h2 className="font-serif text-headline text-ink font-medium">
                  Suivre l'installation et ajuster son pilotage, sans perdre la main.
                </h2>
                <p className="text-ink-soft mt-5 leading-relaxed">
                  La plateforme se raccorde à l'existant et monte en autonomie au rythme que vous
                  choisissez : d'abord observer, puis recommander, puis exécuter sous supervision.
                </p>
              </div>
              <div className="lg:col-span-8">
                <ListeDefinitions items={SUPERVISION} />
              </div>
            </div>
          </div>
        </section>

        {/* ── 03 · Maintenance prédictive ───────────────────── */}
        <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-2 pb-24">
          <EnTeteSection id="predictif" numero="03" titre="Maintenance prédictive" />
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className="font-serif text-headline text-ink font-medium">
                Intervenir avant la panne, au moment utile.
              </h2>
              <p className="text-ink-soft mt-5 leading-relaxed">
                Quand un équipement dérive, Maintrix estime le temps qui reste et crée l'ordre de
                travail dans la GMAO. L'intervention se planifie sur un arrêt prévu plutôt que
                dans l'urgence.
              </p>
            </div>
            <div className="lg:col-span-8">
              <ListeDefinitions items={PREDICTIF} />
            </div>
          </div>
        </section>

        {/* ── 04 · GMAO ─────────────────────────────────────── */}
        <section className="bg-paper-deep">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-2 pb-24">
            <EnTeteSection id="gmao" numero="04" titre="GMAO intégrée" />
            <div className="grid gap-12 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <h2 className="font-serif text-headline text-ink font-medium">
                  Toute l'organisation de la maintenance au même endroit.
                </h2>
                <p className="text-ink-soft mt-5 leading-relaxed">
                  Une GMAO complète, utilisable seule dès le premier jour. Elle reçoit directement
                  les alertes de la supervision et les prévisions du module prédictif : aucune
                  ressaisie entre ce qui est détecté et ce qui est planifié.
                </p>
              </div>
              <div className="lg:col-span-8">
                <ListeDefinitions items={MODULES_GMAO} />
              </div>
            </div>
          </div>
        </section>

        {/* ── 05 · Boucle ───────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-2 pb-24">
          <EnTeteSection numero="05" titre="Fonctionnement" />
          <h2 className="font-serif text-headline text-ink font-medium max-w-2xl">
            Une boucle fermée, de la mesure à l'apprentissage.
          </h2>
          <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {BOUCLE.map((e) => (
              <li key={e.n} className="border-t-2 border-ink pt-5">
                <span className="font-mono text-sm text-signal">{e.n}</span>
                <h3 className="font-serif text-title text-ink font-medium mt-2">{e.titre}</h3>
                <p className="text-ink-soft mt-3 leading-relaxed">{e.texte}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── 06 · Diagnostic ───────────────────────────────── */}
        <section id="diagnostic" className="bg-ink text-paper scroll-mt-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-24">
            <div className="flex items-baseline gap-4 pb-10">
              <span className="font-mono text-eyebrow text-signal-light">06</span>
              <span className="font-mono text-eyebrow uppercase text-paper/60">Diagnostic</span>
            </div>
            <div className="grid gap-12 lg:grid-cols-12">
              <h2 className="lg:col-span-6 font-serif text-headline font-medium">
                Des causes probables, chacune avec sa source.
              </h2>
              <p className="lg:col-span-5 lg:col-start-8 text-lede text-paper/75">
                Face à un symptôme, Maintrix croise les mesures de l'installation et l'historique
                des interventions, et indique d'où vient chaque hypothèse. Le technicien confirme,
                écarte ou complète.
              </p>
            </div>
            <div className="mt-16 grid gap-px bg-paper/15 sm:grid-cols-3">
              {SOURCES_DIAGNOSTIC.map((s) => (
                <div key={s.titre} className="bg-ink pt-6 sm:pr-8 pb-2">
                  <h3 className="font-medium">{s.titre}</h3>
                  <p className="text-paper/70 mt-2 leading-relaxed">{s.texte}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Tarifs (offre payante en veille hors production) ── */}
        {BILLING_ENABLED && (
          <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-2 pb-24">
            <EnTeteSection id="tarifs" numero="07" titre="Tarifs" />
            <h2 className="font-serif text-headline text-ink font-medium max-w-2xl">
              Un abonnement selon la taille de l'équipe.
            </h2>
            <p className="text-ink-soft mt-4">Quatorze jours d'essai sur chaque formule, sans carte bancaire.</p>
            <div className="mt-12 grid border-t border-l border-rule sm:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((p) => (
                <div key={p.id} className="flex flex-col border-r border-b border-rule bg-white p-6">
                  <h3 className="font-serif text-title font-medium">{p.nom}</h3>
                  <p className="text-sm text-ink-mute mt-1">{p.public}</p>
                  <p className="mt-6">
                    <span className="font-serif text-3xl">{p.prix}</span>
                    {p.periode && <span className="text-sm text-ink-mute ml-2">{p.periode}</span>}
                  </p>
                  <ul className="mt-6 space-y-2 text-sm text-ink-soft flex-1">
                    {p.points.map((pt) => (
                      <li key={pt} className="border-t border-rule pt-2">{pt}</li>
                    ))}
                  </ul>
                  {p.id === "enterprise" ? (
                    <button
                      onClick={() => setContactOuvert(true)}
                      className="mt-8 h-11 border border-ink text-ink text-sm font-medium hover:bg-ink hover:text-paper transition-colors"
                    >
                      Nous contacter
                    </button>
                  ) : (
                    <a
                      href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Demande d'accès à Maintrix — formule ${p.nom}`)}`}
                      className="mt-8 inline-flex items-center justify-center h-11 bg-ink text-paper text-sm font-medium hover:bg-signal transition-colors"
                    >
                      Demander un accès
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Clôture ───────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 sm:px-8 py-24">
          <Filet />
          <div className="grid gap-10 lg:grid-cols-12 pt-12">
            <h2 className="lg:col-span-7 font-serif text-headline text-ink font-medium">
              {IS_TEST_ENVIRONMENT
                ? "Vous testez Maintrix ? Dites-nous ce qui coince."
                : "Prêt à superviser vos installations ?"}
            </h2>
            <div className="lg:col-span-5">
              <p className="text-ink-soft leading-relaxed">
                {IS_TEST_ENVIRONMENT
                  ? "Un écran incompréhensible, une information introuvable, un parcours trop long : chaque remarque compte, surtout les plus concrètes."
                  : "Écrivez-nous : nous ouvrons votre espace, et vous commencez par la GMAO et vos premiers équipements."}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                {IS_TEST_ENVIRONMENT ? (
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=Retour%20de%20test%20Maintrix`}
                    className="inline-flex items-center justify-center h-12 px-6 bg-ink text-paper font-medium hover:bg-signal transition-colors"
                  >
                    Envoyer un retour
                  </a>
                ) : (
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Demande d'accès à Maintrix")}`}
                    className="inline-flex items-center justify-center h-12 px-6 bg-ink text-paper font-medium hover:bg-signal transition-colors"
                  >
                    Demander un accès
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Pied de page ──────────────────────────────────── */}
      <footer className="border-t border-rule">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-12 grid gap-10 sm:grid-cols-12">
          <div className="sm:col-span-5">
            <img src="/logo-maintrix.png" alt="Maintrix" width={640} height={213} className="h-8 w-auto" />
            <p className="text-sm text-ink-soft mt-2 max-w-xs leading-relaxed">
              Supervision et contrôle adaptatif des installations industrielles, avec GMAO et
              maintenance prédictive intégrées.
            </p>
          </div>
          <nav className="sm:col-span-3" aria-label="Plateforme">
            <p className="font-mono text-eyebrow uppercase text-ink-mute mb-4">Plateforme</p>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#supervision" className="text-ink-soft hover:text-ink">Supervision</a></li>
              <li><a href="#predictif" className="text-ink-soft hover:text-ink">Maintenance prédictive</a></li>
              <li><a href="#gmao" className="text-ink-soft hover:text-ink">GMAO</a></li>
              {BILLING_ENABLED && <li><a href="#tarifs" className="text-ink-soft hover:text-ink">Tarifs</a></li>}
              <li><Link href="/download" className="text-ink-soft hover:text-ink">Télécharger</Link></li>
            </ul>
          </nav>
          <nav className="sm:col-span-4" aria-label="Aide">
            <p className="font-mono text-eyebrow uppercase text-ink-mute mb-4">Aide</p>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/documentation" className="text-ink-soft hover:text-ink">Documentation</Link></li>
              <li><Link href="/support-chatbot" className="text-ink-soft hover:text-ink">Support</Link></li>
              <li>
                <button onClick={() => setContactOuvert(true)} className="text-ink-soft hover:text-ink text-left">
                  Contact
                </button>
              </li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-rule">
          <p className="mx-auto max-w-6xl px-5 sm:px-8 py-5 text-sm text-ink-mute">
            © {new Date().getFullYear()} Maintrix
          </p>
        </div>
      </footer>

      {/* ── Contact ───────────────────────────────────────── */}
      {contactOuvert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60"
          onClick={() => setContactOuvert(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-titre"
        >
          <div className="relative w-full max-w-md bg-paper border border-rule p-8" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setContactOuvert(false)}
              className="absolute right-4 top-4 p-1 text-ink-mute hover:text-ink"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
            <p className="font-mono text-eyebrow uppercase text-ink-mute">Contact</p>
            <h2 id="contact-titre" className="font-serif text-headline font-medium mt-3">Écrivez-nous.</h2>
            <p className="text-ink-soft mt-3">Nous répondons en jours ouvrés, de 9 h à 18 h, heure de Paris.</p>
            <dl className="mt-8 border-t border-rule">
              <div className="border-b border-rule py-4">
                <dt className="text-sm text-ink-mute">Courriel</dt>
                <dd className="mt-1">
                  <a href={`mailto:${CONTACT_EMAIL}`} className="text-ink underline decoration-rule underline-offset-4 hover:decoration-signal">
                    {CONTACT_EMAIL}
                  </a>
                </dd>
              </div>
              <div className="border-b border-rule py-4">
                <dt className="text-sm text-ink-mute">Téléphone</dt>
                <dd className="mt-1">
                  <a href="tel:+33628352828" className="text-ink underline decoration-rule underline-offset-4 hover:decoration-signal">
                    +33 6 28 35 28 28
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
