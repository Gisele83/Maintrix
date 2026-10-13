/**
 * Une grandeur absente le reste-t-elle en traversant les modules ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Les cinq volets précédents ont rendu plusieurs grandeurs légitimement
 * ABSENTES : MTBF sous deux pannes, OEE sans production, taux sans
 * dénominateur, IRS sans historique de perturbation. C'est un progrès — mais
 * il crée un risque nouveau, et c'est celui que ce volet traque : une absence
 * qui redevient zéro en changeant de module.
 *
 * Le cas était déjà là, et il a servi d'avertissement : le MTBF était
 * enregistré à NULL, puis relu par `parseFloat(x?.toString() ?? "0")`. Deux
 * modules, deux conventions, et le mensonge rétabli en une ligne — « tombe en
 * panne en permanence » au lieu de « pas assez de pannes pour conclure ».
 *
 * Trois propriétés sont épinglées ici :
 *   1. aucun module ne reconvertit une absence en zéro ;
 *   2. les documents qui CIRCULENT — PDF, CSV — savent écrire « N/D » ;
 *   3. les pondérations composites somment à 1, quelle que soit la branche.
 *
 * Constaté et corrigé le 2026-10-13.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..');

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) return sources(chemin);
    return entree.endsWith('.ts') ? [chemin] : [];
  });
}

function lignesDeCode(contenu: string): Array<{ n: number; texte: string }> {
  let dansBloc = false;
  return contenu.split('\n').map((texte, i) => ({ n: i + 1, texte })).filter(({ texte }) => {
    const t = texte.trim();
    if (dansBloc) { if (t.includes('*/')) dansBloc = false; return false; }
    if (t.startsWith('/*')) { if (!t.includes('*/')) dansBloc = true; return false; }
    return !t.startsWith('//') && !t.startsWith('*');
  });
}

/** Les grandeurs qui peuvent légitimement ne pas exister. */
const GRANDEURS_FAILLIBLES = [
  'mtbf', 'mttr', 'oee', 'availability', 'reliability',
  'performanceScore', 'preventiveCompliance', 'tauxResolution', 'tauxPreventif',
];

describe('Une absence ne redevient pas un zéro', () => {
  const fichiers = sources(join(RACINE, 'server'));

  it('le test voit bien le serveur', () => {
    expect(fichiers.length).toBeGreaterThan(50);
  });

  it('aucune grandeur faillible n\'est relue avec un repli à zéro', () => {
    // `?? "0"` et `|| 0` sur une de ces grandeurs rétablissent exactement le
    // défaut qu'on vient de retirer, et le font dans un AUTRE module — donc
    // hors de vue de celui qui a posé l'absence.
    const motif = new RegExp(
      `\\b(${GRANDEURS_FAILLIBLES.join('|')})\\b[^;\\n]*(\\?\\?\\s*["']?0["']?|\\|\\|\\s*0\\b)`,
      'i',
    );
    const fautifs: string[] = [];

    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (motif.test(texte)) {
          const relatif = fichier.replace(RACINE, '').split('\\').join('/');
          fautifs.push(`${relatif}:${n} → ${texte.trim().slice(0, 90)}`);
        }
      }
    }

    expect(fautifs).toEqual([]);
  });

  it('les documents qui circulent savent écrire « N/D »', () => {
    // Un PDF ou un CSV quitte l'écran : il est ouvert dans un tableur, recopié
    // dans une présentation, envoyé à un client. Y imprimer « 0,0 » là où rien
    // n'a été mesuré affirme une performance nulle.
    for (const f of ['pdf-generator-functional.ts', 'pdf-generator-client-side.ts', 'routes.ts']) {
      const contenu = readFileSync(join(RACINE, 'server', f), 'utf8');
      expect({ fichier: f, saitDireND: /N\/D/.test(contenu) })
        .toEqual({ fichier: f, saitDireND: true });
    }
  });
});

describe('IMCA — le composite porte ses propres réserves', () => {
  const source = readFileSync(join(RACINE, 'server', 'imca-engine.ts'), 'utf8');

  it('les pondérations somment à 1 dans chaque branche', () => {
    // Une branche dont les poids ne somment pas à 1 décale tout le composite,
    // sans qu'aucun test fonctionnel ne le révèle : le nombre reste plausible.
    const branches = [...source.matchAll(
      /\{\s*ISD:\s*([\d.]+),\s*IDC:\s*([\d.]+),\s*ISO:\s*([\d.]+),\s*IRS:\s*([\d.]+)\s*\}/g)];
    expect(branches.length).toBeGreaterThanOrEqual(3);

    for (const b of branches) {
      const somme = Number(b[1]) + Number(b[2]) + Number(b[3]) + Number(b[4]);
      expect({ branche: b[0].replace(/\s+/g, ' '), somme: Math.round(somme * 100) / 100 })
        .toEqual({ branche: b[0].replace(/\s+/g, ' '), somme: 1 });
    }
  });

  it('`hasMaintenance` est réellement utilisé dans la pondération', () => {
    // Il était déclaré, calculé, transmis — et jamais lu. Or sans historique
    // de maintenance l'IRS retombe sur sa valeur par défaut, tout en pesant
    // jusqu'à 0,40 : le cas où il vaut le moins était celui où on lui donnait
    // le plus de poids.
    const fonction = source.match(/function adaptiveWeights[\s\S]*?\n\}/)![0];
    expect(fonction).toMatch(/dataQuality\.hasMaintenance/);
  });

  it('le composite expose la part estimée et ses réserves', () => {
    // Sans ces deux champs, « IMCA 68 — à surveiller » se lit comme un
    // résultat alors qu'il peut reposer en partie sur une convention.
    expect(source).toMatch(/partEstimee/);
    expect(source).toMatch(/reserves/);
    expect(source).toMatch(/irsResult\.estime/);
  });
});
