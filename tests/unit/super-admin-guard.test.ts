/**
 * Barrière de régression — toute route super-admin doit porter son garde.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CETTE BARRIÈRE EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * `publicPaths` (server/index.ts) teste les chemins avec `startsWith` et
 * contient l'entrée `/api/super-admin`. Conséquence : **tout** ce qui commence
 * par ce préfixe échappe au filtre d'authentification global — pas seulement
 * `/login`.
 *
 * Aujourd'hui ce n'est pas une faille : les 12 routes concernées portent
 * chacune `authenticateSuperAdmin`, qui les protège individuellement. La
 * vérification a été faite route par route en F11, et elles sont bien gardées.
 *
 * Mais il n'y a plus qu'UNE seule ligne de défense. Le jour où quelqu'un
 * ajoute une route super-admin en oubliant son garde, elle devient
 * publiquement accessible **en silence** : aucun test ne rougit, aucune erreur
 * n'apparaît, et l'administration de la plateforme entière est ouverte.
 *
 * Pourquoi ne pas plutôt corriger `publicPaths` ? Parce que le super-admin
 * utilise un mécanisme d'authentification distinct (jeton `Bearer` /
 * `superAdminToken`) de celui des locataires (`sessionToken`). Le retirer de
 * `publicPaths` ferait passer ces routes par un filtre qui ne sait pas lire
 * leur jeton : l'administration deviendrait inaccessible. Le correctif juste
 * n'est pas de déplacer le préfixe, c'est de garantir que la ligne de défense
 * restante ne peut pas être oubliée. C'est l'objet de ce test.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FICHIER = join(__dirname, '..', '..', 'server', 'super-admin-routes.ts');

/**
 * Routes délibérément non authentifiées, avec leur justification.
 * Toute addition ici doit être un choix argumenté, pas un contournement.
 */
const SANS_GARDE_ASSUME: Record<string, string> = {
  'post /login': "point d'entrée de l'authentification — vérifie lui-même e-mail, mot de passe et clé secrète",
  'post /logout': 'détruit la session côté client ; ne lit ni ne renvoie aucune donnée',
};

interface Route {
  methode: string;
  chemin: string;
  ligne: number;
  garde: boolean;
}

function extraireRoutes(): Route[] {
  const lignes = readFileSync(FICHIER, 'utf8').split(/\r?\n/);
  const motif = /^\s*(?:router|app)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]\s*,?\s*(.*)$/;

  return lignes.flatMap((texte, i) => {
    const m = motif.exec(texte);
    if (!m) return [];
    return [{
      methode: m[1],
      chemin: m[2],
      ligne: i + 1,
      // Le garde doit apparaître sur la ligne de déclaration, avant le
      // gestionnaire : c'est la seule position où il s'applique réellement.
      garde: /authenticateSuperAdmin/.test(m[3]),
    }];
  });
}

describe('F11 — Toute route super-admin est gardée', () => {
  const routes = extraireRoutes();

  it('le fichier de routes est bien analysé', () => {
    // Sans cette assertion, une modification de la forme des déclarations
    // ferait passer le test avec zéro route trouvée — un faux vert.
    expect(routes.length).toBeGreaterThanOrEqual(14);
  });

  it('aucune route non gardée en dehors de la liste assumée', () => {
    const nonGardees = routes
      .filter(r => !r.garde)
      .filter(r => !(`${r.methode} ${r.chemin}` in SANS_GARDE_ASSUME));

    const detail = nonGardees
      .map(r => `  ${r.methode.toUpperCase().padEnd(6)} /api/super-admin${r.chemin}   (super-admin-routes.ts:${r.ligne})`)
      .join('\n');

    expect(nonGardees.length === 0 ? '' : `\n\nRoute(s) super-admin SANS authenticateSuperAdmin :\n${detail}\n\n` +
      "Ces routes sont publiquement accessibles : le préfixe /api/super-admin\n" +
      "est dans `publicPaths` (server/index.ts), donc le filtre global ne les\n" +
      "protège pas. Ajoutez `authenticateSuperAdmin` sur la déclaration, ou\n" +
      "documentez l'exception dans SANS_GARDE_ASSUME avec sa justification.\n",
    ).toBe('');
  });

  it('les exceptions assumées existent toujours réellement', () => {
    // Une exception qui ne correspond plus à aucune route est une autorisation
    // orpheline : elle couvrirait par accident une future route homonyme.
    const presentes = new Set(routes.map(r => `${r.methode} ${r.chemin}`));
    const orphelines = Object.keys(SANS_GARDE_ASSUME).filter(c => !presentes.has(c));
    expect(orphelines).toEqual([]);
  });

  it('les exceptions assumées sont bien les seules routes ouvertes', () => {
    const ouvertes = routes.filter(r => !r.garde).map(r => `${r.methode} ${r.chemin}`).sort();
    expect(ouvertes).toEqual(Object.keys(SANS_GARDE_ASSUME).sort());
  });
});
