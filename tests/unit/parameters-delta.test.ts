import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  ParametersDeltaSchema,
  buildParametersDelta,
  verifyParametersDelta,
  signDelta,
} from '../../server/parameters-delta';

const TEST_SECRET = 'test-secret-for-parameters-delta-unit-tests-only';

describe('ParametersDelta — schéma fermé (Brevet 3, revendication 15)', () => {
  beforeAll(() => {
    process.env.PARAMETERS_DELTA_SECRET = TEST_SECRET;
  });

  it('accepte un ParametersDelta valide (deltaWeights + signature + timestamp)', () => {
    const delta = buildParametersDelta([0.1, 0.2, 0.3], [0.15, 0.18, 0.35], TEST_SECRET);
    expect(ParametersDeltaSchema.safeParse(delta).success).toBe(true);
    expect(verifyParametersDelta(delta, TEST_SECRET)).toBe(true);
  });

  it('rejette toute donnée capteur brute ajoutée au payload (exclusion structurelle)', () => {
    const delta = buildParametersDelta(null, [0.1, 0.2], TEST_SECRET);
    const withRawSensorValue = { ...delta, rawSensorValue: 42 };
    expect(ParametersDeltaSchema.safeParse(withRawSensorValue).success).toBe(false);
  });

  it('rejette toute identité de personnel ajoutée au payload', () => {
    const delta = buildParametersDelta(null, [0.1, 0.2], TEST_SECRET);
    const withPersonnelId = { ...delta, technicianId: 'tech-123' };
    expect(ParametersDeltaSchema.safeParse(withPersonnelId).success).toBe(false);
  });

  it('rejette tout horodatage opérationnel ajouté au payload', () => {
    const delta = buildParametersDelta(null, [0.1, 0.2], TEST_SECRET);
    const withOperationalTimestamp = { ...delta, lastInterventionAt: new Date().toISOString() };
    expect(ParametersDeltaSchema.safeParse(withOperationalTimestamp).success).toBe(false);
  });

  it('détecte une altération de la signature (falsification du delta)', () => {
    const delta = buildParametersDelta([0.1], [0.2], TEST_SECRET);
    const tampered = { ...delta, deltaWeights: [0.99] };
    expect(verifyParametersDelta(tampered, TEST_SECRET)).toBe(false);
  });

  it('calcule le delta comme différence terme à terme, jamais le vecteur complet', () => {
    const previous = [1, 2, 3];
    const current = [1.5, 2, 2.7];
    const delta = buildParametersDelta(previous, current, TEST_SECRET);
    const expected = current.map((v, i) => parseFloat((v - previous[i]).toFixed(10)));
    const actual = (delta.deltaWeights ?? []).map(v => parseFloat(v.toFixed(10)));
    expect(actual).toEqual(expected);
  });

  it('signDelta est déterministe pour un même contenu canonique', () => {
    const base = { deltaWeights: [1, 2], deltaNodes: null, deltaEdges: null, timestamp: '2026-01-01T00:00:00.000Z' };
    expect(signDelta(base, TEST_SECRET)).toBe(signDelta(base, TEST_SECRET));
  });
});
