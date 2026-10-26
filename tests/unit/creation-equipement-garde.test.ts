/**
 * La garde d'inscription au référentiel du parc — garde-fous statiques.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CES VÉRIFICATIONS SERVENT À EMPÊCHER
 * ═══════════════════════════════════════════════════════════════════
 * La suite d'intégration prouve que les DEUX portes connues refusent
 * aujourd'hui. La leçon du lot précédent est qu'un relevé énumératif ne dit
 * rien de la porte suivante : la seconde porte trouvée ici
 * (`POST /api/work-orders` qui inscrit un équipement quand le nom est inconnu)
 * était **invisible depuis l'URL** — rien dans le chemin ne parle
 * d'équipement.
 *
 * Ces vérifications BALAYENT donc les ÉCRITURES, et non les chemins :
 *
 *   1. tout appel à `createEquipment` / `insert(equipmentRegistry)` atteignable
 *      par une route est couvert par une garde — de rôle pour la création
 *      directe, ou par la garde d'import en masse pour les chargements ;
 *   2. le seuil est unique, partagé, et distinct de celui de l'import tout en
 *      lui étant égal ;
 *   3. l'interface ne réécrit pas le seuil de son côté ;
 *   4. le fait sur lequel repose la décision est toujours vrai : il n'existe
 *      AUCUNE suppression d'équipement. Si quelqu'un en ajoute une un jour,
 *      ce test doit casser pour que la justification soit relue.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  NIVEAU_CREATION_EQUIPEMENT,
  peutCreerEquipement,
} from '@shared/creation-equipement';
import { NIVEAU_IMPORT_MASSE } from '@shared/import-en-masse';

const RACINE = join(__dirname, '..', '..');
const lire = (...bouts: string[]) => readFileSync(join(RACINE, ...bouts), 'utf8');

const gmaoRoutes = lire('server', 'gmao-routes.ts');

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

describe('Le test lit bien la source attendue', () => {
  it('gmao-routes.ts est trouvé et substantiel', () => {
    expect(gmaoRoutes.length).toBeGreaterThan(50_000);
  });
});

describe('Le seuil est unique, partagé, et volontairement égal à celui de l\'import', () => {
  it('vaut `maintenance_manager`', () => {
    expect(NIVEAU_CREATION_EQUIPEMENT).toBe('maintenance_manager');
  });

  it('est égal au seuil de l\'import en masse — même acte, volumes différents', () => {
    // S'ils divergent un jour, ce sera une décision à assumer : ajouter une
    // machine deviendrait plus difficile (ou plus facile) que d'en charger
    // cent. Le test force la relecture au lieu de laisser l'écart s'installer.
    expect(NIVEAU_CREATION_EQUIPEMENT).toBe(NIVEAU_IMPORT_MASSE);
  });

  it('laisse dehors technicien, chef d\'équipe et achats', () => {
    expect(peutCreerEquipement('technician')).toBe(false);
    expect(peutCreerEquipement('team_leader')).toBe(false);
    expect(peutCreerEquipement('procurement')).toBe(false);
    expect(peutCreerEquipement('maintenance_manager')).toBe(true);
    expect(peutCreerEquipement('technical_director')).toBe(true);
    expect(peutCreerEquipement('admin')).toBe(true);
    expect(peutCreerEquipement('owner')).toBe(true);
  });

  it('échoue fermé sur un rôle absent ou inconnu', () => {
    expect(peutCreerEquipement(undefined)).toBe(false);
    expect(peutCreerEquipement(null)).toBe(false);
    expect(peutCreerEquipement('')).toBe(false);
    expect(peutCreerEquipement('chef_du_parc')).toBe(false);
  });
});

describe('Toute inscription au référentiel atteignable par une route est gardée', () => {
  /**
   * Le balayage porte sur l'ÉCRITURE, parce que c'est elle qui compte : la
   * seconde porte n'avait « equipment » nulle part dans son chemin.
   */
  const code = lignesDeCode(gmaoRoutes);

  const inscriptions = code
    .map((ligne, i) => ({ ligne, i }))
    .filter(({ ligne }) => /createEquipment\(/.test(ligne));

  it('le balayage trouve bien les deux inscriptions connues', () => {
    // Si ce compte change, une porte a été ajoutée ou retirée : le test
    // suivant dira si elle est gardée, celui-ci dit qu'elle existe.
    expect(inscriptions.length).toBeGreaterThanOrEqual(2);
  });

  for (const { ligne, i } of inscriptions) {
    it(`l'inscription ligne ~${i + 1} est précédée d'une garde de rôle`, () => {
      // La garde doit se trouver EN AMONT dans la même route. On remonte
      // jusqu'à la déclaration de route précédente et on exige la garde entre
      // les deux : une garde posée ailleurs dans le fichier ne protège rien.
      let debutRoute = 0;
      for (let j = i; j >= 0; j--) {
        if (/app\.(post|put|patch)\(/.test(code[j])) { debutRoute = j; break; }
      }
      const amont = code.slice(debutRoute, i).join('\n');
      expect(amont).toMatch(/peutCreerEquipement\(/);
      expect(ligne).toContain('createEquipment(');
    });
  }
});

describe('Les chargements de fichiers restent couverts par leur propre garde', () => {
  it('les écritures hors gmao-routes passent par les routes d\'import, déjà gardées', () => {
    // data-import-export.ts, excel-processor.ts, direct-excel-import.ts et
    // user-excel-upload.ts inscrivent aussi des équipements, mais ne sont
    // atteignables que par les routes d'import — gardées au même niveau
    // (voir tests/unit/import-masse-garde.test.ts). Ce test constate qu'aucun
    // de ces modules n'expose de route HTTP par lui-même, ce qui est la raison
    // pour laquelle la garde d'import suffit à les couvrir.
    for (const fichier of [
      'data-import-export.ts',
      'excel-processor.ts',
      'direct-excel-import.ts',
      'user-excel-upload.ts',
    ]) {
      const source = lignesDeCode(lire('server', fichier)).join('\n');
      expect(source).not.toMatch(/\bapp\.(post|put|patch)\(/);
      expect(source).not.toMatch(/\brouter\.(post|put|patch)\(/);
    }
  });
});

describe('Le fait qui justifie le seuil est toujours vrai', () => {
  it('AUCUNE suppression d\'équipement n\'existe côté serveur', () => {
    // C'est le motif de la décision : une inscription erronée est définitive.
    // Si une suppression apparaît, la justification doit être relue — d'où ce
    // test, qui casse volontairement dans ce cas.
    const fichiers = ['gmao-routes.ts', 'routes.ts', 'gmao-storage.ts', 'storage.ts'];
    for (const fichier of fichiers) {
      const source = lignesDeCode(lire('server', fichier)).join('\n');
      expect(source).not.toMatch(/deleteEquipment\b/);
      expect(source).not.toMatch(/\.delete\(\s*["'][^"']*\/api\/equipment\/:/);
      expect(source).not.toMatch(/delete\(equipmentRegistry\)/);
    }
  });
});

describe('Aucun écran ne réécrit le seuil de son côté', () => {
  const ECRANS = [
    ['client', 'src', 'components', 'equipment-management.tsx'],
    ['client', 'src', 'components', 'work-order-management.tsx'],
  ];

  for (const bouts of ECRANS) {
    const nom = bouts.slice(2).join('/');

    it(`${nom} lit le droit par le composant partagé`, () => {
      expect(lire(...bouts)).toContain('usePeutCreerEquipement');
    });

    it(`${nom} ne contient aucun rôle en dur pour l'inscription`, () => {
      const code = lignesDeCode(lire(...bouts)).join('\n');
      expect(code).not.toContain('maintenance_manager');
    });
  }

  it('le composant partagé lit la valeur partagée', () => {
    const source = lire('client', 'src', 'components', 'equipement-reserve.tsx');
    expect(source).toContain('@shared/creation-equipement');
    expect(source).toContain('peutCreerEquipement');
  });
});

describe('La MODIFICATION du référentiel est gardée comme sa création', () => {
  const code = lignesDeCode(gmaoRoutes);

  it('tout appel à updateEquipment est précédé de la garde de rôle', () => {
    // Le balayage de la création cherchait `createEquipment(` : il ne disait
    // rien de la modification, qui engage le référentiel tout autant.
    const modifications = code
      .map((ligne, i) => ({ ligne, i }))
      .filter(({ ligne }) => /updateEquipment\(/.test(ligne));

    expect(modifications.length).toBeGreaterThanOrEqual(1);

    for (const { i } of modifications) {
      let debutRoute = 0;
      for (let j = i; j >= 0; j--) {
        if (/app\.(post|put|patch)\(/.test(code[j])) { debutRoute = j; break; }
      }
      expect(code.slice(debutRoute, i).join('\n')).toMatch(/peutCreerEquipement\(/);
    }
  });

  it('la route valide par la LISTE BLANCHE, et ne passe plus `req.body` tel quel', () => {
    // `.set({ ...updates })` écrivait tout champ reçu, `tenantId` compris.
    const debut = code.findIndex((l) => l.includes('app.put("/api/equipment/:id"'));
    expect(debut).toBeGreaterThan(-1);

    const fin = code.findIndex((l, i) => i > debut && /app\.(get|post|put|patch|delete)\(/.test(l));
    const corps = code.slice(debut, fin === -1 ? undefined : fin).join('\n');

    expect(corps).toContain('miseAJourEquipementSchema');
    // La forme exacte qui laissait tout passer.
    expect(corps).not.toMatch(/const\s+updates\s*=\s*req\.body\s*;/);
  });
});

describe('La liste blanche exclut ce qui ne se modifie jamais', () => {
  const schema = lire('shared', 'schema.ts');
  const debut = schema.indexOf('export const miseAJourEquipementSchema');
  /**
   * L'extrait est BORNÉ à la déclaration, et non à un nombre de caractères.
   *
   * Un `slice(debut, debut + 2000)` débordait sur le schéma suivant, dont le
   * `.omit({ createdAt: true, updatedAt: true })` faisait croire que ces
   * champs figuraient dans la liste blanche. Un garde-fou qui lit trop large
   * accuse le voisin.
   */
  const bloc = schema.slice(debut, schema.indexOf('.strict();', debut) + '.strict();'.length);

  /**
   * `^\s*<champ>\s*:` — construit par CONCATÉNATION, et non dans un gabarit.
   *
   * Écrit `` `^\s*${champ}\s*:` ``, ce motif ne fait pas ce qu'il dit : dans un
   * template literal, `\s` n'est pas une séquence d'échappement reconnue et se
   * résout en `s`. La source devenait `^s*tenantId s*:`, qui ne correspond à
   * RIEN — si bien que les assertions NÉGATIVES ci-dessous passaient pour la
   * mauvaise raison, en laissant croire que `tenantId` était hors du schéma
   * même s'il y figurait.
   *
   * Le témoin qui suit est donc indispensable : il prouve que le motif
   * distingue un champ présent d'un champ absent. Sans lui, rien ne signale
   * qu'un garde-fou de ce genre est devenu muet.
   */
  const ligneDeChamp = (champ: string) => new RegExp('^\\s*' + champ + '\\s*:', 'm');

  it('TÉMOIN — le motif de recherche discrimine vraiment', () => {
    expect(ligneDeChamp('equipmentName').test(bloc)).toBe(true);
    expect(ligneDeChamp('champQuiNexistePas').test(bloc)).toBe(false);
  });

  it('le schéma existe et refuse les champs inconnus', () => {
    expect(debut).toBeGreaterThan(-1);
    // `.strict()` refuse ; sans lui, Zod IGNORE silencieusement, et l'appelant
    // croirait son écriture prise en compte.
    expect(bloc).toContain('.strict()');
  });

  for (const champ of ['tenantId', 'createdAt', 'updatedAt']) {
    it(`\`${champ}\` n'est pas un champ modifiable`, () => {
      // Écrire `tenantId` faisait PASSER la fiche chez un autre locataire —
      // mesuré, pas supposé.
      expect(ligneDeChamp(champ).test(bloc)).toBe(false);
    });
  }

  it('les champs métier attendus y sont, sinon le formulaire du parc casserait', () => {
    // Relevés sur client/src/components/equipment-management.tsx.
    for (const champ of [
      'equipmentName', 'equipmentType', 'equipmentId', 'location', 'zone',
      'operationalState', 'criticalityLevel', 'manufacturer', 'model',
      'serialNumber', 'installationDate',
    ]) {
      expect(ligneDeChamp(champ).test(bloc)).toBe(true);
    }
  });
});
