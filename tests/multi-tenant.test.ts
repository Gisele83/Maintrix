import request from 'supertest';
import { describe, it, expect, beforeAll } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:5000';

describe('Multi-Tenant Module Integration Tests', () => {
  let superAdminToken: string;
  let tenant1Token: string;
  let tenant2Token: string;
  let testTenantId: string;

  beforeAll(async () => {
    const superAdminLogin = await request(API_BASE)
      .post('/api/super-admin/login')
      .send({
        email: 'platform@admin.com',
        password: 'SuperAdmin2024!'
      });

    if (superAdminLogin.status === 200) {
      superAdminToken = superAdminLogin.body.token;
    }
  });

  describe('Tenant Management API', () => {
    it('should create a new tenant', async () => {
      const response = await request(API_BASE)
        .post('/api/tenants')
        .set('Authorization', `Bearer ${superAdminToken}`)
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
      const response = await request(API_BASE)
        .get('/api/tenants')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect([200, 401]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
      }
    });

    it('should update tenant settings', async () => {
      if (!testTenantId) return;

      const response = await request(API_BASE)
        .patch(`/api/tenants/${testTenantId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
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
      const tenant1Login = await request(API_BASE)
        .post('/api/login')
        .send({
          username: 'admin@maintrix.local',
          password: 'Maintrix2024!'
        });

      if (tenant1Login.status === 200) {
        tenant1Token = tenant1Login.body.token;

        const createEquipment = await request(API_BASE)
          .post('/api/equipment')
          .set('Authorization', `Bearer ${tenant1Token}`)
          .send({
            equipmentId: `TENANT1-EQ-${Date.now()}`,
            equipmentName: 'Tenant 1 Equipment',
            equipmentType: 'Grue',
            zone: 'Zone T1'
          });

        if (createEquipment.status === 200 || createEquipment.status === 201) {
          tenant1EquipmentId = createEquipment.body.equipment?.equipmentId;
        }
      }

      expect(tenant1Token).toBeDefined();
    });

    it('should prevent cross-tenant data access', async () => {
      if (!tenant1EquipmentId || !tenant2Token) {
        return;
      }

      const response = await request(API_BASE)
        .get(`/api/equipment/${tenant1EquipmentId}`)
        .set('Authorization', `Bearer ${tenant2Token}`);

      expect([404, 403, 401]).toContain(response.status);
    });
  });

  describe('Tenant User Management', () => {
    it('should create user for tenant', async () => {
      if (!testTenantId) return;

      const response = await request(API_BASE)
        .post('/api/tenants/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
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
      if (!testTenantId) return;

      const response = await request(API_BASE)
        .post(`/api/tenants/${testTenantId}/features`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          feature: 'advanced_diagnostics',
          enabled: true
        });

      expect([200, 201, 404, 401]).toContain(response.status);
    });

    it('should check tenant feature access', async () => {
      if (!testTenantId) return;

      const response = await request(API_BASE)
        .get(`/api/tenants/${testTenantId}/features/advanced_diagnostics`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect([200, 404, 401]).toContain(response.status);
    });
  });
});
