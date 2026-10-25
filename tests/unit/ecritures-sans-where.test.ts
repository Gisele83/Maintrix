/**
 * Reste-t-il un `UPDATE` ou un `DELETE` qui ne dit pas SUR QUOI il porte ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CETTE SUITE EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * `createCompanyConfig()` désactivait les configurations existantes ainsi :
 *
 *     await db.update(companyConfig).set({ isActive: false });   // aucun WHERE
 *
 * Une ligne. Aucune erreur, aucun avertissement, aucun test rouge — et chaque
 * locataire qui enregistrait SA configuration d'entreprise éteignait celle de
 * TOUS les autres de l'instance, puis devenait la seule ligne active. Sa raison
 * sociale, son adresse et son numéro fiscal étaient ensuite imprimés sur les
 * bons de commande de tout le monde.
 *
 * Ce défaut a survécu parce que personne ne l'avait CHERCHÉ. Une écriture sans
 * portée ne se distingue d'une écriture correcte que par une absence, et une
 * absence ne se relit pas : elle se mesure. Cette suite la mesure.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QU'ELLE VOIT, ET CE QU'ELLE NE VOIT PAS
 * ═══════════════════════════════════════════════════════════════════
 * Elle lit les SOURCES, pas la base : aucun serveur, aucun PostgreSQL. Elle
 * consomme l'expression chaînée complète (parenthèses équilibrées) plutôt que
 * la ligne, car ces chaînes Drizzle s'écrivent sur cinq ou six lignes et un
 * `.where()` arrive souvent plus bas.
 *
 * ANGLE MORT ASSUMÉ — le SQL brut. `db.execute(sql\`UPDATE … \`)` et
 * `pool.query('DELETE FROM …')` échappent à l'expression ci-dessous. Le
 * recensement du 2026-10-25 a passé les 54 occurrences candidates une par une :
 * toutes portent un `WHERE … tenant_id = $n`, ou visent `rate_limits` — table
 * sans locataire, purgée volontairement par l'outillage de test. Les énoncer
 * ici évite de prendre cette suite pour une garantie qu'elle ne donne pas ;
 * c'est la leçon de tests/unit/filet-anti-fuite.test.ts.
 *
 * Si un jour cette suite devient rouge sur un fichier neuf, les deux seules
 * issues acceptables sont : ajouter la clause manquante, ou documenter ici
 * POURQUOI la table concernée n'a pas de portée. Allonger la liste sans la
 * phrase qui l'explique, c'est rouvrir le défaut.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const RACINE = join(__dirname, '..', '..');
const DOSSIERS = ['server', 'shared', 'scripts', 'tests', 'client'];

/**
 * Ce fichier-ci s'exclut de son propre recensement : il CITE les motifs qu'il
 * traque (dans son en-tête, dans la liste des tolérances, dans ses messages
 * d'échec) et se signalait donc lui-même. C'est la seule exclusion par nom de
 * fichier, et elle ne masque aucune écriture réelle — ce fichier n'ouvre aucune
 * connexion.
 */
const SOI_MEME = 'tests/unit/ecritures-sans-where.test.ts';

/**
 * Les écritures sans portée TOLÉRÉES, avec la raison de chacune.
 *
 * ⚠️ Une entrée ici affirme « cette table n'a pas de locataire, et la vider
 * entièrement est l'intention ». Rien d'autre ne justifie une entrée.
 */
const TOLEREES: ReadonlyArray<{ fichier: string; table: string; pourquoi: string }> = [
  {
    fichier: 'server/module-initializer.ts',
    table: 'moduleCatalog',
    pourquoi:
      "`module_catalog` est le catalogue de modules de la PLATEFORME : il ne porte aucune " +
      'colonne `tenant_id` (voir shared/schema.ts) et vaut pour tous les locataires. ' +
      "`initializeModuleCatalog()` le vide puis le réinsère à chaque démarrage du serveur, " +
      "dans une transaction. Le vider en entier est donc l'intention, pas un oubli.",
  },
];

interface Ecriture {
  fichier: string;
  ligne: number;
  methode: 'update' | 'delete';
  chaine: string;
}

function sources(dossier: string): string[] {
  let entrees: string[];
  try {
    entrees = readdirSync(dossier);
  } catch {
    return [];
  }
  return entrees.flatMap((entree) => {
    if (entree === 'node_modules' || entree === 'dist') return [];
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) return sources(chemin);
    return /\.tsx?$/.test(entree) ? [chemin] : [];
  });
}

/**
 * Fin de l'expression chaînée commencée par `.update(` / `.delete(`.
 *
 * On avance de maillon en maillon (`.set(…)`, `.where(…)`, `.returning()`) en
 * équilibrant les parenthèses et en sautant les chaînes littérales, et on
 * s'arrête quand ce qui suit la dernière parenthèse fermante n'est plus un
 * appel. Découper à la ligne ou au `;` aurait raté la moitié des cas.
 */
function finDeChaine(src: string, debut: number): number {
  const ECHAP = String.fromCharCode(92);
  let i = debut;
  while (i < src.length && src[i] === '(') {
    let profondeur = 0;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '(') profondeur++;
      else if (c === ')') {
        profondeur--;
        if (profondeur === 0) { i++; break; }
      } else if (c === '"' || c === "'" || c === '`') {
        const quote = c;
        i++;
        while (i < src.length && src[i] !== quote) {
          if (src[i] === ECHAP) i++;
          i++;
        }
      }
    }
    let j = i;
    while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] !== '.') break;
    let k = j + 1;
    while (k < src.length && /[A-Za-z0-9_$]/.test(src[k])) k++;
    let m = k;
    while (m < src.length && /\s/.test(src[m])) m++;
    if (src[m] !== '(') break;
    i = m;
  }
  return i;
}

/** `db`, `tx`, `trx`… : les receveurs qui désignent une connexion. */
const RECEVEUR = /\b(db|tx|trx|trans|database|conn|client)\s*$/;

/**
 * Le source avec ses COMMENTAIRES blanchis, longueur et retours à la ligne
 * conservés (les numéros de ligne restent donc justes).
 *
 * ⚠️ Mesuré en écrivant cette suite : sans ce blanchiment, elle se déclarait
 * rouge sur `server/gmao-storage.ts` — non pas à cause du code, mais du
 * COMMENTAIRE qui cite le défaut d'origine pour l'expliquer. Un garde-fou qui
 * ne distingue pas le code de la prose punit la documentation : chaque
 * explication d'un défaut corrigé recréerait une alerte, et la seule façon de
 * revenir au vert serait de supprimer l'explication.
 *
 * Les chaînes littérales sont traversées sans être blanchies — une URL
 * `http://…` ne doit pas être prise pour un commentaire de ligne.
 */
function sansCommentaires(src: string): string {
  const ECHAP = String.fromCharCode(92);
  const out = src.split('');
  let i = 0;
  const blanchir = (de: number, a: number) => {
    for (let k = de; k < a && k < out.length; k++) {
      if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
    }
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === ECHAP) i++;
        i++;
      }
      i++;
    } else if (c === '/' && src[i + 1] === '/') {
      const fin = src.indexOf('\n', i);
      blanchir(i, fin === -1 ? src.length : fin);
      i = fin === -1 ? src.length : fin;
    } else if (c === '/' && src[i + 1] === '*') {
      const fin = src.indexOf('*/', i + 2);
      const a = fin === -1 ? src.length : fin + 2;
      blanchir(i, a);
      i = a;
    } else {
      i++;
    }
  }
  return out.join('');
}

function recenser(): Ecriture[] {
  const trouvees: Ecriture[] = [];
  for (const dossier of DOSSIERS) {
    for (const fichier of sources(join(RACINE, dossier))) {
      const relatif = relative(RACINE, fichier).split(sep).join('/');
      if (relatif === SOI_MEME) continue;
      const src = sansCommentaires(readFileSync(fichier, 'utf8'));
      const motif = /\.(update|delete)\s*\(/g;
      let m: RegExpExecArray | null;
      while ((m = motif.exec(src)) !== null) {
        if (!RECEVEUR.test(src.slice(Math.max(0, m.index - 40), m.index))) continue;
        const ouvrante = src.indexOf('(', m.index);
        const chaine = src.slice(m.index, finDeChaine(src, ouvrante));
        if (/\.where\s*\(/.test(chaine)) continue;
        trouvees.push({
          fichier: relatif,
          ligne: src.slice(0, m.index).split('\n').length,
          methode: m[1] as 'update' | 'delete',
          chaine: chaine.replace(/\s+/g, ' ').slice(0, 160),
        });
      }
    }
  }
  return trouvees;
}

const ECRITURES = recenser();

const estToleree = (e: Ecriture) =>
  TOLEREES.some((t) => t.fichier === e.fichier && e.chaine.includes(t.table));

// ═══════════════════════════════════════════════════════════════════
describe('Aucune écriture Drizzle sans clause where', () => {
  it("le recensement a bien lu les sources (sinon il ne prouve rien)", () => {
    // Garde-fou anti-faux-vert, repris de scripts/verify-migrations.mjs : si le
    // parcours de fichiers échouait, la liste serait vide et TOUS les cas
    // suivants passeraient sans avoir rien mesuré. On vérifie donc d'abord que
    // la mesure fonctionne, sur un motif dont on sait qu'il existe.
    const fichiers = DOSSIERS.flatMap((d) => sources(join(RACINE, d)));
    expect(fichiers.length).toBeGreaterThan(300);

    const avecWhere = fichiers.filter((f) => /\.where\s*\(/.test(readFileSync(f, 'utf8')));
    expect(avecWhere.length).toBeGreaterThan(20);

    // Et le recensement voit bien des écritures : s'il n'en trouvait AUCUNE,
    // les cas ci-dessous seraient verts faute d'avoir regardé.
    const fichiersAvecEcriture = new Set(
      DOSSIERS.flatMap((d) => sources(join(RACINE, d)))
        .filter((f) => /\b(?:db|tx)\s*\.?\s*\n?\s*\.?(?:update|delete)\s*\(/.test(
          sansCommentaires(readFileSync(f, 'utf8')),
        )),
    );
    expect(fichiersAvecEcriture.size).toBeGreaterThan(3);
  });

  it("le blanchiment des commentaires garde le code et jette la prose", () => {
    // Ce cas protège le garde-fou de lui-même : un `sansCommentaires` trop
    // gourmand blanchirait aussi du code, la liste des écritures tomberait à
    // zéro, et la suite entière passerait au vert sans rien vérifier.
    const echantillon = [
      '// db.update(table).set({ a: 1 })        <- prose, à ignorer',
      '/* db.delete(table) dans un bloc         <- prose, à ignorer */',
      'const url = "http://exemple.test/a";  // la chaîne survit',
      'await db.update(vraieTable).set({ a: 1 });',
    ].join('\n');

    const net = sansCommentaires(echantillon);

    expect(net).toContain('db.update(vraieTable)');
    expect(net).toContain('http://exemple.test/a');
    expect(net).not.toContain('prose, à ignorer');
    // Les lignes sont conservées : les numéros rapportés restent exacts.
    expect(net.split('\n')).toHaveLength(echantillon.split('\n').length);
  });

  it("aucun `db.update(...)` ne part sans portée", () => {
    const fautives = ECRITURES.filter((e) => e.methode === 'update' && !estToleree(e));
    expect(fautives.map((e) => `${e.fichier}:${e.ligne}  ${e.chaine}`)).toEqual([]);
  });

  it("aucun `db.delete(...)` ne part sans portée", () => {
    const fautives = ECRITURES.filter((e) => e.methode === 'delete' && !estToleree(e));
    expect(fautives.map((e) => `${e.fichier}:${e.ligne}  ${e.chaine}`)).toEqual([]);
  });

  it('les écritures tolérées sont toujours là, et pas une de plus', () => {
    // Sans ce cas, une tolérance resterait inscrite après la disparition du code
    // qu'elle couvre, et accorderait silencieusement un passe-droit à un futur
    // `db.delete(moduleCatalog)` posé ailleurs dans le même fichier.
    const tolerees = ECRITURES.filter(estToleree);
    expect(tolerees).toHaveLength(TOLEREES.length);
    for (const t of TOLEREES) {
      expect(tolerees.some((e) => e.fichier === t.fichier && e.chaine.includes(t.table))).toBe(true);
      expect(t.pourquoi.length).toBeGreaterThan(80);
    }
  });

  it("la désactivation des configurations d'entreprise porte bien sur un seul locataire", () => {
    // Le défaut d'origine, visé nommément. Le cas générique ci-dessus le
    // couvrirait, mais il passerait aussi si `createCompanyConfig` disparaissait
    // ou cessait de désactiver quoi que ce soit — or c'est cette désactivation
    // précise qui doit rester bornée : sans elle, deux configurations actives
    // coexisteraient chez un même locataire et `getCompanyConfig()` en
    // choisirait une au hasard.
    const src = readFileSync(join(RACINE, 'server', 'gmao-storage.ts'), 'utf8');
    const debut = src.indexOf('async createCompanyConfig');
    expect(debut).toBeGreaterThan(0);

    const corps = src.slice(debut, src.indexOf('async updateCompanyConfig', debut));
    expect(corps).toMatch(/isActive:\s*false/);
    expect(corps).toMatch(/\.where\(eq\(companyConfig\.tenantId,\s*tenantId\)\)/);
  });
});
