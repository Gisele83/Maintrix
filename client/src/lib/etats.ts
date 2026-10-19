/**
 * ═══════════════════════════════════════════════════════════════════
 * JETONS D'ÉTAT — la couleur dit quelque chose, ou elle ne sert à rien
 * ═══════════════════════════════════════════════════════════════════
 *
 * Avant ce module, l'état d'un objet métier s'écrivait au cas par cas :
 * `bg-red-100 text-red-800` ici, `bg-orange-100 text-orange-800` là, et
 * ailleurs un fragment de dégradé (`from-red-500 to-rose-600`) resté sans
 * le `bg-gradient-to-*` qui l'aurait activé — donc sans aucun fond. Les
 * quatre tuiles d'état de l'écran des étalonnages se retrouvaient ainsi
 * toutes de la même teinte : « En retard » ne se distinguait plus de
 * « Conformes ».
 *
 * Cinq registres, et rien d'autre. Un état qui n'entre dans aucun des cinq
 * est un état `neutre` — ce n'est pas une raison pour inventer une sixième
 * couleur.
 *
 * ⚠️ À CONSERVER : Tailwind analyse le code SOURCE et n'exécute jamais le
 * JavaScript. Une classe assemblée par interpolation (`bg-etat-${registre}`)
 * n'est jamais vue par l'analyseur, donc jamais générée, et l'élément reste
 * transparent sans que rien ne le signale. D'où ces chaînes littérales
 * complètes. Les couleurs elles-mêmes sont déclarées dans
 * `tailwind.config.ts`, sous `etat`.
 *
 * Contrastes vérifiés au navigateur sur le fond RÉELLEMENT composé (un fond
 * translucide se compose sur son parent avant tout calcul) : chaque couple
 * texte/fond de ce fichier dépasse 4,5:1.
 */

export type RegistreEtat =
  /** Panne, retard, rupture, dépassement : il faut agir aujourd'hui. */
  | "critique"
  /** Échéance proche, seuil approché, à surveiller. */
  | "alerte"
  /** Conforme, terminé, en service. */
  | "nominal"
  /** En cours, planifié, en attente de traitement. */
  | "encours"
  /** Sans objet, archivé, non mesuré. */
  | "neutre";

interface JetonsEtat {
  /** Pastille complète : fond + texte + filet. */
  puce: string;
  /** Texte seul, sur fond clair (paper ou blanc). */
  texte: string;
  /** Aplat de fond seul, pour une tuile ou une ligne de tableau. */
  fond: string;
  /** Filet de gauche d'une carte, ou soulignement d'onglet. */
  filet: string;
  /** Point de 8 px précédant un libellé dans une légende. */
  point: string;
}

export const ETAT: Record<RegistreEtat, JetonsEtat> = {
  critique: {
    puce: "bg-etat-critique-fond text-etat-critique-texte border border-etat-critique-filet",
    texte: "text-etat-critique-texte",
    fond: "bg-etat-critique-fond",
    filet: "bg-etat-critique-vif",
    point: "bg-etat-critique-vif",
  },
  alerte: {
    puce: "bg-etat-alerte-fond text-etat-alerte-texte border border-etat-alerte-filet",
    texte: "text-etat-alerte-texte",
    fond: "bg-etat-alerte-fond",
    filet: "bg-etat-alerte-vif",
    point: "bg-etat-alerte-vif",
  },
  nominal: {
    puce: "bg-etat-nominal-fond text-etat-nominal-texte border border-etat-nominal-filet",
    texte: "text-etat-nominal-texte",
    fond: "bg-etat-nominal-fond",
    filet: "bg-etat-nominal-vif",
    point: "bg-etat-nominal-vif",
  },
  encours: {
    puce: "bg-etat-encours-fond text-etat-encours-texte border border-etat-encours-filet",
    texte: "text-etat-encours-texte",
    fond: "bg-etat-encours-fond",
    filet: "bg-etat-encours-vif",
    point: "bg-etat-encours-vif",
  },
  neutre: {
    puce: "bg-paper-deep text-ink-soft border border-rule",
    texte: "text-ink-mute",
    fond: "bg-paper-deep",
    filet: "bg-rule",
    point: "bg-ink-mute",
  },
};

/**
 * Traduit un statut d'ordre de travail tel que le serveur le renvoie.
 * Le libellé reste à la charge de l'appelant : ce module ne décide que de la
 * couleur, pour que le même statut ait la même teinte dans toute l'application.
 */
export function registreStatutOT(statut: string | undefined | null): RegistreEtat {
  switch (statut) {
    case "completed":
      return "nominal";
    case "in_progress":
      return "encours";
    case "pending":
      return "alerte";
    case "cancelled":
      return "neutre";
    default:
      return "neutre";
  }
}

/** Traduit une priorité d'ordre de travail. */
export function registrePriorite(priorite: string | undefined | null): RegistreEtat {
  switch (priorite) {
    case "urgent":
      return "critique";
    case "high":
      return "alerte";
    case "medium":
      return "encours";
    case "low":
      return "nominal";
    default:
      return "neutre";
  }
}

/**
 * Déduit le registre d'une tuile de statistiques à partir de son libellé.
 *
 * Une dizaine d'écrans affichent la même rangée — « En retard », « Expirent
 * ≤ 30j », « Conformes », « Hors service » — et chacun portait sa propre
 * teinte, écrite à la main. Après le retrait des dégradés, ces teintes ont
 * disparu et les quatre tuiles se sont retrouvées identiques : la couleur ne
 * distinguait plus un retard d'une conformité.
 *
 * Le libellé est la seule information disponible à cet endroit — les tuiles
 * sont déclarées dans un tableau littéral, sans clé de statut. C'est donc lui
 * qu'on lit. Un libellé qu'aucune règle ne reconnaît reste `neutre` : mieux
 * vaut une tuile muette qu'une tuile qui affirme la mauvaise chose.
 */
export function registreDepuisLibelle(libelle: string): RegistreEtat {
  const l = libelle.toLowerCase();
  if (/retard|expir(é|ées|ee|ees)\b|critique|rupture|dépass|hors délai|non conforme|urgent/.test(l)) return "critique";
  if (/expirent|échéance|echeance|bientôt|bientot|≤ ?\d|sous \d|attente|à planifier|a planifier|surveill|alerte/.test(l)) return "alerte";
  if (/conforme|à jour|a jour|valide|actif|actives|terminé|termine|résolu|resolu|sain/.test(l)) return "nominal";
  if (/en cours|engagé|engage|assigné|assigne|planifié|planifie/.test(l)) return "encours";
  return "neutre";
}

/** Traduit une gravité d'alerte ou un niveau d'urgence déclaré. */
export function registreGravite(gravite: string | undefined | null): RegistreEtat {
  switch (gravite) {
    case "critical":
    case "high":
    case "eleve":
      return "critique";
    case "medium":
    case "moyen":
      return "alerte";
    case "low":
    case "faible":
      return "nominal";
    default:
      return "neutre";
  }
}
