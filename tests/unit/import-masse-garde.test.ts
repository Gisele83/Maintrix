/**
 * La garde d'import en masse — garde-fous statiques.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CES VÉRIFICATIONS SERVENT À EMPÊCHER
 * ═══════════════════════════════════════════════════════════════════
 * La suite d'intégration prouve que les SEPT routes connues refusent
 * aujourd'hui. Elle ne peut rien dire d'une HUITIÈME ajoutée demain : un
 * `app.post('/api/import/...')` écrit sans la garde passerait tous les tests
 * d'intégration existants, puisqu'aucun ne le connaîtrait. C'est exactement
 * ainsi que ces sept routes se sont retrouvées sans contrôle de rôle, et que
 * deux d'entre elles ont échappé à la campagne de cloisonnement.
 *
 * Ces vérifications BALAYENT donc la source au lieu d'énumérer :
 *
 *   1. toute route d'écriture dont le chemin contient « import » porte la
 *      garde — y compris celles qui n'existent pas encore ;
 *   2. la garde est posée AVANT le middleware d'upload, sinon le fichier est
 *      lu puis refusé (le refus coûte le travail qu'il refuse) ;
 *   3. `/validate` reste SANS garde, parce qu'il n'écrit rien — décision
 *      explicite, pas oubli ;
 *   4. les deux routes CSV appellent `tenantRequis` ;
 *   5. aucun appelant ne revient à `require('./data-import')`, qui renvoie
 *      `any` et masquait l'oubli du locataire au typecheck ;
 *   6. aucun écran ne réécrit le seuil en dur : interface et serveur lisent la
 *      même valeur partagée. Deux copies pouvaient se désaccorder sans que
 *      rien ne le signale.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NIVEAU_IMPORT_MASSE, peutImporterEnMasse } from '@shared/import-en-masse';

const RACINE = join(__dirname, '..', '..');
const lire = (...bouts: string[]) => readFileSync(join(RACINE, ...bouts), 'utf8');

const routes = lire('server', 'routes.ts');
const routesImportExport = lire('server', 'data-import-export-routes.ts');
const importeur = lire('server', 'data-import.ts');

const GARDE = 'exigeNiveauImportMasse';

/** Les lignes de code, commentaires exclus. */
function lignesDeCode(contenu: string): string[] {
  let dansBloc = false;
  return contenu.split('\n').filter((brute) => {
    const texte = brute.trim();
    if (dansBloc) {
      if (texte.includes('*/')) dansBloc = false;
      return false;
    }
    if (texte.startsWith('/*')) {
      if (!texte.includes('*/')) dansBloc = true;
      return false;
    }
    if (texte.startsWith('//') || texte.startsWith('*')) return false;
    return texte.length > 0;
  });
}

describe('Les tests lisent bien les sources attendues', () => {
  it('les trois fichiers sont trouvés et substantiels', () => {
    // Sans ce témoin, un renommage rendrait tout le reste vert sur du vide.
    expect(routes.length).toBeGreaterThan(50_000);
    expect(routesImportExport.length).toBeGreaterThan(5_000);
    expect(importeur.length).toBeGreaterThan(5_000);
  });
});

describe('Le seuil est unique et partagé', () => {
  it('vaut `maintenance_manager`', () => {
    expect(NIVEAU_IMPORT_MASSE).toBe('maintenance_manager');
  });

  it('laisse dehors technicien, chef d\'équipe et achats, et laisse entrer responsable et au-dessus', () => {
    // Le seuil se lit mieux par ses effets que par son numéro.
    expect(peutImporterEnMasse('technician')).toBe(false);
    expect(peutImporterEnMasse('team_leader')).toBe(false);
    expect(peutImporterEnMasse('procurement')).toBe(false);
    expect(peutImporterEnMasse('maintenance_manager')).toBe(true);
    expect(peutImporterEnMasse('technical_director')).toBe(true);
    expect(peutImporterEnMasse('admin')).toBe(true);
    expect(peutImporterEnMasse('owner')).toBe(true);
  });

  it('échoue fermé sur un rôle absent ou inconnu', () => {
    expect(peutImporterEnMasse(undefined)).toBe(false);
    expect(peutImporterEnMasse(null)).toBe(false);
    expect(peutImporterEnMasse('')).toBe(false);
    expect(peutImporterEnMasse('rôle_inventé')).toBe(false);
  });

  it('le module serveur lit la valeur partagée au lieu d\'en garder une copie', () => {
    const serveur = lire('server', 'import-en-masse.ts');
    expect(serveur).toContain('@shared/import-en-masse');
    // Une seconde déclaration du littéral serait une seconde vérité.
    expect(lignesDeCode(serveur).join('\n')).not.toMatch(/=\s*["']maintenance_manager["']/);
  });
});

describe('Toute route d\'écriture « import » porte la garde', () => {
  /**
   * Le balayage, et non la liste : c'est lui qui attrapera la route ajoutée
   * demain. On ne retient que les déclarations d'ÉCRITURE (`app.post`) dont le
   * chemin contient « import » — les gabarits et l'historique sont des `app.get`.
   */
  const declarations = lignesDeCode(routes).filter(
    (ligne) => /app\.post\(\s*["'][^"']*import[^"']*["']/.test(ligne),
  );

  it('le balayage trouve bien des routes (sinon il ne prouverait rien)', () => {
    expect(declarations.length).toBeGreaterThanOrEqual(4);
  });

  for (const ligne of declarations) {
    const chemin = ligne.match(/["']([^"']*import[^"']*)["']/)?.[1] ?? ligne;
    it(`${chemin} est gardée`, () => {
      expect(ligne).toContain(GARDE);
    });
  }

  // Ces deux-là écrivent le parc mais n'ont pas « import » dans leur chemin :
  // le balayage ne peut pas les voir, elles sont donc nommées.
  for (const chemin of ['/api/diagnostic/upload-excel', '/api/diagnostic/process-excel-sheets']) {
    it(`${chemin} est gardée (hors balayage : son chemin ne dit pas « import »)`, () => {
      const lignes = lignesDeCode(routes).filter(
        (l) => l.includes('app.post') && l.includes(chemin),
      );
      expect(lignes.length).toBeGreaterThanOrEqual(1);
      // `upload-excel` est enregistrée DEUX fois (Express ne retient que la
      // première). Les deux sont gardées : si l'on retire un jour celle qui
      // s'exécute, la garde doit survivre dans celle qui reste.
      for (const l of lignes) expect(l).toContain(GARDE);
    });
  }

  it('la route multipart d\'import/export est gardée', () => {
    const ligne = lignesDeCode(routesImportExport).find((l) => l.includes("router.post('/import'"));
    expect(ligne).toBeDefined();
    expect(ligne).toContain(GARDE);
  });
});

describe('La garde précède la lecture du fichier', () => {
  /**
   * Multer (`upload.single`) et `uploadMiddleware` parsent le fichier avant le
   * gestionnaire. Si la garde venait après, un appelant non habilité ferait
   * lire, filtrer et mettre en mémoire 5 Mo pour s'entendre répondre non.
   */
  const aVerifier: Array<[string, string, string]> = [
    ['server/routes.ts', routes, 'uploadMiddleware'],
    ['server/data-import-export-routes.ts', routesImportExport, 'upload.single'],
  ];

  for (const [nom, source, middlewareUpload] of aVerifier) {
    it(`${nom} : la garde est avant ${middlewareUpload}`, () => {
      // On ne retient que les routes d'ÉCRITURE qui portent la garde :
      // `/validate` passe aussi par multer mais n'est délibérément pas gardée
      // (elle n'écrit rien), et son cas est verrouillé par son propre test.
      const lignes = lignesDeCode(source).filter(
        (l) =>
          /(app|router)\.post\(/.test(l) && l.includes(middlewareUpload) && l.includes(GARDE),
      );
      expect(lignes.length).toBeGreaterThanOrEqual(1);
      for (const ligne of lignes) {
        expect(ligne.indexOf(GARDE)).toBeLessThan(ligne.indexOf(middlewareUpload));
      }
    });
  }
});

describe('La vérification de format reste délibérément ouverte', () => {
  it('`/validate` n\'est PAS gardée — elle n\'écrit rien', () => {
    // Décision assumée, pas oubli : ce test existe pour qu'on ne la garde pas
    // par réflexe, et pour que l'ouvrir ou la fermer soit un choix relu.
    const ligne = lignesDeCode(routesImportExport).find((l) => l.includes("router.post('/validate'"));
    expect(ligne).toBeDefined();
    expect(ligne).not.toContain(GARDE);
  });

  it('le refus du serveur désigne cette route, pour que le refus soit utile', () => {
    expect(lire('server', 'import-en-masse.ts')).toContain('ROUTE_VALIDATION_SANS_ECRITURE');
  });
});

describe('Le cloisonnement des deux routes CSV ne régresse pas', () => {
  const code = lignesDeCode(routes).join('\n');

  for (const chemin of ['/api/import/maintenance-csv', '/api/import/reported-cases-csv']) {
    it(`${chemin} appelle tenantRequis`, () => {
      // Ces deux routes écrivaient `tenant_id` NULL : des lignes que personne
      // ne pouvait s'attribuer, pas même l'entreprise qui les avait chargées.
      const debut = code.indexOf(chemin);
      expect(debut).toBeGreaterThan(-1);
      const corps = code.slice(debut, debut + 1200);
      expect(corps).toContain('tenantRequis');
    });
  }

  it('l\'importeur EXIGE un locataire dans ses trois méthodes d\'écriture', () => {
    // Un paramètre optionnel aurait laissé l'oubli passer sans un mot.
    for (const methode of [
      'importMaintenanceCasesFromCSV',
      'importMaintenanceCasesFromExcel',
      'importReportedCasesFromCSV',
    ]) {
      const signature = importeur
        .split('\n')
        .find((l) => l.includes(`async ${methode}(`));
      expect(signature).toBeDefined();
      expect(signature).toContain('tenantId: string');
    }
  });

  it('les deux routes CSV passent par un import TYPÉ, plus par `require`', () => {
    // `require` renvoie `any` : l'argument manquant ne faisait PAS échouer le
    // typecheck. C'est ce qui rendait l'oubli du locataire invisible.
    //
    // La vérification ne porte que sur les routes d'ÉCRITURE. Les deux routes
    // de GABARIT (`/api/templates/*-csv`) gardent leur `require` : elles
    // appellent `generateMaintenanceTemplate()` sans aucun argument et sans
    // locataire, donc il n'y a là aucun oubli que `any` puisse masquer.
    for (const chemin of ['/api/import/maintenance-csv', '/api/import/reported-cases-csv']) {
      const debut = code.indexOf(chemin);
      expect(debut).toBeGreaterThan(-1);
      const corps = code.slice(debut, debut + 1200);
      expect(corps).toContain("await import('./data-import')");
      expect(corps).not.toMatch(/require\(\s*['"]\.\/data-import['"]\s*\)/);
    }
  });
});

describe('Aucun écran ne réécrit le seuil de son côté', () => {
  const ECRANS = [
    ['client', 'src', 'pages', 'inventaire.tsx'],
    ['client', 'src', 'pages', 'data-import-export.tsx'],
    ['client', 'src', 'pages', 'data-import.tsx'],
    ['client', 'src', 'components', 'data-import.tsx'],
    ['client', 'src', 'components', 'historique-maintenance.tsx'],
  ];

  for (const bouts of ECRANS) {
    const nom = bouts.slice(2).join('/');

    it(`${nom} lit le droit par le composant partagé`, () => {
      const source = lire(...bouts);
      expect(source).toContain('usePeutImporterEnMasse');
    });

    it(`${nom} ne contient aucun rôle en dur`, () => {
      // Un écran qui décide tout seul finit par offrir un bouton que le
      // serveur refuse — ou par le masquer à quelqu'un qui en a le droit.
      const code = lignesDeCode(lire(...bouts)).join('\n');
      expect(code).not.toContain('maintenance_manager');
    });
  }

  it('le composant partagé lit la valeur partagée', () => {
    const source = lire('client', 'src', 'components', 'import-reserve.tsx');
    expect(source).toContain('@shared/import-en-masse');
    expect(source).toContain('peutImporterEnMasse');
  });
});
