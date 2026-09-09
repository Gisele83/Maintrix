/**
 * Jetons temporaires de changement de mot de passe à la première connexion.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Le flux de première connexion produisait déjà un `tempSessionToken`
 * (`crypto.randomBytes(32)`) et l'exigeait en entrée de
 * `/api/enterprise-auth/force-password-change`. Mais il n'était **stocké nulle
 * part et comparé à rien** : le schéma zod vérifiait seulement qu'il s'agissait
 * d'une chaîne non vide. N'importe quelle valeur passait.
 *
 * Ce n'était pas exploitable — la vraie défense du flux reste la vérification
 * bcrypt du mot de passe temporaire — mais c'était un leurre. Un développeur
 * convaincu que le flux était protégé par un jeton pouvait relâcher la
 * vérification du mot de passe en croyant conserver une barrière.
 *
 * On rend donc le jeton réel : lié à un utilisateur, à usage unique, expirant.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI EN MÉMOIRE, ET NON EN BASE
 * ═══════════════════════════════════════════════════════════════════
 * Une table dédiée imposerait une migration, or le journal drizzle est
 * incomplet (9 migrations manquantes) : ajouter une table maintenant
 * aggraverait une dette connue au lieu de la traiter.
 *
 * Le stockage en mémoire est cohérent avec l'architecture existante, qui
 * suppose déjà **une seule instance applicative** — voir
 * docs/SINGLE_INSTANCE_ASSUMPTION.md. Les conséquences sont bornées et
 * acceptables : un redémarrage invalide les jetons en cours, et l'utilisateur
 * doit simplement se reconnecter pour en obtenir un neuf. Aucune donnée n'est
 * perdue.
 *
 * ⚠️ Si Maintrix passe un jour à plusieurs instances, ce magasin doit migrer
 * vers un stockage partagé (base ou Redis), au même titre que les autres
 * éléments listés dans SINGLE_INSTANCE_ASSUMPTION.md.
 */
import crypto from "crypto";

/** Durée de validité d'un jeton. Assez pour changer un mot de passe, pas plus. */
const DUREE_VALIDITE_MS = 15 * 60 * 1000;

/** Plafond de sécurité : empêche une croissance non bornée du magasin. */
const MAX_JETONS = 10_000;

interface JetonTemporaire {
  userId: number;
  expireLe: number;
}

const jetons = new Map<string, JetonTemporaire>();

/** Supprime les jetons expirés. Appelé à chaque écriture — pas de minuterie. */
function purger(): void {
  const maintenant = Date.now();
  for (const [valeur, jeton] of jetons) {
    if (jeton.expireLe <= maintenant) jetons.delete(valeur);
  }
}

/**
 * Émet un jeton lié à un utilisateur.
 *
 * Tout jeton déjà émis pour ce même utilisateur est révoqué : deux tentatives
 * de première connexion ne doivent pas laisser deux jetons valides en
 * circulation.
 */
export function emettreJetonTemporaire(userId: number): string {
  purger();

  for (const [valeur, jeton] of jetons) {
    if (jeton.userId === userId) jetons.delete(valeur);
  }

  // Garde-fou : si le magasin déborde malgré la purge, on refuse de croître
  // indéfiniment plutôt que de consommer la mémoire du processus.
  if (jetons.size >= MAX_JETONS) {
    const plusAncien = [...jetons.entries()].sort((a, b) => a[1].expireLe - b[1].expireLe)[0];
    if (plusAncien) jetons.delete(plusAncien[0]);
  }

  const valeur = crypto.randomBytes(32).toString("hex");
  jetons.set(valeur, { userId, expireLe: Date.now() + DUREE_VALIDITE_MS });
  return valeur;
}

/**
 * Vérifie qu'un jeton existe, n'a pas expiré et appartient à l'utilisateur
 * annoncé — **sans le consommer**.
 *
 * La vérification et la consommation sont séparées à dessein. Brûler le jeton
 * dès sa présentation obligerait l'utilisateur à se reconnecter à la moindre
 * faute de frappe sur son mot de passe actuel : une protection qui rend le
 * parcours d'accueil pénible finit contournée. La route reste protégée contre
 * le bourrinage par son propre limiteur de débit, et le jeton expire de
 * lui-même au bout de {@link DUREE_VALIDITE_MS}.
 */
export function verifierJetonTemporaire(valeur: unknown, userId: number): boolean {
  purger();

  if (typeof valeur !== "string" || valeur.length === 0) return false;

  const jeton = jetons.get(valeur);
  if (!jeton) return false;
  if (jeton.expireLe <= Date.now()) {
    jetons.delete(valeur);
    return false;
  }

  return jeton.userId === userId;
}

/**
 * Retire définitivement un jeton du magasin. Appelé une fois le mot de passe
 * effectivement changé : le jeton ne peut plus être rejoué.
 */
export function consommerJetonTemporaire(valeur: unknown): void {
  if (typeof valeur === "string") jetons.delete(valeur);
  purger();
}

/** Nombre de jetons valides en circulation — utilisé par les tests. */
export function nombreJetonsActifs(): number {
  purger();
  return jetons.size;
}
