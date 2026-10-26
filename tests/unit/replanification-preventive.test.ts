/**
 * Le recalcul d'échéance d'un plan préventif, sur des dates choisies.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI UNE SUITE UNITAIRE EN PLUS DE L'INTÉGRATION
 * ═══════════════════════════════════════════════════════════════════
 * C'est la partie du correctif de clôture où une erreur ne se voit pas. Une
 * consommation de pièces qui échoue se lit tout de suite ; une échéance
 * décalée d'un jour à chaque cycle ne se remarque qu'après un an de dérive.
 * La suite d'intégration éprouve la boucle complète, mais sur deux ou trois
 * dates : elle ne peut pas couvrir le 31 janvier, le passage à l'heure
 * d'hiver, ni un retard de trois ans — et c'est là que vivent les défauts.
 *
 * Ce qui est verrouillé ici :
 *
 *   1. l'ancre est l'échéance PRÉVUE, donc un retard ne décale pas la grille
 *      (le défaut cumulatif : mensuel dû le 1er, fait le 8, qui repasserait au
 *      8 puis au 15 puis au 22) ;
 *   2. un retard supérieur à une période entière ne laisse pas l'échéance dans
 *      le passé ;
 *   3. les DEUX vocabulaires de fréquence réellement présents en base sont
 *      reconnus — `days/weeks/months/years` écrits par le formulaire web,
 *      `daily/weekly/monthly/quarterly/annually` écrits par les jeux de
 *      données. N'en reconnaître qu'un laisserait la replanification muette
 *      sur la moitié du parc, sans rien signaler ;
 *   4. un jour de mois inexistant est rabattu sur le dernier jour du mois, et
 *      le rabattement ne se propage pas aux périodes suivantes ;
 *   5. une fréquence hors calendrier ou une période non positive refusent de
 *      replanifier, chacune avec son motif — « inconnue » mérite une trace,
 *      « sur compteur » non.
 */
import { describe, it, expect } from '@jest/globals';
import { prochaineEcheance } from '@shared/replanification-preventive';

/** Toutes les dates sont en UTC : les colonnes sont des `timestamp` sans fuseau. */
const d = (iso: string) => new Date(iso);
const iso = (date: Date | null) => (date ? date.toISOString() : null);

describe("L'ancre est l'échéance prévue, pas la date de réalisation", () => {
  it("avance d'exactement une période quand l'intervention est en avance", () => {
    const r = prochaineEcheance('monthly', 1, d('2026-11-01T08:00:00Z'), d('2026-10-25T17:00:00Z'));

    expect(iso(r.nextDue)).toBe('2026-12-01T08:00:00.000Z');
    expect(r.periodesAjoutees).toBe(1);
  });

  it('conserve la grille malgré un retard de deux jours', () => {
    // LE DÉFAUT QU'ON EMPÊCHE : `réalisation + période` donnerait le 3 mars,
    // puis le 5 avril, puis le 9 mai. Au bout d'un an, le plan a glissé d'un
    // trimestre sans que personne ne l'ait décidé.
    const r = prochaineEcheance('monthly', 1, d('2026-02-01T08:00:00Z'), d('2026-02-03T17:00:00Z'));

    expect(iso(r.nextDue)).toBe('2026-03-01T08:00:00.000Z');
    expect(r.periodesAjoutees).toBe(1);
  });

  it("ancre sur la réalisation quand le plan n'a jamais été planifié", () => {
    // `nextDue` nul : il n'y a pas de grille à préserver, la réalisation
    // devient la première référence.
    const r = prochaineEcheance('monthly', 1, null, d('2026-10-25T17:00:00Z'));

    expect(iso(r.nextDue)).toBe('2026-11-25T17:00:00.000Z');
    expect(r.periodesAjoutees).toBe(1);
  });
});

describe("Un retard supérieur à une période ne laisse pas l'échéance dans le passé", () => {
  it('saute les périodes entières écoulées, en restant sur la grille', () => {
    // Dû le 1er février, fait le 20 avril. Le 1er mars et le 1er avril sont
    // passés : la première échéance future sur la grille est le 1er mai.
    const r = prochaineEcheance('monthly', 1, d('2026-02-01T08:00:00Z'), d('2026-04-20T17:00:00Z'));

    expect(iso(r.nextDue)).toBe('2026-05-01T08:00:00.000Z');
    expect(r.periodesAjoutees).toBe(3);
  });

  it('tient un retard de trois ans sur un plan quotidien', () => {
    // Le chemin estimé plutôt que l'itération période par période. 2024 est
    // bissextile : 365 + 366 + 365 = 1096 jours écoulés, donc la première
    // échéance future est à 1097 jours de l'ancre.
    const r = prochaineEcheance('daily', 1, d('2023-01-01T06:00:00Z'), d('2026-01-01T06:00:00Z'));

    expect(iso(r.nextDue)).toBe('2026-01-02T06:00:00.000Z');
    expect(r.periodesAjoutees).toBe(1097);
  });

  it("rend toujours une échéance strictement postérieure à la réalisation", () => {
    // La propriété qui compte vraiment, éprouvée sur une série de décalages :
    // un plan replanifié ne doit JAMAIS ressortir « en retard » juste après
    // avoir été exécuté.
    const realise = d('2026-06-15T12:00:00Z');
    const frequences: Array<[string, number]> = [
      ['daily', 1], ['weekly', 2], ['monthly', 1], ['quarterly', 1], ['annually', 1],
      ['days', 10], ['weeks', 3], ['months', 2], ['years', 1],
    ];
    for (const [frequence, valeur] of frequences) {
      for (const recul of ['2020-01-31T08:00:00Z', '2026-06-14T23:59:00Z', '2026-02-28T08:00:00Z']) {
        const r = prochaineEcheance(frequence, valeur, d(recul), realise);
        expect(r.nextDue).not.toBeNull();
        expect(r.nextDue!.getTime()).toBeGreaterThan(realise.getTime());
      }
    }
  });
});

describe('Les deux vocabulaires de fréquence présents en base', () => {
  // Ce n'est pas une précaution : c'est un relevé. Le formulaire web écrit
  // `days/weeks/months/years` (client/src/components/preventive-maintenance.tsx),
  // l'injecteur de démonstration écrit `monthly/quarterly/weekly/annually`.
  const avance = (frequence: string, valeur: number | null) =>
    iso(prochaineEcheance(frequence, valeur, d('2026-01-10T06:00:00Z'), d('2026-01-09T06:00:00Z')).nextDue);

  it('vocabulaire du formulaire web : unité nommée, valeur qui la compte', () => {
    expect(avance('days', 10)).toBe('2026-01-20T06:00:00.000Z');
    expect(avance('weeks', 3)).toBe('2026-01-31T06:00:00.000Z');
    expect(avance('months', 3)).toBe('2026-04-10T06:00:00.000Z');
    expect(avance('years', 1)).toBe('2027-01-10T06:00:00.000Z');
  });

  it('vocabulaire des jeux de données : période nommée en entier', () => {
    expect(avance('daily', 1)).toBe('2026-01-11T06:00:00.000Z');
    expect(avance('weekly', 1)).toBe('2026-01-17T06:00:00.000Z');
    expect(avance('monthly', 1)).toBe('2026-02-10T06:00:00.000Z');
    expect(avance('quarterly', 1)).toBe('2026-04-10T06:00:00.000Z');
    expect(avance('annually', 1)).toBe('2027-01-10T06:00:00.000Z');
  });

  it('la valeur multiplie la période nommée', () => {
    // `{ weekly, 2 }` vaut deux semaines — c'est ce qu'écrit l'injecteur de
    // démonstration.
    expect(avance('weekly', 2)).toBe('2026-01-24T06:00:00.000Z');
    expect(avance('quarterly', 2)).toBe('2026-07-10T06:00:00.000Z');
  });

  it("une valeur absente vaut 1 : `monthly` sans valeur, c'est tous les mois", () => {
    // `frequency_value` est nullable en base, et de nombreux plans existants
    // n'en portent pas.
    expect(avance('monthly', null)).toBe('2026-02-10T06:00:00.000Z');
  });

  it('la casse et les espaces ne font pas échouer la reconnaissance', () => {
    expect(avance('  Monthly ', 1)).toBe('2026-02-10T06:00:00.000Z');
  });
});

describe('Jours de mois inexistants', () => {
  it('rabat le 31 sur le dernier jour du mois court', () => {
    // `setMonth` déborderait : le 31 janvier + 1 mois donnerait le 3 mars, et
    // un contrôle mensuel quitterait le mois qu'il était censé couvrir.
    const r = prochaineEcheance('monthly', 1, d('2026-01-31T08:00:00Z'), d('2026-01-31T09:00:00Z'));

    expect(iso(r.nextDue)).toBe('2026-02-28T08:00:00.000Z');
  });

  it('le rabattement ne se propage PAS aux périodes suivantes', () => {
    // Le piège de l'addition répétée : 31 janvier → 28 février → 28 mars.
    // Le calcul part de l'ancre avec un multiplicateur, donc le 31 mars
    // existe toujours.
    const r = prochaineEcheance('monthly', 1, d('2026-01-31T08:00:00Z'), d('2026-03-01T09:00:00Z'));

    expect(iso(r.nextDue)).toBe('2026-03-31T08:00:00.000Z');
    expect(r.periodesAjoutees).toBe(2);
  });

  it('tient le 29 février des années bissextiles', () => {
    const r = prochaineEcheance('years', 1, d('2024-02-29T08:00:00Z'), d('2024-03-01T08:00:00Z'));

    // 2025 n'est pas bissextile : rabattu au 28.
    expect(iso(r.nextDue)).toBe('2025-02-28T08:00:00.000Z');
  });
});

describe("Les cas où il n'y a rien à replanifier", () => {
  it('fréquence sur compteur : aucune échéance de date, et le motif le dit', () => {
    // Un plan réglé en heures de fonctionnement a pour échéance une VALEUR DE
    // COMPTEUR, que `maintenance_counters` suit déjà. Le distinguer d'une
    // fréquence inconnue permet de ne tracer que ce qui mérite une trace.
    const r = prochaineEcheance('hours_based', 500, d('2026-01-01T00:00:00Z'), d('2026-01-02T00:00:00Z'));

    expect(r.nextDue).toBeNull();
    expect(r.motif).toBe('frequence_sur_compteur');
  });

  it('fréquence inconnue : refus, avec un motif distinct', () => {
    const r = prochaineEcheance('tous_les_mardis', 1, d('2026-01-01T00:00:00Z'), d('2026-01-02T00:00:00Z'));

    expect(r.nextDue).toBeNull();
    expect(r.motif).toBe('frequence_inconnue');
  });

  it('fréquence absente ou vide : refus', () => {
    expect(prochaineEcheance(null, 1, d('2026-01-01T00:00:00Z'), d('2026-01-02T00:00:00Z')).motif)
      .toBe('frequence_inconnue');
    expect(prochaineEcheance('', 1, d('2026-01-01T00:00:00Z'), d('2026-01-02T00:00:00Z')).motif)
      .toBe('frequence_inconnue');
  });

  it('période nulle ou négative : REFUS, et non correction silencieuse vers 1', () => {
    // Une saisie à 0 est une erreur de saisie. Lui inventer un sens la
    // rendrait indétectable — et c'est aussi ce refus qui garantit que le
    // calcul termine.
    expect(prochaineEcheance('monthly', 0, d('2026-01-01T00:00:00Z'), d('2026-01-02T00:00:00Z')).motif)
      .toBe('periode_non_positive');
    expect(prochaineEcheance('days', -5, d('2026-01-01T00:00:00Z'), d('2026-01-02T00:00:00Z')).motif)
      .toBe('periode_non_positive');
  });
});

describe('Le changement d\'heure ne décale pas les échéances', () => {
  it('une semaine à cheval sur le passage à l\'heure d\'hiver fait 7 jours pleins', () => {
    // Le 25 octobre 2026 est un dimanche de changement d'heure en Europe.
    // `setDate` travaille en heure LOCALE et ferait glisser l'échéance d'une
    // heure ; le calcul se fait en millisecondes UTC.
    const r = prochaineEcheance('weekly', 1, d('2026-10-23T06:00:00Z'), d('2026-10-22T06:00:00Z'));

    expect(iso(r.nextDue)).toBe('2026-10-30T06:00:00.000Z');
  });

  it("un plan mensuel garde son heure UTC au fil de l'année", () => {
    const r = prochaineEcheance('monthly', 1, d('2026-03-15T04:30:00Z'), d('2026-03-14T04:30:00Z'));

    expect(iso(r.nextDue)).toBe('2026-04-15T04:30:00.000Z');
  });
});
