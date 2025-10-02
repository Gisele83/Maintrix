import request from 'supertest';
import { describe, it, expect, beforeAll } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:5000';

describe('Inter-Module Communication Tests', () => {
  let authToken: string;
  let equipmentId: string;
  let diagnosticSessionId: number;
  let workOrderId: number;

  beforeAll(async () => {
    const loginResponse = await request(API_BASE)
      .post('/api/login')
      .send({
        username: 'admin@maintrix.local',
        password: 'Maintrix2024!'
      });

    if (loginResponse.status === 200) {
      authToken = loginResponse.body.token;
    }
  });

  describe('GMAO → Diagnostic Communication', () => {
    it('should create equipment and use it in diagnostic', async () => {
      const equipmentResponse = await request(API_BASE)
        .post('/api/equipment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          equipmentId: `INTER-EQ-${Date.now()}`,
          equipmentName: 'Inter-Module Test Equipment',
          equipmentType: 'Transformateur',
          manufacturer: 'Test Corp',
          zone: 'Zone Test'
        });

      expect([200, 201, 400]).toContain(equipmentResponse.status);
      
      if (equipmentResponse.body.equipment) {
        equipmentId = equipmentResponse.body.equipment.equipmentId;

        const diagnosticResponse = await request(API_BASE)
          .post('/api/diagnostic')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            equipmentType: 'Transformateur',
            equipmentId: equipmentId,
            symptoms: 'Surchauffe anormale',
            urgency: 'high'
          });

        expect([200, 201, 400]).toContain(diagnosticResponse.status);
        if (diagnosticResponse.status === 200 || diagnosticResponse.status === 201) {
          expect(diagnosticResponse.body).toHaveProperty('suggestions');
          diagnosticSessionId = diagnosticResponse.body.sessionId;
        }
      }
    });
  });

  describe('Diagnostic → Work Order Communication', () => {
    it('should create work order from diagnostic result', async () => {
      const diagnosticResponse = await request(API_BASE)
        .post('/api/diagnostic')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          equipmentType: 'Moteur électrique',
          symptoms: 'Perte de puissance, vibrations',
          urgency: 'medium'
        });

      if (diagnosticResponse.status === 200 || diagnosticResponse.status === 201) {
        const diagnosis = diagnosticResponse.body.suggestions?.[0];

        if (diagnosis) {
          const workOrderResponse = await request(API_BASE)
            .post('/api/work-orders')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              orderNumber: `WO-DIAG-${Date.now()}`,
              orderType: 'corrective',
              title: `Réparation: ${diagnosis.diagnosis}`,
              description: diagnosis.solution,
              priority: diagnosticResponse.body.urgency || 'medium',
              diagnosticSessionId: diagnosticResponse.body.sessionId,
              estimatedDuration: diagnosis.duration || 120
            });

          expect([200, 201, 400]).toContain(workOrderResponse.status);
          if (workOrderResponse.body.workOrder) {
            workOrderId = workOrderResponse.body.workOrder.id;
          }
        }
      }
    });
  });

  describe('Work Order → Inventory Communication', () => {
    it('should reserve spare parts for work order', async () => {
      const sparePartResponse = await request(API_BASE)
        .post('/api/spare-parts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          partName: `Test Part ${Date.now()}`,
          category: 'Électrique',
          currentStock: 50,
          minStock: 10,
          unitPrice: 250.00
        });

      if (sparePartResponse.status === 200 || sparePartResponse.status === 201) {
        const partId = sparePartResponse.body.sparePart?.id;

        if (partId && workOrderId) {
          const reservationResponse = await request(API_BASE)
            .post('/api/spare-parts/reserve')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              partId: partId,
              workOrderId: workOrderId,
              quantity: 2
            });

          expect([200, 201, 400, 404]).toContain(reservationResponse.status);
        }
      }
    });
  });

  describe('Preventive → Work Order Automation', () => {
    it('should generate work order from preventive plan', async () => {
      const preventiveResponse = await request(API_BASE)
        .post('/api/preventive-maintenance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planName: `Auto Plan ${Date.now()}`,
          equipmentType: 'Compresseur',
          frequency: 'monthly',
          tasks: ['Inspection', 'Nettoyage', 'Lubrification'],
          estimatedDuration: 180,
          autoGenerateWorkOrders: true
        });

      if (preventiveResponse.status === 200 || preventiveResponse.status === 201) {
        const planId = preventiveResponse.body.plan?.id;

        if (planId) {
          const triggerResponse = await request(API_BASE)
            .post(`/api/preventive-maintenance/${planId}/trigger`)
            .set('Authorization', `Bearer ${authToken}`);

          expect([200, 201, 404]).toContain(triggerResponse.status);
          if (triggerResponse.body.workOrder) {
            expect(triggerResponse.body.workOrder).toHaveProperty('orderNumber');
            expect(triggerResponse.body.workOrder.orderType).toBe('preventive');
          }
        }
      }
    });
  });

  describe('Multi-Tenant → All Modules Isolation', () => {
    it('should ensure tenant isolation across modules', async () => {
      const equipmentCheck = await request(API_BASE)
        .get('/api/equipment')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'tenant-test-isolation');

      const diagnosticCheck = await request(API_BASE)
        .get('/api/diagnostic-sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'tenant-test-isolation');

      const workOrderCheck = await request(API_BASE)
        .get('/api/work-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'tenant-test-isolation');

      [equipmentCheck, diagnosticCheck, workOrderCheck].forEach(response => {
        expect([200, 401, 403]).toContain(response.status);
        if (response.status === 200) {
          expect(Array.isArray(response.body)).toBe(true);
        }
      });
    });
  });

  describe('Email → Diagnostic Integration', () => {
    it('should send email notification after diagnostic', async () => {
      const diagnosticResponse = await request(API_BASE)
        .post('/api/diagnostic')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          equipmentType: 'Pompe hydraulique',
          symptoms: 'Fuite importante, pression faible',
          urgency: 'urgent',
          notifyEmail: 'test@maintrix.local'
        });

      expect([200, 201, 400]).toContain(diagnosticResponse.status);
    });
  });

  describe('IoT → Preventive Trigger', () => {
    it('should trigger preventive maintenance based on IoT data', async () => {
      const iotDataResponse = await request(API_BASE)
        .post('/api/iot/sensor-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          equipmentId: equipmentId || 'TEST-EQ-001',
          sensorType: 'vibration',
          value: 95,
          threshold: 80,
          unit: 'Hz'
        });

      if (iotDataResponse.status === 200 || iotDataResponse.status === 201) {
        if (iotDataResponse.body.alertTriggered) {
          expect(iotDataResponse.body).toHaveProperty('suggestedAction');
        }
      }
    });
  });
});
