/**
 * Le RUL stochastique et l'ISC disent-ils ce qu'ils mesurent ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * RUL — l'estimation de la variance était centrée sur `muRaw × deltaT` au lieu
 * de `muRaw`. Or `muRaw` est DÉJÀ la dérive par pas de mesure : la multiplier
 * par le pas donne une grandeur qui ne correspond à rien, et les écarts sont
 * mesurés autour d'un centre arbitrairement éloigné.
 *
 * Avec `deltaT = 1` l'erreur restait invisible. Tous les appels passent 24.
 * Mesuré sur une dégradation parfaitement régulière : σ passait de 0,007 à
 * 2,34, et le RUL sortait à 2406 h ± 5526 h au lieu de ± 16 h. L'incertitude
 * dépassait le double de l'estimation — la borne basse tombait donc à zéro, et
 * une alarme pouvait se déclencher sur un équipement en parfait état. Les
 * intervalles de confiance, qui sont l'argument de ce module, ne voulaient
 * rien dire.
 *
 * ISC — `?? 2` et `|| 3` remplaçaient une donnée absente par une valeur
 * médiane. Deux sites n'ayant RIEN renseigné obtenaient donc la même note que
 * deux sites réellement identiques. L'ISC gouvernant le transfert de
 * connaissance avec un seuil Φ ≥ 0,3, une similarité gonflée par l'absence de
 * données faisait franchir ce seuil à des patterns issus de contextes sans
 * rapport.
 *
 * Constaté le 2026-10-13.
 */
import { describe, it, expect } from '@jest/globals';
import {
  estimateWienerParams, computeStochasticRUL, normalCDF,
} from '../../server/stochastic-rul';
import { ISC_WEIGHTS } from '../../server/isc-aggregation';

describe('Estimation de Wiener', () => {
  /** Dégradation parfaitement régulière : 0,5 point par relevé. */
  const reguliere = Array.from({ length: 30 }, (_, i) => i * 0.5);

  it('la variance est centrée sur la dérive par pas, pas sur le pas × la dérive', () => {
    // Sur une trajectoire strictement linéaire, la variance des incréments est
    // nulle : σ doit être négligeable. Centré sur `muRaw × 24`, il explosait.
    const p = estimateWienerParams(reguliere, 24);
    expect(p.sigma).toBeLessThan(0.01);
  });

  it('le pas de mesure ne change pas la dérive horaire', () => {
    // Même trajectoire, même durée réelle : la dérive par heure doit être
    // divisée par 24 quand on déclare des relevés de 24 h.
    const parHeure = estimateWienerParams(reguliere, 1);
    const parJour = estimateWienerParams(reguliere, 24);
    expect(parJour.mu).toBeCloseTo(parHeure.mu / 24, 10);
  });

  it('une trajectoire bruitée garde une dispersion mesurable', () => {
    const bruitee = Array.from({ length: 30 }, (_, i) => i * 0.5 + (i % 2 ? 1.5 : -1.5));
    const p = estimateWienerParams(bruitee, 24);
    expect(p.sigma).toBeGreaterThan(0);
  });

  it('ne fabrique aucun paramètre sous trois observations', () => {
    // Elle rendait `mu: 0.001, sigma: 0.1` — une dérive inventée qui, avec une
    // marge de 50 points, produisait un RUL de près de six ans.
    const p = estimateWienerParams([10, 20], 24);
    expect(p.mu).toBe(0);
    expect(p.sigma).toBe(0);
    expect(p.nObs).toBe(2);
  });
});

describe('RUL stochastique', () => {
  it('produit un intervalle de confiance exploitable sur une dégradation régulière', () => {
    // IMCA décroissant de 1 point par relevé, de 95 à 66.
    const historique = Array.from({ length: 30 }, (_, i) => 95 - i);
    const r = computeStochasticRUL(historique, 66, 24, 30);

    expect(r.recommended).not.toBeNull();
    const d = r.recommended!;
    // L'écart-type doit rester une fraction de l'estimation, et non son double.
    expect(d.stdDev).toBeLessThan(d.mean);
    expect(d.confidenceIntervals.p05).toBeGreaterThan(0);
    expect(d.confidenceIntervals.p95).toBeGreaterThan(d.confidenceIntervals.p05);
  });

  it('ne rend AUCUNE distribution sous trois relevés', () => {
    // Elle fabriquait sept quantiles à partir de `currentIMCA × 10`, `× 9`,
    // `× 18`. Des multiplicateurs sans fondement, lus comme des bornes.
    const r = computeStochasticRUL([80, 78], 78, 24, 30);
    expect(r.recommended).toBeNull();
    expect(r.model).toBe('fallback');
    expect(r.warnings.join(' ')).toMatch(/insuffisant/i);
  });

  it('refuse d\'estimer un RUL sur un actif déjà sous le seuil', () => {
    const r = computeStochasticRUL([50, 45, 40, 35, 25], 25, 24, 30);
    expect(r.remainingMargin).toBe(0);
    expect(r.warnings.join(' ')).toMatch(/critique/i);
  });
});

describe('Loi normale', () => {
  it('approche Φ(x) avec la précision annoncée', () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 6);
    expect(normalCDF(1)).toBeCloseTo(0.8413447, 6);
    expect(normalCDF(-1.96)).toBeCloseTo(0.0249979, 6);
  });

  it('est symétrique', () => {
    for (const x of [0.5, 1, 2, 3]) {
      expect(normalCDF(x) + normalCDF(-x)).toBeCloseTo(1, 6);
    }
  });
});

describe('ISC — similarité contextuelle', () => {
  it('les quatre poids somment à 1', () => {
    const somme = ISC_WEIGHTS.D1 + ISC_WEIGHTS.D2 + ISC_WEIGHTS.D3 + ISC_WEIGHTS.D4;
    expect(Math.round(somme * 100) / 100).toBe(1);
  });

  it("l'absence de donnée ne vaut plus une similarité parfaite", () => {
    // `computeD3` n'est pas exportée : on vérifie la règle dans la source,
    // faute de pouvoir l'appeler. Le motif fautif ne doit plus exister.
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const source = readFileSync(
      join(__dirname, '..', '..', 'server', 'isc-aggregation.ts'), 'utf8');

    const fonction = source.match(/function computeD3[\s\S]*?\n\}/)![0];
    // Les substitutions médianes qui produisaient D3 = 1 sur deux profils vides.
    expect(fonction).not.toMatch(/urgencyMap\[urgency1\?\.toLowerCase\(\)\] \?\? 2/);
    expect(fonction).not.toMatch(/\(severity1 \|\| 3\)/);
    // La dimension doit pouvoir être déclarée non mesurable.
    expect(fonction).toMatch(/Mesurable/);
  });
});
