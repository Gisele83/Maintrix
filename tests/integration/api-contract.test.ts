/**
 * Contrat général de l'API — F05.
 *
 * Garanties transverses attendues de TOUTE route /api, indépendamment du
 * module. Ces tests sont volontairement peu nombreux et très stables : ils
 * servent de barrière avant déploiement, pas de mesure de couverture.
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  authenticateUser,
  createAuthenticatedRequest,
  anonymousRequest,
  SEEDED,
  type AuthenticatedAgent,
} from '../helpers/setup';

describe('Contrat général de l\'API', () => {
  let auth: AuthenticatedAgent;

  beforeAll(async () => {
    auth = await authenticateUser(SEEDED.admin, SEEDED.password);
  });

  describe('Sonde de santé', () => {
    it('répond 200 sans authentification', async () => {
      const res = await anonymousRequest('get', '/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body.checks).toHaveProperty('database', 'ok');
    });

    it('n\'expose aucune information sensible', async () => {
      const res = await anonymousRequest('get', '/api/health');
      const raw = JSON.stringify(res.body);
      expect(raw).not.toMatch(/postgres(ql)?:\/\//i);
      expect(raw).not.toMatch(/"(version|environment|hostname)"/i);
      expect(raw).not.toMatch(/ECONNREFUSED|password/i);
    });
  });

  describe('Routes API inconnues', () => {
    // Défaut trouvé en F05 : le catch-all de la SPA interceptait ces requêtes
    // et renvoyait 200 + index.html. Un client faisant `if (res.ok) res.json()`
    // échouait sur une erreur de parsing, et tout endpoint supprimé devenait
    // silencieux. Ces trois tests verrouillent la correction.
    it('renvoie 404 et non 200 + HTML pour un chemin inexistant', async () => {
      const res = await createAuthenticatedRequest('get', '/api/chemin-qui-nexiste-pas-xyz', auth);
      expect(res.status).toBe(404);
    });

    it('renvoie du JSON, jamais du HTML', async () => {
      const res = await createAuthenticatedRequest('get', '/api/chemin-qui-nexiste-pas-xyz', auth);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error', 'NOT_FOUND');
      expect(typeof res.text === 'string' ? res.text : '').not.toMatch(/<!DOCTYPE html>/i);
    });

    it('vaut pour toutes les méthodes, pas seulement GET', async () => {
      const res = await createAuthenticatedRequest('post', '/api/chemin-qui-nexiste-pas-xyz', auth).send({});
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('En-têtes de sécurité', () => {
    it('pose les en-têtes de protection sur les réponses API', async () => {
      const res = await anonymousRequest('get', '/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('Protection CSRF', () => {
    it('émet un jeton csrfToken exploitable par le client', async () => {
      const res = await anonymousRequest('get', '/api/health');
      const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
      expect(Array.isArray(cookies)).toBe(true);
      expect((cookies ?? []).some(c => /csrfToken=/.test(c))).toBe(true);
    });

    it('rejette une écriture sans jeton CSRF', async () => {
      // Session valide mais aucun en-tête X-CSRF-Token : doit être refusée.
      const res = await auth.agent
        .post('/api/equipment')
        .set('Cookie', auth.cookies.join('; '))
        .send({ equipmentName: 'Sans CSRF' });
      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'CSRF_TOKEN_INVALID');
    });
  });
});
