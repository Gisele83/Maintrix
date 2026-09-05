// Palette de couleurs d'accentuation partagée entre landing.tsx et modern-home.tsx.
//
// Tailwind scanne le code source pour extraire les noms de classes complets — il n'exécute
// jamais le JavaScript. Une classe construite par interpolation (`bg-${color}-500/15`) n'est
// donc jamais détectée : le token brut vu par le scanner est `bg-${color}-500/15`, qui ne
// correspond à aucun utilitaire connu, et aucune règle CSS n'est générée (fond transparent).
// Ce fichier fige chaque combinaison possible sous forme de chaîne littérale complète pour que
// le scanner JIT les trouve toutes.
//
// CHART_COLOR ci-dessous suit le même principe pour les couleurs de data-viz (barres de
// progression, pastilles de statut) utilisées par preventive-maintenance.tsx — palette distincte
// d'ACCENT car les teintes (green/purple/orange/yellow/red) ne correspondent pas au set
// blue/violet/emerald/amber/rose/sky utilisé pour l'UI de marque.
export type AccentColor = "blue" | "violet" | "emerald" | "amber" | "rose" | "sky";

interface AccentTokens {
  /** Pastille icône large : fond teinté + bordure (ex. cartes fonctionnalités) */
  iconTile: string;
  /** Pastille icône réduite : fond teinté + bordure, plus discrète */
  iconTileSm: string;
  /** Badge combiné fond + texte + bordure */
  badgeChip: string;
  /** Icône sur fond sombre */
  icon400: string;
  /** Icône sur fond clair */
  icon600: string;
  /** Texte de repère (ex. numéro d'étape) */
  text500: string;
  /** Bordure + fond au survol (bouton outline) */
  hoverTile: string;
}

export const ACCENT: Record<AccentColor, AccentTokens> = {
  blue: {
    iconTile: "bg-blue-500/15 border border-blue-500/25",
    iconTileSm: "bg-blue-500/10 border border-blue-500/20",
    badgeChip: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    icon400: "text-blue-400",
    icon600: "text-blue-600",
    text500: "text-blue-500",
    hoverTile: "hover:border-blue-200 hover:bg-blue-50/50",
  },
  violet: {
    iconTile: "bg-violet-500/15 border border-violet-500/25",
    iconTileSm: "bg-violet-500/10 border border-violet-500/20",
    badgeChip: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
    icon400: "text-violet-400",
    icon600: "text-violet-600",
    text500: "text-violet-500",
    hoverTile: "hover:border-violet-200 hover:bg-violet-50/50",
  },
  emerald: {
    iconTile: "bg-emerald-500/15 border border-emerald-500/25",
    iconTileSm: "bg-emerald-500/10 border border-emerald-500/20",
    badgeChip: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    icon400: "text-emerald-400",
    icon600: "text-emerald-600",
    text500: "text-emerald-500",
    hoverTile: "hover:border-emerald-200 hover:bg-emerald-50/50",
  },
  amber: {
    iconTile: "bg-amber-500/15 border border-amber-500/25",
    iconTileSm: "bg-amber-500/10 border border-amber-500/20",
    badgeChip: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    icon400: "text-amber-400",
    icon600: "text-amber-600",
    text500: "text-amber-500",
    hoverTile: "hover:border-amber-200 hover:bg-amber-50/50",
  },
  rose: {
    iconTile: "bg-rose-500/15 border border-rose-500/25",
    iconTileSm: "bg-rose-500/10 border border-rose-500/20",
    badgeChip: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
    icon400: "text-rose-400",
    icon600: "text-rose-600",
    text500: "text-rose-500",
    hoverTile: "hover:border-rose-200 hover:bg-rose-50/50",
  },
  sky: {
    iconTile: "bg-sky-500/15 border border-sky-500/25",
    iconTileSm: "bg-sky-500/10 border border-sky-500/20",
    badgeChip: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
    icon400: "text-sky-400",
    icon600: "text-sky-600",
    text500: "text-sky-500",
    hoverTile: "hover:border-sky-200 hover:bg-sky-50/50",
  },
};

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
