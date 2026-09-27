/**
 * Rétablir un accès lève-t-il aussi le blocage du limiteur ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Le bouton « Réinitialiser le mot de passe » de la console remettait le
 * compte en état — mot de passe, verrou, expiration, tentatives — mais laissait
 * le limiteur anti-force-brute en place.
 *
 * Or ce limiteur bloque la connexion PAR ADRESSE IP : à ce stade la session
 * n'existe pas, donc `req.tenantId` est absent et l'identifiant retombe sur
 * `req.ip`. Un blocage posé par les tentatives infructueuses survit au nouveau
 * mot de passe, et la personne reste dehors une heure de plus — en croyant que
 * le mot de passe qu'on vient de lui donner est déjà faux.
 *
 * Deux propriétés sont épinglées ici :
 *   1. le motif couvre TOUTES les routes du routeur d'authentification, y
 *      compris celles qu'on oublie en énumérant (`reset-password/verify`,
 *      `invitations/accept`) ;
 *   2. la purge reste étroite : uniquement les entrées bloquantes, uniquement
 *      ce routeur — le reste de l'API garde sa protection.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..');
const lire = (...parties: string[]) => readFileSync(join(RACINE, ...parties), 'utf8');

/** Traduit un motif SQL `LIKE` en expression régulière équivalente. */
function depuisLike(motif: string): RegExp {
  const echappe = motif.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${echappe.split('%').join('.*')}$`);
}

describe('Levée du blocage lors du rétablissement d\'un accès', () => {
  const routeSuperAdmin = lire('server', 'super-admin-routes.ts');
  const routesAuth = lire('server', 'enterprise-auth-routes.ts');

  /** Le motif réellement utilisé par la route, relu depuis la source. */
  const motif = (() => {
    const trouve = routeSuperAdmin.match(/like\(rateLimits\.endpoint,\s*'([^']+)'\)/);
    if (!trouve) throw new Error('aucun motif de purge du limiteur dans super-admin-routes.ts');
    return trouve[1];
  })();

  /** Les points d'entrée réellement soumis au limiteur. */
  const endpointsLimites = [...routesAuth.matchAll(/rateLimitByTenant\('([^']+)'/g)]
    .map((m) => m[1]);

  it('des routes d\'authentification sont bien soumises au limiteur', () => {
    // Garde-fou du test lui-même : s'il ne trouve plus rien, il ne prouve rien.
    expect(endpointsLimites.length).toBeGreaterThan(5);
    expect(endpointsLimites).toContain('/api/enterprise-auth/login');
  });

  it('le motif couvre TOUTES ces routes, sans exception', () => {
    const expression = depuisLike(motif);
    const oubliees = endpointsLimites.filter((e) => !expression.test(e));
    expect(oubliees).toEqual([]);
  });

  it('les routes souvent oubliées sont couvertes', () => {
    const expression = depuisLike(motif);
    // Un blocage sur ces trois-là enferme autant qu'un blocage sur `login`.
    for (const route of [
      '/api/enterprise-auth/reset-password/verify',
      '/api/enterprise-auth/invitations/accept',
      '/api/enterprise-auth/force-password-change',
    ]) {
      expect({ route, couverte: expression.test(route) }).toEqual({ route, couverte: true });
    }
  });

  it('la purge n\'atteint pas le reste de l\'API', () => {
    const expression = depuisLike(motif);
    for (const route of [
      '/api/equipment',
      '/api/work-orders',
      '/api/diagnostic',
      '/api/super-admin/login',
    ]) {
      expect({ route, atteinte: expression.test(route) }).toEqual({ route, atteinte: false });
    }
  });

  it('seules les entrées bloquantes sont supprimées', () => {
    // Sans cette condition, on remettrait à zéro tous les compteurs en cours et
    // le limiteur deviendrait contournable en demandant une réinitialisation.
    expect(routeSuperAdmin).toMatch(/eq\(rateLimits\.isBlocked,\s*true\)/);
  });
});
