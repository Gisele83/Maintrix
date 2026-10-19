/**
 * Garde-fous de la refonte UX/UI — étape B.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Trois familles de défauts ont été corrigées le 19/10/2026, et les trois
 * sont INVISIBLES à la relecture du code :
 *
 *   • une classe Tailwind jamais déclarée produit le même `className` dans
 *     la source qu'une classe valide. Les 159 occurrences de
 *     `text-carbon-*` ne généraient aucune règle CSS : sur le tableau de
 *     bord, les trois niveaux d'urgence « Faible », « Moyen » et « Élevé »
 *     s'affichaient dans la même encre ;
 *   • un fragment de dégradé (`from-red-500 to-rose-600`) sans le
 *     `bg-gradient-to-*` qui l'activerait ne pose aucun fond : les tuiles
 *     d'état se retrouvaient toutes de la même teinte ;
 *   • un chiffre écrit en dur ressemble en tout point à un chiffre calculé.
 *
 * Et une quatrième, visible mais passée inaperçue des années durant : la
 * barre de défilement de l'application était un dégradé bleu → violet,
 * alors que la charte proscrit les dégradés.
 *
 * Ces vérifications sont statiques — elles lisent la source. Le contrôle
 * de ce qui est RÉELLEMENT rendu (couleur composée, contraste) se fait au
 * navigateur ; voir docs/audit-ux/AUDIT_UX_UI.md.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..');
const CLIENT = join(RACINE, 'client', 'src');

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree);
    return statSync(chemin).isDirectory() ? sources(chemin)
      : /\.tsx?$/.test(entree) ? [chemin] : [];
  });
}

/**
 * Les lignes de code, commentaires exclus. Indispensable ici : les
 * commentaires de la refonte CITENT les valeurs supprimées pour expliquer
 * pourquoi elles l'ont été. Sans ce filtre, le test se déclencherait sur
 * sa propre documentation.
 */
function lignesDeCode(contenu: string): Array<{ n: number; texte: string }> {
  let dansBloc = false;
  return contenu.split('\n').map((texte, i) => ({ n: i + 1, texte })).filter(({ texte }) => {
    const t = texte.trim();
    if (dansBloc) { if (t.includes('*/')) dansBloc = false; return false; }
    if (t.startsWith('/*') || t.startsWith('{/*')) { if (!t.includes('*/')) dansBloc = true; return false; }
    return !t.startsWith('//') && !t.startsWith('*');
  });
}

const relatif = (f: string) => f.replace(RACINE, '').split('\\').join('/');
const fichiers = sources(CLIENT);

/** Les trois écrans refondus à l'étape B. */
const ECRANS_PRIORITAIRES = [
  join(CLIENT, 'pages', 'dashboard.tsx'),
  join(CLIENT, 'pages', 'gmao-dashboard.tsx'),
  join(CLIENT, 'pages', 'maintenance-engineering-platform.tsx'),
];

describe('Classes de couleur réellement générées', () => {
  it('le test parcourt bien l\'interface', () => {
    expect(fichiers.length).toBeGreaterThan(50);
  });

  it('aucune classe `text-carbon-*` ne subsiste : elle ne produit aucune règle CSS', () => {
    // `index.css` déclarait `.carbon-x` et `.bg-carbon-x`, jamais
    // `.text-carbon-x`. Tailwind ne les connaît pas davantage — elles ne
    // figurent pas dans `tailwind.config.ts`. Résultat : l'élément héritait
    // simplement de la couleur de son parent.
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (/\b(text|border)-carbon-/.test(texte)) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 90)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('la palette `--carbon-*` a disparu de la feuille de style', () => {
    // Deux palettes complètes en parallèle de la charte, c'était une
    // invitation permanente à piocher dans la mauvaise.
    // Les commentaires sont retirés d'abord : celui qui documente la
    // suppression cite forcément le nom de ce qui a été supprimé.
    const css = readFileSync(join(CLIENT, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/--carbon-/);
  });

  it('les jetons d\'état sont des chaînes littérales, jamais interpolées', () => {
    // Tailwind analyse le code SOURCE sans exécuter le JavaScript : une
    // classe assemblée (`bg-etat-${registre}-fond`) n'est jamais générée, et
    // l'élément reste transparent sans que rien ne le signale.
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (/\b(bg|text|border)-(etat|ink|paper|signal|rule)[\w-]*-?\$\{/.test(texte)) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 90)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('les trois écrans refondus ne portent plus de fragment de dégradé orphelin', () => {
    // `from-red-500 to-rose-600` sans `bg-gradient-to-*` ne pose aucun fond :
    // la couleur d'état est perdue, pas remplacée.
    const fautifs: string[] = [];
    for (const fichier of ECRANS_PRIORITAIRES) {
      const contenu = readFileSync(fichier, 'utf8');
      const aUnDegrade = /bg-gradient-to-/.test(contenu);
      for (const { n, texte } of lignesDeCode(contenu)) {
        if (/\bfrom-[a-z]+-\d{2,3}\b/.test(texte) && !aUnDegrade) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 90)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('la barre de défilement n\'est pas un dégradé', () => {
    // Elle valait `linear-gradient(#3b82f6, #8b5cf6)` : bleu → violet, visible
    // sur TOUS les écrans à la fois, sous les onglets, dans chaque modale et
    // chaque tableau défilant.
    const css = readFileSync(join(CLIENT, 'index.css'), 'utf8');
    const bloc = css.slice(css.indexOf('::-webkit-scrollbar'));
    expect(bloc).not.toMatch(/scrollbar-thumb[^}]*linear-gradient/);
  });

  it('le CSS décoratif inutilisé a bien été retiré', () => {
    // Environ deux cents lignes livrées à chaque chargement sans qu'aucun
    // composant ne les utilise.
    const css = readFileSync(join(CLIENT, 'index.css'), 'utf8');
    for (const classe of [
      'glass-morphism', 'gradient-text-animate', 'gradient-border',
      'btn-professional', 'animate-float', 'interactive-element',
    ]) {
      expect(css).not.toContain(`.${classe}`);
    }
  });
});

describe('Contenus techniques internes', () => {
  it('aucun nom de fichier Markdown n\'est affiché à l\'utilisateur', () => {
    // La page d'ingénierie renvoyait l'utilisateur vers
    // « ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md ».
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (/[A-Za-z0-9_-]+\.md\b/.test(texte)) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 90)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('aucun nom de variable d\'environnement n\'est affiché à l\'utilisateur', () => {
    // « TechLearn non configuré (TECHLEARN_API_URL / TECHLEARN_SERVICE_TOKEN
    // absents) » s'affichait sur l'écran Équipe multi-agent.
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        // On retire d'abord les expressions `${…}` d'un gabarit : une
        // CONSTANTE interpolée est une valeur, pas le nom affiché. Ce qui
        // reste est du texte littéral — c'est là qu'un nom de variable
        // d'environnement serait vraiment montré.
        const litteral = texte.replace(/\$\{[^}]*\}/g, '');
        // Comparaisons et aiguillages ne s'affichent pas davantage.
        if (/\.(includes|startsWith|endsWith|indexOf)\(|===|!==|case\s/.test(texte)) continue;
        if (/["'`][^"'`]*\b[A-Z][A-Z0-9]*(_[A-Z0-9]+){2,}\b[^"'`]*["'`]/.test(litteral)) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 90)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('les trois écrans refondus n\'annoncent aucun chantier en cours', () => {
    // L'onglet « Alertes » de la GMAO — l'un des cinq de sa navigation —
    // affichait « Gestion des alertes système en cours de développement ».
    const fautifs: string[] = [];
    for (const fichier of ECRANS_PRIORITAIRES) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (/en cours de développement|à construire|non encore construit|\(legacy\)/i.test(texte)) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 90)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('la mention « application à installer » a disparu de la GMAO', () => {
    const contenu = readFileSync(join(CLIENT, 'pages', 'gmao-dashboard.tsx'), 'utf8');
    const fautifs = lignesDeCode(contenu)
      .filter(({ texte }) => /application à installer/i.test(texte))
      .map(({ n }) => `gmao-dashboard.tsx:${n}`);
    expect(fautifs).toEqual([]);
  });

  it('l\'écran d\'ingénierie ne compte plus ses « piliers »', () => {
    // « 8 / 8 piliers ont du code réel aujourd'hui » : un état d'avancement
    // du développement, affiché au client.
    const contenu = readFileSync(join(CLIENT, 'pages', 'maintenance-engineering-platform.tsx'), 'utf8');
    const fautifs = lignesDeCode(contenu)
      .filter(({ texte }) => /pilier/i.test(texte))
      .map(({ n, texte }) => `maintenance-engineering-platform.tsx:${n} → ${texte.trim().slice(0, 70)}`);
    expect(fautifs).toEqual([]);
  });
});

describe('Chiffres affichés sans source', () => {
  it('la modale d\'analyses de la GMAO ne porte plus de taux fabriqués', () => {
    // Taux d'utilisation 85,2 %, performance 92,1 %, coût horaire 127 €,
    // économies 12,3 k€, ROI +24 %, « MTBF en hausse de 12 % », « réduction
    // de 8 % des coûts », « modèles prédictifs améliorés de 15 % », et quatre
    // compteurs d'alertes (3, 7, 5, 12). Aucune source en base.
    const contenu = readFileSync(join(CLIENT, 'pages', 'gmao-dashboard.tsx'), 'utf8');
    const inventes = ['85.2', '92.1', '€127', '12.3K', '+24%'];
    const fautifs: string[] = [];
    for (const { n, texte } of lignesDeCode(contenu)) {
      for (const valeur of inventes) {
        if (texte.includes(valeur)) fautifs.push(`gmao-dashboard.tsx:${n} → ${valeur}`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('le parc de la GMAO n\'a plus de jeu d\'équipements de démonstration', () => {
    // Le camembert retombait sur « Moteurs 12, Pompes 8, Compresseurs 5,
    // Convoyeurs 6, Autres 4 » dès que `dashboardData` était absent —
    // c'est-à-dire PRÉCISÉMENT en cas d'échec de l'API, où la page affichait
    // déjà son bandeau d'erreur.
    const contenu = readFileSync(join(CLIENT, 'pages', 'gmao-dashboard.tsx'), 'utf8');
    const fautifs = lignesDeCode(contenu)
      .filter(({ texte }) => /\{\s*name:\s*'(Moteurs|Pompes|Compresseurs|Convoyeurs)'/.test(texte))
      .map(({ n, texte }) => `gmao-dashboard.tsx:${n} → ${texte.trim().slice(0, 70)}`);
    expect(fautifs).toEqual([]);
  });

  it('la répartition du parc est conditionnée à la présence de données réelles', () => {
    const contenu = readFileSync(join(CLIENT, 'pages', 'gmao-dashboard.tsx'), 'utf8');
    expect(contenu).toContain('dashboardData?.equipmentByType && Object.keys(dashboardData.equipmentByType).length > 0');
  });
});

describe('Navigation et accessibilité', () => {
  it('les trois écrans refondus affichent la navigation principale', () => {
    // 27 des 33 routes mesurées n'en affichaient aucune : arrivé sur un ordre
    // de travail depuis « À traiter », l'utilisateur n'avait plus d'issue que
    // le bouton « précédent » du navigateur.
    const sansNavigation = ECRANS_PRIORITAIRES.filter((fichier) => {
      const contenu = readFileSync(fichier, 'utf8');
      return !/AppShell|ModernNavigation/.test(contenu);
    });
    expect(sansNavigation.map(relatif)).toEqual([]);
  });

  it('le gabarit d\'application expose un fil d\'Ariane et une zone de titre', () => {
    const shell = readFileSync(join(CLIENT, 'components', 'app-shell.tsx'), 'utf8');
    expect(shell).toContain('aria-label="Fil d\'Ariane"');
    expect(shell).toContain('aria-current="page"');
    expect(shell).toContain('export function EnTetePage');
  });

  it('chaque étiquette du formulaire de diagnostic est liée à son champ', () => {
    // Sept contrôles restaient anonymes pour un lecteur d'écran, et cliquer
    // sur l'étiquette ne donnait pas le focus au champ.
    const contenu = readFileSync(join(CLIENT, 'components', 'diagnostic-form.tsx'), 'utf8');
    for (const id of ['diag-type-equipement', 'diag-identifiant-equipement', 'diag-zone', 'diag-ligne-secteur', 'diag-symptomes']) {
      expect(contenu).toContain(`htmlFor="${id}"`);
      expect(contenu).toContain(`id="${id}"`);
    }
  });

  it('les déclencheurs de la navigation montrent le focus clavier', () => {
    // `outline-none` supprimait l'indicateur sans rien proposer à la place :
    // cinq éléments sur quarante ne changeaient ni contour ni ombre au focus.
    const nav = readFileSync(join(CLIENT, 'components', 'modern-navigation.tsx'), 'utf8');
    const lignesOutlineNone = lignesDeCode(nav).filter(({ texte }) => /\boutline-none\b/.test(texte));
    const sansReleve = lignesOutlineNone.filter(({ texte }) => !/focus-visible:outline/.test(texte));
    expect(sansReleve.map(({ n }) => `modern-navigation.tsx:${n}`)).toEqual([]);
  });

  it('aucun contenu du formulaire de diagnostic n\'est imprimé dans la console', () => {
    // Cinq `console.log` imprimaient le formulaire BRUT, sérialisation JSON
    // comprise. Les symptômes saisis décrivent l'installation du client.
    const fichiers = [
      join(CLIENT, 'pages', 'dashboard.tsx'),
      join(CLIENT, 'components', 'diagnostic-form.tsx'),
    ];
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (/console\.log/.test(texte)) fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 70)}`);
      }
    }
    expect(fautifs).toEqual([]);
  });
});
