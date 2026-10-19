import { Link } from "wouter";
import { ETAT, type RegistreEtat } from "@/lib/etats";

/**
 * ═══════════════════════════════════════════════════════════════════
 * INDICATEURS ET PASTILLES D'ÉTAT
 * ═══════════════════════════════════════════════════════════════════
 *
 * Six manières différentes d'afficher un chiffre clé coexistaient dans
 * l'application : aplats sombres à disque décoratif, cartes à liseré
 * coloré et pastille ronde, boîtes teintées à coin arrondi, tuiles à
 * filet… Sur la seule page GMAO, trois cartes voisines ne partageaient
 * même pas le même traitement d'ombre.
 *
 * Un seul gabarit ici, et une règle : le grand chiffre ne suffit jamais.
 * « 12 » ne renseigne sur rien ; « 12 — dont 3 en retard » oriente une
 * journée. C'est la deuxième ligne qui fait le travail.
 */

interface IndicateurProps {
  libelle: string;
  /** Une valeur mesurée, ou « — ». Jamais un nombre plausible. */
  valeur: React.ReactNode;
  /** Ce que le chiffre implique. Obligatoire : sans lui, le chiffre est muet. */
  precision: string;
  icone?: React.ComponentType<{ className?: string }>;
  /** Allume le liseré de gauche : il y a quelque chose à faire. */
  alerte?: boolean;
  /** Rend la tuile cliquable vers l'écran qui permet d'agir. */
  href?: string;
}

export function Indicateur({ libelle, valeur, precision, icone: Icone, alerte, href }: IndicateurProps) {
  const contenu = (
    <div className="bg-white p-5 relative h-full">
      <span
        className={`absolute left-0 top-0 bottom-0 w-0.5 ${alerte ? ETAT.alerte.filet : "bg-transparent"}`}
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-eyebrow uppercase text-ink-mute">{libelle}</p>
        {Icone && <Icone className="w-4 h-4 text-ink-mute shrink-0" />}
      </div>
      <p className="font-serif text-4xl text-ink mt-3 leading-none">{valeur}</p>
      <p className="text-sm text-ink-soft mt-2">{precision}</p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal">
        {contenu}
      </Link>
    );
  }
  return contenu;
}

/** Rangée d'indicateurs : filets partagés, aucune ombre. */
export function RangeeIndicateurs({ children, colonnes = 4 }: { children: React.ReactNode; colonnes?: 3 | 4 }) {
  const grille = colonnes === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  return <div className={`grid grid-cols-1 sm:grid-cols-2 ${grille} gap-px bg-rule border border-rule`}>{children}</div>;
}

/**
 * Pastille d'état. Remplace les `bg-red-100 text-red-800 dark:bg-red-900…`
 * dispersés dans le code, et les fragments de dégradé orphelins qui ne
 * produisaient plus aucune couleur du tout.
 */
export function PuceEtat({ registre, children }: { registre: RegistreEtat; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium whitespace-nowrap ${ETAT[registre].puce}`}>
      {children}
    </span>
  );
}

/** Point de légende, pour accompagner un libellé dans un graphique ou une liste. */
export function PointEtat({ registre }: { registre: RegistreEtat }) {
  return <span className={`inline-block w-2 h-2 shrink-0 ${ETAT[registre].point}`} aria-hidden="true" />;
}

/**
 * Carte d'indicateur calculé : valeur, origine du calcul, et jauge
 * facultative. Quand la plateforme ne sait pas mesurer, on écrit « — » et
 * on dit pourquoi — on n'affiche pas une jauge à zéro qui laisserait croire
 * à une performance nulle.
 */
export function IndicateurCalcule({
  libelle,
  valeur,
  origine,
  jauge,
}: {
  libelle: string;
  valeur: string;
  origine: string;
  /** Pourcentage mesuré, ou `null` si la mesure n'existe pas. */
  jauge?: number | null;
}) {
  const mesure = jauge != null;
  return (
    <div className="bg-white border border-rule p-5">
      <p className="font-mono text-eyebrow uppercase text-ink-mute">{libelle}</p>
      <p className={`font-serif text-3xl mt-2 leading-none ${valeur === "—" ? "text-ink-mute" : "text-ink"}`}>{valeur}</p>
      <p className="text-sm text-ink-soft mt-2">{origine}</p>
      {mesure && (
        <div className="mt-3 h-1 bg-paper-deep" role="presentation">
          <div className="h-full bg-signal" style={{ width: `${Math.max(0, Math.min(100, jauge))}%` }} />
        </div>
      )}
    </div>
  );
}
