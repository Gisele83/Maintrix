/**
 * L'interface appelle-t-elle des routes qui existent ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * La page /email-diagnostic appelait `/api/super-admin/test-sendgrid` et
 * `/api/super-admin/test-email`. Les deux routes étaient COMMENTÉES dans
 * `super-admin-routes.ts`, avec la mention « les fonctions de test ont été
 * déplacées vers email-service.ts » — où elles n'ont jamais été écrites.
 *
 * Les boutons renvoyaient donc « 404 Route API inconnue ». Ce message ressemble
 * à un refus de SendGrid, alors que la requête n'avait jamais quitté Maintrix :
 * on a cherché une panne d'envoi pendant des jours là où il n'y avait qu'une
 * route manquante. Constaté le 2026-10-08.
 *
 * Rien ne reliait les deux côtés : ni le typage, ni la compilation. Ce test
 * est ce lien. Il échoue dès qu'une page appelle une route absente — y compris
 * une route mise en commentaire « temporairement ».
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..');
const PREFIXE = '/api/super-admin';

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree);
    return statSync(chemin).isDirectory() ? sources(chemin)
      : /\.tsx?$/.test(entree) ? [chemin] : [];
  });
}

/** Les chemins appelés par l'interface, avec le fichier qui les appelle. */
function cheminsAppeles(): Array<{ chemin: string; fichier: string }> {
  const trouves: Array<{ chemin: string; fichier: string }> = [];
  for (const fichier of sources(join(RACINE, 'client', 'src'))) {
    const contenu = readFileSync(fichier, 'utf8');
    // Guillemets simples, doubles ou gabarits ; on s'arrête au point d'interrogation.
    for (const m of contenu.matchAll(/["'`](\/api\/super-admin\/[^"'`?\s]*)["'`?]/g)) {
      trouves.push({ chemin: m[1], fichier: fichier.replace(RACINE, '').replace(/\\/g, '/') });
    }
  }
  return trouves;
}

/**
 * Les routes RÉELLEMENT déclarées — les lignes commentées sont écartées,
 * c'est précisément ce qui avait échappé à tout le monde.
 */
function routesDeclarees(): Array<{ methode: string; chemin: string }> {
  const source = readFileSync(join(RACINE, 'server', 'super-admin-routes.ts'), 'utf8');
  return source
    .split('\n')
    .filter((ligne) => !ligne.trim().startsWith('//'))
    .flatMap((ligne) => [...ligne.matchAll(/router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)]
      .map((m) => ({ methode: m[1], chemin: m[2] })));
}

/** `/users/:id/x` accepte `/users/12/x` ; `${…}` côté client vaut un segment. */
function enExpression(cheminRoute: string): RegExp {
  const corps = cheminRoute
    .split('/')
    .map((segment) => segment.startsWith(':') ? '[^/]+'
      : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('/');
  return new RegExp(`^${corps}$`);
}

function normaliserAppel(chemin: string): string {
  return chemin
    .slice(PREFIXE.length)
    .replace(/\$\{[^}]*\}/g, 'X')   // un gabarit vaut un segment quelconque
    .replace(/\/$/, '') || '/';
}

describe('Routes super-admin appelées par l\'interface', () => {
  const appels = cheminsAppeles();
  const routes = routesDeclarees();

  it('le test voit bien les deux côtés', () => {
    // Garde-fou : s'il ne trouve plus rien, il ne prouverait plus rien.
    expect(appels.length).toBeGreaterThan(5);
    expect(routes.length).toBeGreaterThan(5);
  });

  it('écarte les routes commentées', () => {
    // La mécanique qui avait manqué : une route en commentaire ne répond pas.
    const source = readFileSync(join(RACINE, 'server', 'super-admin-routes.ts'), 'utf8');
    const commentees = source.split('\n')
      .filter((l) => l.trim().startsWith('//') && /router\.(get|post)\(/.test(l));
    for (const ligne of commentees) {
      const chemin = ligne.match(/router\.\w+\(\s*['"]([^'"]+)['"]/)?.[1];
      if (chemin) {
        expect({ chemin, declaree: routes.some((r) => r.chemin === chemin) })
          .toEqual({ chemin, declaree: false });
      }
    }
  });

  it('chaque route appelée existe réellement côté serveur', () => {
    const expressions = routes.map((r) => enExpression(r.chemin));
    const manquantes = appels
      .filter(({ chemin }) => !expressions.some((e) => e.test(normaliserAppel(chemin))))
      .map(({ chemin, fichier }) => `${chemin}  (appelée depuis ${fichier})`);

    expect([...new Set(manquantes)]).toEqual([]);
  });
});
