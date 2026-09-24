/**
 * L'interface compare-t-elle encore les rôles à la main ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Le référentiel `shared/roles.ts` a été créé pour le serveur, mais cinq
 * endroits de l'interface continuaient à comparer `user.role` à une chaîne
 * littérale. Deux conséquences mesurées :
 *
 *   • `/system-health` refusait l'accès au rôle `owner` — le compte principal
 *     de chaque organisation, donc précisément la personne qui surveille sa
 *     propre plateforme — parce que `role !== "admin"` est vrai pour lui ;
 *   • la liste des comptes affichait « Utilisateur » pour sept rôles sur neuf :
 *     un directeur technique et un magasinier y étaient indiscernables.
 *
 * Une comparaison littérale ne lève jamais d'erreur : elle refuse ou elle
 * étiquette de travers, en silence. Ce test relit les sources de l'interface
 * et échoue si le motif réapparaît, y compris dans un fichier neuf.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..', 'client', 'src');

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) return sources(chemin);
    return /\.tsx?$/.test(entree) ? [chemin] : [];
  });
}

/**
 * `user.role === "admin"`, `profile?.role !== 'owner'`… quel que soit le
 * préfixe, l'espacement ou le type de guillemets.
 */
const COMPARAISON_LITTERALE =
  /\b[A-Za-z_$][\w$]*\??\.role\s*[!=]==?\s*["'`][^"'`]+["'`]/g;

describe('Rôles dans l\'interface', () => {
  it('aucune comparaison littérale de rôle ne subsiste', () => {
    const fautifs: string[] = [];

    for (const fichier of sources(RACINE)) {
      const contenu = readFileSync(fichier, 'utf8');
      for (const occurrence of contenu.match(COMPARAISON_LITTERALE) ?? []) {
        const ligne = contenu.slice(0, contenu.indexOf(occurrence)).split('\n').length;
        fautifs.push(`${fichier.replace(RACINE, 'client/src')}:${ligne} → ${occurrence}`);
      }
    }

    expect(fautifs).toEqual([]);
  });

  it('le référentiel est bien importable depuis le client', () => {
    // L'alias `@shared` doit résoudre : une erreur ici casse la compilation
    // de toutes les pages corrigées.
    const config = readFileSync(join(__dirname, '..', '..', 'vite.config.ts'), 'utf8');
    expect(config).toMatch(/@shared/);
  });
});
