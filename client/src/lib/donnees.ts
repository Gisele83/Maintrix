/**
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE LE SERVEUR ENVOIE N'EST PAS CE QUE L'ÉCRAN CROIT RECEVOIR
 * ═══════════════════════════════════════════════════════════════════
 *
 * Deux écarts entre la donnée attendue et la donnée reçue ont produit, à eux
 * seuls, quatre pages entièrement blanches dans cette application.
 *
 * ─── 1. Les colonnes `decimal` arrivent en CHAÎNES ───────────────────
 *
 * Le pilote PostgreSQL rend `numeric` / `decimal` sous forme de chaîne, pour
 * ne pas perdre de précision. Vérifié sur l'environnement de test le
 * 20/10/2026, un bon de commande à 1 234,56 € :
 *
 *     GET /api/purchase-orders → [{ …, "totalAmount": "1234.56", … }]
 *
 * Or 68 colonnes du schéma sont des `decimal`, et les interfaces du client
 * les déclaraient `number`. Les conséquences dépendent de l'opérateur, et
 * c'est ce qui rend le défaut si difficile à voir :
 *
 *   • `.toFixed()`  → TypeError, écran blanc. C'est le cas le plus franc.
 *   • `+`           → CONCATÉNATION. Un cumul part de 0, puis « 0 » + « 150.00 »
 *                     donne « 0150.00 ». Aucune erreur, un total absurde.
 *   • `-`, `*`, `/` → conversion implicite, résultat juste. C'est précisément
 *                     pourquoi la moitié des écrans fonctionnent et que le
 *                     problème passe pour anecdotique.
 *   • `<`, `>`      → entre DEUX chaînes, comparaison lexicographique :
 *                     « 9.00 » > « 10.00 » est vrai.
 *
 * ─── 2. Une réponse qui n'a pas la forme attendue ────────────────────
 *
 * `antiLeakageValidator` remplace le corps d'une réponse par un objet
 * d'erreur. Il le faisait sans toucher au statut : l'écran recevait HTTP 200
 * et un objet là où il attendait un tableau. `const { data = [] }` ne protège
 * pas — la valeur n'est pas `undefined` — et le `.map` qui suit fait tomber la
 * page. Le serveur répond désormais 403 (corrigé le 2026-10-21), mais une
 * instance déployée avant ce correctif répond encore 200 : `queryClient.ts`
 * intercepte ce cas, et `liste()` est la ceinture pour ce qui passe à côté.
 */

/**
 * Ramène une valeur à un nombre utilisable, ou à `null` si elle n'en est pas
 * un. `null` veut dire « non mesuré » et doit s'afficher comme tel : jamais
 * comme zéro.
 */
export function nombre(valeur: unknown): number | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  if (typeof valeur === "number") return Number.isFinite(valeur) ? valeur : null;
  if (typeof valeur === "string" || typeof valeur === "bigint") {
    const n = Number(valeur);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Même chose, mais avec un repli explicite — pour les cumuls et les jauges. */
export function nombreOuZero(valeur: unknown): number {
  return nombre(valeur) ?? 0;
}

/** Montant en euros. Une valeur absente se dit « — », jamais « 0 € ». */
export function montant(valeur: unknown, options?: { decimales?: number }): string {
  const n = nombre(valeur);
  if (n === null) return "—";
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: options?.decimales ?? 0,
    maximumFractionDigits: options?.decimales ?? 0,
  });
}

/** Pourcentage. Une valeur absente se dit « — », jamais « 0 % ». */
export function pourcentage(valeur: unknown, decimales = 1): string {
  const n = nombre(valeur);
  if (n === null) return "—";
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: decimales })} %`;
}

/** Durée en heures. Une valeur absente se dit « — », jamais « 0 h ». */
export function heures(valeur: unknown, decimales = 1): string {
  const n = nombre(valeur);
  if (n === null) return "—";
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: decimales })} h`;
}

/**
 * Somme d'un champ sur une collection, en convertissant chaque terme. Écrite
 * pour remplacer les `reduce((s, x) => s + x.champ, 0)` qui concaténaient.
 */
export function somme<T>(elements: readonly T[] | undefined | null, champ: (element: T) => unknown): number {
  if (!Array.isArray(elements)) return 0;
  return elements.reduce<number>((total, element) => total + nombreOuZero(champ(element)), 0);
}

/**
 * Moyenne d'un champ, ou `null` si la population est vide. Une moyenne sans
 * population n'est pas zéro : elle n'existe pas.
 */
export function moyenne<T>(elements: readonly T[] | undefined | null, champ: (element: T) => unknown): number | null {
  if (!Array.isArray(elements) || elements.length === 0) return null;
  const valeurs = elements.map(champ).map(nombre).filter((n): n is number => n !== null);
  // Population vide : on sort AVANT la division. `NaN` s'afficherait « NaN % ».
  if (valeurs.length === 0) return null;
  const total = valeurs.reduce((a, b) => a + b, 0);
  return total / valeurs.length;
}

/**
 * Garantit un tableau. Une réponse qui n'en est pas un — un objet d'erreur
 * servi en HTTP 200, par exemple — donne un tableau vide plutôt qu'une page
 * blanche.
 */
export function liste<T>(valeur: unknown): T[] {
  return Array.isArray(valeur) ? (valeur as T[]) : [];
}

/**
 * Date courte, ou « — » si elle est absente ou illisible.
 *
 * `new Date(null)` vaut le 1er janvier 1970, et `new Date(undefined)` une
 * date invalide. Relevé à l'écran le 20/10/2026 sur un bon de commande sans
 * date de livraison : « Livraison prévue : 01/01/1970 ». Une date absente
 * doit se dire absente, pas se transformer en date plausible.
 */
export function dateCourte(valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "—";
  const d = valeur instanceof Date ? valeur : new Date(valeur as string);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR");
}

/**
 * Part d'un total, en pourcentage borné à 100. Un total nul ou absent ne
 * donne pas « 0 % » mais 0 de remplissage : l'écriture courante
 * `(valeur || 0) / (total || 1)` transformait « pas de total » en « 100 % ».
 */
export function part(valeur: unknown, total: unknown): number {
  const n = nombre(valeur);
  const t = nombre(total);
  if (n === null || t === null || t === 0) return 0;
  return Math.min(100, Math.max(0, (n / t) * 100));
}
