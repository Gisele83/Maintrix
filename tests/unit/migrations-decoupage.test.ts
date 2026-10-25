/**
 * Le marqueur de séparation d'instructions apparaît-il là où il ne doit pas ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CETTE SUITE EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * `drizzle-kit` découpe chaque fichier de migration sur le texte
 * `--> statement-breakpoint`, et il le fait PARTOUT où ce texte apparaît —
 * y compris au milieu d'un commentaire, y compris entre des accents graves.
 *
 * Mesuré le 2026-10-25. La migration 0022 contenait, dans son en-tête, une
 * phrase qui CITAIT le marqueur pour expliquer que psql l'ignore. drizzle a
 * coupé le fichier à cet endroit : le morceau suivant commençait par
 * `` ` sont des commentaires SQL… ``, c'est-à-dire du français, et PostgreSQL a
 * répondu « syntax error at or near "`" ».
 *
 * Conséquences, et c'est pour elles que ce test existe :
 *
 *   • `drizzle-kit migrate` échouait DE BOUT EN BOUT — zéro table créée, sur
 *     une base vierge. Un déploiement par cette voie ne produisait pas une base
 *     incomplète : il ne produisait rien.
 *   • `psql -f` passait sans broncher, parce que le marqueur n'est qu'un
 *     commentaire pour lui. Les deux outils ne lisaient donc pas le même
 *     fichier, et la vérification faite avec le second ne disait rien du premier.
 *   • drizzle n'affiche pas le message : la sortie se limite à
 *     « applying migrations... », et seul le code de retour 1 signale l'échec.
 *
 * Le défaut a été introduit APRÈS le passage de `scripts/verify-migrations.mjs`
 * sur ce lot-là, et avant la fusion. La barrière existait et aurait attrapé la
 * faute ; elle n'a simplement pas été rejouée après la dernière retouche. Ce
 * test-ci, lui, tourne dans la voie unitaire — sans Docker, sans base — donc à
 * chaque exécution de `npm test`.
 *
 * ⚠️ Ce fichier CONTIENT NÉCESSAIREMENT le marqueur, puisqu'il le traque. Il
 * n'inspecte que `migrations/`, où le marqueur a un sens d'exécution.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DOSSIER = join(__dirname, '..', '..', 'migrations');
const MARQUEUR = '--> statement-breakpoint';

const fichiers = readdirSync(DOSSIER).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();

/** Les lignes où le marqueur apparaît, et sous quelle forme. */
function occurrences(contenu: string) {
  return contenu
    .split(/\r?\n/)
    .map((ligne, i) => ({ ligne, numero: i + 1 }))
    .filter(({ ligne }) => ligne.includes(MARQUEUR));
}

describe("Découpage des migrations par drizzle-kit", () => {
  it('il y a bien des migrations à inspecter', () => {
    // Garde-fou anti-faux-vert : un dossier mal résolu rendrait une liste vide
    // et tous les cas suivants passeraient sans avoir rien lu.
    expect(fichiers.length).toBeGreaterThan(20);
  });

  it.each(fichiers)('%s — le marqueur termine une instruction, jamais une phrase', (fichier) => {
    /*
     * ⚠️ Première règle écrite ici : « le marqueur est SEUL sur sa ligne ».
     * Elle était FAUSSE, et la mesure l'a montrée tout de suite — 9 fichiers
     * rouges, dont la migration de base. `drizzle-kit` génère lui-même le
     * marqueur COLLÉ après le point-virgule :
     *     ALTER TABLE … ON UPDATE no action;--> statement-breakpoint
     * (124 lignes de cette forme dans 0000). Interdire cette forme aurait
     * obligé à réécrire des migrations déjà déployées pour satisfaire un test,
     * c'est-à-dire exactement l'inverse de ce qu'un garde-fou doit faire.
     *
     * La vraie invariante est plus simple : à gauche du marqueur, soit rien,
     * soit la fin d'une instruction (`;`). Jamais du texte.
     */
    const contenu = readFileSync(join(DOSSIER, fichier), 'utf8');

    const fautives = occurrences(contenu)
      .filter(({ ligne }) => {
        const avant = ligne.slice(0, ligne.indexOf(MARQUEUR)).trim();
        return avant !== '' && !avant.endsWith(';');
      })
      .map(({ numero, ligne }) => `${fichier}:${numero}  ${ligne.trim().slice(0, 100)}`);

    expect(fautives).toEqual([]);
  });

  it.each(fichiers)('%s — aucun morceau ne commence par autre chose que du SQL', (fichier) => {
    /*
     * Contrôle du RÉSULTAT du découpage, et non de sa forme : on reproduit la
     * coupe de drizzle et on regarde ce que PostgreSQL recevrait. Chaque
     * morceau non vide doit commencer par un mot-clé SQL ou par un commentaire,
     * jamais par un fragment de phrase.
     *
     * Le cas précédent couvrirait déjà l'incident de 2026-10-25 ; celui-ci
     * reste parce qu'il énonce ce qui compte vraiment — la forme n'est qu'un
     * moyen — et attraperait une coupe fautive née autrement.
     */
    const contenu = readFileSync(join(DOSSIER, fichier), 'utf8');
    const morceaux = contenu.split(MARQUEUR);

    const fautifs: string[] = [];
    morceaux.forEach((morceau, i) => {
      const utile = morceau
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('--'))
        .join(' ')
        .trim();
      if (!utile) return; // morceau de pur commentaire : inoffensif
      if (!/^[A-Za-z_"(]/.test(utile)) {
        fautifs.push(`${fichier}, morceau ${i + 1}/${morceaux.length} commence par : ${utile.slice(0, 90)}`);
      }
    });

    expect(fautifs).toEqual([]);
  });

  it('le découpage de 0022 produit bien les morceaux attendus', () => {
    // Cas nommé sur le fichier qui a porté le défaut : sans lui, une future
    // réécriture de l'en-tête pourrait réintroduire la coupe sans que personne
    // ne se souvienne de l'incident.
    const contenu = readFileSync(join(DOSSIER, '0022_company_config_tenant_scoped.sql'), 'utf8');
    const morceaux = contenu.split(MARQUEUR);

    expect(morceaux).toHaveLength(4);
    expect(morceaux[0]).toContain('ALTER TABLE "company_config" ADD COLUMN');
    expect(morceaux[1]).toContain('DO $$');
    expect(morceaux[3]).toContain('ADD CONSTRAINT');
  });
});
