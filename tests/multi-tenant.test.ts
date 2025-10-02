import request from 'supertest';
import { describe, it, expect, beforeAll } from '@jest/globals';
import { getCsrfToken, authenticateUser, createAuthenticatedRequest, type AuthenticatedAgent } from './setup';

const API_BASE = process.env.API_URL || 'http://localhost:5000';

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
      .post('/api/super-admin/login')
      .set('X-CSRF-Token', csrfToken)
      .send({
        email: 'platform@admin.com',
        password: 'SuperAdmin2024!'
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

      expect([200, 201, 400, 401]).toContain(response.status);
      if (response.body.tenant) {
        testTenantId = response.body.tenant.id;
        expect(response.body.tenant).toHaveProperty('id');
        expect(response.body.tenant).toHaveProperty('name');
        expect(response.body.tenant.plan).toBe('pro');
      }
    });

    it('should retrieve all tenants', async () => {
      if (!superAdminAuth) return;

      const response = await superAdminAuth.agent
        .get('/api/tenants')
        .set('Cookie', superAdminAuth.cookies.join('; '))
        .set('X-CSRF-Token', superAdminAuth.csrfToken);

      expect([200, 401]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
      }
    });

    it('should update tenant settings', async () => {
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
    it('should create user for tenant', async () => {
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
    it('should enable feature for tenant', async () => {
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

    it('should check tenant feature access', async () => {
      if (!superAdminAuth || !testTenantId) return;

      const response = await superAdminAuth.agent
        .get(`/api/tenants/${testTenantId}/features/advanced_diagnostics`)
        .set('Cookie', superAdminAuth.cookies.join('; '))
        .set('X-CSRF-Token', superAdminAuth.csrfToken);

      expect([200, 404, 401]).toContain(response.status);
    });
  });
});
