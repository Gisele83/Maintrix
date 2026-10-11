/**
 * L'interface invente-t-elle des chiffres quand les données manquent ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Le tableau de bord GMAO affichait une courbe d'activité fournie à un
 * locataire qui n'avait **rien saisi**. Deux mécanismes :
 *
 *   • des séries entièrement constantes — cinq mois sur six pour l'évolution
 *     des ordres de travail, douze sur douze pour la répartition
 *     préventif/correctif ;
 *   • des valeurs de repli du type `donnee?.champ || 45`. Or `0` est falsy :
 *     le chiffre fabriqué n'apparaissait QUE lorsque la vraie valeur était
 *     zéro, c'est-à-dire exactement dans le cas où il trompe.
 *
 * Ailleurs : MTBF 168,5 h, MTTR 4,2 h, disponibilité 94,7 %, OEE 87,3 %,
 * utilisation budgétaire 25 %, score de conformité réglementaire 90 %. Des
 * mesures de performance inventées, sur un outil destiné à des industriels qui
 * l'évaluent. Signalé le 2026-10-11.
 *
 * Règle retenue : une donnée absente s'affiche comme absente. Jamais comme un
 * nombre plausible.
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

const fichiers = sources(join(RACINE, 'client', 'src'));

describe('Aucun chiffre inventé en l\'absence de données', () => {
  it('le test parcourt bien l\'interface', () => {
    expect(fichiers.length).toBeGreaterThan(50);
  });

  it('aucune valeur de repli numérique derrière un accès optionnel', () => {
    // `donnee?.champ || 42` : le 42 ne sort que si la vraie valeur vaut 0.
    // C'est le motif exact qui montrait une activité à un parc vide.
    // `?? 0` reste permis : zéro n'invente rien.
    // `|| 0` n'invente rien : zéro est une absence honnête. Seul un repli NON
    // NUL fabrique une valeur, et il ne sort QUE lorsque la vraie vaut zéro.
    // Le 1 est écarté aussi : c'est la garde habituelle contre une division
    // par zéro, pas un chiffre montré à quelqu'un.
    const motif = /\?\.[\w.?[\]]+\s*\|\|\s*(?![01]\b)\d+(\.\d+)?/;
    const fautifs: string[] = [];

    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (motif.test(texte)) {
          fautifs.push(`${fichier.replace(RACINE, '').replace(/\\/g, '/')}:${n} → ${texte.trim().slice(0, 100)}`);
        }
      }
    }

    expect(fautifs).toEqual([]);
  });

  it('les indicateurs de performance ne portent plus de valeurs fabriquées', () => {
    // Ces six nombres étaient affichés comme des mesures. Ils ne doivent
    // réapparaître nulle part dans l'interface.
    const inventes = ['168.5', '94.7', '87.3', '4.2'];
    const fautifs: string[] = [];

    for (const fichier of fichiers) {
      const contenu = readFileSync(fichier, 'utf8');
      if (!/mtbf|mttr|availability|oee|overallScore/i.test(contenu)) continue;
      for (const { n, texte } of lignesDeCode(contenu)) {
        for (const valeur of inventes) {
          if (texte.includes(valeur)) {
            fautifs.push(`${fichier.replace(RACINE, '').replace(/\\/g, '/')}:${n} → ${valeur}`);
          }
        }
      }
    }

    expect(fautifs).toEqual([]);
  });

  it('le tableau de bord GMAO ne contient plus de série mensuelle constante', () => {
    const contenu = readFileSync(join(RACINE, 'client', 'src', 'pages', 'gmao-dashboard.tsx'), 'utf8');

    // Un objet { mois: 'Xxx', … : <nombre littéral> } est une donnée inventée :
    // les vraies séries viennent du serveur.
    const motif = /\{\s*mois:\s*'[^']+',\s*\w+:\s*\d+/;
    const fautifs = lignesDeCode(contenu)
      .filter(({ texte }) => motif.test(texte))
      .map(({ n, texte }) => `gmao-dashboard.tsx:${n} → ${texte.trim().slice(0, 80)}`);

    expect(fautifs).toEqual([]);
  });

  it('les séries du tableau de bord viennent bien du serveur', () => {
    const client = readFileSync(join(RACINE, 'client', 'src', 'pages', 'gmao-dashboard.tsx'), 'utf8');
    expect(client).toContain('dashboardData?.evolution');

    // Et le serveur les produit réellement, locataire par locataire.
    const routes = readFileSync(join(RACINE, 'server', 'gmao-routes.ts'), 'utf8');
    expect(routes).toContain('getEvolutionMensuelle');

    const storage = readFileSync(join(RACINE, 'server', 'gmao-storage.ts'), 'utf8');
    // On découpe jusqu'à la méthode SUIVANTE : s'arrêter à la première
    // accolade fermante ne retiendrait que la signature, et le test croirait
    // à tort que le filtre par locataire manque.
    const depart = storage.indexOf('async getEvolutionMensuelle');
    const suivante = storage.indexOf('\n  async ', depart + 10);
    const methode = depart < 0 ? null
      : [storage.slice(depart, suivante > 0 ? suivante : undefined)];
    expect(methode).not.toBeNull();
    // Le cloisonnement n'est pas optionnel : sans ce filtre, un locataire
    // verrait l'activité des autres.
    expect(methode![0]).toContain('eq(workOrders.tenantId, tenantId)');
  });
});
