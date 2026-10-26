/**
 * Le corps de la requête ne choisit jamais le locataire — garde-fou statique.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST PLUTÔT QU'UNE LISTE DE ROUTES CORRIGÉES
 * ═══════════════════════════════════════════════════════════════════
 * L'examen du 2026-10-26 (docs/EXAMEN_LISTES_BLANCHES.md) a trouvé onze
 * écritures où le corps de la requête pouvait désigner le locataire, dans deux
 * formes :
 *
 *   • `.set({ ...updates })` avec `updates = req.body` — la clause `WHERE`
 *     cloisonne la ligne qu'on ATTEINT, jamais la valeur qu'on y écrit. Une
 *     ligne pouvait donc SORTIR de son entreprise ;
 *   • `insertXSchema.parse(req.body)` sans surcharge — ces schémas dérivent de
 *     `createInsertSchema(table)` et contiennent `tenantId`, si bien qu'une
 *     ligne pouvait NAÎTRE chez une autre entreprise.
 *
 * Toutes ont été corrigées. Mais onze corrections protègent du passé : rien
 * n'empêche la douzième. Et le défaut est invisible au code de retour — dans
 * les quatre cas mesurés, la réponse était un **403** posé par le filet
 * anti-fuite sur la RÉPONSE, après que l'écriture soit commise. Un test
 * d'intégration qui n'observe que le statut reste vert sur une fuite réelle.
 *
 * ═══════════════════════════════════════════════════════════════════
 * LES TROIS FORMES ACCEPTÉES, ET POURQUOI
 * ═══════════════════════════════════════════════════════════════════
 *   1. **le type l'interdit** — `Partial<Omit<…, "tenantId">>`, ou une table
 *      sans colonne locataire. C'est la protection la plus forte : le
 *      typecheck refuse l'APPELANT, pas seulement la valeur. Ces cas sont
 *      nommés dans `PROTEGES_PAR_LE_TYPE` ;
 *   2. **l'extraction** — `const { tenantId: _…, ...x } = entrée;` avant
 *      l'écriture, la forme employée par `updateAlert` et généralisée depuis ;
 *   3. **un schéma Zod** — un `z.object({…}).parse()` RETIRE les clés
 *      inconnues, donc la charge écrite ne peut pas contenir `tenantId`… à
 *      condition que le schéma ne le déclare pas lui-même. C'est l'objet du
 *      dernier bloc de ce fichier : sans lui, « ça vient d'un schéma »
 *      deviendrait une échappatoire.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..');
const DOSSIER_SERVEUR = join(RACINE, 'server');

const fichiersServeur = readdirSync(DOSSIER_SERVEUR)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ nom: f, chemin: join(DOSSIER_SERVEUR, f) }));

/** Les lignes de code d'un fichier, commentaires exclus, numérotées. */
function lignesDeCode(contenu: string): Array<{ n: number; texte: string }> {
  let dansBloc = false;
  const sorties: Array<{ n: number; texte: string }> = [];
  contenu.split('\n').forEach((brute, i) => {
    const texte = brute.trim();
    if (dansBloc) {
      if (texte.includes('*/')) dansBloc = false;
      return;
    }
    if (texte.startsWith('/*')) {
      if (!texte.includes('*/')) dansBloc = true;
      return;
    }
    if (texte.startsWith('//') || texte.startsWith('*')) return;
    if (texte.length === 0) return;
    sorties.push({ n: i + 1, texte });
  });
  return sorties;
}

describe('Le balayage lit bien les sources', () => {
  it('trouve les fichiers du serveur', () => {
    // Sans ce témoin, un dossier renommé rendrait tout le reste vert sur rien.
    expect(fichiersServeur.length).toBeGreaterThan(30);
    const routes = fichiersServeur.find((f) => f.nom === 'gmao-routes.ts');
    expect(routes).toBeDefined();
    expect(lignesDeCode(readFileSync(routes!.chemin, 'utf8')).length).toBeGreaterThan(1000);
  });
});

describe('Le corps ne peut pas écraser le locataire de la session', () => {
  it('aucune construction `{ tenantId, ...req.body }`', () => {
    // L'ordre décide : le locataire de confiance doit venir APRÈS l'épandage.
    // Cette forme-ci le place avant, donc le corps gagne.
    const fautifs: string[] = [];
    for (const { nom, chemin } of fichiersServeur) {
      for (const { n, texte } of lignesDeCode(readFileSync(chemin, 'utf8'))) {
        if (/\{\s*tenantId[^}]*\.\.\.\s*(req\.)?body/.test(texte)) {
          fautifs.push(`${nom}:${n} → ${texte.slice(0, 90)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('aucun épandage DIRECT du corps dans une écriture', () => {
    // `.set({ ...req.body })` / `.values({ ...req.body })` écrit tout champ
    // reçu, `tenantId` compris.
    const fautifs: string[] = [];
    for (const { nom, chemin } of fichiersServeur) {
      for (const { n, texte } of lignesDeCode(readFileSync(chemin, 'utf8'))) {
        if (/\.(set|values)\(\s*\{\s*\.\.\.\s*req\.body/.test(texte)) {
          fautifs.push(`${nom}:${n} → ${texte.slice(0, 90)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });
});

/**
 * Les écritures dont le TYPE exclut déjà `tenantId`. Chacune a été constatée
 * en tentant d'y ajouter l'extraction : le typecheck l'a refusée, parce qu'il
 * n'y a rien à retirer. Motif consigné pour que la liste ne devienne pas un
 * tapis sous lequel on balaie.
 */
const PROTEGES_PAR_LE_TYPE: Record<string, string> = {
  'gmao-storage.ts:updatePurchaseOrder': 'Partial<Omit<…, "tenantId">>',
  'gmao-storage.ts:updateReorderRule': 'InsertReorderRule ne porte pas de locataire',
  'gmao-storage.ts:updateCompanyConfig': 'Partial<Omit<…, "tenantId">>',
  'storage.ts:updateAdaptiveLearning': 'table `adaptive_learning` sans colonne locataire',
};

describe('Toute écriture qui épand une entrée est protégée', () => {
  for (const { nom, chemin } of fichiersServeur) {
    const code = lignesDeCode(readFileSync(chemin, 'utf8'));
    const epandages = code
      .map((l, i) => ({ ...l, i }))
      .filter(({ texte }) => /\.set\(\s*\{\s*\.\.\.\s*[A-Za-z_]/.test(texte));
    if (epandages.length === 0) continue;

    it(`${nom} : chaque \`.set({ ...x })\` est couvert`, () => {
      const fautifs: string[] = [];

      for (const { n, texte, i } of epandages) {
        const variable = texte.match(/\.set\(\s*\{\s*\.\.\.\s*([A-Za-z_][A-Za-z0-9_]*)/)?.[1] ?? '';

        // On remonte à la méthode (ou 40 lignes) : une protection posée
        // ailleurs dans le fichier ne couvre pas cette écriture.
        //
        // ⚠️ Un `^nom(` naïf prend `if (`, `for (` et `catch (` pour des
        // déclarations : la fenêtre démarrait alors APRÈS la protection, et
        // quatre écritures parfaitement couvertes étaient signalées — dont
        // celles exemptées par le type, que la clé « …:if » ne retrouvait pas.
        const MOTS_DE_CONTROLE = new Set([
          'if', 'for', 'while', 'switch', 'catch', 'return', 'await', 'do', 'else',
        ]);
        // `function` fait partie des préfixes à consommer : sans lui,
        // `async function executerCloture(` ne correspondait pas, la détection
        // retombait sur le `eq(` d'une clause Drizzle, et la fenêtre démarrait
        // SOUS la protection. La fenêtre est portée à 60 lignes, car un
        // commentaire d'explication peut séparer la garde de l'écriture.
        const PORTEE = 60;
        let debut = Math.max(0, i - PORTEE);
        let methode = '';
        for (let j = i; j >= Math.max(0, i - PORTEE); j--) {
          const m = code[j].texte.match(
            /^(?:(?:async|export|private|public|function)\s+)*([A-Za-z_][A-Za-z0-9_]*)\s*\(/,
          );
          if (m && !MOTS_DE_CONTROLE.has(m[1]) && !code[j].texte.includes('=>')) {
            debut = j; methode = m[1]; break;
          }
        }
        if (PROTEGES_PAR_LE_TYPE[`${nom}:${methode}`]) continue;

        const amont = code.slice(debut, i).map((l) => l.texte).join('\n');

        // Forme 2 : l'extraction du locataire. On reconnaît l'IDIOME
        // `tenantId: _nom` — un renommage vers un identifiant préfixé `_`
        // n'existe que pour écarter délibérément la clé. Exiger en plus que le
        // `...reste` suive immédiatement était trop rigide : la clôture écarte
        // aussi `id`, donc un second champ s'intercale.
        const extrait = /tenantId\s*:\s*_[A-Za-z0-9_]*/.test(amont);
        // Forme 3 : la variable sort d'un schéma Zod (qui retire l'inconnu).
        const vient = variable.replace(/\..*$/, '');
        const duSchema = new RegExp(
          `(const|let)\\s+${vient}\\s*=\\s*[^;]*\\.(parse|safeParse)\\(`,
        ).test(amont) || /\.data\b/.test(texte);
        // Et le cas d'une charge construite sur place par le serveur.
        const surPlace = new RegExp(`(const|let)\\s+${vient}\\s*[:=]\\s*\\{`).test(amont);

        if (!extrait && !duSchema && !surPlace) {
          fautifs.push(`${nom}:${n} (épand \`${variable}\`, méthode \`${methode}\`)`);
        }
      }
      expect(fautifs).toEqual([]);
    });
  }
});

describe('Toute création impose le locataire de la session', () => {
  /**
   * `insertXSchema.parse(X)` est sans danger si le locataire de la session est
   * présent — soit injecté dans l'appel, soit porté par `X` construit juste
   * avant, soit imposé juste après. On regarde donc des deux côtés.
   */
  for (const { nom, chemin } of fichiersServeur) {
    const code = lignesDeCode(readFileSync(chemin, 'utf8'));
    const creations = code
      .map((l, i) => ({ ...l, i }))
      .filter(({ texte }) => /insert[A-Za-z]+Schema\.(parse|safeParse)\(/.test(texte));
    if (creations.length === 0) continue;

    it(`${nom} : chaque création impose le locataire`, () => {
      const fautifs: string[] = [];
      for (const { n, texte, i } of creations) {
        const schema = texte.match(/(insert[A-Za-z]+Schema)/)?.[1] ?? '';
        const argument = texte.match(/\.(?:parse|safeParse)\(\s*([A-Za-z_][A-Za-z0-9_]*)/)?.[1];

        const apres = code.slice(i, i + 6).map((l) => l.texte).join('\n');
        // En amont : la construction de l'argument porte-t-elle le locataire ?
        const amont = code.slice(Math.max(0, i - 25), i).map((l) => l.texte).join('\n');
        const argumentCloisonne = argument
          ? new RegExp(`${argument}(\\.tenantId\\s*=|\\s*=\\s*\\{[^;]*tenantId)`, 's').test(amont)
          : false;

        if (!/tenantId/.test(apres) && !argumentCloisonne) {
          fautifs.push(`${nom}:${n} (${schema}) → ${texte.slice(0, 80)}`);
        }
      }
      expect(fautifs).toEqual([]);
    });
  }
});

describe("« ça vient d'un schéma » n'est pas une échappatoire", () => {
  /**
   * La forme 3 ci-dessus ne vaut que si le schéma employé ne déclare pas
   * `tenantId`. Sans cette vérification, il suffirait d'un schéma trop large
   * pour rouvrir la porte en gardant le test vert.
   */
  const SCHEMAS_DE_MISE_A_JOUR: Array<[string, string]> = [
    ['shared/schema.ts', 'miseAJourEquipementSchema'],
    ['shared/schema.ts', 'miseAJourPermisSchema'],
    ['server/smm-routes.ts', 'DocumentSchema'],
    ['server/smm-routes.ts', 'NonConformityUpdateSchema'],
    ['server/smm-routes.ts', 'ImprovementActionUpdateSchema'],
  ];

  for (const [fichier, nomSchema] of SCHEMAS_DE_MISE_A_JOUR) {
    it(`${nomSchema} ne déclare pas \`tenantId\``, () => {
      const source = readFileSync(join(RACINE, fichier), 'utf8');
      const debut = source.indexOf(`const ${nomSchema} =`);
      expect(debut).toBeGreaterThan(-1);

      // Borné à la déclaration : lu trop large, l'extrait accuserait le voisin.
      const fin = source.indexOf('\n});', debut);
      const bloc = source.slice(debut, fin > -1 ? fin : debut + 1200);

      // Témoin : le motif doit discriminer, sinon l'assertion ne dit rien.
      expect(/^\s*[A-Za-z_]+\s*:/m.test(bloc)).toBe(true);

      // ⚠️ `tenantId: true` dans une liste `.omit({ … })` le RETIRE du schéma :
      // c'est l'inverse d'une déclaration. Un motif naïf accusait donc
      // `miseAJourPermisSchema`, qui est précisément construit par omission.
      const omisExplicitement = /\.omit\(\s*\{[^}]*tenantId\s*:\s*true/s.test(bloc);
      const declareCommeChamp = /^\s*tenantId\s*:\s*(?!true)/m.test(bloc);

      expect(declareCommeChamp && !omisExplicitement).toBe(false);
    });
  }
});
