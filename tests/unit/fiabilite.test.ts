/**
 * Les grandeurs de fiabilité disent-elles ce qu'elles prétendent dire ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Maintrix portait TROIS définitions incompatibles du MTBF, dans deux unités,
 * dont deux fabriquaient une valeur en l'absence de données :
 *
 *   • `gmao-storage` : `(30 × 24 × nombreÉquipements) / nombreCorrectifs`, une
 *     période supposée de 30 jours quelle que soit la période demandée, du
 *     temps calendaire pris pour du temps de fonctionnement, et `0` quand
 *     aucune panne n'était survenue — ce qui se lit « tombe en panne en
 *     permanence » ;
 *   • `maintenance-recommendations` : `return 365` sous deux pannes, en jours,
 *     mesuré entre FINS de réparation. Cette valeur inventée descendait dans le
 *     calcul de risque et dans les recommandations faites aux équipes ;
 *   • `gmao-report-kpi-service` : la seule correcte.
 *
 * Une grandeur de fiabilité fausse ne se voit jamais. Elle décale une échéance,
 * change une priorité, et personne ne remonte au calcul. Constaté le
 * 2026-10-13.
 *
 * Ce test fixe les définitions. Il vérifie aussi qu'aucune quatrième variante
 * ne réapparaît dans le serveur.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  mtbfHeures, mutHeures, mttrHeures, disponibiliteIntrinseque, enJours, arrondir,
} from '../../shared/fiabilite';

const H = 3_600_000;
const t = (heures: number) => new Date(Date.UTC(2026, 0, 1) + heures * H);

describe('MTBF — intervalle entre déclenchements', () => {
  it('moyenne les intervalles entre débuts de panne', () => {
    // Pannes à t=0, t=100 h, t=250 h → intervalles de 100 et 150 → 125.
    const mtbf = mtbfHeures([
      { debut: t(0), fin: t(5) },
      { debut: t(100), fin: t(110) },
      { debut: t(250), fin: t(255) },
    ]);
    expect(mtbf).toBe(125);
  });

  it("n'existe pas sous deux pannes — et ne vaut NI 0 NI 365", () => {
    expect(mtbfHeures([])).toBeUndefined();
    expect(mtbfHeures([{ debut: t(0), fin: t(5) }])).toBeUndefined();
    // Les deux valeurs exactes que la plateforme inventait.
    expect(mtbfHeures([{ debut: t(0) }])).not.toBe(0);
    expect(mtbfHeures([{ debut: t(0) }])).not.toBe(365);
  });

  it('ignore les pannes sans date de déclenchement', () => {
    // Une intervention jamais démarrée ne date aucun événement : la retenir
    // avec une date nulle écraserait tous les intervalles.
    const mtbf = mtbfHeures([
      { debut: t(0) }, { debut: null }, { debut: undefined }, { debut: t(100) },
    ]);
    expect(mtbf).toBe(100);
  });

  it("l'ordre de saisie ne change pas le résultat", () => {
    const desordre = mtbfHeures([
      { debut: t(250) }, { debut: t(0) }, { debut: t(100) },
    ]);
    expect(desordre).toBe(125);
  });
});

describe('MUT — temps de bon fonctionnement', () => {
  it('mesure de la fin de réparation à la panne suivante', () => {
    // Panne 1 : 0 → 10 h. Panne 2 commence à 100 h ⇒ 90 h de marche.
    // Panne 2 : 100 → 120 h. Panne 3 commence à 200 h ⇒ 80 h de marche.
    const mut = mutHeures([
      { debut: t(0), fin: t(10) },
      { debut: t(100), fin: t(120) },
      { debut: t(200), fin: t(205) },
    ]);
    expect(mut).toBe(85);
  });

  it('est toujours inférieur au MTBF, du temps de réparation', () => {
    const pannes = [
      { debut: t(0), fin: t(10) },
      { debut: t(100), fin: t(120) },
      { debut: t(200), fin: t(205) },
    ];
    // Confondre les deux surestime la fiabilité d'autant que les réparations
    // sont longues : ici 100 h annoncées contre 85 h réelles de marche.
    expect(mtbfHeures(pannes)).toBe(100);
    expect(mutHeures(pannes)).toBe(85);
    expect(mutHeures(pannes)!).toBeLessThan(mtbfHeures(pannes)!);
  });

  it('écarte les chevauchements plutôt que de compter un temps négatif', () => {
    // La panne 2 commence AVANT la fin de la réparation 1 — deux organes
    // distincts. Compter -50 h de marche fausserait la moyenne vers le bas.
    const mut = mutHeures([
      { debut: t(0), fin: t(100) },
      { debut: t(50), fin: t(60) },
      { debut: t(200), fin: t(210) },
    ]);
    // Seul l'intervalle 60 h → 200 h est retenu : 140 h.
    expect(mut).toBe(140);
  });
});

describe('MTTR — durée des réparations', () => {
  it('moyenne les réparations closes', () => {
    expect(mttrHeures([
      { debut: t(0), fin: t(4) },
      { debut: t(100), fin: t(108) },
    ])).toBe(6);
  });

  it('ignore les interventions non closes', () => {
    expect(mttrHeures([
      { debut: t(0), fin: t(4) },
      { debut: t(100) },
    ])).toBe(4);
    expect(mttrHeures([{ debut: t(0) }])).toBeUndefined();
  });
});

describe('Disponibilité intrinsèque', () => {
  it('vaut MUT / (MUT + MTTR)', () => {
    // MUT = 90 h, MTTR = 10 h ⇒ 90 %.
    const dispo = disponibiliteIntrinseque([
      { debut: t(0), fin: t(10) },
      { debut: t(100), fin: t(110) },
    ]);
    expect(arrondir(dispo, 1)).toBe(90);
  });

  it("n'existe pas si l'une des deux grandeurs manque", () => {
    expect(disponibiliteIntrinseque([{ debut: t(0), fin: t(5) }])).toBeUndefined();
  });
});

describe('Conversions', () => {
  it("l'absence traverse les conversions sans devenir un nombre", () => {
    expect(enJours(undefined)).toBeUndefined();
    expect(arrondir(undefined)).toBeUndefined();
    expect(enJours(48)).toBe(2);
    expect(arrondir(2.449, 1)).toBe(2.4);
  });
});

describe('Aucune quatrième définition du MTBF', () => {
  const RACINE = join(__dirname, '..', '..');

  it('aucun fichier serveur ne recalcule le MTBF à sa façon', () => {
    const fautifs: string[] = [];
    for (const f of readdirSync(join(RACINE, 'server')).filter((f) => f.endsWith('.ts'))) {
      const contenu = readFileSync(join(RACINE, 'server', f), 'utf8');
      contenu.split('\n').forEach((ligne, i) => {
        const t = ligne.trim();
        if (t.startsWith('//') || t.startsWith('*')) return;
        // On ne traque que ce qui CALCULE un MTBF : une affectation suivie
        // d'une opération arithmétique. Un libellé, un affichage, une lecture
        // ou une déclaration de type ne définissent aucune grandeur — les y
        // inclure noierait le vrai signal sous les faux positifs.
        const affectation = /\bmtbf\w*\s*[:=]\s*[^=]/i.test(t);
        const arithmetique = /[*/]\s*\w|\w\s*[*/]|\d{2,}\s*[*/+-]/.test(t);
        // `MTBF_REFERENCE_HEURES` est une constante d'échelle nommée et
        // documentée : c'est précisément ce qu'on voulait obtenir à la place
        // d'une division opaque. L'exclure, c'est récompenser la clarté.
        const innocent = /mtbfHeures|nombreOuNull|valeurOuND|bucket|toFixed|<div|label|REFERENCE|\?\?|\?:/i.test(t);
        if (affectation && arithmetique && !innocent) {
          fautifs.push(`server/${f}:${i + 1} → ${t.slice(0, 80)}`);
        }
      });
    }
    expect(fautifs).toEqual([]);
  });

  it('la valeur inventée 365 a bien disparu des recommandations', () => {
    const source = readFileSync(join(RACINE, 'server', 'maintenance-recommendations.ts'), 'utf8');
    // `case "annually": return 365` est une conversion de fréquence légitime ;
    // c'est le repli silencieux du MTBF qui devait disparaître.
    expect(source).not.toMatch(/length\s*<\s*2\s*\)\s*return\s+365/);
    expect(source).toContain('mtbfHeures');
  });
});
