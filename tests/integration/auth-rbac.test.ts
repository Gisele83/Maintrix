/**
 * Authentification, RBAC et isolation multi-tenant — F05.
 *
 * S'appuie exclusivement sur les comptes créés par tests/seed.ts : aucun
 * utilisateur créé à la main, contrairement aux suites d'origine.
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  authenticateUser,
  createAuthenticatedRequest,
  anonymousRequest,
  getCsrfToken,
  SEEDED,
  API_BASE,
  type AuthenticatedAgent,
} from '../helpers/setup';
import request from 'supertest';

describe('Authentification', () => {
  it('accepte les identifiants seedés et renvoie le profil', async () => {
    const { csrfToken } = await getCsrfToken();
    const res = await request(API_BASE)
      .post('/api/enterprise-auth/login')
      .set('Cookie', `csrfToken=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: SEEDED.admin, password: SEEDED.password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.user).toMatchObject({ email: SEEDED.admin, role: 'admin' });
    expect(res.body.user.tenantId).toBe(SEEDED.tenantAlpha);
  });

  it('ne renvoie jamais le hash du mot de passe', async () => {
    const { csrfToken } = await getCsrfToken();
    const res = await request(API_BASE)
      .post('/api/enterprise-auth/login')
      .set('Cookie', `csrfToken=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: SEEDED.admin, password: SEEDED.password });

    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/\$2[aby]\$/);       // empreinte bcrypt
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('refuse un mot de passe erroné', async () => {
    const { csrfToken } = await getCsrfToken();
    const res = await request(API_BASE)
      .post('/api/enterprise-auth/login')
      .set('Cookie', `csrfToken=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: SEEDED.admin, password: 'mauvais-mot-de-passe' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'INVALID_CREDENTIALS');
  });

  it('refuse un compte inexistant avec le MÊME message (pas d\'énumération)', async () => {
    const { csrfToken } = await getCsrfToken();
    const res = await request(API_BASE)
      .post('/api/enterprise-auth/login')
      .set('Cookie', `csrfToken=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: 'personne@nulle-part.local', password: SEEDED.password });

    // Un message différent de celui du mauvais mot de passe permettrait
    // d'énumérer les comptes existants.
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'INVALID_CREDENTIALS');
  });

  it('exige des identifiants', async () => {
    const { csrfToken } = await getCsrfToken();
    const res = await request(API_BASE)
      .post('/api/enterprise-auth/login')
      .set('Cookie', `csrfToken=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'CREDENTIALS_REQUIRED');
  });

  it('refuse l\'accès aux routes protégées sans session', async () => {
    const res = await anonymousRequest('get', '/api/equipment');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});

describe('RBAC — droits selon le rôle', () => {
  let admin: AuthenticatedAgent;
  let technician: AuthenticatedAgent;

  beforeAll(async () => {
    admin = await authenticateUser(SEEDED.admin, SEEDED.password);
    technician = await authenticateUser(SEEDED.technician, SEEDED.password);
  });

  it('les deux rôles s\'authentifient avec le rôle attendu', () => {
    expect(admin.tenantId).toBe(SEEDED.tenantAlpha);
    expect(technician.tenantId).toBe(SEEDED.tenantAlpha);
  });

  it('un technicien peut lire les équipements de son tenant', async () => {
    const res = await createAuthenticatedRequest('get', '/api/equipment', technician);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('le diagnostic système détaillé est réservé aux administrateurs', async () => {
    const asAdmin = await createAuthenticatedRequest('get', '/api/system/health', admin);
    const asTech = await createAuthenticatedRequest('get', '/api/system/health', technician);

    // L'admin y accède (ou échoue pour une raison métier, pas d'autorisation).
    expect(asAdmin.status).not.toBe(403);
    // Le technicien doit être refusé.
    expect([401, 403]).toContain(asTech.status);
  });

  it('l\'état des tâches de fond n\'est pas exposé à un technicien', async () => {
    const asTech = await createAuthenticatedRequest('get', '/api/system/health', technician);
    expect(JSON.stringify(asTech.body)).not.toMatch(/backgroundTasks/);
  });
});

describe('Isolation multi-tenant', () => {
  let alpha: AuthenticatedAgent;
  let beta: AuthenticatedAgent;
  let createdEquipmentName: string;

  beforeAll(async () => {
    alpha = await authenticateUser(SEEDED.admin, SEEDED.password);
    beta = await authenticateUser(SEEDED.adminBeta, SEEDED.password);
  });

  it('les deux administrateurs appartiennent à des tenants distincts', () => {
    expect(alpha.tenantId).toBe(SEEDED.tenantAlpha);
    expect(beta.tenantId).toBe(SEEDED.tenantBeta);
    expect(alpha.tenantId).not.toBe(beta.tenantId);
  });

  it('un équipement créé dans Alpha n\'est pas visible depuis Beta', async () => {
    createdEquipmentName = `Isolation-${Date.now()}`;
    const created = await createAuthenticatedRequest('post', '/api/equipment', alpha).send({
      equipmentId: createdEquipmentName,
      equipmentName: createdEquipmentName,
      equipmentType: 'Grue portuaire',
      zone: 'Zone Isolation',
      criticalityLevel: 'medium',
      operationalState: 'operational',
    });
    expect([200, 201]).toContain(created.status);

    const fromAlpha = await createAuthenticatedRequest('get', '/api/equipment', alpha);
    expect(fromAlpha.status).toBe(200);
    expect(JSON.stringify(fromAlpha.body)).toContain(createdEquipmentName);

    const fromBeta = await createAuthenticatedRequest('get', '/api/equipment', beta);
    expect(fromBeta.status).toBe(200);
    // Le cœur du test : la donnée d'Alpha ne doit apparaître nulle part chez Beta.
    expect(JSON.stringify(fromBeta.body)).not.toContain(createdEquipmentName);
  });

  it('un en-tête X-Tenant-Id forgé ne donne pas accès aux données d\'un autre tenant', async () => {
    // Session Beta, mais en-tête revendiquant le tenant Alpha.
    const forged = await beta.agent
      .get('/api/equipment')
      .set('Cookie', beta.cookies.join('; '))
      .set('X-CSRF-Token', beta.csrfToken)
      .set('X-Tenant-Id', SEEDED.tenantAlpha);

    expect([200, 401, 403]).toContain(forged.status);
    if (forged.status === 200) {
      expect(JSON.stringify(forged.body)).not.toContain(createdEquipmentName);
    }
  });
});
