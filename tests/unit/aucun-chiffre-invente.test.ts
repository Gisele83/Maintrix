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

  it("aucune valeur n'est tirée au sort pour être affichée", () => {
    // Pire qu'une constante : une valeur aléatoire CHANGE à chaque affichage,
    // ce qui la fait passer pour vivante. On en a trouvé quatre : un calendrier
    // qui semait des interventions environ trois jours sur dix, un historique
    // de capteur sur 24 h, des tendances MTBF/MTTR/disponibilité, et un export
    // CSV dont les chiffres étaient tirés au sort à chaque clic — un fichier
    // qui quitte l'écran et devient une pièce.
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      // `components/ui/` ne contient que les primitives du système de design —
      // boutons, cartes, squelettes de chargement. Rien n'y est une mesure : la
      // largeur aléatoire d'une barre de chargement ne trompe personne.
      if (/[\\/]components[\\/]ui[\\/]/.test(fichier)) continue;
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (!/Math\.random/.test(texte)) continue;
        // Un identifiant tiré au sort ne trompe personne : il ne s'affiche pas
        // comme une mesure.
        if (/toString\(36\)|key=|uuid|randomId/i.test(texte)) continue;
        const relatif = fichier.replace(RACINE, '').split('\\').join('/');
        fautifs.push(`${relatif}:${n} → ${texte.trim().slice(0, 70)}`);
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

describe('Aucun chiffre de performance écrit en clair dans le JSX', () => {
  /*
   * Le garde-fou précédent traque les valeurs de REPLI (`donnee?.champ || 42`)
   * et les séries constantes. Il ne voyait pas un troisième motif, plus
   * grossier : le chiffre écrit directement dans le balisage.
   *
   * Trouvé le 20/10/2026 en harmonisant les écrans de rapports :
   *
   *   • `advanced-reporting.tsx` — une carte « Tendances de Performance »
   *     entière : « Coûts Maintenance ↓ 12 % », « Temps d'Arrêt ↓ 8 % »,
   *     « Interventions Préventives ↑ 15 % », « Satisfaction Client 96 %,
   *     Score NPS ». La plateforme ne collecte ni tendance mensuelle ni NPS ;
   *   • `tenant-management.tsx` — « 847 diagnostics ce mois », « 2.3k
   *     interventions totales », « 94 % de taux de résolution », affichés à
   *     l'identique pour chaque locataire, et « Conformité RGPD 100 % ».
   *
   * Un pourcentage écrit en dur ne lève aucune erreur, ne dépend d'aucune
   * donnée, et se lit exactement comme une mesure.
   */
  it('aucun pourcentage littéral n\'est rendu comme une mesure', () => {
    // `>96%<`, `>↓ 12%<` : un nœud de texte JSX qui ne contient qu'un nombre
    // suivi de `%`, éventuellement précédé d'une flèche de tendance.
    const POURCENTAGE_LITTERAL = />\s*[↑↓→]?\s*\d+([.,]\d+)?\s*%\s*</;
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (POURCENTAGE_LITTERAL.test(texte)) {
          fautifs.push(`${fichier.replace(RACINE, '')}:${n} → ${texte.trim().slice(0, 70)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('aucun effectif littéral n\'est rendu comme une mesure', () => {
    /*
     * « 847 », « 2.3k » : trois chiffres ou plus, ou un suffixe k/M, seuls
     * dans un nœud de texte. Les petits nombres sont exclus : un « 0 » ou un
     * « 1 » littéral est presque toujours une légende, pas une statistique.
     */
    const EFFECTIF_LITTERAL = />\s*(\d{3,}|\d+([.,]\d+)?\s*[kKmM])\s*</;
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        // Les années et les codes HTTP ne sont pas des mesures inventées.
        if (/\b(19|20)\d{2}\b|\b(200|201|204|301|302|400|401|403|404|409|422|429|500|503)\b/.test(texte)) continue;
        if (EFFECTIF_LITTERAL.test(texte)) {
          fautifs.push(`${fichier.replace(RACINE, '')}:${n} → ${texte.trim().slice(0, 70)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });
});

describe('Le SERVEUR non plus ne fabrique de verdict de conformité', () => {
  /*
   * ⚠️ LE TROU DE CE GARDE-FOU, TROUVÉ LE 25/10/2026.
   *
   * Les blocs ci-dessus ne balaient que `client/src`, plus `gmao-routes.ts` et
   * `gmao-storage.ts` nommément. Or le pire chiffre inventé du dépôt était
   * SERVEUR : `GET /api/cctp/tenant/:id/cctp-compliance/report` rendait un
   * document HTML entièrement écrit en dur — « Score: 90% » et dix verdicts de
   * conformité rédigés à la main, identiques pour tous les locataires.
   *
   * L'en-tête de ce fichier cite pourtant « score de conformité réglementaire
   * 90 % » parmi les défauts qui l'ont fait naître : le motif était connu, et
   * c'est la PORTÉE du balayage qui le laissait passer. Un rapport imprimable
   * est la pièce qu'un industriel oppose à un donneur d'ordre ; deux de ses
   * affirmations étaient fausses, dont « Isolation tenant par RLS PostgreSQL »
   * alors que ce dépôt cloisonne en code applicatif.
   *
   * ⚠️ Tout ce bloc passe par `lignesDeCode()`, et ce n'est pas une précaution
   * de style : les commentaires de `cctp-routes.ts` CITENT les chaînes fautives
   * pour expliquer le défaut. Un garde-fou qui lirait la prose punirait
   * l'explication du défaut au lieu du défaut.
   */
  const ROUTES_SERVEUR = sources(join(RACINE, 'server'))
    .filter((f) => /routes?\.ts$|report|rapport|conformite|compliance/i.test(f));

  it('le balayage atteint bien les fichiers de routes du serveur', () => {
    expect(ROUTES_SERVEUR.length).toBeGreaterThan(5);
    expect(ROUTES_SERVEUR.some((f) => /cctp-routes\.ts$/.test(f))).toBe(true);
  });

  it('aucun score de conformité écrit en dur dans un document servi', () => {
    // « Score: 90% », « Conformité 100 % », « score global : 90% » : un libellé
    // de notation suivi d'un nombre littéral, dans une chaîne que le serveur
    // envoie. Le nombre doit venir d'un calcul, jamais du source.
    const SCORE_LITTERAL = /(score|conformit[ée]|compliance)[^\n]{0,20}?[:>]\s*\d{1,3}\s*%/i;
    const fautifs: string[] = [];
    for (const fichier of ROUTES_SERVEUR) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (SCORE_LITTERAL.test(texte)) {
          fautifs.push(`${fichier.replace(RACINE, '').split('\\').join('/')}:${n} → ${texte.trim().slice(0, 90)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("le relevé de conformité CCTP n'écrit aucun verdict en dur", () => {
    const fichier = join(RACINE, 'server', 'cctp-routes.ts');
    const code = lignesDeCode(readFileSync(fichier, 'utf8')).map((l) => l.texte).join('\n');

    // Un état d'exigence posé littéralement dans la route : c'est exactement
    // ce que faisaient `validationWorkflow` et `tenantIsolation`.
    expect(code).not.toMatch(/status:\s*['"]compliant['"]/);
    expect(code).not.toMatch(/score:\s*100\b/);

    // Et la fausse déclaration la plus grave : ce dépôt n'a jamais eu de RLS.
    expect(code).not.toMatch(/RLS/);

    // Le relevé vient du service, qui le MESURE.
    expect(code).toContain('releverConformite');
  });

  it('les exigences non mesurables sont rendues sans note, et non à 100', () => {
    const service = readFileSync(join(RACINE, 'server', 'cctp-compliance-system.ts'), 'utf8');
    const code = lignesDeCode(service).map((l) => l.texte).join('\n');

    // `non_mesure` existe comme état, et il est employé.
    expect(code).toMatch(/['"]non_mesure['"]/);

    // Le score global ne moyenne que les exigences notées : une exigence sans
    // note ne doit pas peser 100 dans la moyenne, c'était le mécanisme du
    // « 90 % ».
    expect(code).toContain('e.score !== null');

    // Et le cloisonnement n'est plus déclaré conforme par ce relevé : il est
    // renvoyé vers ce qui le vérifie réellement.
    expect(code).toMatch(/cloisonnementParLocataire/);
    expect(code).toMatch(/isolation-\*\.test\.ts|0011 à 0023/);
  });
});
