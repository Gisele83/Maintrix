/**
 * Lisibilité des erreurs d'API — barrière de régression.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CETTE BARRIÈRE EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * `apiRequest` signale un échec en levant `new Error("401: {json}")`. Les pages
 * de connexion et d'inscription affichaient directement `error.message`, si
 * bien que l'utilisateur lisait, mot pour mot :
 *
 *     401: {"error":"INVALID_CREDENTIALS","message":"Invalid email or password"}
 *
 * Mesuré sur l'environnement déployé. Deux défauts s'y superposaient : le corps
 * JSON brut préfixé du code HTTP, et un message serveur en anglais sur une
 * interface française.
 *
 * Ce test épingle le contrat : ce qui est montré à l'utilisateur est une
 * phrase, jamais une réponse HTTP.
 */
import { describe, it, expect } from '@jest/globals';
import { detailErreurApi, messageErreurApi } from '../../client/src/lib/api-error';

/** Reproduit fidèlement ce que lève `throwIfResNotOk`. */
const erreurApi = (statut: number, corps: unknown) =>
  new Error(`${statut}: ${typeof corps === 'string' ? corps : JSON.stringify(corps)}`);

describe('F12 — Les erreurs d\'API restent lisibles', () => {
  it('extrait code, message et statut d\'une erreur levée', () => {
    const d = detailErreurApi(erreurApi(400, { error: 'EMAIL_ALREADY_EXISTS', message: 'Un utilisateur avec cet email existe déjà' }));
    expect(d.code).toBe('EMAIL_ALREADY_EXISTS');
    expect(d.message).toBe('Un utilisateur avec cet email existe déjà');
    expect(d.statut).toBe(400);
  });

  it('traduit le message anglais des identifiants invalides', () => {
    // C'est le cas RÉELLEMENT observé en production.
    const affiche = messageErreurApi(
      erreurApi(401, { error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }),
      'Identifiants incorrects',
    );
    expect(affiche).toBe('E-mail ou mot de passe incorrect.');
    expect(affiche).not.toMatch(/Invalid email/);
  });

  it('conserve le message du serveur quand il est déjà exploitable', () => {
    // On ne reformule pas ce qui est correct : le message serveur est souvent
    // plus précis qu'une phrase générique.
    const affiche = messageErreurApi(
      erreurApi(400, { error: 'USERNAME_ALREADY_EXISTS', message: 'Ce nom d\'utilisateur est déjà pris' }),
      'Erreur',
    );
    expect(affiche).toBe('Ce nom d\'utilisateur est déjà pris');
  });

  it('ne laisse JAMAIS filtrer le code HTTP ni le JSON brut', () => {
    const cas = [
      erreurApi(401, { error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }),
      erreurApi(404, { error: 'NOT_FOUND', message: 'Route API inconnue : POST /api/auth/register' }),
      erreurApi(500, { error: 'INTERNAL', message: 'Erreur interne' }),
    ];
    for (const e of cas) {
      const affiche = messageErreurApi(e, 'Une erreur est survenue.');
      expect(affiche).not.toMatch(/^\d{3}:/);
      expect(affiche).not.toMatch(/[{}"]/);
    }
  });

  it('retombe sur le message par défaut quand la réponse n\'est pas exploitable', () => {
    // Page d'erreur HTML d'un proxy, corps vide, coupure réseau : on ne devine
    // pas — mais on n'affiche pas non plus du HTML à l'utilisateur.
    const defaut = 'Impossible de joindre le serveur.';
    expect(messageErreurApi(new Error('502: <html><body>Bad Gateway</body></html>'), defaut)).toBe(defaut);
    expect(messageErreurApi(new Error('Failed to fetch'), defaut)).toBe(defaut);
    expect(messageErreurApi(undefined, defaut)).toBe(defaut);
  });

  it('un message serveur vide ne masque pas le message par défaut', () => {
    const defaut = 'Une erreur est survenue.';
    expect(messageErreurApi(erreurApi(500, { error: 'X', message: '   ' }), defaut)).toBe(defaut);
  });
});
