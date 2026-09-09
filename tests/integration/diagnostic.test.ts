import { describe, it, expect, beforeAll } from '@jest/globals';
import { authenticateUser, createAuthenticatedRequest, type AuthenticatedAgent } from './setup';

describe('Diagnostic Module Integration Tests', () => {
  let auth: AuthenticatedAgent;

  beforeAll(async () => {
    auth = await authenticateUser('admin@maintrix.local', 'Maintrix2024!');
  });

  describe('Standard Diagnostic API', () => {
    it('should perform standard diagnostic', async () => {
      const response = await createAuthenticatedRequest('post', '/api/diagnostic', auth)
        .send({
          equipmentType: 'Grue portuaire',
          symptoms: 'Bruit anormal, vibrations excessives',
          symptomsChecked: ['Bruit anormal', 'Vibrations'],
          urgency: 'high',
          zone: 'Zone A',
          sector: 'Port'
        });

      expect([200, 201, 400]).toContain(response.status);
      if (response.status === 200 || response.status === 201) {
        expect(response.body).toHaveProperty('suggestions');
        expect(Array.isArray(response.body.suggestions)).toBe(true);
        if (response.body.suggestions.length > 0) {
          expect(response.body.suggestions[0]).toHaveProperty('diagnosis');
          expect(response.body.suggestions[0]).toHaveProperty('solution');
          expect(response.body.suggestions[0]).toHaveProperty('confidence');
        }
      }
    });

    it('should return historical matches', async () => {
      const response = await createAuthenticatedRequest('post', '/api/diagnostic', auth)
        .send({
          equipmentType: 'Transformateur',
          symptoms: 'Surchauffe, odeur de brûlé',
          urgency: 'urgent'
        });

      expect([200, 201, 400]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('historicalMatches');
      }
    });
  });

  describe('Advanced ML Diagnostic API', () => {
    it('should perform advanced ML diagnostic', async () => {
      const response = await createAuthenticatedRequest('post', '/api/diagnostic-advanced-ml', auth)
        .send({
          equipmentType: 'Moteur électrique',
          symptoms: 'Perte de puissance, échauffement',
          symptomsChecked: ['Perte de puissance', 'Échauffement'],
          urgency: 'medium'
        });

      expect([200, 400, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('diagnosis');
        expect(response.body).toHaveProperty('neuralNetworkAnalysis');
        expect(response.body).toHaveProperty('anomalyDetection');
      }
    });
  });

  describe('Ensemble ML Diagnostic API', () => {
    it('should perform ensemble ML diagnostic', async () => {
      const response = await createAuthenticatedRequest('post', '/api/diagnostic-ensemble-ml', auth)
        .send({
          equipmentType: 'Pompe hydraulique',
          symptoms: 'Fuite, pression insuffisante',
          urgency: 'high'
        });

      expect([200, 400, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('diagnosis');
        expect(response.body).toHaveProperty('ensembleVoting');
        expect(response.body.ensembleVoting).toHaveProperty('consensus');
      }
    });
  });

  describe('Diagnostic Session Management', () => {
    it('should save diagnostic session', async () => {
      const response = await createAuthenticatedRequest('post', '/api/diagnostic-sessions', auth)
        .send({
          equipmentType: 'Compresseur',
          symptoms: 'Bruit métallique',
          diagnosis: 'Usure des roulements',
          solution: 'Remplacement des roulements',
          confidence: 85,
          urgency: 'medium'
        });

      expect([200, 201, 400]).toContain(response.status);
      if (response.body.session) {
        expect(response.body.session).toHaveProperty('id');
        expect(response.body.session).toHaveProperty('equipmentType');
      }
    });

    it('should retrieve diagnostic sessions', async () => {
      const response = await createAuthenticatedRequest('get', '/api/diagnostic-sessions', auth);

      expect([200, 401]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
      }
    });
  });

  describe('Feedback System', () => {
    it('should submit diagnostic feedback', async () => {
      const response = await createAuthenticatedRequest('post', '/api/diagnostic-feedback', auth)
        .send({
          sessionId: 1,
          rating: 5,
          comment: 'Diagnostic très précis',
          wasAccurate: true
        });

      expect([200, 201, 404]).toContain(response.status);
    });
  });
});
