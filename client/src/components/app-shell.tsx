import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import ModernNavigation from "@/components/modern-navigation";

/**
 * ═══════════════════════════════════════════════════════════════════
 * GABARIT D'APPLICATION
 * ═══════════════════════════════════════════════════════════════════
 *
 * La navigation n'était pas un gabarit : chaque page montait — ou non —
 * `<ModernNavigation />` pour son compte. Mesure du 19/10/2026 : sur
 * 33 routes vérifiées dans le navigateur, 27 n'affichaient AUCUNE barre de
 * navigation, dont `/work-orders`, `/smart-diagnostic` et la page
 * d'ingénierie elle-même. Une personne arrivée sur un ordre de travail
 * depuis la liste « À traiter » de la GMAO n'avait plus d'autre issue que
 * le bouton « précédent » du navigateur.
 *
 * `AppShell` pose la barre une fois, ajoute un fil d'Ariane quand l'écran
 * appartient à un domaine, et laisse la page ne s'occuper que de son
 * contenu. Il est ADDITIF : une page qui monte encore sa propre navigation
 * continue de fonctionner, ce qui permet de migrer écran par écran et de
 * revenir en arrière sur un seul écran.
 */

export interface MietteFilAriane {
  libelle: string;
  /** Absent sur la dernière miette : on ne se lie pas à soi-même. */
  href?: string;
}

interface AppShellProps {
  children: React.ReactNode;
  /** Fil d'Ariane, sans l'accueil : il est ajouté automatiquement. */
  filAriane?: MietteFilAriane[];
  /** Largeur du contenu. `large` pour les tableaux denses. */
  largeur?: "standard" | "large";
}

export function AppShell({ children, filAriane, largeur = "standard" }: AppShellProps) {
  const classeLargeur = largeur === "large" ? "max-w-[1600px]" : "max-w-7xl";

  return (
    <div className="min-h-screen bg-paper text-ink">
      <ModernNavigation />

      {filAriane && filAriane.length > 0 && (
        <nav aria-label="Fil d'Ariane" className="border-b border-rule bg-white">
          <ol className={`${classeLargeur} mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 h-10 text-sm overflow-x-auto`}>
            <li className="shrink-0">
              <Link href="/" className="text-ink-mute hover:text-ink transition-colors">
                Accueil
              </Link>
            </li>
            {filAriane.map((miette, index) => (
              <li key={`${miette.libelle}-${index}`} className="flex items-center gap-1 shrink-0">
                <ChevronRight className="w-3.5 h-3.5 text-ink-mute" aria-hidden="true" />
                {miette.href ? (
                  <Link href={miette.href} className="text-ink-mute hover:text-ink transition-colors">
                    {miette.libelle}
                  </Link>
                ) : (
                  <span className="text-ink" aria-current="page">
                    {miette.libelle}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <main className={`${classeLargeur} mx-auto px-4 sm:px-6 lg:px-8 py-8`}>{children}</main>
    </div>
  );
}

interface EnTetePageProps {
  /** Sur-titre : le domaine auquel appartient l'écran. */
  surTitre: string;
  titre: string;
  /**
   * UNE phrase, ou rien. La règle vient du cahier des charges : pas de
   * paragraphe explicatif dans une vue opérationnelle. Ce qui demande un
   * paragraphe demande en réalité une infobulle ou une page d'aide.
   */
  phrase?: string;
  /** Action principale de l'écran — une seule, en bouton plein. */
  action?: React.ReactNode;
  /** Actions de second rang, en boutons à filet. */
  actionsSecondaires?: React.ReactNode;
}

export function EnTetePage({ surTitre, titre, phrase, action, actionsSecondaires }: EnTetePageProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-rule">
      <div className="min-w-0">
        <p className="font-mono text-eyebrow uppercase text-ink-mute">{surTitre}</p>
        <h1 className="font-serif text-page font-medium text-ink mt-1.5">{titre}</h1>
        {phrase && <p className="text-sm text-ink-soft mt-1.5 max-w-2xl">{phrase}</p>}
      </div>
      {/* `shrink-0` + `flex` sans retour à la ligne faisaient déborder les
          actions au-delà de l'écran sur un téléphone : mesuré sur
          l'ingénierie de maintenance, deux boutons de 254 et 258 px dans
          un document de 375 px, soit 97 px hors cadre et un défilement
          horizontal. Les actions passent à la ligne, et `min-w-0` permet
          au titre de se réduire plutôt que de pousser. */}
      {(action || actionsSecondaires) && (
        <div className="flex flex-wrap items-center gap-2">
          {actionsSecondaires}
          {action}
        </div>
      )}
    </div>
  );
}

/**
 * Bouton d'action principale — un seul par écran, c'est la règle de charte.
 * Rendu comme un `<button>` ou, avec `href`, comme un lien de navigation.
 */
export function ActionPrincipale({
  children,
  onClick,
  href,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  type?: "button" | "submit";
}) {
  const classe =
    "inline-flex items-center gap-2 h-10 px-4 bg-ink text-paper text-sm font-medium " +
    "hover:bg-signal transition-colors focus-visible:outline focus-visible:outline-2 " +
    "focus-visible:outline-offset-2 focus-visible:outline-signal";

  if (href) {
    return (
      <Link href={href} className={classe}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} className={classe}>
      {children}
    </button>
  );
}

/** Action de second rang : même gabarit, poids visuel moindre. */
export function ActionSecondaire({
  children,
  onClick,
  href,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const classe =
    "inline-flex items-center gap-2 h-10 px-4 border border-rule bg-white text-sm text-ink-soft " +
    "hover:text-ink hover:border-ink transition-colors focus-visible:outline focus-visible:outline-2 " +
    "focus-visible:outline-offset-2 focus-visible:outline-signal";

  if (href) {
    return (
      <Link href={href} className={classe}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classe}>
      {children}
    </button>
  );
}

/**
 * État vide. Il dit toujours quoi faire : un écran qui se contente d'être
 * blanc laisse croire à une panne d'affichage.
 */
export function EtatVide({
  icone: Icone,
  titre,
  phrase,
  action,
}: {
  icone?: React.ComponentType<{ className?: string }>;
  titre: string;
  phrase: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-rule bg-white p-10">
      {Icone && <Icone className="w-6 h-6 text-ink-mute" />}
      <h2 className="font-serif text-title font-medium text-ink mt-4">{titre}</h2>
      <p className="text-sm text-ink-soft mt-2 max-w-xl">{phrase}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export default AppShell;
