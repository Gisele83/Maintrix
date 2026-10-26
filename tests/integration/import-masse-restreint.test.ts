/**
 * Charger un fichier crée des données en masse, et rien ne les annule en masse.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT
 * ═══════════════════════════════════════════════════════════════════
 * SEPT routes d'import écrivaient dans le parc sans AUCUN contrôle de rôle.
 * Deux d'entre elles créent des ordres de travail
 * (`/api/data-import-export/import` en `type=maintenance-history` et
 * `/api/import/user-historical-data`) : la restriction posée la veille sur
 * `POST /api/work-orders` était donc contournable avec un tableur.
 *
 * Deux autres étaient pires encore : `/api/import/maintenance-csv` et
 * `/api/import/reported-cases-csv` n'appelaient même pas `tenantRequis`. Elles
 * écrivaient des lignes avec `tenant_id` NULL — inattribuables, donc invisibles
 * pour l'entreprise qui venait de les charger. Ces deux routes avaient échappé
 * à la campagne de cloisonnement qui avait traité leurs voisines.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE VERROUILLE
 * ═══════════════════════════════════════════════════════════════════
 *   1. les SEPT routes refusent sous `maintenance_manager` — une seule restée
 *      ouverte rendrait la restriction cosmétique ;
 *   2. le seuil est STRICTEMENT au-dessus de `team_leader` (2) ET de
 *      `procurement` (3). Sans ces deux témoins, « au-dessus de chef
 *      d'équipe » se confondrait avec « au moins chef d'équipe » ;
 *   3. sur refus, RIEN n'est écrit ;
 *   4. le refus arrive AVANT la lecture du fichier (voir le test dédié) ;
 *   5. la vérification de format, qui n'écrit rien, reste ouverte à tous ;
 *   6. les lignes importées portent le locataire de CELUI QUI IMPORTE, et
 *      jamais NULL ;
 *   7. témoin — un responsable maintenance importe toujours. Sans lui, une
 *      route cassée pour tout le monde passerait pour une restriction réussie.
 *
 * ⚠️ Cette suite ne se lance pas avec `jest` seul : `npm test` provisionne la
 * base, le serveur et les variables (voir scripts/run-tests.mjs).
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import {
  authenticateUser,
  createAuthenticatedRequest,
  SEEDED,
  type AuthenticatedAgent,
} from '../helpers/setup';
import { NIVEAU_IMPORT_MASSE } from '@shared/import-en-masse';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL absente — lancez `npm test`.');
const pool = new Pool({ connectionString: DATABASE_URL, max: 6 });

const STAMP = `IMP${Date.now()}`;

let technicien: AuthenticatedAgent;      // 1 — refusé
let chefEquipe: AuthenticatedAgent;      // 2 — le seuil des ORDRES ne suffit pas
let achats: AuthenticatedAgent;          // 3 — juste sous le seuil
let responsable: AuthenticatedAgent;     // 4 — le seuil retenu
let responsableBeta: AuthenticatedAgent; // 4, autre locataire

/** Les portes qui prennent du JSON. `corps` est ce qu'il faut pour atteindre l'écriture. */
const PORTES_JSON = [
  { chemin: '/api/import/maintenance-csv', corps: { csvContent: 'equipmentType\npompe\n' } },
  { chemin: '/api/import/reported-cases-csv', corps: { csvContent: 'equipmentType\npompe\n' } },
  { chemin: '/api/import/default-historical-data', corps: {} },
  { chemin: '/api/import/user-historical-data', corps: { filePath: 'inexistant.xlsx' } },
  { chemin: '/api/diagnostic/process-excel-sheets', corps: {} },
] as const;

/** Un CSV de cas de maintenance valide au regard d'ImportMaintenanceCaseSchema. */
function csvCas(suffixe: string, lignes = 2): string {
  const entete = 'equipmentType,equipmentId,symptoms,diagnosis,solution,urgency';
  const corps = Array.from({ length: lignes }, (_, i) =>
    `pompe,EQ-${STAMP}-${suffixe}-${i},SYMPTOME-${STAMP}-${suffixe},Diagnostic ${i},Solution ${i},medium`);
  return [entete, ...corps].join('\n') + '\n';
}

/** Combien de cas cette suite a réellement écrits, et chez qui. */
async function casEcrits(suffixe: string): Promise<Array<{ tenant_id: string | null }>> {
  const { rows } = await pool.query<{ tenant_id: string | null }>(
    `SELECT tenant_id FROM maintenance_cases WHERE symptoms = $1`,
    [`SYMPTOME-${STAMP}-${suffixe}`],
  );
  return rows;
}

beforeAll(async () => {
  technicien = await authenticateUser(SEEDED.technician, SEEDED.password);
  chefEquipe = await authenticateUser(SEEDED.validateurN1, SEEDED.password);
  achats = await authenticateUser(SEEDED.validateurN3, SEEDED.password);
  responsable = await authenticateUser(SEEDED.validateurN2, SEEDED.password);
  responsableBeta = await authenticateUser(SEEDED.validateurBeta, SEEDED.password);
});

afterAll(async () => {
  // Les cas portent le marqueur de la suite dans `symptoms` : on ne retire que
  // les nôtres, jamais les lignes du jeu de données partagé.
  await pool.query(`DELETE FROM maintenance_cases WHERE symptoms LIKE $1`, [`SYMPTOME-${STAMP}-%`]);
  await pool.query(`DELETE FROM reported_cases WHERE description LIKE $1`, [`SIGNALE-${STAMP}-%`]);
  await pool.end();
});

describe('Le seuil retenu', () => {
  it('est `maintenance_manager` — le changer ici change les sept routes', () => {
    // Ce test n'invente pas la règle : il constate la valeur partagée par le
    // serveur et l'interface. S'il casse, c'est que le seuil a bougé, et la
    // décision doit être relue (shared/import-en-masse.ts).
    expect(NIVEAU_IMPORT_MASSE).toBe('maintenance_manager');
  });
});

describe('Les sept portes refusent sous le seuil', () => {
  for (const { chemin, corps } of PORTES_JSON) {
    it(`${chemin} refuse un technicien`, async () => {
      const res = await createAuthenticatedRequest('post', chemin, technicien).send(corps);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it(`${chemin} refuse un CHEF D'ÉQUIPE — le seuil des ordres ne suffit pas`, async () => {
      const res = await createAuthenticatedRequest('post', chemin, chefEquipe).send(corps);
      expect(res.status).toBe(403);
    });

    it(`${chemin} refuse les ACHATS (niveau 3) — le seuil est strictement au-dessus`, async () => {
      const res = await createAuthenticatedRequest('post', chemin, achats).send(corps);
      expect(res.status).toBe(403);
    });
  }

  it('/api/data-import-export/import (multipart) refuse un technicien', async () => {
    const res = await createAuthenticatedRequest('post', '/api/data-import-export/import', technicien)
      .field('type', 'equipments')
      .attach('file', Buffer.from(csvCas('multipart')), {
        filename: 'parc.csv',
        contentType: 'text/csv',
      });
    expect(res.status).toBe(403);
  });

  it('/api/diagnostic/upload-excel refuse un technicien', async () => {
    const res = await createAuthenticatedRequest('post', '/api/diagnostic/upload-excel', technicien)
      .attach('excelFile', Buffer.from('rien'), {
        filename: 'parc.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    expect(res.status).toBe(403);
  });
});

describe('Le refus dit quoi faire', () => {
  it('nomme le niveau attendu et la vérification qui, elle, reste ouverte', async () => {
    const res = await createAuthenticatedRequest('post', '/api/import/maintenance-csv', technicien)
      .send({ csvContent: csvCas('message') });

    expect(res.status).toBe(403);
    expect(res.body.niveauRequis).toBe('maintenance_manager');
    expect(res.body.alternative).toBe('/api/data-import-export/validate');
    // Un refus qui n'explique rien pousse à contourner ou à ouvrir un ticket.
    expect(res.body.message).toMatch(/responsable maintenance/i);
    expect(res.body.message).toMatch(/annulation en masse/i);
  });
});

describe("Sur refus, rien n'est écrit", () => {
  it('le CSV d\'un technicien ne laisse aucun cas derrière lui', async () => {
    const res = await createAuthenticatedRequest('post', '/api/import/maintenance-csv', technicien)
      .send({ csvContent: csvCas('vide', 3) });

    expect(res.status).toBe(403);
    // La preuve n'est pas le code de retour mais l'ABSENCE des lignes : un
    // refus survenu APRÈS l'écriture rendrait le 403 trompeur.
    expect(await casEcrits('vide')).toHaveLength(0);
  });
});

describe('Le refus précède la lecture du fichier', () => {
  /**
   * La garde est posée AVANT multer. Un fichier de type interdit le prouve :
   * si multer passait d'abord, son `fileFilter` refuserait le type et la
   * réponse ne serait pas un 403 de rôle. Le code de retour distingue donc
   * l'ordre réel des middlewares, que le code seul ne montre qu'à la lecture.
   */
  it('un type de fichier interdit reçoit le 403 de rôle, pas l\'erreur de format', async () => {
    const res = await createAuthenticatedRequest('post', '/api/data-import-export/import', technicien)
      .field('type', 'equipments')
      .attach('file', Buffer.from('MZ'), {
        filename: 'charge.exe',
        contentType: 'application/octet-stream',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('témoin : le MÊME fichier interdit, envoyé par un responsable, n\'est plus refusé pour le rôle', async () => {
    // Sans ce témoin, le 403 ci-dessus pourrait venir de n'importe quoi.
    const res = await createAuthenticatedRequest('post', '/api/data-import-export/import', responsable)
      .field('type', 'equipments')
      .attach('file', Buffer.from('MZ'), {
        filename: 'charge.exe',
        contentType: 'application/octet-stream',
      });

    expect(res.status).not.toBe(403);
  });
});

describe('La vérification de format reste ouverte', () => {
  it('un technicien peut vérifier son fichier — elle n\'écrit rien', async () => {
    const res = await createAuthenticatedRequest('post', '/api/data-import-export/validate', technicien)
      .field('type', 'equipments')
      .attach('file', Buffer.from(csvCas('validation')), {
        filename: 'parc.csv',
        contentType: 'text/csv',
      });

    expect(res.status).not.toBe(403);
    // Et elle n'a bien rien écrit : c'est ce qui justifie de la laisser ouverte.
    expect(await casEcrits('validation')).toHaveLength(0);
  });
});

describe("Témoin : au-dessus du seuil, l'import fonctionne et il est cloisonné", () => {
  it('un responsable importe, et les cas portent SON locataire', async () => {
    const res = await createAuthenticatedRequest('post', '/api/import/maintenance-csv', responsable)
      .send({ csvContent: csvCas('alpha', 2) });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(2);

    const lignes = await casEcrits('alpha');
    expect(lignes).toHaveLength(2);
    // Le cœur de la correction : ces deux routes écrivaient `tenant_id` NULL.
    for (const ligne of lignes) {
      expect(ligne.tenant_id).toBe(SEEDED.tenantAlpha);
      expect(ligne.tenant_id).not.toBeNull();
    }
  });

  it('un responsable d\'un AUTRE locataire écrit chez lui, pas chez le premier', async () => {
    const res = await createAuthenticatedRequest('post', '/api/import/maintenance-csv', responsableBeta)
      .send({ csvContent: csvCas('beta', 1) });

    expect(res.status).toBe(200);

    const lignes = await casEcrits('beta');
    expect(lignes).toHaveLength(1);
    expect(lignes[0].tenant_id).toBe(SEEDED.tenantBeta);
  });

  it('les cas signalés sont cloisonnés de la même façon', async () => {
    const csv =
      [
        'equipmentType,equipmentId,description,reportedBy,urgency',
        `pompe,EQ-${STAMP}-sig,SIGNALE-${STAMP}-alpha,Atelier,medium`,
      ].join('\n') + '\n';

    const res = await createAuthenticatedRequest('post', '/api/import/reported-cases-csv', responsable)
      .send({ csvContent: csv });

    expect(res.status).toBe(200);
    const { rows } = await pool.query<{ tenant_id: string | null }>(
      `SELECT tenant_id FROM reported_cases WHERE description = $1`,
      [`SIGNALE-${STAMP}-alpha`],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].tenant_id).toBe(SEEDED.tenantAlpha);
  });
});
