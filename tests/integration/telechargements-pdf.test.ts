/**
 * Les trois téléchargements PDF : servis à leur propriétaire, refusés ailleurs.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ, ET DANS LES DEUX SENS
 * ═══════════════════════════════════════════════════════════════════
 * Les routes `/pdf/*` de server/routes.ts étaient enregistrées avant
 * `app.use('/api', requireAuthentication)` et hors du préfixe `/api`, seul
 * endroit où le middleware de locataire est monté. Aucun contrôle ne les
 * atteignait, ce qui a produit deux défauts opposés :
 *
 *   • `/pdf/monthly-reports/:id` ne demandait RIEN et servait à un appelant
 *     anonyme les coûts de maintenance agrégés d'un locataire quelconque —
 *     mesuré à 200, 7 443 octets, montants en clair ;
 *   • `/pdf/maintenance-reports/:id` et `/pdf/comprehensive-report`
 *     appelaient `tenantRequis()`, qui lit un `req.tenantId` que personne ne
 *     posait : elles répondaient 401 à tout le monde, propriétaire compris.
 *     Les trois boutons du client étaient donc morts.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI A CHANGÉ DEPUIS, ET POURQUOI CETTE SUITE VISE D'AUTRES URL
 * ═══════════════════════════════════════════════════════════════════
 * Le préfixe `/pdf` n'existe plus. Chacune de ses trois routes avait un jumeau
 * déjà authentifié sous `/api`, et la mesure a montré que les deux premières
 * paires rendaient le MÊME document à l'octet près (empreintes SHA-256 égales,
 * 9 394 et 7 773 octets) — une duplication pure. Pour le rapport complet, le
 * jumeau `/api` s'est avéré un sur-ensemble : il CALCULE les indicateurs que
 * l'ancien imprimait en « N/D ». Les trois documents sont donc servis par les
 * URL `/api`, et cette suite les y suit.
 *
 * Retirer le préfixe, et pas seulement ses routes, est ce qui empêche le défaut
 * de revenir : il n'y a plus d'endroit, hors `/api`, où une route de document
 * puisse être ajoutée sans hériter du cloisonnement.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI EST VÉRIFIÉ
 * ═══════════════════════════════════════════════════════════════════
 * Pour chaque route, les trois cas qui comptent : son propriétaire l'obtient
 * AVEC son contenu, un autre locataire ne l'obtient pas, un anonyme non plus.
 * Le deuxième cas est le seul qui distingue un cloisonnement d'un simple
 * verrou : une route qui refuserait tout le monde passerait les cas 2 et 3.
 *
 * Les assertions portent sur le CONTENU rendu, pas seulement sur le statut :
 * ces routes renvoient du HTML (`text/html`), et un 200 vide ne prouverait
 * rien. On y cherche le numéro de rapport et les montants attendus.
 *
 * ⚠️ Cette suite ne se lance pas avec `jest` seul : `npm test` provisionne la
 * base, le serveur et les variables (voir scripts/run-tests.mjs).
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import {
  anonymousRequest,
  authenticateUser,
  createAuthenticatedRequest,
  SEEDED,
  type AuthenticatedAgent,
} from '../helpers/setup';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL absente — lancez `npm test`.');
const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });

const STAMP = `PDF${Date.now()}`;
const MAINTENANT = new Date();
const MOIS = MAINTENANT.getMonth() + 1;
const ANNEE = MAINTENANT.getFullYear();

/** Montant d'Alpha, reconnaissable et sans chiffre commun avec celui de Beta. */
const ALPHA_COUT = 4242;
const BETA_COUT = 8181;

let alpha: AuthenticatedAgent;
let beta: AuthenticatedAgent;

/** Identifiants des lignes créées, pour viser les bonnes URL. */
let rapportAlphaId: number;
let rapportBetaId: number;
let mensuelAlphaId: number;
let mensuelBetaId: number;
let equipementBeta: string;

async function insererRapport(tenantId: string, suffixe: string, cout: number): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO maintenance_reports
       (tenant_id, report_number, report_type, technician, start_time, end_time,
        work_description, actions_taken, total_cost, labor_cost, parts_cost, status, created_at)
     VALUES ($1,$2,'corrective',$3,now(),now(),$4,'Actions de test',$5,$5,0,'approved',now())
     RETURNING id`,
    [tenantId, `MR-${STAMP}-${suffixe}`, `Tech ${suffixe}`, `Intervention ${suffixe}`, cout],
  );
  return rows[0].id;
}

/**
 * Un équipement nommé d'après son locataire.
 *
 * Nécessaire au test de cloisonnement du parc : sans équipement chez Beta, la
 * boucle d'assertions ne tournerait pas et le test serait vert sans rien
 * vérifier.
 */
async function insererEquipement(tenantId: string, suffixe: string): Promise<string> {
  const nom = `EQUIP-${STAMP}-${suffixe}`;
  await pool.query(
    `INSERT INTO equipment_registry
       (tenant_id, equipment_id, equipment_name, equipment_type, operational_state, created_at)
     VALUES ($1,$2,$3,'tour','operational',now())`,
    [tenantId, `EQ-${STAMP}-${suffixe}`, nom],
  );
  return nom;
}

async function insererMensuel(tenantId: string, suffixe: string, cout: number): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO monthly_reports
       (tenant_id, report_number, month, year, period_start, period_end,
        total_maintenance_cost, labor_cost, parts_cost, total_work_orders, completed_work_orders)
     VALUES ($1,$2,$3,$4,now(),now(),$5,$5,0,1,1)
     RETURNING id`,
    [tenantId, `MM-${STAMP}-${suffixe}`, MOIS, ANNEE, cout],
  );
  return rows[0].id;
}

beforeAll(async () => {
  alpha = await authenticateUser(SEEDED.admin, SEEDED.password);
  beta = await authenticateUser(SEEDED.adminBeta, SEEDED.password);

  rapportAlphaId = await insererRapport(SEEDED.tenantAlpha, 'A', ALPHA_COUT);
  rapportBetaId = await insererRapport(SEEDED.tenantBeta, 'B', BETA_COUT);
  mensuelAlphaId = await insererMensuel(SEEDED.tenantAlpha, 'A', ALPHA_COUT);
  mensuelBetaId = await insererMensuel(SEEDED.tenantBeta, 'B', BETA_COUT);

  await insererEquipement(SEEDED.tenantAlpha, 'A');
  equipementBeta = await insererEquipement(SEEDED.tenantBeta, 'B');
});

afterAll(async () => {
  await pool.query('DELETE FROM maintenance_reports WHERE report_number LIKE $1', [`MR-${STAMP}-%`]);
  await pool.query('DELETE FROM monthly_reports WHERE report_number LIKE $1', [`MM-${STAMP}-%`]);
  // Les tâches de fond du serveur écrivent sur les équipements (alertes,
  // mesures de capteurs) : ces lignes-là partent d'abord, sinon les clés
  // étrangères bloquent la suppression.
  const cibles = `SELECT id FROM equipment_registry WHERE equipment_id LIKE '%${STAMP}%'`;
  const { rows: references } = await pool.query<{ tbl: string; col: string }>(`
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN unnest(c.conkey) WITH ORDINALITY k(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
     WHERE c.contype = 'f' AND c.confrelid = 'equipment_registry'::regclass`);
  for (const { tbl, col } of references) {
    await pool.query(`DELETE FROM ${tbl} WHERE ${col} IN (${cibles})`);
  }
  await pool.query('DELETE FROM equipment_registry WHERE equipment_id LIKE $1', [`EQ-${STAMP}-%`]);
  await pool.end();
});

// ═══════════════════════════════════════════════════════════════════
describe('/api/maintenance-reports/:id/pdf', () => {
  it("son propriétaire l'obtient, avec son contenu", async () => {
    // Avant correctif : 401 pour tout le monde, y compris ici. Un simple
    // `expect(200)` aurait donc suffi à démontrer le défaut — on vérifie
    // néanmoins le contenu, un 200 vide ne valant rien.
    const res = await createAuthenticatedRequest('get', `/api/maintenance-reports/${rapportAlphaId}/pdf`, alpha);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain(`MR-${STAMP}-A`);
    // Le montant, par la VALEUR : c'est lui qui distingue le document d'Alpha
    // de n'importe quel document bien formé.
    expect(res.text).toContain(String(ALPHA_COUT));
  });

  it("un autre locataire ne l'obtient pas", async () => {
    // Le cas décisif : c'est lui, et lui seul, qui distingue un cloisonnement
    // d'un verrou fermé pour tous.
    const res = await createAuthenticatedRequest('get', `/api/maintenance-reports/${rapportAlphaId}/pdf`, beta);

    expect(res.status).toBe(404);
    expect(res.text).not.toContain(`MR-${STAMP}-A`);
    expect(res.text).not.toContain(String(ALPHA_COUT));
  });

  it("un anonyme ne l'obtient pas", async () => {
    const res = await anonymousRequest('get', `/api/maintenance-reports/${rapportAlphaId}/pdf`);

    expect([401, 403]).toContain(res.status);
    expect(res.text ?? '').not.toContain(`MR-${STAMP}-A`);
    expect(res.text ?? '').not.toContain(String(ALPHA_COUT));
  });

  it('Beta obtient bien le sien — le refus ci-dessus vise le locataire, pas la route', async () => {
    const res = await createAuthenticatedRequest('get', `/api/maintenance-reports/${rapportBetaId}/pdf`, beta);

    expect(res.status).toBe(200);
    expect(res.text).toContain(`MR-${STAMP}-B`);
    expect(res.text).toContain(String(BETA_COUT));
    // Et il ne porte AUCUN chiffre d'Alpha : les deux montants n'ont pas de
    // chiffre commun, donc cette absence est significative.
    expect(res.text).not.toContain(String(ALPHA_COUT));
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('/api/monthly-reports/:id/pdf', () => {
  it("son propriétaire l'obtient, avec ses montants", async () => {
    const res = await createAuthenticatedRequest('get', `/api/monthly-reports/${mensuelAlphaId}/pdf`, alpha);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain(`MM-${STAMP}-A`);
    expect(res.text).toContain(String(ALPHA_COUT));
  });

  it("un autre locataire ne l'obtient pas", async () => {
    const res = await createAuthenticatedRequest('get', `/api/monthly-reports/${mensuelAlphaId}/pdf`, beta);

    expect(res.status).toBe(404);
    expect(res.text).not.toContain(`MM-${STAMP}-A`);
    expect(res.text).not.toContain(String(ALPHA_COUT));
  });

  it("un anonyme ne l'obtient pas, et ne voit aucun montant", async () => {
    // C'était la fuite la plus grave du lot : 200 et montants en clair, sans
    // aucun compte. On vérifie les deux : le refus, et l'absence de chiffres
    // dans le corps de la réponse.
    const res = await anonymousRequest('get', `/api/monthly-reports/${mensuelAlphaId}/pdf`);

    expect([401, 403]).toContain(res.status);
    const corps = res.text ?? '';
    expect(corps).not.toContain(`MM-${STAMP}-A`);
    expect(corps).not.toContain(String(ALPHA_COUT));
  });

  it('Beta obtient bien le sien', async () => {
    const res = await createAuthenticatedRequest('get', `/api/monthly-reports/${mensuelBetaId}/pdf`, beta);

    expect(res.status).toBe(200);
    expect(res.text).toContain(`MM-${STAMP}-B`);
    expect(res.text).toContain(String(BETA_COUT));
    expect(res.text).not.toContain(String(ALPHA_COUT));
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('/api/comprehensive-report/pdf', () => {
  it("un locataire authentifié l'obtient", async () => {
    // Cette route n'a pas d'identifiant à deviner : elle agrège le parc du
    // demandeur. L'ancienne `/pdf/comprehensive-report` répondait 401 à tout le
    // monde avant correctif.
    const res = await createAuthenticatedRequest('get', '/api/comprehensive-report/pdf?period=month', alpha);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  it("un anonyme ne l'obtient pas", async () => {
    const res = await anonymousRequest('get', '/api/comprehensive-report/pdf?period=month');

    expect([401, 403]).toContain(res.status);
  });

  it("le document annonce la période réellement couverte, et non « mensuel » par défaut", async () => {
    // ⚠️ Deux défauts, qui se masquaient l'un l'autre. Le sélecteur de l'écran
    // envoie `week|month|quarter|year`, que le service de KPI n'indexait pas
    // (`weekly|monthly|…`) : il repliait sur 30 jours, donc les quatre choix
    // rendaient le même document. Et l'en-tête annonçait « RAPPORT MENSUEL »
    // quoi qu'il arrive, ce qui rendait le repli invisible.
    //
    // On vérifie les deux orthographes, parce que c'est celle de GAUCHE que
    // l'écran envoie réellement — c'est elle qui ne marchait pas.
    for (const [periode, attendu] of [
      ['week', '7 derniers jours'],
      ['weekly', '7 derniers jours'],
      ['year', '365 derniers jours'],
      ['yearly', '365 derniers jours'],
    ] as const) {
      const res = await createAuthenticatedRequest('get', `/api/comprehensive-report/pdf?period=${periode}`, alpha);

      expect({ periode, statut: res.status }).toEqual({ periode, statut: 200 });
      expect({ periode, porteSaPeriode: res.text.includes(attendu) })
        .toEqual({ periode, porteSaPeriode: true });
    }
  });

  it('une période inconnue est refusée, et non repliée en silence', async () => {
    // Un rapport dont la période ne veut rien dire ne doit pas sortir sous une
    // étiquette qui en annonce une autre.
    const res = await createAuthenticatedRequest('get', '/api/comprehensive-report/pdf?period=decennie', alpha);

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe('PERIODE_INCONNUE');
  });

  it("le parc lu est celui du demandeur — vérifié sur le jumeau Excel, qui le rend", async () => {
    // ⚠️ Fuite MESURÉE, pas supposée. Ces deux routes (`/pdf` et `/excel`)
    // partageaient `storage.getEquipment()`, qui lit tout le parc de
    // l'instance. Le gabarit PDF ne rend pas la section des équipements, donc
    // rien n'en sortait de ce côté ; la feuille « Équipements » du classeur, en
    // revanche, la rend ligne par ligne. Alpha exportant SON rapport obtenait
    // l'équipement de Beta.
    //
    // L'assertion porte sur le classeur et non sur le PDF, parce que c'est là
    // que la donnée sort réellement : vérifier le PDF aurait été vert avant
    // comme après, et n'aurait rien prouvé.
    const res = await createAuthenticatedRequest('get', '/api/comprehensive-report/excel?period=month', alpha)
      .buffer(true)
      .parse((r, cb) => {
        const morceaux: Buffer[] = [];
        r.on('data', (c: Buffer) => morceaux.push(c));
        r.on('end', () => cb(null, Buffer.concat(morceaux)));
      });

    expect(res.status).toBe(200);

    // Le contenu d'un .xlsx est compressé : une recherche de sous-chaîne sur
    // l'octet ne prouverait rien. On le déplie.
    const XLSX = await import('xlsx');
    const classeur = XLSX.read(res.body as Buffer, { type: 'buffer' });
    const feuille = classeur.SheetNames.find(n => /quipement/i.test(n));
    expect(feuille).toBeDefined();

    const lignes = XLSX.utils.sheet_to_json(classeur.Sheets[feuille!], { header: 1 });
    const texte = JSON.stringify(lignes);

    // Les deux équipements créés par cette suite portent le nom de leur
    // locataire. Celui d'Alpha DOIT être là — sans quoi le classeur serait vide
    // et l'absence de celui de Beta ne prouverait rien. Celui de Beta ne doit
    // pas y être.
    expect({ sonPropreEquipement: texte.includes(`EQUIP-${STAMP}-A`) })
      .toEqual({ sonPropreEquipement: true });
    expect({ equipementDeBeta: texte.includes(equipementBeta) })
      .toEqual({ equipementDeBeta: false });
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Les anciennes URL /pdf ne servent plus aucun document', () => {
  // Le contrôle ne tient plus à un middleware monté sur un préfixe : le
  // préfixe lui-même a disparu, donc il n'y a plus de route de document hors
  // de `/api`. Ce qui est vérifié ici n'est donc plus « le refus est bien
  // monté », mais « plus rien ne sort par là » — ce qui est strictement plus
  // fort, et c'est ce qui empêche le défaut de se reproduire.
  //
  // Ces URL atteignent maintenant le repli de l'application monopage. On
  // n'affirme donc RIEN sur le statut (une coquille d'application est un 200
  // légitime) : on affirme que le corps ne contient ni numéro de rapport, ni
  // montant.
  it("un anonyme n'obtient aucune donnée des trois anciennes URL", async () => {
    for (const chemin of [
      `/pdf/maintenance-reports/${rapportAlphaId}`,
      `/pdf/monthly-reports/${mensuelAlphaId}`,
      '/pdf/comprehensive-report?period=month&department=all',
    ]) {
      const res = await anonymousRequest('get', chemin);
      const corps = res.text ?? '';

      expect({ chemin, porteUnNumero: /M[RM]-PDF\d+-[AB]/.test(corps) })
        .toEqual({ chemin, porteUnNumero: false });
      expect({ chemin, porteUnMontant: corps.includes(String(ALPHA_COUT)) })
        .toEqual({ chemin, porteUnMontant: false });
    }
  });

  it("un locataire authentifié n'obtient plus de document par les anciennes URL", async () => {
    // Le cas qui compte vraiment pour une suppression : le PROPRIÉTAIRE non
    // plus ne reçoit rien ici. Sinon un gestionnaire oublié continuerait de
    // servir le document par un second chemin de code — exactement ce que
    // cette refonte supprime.
    for (const chemin of [
      `/pdf/maintenance-reports/${rapportAlphaId}`,
      `/pdf/monthly-reports/${mensuelAlphaId}`,
    ]) {
      const res = await createAuthenticatedRequest('get', chemin, alpha);
      const corps = res.text ?? '';

      expect({ chemin, porteUnNumero: /M[RM]-PDF\d+-A/.test(corps) })
        .toEqual({ chemin, porteUnNumero: false });
      expect({ chemin, porteUnMontant: corps.includes(String(ALPHA_COUT)) })
        .toEqual({ chemin, porteUnMontant: false });
    }
  });
});
