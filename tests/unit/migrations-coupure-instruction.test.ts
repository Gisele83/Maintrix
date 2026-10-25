/**
 * Le marqueur de coupure d'instruction apparaît-il là où il ne doit pas ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CETTE SUITE EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * `drizzle-kit migrate` découpe chaque fichier de migration sur la chaîne
 * littérale `-->` suivie de ` statement-breakpoint`, PARTOUT où elle apparaît —
 * y compris dans un commentaire SQL. Son découpeur ne distingue pas la
 * directive de la prose.
 *
 * Mesuré le 2026-10-25, en fusionnant `origin/main` : un commentaire de
 * `migrations/0022_company_config_tenant_scoped.sql` citait le marqueur entre
 * apostrophes inverses pour EXPLIQUER comment relire une migration échouée avec
 * psql. Le fichier était donc coupé au milieu de cette phrase, et le morceau
 * suivant — du texte de commentaire sans son `--` d'ouverture — partait à
 * PostgreSQL comme une instruction. Conséquence :
 *
 *     drizzle-kit migrate  →  exit 1, « applying migrations... », 0 table créée
 *
 * Donc TOUTE la chaîne de déploiement par `migrate` était cassée, pour toutes
 * les migrations, par une phrase d'explication. Le comble : ce commentaire
 * était là pour aider à diagnostiquer une migration qui échoue.
 *
 * Le défaut était invisible par deux chemins à la fois :
 *
 *   • `psql -f` applique le fichier sans broncher — un `--` reste un
 *     commentaire pour psql, donc le relevé manuel passe ;
 *   • `drizzle-kit push`, celui des tests, part du schéma TypeScript et ne lit
 *     jamais les fichiers de migration ;
 *   • `npm run verify:migrations`, qui l'aurait vu, exige Docker et ne tourne
 *     pas sur les postes de développement.
 *
 * Trois voies vertes, et la seule voie de déploiement rouge.
 *
 * ═══════════════════════════════════════════════════════════════════
 * LA RÈGLE, ET CELLE QU'IL NE FAUT PAS ÉCRIRE
 * ═══════════════════════════════════════════════════════════════════
 * Première rédaction de ce test : « le marqueur n'a droit qu'à une forme, seul
 * sur sa ligne ». Mesuré — 172 violations dans `0000_baseline_84_tables.sql`,
 * toutes légitimes : drizzle génère lui-même `ALTER TABLE … ;` suivi du
 * marqueur SUR LA MÊME LIGNE. La règle était fausse, et c'est le relevé qui l'a
 * dit.
 *
 * La règle juste porte sur le seul cas qui casse : le marqueur DANS un
 * commentaire. Une ligne qui commence par `--` sans être le marqueur lui-même
 * n'a pas à le contenir — c'est une mention en prose, et drizzle y coupe.
 *
 * Et comme une règle de forme peut toujours laisser passer une variante, le
 * troisième cas mesure la CONSÉQUENCE : après découpage, aucun morceau ne doit
 * commencer en pleine prose.
 *
 * Ce test ne remplace pas `verify:migrations` (qui compare les deux schémas
 * obtenus) : il attrape ce cas précis sans Docker, donc avant le déploiement.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..');
const DOSSIER = join(RACINE, 'migrations');

/**
 * Le marqueur, assemblé à l'exécution.
 *
 * ⚠️ VOLONTAIREMENT PAS ÉCRIT EN UN SEUL MORCEAU. Ce fichier n'est pas une
 * migration, donc drizzle ne le lit pas — mais écrire le marqueur en clair ici
 * ferait de ce test l'exemple de ce qu'il interdit, et le premier à le copier
 * dans une migration reproduirait le défaut.
 */
const MARQUEUR = '--' + '> ' + 'statement-breakpoint';

const fichiers = readdirSync(DOSSIER)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();

describe("Le marqueur de coupure n'est jamais cité dans un commentaire", () => {
  it('le balayage atteint bien les migrations', () => {
    // Sans cette vérification, un dossier renommé rendrait la suite verte et
    // muette — le même piège de portée que celui relevé dans
    // tests/unit/aucun-chiffre-invente.test.ts.
    expect(fichiers.length).toBeGreaterThan(20);
  });

  it('aucune migration ne cite le marqueur dans un commentaire', () => {
    const fautifs: string[] = [];

    for (const fichier of fichiers) {
      const lignes = readFileSync(join(DOSSIER, fichier), 'utf8').split('\n');
      lignes.forEach((ligne, i) => {
        const nue = ligne.trim();
        if (!nue.includes(MARQUEUR)) return;
        // Le marqueur seul : c'est la directive. Permis.
        if (nue === MARQUEUR) return;
        // `ALTER TABLE … ;--> statement-breakpoint` : forme générée par drizzle
        // dans 0000_baseline_84_tables.sql, 172 fois. Permise.
        if (!nue.startsWith('--')) return;
        // Reste : une ligne de commentaire qui CITE le marqueur. C'est le
        // défaut — drizzle y coupe, et le morceau suivant part en SQL.
        fautifs.push(`${fichier}:${i + 1} → ${nue.slice(0, 100)}`);
      });
    }

    expect(fautifs).toEqual([]);
  });

  it('découper sur le marqueur ne produit aucun morceau commençant en pleine prose', () => {
    /*
     * Le contrôle de forme ci-dessus suffit pour le défaut rencontré. Celui-ci
     * mesure la CONSÉQUENCE, et attrape donc aussi les variantes qu'une règle
     * de forme laisserait passer : après découpage, un morceau dont la première
     * ligne non vide n'est ni un commentaire `--`, ni le début plausible d'une
     * instruction SQL, est du texte envoyé à PostgreSQL.
     */
    const DEBUTS = /^(ALTER|CREATE|DROP|UPDATE|INSERT|DELETE|SELECT|DO|SET|BEGIN|COMMIT|WITH|GRANT|REVOKE|COMMENT|TRUNCATE|ANALYZE|VACUUM|CALL)\b/i;
    const fautifs: string[] = [];

    for (const fichier of fichiers) {
      const contenu = readFileSync(join(DOSSIER, fichier), 'utf8');
      const morceaux = contenu.split(MARQUEUR);
      morceaux.forEach((morceau, index) => {
        const premiere = morceau.split('\n').map((l) => l.trim()).find((l) => l.length > 0);
        if (!premiere) return;                       // morceau vide : sans effet
        if (premiere.startsWith('--')) return;       // commentaire : inoffensif
        if (DEBUTS.test(premiere)) return;           // instruction : attendu
        fautifs.push(`${fichier} [morceau ${index + 1}/${morceaux.length}] → ${premiere.slice(0, 100)}`);
      });
    }

    expect(fautifs).toEqual([]);
  });
});
