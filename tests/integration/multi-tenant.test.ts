import request from 'supertest';
import { describe, it, expect, beforeAll } from '@jest/globals';
import { getCsrfToken, authenticateUser, createAuthenticatedRequest, type AuthenticatedAgent } from '../helpers/setup';

// API_BASE vient du helper : plus aucun repli codé en dur.
import { API_BASE } from '../helpers/setup';

describe('Multi-Tenant Module Integration Tests', () => {
  let superAdminAuth: AuthenticatedAgent;
  let tenant1Auth: AuthenticatedAgent;
  let tenant2Auth: AuthenticatedAgent;
  let testTenantId: string;

  beforeAll(async () => {
    const agent = request.agent(API_BASE);
    
    const healthResponse = await agent.get('/api/health');
    
    const rawCookies = healthResponse.headers['set-cookie'];
    const cookies = Array.isArray(rawCookies) ? rawCookies : [];
    let csrfToken = '';
    
    for (const cookie of cookies) {
      const match = cookie.match(/csrfToken=([^;]+)/);
      if (match) {
        csrfToken = decodeURIComponent(match[1]);
        break;
      }
    }
    
    const superAdminLogin = await agent
      .post('/api/enterprise-auth/login')
      .set('X-CSRF-Token', csrfToken)
      .send({
        email: 'admin@maintrix.local',
        password: 'Maintrix2024!'
      });

    if (superAdminLogin.status === 200) {
      const rawSessionCookies = superAdminLogin.headers['set-cookie'];
      const sessionCookies = Array.isArray(rawSessionCookies) ? rawSessionCookies : cookies;
      superAdminAuth = {
        agent,
        cookies: sessionCookies,
        csrfToken,
        userId: superAdminLogin.body.user?.id
      };
    }
  });

  describe('Tenant Management API', () => {
    it('should create a new tenant', async () => {
      if (!superAdminAuth) {
        throw new Error('Super admin not authenticated');
      }

      const response = await superAdminAuth.agent
        .post('/api/tenants')
        .set('Cookie', superAdminAuth.cookies.join('; '))
        .set('X-CSRF-Token', superAdminAuth.csrfToken)
        .send({
          name: `Test Tenant ${Date.now()}`,
          domain: `test-${Date.now()}.maintrix.local`,
          plan: 'pro',
          maxUsers: 10,
          contactEmail: `test-${Date.now()}@maintrix.local`
        });

      // ⚠️ CONSTAT F05 — il n'existe aucune route `/api/tenants`.
      // La gestion des tenants vit sous `/api/super-admin/tenants`, derrière
      // un flux d'authentification super-admin distinct (jeton dédié), et non
      // derrière une session d'administrateur de tenant comme le supposait ce
      // test. Celui-ci ne « passait » que grâce au faux 200 + HTML renvoyé par
      // les routes /api inconnues, corrigé en F05.
      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    // Spécification non réalisée sous ce chemin — conservée comme « à faire »
    // plutôt que supprimée.
    it.todo('CRUD tenants sous /api/tenants — à implémenter, ou tests à porter sur /api/super-admin/tenants');

    it("la gestion des tenants n'est PAS accessible avec une simple session admin", async () => {
      // Propriété de sécurité réelle et vérifiable : un administrateur de
      // tenant ne doit pas pouvoir lister les tenants de la plateforme.
      const response = await superAdminAuth.agent
        .get('/api/super-admin/tenants')
        .set('Cookie', superAdminAuth.cookies.join('; '))
        .set('X-CSRF-Token', superAdminAuth.csrfToken);

      expect([401, 403]).toContain(response.status);
      expect(JSON.stringify(response.body)).not.toMatch(/alpha\.test\.local|beta\.test\.local/);
    });

    // Dépend de /api/tenants/:id — route inexistante (voir constat ci-dessus).
    // Se terminait par `return` et comptait comme RÉUSSI : un faux vert.
    it.todo('PATCH /api/tenants/:id — réglages tenant, endpoint à implémenter');
    it.skip('should update tenant settings', async () => {
      if (!superAdminAuth || !testTenantId) return;

      const response = await superAdminAuth.agent
        .patch(`/api/tenants/${testTenantId}`)
        .set('Cookie', superAdminAuth.cookies.join('; '))
        .set('X-CSRF-Token', superAdminAuth.csrfToken)
        .send({
          maxUsers: 20,
          plan: 'business'
        });

      expect([200, 404, 401]).toContain(response.status);
    });
  });

  describe('Tenant Isolation Tests', () => {
    let tenant1EquipmentId: string;
    let tenant2EquipmentId: string;

    it('should isolate tenant 1 data', async () => {
      tenant1Auth = await authenticateUser('admin@maintrix.local', 'Maintrix2024!');

      const createEquipment = await createAuthenticatedRequest('post', '/api/equipment', tenant1Auth)
        .send({
          equipmentId: `TENANT1-EQ-${Date.now()}`,
          equipmentName: 'Tenant 1 Equipment',
          equipmentType: 'Grue',
          zone: 'Zone T1'
        });

      if (createEquipment.status === 200 || createEquipment.status === 201) {
        tenant1EquipmentId = createEquipment.body.equipment?.equipmentId;
      }

      expect(tenant1Auth).toBeDefined();
      expect(tenant1Auth.cookies).toBeDefined();
    });

    it('should prevent cross-tenant data access', async () => {
      if (!tenant1EquipmentId || !tenant2Auth) {
        return;
      }

      const response = await createAuthenticatedRequest('get', `/api/equipment/${tenant1EquipmentId}`, tenant2Auth);

      expect([404, 403, 401]).toContain(response.status);
    });
  });

  describe('Tenant User Management', () => {
    it.todo("POST /api/tenants/users — création d'utilisateur de tenant, endpoint à implémenter");
    it.skip('should create user for tenant', async () => {
      if (!superAdminAuth || !testTenantId) return;

      const response = await superAdminAuth.agent
        .post('/api/tenants/users')
        .set('Cookie', superAdminAuth.cookies.join('; '))
        .set('X-CSRF-Token', superAdminAuth.csrfToken)
        .send({
          tenantId: testTenantId,
          email: `user-${Date.now()}@test-tenant.com`,
          firstName: 'Test',
          lastName: 'User',
          role: 'technician',
          department: 'Maintenance'
        });

      expect([200, 201, 400, 401]).toContain(response.status);
    });
  });

  describe('Tenant Feature Flags', () => {
    it.todo('POST /api/tenants/:id/features — activation de fonctionnalité, endpoint à implémenter');
    it.skip('should enable feature for tenant', async () => {
      if (!superAdminAuth || !testTenantId) return;

      const response = await superAdminAuth.agent
        .post(`/api/tenants/${testTenantId}/features`)
        .set('Cookie', superAdminAuth.cookies.join('; '))
        .set('X-CSRF-Token', superAdminAuth.csrfToken)
        .send({
          feature: 'advanced_diagnostics',
          enabled: true
        });

      expect([200, 201, 404, 401]).toContain(response.status);
    });

    it.todo('GET /api/tenants/:id/features/:feature — lecture de fonctionnalité, endpoint à implémenter');
    it.skip('should check tenant feature access', async () => {
      if (!superAdminAuth || !testTenantId) return;

      const response = await superAdminAuth.agent
        .get(`/api/tenants/${testTenantId}/features/advanced_diagnostics`)
        .set('Cookie', superAdminAuth.cookies.join('; '))
        .set('X-CSRF-Token', superAdminAuth.csrfToken);

      expect([200, 404, 401]).toContain(response.status);
    });
  });
});
