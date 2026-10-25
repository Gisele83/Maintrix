/**
 * Un seuil alerte-t-il du bon côté — et le simulateur simule-t-il le normal ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ
 * ═══════════════════════════════════════════════════════════════════
 * Deux défauts qui se renforçaient, et qu'aucun test ne pouvait voir parce
 * que la règle vivait dans une méthode privée et la configuration dans le
 * point de démarrage du serveur.
 *
 *   • LA PRESSION ALERTAIT À L'ENVERS. Sa configuration déclarait « alerte à
 *     5,5 bar, critique à 4,0 » — des nombres qui ne se comprennent que dans
 *     le sens de la CHUTE, puisque pour un circuit hydraulique c'est la perte
 *     de pression qui est la panne. Mais la comparaison ne savait faire
 *     qu'une chose, alerter AU-DESSUS, et elle évaluait le critique en
 *     premier. Toute pression normale dépassait donc 4,0 et déclenchait une
 *     alerte CRITIQUE. À chaque relevé. En continu.
 *
 *   • LA VIBRATION « NORMALE » DU SIMULATEUR VALAIT EXACTEMENT SON SEUIL
 *     D'ALERTE, 4,5 mm/s. Avec une variation de ±10 %, elle le franchissait
 *     une fois sur deux.
 *
 * Le simulateur tournant toutes les 30 secondes, cela faisait de l'ordre de
 * cent alertes fausses par heure. Elles ne se voyaient pas : écrites sans
 * locataire, aucune lecture ne les rendait. Le cloisonnement corrigé, elles
 * allaient devenir visibles — une correction d'isolation aurait livré une
 * avalanche d'urgences imaginaires aux testeurs.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE MESURE
 * ═══════════════════════════════════════════════════════════════════
 * Pas seulement les valeurs d'aujourd'hui : les PROPRIÉTÉS qui doivent tenir
 * pour n'importe quelle configuration future — un seuil cohérent avec son
 * sens, et un régime nominal qui reste à distance de l'alarme. La seconde
 * est celle qui aurait attrapé la vibration, et elle attrapera le prochain
 * réglage posé sur une ligne d'alarme.
 */
import { describe, it, expect } from '@jest/globals';
import {
  evaluerSeuil,
  SEUILS_PAR_DEFAUT,
  VALEURS_NOMINALES,
  VARIATION_SIMULATION,
  type SensorThreshold,
} from '../../server/integrations/seuils';

const seuil = (type: string): SensorThreshold => {
  const s = SEUILS_PAR_DEFAUT.find((x) => x.sensorType === type);
  if (!s) throw new Error(`seuil absent pour ${type}`);
  return s;
};

// ═══════════════════════════════════════════════════════════════════
describe('La décision de seuil', () => {
  it('au-dessus : alerte puis critique, en montant', () => {
    const temperature = seuil('temperature'); // 75 / 85
    expect(evaluerSeuil(70, temperature)).toBeNull();
    expect(evaluerSeuil(75, temperature)).toBe('high');
    expect(evaluerSeuil(80, temperature)).toBe('high');
    expect(evaluerSeuil(85, temperature)).toBe('critical');
    expect(evaluerSeuil(120, temperature)).toBe('critical');
  });

  it('au-dessous : alerte puis critique, en DESCENDANT', () => {
    const pression = seuil('pressure'); // alerte 5,5 — critique 4,0
    // Le cas qui produisait l'avalanche : une pression normale ne déclenche
    // plus rien du tout.
    expect(evaluerSeuil(7.0, pression)).toBeNull();
    expect(evaluerSeuil(5.6, pression)).toBeNull();
    // Puis la chute, par paliers.
    expect(evaluerSeuil(5.5, pression)).toBe('high');
    expect(evaluerSeuil(4.5, pression)).toBe('high');
    expect(evaluerSeuil(4.0, pression)).toBe('critical');
    expect(evaluerSeuil(0.5, pression)).toBe('critical');
  });

  it("sans sens déclaré, un seuil se lit « au-dessus »", () => {
    // Toute configuration existante qui ne dit rien doit se comporter comme
    // avant : le champ est une addition, pas un changement de défaut.
    const muet: SensorThreshold = {
      sensorType: 'x', warningThreshold: 10, criticalThreshold: 20, unit: 'u',
    };
    expect(evaluerSeuil(5, muet)).toBeNull();
    expect(evaluerSeuil(10, muet)).toBe('high');
    expect(evaluerSeuil(20, muet)).toBe('critical');
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Cohérence des seuils configurés', () => {
  it("le critique est toujours plus sévère que l'alerte, dans le sens déclaré", () => {
    const incoherents: string[] = [];
    for (const s of SEUILS_PAR_DEFAUT) {
      const ordonne = s.sens === 'au-dessous'
        ? s.criticalThreshold < s.warningThreshold
        : s.criticalThreshold > s.warningThreshold;
      if (!ordonne) {
        incoherents.push(
          `${s.sensorType} : alerte ${s.warningThreshold}, critique ${s.criticalThreshold}, `
          + `sens « ${s.sens ?? 'au-dessus'} »`,
        );
      }
    }
    expect(incoherents).toEqual([]);
  });

  it('une valeur posée sur un seuil déclenche bien ce seuil', () => {
    // Propriété qui découle de la précédente, mais mesurée sur le
    // COMPORTEMENT plutôt que sur les nombres : c'est lui qui comptait.
    for (const s of SEUILS_PAR_DEFAUT) {
      expect(evaluerSeuil(s.criticalThreshold, s)).toBe('critical');
      expect(evaluerSeuil(s.warningThreshold, s)).toBe('high');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Le régime nominal du simulateur', () => {
  it('ne franchit aucun seuil, variation comprise', () => {
    const fautifs: string[] = [];

    for (const s of SEUILS_PAR_DEFAUT) {
      const nominal = VALEURS_NOMINALES[s.sensorType];
      if (nominal === undefined) continue;

      // Le simulateur applique ±VARIATION_SIMULATION autour du nominal. On
      // éprouve les DEUX bornes et le centre : un seuil « au-dessous » est
      // menacé par la borne basse, un seuil « au-dessus » par la haute.
      const bornes = [
        nominal * (1 - VARIATION_SIMULATION),
        nominal,
        nominal * (1 + VARIATION_SIMULATION),
      ];

      for (const valeur of bornes) {
        const gravite = evaluerSeuil(valeur, s);
        if (gravite) {
          fautifs.push(
            `${s.sensorType} : nominal ${nominal}, la valeur ${valeur.toFixed(2)} donne « ${gravite} » `
            + `(alerte ${s.warningThreshold}, critique ${s.criticalThreshold}, `
            + `sens « ${s.sens ?? 'au-dessus'} »)`,
          );
        }
      }
    }

    // Message explicite : ce cas servira à quelqu'un qui réglera un seuil
    // dans six mois, et « expected [] to equal [...] » ne lui dirait rien.
    expect(fautifs).toEqual([]);
  });

  it('garde une marge au moins égale à la moitié de sa propre variation', () => {
    // Ne pas franchir ne suffit pas. La vibration ne franchissait « que » une
    // fois sur deux parce que son nominal valait le seuil ; la pression, elle,
    // passait à huit centièmes de bar du sien. Un réglage qui tient par huit
    // centièmes ne tient pas.
    //
    // La marge se mesure donc contre la grandeur qui la menace : l'amplitude
    // de la variation que le simulateur applique.
    const serres: string[] = [];

    for (const s of SEUILS_PAR_DEFAUT) {
      const nominal = VALEURS_NOMINALES[s.sensorType];
      if (nominal === undefined) continue;

      const amplitude = nominal * VARIATION_SIMULATION;
      const borneExposee = s.sens === 'au-dessous' ? nominal - amplitude : nominal + amplitude;
      // Marge SIGNÉE, pas une valeur absolue : une borne qui a déjà traversé
      // le seuil en est « loin », mais du mauvais côté. Avec Math.abs, la
      // vibration posée sur sa propre ligne d alarme passait ce cas.
      const marge = s.sens === 'au-dessous'
        ? borneExposee - s.warningThreshold
        : s.warningThreshold - borneExposee;

      if (marge < amplitude / 2) {
        serres.push(
          `${s.sensorType} : borne ${borneExposee.toFixed(2)} à ${marge.toFixed(2)} du seuil `
          + `${s.warningThreshold} — il en faut ${(amplitude / 2).toFixed(2)}`,
        );
      }
    }

    expect(serres).toEqual([]);
  });
});
