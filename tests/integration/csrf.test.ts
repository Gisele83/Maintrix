/**
 * Protection CSRF : étendue des exemptions — F06.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI EST VÉRIFIÉ
 * ═══════════════════════════════════════════════════════════════════
 * Le middleware CSRF de server/index.ts exempte une liste de chemins, comparés
 * par PRÉFIXE (`startsWith`). Un préfixe comme `/api/payments` exempte donc
 * tout ce qui vit dessous, alors qu'une seule de ces routes — le webhook — a
 * une raison de l'être.
 *
 * Chaque test isole une assertion unique et précise : la requête est-elle
 * refusée avec `CSRF_TOKEN_INVALID`, oui ou non ? On ne teste jamais le
 * résultat métier de l'endpoint, qui peut légitimement échouer pour d'autres
 * raisons (validation, configuration Stripe absente…).
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import {
  authenticateUser,
  createAuthenticatedRequest,
  SEEDED,
  API_BASE,
  freshCsrfToken,
  superAdminRequest,
  type AuthenticatedAgent,
} from '../helpers/setup';

let auth: AuthenticatedAgent;
let superAdminToken = '';

/** La réponse est-elle un refus CSRF ? */
function isCsrfRejection(res: { status: number; body: any }): boolean {
  return res.status === 403 && res.body?.error === 'CSRF_TOKEN_INVALID';
}

/** POST authentifié par session, SANS en-tête X-CSRF-Token. */
function postWithoutCsrf(path: string, body: Record<string, unknown> = {}) {
  return auth.agent.post(path).set('Cookie', auth.cookies.join('; ')).send(body);
}

/** POST super-admin (cookie + Bearer), SANS en-tête X-CSRF-Token. */
function postSuperAdminWithoutCsrf(path: string, body: Record<string, unknown> = {}) {
  return request(API_BASE)
    .post(path)
    .set('Authorization', `Bearer ${superAdminToken}`)
    .send(body);
}

beforeAll(async () => {
  auth = await authenticateUser(SEEDED.admin, SEEDED.password);

  const res = await request(API_BASE).post('/api/super-admin/login').send({
    email: process.env.SUPER_ADMIN_EMAIL,
    password: process.env.SUPER_ADMIN_PASSWORD,
    secretKey: process.env.SUPER_ADMIN_SECRET,
  });
  expect(res.status).toBe(200);
  superAdminToken = res.body.token ?? res.body.superAdminToken ?? '';
  expect(superAdminToken).toBeTruthy();
});

// ═══════════════════════════════════════════════════════════════════
describe('F06 — Référence : la protection CSRF fonctionne', () => {
  it('une écriture ordinaire sans jeton CSRF est refusée', async () => {
    const res = await postWithoutCsrf('/api/equipment', { equipmentName: 'Sans CSRF' });
    expect(isCsrfRejection(res)).toBe(true);
  });

  it('la même écriture AVEC jeton CSRF n\'est pas refusée pour ce motif', async () => {
    const res = await createAuthenticatedRequest('post', '/api/equipment', auth).send({
      equipmentId: `CSRF-OK-${Date.now()}`,
      equipmentName: 'Avec CSRF',
      equipmentType: 'Grue portuaire',
      zone: 'Zone CSRF',
    });
    expect(isCsrfRejection(res)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('F06 — Exemptions qui doivent être CONSERVÉES', () => {
  // Ces endpoints ne peuvent pas exiger de jeton CSRF : soit l'appelant n'a pas
  // encore de session (connexion), soit c'est un tiers externe (webhook).

  it('la connexion applicative reste exemptée', async () => {
    const res = await request(API_BASE)
      .post('/api/enterprise-auth/login')
      .send({ email: SEEDED.admin, password: SEEDED.password });
    expect(isCsrfRejection(res)).toBe(false);
  });

  it('la connexion super-admin reste exemptée', async () => {
    const res = await request(API_BASE).post('/api/super-admin/login').send({
      email: process.env.SUPER_ADMIN_EMAIL,
      password: process.env.SUPER_ADMIN_PASSWORD,
      secretKey: process.env.SUPER_ADMIN_SECRET,
    });
    expect(isCsrfRejection(res)).toBe(false);
  });

  it('le webhook Stripe reste exempté (il vérifie sa propre signature)', async () => {
    // Stripe ne peut évidemment pas fournir de jeton CSRF. La compensation est
    // la vérification de signature `stripe-signature`, présente dans le
    // handler : le webhook doit donc échouer pour SIGNATURE, jamais pour CSRF.
    const res = await request(API_BASE)
      .post('/api/payments/webhook')
      .send({ type: 'payment_intent.succeeded' });
    expect(isCsrfRejection(res)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('F06 — Exemptions trop larges qui doivent être RETIRÉES', () => {
  // Le préfixe `/api/payments` couvre 4 routes, dont UNE SEULE est un webhook.
  // Les trois autres sont initiées par un utilisateur authentifié et doivent
  // donc être protégées.

  it('POST /api/payments/create-subscription exige un jeton CSRF', async () => {
    const res = await postWithoutCsrf('/api/payments/create-subscription', { plan: 'pro' });
    expect(isCsrfRejection(res)).toBe(true);
  });

  it('POST /api/payments/create-payment-intent exige un jeton CSRF', async () => {
    const res = await postWithoutCsrf('/api/payments/create-payment-intent', { amount: 1000 });
    expect(isCsrfRejection(res)).toBe(true);
  });

  it('POST /api/payments/cancel-subscription exige un jeton CSRF', async () => {
    // Route destructrice : une annulation d'abonnement déclenchée à l'insu de
    // l'utilisateur est le scénario CSRF classique.
    const res = await postWithoutCsrf('/api/payments/cancel-subscription', {});
    expect(isCsrfRejection(res)).toBe(true);
  });

  // Le préfixe `/api/paypal` n'abrite AUCUN webhook : ces deux routes sont
  // entièrement initiées par l'utilisateur.
  it('POST /api/paypal/create-order exige un jeton CSRF', async () => {
    const res = await postWithoutCsrf('/api/paypal/create-order', { amount: '10.00' });
    expect(isCsrfRejection(res)).toBe(true);
  });

  it('POST /api/paypal/capture-order exige un jeton CSRF', async () => {
    const res = await postWithoutCsrf('/api/paypal/capture-order', { orderId: 'TEST' });
    expect(isCsrfRejection(res)).toBe(true);
  });

  // Le préfixe `/api/super-admin` exempte 11 routes d'écriture, dont la
  // création de tenants et d'utilisateurs, sur un compte à privilèges maximaux.
  it('POST /api/super-admin/tenants exige un jeton CSRF', async () => {
    const res = await postSuperAdminWithoutCsrf('/api/super-admin/tenants', {
      name: `CsrfProbe${Date.now()}`,
      domain: `csrf-probe-${Date.now()}.test.local`,
      adminEmail: `csrf-${Date.now()}@probe.test.local`,
    });
    expect(isCsrfRejection(res)).toBe(true);
  });

  it('POST /api/super-admin/create-user exige un jeton CSRF', async () => {
    const res = await postSuperAdminWithoutCsrf('/api/super-admin/create-user', {
      email: `csrf-user-${Date.now()}@probe.test.local`,
      tenantId: SEEDED.tenantAlpha,
      role: 'technician',
    });
    expect(isCsrfRejection(res)).toBe(true);
  });

  it('POST /api/super-admin/reset-password-flags exige un jeton CSRF', async () => {
    const res = await postSuperAdminWithoutCsrf('/api/super-admin/reset-password-flags', {});
    expect(isCsrfRejection(res)).toBe(true);
  });

  it('POST /api/data-import-export/import exige un jeton CSRF', async () => {
    // Import de données en masse : écriture volumineuse et difficilement
    // réversible, aucune raison de l'exempter.
    const res = await postWithoutCsrf('/api/data-import-export/import', {});
    expect(isCsrfRejection(res)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('F06 — La correction ne casse pas les routes concernées', () => {
  it('les routes de paiement restent joignables AVEC un jeton CSRF', async () => {
    const res = await createAuthenticatedRequest('post', '/api/payments/create-subscription', auth)
      .send({ plan: 'pro' });
    // Peut échouer faute de configuration Stripe — mais jamais pour CSRF.
    expect(isCsrfRejection(res)).toBe(false);
  });

  it('les routes super-admin restent joignables AVEC un jeton CSRF', async () => {
    const token = await freshCsrfToken();
    const res = await superAdminRequest('post', '/api/super-admin/tenants', superAdminToken, token)
      .send({
        name: `CsrfAllowed${Date.now()}`,
        domain: `csrf-allowed-${Date.now()}.test.local`,
        adminEmail: `csrf-allowed-${Date.now()}@probe.test.local`,
        adminFirstName: 'Csrf',
        adminLastName: 'Allowed',
        maxUsers: 3,
      });
    expect(isCsrfRejection(res)).toBe(false);
    expect([200, 201]).toContain(res.status);
  });
});
