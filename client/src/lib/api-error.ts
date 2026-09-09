/**
 * Rendre lisible une erreur d'API.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE MODULE EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * `apiRequest` signale un échec en levant `new Error("401: {json}")`
 * (voir `throwIfResNotOk` dans queryClient.ts). Les pages affichaient
 * directement `error.message`, si bien que l'utilisateur lisait :
 *
 *     401: {"error":"INVALID_CREDENTIALS","message":"Invalid email or password"}
 *
 * …au lieu d'une phrase. Constaté sur l'environnement déployé, à la connexion
 * comme à l'inscription.
 *
 * Deux défauts s'y superposaient : le corps JSON brut préfixé du code HTTP, et
 * un message serveur en anglais sur une interface française.
 */

/** Ce que le serveur a réellement répondu, extrait de l'erreur levée. */
export interface DetailErreurApi {
  /** Code applicatif, ex. `INVALID_CREDENTIALS`. */
  code?: string;
  /** Message du serveur, tel quel. */
  message?: string;
  /** Code HTTP, s'il a pu être lu. */
  statut?: number;
}

/**
 * Messages français pour les codes dont le serveur répond en anglais, ou dont
 * la formulation d'origine n'aide pas l'utilisateur.
 *
 * Tout code absent de cette table conserve le message du serveur : la plupart
 * sont déjà en français et souvent plus précis qu'une reformulation générique.
 */
const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "E-mail ou mot de passe incorrect.",
  ACCOUNT_LOCKED: "Ce compte est temporairement bloqué. Réessayez plus tard.",
  RATE_LIMIT_EXCEEDED:
    "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
  ORIGIN_NOT_ALLOWED:
    "Connexion refusée depuis cette adresse. Contactez l'administrateur de l'environnement.",
  NOT_FOUND: "Cette fonctionnalité n'est pas disponible sur cet environnement.",
};

export function detailErreurApi(error: unknown): DetailErreurApi {
  const brut = error instanceof Error ? error.message : String(error ?? "");

  const statut = Number(brut.match(/^(\d{3}):/)?.[1]) || undefined;

  const debut = brut.indexOf("{");
  if (debut === -1) return { statut };

  try {
    const o = JSON.parse(brut.slice(debut));
    return { code: o?.error, message: o?.message, statut };
  } catch {
    // Réponse non JSON (page d'erreur HTML d'un proxy, coupure réseau) : on ne
    // devine pas, l'appelant affichera son message par défaut.
    return { statut };
  }
}

/**
 * Phrase à montrer à l'utilisateur.
 *
 * @param defaut message affiché quand le serveur n'en fournit aucun
 *               d'exploitable — panne réseau, réponse HTML, corps vide.
 */
export function messageErreurApi(error: unknown, defaut: string): string {
  const { code, message } = detailErreurApi(error);
  if (code && MESSAGES[code]) return MESSAGES[code];
  return message?.trim() || defaut;
}
