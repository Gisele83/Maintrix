/**
 * La cotation AMDEC et l'OEE respectent-ils leur propre science ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Deux fautes de méthode, invisibles à l'écran, qui orientent des décisions.
 *
 * AMDEC — la classe de criticité ne dépendait que du RPN. Or une GRAVITÉ de 9
 * ou 10 (blessure, atteinte à la vie, non-conformité réglementaire) impose une
 * action quel que soit le RPN : c'est la règle cardinale de la méthode. Sans
 * elle, un mode coté S=10, O=1, D=1 donne RPN = 10 et se classait « low ». La
 * rupture d'un organe de sécurité, rare et détectable, était rangée tout en bas
 * de la liste — les défaillances les plus dangereuses étaient les moins bien
 * classées.
 *
 * OEE — le taux de qualité valait 1 quand AUCUNE pièce n'avait été produite.
 * Comme il multiplie les deux autres facteurs, une journée sans production
 * sortait avec un OEE flatteur. Et `speedLoss` était collecté auprès de
 * l'exploitant sans jamais entrer dans le calcul : il ne servait qu'à choisir
 * entre deux définitions différentes de la performance, si bien que deux
 * saisies voisines n'étaient pas mesurées de la même façon.
 *
 * Constaté le 2026-10-13.
 */
import { describe, it, expect } from '@jest/globals';
import { coterModeDefaillance } from '../../shared/amdec';
import { calculerOEE } from '../../shared/oee';

const computeRpn = coterModeDefaillance;
const computeOEE = (planned: number, downtime: number, speedLoss: number,
  actualProd: number, plannedProd: number, defects: number) =>
  calculerOEE({ planned, downtime, speedLoss, actualProd, plannedProd, defects });

describe('AMDEC — la gravité prime sur le RPN', () => {
  it('calcule le RPN comme le produit des trois cotations', () => {
    expect(computeRpn(5, 4, 3).rpn).toBe(60);
  });

  it('classe « critical » une gravité 10, même avec un RPN de 10', () => {
    // Organe de sécurité : conséquence maximale, défaillance rare, détection
    // certaine. Le RPN vaut 10 — il était classé « low ».
    const r = computeRpn(10, 1, 1);
    expect(r.rpn).toBe(10);
    expect(r.criticalityClass).toBe('critical');
    expect(r.motifsCriticite.join(' ')).toMatch(/indépendamment du RPN/);
  });

  it('classe « critical » dès la gravité 9', () => {
    expect(computeRpn(9, 1, 1).criticalityClass).toBe('critical');
    // 8 ne déclenche pas la règle cardinale.
    expect(computeRpn(8, 1, 1).criticalityClass).not.toBe('critical');
  });

  it('relève une gravité forte conjuguée à une occurrence réelle', () => {
    // S=8, O=5, D=1 → RPN 40, donc « low » par le seul produit. Mais une
    // détection parfaite ne réduit en rien la gravité de ce qui arrive.
    const r = computeRpn(8, 5, 1);
    expect(r.rpn).toBe(40);
    expect(r.criticalityClass).toBe('medium');
  });

  it('conserve les seuils RPN pour les gravités modérées', () => {
    expect(computeRpn(5, 5, 9).criticalityClass).toBe('critical'); // 225
    expect(computeRpn(5, 5, 5).criticalityClass).toBe('high');     // 125
    expect(computeRpn(4, 4, 4).criticalityClass).toBe('medium');   // 64
    expect(computeRpn(2, 2, 2).criticalityClass).toBe('low');      // 8
  });
});

describe('OEE — aucun facteur ne vaut 1 par défaut', () => {
  it('vaut bien le produit des trois facteurs', () => {
    // 480 min planifiées, 48 d'arrêt → disponibilité 90 %.
    // Attendu pendant la marche : 1000 × 0,9 = 900 ; produit 810 → 90 %.
    // 810 produites, 81 rebuts → qualité 90 %.
    const r = computeOEE(480, 48, 0, 810, 1000, 81);
    expect(r.availability).toBeCloseTo(0.9, 4);
    expect(r.performance).toBeCloseTo(0.9, 4);
    expect(r.quality).toBeCloseTo(0.9, 4);
    expect(r.oee).toBeCloseTo(0.729, 3);
  });

  it("sans production, la qualité n'existe pas — elle ne vaut pas 100 %", () => {
    const r = computeOEE(480, 0, 0, 0, 1000, 0);
    expect(r.quality).toBeUndefined();
    expect(r.oee).toBeUndefined();
    expect(r.reserves.join(' ')).toMatch(/aucune pièce produite/);
  });

  it("sans temps planifié, la disponibilité n'existe pas — elle ne vaut pas 0", () => {
    const r = computeOEE(0, 0, 0, 100, 100, 0);
    expect(r.availability).toBeUndefined();
    expect(r.oee).toBeUndefined();
  });

  it('signale une performance supérieure à 100 % au lieu de l\'écraser', () => {
    // Produit 1200 là où 1000 étaient attendues : la cadence de référence est
    // sous-estimée. Le plafonnement à 1 supprimait ce signal.
    const r = computeOEE(480, 0, 0, 1200, 1000, 0);
    expect(r.performance).toBeGreaterThan(1);
    expect(r.reserves.join(' ')).toMatch(/cadence de référence/);
  });

  it('avoue que la perte de cadence saisie n\'entre pas dans le calcul', () => {
    const avec = computeOEE(480, 48, 60, 810, 1000, 81);
    const sans = computeOEE(480, 48, 0, 810, 1000, 81);
    // Même résultat : la donnée est inerte. On le dit plutôt que de le cacher.
    expect(avec.oee).toBe(sans.oee);
    expect(avec.reserves.join(' ')).toMatch(/n'entre pas dans ce calcul/);
  });

  it('le taux de qualité ne descend jamais sous zéro', () => {
    // Plus de rebuts que de pièces produites : saisie incohérente.
    const r = computeOEE(480, 0, 0, 100, 100, 150);
    expect(r.quality).toBe(0);
  });
});
