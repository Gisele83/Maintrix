/**
 * La formation promet-elle seulement ce qu'elle contient ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * La page Formation annonçait DOUZE modules. Six seulement avaient un contenu
 * dans `trainingContent.ts` : les six autres — « Fondamentaux de Smart
 * Diagnostic », « IA et Machine Learning », « Procédures de Maintenance »,
 * « Gestion des Données »… — ouvraient sur « Module non trouvé ».
 *
 * Les quatre parcours d'apprentissage désignaient par ailleurs des modules par
 * des identifiants inexistants, si bien qu'ils affichaient des listes vides ou
 * amputées sans que rien ne le signale.
 *
 * Cette dérive est silencieuse par nature : rien ne casse, rien ne lève
 * d'erreur, et elle ne se voit qu'en cliquant sur chaque module un par un. Ce
 * test la rend impossible à réintroduire.
 *
 * Il lit les deux fichiers comme du TEXTE plutôt que d'importer la page :
 * `training.tsx` tire des composants d'interface et des icônes, qui exigent un
 * environnement de rendu. Un test qu'il faut outiller n'est pas écrit.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..');

const pageFormation = readFileSync(join(RACINE, 'client/src/pages/training.tsx'), 'utf8');
const contenuFormation = readFileSync(join(RACINE, 'client/src/data/trainingContent.ts'), 'utf8');

/**
 * Le code, débarrassé de ses commentaires.
 *
 * ⚠️ Indispensable, et la première version de ce test l'avait oublié sur deux
 * assertions : un commentaire qui EXPLIQUE le retrait de « Certification
 * commencée » cite forcément cette chaîne. Le garde-fou punissait donc
 * l'explication du défaut qu'il surveille, et la seule façon de le satisfaire
 * aurait été d'effacer la raison du changement.
 */
const sansCommentaires = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');

/** Identifiants des modules annoncés par la page (4 espaces d'indentation). */
const modulesAnnonces = [...pageFormation.matchAll(/^ {6}id: "([a-z-]+)",$/gm)]
  .map((m) => m[1])
  .filter((id) => !id.endsWith('-path'));

/** Identifiants des modules qui ont réellement un contenu. */
const modulesAvecContenu = [...contenuFormation.matchAll(/^ {4}id: "([a-z-]+)",$/gm)].map((m) => m[1]);

/** Identifiants cités par les parcours d'apprentissage. */
const modulesDesParcours = [...pageFormation.matchAll(/modules: \[([^\]]*)\]/g)]
  .flatMap((m) => [...m[1].matchAll(/"([a-z-]+)"/g)].map((x) => x[1]));

describe('Chaque module annoncé a un contenu', () => {
  it('la page annonce au moins un module', () => {
    expect(modulesAnnonces.length).toBeGreaterThan(0);
  });

  it('aucun module annoncé n’ouvre sur « Module non trouvé »', () => {
    const orphelins = modulesAnnonces.filter((id) => !modulesAvecContenu.includes(id));
    expect(orphelins).toEqual([]);
  });

  it('aucun contenu n’est inaccessible depuis la page', () => {
    // Un module de contenu que la liste ne cite plus est du code mort : c'est
    // ainsi que « Gamification et Compétences » a survécu à la disparition de
    // la fonctionnalité qu'il enseignait.
    const inaccessibles = modulesAvecContenu.filter((id) => !modulesAnnonces.includes(id));
    expect(inaccessibles).toEqual([]);
  });
});

describe('Les parcours ne citent que des modules existants', () => {
  it('chaque identifiant cité correspond à un module annoncé', () => {
    const inconnus = [...new Set(modulesDesParcours)].filter((id) => !modulesAnnonces.includes(id));
    expect(inconnus).toEqual([]);
  });

  it('aucun parcours n’est vide', () => {
    const listes = [...pageFormation.matchAll(/modules: \[([^\]]*)\]/g)].map((m) => m[1].trim());
    for (const liste of listes) {
      // `trainingModules.map(...)` est une liste calculée, donc non vide par
      // construction : on ne contrôle que les listes écrites en dur.
      if (liste === '' || liste.startsWith('trainingModules')) continue;
      expect(liste.length).toBeGreaterThan(0);
    }
  });
});

describe('Le vocabulaire du produit est à jour', () => {
  const perimes = [
    'Smart GMAO',
    'Smart Diagnostic',
    'SmartDiagFix',
    'glassmorphisme',
    'révolutionnaire',
  ];

  it.each(perimes)('« %s » n’apparaît plus dans la page Formation', (terme) => {
    expect(sansCommentaires(pageFormation)).not.toContain(terme);
  });

  it.each(perimes)('« %s » n’apparaît plus dans le contenu des modules', (terme) => {
    expect(sansCommentaires(contenuFormation)).not.toContain(terme);
  });
});

describe('Aucune progression n’est fabriquée', () => {
  it('la page ne porte plus de progression écrite en dur', () => {
    // `progress: 100`, `completed: true` : chaque utilisateur se voyait
    // annoncer qu'il avait terminé des modules jamais ouverts.
    const source = sansCommentaires(pageFormation);
    expect(source).not.toMatch(/progress:\s*\d+/);
    expect(source).not.toMatch(/completed:\s*(true|false)/);
  });

  it('la page ne promet plus de certification', () => {
    const source = sansCommentaires(pageFormation);
    expect(source).not.toContain('Certification commencée');
    expect(source).not.toContain('Certifications Disponibles');
  });
});
