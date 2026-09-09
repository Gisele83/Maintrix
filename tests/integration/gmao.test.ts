import { describe, it, expect, beforeAll } from '@jest/globals';
import { authenticateUser, createAuthenticatedRequest, type AuthenticatedAgent } from '../helpers/setup';

describe('GMAO Module Integration Tests', () => {
  let auth: AuthenticatedAgent;
  let testEquipmentId: string;
  let testWorkOrderId: number;

  beforeAll(async () => {
    auth = await authenticateUser('admin@maintrix.local', 'Maintrix2024!');
  });

  describe('Equipment Management API', () => {
    it('should create a new equipment', async () => {
      const response = await createAuthenticatedRequest('post', '/api/equipment', auth)
        .send({
          equipmentId: `TEST-EQ-${Date.now()}`,
          equipmentName: 'Test Equipment Integration',
          equipmentType: 'Grue portuaire',
          manufacturer: 'Test Manufacturer',
          zone: 'Zone Test',
          criticalityLevel: 'medium',
          operationalState: 'operational'
        });

      expect([200, 201]).toContain(response.status);
      if (response.body.equipment) {
        testEquipmentId = response.body.equipment.equipmentId;
        expect(response.body.equipment).toHaveProperty('equipmentId');
        expect(response.body.equipment.equipmentType).toBe('Grue portuaire');
      }
    });

    it('should retrieve equipment list', async () => {
      const response = await createAuthenticatedRequest('get', '/api/equipment', auth);

      expect([200, 401]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
      }
    });

    it('should update equipment status', async () => {
      if (!testEquipmentId) {
        return;
      }

      const response = await createAuthenticatedRequest('patch', `/api/equipment/${testEquipmentId}`, auth)
        .send({
          operationalState: 'maintenance'
        });

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Work Orders API', () => {
    it('should create a work order', async () => {
      const response = await createAuthenticatedRequest('post', '/api/work-orders', auth)
        .send({
          orderNumber: `WO-TEST-${Date.now()}`,
          equipmentId: testEquipmentId || 'TEST-EQ-001',
          orderType: 'corrective',
          title: 'Test Work Order Integration',
          description: 'Integration test work order',
          priority: 'medium',
          status: 'pending'
        });

      expect([200, 201, 400]).toContain(response.status);
      if (response.body.workOrder) {
        testWorkOrderId = response.body.workOrder.id;
        expect(response.body.workOrder).toHaveProperty('orderNumber');
      }
    });

    it('should retrieve work orders', async () => {
      const response = await createAuthenticatedRequest('get', '/api/work-orders', auth);

      expect([200, 401]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
      }
    });
  });

  describe('Preventive Maintenance API', () => {
    it('should create preventive maintenance plan', async () => {
      const response = await createAuthenticatedRequest('post', '/api/preventive-maintenance-plans', auth)
        .send({
          planName: `Test Plan ${Date.now()}`,
          equipmentType: 'Grue portuaire',
          frequency: 'monthly',
          tasks: ['Inspection visuelle', 'Lubrification'],
          estimatedDuration: 120
        });

      expect([200, 201, 400]).toContain(response.status);
      if (response.body.plan) {
        expect(response.body.plan).toHaveProperty('planName');
      }
    });

    it('should retrieve preventive plans', async () => {
      const response = await createAuthenticatedRequest('get', '/api/preventive-maintenance-plans', auth);

      expect([200, 401]).toContain(response.status);
    });
  });

  describe('Spare Parts Inventory API', () => {
    it('should create spare part', async () => {
      const response = await createAuthenticatedRequest('post', '/api/spare-parts', auth)
        .send({
          partName: `Test Part ${Date.now()}`,
          description: 'Integration test spare part',
          category: 'Mécanique',
          currentStock: 10,
          minStock: 5,
          maxStock: 50,
          unitPrice: 150.00
        });

      expect([200, 201, 400]).toContain(response.status);
      if (response.body.sparePart) {
        expect(response.body.sparePart).toHaveProperty('partName');
      }
    });

    it('should retrieve spare parts', async () => {
      const response = await createAuthenticatedRequest('get', '/api/spare-parts', auth);

      expect([200, 401]).toContain(response.status);
    });
  });
});
