/**
 * Lecture des codes d'erreur PostgreSQL, indépendamment de l'encapsulation.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Jusqu'à drizzle-orm 0.43, une erreur du pilote `pg` remontait telle quelle :
 * `error.code` valait directement le code SQLSTATE (`23505` pour une violation
 * de contrainte d'unicité). À partir de 0.44, drizzle encapsule l'erreur dans
 * un `DrizzleQueryError` et place l'originale sur `.cause`.
 *
 * Conséquence : tout code écrit `if (e.code === "23505")` cesse de reconnaître
 * le conflit **sans erreur ni avertissement**. Le message actionnable
 * (« ce numéro est déjà utilisé ») est remplacé par un message générique, et
 * le statut HTTP passe de 409 à 400/500. C'est exactement ce qui s'est produit
 * lors de la montée en version : seuls les tests de concurrence l'ont vu.
 *
 * On ne suppose donc plus de profondeur : on parcourt la chaîne des causes.
 * Le helper reste correct si une version future retire l'encapsulation, ou en
 * ajoute une seconde.
 */

/** Profondeur maximale parcourue — garde-fou contre une chaîne circulaire. */
const PROFONDEUR_MAX = 5;

/**
 * Renvoie le code SQLSTATE porté par une erreur, où qu'il se trouve dans la
 * chaîne `cause`, ou `undefined` si l'erreur n'en porte aucun.
 */
export function codePostgres(erreur: unknown): string | undefined {
  const vus = new Set<unknown>();
  let courante = erreur;

  for (let profondeur = 0; courante && profondeur < PROFONDEUR_MAX; profondeur++) {
    if (vus.has(courante)) return undefined;
    vus.add(courante);

    const code = (courante as { code?: unknown }).code;
    if (typeof code === "string") return code;

    courante = (courante as { cause?: unknown }).cause;
  }

  return undefined;
}

/** Violation d'une contrainte d'unicité (index unique, clé primaire). */
export function estViolationUnicite(erreur: unknown): boolean {
  return codePostgres(erreur) === "23505";
}
