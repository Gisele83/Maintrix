/**
 * Les moteurs que le diagnostic peut citer — leur nom, et la façon de le dire.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * `server/hybrid-diagnostic-pipeline.ts` tenait DEUX listes de moteurs :
 * `getEngineSources()` produisait les libellés, et `buildExplanationSummary()`
 * les reconnaissait de son côté, par sous-chaîne, pour construire la phrase
 * rendue à l'utilisateur. Les deux avaient dérivé :
 *
 *   • la reconnaissance testait `'Règles'` avec une MAJUSCULE, alors que le
 *     libellé produit est « Moteur de règles expert ». Le moteur de règles
 *     n'était donc JAMAIS reconnu — et comme c'est le seul qui réponde sur une
 *     installation sans historique de cas, la phrase finissait par
 *     « proposé(s) à partir de . ». Mesuré, base de cas vide :
 *     « Confiance Moyenne (66%) — 2 diagnostic(s) proposé(s) à partir de . » ;
 *   • le graphe causal et le jumeau numérique n'avaient aucune description :
 *     même phrase tronquée s'ils étaient les seuls à répondre.
 *
 * Une seule table désormais, lue par les deux côtés : un moteur ne peut plus
 * être cité sans être décrit, ni décrit sans être cité.
 *
 * Ce fichier n'importe NI la base NI le pipeline — c'est ce qui permet de le
 * couvrir dans la voie unitaire, sans base de données
 * (`tests/unit/sources-diagnostic.test.ts`).
 */

/**
 * ⚠️ CHAQUE DESCRIPTION S'ENCHAÎNE APRÈS « à partir de ».
 *
 * Elles doivent donc commencer par un article défini — « la mémoire… »,
 * « l'analyse… » — et jamais par « de », « des » ou « d' », qui doublerait la
 * préposition. Le défaut était réel : la description du moteur de règles
 * commençait par « des », et la phrase rendue, une fois la reconnaissance
 * réparée, disait « à partir de des règles de maintenance ». Invisible jusque-là
 * puisque cette branche n'était jamais atteinte. Gardé par
 * `tests/unit/sources-diagnostic.test.ts`.
 */
export const SOURCES_DIAGNOSTIC = {
  regles: {
    libelle: 'Moteur de règles expert',
    description: 'la base de règles de maintenance validées par des experts',
  },
  historique: {
    libelle: 'Analyse de similarité historique',
    description: "l'analyse de cas de maintenance passés similaires",
  },
  memoire: {
    libelle: 'Mémoire des pannes',
    description: 'la mémoire des pannes confirmées par des techniciens',
  },
  grapheCausal: {
    libelle: 'Graphe de connaissances causal',
    description: 'le graphe de connaissances causal du parc',
  },
  jumeauNumerique: {
    libelle: 'Jumeau numérique (modèle physique)',
    description: "le modèle physique calibré de l'équipement",
  },
  ia: {
    libelle: 'Structuration IA (Claude)',
    description: 'la structuration par intelligence artificielle',
  },
} as const;

/**
 * Les descriptions des moteurs cités, dans l'ordre où ils ont répondu.
 *
 * Un libellé inconnu de la table ne produit RIEN plutôt qu'une description
 * approchante : mieux vaut une phrase plus courte qu'une provenance inventée.
 * L'appelant doit donc traiter le cas de la liste vide — c'est précisément ce
 * que l'ancienne phrase ne faisait pas.
 */
export function decrireSources(sources: string[]): string[] {
  const parLibelle = new Map<string, string>(
    Object.values(SOURCES_DIAGNOSTIC).map((s) => [s.libelle, s.description]),
  );
  return sources
    .map((source) => parLibelle.get(source))
    .filter((description): description is string => description !== undefined);
}
