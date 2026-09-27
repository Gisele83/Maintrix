/**
 * Le script de reprise d'accès lit-il les rôles comme le serveur ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * `reinitialiser-mot-de-passe.mjs` tourne sur le serveur, hors build : Node
 * n'importe pas un fichier TypeScript, donc le script relit `shared/roles.ts`
 * depuis sa source et refait la normalisation à la main.
 *
 * C'est une SECONDE implémentation de la même règle. Si elle diverge, le script
 * déclarera valide un rôle que le serveur refusera — ou l'inverse — et l'on
 * rendra son mot de passe à quelqu'un qui ne verra toujours rien.
 *
 * Le besoin est né d'un cas réel : un compte portait le rôle « Directrice »,
 * saisi en texte libre avant que la création ne soit contrainte. La matrice de
 * permissions ne le connaît pas, donc ce compte avait ZÉRO droit — tout en
 * affichant « Directrice » dans l'interface, comme si de rien n'était.
 * Constaté le 2026-09-27.
 *
 * Ce test confronte les deux lectures sur les mêmes entrées.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normaliserRole, IDENTIFIANTS_ROLES } from '../../shared/roles';

const RACINE = join(__dirname, '..', '..');

/**
 * La relecture du script, extraite de sa source pour être évaluée ici.
 * On ne recopie pas la logique : on exécute CELLE DU SCRIPT.
 */
function lectureDuScript(): {
  normaliserRole: (v: unknown) => string | null;
  IDENTIFIANTS_ROLES: string[];
} {
  const script = readFileSync(join(RACINE, 'scripts', 'reinitialiser-mot-de-passe.mjs'), 'utf8');
  const bloc = script.match(
    /const \{ normaliserRole, IDENTIFIANTS_ROLES \} = \(\(\) => \{[\s\S]*?\n\}\)\(\);/);
  if (!bloc) throw new Error('bloc de relecture des rôles introuvable dans le script');

  // Le bloc s'appuie sur `readFileSync`, `join`, `ROOT` et `mourir`.
  const fabrique = new Function('readFileSync', 'join', 'ROOT', 'mourir', `
    ${bloc[0].replace('const { normaliserRole, IDENTIFIANTS_ROLES } =', 'return')}
  `);
  return fabrique(readFileSync, join, RACINE, (m: string) => { throw new Error(m); });
}

describe('Relecture du référentiel par le script serveur', () => {
  const script = lectureDuScript();

  it('retrouve exactement les mêmes rôles que le module', () => {
    expect(script.IDENTIFIANTS_ROLES).toEqual([...IDENTIFIANTS_ROLES]);
  });

  it('normalise identiquement, sur tout ce qui a été vu en vrai', () => {
    const entrees = [
      // Les identifiants canoniques
      ...IDENTIFIANTS_ROLES,
      // Les alias hérités, présents en base
      'manager', 'supervisor', 'maintainer', 'operator', 'user', 'guest',
      // Les saisies libres du formulaire, avant qu'il ne soit contraint
      'Administrateur', '  TECHNICIEN ', "Chef d'équipe", 'Responsable maintenance',
      'Chef d’équipe', 'Lecture seule', 'Achats',
      // Le cas qui a motivé tout ceci, et ses voisins
      'Directrice', 'Directeur', 'Directrice technique', 'Directeur technique',
      // Ce qui ne doit correspondre à rien
      'sorcier', '', '   ', 'admin ; DROP TABLE',
    ];

    const divergences = entrees
      .map((e) => ({ entree: e, module: normaliserRole(e), script: script.normaliserRole(e) }))
      .filter((r) => r.module !== r.script);

    expect(divergences).toEqual([]);
  });

  it('les deux refusent « Directrice » — c\'est bien un rôle sans droits', () => {
    expect(normaliserRole('Directrice')).toBeNull();
    expect(script.normaliserRole('Directrice')).toBeNull();
  });

  it('refuse aussi ce qui n\'est pas une chaîne', () => {
    for (const valeur of [null, undefined, 42, {}, []]) {
      expect(script.normaliserRole(valeur)).toBeNull();
      expect(normaliserRole(valeur)).toBeNull();
    }
  });
});
