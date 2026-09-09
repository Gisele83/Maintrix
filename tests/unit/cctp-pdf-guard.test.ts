/**
 * Génération PDF des bons de commande — barrières de régression, F11.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CES BARRIÈRES EXISTENT
 * ═══════════════════════════════════════════════════════════════════
 * `GET /api/cctp/tenant/:id/purchase-order/:id/document` renvoyait 500 pour
 * tout le monde. Une fois Chromium installé dans l'image, la route a révélé
 * **quatre** défauts empilés, chacun masquant le suivant :
 *
 *   1. Aucun navigateur dans l'image → « Could not find Chrome ».
 *   2. `--single-process` et `--no-zygote` font crasher Chromium moderne au
 *      démarrage → « Target closed ».
 *   3. `tenants.purchase_order_config` vaut `{}` et non NULL : le garde
 *      `if (!config)` laissait passer une configuration vide, et la génération
 *      plantait sur `config.companyHeader.name`.
 *   4. `page.pdf()` renvoie un `Uint8Array` depuis Puppeteer 23, et non un
 *      `Buffer`. Express le sérialisait en JSON : HTTP **200**, en-tête
 *      `application/pdf`, 537 Ko… contenant `{"0":37,"1":80,…}`.
 *
 * Le quatrième est le plus instructif : statut correct, type MIME correct,
 * taille plausible, **contenu faux**. Aucun contrôle portant sur le code de
 * retour ne l'aurait vu — il a fallu ouvrir le fichier.
 *
 * Ces défauts ne sont pas testables en intégration : le harnais local n'a pas
 * de Chromium (il n'existe que dans l'image). Ces barrières visent donc la
 * forme du code, là où chaque régression se produirait.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Retire les commentaires avant toute recherche de motif.
 *
 * Indispensable : les commentaires de ces fichiers CITENT les constructions
 * fautives pour expliquer pourquoi elles ont été retirées. Sans ce nettoyage,
 * la barrière signalait sa propre documentation comme une régression — un faux
 * positif qui aurait fini par la faire désactiver.
 */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')   // blocs /* … */
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); // lignes // … (le [^:] épargne les URL)
}

const lire = (f: string) => sansCommentaires(readFileSync(join(__dirname, '..', '..', 'server', f), 'utf8'));

describe('F11 — Génération PDF des bons de commande', () => {
  const routes = lire('cctp-routes.ts');
  const service = lire('cctp-compliance-system.ts');

  it('le fichier de routes contient bien l\'appel à Puppeteer', () => {
    // Sans cette assertion, un renommage ferait passer toutes les suivantes
    // par simple absence de motif — un faux vert.
    expect(routes).toMatch(/puppeteer/);
    expect(routes).toMatch(/page\.pdf\(/);
  });

  it('aucun drapeau qui fait crasher Chromium au démarrage', () => {
    const INTERDITS = ['--single-process', '--no-zygote'];
    const presents = INTERDITS.filter(d => new RegExp(`'${d}'`).test(routes));

    expect(presents.length === 0 ? '' :
      `Drapeau(x) réintroduit(s) : ${presents.join(', ')}\n` +
      'Chromium meurt avant que Puppeteer ne s\'y attache : ' +
      '« Protocol error (Target.setDiscoverTargets): Target closed ».',
    ).toBe('');
  });

  it('le PDF est renvoyé en Buffer, jamais en Uint8Array brut', () => {
    // `res.send(uint8Array)` produit un JSON avec un statut 200 et un en-tête
    // application/pdf : le testeur télécharge un .pdf que rien n'ouvre.
    expect(routes).toMatch(/res\.send\(\s*Buffer\.from\(/);

    const envoiNu = /res\.send\(\s*pdfBuffer\s*\)/.test(routes);
    expect(envoiNu ? 'res.send(pdfBuffer) sans Buffer.from — le PDF partirait sérialisé en JSON' : '')
      .toBe('');
  });

  it('une configuration vide est refusée avec le message prévu', () => {
    // `purchase_order_config` vaut `{}` par défaut pour tout nouveau locataire.
    // Un simple `if (!config)` ne l'attrape pas.
    expect(service).toMatch(/companyHeader\?\.name/);
  });

  it('les montants « numeric » sont normalisés avant tout .toFixed', () => {
    // node-postgres renvoie les colonnes numeric en CHAÎNE : `.toFixed` sur
    // `order.totalAmount` lève « toFixed is not a function ».
    const brut = /order\.totalAmount\s*\?\.\s*toFixed/.test(service);
    expect(brut ? 'order.totalAmount?.toFixed() — totalAmount est une chaîne, pas un nombre' : '')
      .toBe('');
    expect(service).toMatch(/const montantHT = Number\(/);
  });
});
