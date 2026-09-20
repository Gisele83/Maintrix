// Jetons d'accentuation partagés (modern-home.tsx, preventive-maintenance.tsx).
//
// ═══════════════════════════════════════════════════════════════════
// UNE SEULE TEINTE, CELLE DU LOGO
// ═══════════════════════════════════════════════════════════════════
// Chaque module recevait ici sa propre couleur pastel — bleu, violet, émeraude,
// ambre, rose, ciel — appliquée à une pastille d'icône arrondie. Six teintes
// décoratives côte à côte sur un même écran : c'est la signature visuelle d'une
// maquette générée, et cela ne renseigne sur rien (la couleur ne dit ni l'état,
// ni la priorité, ni la nature du module).
//
// Les six clés restent, pour ne pas toucher aux écrans qui les citent, mais
// elles pointent toutes vers les mêmes jetons de la charte. Ajouter un module
// ne demande donc plus de « choisir une couleur ».
//
// ⚠️ À CONSERVER : Tailwind analyse le code SOURCE et n'exécute jamais le
// JavaScript. Une classe assemblée par interpolation (`bg-${couleur}-500`) n'est
// jamais vue par l'analyseur, donc jamais générée, et le fond reste transparent.
// D'où ces chaînes littérales complètes.
export type AccentColor = "blue" | "violet" | "emerald" | "amber" | "rose" | "sky";

interface AccentTokens {
  /** Pastille icône large */
  iconTile: string;
  /** Pastille icône réduite */
  iconTileSm: string;
  /** Badge combiné fond + texte + bordure */
  badgeChip: string;
  /** Icône sur fond sombre */
  icon400: string;
  /** Icône sur fond clair */
  icon600: string;
  /** Texte de repère (ex. numéro d'étape) */
  text500: string;
  /** Bordure + fond au survol */
  hoverTile: string;
}

const JETONS: AccentTokens = {
  iconTile: "bg-paper-deep border border-rule",
  iconTileSm: "bg-paper-deep border border-rule",
  badgeChip: "bg-paper-deep text-ink-soft border border-rule",
  icon400: "text-signal-light",
  icon600: "text-ink-mute",
  text500: "text-signal",
  hoverTile: "hover:border-ink hover:bg-paper",
};

export const ACCENT: Record<AccentColor, AccentTokens> = {
  blue: JETONS,
  violet: JETONS,
  emerald: JETONS,
  amber: JETONS,
  rose: JETONS,
  sky: JETONS,
};

// ── Couleurs de graphiques ────────────────────────────────────────
// Celles-ci PORTENT UN SENS : elles distinguent des séries et des états dans
// les barres de progression et les pastilles de statut. On n'y touche pas.
export type ChartColor = "blue" | "green" | "purple" | "orange" | "yellow" | "red";

interface ChartColorTokens {
  /** Texte de valeur chiffrée */
  text600: string;
  /** Pastille ou remplissage de barre de progression */
  bg500: string;
  /** Remplissage de barre de progression (teinte plus soutenue) */
  bg600: string;
}

export const CHART_COLOR: Record<ChartColor, ChartColorTokens> = {
  blue: { text600: "text-blue-600", bg500: "bg-blue-500", bg600: "bg-blue-600" },
  green: { text600: "text-green-600", bg500: "bg-green-500", bg600: "bg-green-600" },
  purple: { text600: "text-purple-600", bg500: "bg-purple-500", bg600: "bg-purple-600" },
  orange: { text600: "text-orange-600", bg500: "bg-orange-500", bg600: "bg-orange-600" },
  yellow: { text600: "text-yellow-600", bg500: "bg-yellow-500", bg600: "bg-yellow-600" },
  red: { text600: "text-red-600", bg500: "bg-red-500", bg600: "bg-red-600" },
};
