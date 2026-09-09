import { describe, it, expect, beforeAll } from '@jest/globals';
import { authenticateUser, createAuthenticatedRequest, type AuthenticatedAgent } from '../helpers/setup';

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
        // Contrat réel de l'endpoint, vérifié sur réponse live (F05).
        // Les assertions d'origine attendaient `diagnosis`,
        // `neuralNetworkAnalysis` et `anomalyDetection` À LA RACINE : ces trois
        // champs n'ont jamais existé, ces tests n'ont donc jamais pu passer.
        // L'API expose le diagnostic dans `suggestions[]` — la même forme que
        // /api/diagnostic, dont le test passe — et les signaux ML dans
        // `advancedMetrics`. On assertit désormais la substance équivalente,
        // aux bons emplacements.
        expect(response.body).toHaveProperty('advancedML', true);
        expect(Array.isArray(response.body.suggestions)).toBe(true);
        expect(response.body.suggestions.length).toBeGreaterThan(0);

        const suggestion = response.body.suggestions[0];
        expect(suggestion).toHaveProperty('diagnosis');
        expect(typeof suggestion.diagnosis).toBe('string');
        expect(suggestion).toHaveProperty('solution');

        // Réseau de neurones + détection d'anomalie : présents et numériques.
        expect(response.body.advancedMetrics).toBeDefined();
        expect(typeof response.body.advancedMetrics.neural_network_confidence).toBe('number');
        expect(typeof response.body.advancedMetrics.anomaly_score).toBe('number');
        expect(suggestion).toHaveProperty('anomalyDetected');
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
        // Même correction que pour l'endpoint « advanced » : `diagnosis` et
        // `ensembleVoting.consensus` à la racine n'ont jamais existé. Le
        // consensus est exposé comme `ensembleMetrics.model_agreement`
        // (nombre de modèles d'accord) sur `individual_models` au total.
        expect(response.body).toHaveProperty('ensembleML', true);
        expect(Array.isArray(response.body.suggestions)).toBe(true);
        expect(response.body.suggestions.length).toBeGreaterThan(0);

        const suggestion = response.body.suggestions[0];
        expect(suggestion).toHaveProperty('diagnosis');
        expect(typeof suggestion.diagnosis).toBe('string');

        // Vote d'ensemble : l'accord ne peut pas dépasser le nombre de modèles.
        const metrics = response.body.ensembleMetrics;
        expect(metrics).toBeDefined();
        expect(typeof metrics.individual_models).toBe('number');
        expect(typeof metrics.model_agreement).toBe('number');
        expect(metrics.model_agreement).toBeLessThanOrEqual(metrics.individual_models);
        expect(suggestion).toHaveProperty('individualPredictions');
      }
    });
  });

  describe('Diagnostic Session Management', () => {
    // ⚠️ CONSTAT F05 — `/api/diagnostic-sessions` N'EXISTE PAS.
    //
    // La table `diagnostic_sessions` est bien définie dans shared/schema.ts et
    // lue en interne par server/company-data-access.ts, mais aucune route REST
    // ne l'expose. Ces deux tests semblaient passer uniquement parce qu'une
    // route /api inconnue renvoyait 200 + le HTML de la SPA : leur `expect`
    // sur le statut était satisfait par ce faux 200.
    //
    // Ils ne sont donc PAS supprimés — ce sont des spécifications non
    // réalisées, pas des régressions. Ils restent visibles comme « à faire »
    // dans le récapitulatif (`ignorés`) jusqu'à ce que l'API existe.
    it.todo('POST /api/diagnostic-sessions — endpoint à implémenter (table présente, route absente)');
    it.todo('GET /api/diagnostic-sessions — endpoint à implémenter (table présente, route absente)');

    // En attendant, on verrouille le comportement réel : la route absente doit
    // répondre 404 en JSON, et surtout jamais 200 + HTML.
    it('une route de session inexistante répond 404 JSON, jamais 200 + HTML', async () => {
      const response = await createAuthenticatedRequest('get', '/api/diagnostic-sessions', auth);
      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toMatch(/application\/json/);
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
