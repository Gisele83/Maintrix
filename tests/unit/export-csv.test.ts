/**
 * Un export CSV survit-il aux données réelles ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Les cinq exports de Maintrix écrivaient `"${valeur || ''}"`. Trois défauts
 * dans une seule expression, sur des fichiers destinés à circuler.
 *
 * 1. GUILLEMETS NON ÉCHAPPÉS. La RFC 4180 exige de doubler les guillemets
 *    internes. Une référence comme « Pompe 5" BSP » cassait la structure du
 *    fichier : les colonnes suivantes se décalaient d'une cellule. Le fichier
 *    s'ouvrait sans la moindre erreur — simplement faux.
 *
 * 2. LE ZÉRO DEVENAIT VIDE. `valeur || ''` efface un 0 légitime : un coût de
 *    0 € et un coût inconnu devenaient indiscernables.
 *
 * 3. INJECTION DE FORMULE. Une cellule commençant par =, +, - ou @ est
 *    interprétée comme une formule à l'ouverture dans un tableur. Une donnée
 *    saisie par un utilisateur pouvait donc s'exécuter chez le destinataire.
 *
 * Constaté le 2026-10-13.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..');

/** La fonction telle qu'elle est écrite dans la source, évaluée ici. */
function celluleCsvDeLaSource(): (v: unknown) => string {
  const source = readFileSync(join(RACINE, 'server', 'data-import-export.ts'), 'utf8');
  const depart = source.indexOf('function celluleCsv(');
  if (depart < 0) throw new Error('celluleCsv introuvable');

  let profondeur = 0;
  let i = source.indexOf('{', depart);
  for (; i < source.length; i += 1) {
    if (source[i] === '{') profondeur += 1;
    else if (source[i] === '}') { profondeur -= 1; if (profondeur === 0) break; }
  }
  const corps = source.slice(depart, i + 1)
    .replace(/: unknown\)/, ')')
    .replace(/\): string \{/, ') {');

  // eslint-disable-next-line no-new-func
  return new Function(`${corps}; return celluleCsv;`)();
}

describe('Échappement des cellules CSV', () => {
  const cellule = celluleCsvDeLaSource();

  it('double les guillemets internes, comme l\'exige la RFC 4180', () => {
    // Le cas qui cassait tout : une cote en pouces dans une désignation.
    expect(cellule('Pompe 5" BSP')).toBe('"Pompe 5"" BSP"');
  });

  it('préserve un zéro légitime', () => {
    // `valeur || ''` rendait une cellule vide : 0 € et « inconnu » devenaient
    // le même chose dans un export comptable.
    expect(cellule(0)).toBe('"0"');
    expect(cellule(0.0)).toBe('"0"');
  });

  it('distingue l\'absence du vide', () => {
    expect(cellule(null)).toBe('""');
    expect(cellule(undefined)).toBe('""');
    expect(cellule('')).toBe('""');
  });

  it('neutralise les formules', () => {
    for (const dangereux of ['=1+1', '=SUM(A1:A9)', '+33612345678', '@import']) {
      expect({ valeur: dangereux, echappe: cellule(dangereux).startsWith('"\'') })
        .toEqual({ valeur: dangereux, echappe: true });
    }
  });

  it('laisse les nombres négatifs rester des nombres', () => {
    // Les préfixer d'une apostrophe les transformerait en texte, et une
    // colonne de coûts cesserait d'être sommable.
    expect(cellule(-5)).toBe('"-5"');
    // Un « + » initial, lui, reste du texte : « +33612345678 » serait sinon lu
    // comme le nombre 33612345678 et perdrait son indicatif téléphonique.
    expect(cellule('+33612345678')).toBe(`"'+33612345678"`);
    expect(cellule('-1250.75')).toBe('"-1250.75"');
    // En revanche « - » suivi de texte est bien une saisie suspecte.
    expect(cellule('-ceci=1+1')).toBe('"\'-ceci=1+1"');
  });

  it('entoure sans altérer les séparateurs et les sauts de ligne', () => {
    expect(cellule('a,b')).toBe('"a,b"');
    expect(cellule('ligne1\nligne2')).toBe('"ligne1\nligne2"');
  });

  it('une ligne entière reste lisible après échappement', () => {
    // Trois colonnes, dont une contenant un guillemet et une virgule : sans
    // doublement, l'analyseur en voyait cinq.
    const ligne = ['Pompe 5" BSP', 'Zone A, niveau 2', 0]
      .map((v) => cellule(v)).join(',');

    // Découpage conforme à la RFC : on doit retrouver exactement trois champs.
    const champs = ligne.match(/"(?:[^"]|"")*"/g) ?? [];
    expect(champs).toHaveLength(3);
  });
});

describe('Aucun export ne contourne l\'échappement', () => {
  it('les cinq sérialisations passent par celluleCsv', () => {
    const source = readFileSync(join(RACINE, 'server', 'data-import-export.ts'), 'utf8');

    // Le motif d'origine ne doit plus exister nulle part.
    const brutes = source.split('\n')
      .map((texte, i) => ({ n: i + 1, texte }))
      .filter(({ texte }) => /headers\.map\(header =>\s*`"/.test(texte))
      .map(({ n, texte }) => `ligne ${n} → ${texte.trim().slice(0, 80)}`);

    expect(brutes).toEqual([]);
    expect((source.match(/celluleCsv\(/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });
});
