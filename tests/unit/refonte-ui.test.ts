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

  it('aucun écran ne porte de fragment de dégradé orphelin', () => {
    // `from-red-500 to-rose-600` sans `bg-gradient-to-*` ne pose aucun fond :
    // la couleur d'état est perdue, pas remplacée. Il en restait 97, répartis
    // sur 20 pages, après qu'une passe de dé-dégradage eut retiré le
    // `bg-gradient-to-r` sans retirer ce qu'il activait.
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      const contenu = readFileSync(fichier, 'utf8');
      const aUnDegrade = /bg-gradient-to-/.test(contenu);
      for (const { n, texte } of lignesDeCode(contenu)) {
        // `data-[motion^=from-]` est un sélecteur d'animation Radix, pas une
        // couleur : la bibliothèque n'est pas concernée par cette règle.
        if (/data-\[/.test(texte)) continue;
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

describe('Thème sombre — retiré', () => {
  // Le thème sombre ne pouvait pas fonctionner : les jetons de la charte
  // (paper, ink, rule, signal, etat) sont des valeurs hexadécimales
  // littérales dans `tailwind.config.ts`, donc insensibles au thème. Vérifié
  // à la sonde : `bg-paper` rend le même rgb(244, 247, 250) dans les deux.
  // En sombre, la page passait au bleu nuit pendant que chaque carte restait
  // blanche : 241 textes sur 800 sous le seuil AA, jusqu'à 1,04:1.
  // Et ce n'était pas réservé à qui cliquait : `getInitialTheme` retombait
  // sur `prefers-color-scheme`.

  it('aucune bascule de thème ne subsiste dans la navigation', () => {
    const nav = readFileSync(join(CLIENT, 'components', 'modern-navigation.tsx'), 'utf8');
    expect(nav).not.toMatch(/useTheme|toggleTheme/);
  });

  it('la feuille de style ne redéfinit plus de palette sombre', () => {
    const css = readFileSync(join(CLIENT, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/^\.dark\s*\{/m);
  });

  it('aucune variante `dark:` ne subsiste dans le code applicatif', () => {
    // Elles ne peuvent plus s'appliquer, la classe `.dark` n'étant jamais
    // posée. Les garder revient à laisser le code affirmer que le produit a
    // un thème sombre. `components/ui/` est la bibliothèque : on n'y touche
    // pas, elle resservira le jour où un vrai thème sombre sera construit.
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      if (/[\\/]components[\\/]ui[\\/]/.test(fichier)) continue;
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (/\bdark:/.test(texte)) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 80)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });
});

describe('Classes et libellés dégénérés', () => {
  // Trois défauts de cette famille ont été trouvés, dont un que la passe
  // d'harmonisation elle-même avait produit. Aucun ne lève d'erreur : une
  // classe absente laisse hériter du parent, un libellé vide rend une
  // pastille colorée et muette. Seule la lecture du rendu les révèle.

  it('aucune chaîne de classes réduite à des préfixes `dark:` orphelins', () => {
    // `statusBg` valait littéralement « dark: dark: » : les fragments de
    // dégradé avaient été retirés, les préfixes étaient restés.
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (/["'`]\s*(dark:\s*)+["'`]/.test(texte)) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 80)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('aucun ternaire d\'affichage dont toutes les branches sont vides', () => {
    // Une pastille d'étalonnage affichait une couleur et AUCUN texte, quelle
    // que soit la conformité ; l'indicateur de dérive de l'IMCA ne rendait
    // rien dans ses quatre branches. Illisible pour qui ne distingue pas le
    // vert du rouge, et muet pour un lecteur d'écran.
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        // Au moins deux branches littérales vides qui se suivent dans un
        // ternaire rendu entre accolades JSX.
        if (/\?\s*""\s*:\s*(?:[^?:]*\?\s*)?""/.test(texte)) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 80)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
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

describe('GMAO — le cockpit ne se contredit plus', () => {
  // Mesuré le 20/10/2026 sur un locataire ayant 26 ordres en attente et
  // aucun démarré : l'écran affichait « Ordres de travail : 0 » puis
  // « Aucune urgence, aucun retard. Le parc tourne. » Deux omissions qui se
  // composaient — un compteur qui ne comptait que `in_progress`, et une
  // liste « À traiter » sans ligne pour les ordres en attente.

  const ECRANS_AVEC_COMPTEUR = [
    join(CLIENT, 'pages', 'gmao-dashboard.tsx'),
    join(CLIENT, 'pages', 'maintenance-engineering-platform.tsx'),
  ];

  it('aucun compteur n\'affiche les seuls ordres démarrés sous un libellé général', () => {
    // `activeWorkOrdersCount` seul comme valeur d'un indicateur est le
    // défaut : il exclut tout ce qui attend d'être affecté.
    const fautifs: string[] = [];
    for (const fichier of ECRANS_AVEC_COMPTEUR) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (/valeur=\{[^}]*\bactiveWorkOrdersCount\b[^}]*\}/.test(texte)
            && !/pendingWorkOrdersCount/.test(texte)) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 90)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('« À traiter » couvre les ordres en attente d\'affectation', () => {
    const contenu = readFileSync(join(CLIENT, 'pages', 'gmao-dashboard.tsx'), 'utf8');
    const depart = contenu.indexOf('const points = [');
    const fin = contenu.indexOf('].filter((point) => point.n > 0)', depart);
    expect(depart).toBeGreaterThan(-1);
    const liste = contenu.slice(depart, fin);
    expect(liste).toContain('pendingWorkOrdersCount');
  });
});

describe('Maintenance préventive — plus de plans fabriqués', () => {
  it('aucun écran ne concatène de plans de démonstration aux vrais', () => {
    // `[...formattedPlans, ...staticPlans]` n'était pas un repli : il ajoutait
    // cinq plans inventés aux plans réels, donc chaque organisation voyait les
    // mêmes cinq plans et les mêmes techniciens.
    // La page qui les portait a depuis été retirée (une seule table servie),
    // mais la règle vaut pour toute l'interface, pas pour un fichier.
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (/\bstaticPlans\b|\bstaticData\b|\bdemoPlans\b/.test(texte)) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 70)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('aucun technicien inventé ne subsiste dans l\'interface', () => {
    const INVENTES = ['Jean Dupont', 'Marie Martin', 'Pierre Durand', 'Sophie Blanc', 'Michel Leroy'];
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        // Un `placeholder=` de formulaire propose un exemple de saisie ; il
        // n'affirme aucune donnée. Seule une valeur affichée ment.
        if (/placeholder=/.test(texte)) continue;
        for (const nom of INVENTES) {
          if (texte.includes(nom)) fautifs.push(`${relatif(fichier)}:${n} → ${nom}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('aucune moyenne ne divise par une longueur sans la vérifier', () => {
    // `Math.round(somme / liste.length)` donne `NaN` quand la liste est vide,
    // et l'écran affiche « NaN % ». Le défaut restait invisible tant que des
    // plans fabriqués garantissaient un dénominateur non nul : les retirer
    // l'a découvert. Une moyenne sans population n'existe pas — elle s'écrit
    // « — », elle ne vaut pas zéro.
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        // Une division par `.length` ou par un total, sans garde ternaire ni
        // `|| 1` sur la même ligne.
        if (/\/\s*\w*(\.length|[Tt]otal\w*)\b/.test(texte)
            && !/\?|\|\|\s*1\b|Math\.max/.test(texte)
            && /reduce\(|somme|sum/.test(texte)) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 80)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });
});

describe('Maintenance planifiée — une seule table servie', () => {
  // Trois écrans existaient pour la maintenance planifiée, lisant DEUX
  // tables : `preventive_maintenance_plans` (12 plans, câblée au tableau de
  // bord, aux agents et aux imports) et `maintenance_plans` (0 plan, îlot
  // sans aucune intégration). Un plan créé d'un côté était invisible de
  // l'autre. Seul l'écran lisant la table alimentée subsiste.

  it('aucun écran ne lit plus la table orpheline', () => {
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (/["'`]\/api\/maintenance-plans/.test(texte)) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 80)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('les trois routes mènent au même écran', () => {
    const app = readFileSync(join(CLIENT, 'App.tsx'), 'utf8');
    for (const route of ['/preventive', '/preventive-maintenance', '/maintenance-plan']) {
      const i = app.indexOf(`<Route path="${route}">`);
      expect(i).toBeGreaterThan(-1);
      // Le composant servi est nommé dans les deux lignes qui suivent.
      expect(app.slice(i, i + 220)).toContain('PreventivePage');
    }
  });

  it('l\'écran conservé lit bien la table alimentée', () => {
    const composant = readFileSync(join(CLIENT, 'components', 'preventive-maintenance.tsx'), 'utf8');
    expect(composant).toContain('/api/preventive-maintenance-plans');
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

  it('tout écran applicatif affiche la navigation principale', () => {
    // Étape D : le gabarit est posé sur l'ensemble des écrans, pas seulement
    // sur les trois prototypes. Les pages publiques et les parcours
    // d'authentification s'en passent par construction — on ne met pas de
    // menu applicatif devant quelqu'un qui n'est pas encore entré.
    const HORS_PERIMETRE = new Set([
      'login', 'landing', 'not-found', 'forgot-password', 'reset-password',
      'first-login-password-change', 'force-logout', 'change-credentials',
      'super-admin-login', 'super-admin-dashboard', 'email-diagnostic',
      'payment-test', 'enterprise-auth-test', 'client-portal', 'download-center',
      'maintenance-dashboard', 'security-mfa', 'localhost-diagnostic',
    ]);
    const sansNavigation: string[] = [];
    for (const fichier of sources(join(CLIENT, 'pages'))) {
      const nom = fichier.split(/[\\/]/).pop()!.replace(/\.tsx$/, '');
      if (HORS_PERIMETRE.has(nom)) continue;
      if (!/AppShell|ModernNavigation/.test(readFileSync(fichier, 'utf8'))) {
        sansNavigation.push(nom);
      }
    }
    expect(sansNavigation).toEqual([]);
  });

  it('aucun jeton d\'état vif n\'est posé en fond translucide', () => {
    // Un fond translucide se compose sur son parent AVANT tout calcul de
    // contraste. `bg-etat-nominal-vif/20` sur une carte donnait
    // rgb(204, 223, 216), et le texte par-dessus tombait à 4,27:1. Sur
    // l'écran IMCA, qui affiche une pastille par équipement, le même défaut
    // se répétait 250 fois. Les jetons `fond` sont opaques et mesurés.
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (/\bbg-etat-[a-z]+-vif\/\d+/.test(texte)) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 80)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('le cyan du logo ne porte pas de texte sur fond clair', () => {
    // `signal-light` (#00B9F2) plafonne à 2,3:1 sur fond clair — sous le
    // seuil AA pour du texte comme pour un élément graphique porteur de sens.
    // La charte le réserve aux accents sur fond sombre.
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (/(^|[^:\w-])text-signal-light\b/.test(texte)) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 80)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('aucun identifiant d\'organisation n\'est écrit en dur', () => {
    // L'écran de conformité CCTP interrogeait — et ÉCRIVAIT — sous la chaîne
    // littérale « default-tenant ». La route répondait 200 avec `{}`, le
    // composant lisait `poConfig.companyHeader.name` sur un objet vide, et
    // l'écran entier restait blanc. Les seuils de bon de commande d'un client
    // n'arrivaient donc jamais chez lui.
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (/\btenantId\s*=\s*["'][^"']+["']/.test(texte) || /["']default-tenant["']/.test(texte)) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 80)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
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

describe('Ordres de travail — une seule implémentation', () => {
  /*
   * Deux écrans servaient les ordres de travail : la page /work-orders et
   * l'onglet de la GMAO, qui montait un composant distinct de 820 lignes.
   * Mesuré au navigateur le 20/10/2026, l'onglet affichait DEUX titres
   * superposés et quatre valeurs serveur brutes — « pending », « on_hold »,
   * « high », « medium » — là où la page traduisait en français.
   *
   * Pire que l'affichage : les contrats de champs divergeaient. Le payload
   * exact de l'onglet, envoyé à POST /api/work-orders, a reçu 201 « créé
   * avec succès » et enregistré `orderType` réécrit en « corrective »,
   * `requestedBy`, `estimatedDuration` et `scheduledStart` à null.
   */
  const COMPOSANT = join(CLIENT, 'components', 'work-order-management.tsx');

  it('la page et l\'onglet montent le même composant', () => {
    const page = readFileSync(join(CLIENT, 'pages', 'work-orders.tsx'), 'utf8');
    const gmao = readFileSync(join(CLIENT, 'pages', 'gmao-dashboard.tsx'), 'utf8');
    expect(page).toContain('@/components/work-order-management');
    expect(gmao).toContain('@/components/work-order-management');
    // La page ne doit pas réimplémenter la liste : elle pose le cadre.
    expect(page.split('\n').length).toBeLessThan(60);
  });

  it('les deux hôtes passent leur en-tête au composant', () => {
    // Sans `enTete`, le composant pose son propre titre et l'onglet en
    // affichait deux : un <h1> « Ordres de travail » suivi d'un <h2>
    // « Ordres de Travail ».
    const page = readFileSync(join(CLIENT, 'pages', 'work-orders.tsx'), 'utf8');
    const gmao = readFileSync(join(CLIENT, 'pages', 'gmao-dashboard.tsx'), 'utf8');
    expect(page).toMatch(/<WorkOrderManagement[\s\S]{0,400}enTete=/);
    expect(gmao).toMatch(/<WorkOrderManagement[\s\S]{0,400}enTete=/);
  });

  it('aucun statut ni priorité d\'ordre n\'est affiché en valeur brute', () => {
    /*
     * `{wo.status}` et `{wo.priority}` rendaient la valeur de la colonne
     * telle quelle. Le dictionnaire partagé de `lib/etats.ts` est le seul
     * chemin autorisé vers un libellé.
     */
    const contenu = readFileSync(COMPOSANT, 'utf8');
    const fautifs: string[] = [];
    for (const { n, texte } of lignesDeCode(contenu)) {
      // `value={formulaire.priority}` alimente un <select> : c'est la valeur
      // de la colonne qui y est attendue, pas un libellé. Seul le rendu en
      // enfant JSX est fautif, d'où le `{` non précédé d'un `=`.
      if (/(?<!=)\{\s*\w+\.(status|priority)\s*\}/.test(texte)) {
        fautifs.push(`work-order-management.tsx:${n} → ${texte.trim().slice(0, 70)}`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('le dictionnaire reconnaît la valeur héritée on_hold', () => {
    /*
     * L'onglet écrivait `on_hold`, la page ne connaissait que `paused` : un
     * ordre suspendu depuis l'onglet ressortait en pastille grise portant le
     * texte `on_hold`. Des lignes le portent déjà en base ; les refuser
     * afficherait du texte brut à la place d'un état.
     */
    const etats = readFileSync(join(CLIENT, 'lib', 'etats.ts'), 'utf8');
    expect(etats).toContain('on_hold');
    expect(etats).toMatch(/ALIAS_STATUT_OT/);
    // `on_hold` ne doit JAMAIS être proposé à la saisie : on lit le tableau
    // littéral seul, sans le commentaire qui le précède — celui-ci CITE la
    // valeur héritée pour expliquer pourquoi elle est reconnue en lecture.
    const debut = etats.indexOf('STATUTS_OT: readonly DefinitionEtatOT[] = [');
    expect(debut).toBeGreaterThan(-1);
    const listeSaisie = etats.slice(debut, etats.indexOf('];', debut));
    expect(listeSaisie).not.toContain('on_hold');
    expect(listeSaisie).toContain('paused');
  });

  it('l\'affectation et la demande passent par un sélecteur, jamais par du texte libre', () => {
    /*
     * `assigned_to` et `requested_by` sont des clés étrangères numériques
     * vers user_profiles. L'onglet proposait « Nom du demandeur » en champ
     * texte, converti par `parseInt` — donc NaN, donc écarté avant l'envoi :
     * affecter un technicien par son nom n'a jamais rien enregistré.
     */
    const contenu = readFileSync(COMPOSANT, 'utf8');
    for (const champ of ['ot-assigne', 'ot-demandeur']) {
      const i = contenu.indexOf(`id="${champ}"`);
      expect(i).toBeGreaterThan(-1);
      // L'élément porteur de l'identifiant doit être un <select>.
      const avant = contenu.slice(Math.max(0, i - 200), i);
      expect(avant).toContain('<select');
    }
  });

  it('la suppression est réservée aux rôles que le serveur autorise', () => {
    /*
     * `DELETE /api/work-orders/:id` répond 403 en dessous de directeur
     * technique. L'onglet montrait pourtant la corbeille à tout le monde —
     * 35 boutons relevés à l'écran — et un technicien n'obtenait qu'un
     * « Impossible de supprimer » sans raison.
     */
    const contenu = readFileSync(COMPOSANT, 'utf8');
    expect(contenu).toMatch(/auMoins\(\s*user\?\.role\s*,\s*['"]technical_director['"]\s*\)/);
    // Le bloc de suppression est conditionné par ce contrôle.
    expect(contenu).toMatch(/peutSupprimer\s*&&/);
  });

  it('la création complète les champs que POST ne sait pas enregistrer', () => {
    /*
     * POST reconstruit son objet champ par champ et ignore `dueDate`,
     * `orderType` et `requestedBy` ; PUT, lui, recopie le corps. Sans ce
     * complément, l'échéance et le demandeur saisis étaient perdus en
     * silence, et le type réécrit en « corrective ».
     */
    const contenu = readFileSync(COMPOSANT, 'utf8');
    const i = contenu.indexOf('const complement');
    expect(i).toBeGreaterThan(-1);
    const bloc = contenu.slice(i, i + 1200);
    for (const champ of ['dueDate', 'requestedBy', 'orderType', 'estimatedHours']) {
      expect(bloc).toContain(champ);
    }
    // L'échec du complément ne doit pas être confondu avec un échec de création.
    expect(contenu).toContain('ComplementNonEnregistre');
  });

  it('le formulaire exige la description, que le serveur refuse vide', () => {
    /*
     * `description` est `notNull` et le schéma Zod la refuse absente : HTTP
     * 400 « description Required ». L'ancien formulaire ne contrôlait que le
     * titre et l'équipement, et affichait l'erreur Zod brute.
     */
    const contenu = readFileSync(COMPOSANT, 'utf8');
    expect(contenu).toMatch(/!formulaire\.description\.trim\(\)/);
  });

  it('aucun ordre de travail n\'est envoyé dans la console', () => {
    // `console.log("Sending work order data:", apiData)` imprimait le
    // contenu de chaque ordre créé.
    const fautifs: string[] = [];
    for (const { n, texte } of lignesDeCode(readFileSync(COMPOSANT, 'utf8'))) {
      if (/console\.(log|debug|info)/.test(texte)) {
        fautifs.push(`work-order-management.tsx:${n} → ${texte.trim().slice(0, 70)}`);
      }
    }
    expect(fautifs).toEqual([]);
  });
});

describe('Historique — une seule implémentation', () => {
  /*
   * Trois écrans portaient le nom « Historique », sur DEUX sources de données,
   * et un seul montrait réellement un historique :
   *
   *   • /historique                        → /api/maintenance-history ✓
   *   • onglet « Historique » de la GMAO   → RIEN : une console import/export
   *   • onglet « Historique » du dashboard → /api/history
   *
   * `/api/history` compose sa réponse avec `storage.getDiagnosticSessions()`,
   * qui ne filtre pas par locataire. `antiLeakageValidator` le détecte et
   * remplace le corps par un objet d'erreur — en laissant le statut à 200.
   * Mesuré le 20/10/2026 : UNE session de diagnostic appartenant à un second
   * locataire suffisait à faire rendre /dashboard entièrement blanc.
   */
  const COMPOSANT = join(CLIENT, 'components', 'historique-maintenance.tsx');

  it('les trois hôtes montent le même composant', () => {
    const page = readFileSync(join(CLIENT, 'pages', 'historique.tsx'), 'utf8');
    const gmao = readFileSync(join(CLIENT, 'pages', 'gmao-dashboard.tsx'), 'utf8');
    const tableauDeBord = readFileSync(join(CLIENT, 'pages', 'dashboard.tsx'), 'utf8');
    for (const source of [page, gmao, tableauDeBord]) {
      expect(source).toContain('@/components/historique-maintenance');
    }
    // La page ne réimplémente pas la liste : elle pose le cadre.
    expect(page.split('\n').length).toBeLessThan(60);
  });

  it('plus aucun écran ne lit la route non cloisonnée', () => {
    /*
     * `/api/history` reste en place côté serveur ; plus aucun écran ne doit
     * la lire tant que `getDiagnosticSessions()` ignore le locataire.
     */
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (/["'`]\/api\/history(?![\w-])/.test(texte)) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 80)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('un refus renvoyé en HTTP 200 est traité comme une erreur', () => {
    /*
     * C'est le garde-fou central : sans lui, un corps
     * `{ error: 'CROSS_TENANT_DATA_DETECTED' }` servi en 200 traversait
     * `res.ok`, arrivait dans un `.map` et blanchissait la page.
     */
    const client = readFileSync(join(CLIENT, 'lib', 'queryClient.ts'), 'utf8');
    expect(client).toContain('refusDeguiseEnSucces');
    // Les trois chemins de lecture doivent passer par le contrôle.
    const appels = client.match(/refusDeguiseEnSucces\(/g) ?? [];
    expect(appels.length).toBeGreaterThanOrEqual(4); // 1 définition + 3 usages
  });

  it('aucun statut d\'intervention n\'est affiché en valeur brute', () => {
    const fautifs: string[] = [];
    for (const { n, texte } of lignesDeCode(readFileSync(COMPOSANT, 'utf8'))) {
      // Ni `value={…}` (attribut d'un select) ni `${…}` (interpolation dans
      // un gabarit de chaîne) : seul le rendu en enfant JSX est fautif.
      if (/(?<![=$])\{\s*\w+\.(status|maintenanceType)\s*\}/.test(texte)) {
        fautifs.push(`historique-maintenance.tsx:${n} → ${texte.trim().slice(0, 70)}`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('le filtre de statut ne propose que ce que l\'API sait produire', () => {
    /*
     * `mapWorkOrderStatus` ne renvoie que `completed`, `cancelled` ou
     * `in_progress` : 45 ordres « pending », 1 « paused » et 1 « on_hold »
     * arrivaient tous en `in_progress`. Proposer « En attente » donnerait un
     * filtre qui ne ramène jamais rien, et afficher « En cours » affirmerait
     * que 47 interventions sont engagées alors que 45 n'ont pas commencé.
     */
    const contenu = readFileSync(COMPOSANT, 'utf8');
    const debut = contenu.indexOf('aria-label="Filtrer par statut"');
    expect(debut).toBeGreaterThan(-1);
    const bloc = contenu.slice(debut, contenu.indexOf('</select>', debut));
    expect(bloc).toContain('completed');
    expect(bloc).toContain('in_progress');
    expect(bloc).toContain('cancelled');
    expect(bloc).not.toMatch(/value="(pending|paused|on_hold)"/);
    // Et le libellé rendu ne doit pas prétendre que le travail est engagé.
    expect(contenu).toMatch(/in_progress:\s*\{\s*libelle:\s*"Non clôturé"/);
  });
});

describe('Import / export — une seule famille de routes', () => {
  /*
   * Trois implémentations coexistaient, sur DEUX familles d'API. Vérifié au
   * serveur le 20/10/2026 : `/api/data/export`, `/api/data/template` et
   * `/api/data/import-history` répondent **404**. La page
   * pages/data-import-export.tsx (587 lignes, route /data-import-export)
   * n'appelait qu'elles : aucun de ses boutons n'a jamais rien produit.
   * `/api/data-import-export/*` répond 200.
   */
  it('plus aucun écran n\'appelle la famille inexistante /api/data/*', () => {
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (/["'`]\/api\/data\/(?!import-export)/.test(texte)) {
          fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 80)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('les types proposés correspondent à ce que le serveur traite', () => {
    /*
     * L'import n'accepte que trois types (equipments, maintenance-history,
     * spare-parts), l'export cinq. Les deux consoles proposaient la même
     * liste des deux côtés, « Utilisateurs » compris — qu'aucune des deux
     * routes ne traite.
     */
    const page = readFileSync(join(CLIENT, 'pages', 'data-import-export.tsx'), 'utf8');
    const debutImport = page.indexOf('const TYPES_IMPORT');
    expect(debutImport).toBeGreaterThan(-1);
    const listeImport = page.slice(debutImport, page.indexOf(';', debutImport));
    for (const type of ['equipments', 'maintenance-history', 'spare-parts']) {
      expect(listeImport).toContain(type);
    }
    expect(listeImport).not.toContain('iot-data');
    expect(listeImport).not.toContain('work-orders');
    // « Utilisateurs » ne doit plus figurer dans AUCUNE des deux listes (le
    // commentaire qui explique son retrait, lui, a le droit de le citer).
    const debutExport = page.indexOf('const TYPES_EXPORT');
    const listeExport = page.slice(debutExport, page.indexOf('];', debutExport));
    expect(listeExport).not.toContain('Utilisateurs');
    expect(listeImport).not.toContain('Utilisateurs');
  });

  it('l\'envoi de fichier pose le jeton CSRF', () => {
    // Un `fetch` brut avec FormData est refusé en 403 depuis F06.
    const page = readFileSync(join(CLIENT, 'pages', 'data-import-export.tsx'), 'utf8');
    const composant = readFileSync(join(CLIENT, 'components', 'historique-maintenance.tsx'), 'utf8');
    for (const source of [page, composant]) {
      expect(source).toContain('uploadFile');
    }
  });
});

describe('Ce que le serveur envoie, et ce que l\'écran en fait', () => {
  /*
   * Revue systématique du 20/10/2026, sur les deux défauts qui ont produit
   * quatre pages blanches dans cette application.
   *
   * ─── Les colonnes `decimal` arrivent en CHAÎNES ───
   * 68 colonnes du schéma sont des `decimal` ; le pilote PostgreSQL les rend
   * en chaînes pour ne pas perdre de précision. Les 123 routes que lit
   * l'interface ont été interrogées une à une sur l'environnement de test :
   * 12 champs sur 5 routes renvoient un nombre écrit en chaîne, par exemple
   * `"totalAmount": "1234.56"` sur /api/purchase-orders.
   *
   * Chercher les noms de champs dans le schéma SUR-DÉCLARE : `sensor.value`
   * et `plan.yearlyPrice` portent le nom d'une colonne `decimal`, mais leurs
   * routes calculent la valeur en JavaScript et renvoient de vrais nombres.
   * Seule la réponse réelle tranche — d'où la sonde, et non une recherche de
   * motifs.
   *
   * ─── Une réponse qui n'a pas la forme attendue ───
   * Un `fetch` brut contourne `lib/queryClient.ts`, donc le contrôle qui
   * transforme un refus servi en HTTP 200 en erreur.
   */

  it('aucun .toFixed() n\'est appelé sur un champ monétaire', () => {
    /*
     * `order.totalAmount.toFixed(2)` levait « TypeError: p.totalAmount.toFixed
     * is not a function » : l'onglet « Achats » de la GMAO rendait une page
     * blanche dès qu'un seul bon de commande existait.
     */
    const CHAMPS = ['totalAmount', 'totalCost', 'laborCost', 'partsCost', 'totalMaintenanceCost', 'mtbf', 'mttr', 'equipmentAvailability'];
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      for (const { n, texte } of lignesDeCode(readFileSync(fichier, 'utf8'))) {
        if (/parseFloat|Number\(|nombre\(/.test(texte)) continue;
        for (const champ of CHAMPS) {
          if (new RegExp('\\.' + champ + '\\s*\\??\\.?\\s*toFixed\\s*\\(').test(texte)) {
            fautifs.push(`${relatif(fichier)}:${n} → ${texte.trim().slice(0, 70)}`);
          }
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('les conversions vivent dans un seul module', () => {
    // Onze écrans affichent des montants ou des durées venus de colonnes
    // `decimal` ; un seul endroit doit savoir les convertir.
    const donnees = readFileSync(join(CLIENT, 'lib', 'donnees.ts'), 'utf8');
    for (const aide of ['export function nombre', 'export function montant', 'export function pourcentage', 'export function heures', 'export function liste', 'export function part']) {
      expect(donnees).toContain(aide);
    }
  });

  it('les interfaces ne déclarent plus `number` pour un champ decimal', () => {
    /*
     * Le type mentait, et c'est ce mensonge qui masquait le défaut : corriger
     * `mtbf?: number` en `number | string` a fait apparaître SEPT autres
     * endroits qui faisaient de l'arithmétique sur ces chaînes.
     */
    const rapports = readFileSync(join(CLIENT, 'components', 'maintenance-reports.tsx'), 'utf8');
    for (const champ of ['mtbf', 'mttr', 'equipmentAvailability', 'totalMaintenanceCost', 'laborCost', 'partsCost']) {
      expect(rapports).toMatch(new RegExp(`${champ}\?: number \| string;`));
    }
  });

  it('aucune queryFn ne contourne le contrôle des réponses', () => {
    /*
     * `fetch(url).then(r => r.json())` dans une `queryFn` saute
     * `throwIfResNotOk` ET le contrôle du refus déguisé en succès. Les quatre
     * écrans concernés (portail client, journal cryptographique, import/export,
     * analyses prédictives) passent par `apiRequest`.
     */
    const fautifs: string[] = [];
    for (const fichier of fichiers) {
      if (fichier.includes('queryClient')) continue;
      const contenu = readFileSync(fichier, 'utf8');
      const lignes = lignesDeCode(contenu);
      for (const { n, texte } of lignes) {
        if (!/\bqueryFn\b/.test(texte)) continue;
        // Les 6 lignes qui suivent la déclaration de la queryFn.
        const suite = contenu.split('\n').slice(n - 1, n + 6).join('\n');
        if (/\bfetch\s*\(/.test(suite) && /\.json\(\)/.test(suite)) {
          fautifs.push(`${relatif(fichier)}:${n}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });
});
