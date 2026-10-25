/**
 * La phrase du diagnostic cite-t-elle vraiment ses sources ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ
 * ═══════════════════════════════════════════════════════════════════
 * `server/hybrid-diagnostic-pipeline.ts` tenait DEUX listes de moteurs : l'une
 * produisait les libellés (`getEngineSources`), l'autre les reconnaissait par
 * sous-chaîne pour construire la phrase rendue à l'utilisateur
 * (`buildExplanationSummary`). Elles avaient dérivé :
 *
 *   • la reconnaissance testait `'Règles'` avec une MAJUSCULE, quand le libellé
 *     produit est « Moteur de règles expert ». Le moteur de règles n'était donc
 *     jamais reconnu ;
 *   • le graphe causal et le jumeau numérique n'avaient aucune description.
 *
 * Mesuré sur une grappe de test, base de cas vide — l'état d'une installation
 * neuve, où le moteur de règles est le SEUL à répondre : `POST /api/diagnostic`
 * renvoyait « Confiance Moyenne (66%) — 2 diagnostic(s) proposé(s) à partir
 * de . ». Une phrase tronquée, sur le chemin le plus fréquent.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE GARDE
 * ═══════════════════════════════════════════════════════════════════
 * Une seule table (`server/diagnostic-sources.ts`) est désormais lue par les deux côtés,
 * donc la dérive n'est plus possible par construction. Ces cas vérifient que la
 * table reste complète, et surtout que CHAQUE libellé qu'elle contient est
 * réellement traduit — c'est la vérification qui manquait, et la seule qui
 * aurait attrapé la majuscule.
 */
import { describe, it, expect } from '@jest/globals';
import { SOURCES_DIAGNOSTIC, decrireSources } from '../../server/diagnostic-sources';

const MOTEURS = Object.values(SOURCES_DIAGNOSTIC);

describe('Sources du diagnostic — aucun moteur cité sans être décrit', () => {
  it('chaque moteur de la table porte un libellé ET une description', () => {
    expect(MOTEURS.length).toBeGreaterThan(0);
    for (const moteur of MOTEURS) {
      expect(moteur.libelle.trim().length).toBeGreaterThan(0);
      expect(moteur.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("chaque description s'enchaîne après « à partir de » sans doubler la préposition", () => {
    // Défaut mesuré : la description du moteur de règles commençait par « des »,
    // et la phrase rendue — une fois la reconnaissance réparée — disait « à
    // partir de des règles de maintenance ». Elle était restée invisible parce
    // que cette branche n'était jamais atteinte.
    for (const moteur of MOTEURS) {
      expect(moteur.description).not.toMatch(/^(de |des |d')/i);
    }
  });

  it('tout libellé de la table est traduit — le cas que la majuscule faisait rater', () => {
    for (const moteur of MOTEURS) {
      expect(decrireSources([moteur.libelle])).toEqual([moteur.description]);
    }
  });

  it('le moteur de règles seul — chemin d\'une installation neuve — est bien décrit', () => {
    // C'est exactement ce que renvoyait `getEngineSources` quand la base de cas
    // est vide : un seul moteur, et une phrase qui n'en citait aucun.
    const decrites = decrireSources([SOURCES_DIAGNOSTIC.regles.libelle]);
    expect(decrites).toHaveLength(1);
    expect(decrites[0]).toBe(SOURCES_DIAGNOSTIC.regles.description);
  });

  it('les descriptions suivent l\'ordre où les moteurs ont répondu', () => {
    const cites = [
      SOURCES_DIAGNOSTIC.memoire.libelle,
      SOURCES_DIAGNOSTIC.regles.libelle,
    ];
    expect(decrireSources(cites)).toEqual([
      SOURCES_DIAGNOSTIC.memoire.description,
      SOURCES_DIAGNOSTIC.regles.description,
    ]);
  });

  it('deux libellés distincts donnent deux descriptions distinctes', () => {
    // Deux moteurs qui se rejoindraient sur la même phrase rendraient la
    // provenance illisible (« à partir de X, X »).
    const descriptions = MOTEURS.map((m) => m.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    const libelles = MOTEURS.map((m) => m.libelle);
    expect(new Set(libelles).size).toBe(libelles.length);
  });

  it('un libellé inconnu ne produit RIEN — pas une provenance approchante', () => {
    expect(decrireSources(['Moteur inventé'])).toEqual([]);
    expect(decrireSources(['Règles'])).toEqual([]);
    expect(decrireSources([])).toEqual([]);
  });

  it('un libellé inconnu mêlé à un connu ne fait pas perdre le connu', () => {
    const decrites = decrireSources(['Moteur inventé', SOURCES_DIAGNOSTIC.ia.libelle]);
    expect(decrites).toEqual([SOURCES_DIAGNOSTIC.ia.description]);
  });
});
