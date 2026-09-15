import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Menu, X } from "lucide-react";
import { BILLING_ENABLED, IS_TEST_ENVIRONMENT } from "@/lib/feature-flags";

/**
 * Page d'accueil publique.
 *
 * Parti pris éditorial : dire concrètement ce que fait l'outil, dans les mots
 * d'un service maintenance, sans chiffre qu'on ne peut pas prouver. La version
 * précédente affichait « 99,9 % de disponibilité SLA » et « 98 % de précision
 * du diagnostic IA » : aucune mesure ne les étayait.
 *
 * Parti pris visuel : une page qui se lit comme un document technique soigné
 * (fond papier, filets fins, numérotation, typographie à empattements pour les
 * titres) plutôt que les codes génériques du SaaS (dégradés de texte, halos,
 * pastilles lumineuses, tuiles d'icônes colorées, compteurs animés).
 */

const CONTACT_EMAIL = "contact@techlearn-saem.com";

type Lien = { href: string; label: string };

const LIENS_NAV: Lien[] = [
  { href: "#couverture", label: "Fonctionnalités" },
  { href: "#methode", label: "Méthode" },
  { href: "#diagnostic", label: "Diagnostic" },
  ...(BILLING_ENABLED ? [{ href: "#tarifs", label: "Tarifs" }] : []),
];

const MODULES = [
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
    texte: "Étalonnages des instruments et habilitations des techniciens, avec leurs échéances.",
  },
];

const ETAPES = [
  {
    n: "01",
    titre: "Signaler",
    texte: "Un opérateur ou un technicien décrit le problème, depuis le bureau ou le terrain.",
  },
  {
    n: "02",
    titre: "Qualifier",
    texte: "Le responsable fixe la priorité, affecte l'intervention et prévoit les pièces.",
  },
  {
    n: "03",
    titre: "Intervenir",
    texte: "Le technicien consigne ce qu'il a constaté, ce qu'il a fait et ce qu'il a remplacé.",
  },
  {
    n: "04",
    titre: "Capitaliser",
    texte: "La clôture enrichit l'historique de l'équipement et nourrit les diagnostics suivants.",
  },
];

const SOURCES_DIAGNOSTIC = [
  {
    titre: "Règles de maintenance",
    texte: "Les correspondances connues entre symptômes et défaillances.",
  },
  {
    titre: "Interventions passées",
    texte: "Les cas proches déjà résolus sur vos équipements.",
  },
  {
    titre: "Assistance IA",
    texte: "Une aide à la formulation des hypothèses, jamais une réponse sans source.",
  },
];

const PLANS = [
  { id: "solo", nom: "Solo", prix: "29,99 €", periode: "par mois", public: "1 utilisateur", points: ["Équipements illimités", "GMAO complète", "Diagnostic assisté", "Rapports PDF"] },
  { id: "equipe", nom: "Équipe", prix: "89,99 €", periode: "par mois", public: "2 à 5 utilisateurs", points: ["Tout le plan Solo", "Travail en équipe", "OEE et analyse des causes", "AMDEC"] },
  { id: "business", nom: "Entreprise S", prix: "189,99 €", periode: "par mois", public: "6 à 11 utilisateurs", points: ["Tout le plan Équipe", "Supervision des équipements", "Capteurs connectés", "Rapports avancés"] },
  { id: "enterprise", nom: "Entreprise L", prix: "Sur devis", periode: "", public: "21 utilisateurs et plus", points: ["Plusieurs sites", "Hébergement dédié", "Intégrations ERP et SCADA", "Support dédié"] },
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

function FicheExemple() {
  return (
    <figure className="bg-white border border-rule">
      <figcaption className="flex items-center justify-between border-b border-rule px-5 py-3">
        <span className="font-mono text-eyebrow uppercase text-ink-mute">Ordre de travail</span>
        <span className="font-mono text-eyebrow text-ink-mute">Exemple</span>
      </figcaption>

      <div className="px-5 py-5 space-y-5">
        <div>
          <p className="font-mono text-sm text-ink-mute">OT-2026-0412</p>
          <p className="font-serif text-title text-ink mt-1">Compresseur C-02 — vibrations anormales</p>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-ink-mute">Priorité</dt>
            <dd className="text-ink font-medium">Haute</dd>
          </div>
          <div>
            <dt className="text-ink-mute">Affecté à</dt>
            <dd className="text-ink font-medium">Équipe mécanique</dd>
          </div>
          <div>
            <dt className="text-ink-mute">Signalé</dt>
            <dd className="text-ink font-medium">Ligne 3, poste du matin</dd>
          </div>
          <div>
            <dt className="text-ink-mute">Statut</dt>
            <dd className="text-ink font-medium">À diagnostiquer</dd>
          </div>
        </dl>

        <div className="border-t border-rule pt-4">
          <p className="font-mono text-eyebrow uppercase text-ink-mute mb-3">Causes probables</p>
          <ol className="space-y-2.5 text-sm">
            <li className="flex gap-3">
              <span className="font-mono text-signal">1</span>
              <span className="text-ink">Roulement du palier côté moteur usé<span className="block text-ink-mute">d'après deux interventions similaires sur ce modèle</span></span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-ink-mute">2</span>
              <span className="text-ink">Désalignement de l'accouplement<span className="block text-ink-mute">règle de maintenance constructeur</span></span>
            </li>
          </ol>
        </div>
      </div>
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
            Les données sont fictives et peuvent être réinitialisées à tout moment.
          </p>
        </div>
      )}

      {/* ── En-tête ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-paper/95 border-b border-rule">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="font-serif text-2xl font-medium tracking-tight text-ink">Maintrix</span>
            <span className="hidden sm:inline font-mono text-eyebrow uppercase text-ink-mute">GMAO</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8" aria-label="Navigation principale">
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
            <Link
              href="/register"
              className="inline-flex items-center h-10 px-4 bg-ink text-paper text-sm font-medium hover:bg-signal transition-colors"
            >
              Créer un compte
            </Link>
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
                <Link href="/register" className="flex-1 inline-flex items-center justify-center h-11 bg-ink text-paper text-sm font-medium">
                  Créer un compte
                </Link>
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
                Maintenance industrielle
              </p>
              <h1 className="font-serif text-display text-ink font-medium">
                Savoir ce qui tombe en panne, pourquoi, et qui s'en occupe.
              </h1>
              <p className="text-lede text-ink-soft mt-8 max-w-xl">
                Maintrix réunit vos équipements, vos ordres de travail et l'historique de chaque
                intervention. Quand une machine dérive, il aide à en trouver la cause à partir de
                ce que votre équipe a déjà résolu.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/register"
                  className="group inline-flex items-center justify-center gap-2 h-12 px-6 bg-ink text-paper font-medium hover:bg-signal transition-colors"
                >
                  Créer un compte
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center h-12 px-6 border border-ink text-ink font-medium hover:bg-ink hover:text-paper transition-colors"
                >
                  Se connecter
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 lg:pt-3">
              <FicheExemple />
            </div>
          </div>
        </section>

        {/* ── 01 · Couverture fonctionnelle ─────────────────── */}
        <section className="mx-auto max-w-6xl px-5 sm:px-8 pb-24">
          <EnTeteSection id="couverture" numero="01" titre="Ce que couvre Maintrix" />
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className="font-serif text-headline text-ink font-medium">
                Toute la maintenance au même endroit.
              </h2>
              <p className="text-ink-soft mt-5 leading-relaxed">
                Plutôt qu'un tableur par sujet, un seul référentiel partagé entre les
                techniciens, les responsables et la direction.
              </p>
            </div>
            <dl className="lg:col-span-8 grid sm:grid-cols-2 gap-x-10">
              {MODULES.map((m) => (
                <div key={m.titre} className="border-t border-rule py-6">
                  <dt className="font-medium text-ink">{m.titre}</dt>
                  <dd className="text-ink-soft mt-2 leading-relaxed">{m.texte}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── 02 · Méthode ──────────────────────────────────── */}
        <section className="bg-paper-deep">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-2 pb-24">
            <EnTeteSection id="methode" numero="02" titre="Méthode" />
            <h2 className="font-serif text-headline text-ink font-medium max-w-2xl">
              Une intervention, du signalement à l'historique.
            </h2>
            <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {ETAPES.map((e) => (
                <li key={e.n} className="border-t-2 border-ink pt-5">
                  <span className="font-mono text-sm text-signal">{e.n}</span>
                  <h3 className="font-serif text-title text-ink font-medium mt-2">{e.titre}</h3>
                  <p className="text-ink-soft mt-3 leading-relaxed">{e.texte}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 03 · Diagnostic ───────────────────────────────── */}
        <section id="diagnostic" className="bg-ink text-paper scroll-mt-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-24">
            <div className="flex items-baseline gap-4 pb-10">
              <span className="font-mono text-eyebrow text-signal-light">03</span>
              <span className="font-mono text-eyebrow uppercase text-paper/60">Diagnostic</span>
            </div>
            <div className="grid gap-12 lg:grid-cols-12">
              <h2 className="lg:col-span-6 font-serif text-headline font-medium">
                Un diagnostic qui s'appuie sur votre historique, pas sur une boîte noire.
              </h2>
              <p className="lg:col-span-5 lg:col-start-8 text-lede text-paper/75">
                Face à un symptôme, Maintrix propose des causes probables et indique pour chacune
                d'où elle vient. Le technicien garde la main : il confirme, écarte ou complète.
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
            <EnTeteSection id="tarifs" numero="04" titre="Tarifs" />
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
                    <Link
                      href={`/register?plan=${p.id}`}
                      className="mt-8 inline-flex items-center justify-center h-11 bg-ink text-paper text-sm font-medium hover:bg-signal transition-colors"
                    >
                      Commencer l'essai
                    </Link>
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
                : "Prêt à organiser votre maintenance ?"}
            </h2>
            <div className="lg:col-span-5">
              <p className="text-ink-soft leading-relaxed">
                {IS_TEST_ENVIRONMENT
                  ? "Un écran incompréhensible, une information introuvable, un parcours trop long : chaque remarque compte, surtout les plus concrètes."
                  : "Créez un compte et renseignez vos premiers équipements en quelques minutes."}
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
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center h-12 px-6 bg-ink text-paper font-medium hover:bg-signal transition-colors"
                  >
                    Créer un compte
                  </Link>
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
            <p className="font-serif text-xl font-medium">Maintrix</p>
            <p className="text-sm text-ink-soft mt-2 max-w-xs leading-relaxed">
              Gestion de la maintenance et aide au diagnostic pour les sites industriels.
            </p>
          </div>
          <nav className="sm:col-span-3" aria-label="Produit">
            <p className="font-mono text-eyebrow uppercase text-ink-mute mb-4">Produit</p>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#couverture" className="text-ink-soft hover:text-ink">Fonctionnalités</a></li>
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
