/**
 * L'expéditeur du test peut-il encore venir du navigateur ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Les deux écrans de test d'envoi — la page /email-diagnostic ET le tableau de
 * bord super-admin, qui en possède une copie — laissaient saisir l'adresse
 * d'expédition, avec « votre-email@gmail.com » et « test@example.com » pour
 * valeurs par défaut.
 *
 * SendGrid refuse par un 403 tout message dont le « from » n'est pas une
 * identité vérifiée. Le test échouait donc sur un environnement parfaitement
 * configuré, et l'on en concluait que SendGrid était en panne. Le test
 * lui-même était mal posé. Constaté le 2026-10-08.
 *
 * L'expéditeur vient désormais de SENDGRID_FROM_EMAIL, côté serveur. Ce test
 * échoue si un écran se remet à le transmettre — y compris un troisième écran
 * ajouté plus tard.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..');

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree);
    return statSync(chemin).isDirectory() ? sources(chemin)
      : /\.tsx?$/.test(entree) ? [chemin] : [];
  });
}

/** Les lignes de code, commentaires exclus — ils citent le défaut d'origine. */
function lignesDeCode(contenu: string): Array<{ n: number; texte: string }> {
  let dansBloc = false;
  return contenu.split('\n').map((texte, i) => ({ n: i + 1, texte })).filter(({ texte }) => {
    const t = texte.trim();
    if (dansBloc) { if (t.includes('*/')) dansBloc = false; return false; }
    if (t.startsWith('/*') || t.startsWith('{/*')) { if (!t.includes('*/')) dansBloc = true; return false; }
    return !t.startsWith('//') && !t.startsWith('*');
  });
}

describe("Expéditeur imposé par le serveur", () => {
  const fichiersClient = sources(join(RACINE, 'client', 'src'));

  it('aucun écran ne transmet « fromEmail »', () => {
    const fautifs: string[] = [];
    for (const fichier of fichiersClient) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (/\bfromEmail\b/.test(texte)) {
          fautifs.push(`${fichier.replace(RACINE, '').replace(/\\/g, '/')}:${n} → ${texte.trim()}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('aucune adresse d\'exemple ne subsiste comme valeur par défaut', () => {
    // Ces trois-là étaient pré-remplies et garantissaient un refus.
    const pieges = ['votre-email@gmail.com', 'votre-nom@gmail.com', 'test@example.com'];
    const fautifs: string[] = [];
    for (const fichier of fichiersClient) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        for (const piege of pieges) {
          if (texte.includes(piege)) {
            fautifs.push(`${fichier.replace(RACINE, '').replace(/\\/g, '/')}:${n} → ${piege}`);
          }
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("le serveur n'offre aucun moyen de choisir l'expéditeur", () => {
    const service = readFileSync(join(RACINE, 'server', 'email-service.ts'), 'utf8');
    // Un seul paramètre : le destinataire. Un second ouvrirait la porte.
    expect(service).toMatch(
      /export async function envoyerCourrielDeTest\(destinataire: string\): Promise<ResultatCourrielTest>/);

    const routes = readFileSync(join(RACINE, 'server', 'super-admin-routes.ts'), 'utf8');
    const litExpediteur = lignesDeCode(routes)
      .filter(({ texte }) => /req\.body[?.\[]*\s*\.?\s*['"]?fromEmail/.test(texte));
    expect(litExpediteur).toEqual([]);
  });
});
