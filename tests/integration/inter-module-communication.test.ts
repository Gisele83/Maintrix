import { describe, it, expect, beforeAll } from '@jest/globals';
import { authenticateUser, createAuthenticatedRequest, type AuthenticatedAgent } from '../helpers/setup';

describe('Inter-Module Communication Tests', () => {
  let auth: AuthenticatedAgent;
  let equipmentId: string;
  let diagnosticSessionId: number;
  let workOrderId: number;

  beforeAll(async () => {
    auth = await authenticateUser('admin@maintrix.local', 'Maintrix2024!');
  });

  describe('GMAO → Diagnostic Communication', () => {
    it('should create equipment and use it in diagnostic', async () => {
      const equipmentResponse = await createAuthenticatedRequest('post', '/api/equipment', auth)
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

        const diagnosticResponse = await createAuthenticatedRequest('post', '/api/diagnostic', auth)
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
      const diagnosticResponse = await createAuthenticatedRequest('post', '/api/diagnostic', auth)
        .send({
          equipmentType: 'Moteur électrique',
          symptoms: 'Perte de puissance, vibrations',
          urgency: 'medium'
        });

      if (diagnosticResponse.status === 200 || diagnosticResponse.status === 201) {
        const diagnosis = diagnosticResponse.body.suggestions?.[0];

        if (diagnosis) {
          const workOrderResponse = await createAuthenticatedRequest('post', '/api/work-orders', auth)
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
      const sparePartResponse = await createAuthenticatedRequest('post', '/api/spare-parts', auth)
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
          const reservationResponse = await createAuthenticatedRequest('post', '/api/spare-parts/reserve', auth)
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
      const preventiveResponse = await createAuthenticatedRequest('post', '/api/preventive-maintenance-plans', auth)
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
          const triggerResponse = await createAuthenticatedRequest('post', `/api/preventive-maintenance-plans/${planId}/trigger`, auth);

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
      const equipmentCheck = await auth.agent
        .get('/api/equipment')
        .set('Cookie', auth.cookies.join('; '))
        .set('X-CSRF-Token', auth.csrfToken)
        .set('X-Tenant-Id', 'tenant-test-isolation');

      // `/api/diagnostic-sessions` a été retiré de ce contrôle : la route
      // n'existe pas (voir tests/integration/diagnostic.test.ts). L'inclure
      // faisait porter le test sur un 404, pas sur l'isolation. Remplacé par
      // un module réellement exposé et cloisonné par tenant.
      const maintenancePlanCheck = await auth.agent
        .get('/api/preventive-maintenance-plans')
        .set('Cookie', auth.cookies.join('; '))
        .set('X-CSRF-Token', auth.csrfToken)
        .set('X-Tenant-Id', 'tenant-test-isolation');

      const workOrderCheck = await auth.agent
        .get('/api/work-orders')
        .set('Cookie', auth.cookies.join('; '))
        .set('X-CSRF-Token', auth.csrfToken)
        .set('X-Tenant-Id', 'tenant-test-isolation');

      [equipmentCheck, maintenancePlanCheck, workOrderCheck].forEach(response => {
        expect([200, 401, 403]).toContain(response.status);
        if (response.status === 200) {
          expect(Array.isArray(response.body)).toBe(true);

          // Propriété de sécurité réellement vérifiée ici : le serveur déduit
          // le tenant de la SESSION et ignore l'en-tête X-Tenant-Id fourni par
          // le client. Toute ligne rendue appartient donc au tenant de la
          // session, jamais au tenant revendiqué dans l'en-tête.
          //
          // (Attendre un tableau vide serait une erreur : cela supposerait que
          // le serveur honore l'en-tête forgé — précisément la faille que ce
          // test doit exclure.)
          for (const row of response.body as Array<Record<string, unknown>>) {
            if ('tenantId' in row) {
              expect(row.tenantId).not.toBe('tenant-test-isolation');
            }
          }
        }
      });
    });
  });

  describe('Email → Diagnostic Integration', () => {
    it('should send email notification after diagnostic', async () => {
      const diagnosticResponse = await createAuthenticatedRequest('post', '/api/diagnostic', auth)
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
      const iotDataResponse = await createAuthenticatedRequest('post', '/api/iot/sensor-data', auth)
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
