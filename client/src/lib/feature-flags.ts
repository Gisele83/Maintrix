/**
 * Drapeaux de fonctionnalités évalués à la CONSTRUCTION du client.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI À LA CONSTRUCTION, ET NON À L'EXÉCUTION
 * ═══════════════════════════════════════════════════════════════════
 * Ces drapeaux gouvernent la page d'accueil, qui est PUBLIQUE : le visiteur
 * n'est pas authentifié. Le mécanisme existant, `useEntitlements`, ne convient
 * donc pas — il interroge `/api/platform/entitlements`, route réservée aux
 * sessions ouvertes.
 *
 * Vite remplace `import.meta.env.VITE_*` par une valeur littérale au moment du
 * build. Une section placée derrière un drapeau désactivé n'est pas seulement
 * masquée : elle **disparaît du bundle**. Un testeur ne peut donc pas la
 * retrouver dans les outils de développement, ce qu'un simple `display: none`
 * n'aurait pas empêché.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI ÉTEINT PAR DÉFAUT
 * ═══════════════════════════════════════════════════════════════════
 * Les deux oublis possibles n'ont pas la même gravité :
 *
 *   • oublier le drapeau en PRODUCTION → la page tarifs manque. Visible
 *     immédiatement, sans conséquence pour personne ;
 *   • oublier le drapeau en TEST → des testeurs voient une offre payante,
 *     s'engagent dans un parcours d'abonnement… qui n'aboutit pas. Mesuré sur
 *     l'environnement de test : `/api/payments/create-payment-intent` et
 *     `/api/paypal/create-order` répondent **404**, Stripe n'y étant pas
 *     configuré.
 *
 * On choisit donc le défaut qui échoue du bon côté : il faut demander
 * explicitement l'offre payante.
 */

/** `true` uniquement si la variable vaut exactement la chaîne "true". */
const actif = (valeur: unknown): boolean => valeur === "true";

/**
 * Affichage de l'offre payante : grille tarifaire, liens « Tarifs », parcours
 * d'abonnement depuis la page d'accueil.
 *
 * Activer en production :
 *     VITE_ENABLE_BILLING=true npm run build
 *
 * Ce drapeau ne gouverne QUE l'affichage. Il ne remplace aucun contrôle serveur :
 * les routes de paiement ne sont enregistrées que si les clés Stripe sont
 * présentes, et c'est cette absence qui empêche réellement une transaction.
 */
export const BILLING_ENABLED = actif(import.meta.env.VITE_ENABLE_BILLING);
