/**
 * Un seuil réglé par un ingénieur l'emporte-t-il, et dit-il qu'il a décidé ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * La détection statistique de `shared/supervision.ts` a remplacé quatre
 * constantes universelles qui rendaient toute usine « critique » en
 * permanence. Mais elle a une limite que rien dans son réglage ne lèvera :
 * elle détecte un CHANGEMENT, pas un DÉPASSEMENT. Une machine mauvaise depuis
 * toujours lui paraît normale, son mauvais état étant devenu sa référence.
 *
 * Les seuils réglables comblent ce manque. Ces tests verrouillent les trois
 * propriétés sans lesquelles ils seraient pires qu'absents :
 *
 *   1. un seuil réglé PRIME sur l'inférence statistique ;
 *   2. le sens du franchissement est respecté — sans quoi les grandeurs dont
 *      la panne est la CHUTE (pression, débit, niveau) sont jugées à l'envers,
 *      ce qui a déjà produit une alerte critique à chaque relevé normal ;
 *   3. l'évaluation DIT laquelle des deux méthodes a décidé.
 */

import { describe, expect, it } from '@jest/globals';
import {
  evaluerCapteur,
  evaluerContreSeuil,
  scoreDeSante,
  POINTS_MINIMUM,
  type ReleveCapteur,
  type SeuilConfigure,
} from '@shared/supervision';

const T0 = new Date('2026-01-01T00:00:00Z').getTime();
const HEURE = 3_600_000;

function serie(valeur: number, n: number): ReleveCapteur[] {
  return Array.from({ length: n }, (_, i) => ({
    valeur: valeur * (1 + 0.01 * Math.sin(i)),
    horodatage: new Date(T0 + i * HEURE),
  }));
}

const SEUIL_TEMPERATURE: SeuilConfigure = {
  typeCapteur: 'temperature',
  niveauAlerte: 75,
  niveauCritique: 85,
  sens: 'au-dessus',
  unite: '°C',
};

// La panne d'un circuit hydraulique est la CHUTE de pression : le niveau
// critique est donc plus BAS que le niveau d'alerte.
const SEUIL_PRESSION: SeuilConfigure = {
  typeCapteur: 'pressure',
  niveauAlerte: 5.5,
  niveauCritique: 4.0,
  sens: 'au-dessous',
  unite: 'bar',
};

describe('Le sens du franchissement est respecté', () => {
  it('vers le haut : au-delà du critique, anomalie', () => {
    expect(evaluerContreSeuil(90, SEUIL_TEMPERATURE)).toBe('anomalie');
    expect(evaluerContreSeuil(78, SEUIL_TEMPERATURE)).toBe('surveillance');
    expect(evaluerContreSeuil(60, SEUIL_TEMPERATURE)).toBe('normal');
  });

  it('vers le bas : une pression de service reste normale', () => {
    // C'est le défaut historique : comparée vers le haut, une pression de
    // 7 bar « franchissait » le critique à 4,0 et déclenchait une alarme
    // critique à chaque relevé.
    expect(evaluerContreSeuil(7.0, SEUIL_PRESSION)).toBe('normal');
  });

  it('vers le bas : c’est la chute qui alarme', () => {
    expect(evaluerContreSeuil(5.0, SEUIL_PRESSION)).toBe('surveillance');
    expect(evaluerContreSeuil(3.5, SEUIL_PRESSION)).toBe('anomalie');
  });

  it('le critique est testé AVANT l’alerte', () => {
    // Dans le sens « au-dessous », une valeur sous le critique est aussi sous
    // l'alerte. L'ordre inverse classerait une urgence en avertissement.
    expect(evaluerContreSeuil(4.0, SEUIL_PRESSION)).toBe('anomalie');
  });
});

describe('Un seuil réglé prime sur la détection statistique', () => {
  it('une machine stable À UN NIVEAU DANGEREUX est signalée', () => {
    // LA limite de la méthode statistique : cette machine est à 95 °C depuis
    // toujours, donc 95 °C EST sa référence, et aucun écart n'apparaît.
    const chaude = serie(95, 60);

    expect(evaluerCapteur('temperature', chaude).etat).toBe('normal');
    expect(evaluerCapteur('temperature', chaude, '°C', SEUIL_TEMPERATURE).etat).toBe('anomalie');
  });

  it('une machine stable à un niveau sûr reste normale', () => {
    expect(evaluerCapteur('temperature', serie(62, 60), '°C', SEUIL_TEMPERATURE).etat).toBe('normal');
  });

  it('le seuil décide dès le premier relevé, sans attendre un historique', () => {
    // Intérêt majeur sur une machine qu'on vient d'instrumenter : la méthode
    // statistique reste muette pendant POINTS_MINIMUM relevés.
    const deuxPoints = serie(95, 2);
    expect(deuxPoints.length).toBeLessThan(POINTS_MINIMUM);

    expect(evaluerCapteur('temperature', deuxPoints).etat).toBe('non_evalue');
    expect(evaluerCapteur('temperature', deuxPoints, '°C', SEUIL_TEMPERATURE).etat).toBe('anomalie');
  });

  it('sans seuil, la détection statistique reste en place', () => {
    const derive: ReleveCapteur[] = Array.from({ length: 60 }, (_, i) => ({
      valeur: 10 + (i >= 40 ? 5 : 0),
      horodatage: new Date(T0 + i * HEURE),
    }));
    const evaluation = evaluerCapteur('temperature', derive);
    expect(evaluation.methode).toBe('statistique');
    expect(evaluation.etat).toBe('anomalie');
  });
});

describe('La méthode employée est toujours déclarée', () => {
  it('« seuil » quand un réglage existe, et le seuil est rendu', () => {
    const evaluation = evaluerCapteur('temperature', serie(95, 60), '°C', SEUIL_TEMPERATURE);
    expect(evaluation.methode).toBe('seuil');
    expect(evaluation.seuil).toEqual(SEUIL_TEMPERATURE);
  });

  it('« statistique » quand aucun réglage n’existe', () => {
    expect(evaluerCapteur('temperature', serie(62, 60)).methode).toBe('statistique');
  });

  it('« aucune » quand rien n’a pu décider', () => {
    expect(evaluerCapteur('temperature', []).methode).toBe('aucune');
    expect(evaluerCapteur('temperature', serie(62, 3)).methode).toBe('aucune');
  });

  it('le motif explique l’absence de verdict, seuil compris', () => {
    const evaluation = evaluerCapteur('temperature', serie(62, 3));
    expect(evaluation.motif).toMatch(/aucun seuil réglé/);
  });

  it('l’unité du seuil sert de repli quand le relevé n’en porte pas', () => {
    expect(evaluerCapteur('temperature', serie(95, 60), undefined, SEUIL_TEMPERATURE).unite).toBe('°C');
  });
});

describe('Le score de santé tient compte des deux méthodes', () => {
  it('un capteur en anomalie par seuil fait baisser le score', () => {
    // Défaut possible : `scoreDeSante` ne retenait que les capteurs porteurs
    // d'un écart réduit. Une évaluation par seuil n'en a pas — le capteur en
    // anomalie aurait donc été ignoré, et la machine déclarée saine à 100 %.
    const parSeuil = evaluerCapteur('temperature', serie(95, 60), '°C', SEUIL_TEMPERATURE);
    expect(parSeuil.ecartReduit).toBeUndefined();

    const score = scoreDeSante([parSeuil]);
    expect(score).toBeDefined();
    expect(score!).toBeLessThan(100);
  });

  it('un capteur normal par seuil ne pénalise pas', () => {
    expect(scoreDeSante([evaluerCapteur('temperature', serie(62, 60), '°C', SEUIL_TEMPERATURE)])).toBe(100);
  });

  it('la surveillance pénalise moins que l’anomalie', () => {
    const surveille = evaluerCapteur('temperature', serie(78, 60), '°C', SEUIL_TEMPERATURE);
    const anormal = evaluerCapteur('temperature', serie(95, 60), '°C', SEUIL_TEMPERATURE);
    expect(surveille.etat).toBe('surveillance');
    expect(anormal.etat).toBe('anomalie');
    expect(scoreDeSante([surveille])!).toBeGreaterThan(scoreDeSante([anormal])!);
  });
});
