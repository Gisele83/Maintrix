/**
 * Les seuils de stock et les pronostics reposent-ils sur quelque chose ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * STOCK — Maintrix stockait un point de commande et un stock minimum, alertait
 * sur eux, mais ne les CALCULAIT nulle part : saisis à la main, sans lien avec
 * la consommation ni avec le délai d'approvisionnement, alors que les sorties
 * sont enregistrées et que le délai figure sur chaque référence. Le `leadTime`
 * ne servait qu'à estimer une date de livraison.
 *
 * PRONOSTIC — le moteur prédictif écrivait `pattern.frequency / 10` sous le
 * commentaire « convert annual frequency to probability ». Ce n'est pas une
 * conversion : le résultat ne dépendait d'aucun horizon. Pour un roulement
 * moteur de taux 2,5/an, la probabilité de base valait 0,25, au-dessus du seuil
 * de 0,2 : un équipement SANS AUCUN SYMPTÔME déclenchait une alerte, avec une
 * rupture annoncée à dix jours. Un système qui crie au loup sur du matériel
 * sain est abandonné en trois semaines.
 *
 * Constaté le 2026-10-13.
 */
import { describe, it, expect } from '@jest/globals';
import {
  suggererPointDeCommande, etatDuStock, SORTIES_MINIMALES,
} from '../../shared/stock';
import {
  probabiliteDefaillance, combinerAvecSymptomes, joursAvantDefaillance,
} from '../../shared/pronostic';

const jour = (n: number) => new Date(Date.UTC(2026, 0, 1 + n));

describe('Point de commande', () => {
  it('tient compte du délai : une pièce lente se commande plus tôt', () => {
    // Une sortie de 2 pièces tous les 10 jours, sur 60 jours.
    const sorties = Array.from({ length: 7 }, (_, i) => ({ date: jour(i * 10), quantite: 2 }));

    const rapide = suggererPointDeCommande(sorties, 2)!;
    const lent = suggererPointDeCommande(sorties, 30)!;

    expect(lent.pointDeCommande).toBeGreaterThan(rapide.pointDeCommande);
  });

  it('un taux de service plus exigeant demande plus de stock de sécurité', () => {
    const sorties = [
      { date: jour(0), quantite: 1 }, { date: jour(3), quantite: 5 },
      { date: jour(7), quantite: 2 }, { date: jour(12), quantite: 8 },
      { date: jour(18), quantite: 1 }, { date: jour(25), quantite: 6 },
      { date: jour(30), quantite: 3 },
    ];
    const s95 = suggererPointDeCommande(sorties, 14, 95)!;
    const s99 = suggererPointDeCommande(sorties, 14, 99)!;
    expect(s99.stockDeSecurite).toBeGreaterThan(s95.stockDeSecurite);
  });

  it('une consommation régulière demande moins de sécurité qu\'une erratique', () => {
    const reguliere = Array.from({ length: 30 }, (_, i) => ({ date: jour(i), quantite: 3 }));
    const erratique = Array.from({ length: 30 }, (_, i) => ({
      date: jour(i), quantite: i % 10 === 0 ? 30 : 0.0001,
    }));
    const a = suggererPointDeCommande(reguliere, 10)!;
    const b = suggererPointDeCommande(erratique, 10)!;
    expect(b.stockDeSecurite).toBeGreaterThan(a.stockDeSecurite);
  });

  it('ne suggère RIEN sous le seuil d\'observations', () => {
    const trop_peu = Array.from({ length: SORTIES_MINIMALES - 1 },
      (_, i) => ({ date: jour(i * 5), quantite: 2 }));
    expect(suggererPointDeCommande(trop_peu, 10)).toBeUndefined();
  });

  it('ne suggère rien sans délai d\'approvisionnement connu', () => {
    const sorties = Array.from({ length: 10 }, (_, i) => ({ date: jour(i), quantite: 2 }));
    expect(suggererPointDeCommande(sorties, 0)).toBeUndefined();
    expect(suggererPointDeCommande(sorties, NaN)).toBeUndefined();
  });

  it('expose ce sur quoi il se fonde', () => {
    const sorties = Array.from({ length: 10 }, (_, i) => ({ date: jour(i * 3), quantite: 4 }));
    const s = suggererPointDeCommande(sorties, 7)!;
    expect(s.base.sortiesObservees).toBe(10);
    expect(s.base.delaiJours).toBe(7);
    expect(s.base.tauxDeService).toBe(95);
  });
});

describe('État du stock — trois situations distinctes', () => {
  it('distingue rupture, sous-minimum et à commander', () => {
    // Fondre les trois dans une seule « alerte » efface la différence entre
    // « une intervention est à l'arrêt » et « il faudra passer commande ».
    expect(etatDuStock(0, 10, 5)).toBe('rupture');
    expect(etatDuStock(4, 10, 5)).toBe('sous_minimum');
    expect(etatDuStock(8, 10, 5)).toBe('a_commander');
    expect(etatDuStock(20, 10, 5)).toBe('normal');
  });

  it('se contente de ce qui est renseigné', () => {
    expect(etatDuStock(8, null, null)).toBe('normal');
    expect(etatDuStock(0, null, null)).toBe('rupture');
  });
});

describe('Probabilité de défaillance', () => {
  it('dépend de l\'horizon — ce que la division par 10 ignorait', () => {
    const p30 = probabiliteDefaillance(2.5, 30)!;
    const p180 = probabiliteDefaillance(2.5, 180)!;
    expect(p180).toBeGreaterThan(p30);
  });

  it('suit la loi de Poisson', () => {
    // λ = 1/an sur 365,25 jours ⇒ 1 − e⁻¹ ≈ 0,632.
    expect(probabiliteDefaillance(1, 365.25)!).toBeCloseTo(0.6321, 3);
  });

  it('reste sous 1 sur les horizons exploitables', () => {
    // Sur un horizon réaliste, la probabilité approche 1 sans l'atteindre.
    // Au-delà, `1 − e⁻ˣ` n'est plus représentable en virgule flottante et vaut
    // exactement 1 : la limite est celle du calcul en machine, pas celle de la
    // loi. Inutile d'exiger du code une précision que le format ne porte pas.
    expect(probabiliteDefaillance(10, 365)!).toBeLessThan(1);
    expect(probabiliteDefaillance(10, 365)!).toBeGreaterThan(0.99);
    expect(probabiliteDefaillance(10, 36525)!).toBeLessThanOrEqual(1);
  });

  it('refuse les entrées qui n\'ont pas de sens', () => {
    expect(probabiliteDefaillance(0, 30)).toBeUndefined();
    expect(probabiliteDefaillance(-1, 30)).toBeUndefined();
    expect(probabiliteDefaillance(2, 0)).toBeUndefined();
    expect(probabiliteDefaillance(undefined, 30)).toBeUndefined();
  });
});

describe('Combinaison avec les symptômes', () => {
  it('sans symptôme, la probabilité reste celle de la population', () => {
    expect(combinerAvecSymptomes(0.2, 0)).toBe(0.2);
  });

  it('chaque symptôme augmente la probabilité, sans jamais atteindre 1', () => {
    const base = 0.2;
    const partiel = combinerAvecSymptomes(base, 0.5);
    const total = combinerAvecSymptomes(base, 1);
    expect(partiel).toBeGreaterThan(base);
    expect(total).toBeGreaterThan(partiel);
    expect(total).toBeLessThan(1);
  });

  it('ne dépasse jamais 1, là où une somme le pouvait', () => {
    // L'ancienne formule `base + ratio × 0,6` donnait 1,4 ici, d'où un
    // plafonnement arbitraire à 0,95 qui masquait le défaut.
    expect(combinerAvecSymptomes(0.8, 1)).toBeLessThan(1);
  });
});

describe('Temps restant avant défaillance', () => {
  it('se déduit de l\'avancement des symptômes, pas de la probabilité', () => {
    // À mi-parcours des symptômes, il reste la moitié du délai de développement.
    expect(joursAvantDefaillance(14, 0.5)).toBe(7);
    expect(joursAvantDefaillance(14, 1)).toBe(0);
  });

  it("n'annonce aucune échéance tant qu'aucun symptôme n'est observé", () => {
    // L'ancienne formule annonçait une rupture à dix jours pour une machine
    // parfaitement saine, du seul fait de sa probabilité de base.
    expect(joursAvantDefaillance(14, 0)).toBeUndefined();
  });
});
