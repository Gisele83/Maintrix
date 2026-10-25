/**
 * La supervision juge-t-elle l'état d'une machine, ou l'unité de ses capteurs ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * `equipment-health-routes.ts` comparait tous les capteurs de toutes les
 * installations à quatre constantes : température 75, vibration 4,5, pression
 * 4,0, courant 10. Le score de santé retranchait jusqu'à 45 points pour la
 * pression et 30 pour le courant.
 *
 * Conséquence mesurable : une chaudière vapeur à 9 bar, une presse à 185 bar,
 * un moteur tirant 38 A — tous en régime parfaitement normal — perdaient
 * assez de points pour être déclarés « critiques » en permanence. Le score ne
 * mesurait pas l'état de la machine, il mesurait l'échelle de ses unités.
 *
 * Ces tests verrouillent la propriété qui manquait : un capteur stable est
 * normal QUEL QUE SOIT son niveau, et seul un CHANGEMENT par rapport à son
 * propre passé est signalé.
 */

import { describe, expect, it } from '@jest/globals';
import {
  evaluerCapteur,
  scoreDeSante,
  etatEquipement,
  POINTS_MINIMUM,
  type ReleveCapteur,
} from '@shared/supervision';

const T0 = new Date('2026-01-01T00:00:00Z').getTime();
const HEURE = 3_600_000;

/** Série stable autour d'une valeur, avec une oscillation déterministe. */
function serieStable(valeur: number, n: number, amplitude = 0.01): ReleveCapteur[] {
  return Array.from({ length: n }, (_, i) => ({
    valeur: valeur * (1 + amplitude * Math.sin(i)),
    horodatage: new Date(T0 + i * HEURE),
  }));
}

describe('Un régime normal élevé n’est pas une anomalie', () => {
  // Le cœur du défaut corrigé : ces quatre machines étaient « critiques »
  // uniquement parce que leurs grandeurs dépassaient des constantes globales.
  const casReels: Array<[string, string, number]> = [
    ['chaudière vapeur', 'pressure', 9.2],
    ['presse hydraulique', 'pressure', 185],
    ['moteur 75 kW', 'current', 38],
    ['transformateur', 'temperature', 72],
  ];

  it.each(casReels)('%s : %s stable à %p est normal', (_machine, type, valeur) => {
    const evaluation = evaluerCapteur(type, serieStable(valeur, 60));
    expect(evaluation.etat).toBe('normal');
  });

  it('le score de santé reste au maximum sur un parc stable, quelles que soient les unités', () => {
    const evaluations = casReels.map(([, type, valeur]) =>
      evaluerCapteur(type, serieStable(valeur, 60)),
    );
    expect(scoreDeSante(evaluations)).toBe(100);
  });
});

describe('Une dérive réelle est détectée, quelle que soit l’échelle', () => {
  /** Série stable puis dérive progressive sur le dernier tiers. */
  function serieAvecDerive(valeur: number, n: number, ampleurFinale: number): ReleveCapteur[] {
    return Array.from({ length: n }, (_, i) => {
      const avancement = Math.max(0, (i - n * 0.66) / (n * 0.34));
      const derive = 1 + ampleurFinale * avancement;
      return {
        valeur: valeur * derive * (1 + 0.01 * Math.sin(i)),
        horodatage: new Date(T0 + i * HEURE),
      };
    });
  }

  it('une hausse de 45 % sur un palier de vibration est une anomalie', () => {
    const evaluation = evaluerCapteur('vibration', serieAvecDerive(2.4, 60, 0.45));
    expect(evaluation.etat).toBe('anomalie');
    expect(evaluation.ecartReduit).toBeGreaterThan(3);
  });

  it('la même dérive relative est détectée sur une pression à 185 bar', () => {
    // Un seuil absolu à 4,0 bar n'aurait RIEN appris ici : la machine était
    // déjà « critique » avant de se dégrader, donc la dégradation réelle
    // passait inaperçue dans le bruit de l'alarme permanente.
    const evaluation = evaluerCapteur('pressure', serieAvecDerive(185, 60, 0.45));
    expect(evaluation.etat).toBe('anomalie');
  });

  it('le score de santé baisse quand un capteur dérive', () => {
    const sain = evaluerCapteur('temperature', serieStable(62, 60));
    const derivant = evaluerCapteur('vibration', serieAvecDerive(2.4, 60, 0.45));
    const score = scoreDeSante([sain, derivant]);
    expect(score).toBeDefined();
    expect(score!).toBeLessThan(100);
  });
});

describe('La référence est le passé, jamais la série entière', () => {
  it('une dérive ne se dissout pas dans sa propre référence', () => {
    // Si la référence était calculée sur TOUTE la série, la dérive y serait
    // incluse, la moyenne de référence monterait avec elle, et l'écart réduit
    // s'effondrerait : la dégradation masquerait sa propre détection.
    const n = 60;
    const serie: ReleveCapteur[] = Array.from({ length: n }, (_, i) => ({
      valeur: 10 + (i >= n * 0.66 ? 5 : 0),
      horodatage: new Date(T0 + i * HEURE),
    }));
    const evaluation = evaluerCapteur('temperature', serie);
    expect(evaluation.etat).toBe('anomalie');
    expect(evaluation.reference!.moyenne).toBeCloseTo(10, 5);
  });

  it('l’ordre d’arrivée des relevés ne change pas le verdict', () => {
    // Le stockage renvoie les relevés du plus récent au plus ancien. S'y fier
    // sans retrier inverserait référence et évaluation.
    const croissant = serieStable(50, 40);
    const decroissant = [...croissant].reverse();
    expect(evaluerCapteur('temperature', decroissant).ecartReduit)
      .toBeCloseTo(evaluerCapteur('temperature', croissant).ecartReduit!, 10);
  });
});

describe('Ce qui n’est pas mesurable est déclaré tel, jamais comblé', () => {
  it('sans relevé, le capteur est « non évalué » et le motif le dit', () => {
    const evaluation = evaluerCapteur('temperature', []);
    expect(evaluation.etat).toBe('non_evalue');
    expect(evaluation.motif).toMatch(/aucun relevé/);
    expect(evaluation.valeurCourante).toBeUndefined();
  });

  it('sous le minimum de points, aucune référence n’est inventée', () => {
    const evaluation = evaluerCapteur('vibration', serieStable(2.1, POINTS_MINIMUM - 1));
    expect(evaluation.etat).toBe('non_evalue');
    expect(evaluation.reference).toBeUndefined();
    expect(evaluation.ecartReduit).toBeUndefined();
  });

  it('le score de santé est indéfini — et non 85 — sans capteur évaluable', () => {
    // La valeur 85 était renvoyée par l'ancien code en l'absence TOTALE de
    // données : une machine non surveillée était annoncée saine à 85 %.
    expect(scoreDeSante([])).toBeUndefined();
    expect(scoreDeSante([evaluerCapteur('temperature', [])])).toBeUndefined();
  });

  it('« non évalué » ne se confond pas avec « sain »', () => {
    expect(etatEquipement([evaluerCapteur('temperature', [])])).toBe('non_evalue');
    expect(etatEquipement([evaluerCapteur('temperature', serieStable(60, 40))])).toBe('sain');
  });
});

describe('Robustesse numérique', () => {
  it('un capteur parfaitement constant ne déclenche pas d’anomalie', () => {
    // Écart-type nul : sans plancher relatif, la division ferait exploser
    // l'écart réduit et signalerait une anomalie sur une machine immobile.
    const constant: ReleveCapteur[] = Array.from({ length: 40 }, (_, i) => ({
      valeur: 7.5,
      horodatage: new Date(T0 + i * HEURE),
    }));
    const evaluation = evaluerCapteur('pressure', constant);
    expect(evaluation.etat).toBe('normal');
    expect(Number.isFinite(evaluation.ecartReduit!)).toBe(true);
  });

  it('les valeurs non numériques sont écartées sans fausser la référence', () => {
    const serie = serieStable(20, 40);
    const pollue = [
      ...serie,
      { valeur: Number.NaN, horodatage: new Date(T0) },
      { valeur: 20, horodatage: new Date('date invalide') },
    ] as ReleveCapteur[];
    expect(evaluerCapteur('temperature', pollue).etat).toBe('normal');
  });

  it('une baisse brutale est signalée autant qu’une hausse', () => {
    // Une pression qui s'effondre ou un courant qui chute signent une panne
    // tout autant qu'un dépassement. Un seuil haut ne voit que la moitié des
    // défaillances.
    const n = 60;
    const serie: ReleveCapteur[] = Array.from({ length: n }, (_, i) => ({
      valeur: 100 - (i >= n * 0.66 ? 40 : 0),
      horodatage: new Date(T0 + i * HEURE),
    }));
    const evaluation = evaluerCapteur('pressure', serie);
    expect(evaluation.etat).toBe('anomalie');
    expect(evaluation.ecartReduit!).toBeLessThan(0);
  });
});
