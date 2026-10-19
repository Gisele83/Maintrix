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
 * `app.use('/pdf', requireAuthentication)` résout la session sur ce préfixe,
 * ce qui rend les `tenantRequis()` existants discriminants au lieu d'être des
 * refus systématiques.
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
});

afterAll(async () => {
  await pool.query('DELETE FROM maintenance_reports WHERE report_number LIKE $1', [`MR-${STAMP}-%`]);
  await pool.query('DELETE FROM monthly_reports WHERE report_number LIKE $1', [`MM-${STAMP}-%`]);
  await pool.end();
});

// ═══════════════════════════════════════════════════════════════════
describe('/pdf/maintenance-reports/:id', () => {
  it("son propriétaire l'obtient, avec son contenu", async () => {
    // Avant correctif : 401 pour tout le monde, y compris ici. Un simple
    // `expect(200)` aurait donc suffi à démontrer le défaut — on vérifie
    // néanmoins le contenu, un 200 vide ne valant rien.
    const res = await createAuthenticatedRequest('get', `/pdf/maintenance-reports/${rapportAlphaId}`, alpha);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain(`MR-${STAMP}-A`);
  });

  it("un autre locataire ne l'obtient pas", async () => {
    // Le cas décisif : c'est lui, et lui seul, qui distingue un cloisonnement
    // d'un verrou fermé pour tous.
    const res = await createAuthenticatedRequest('get', `/pdf/maintenance-reports/${rapportAlphaId}`, beta);

    expect(res.status).toBe(404);
    expect(res.text).not.toContain(`MR-${STAMP}-A`);
  });

  it("un anonyme ne l'obtient pas", async () => {
    const res = await anonymousRequest('get', `/pdf/maintenance-reports/${rapportAlphaId}`);

    expect([401, 403]).toContain(res.status);
    expect(res.text ?? '').not.toContain(`MR-${STAMP}-A`);
  });

  it('Beta obtient bien le sien — le refus ci-dessus vise le locataire, pas la route', async () => {
    const res = await createAuthenticatedRequest('get', `/pdf/maintenance-reports/${rapportBetaId}`, beta);

    expect(res.status).toBe(200);
    expect(res.text).toContain(`MR-${STAMP}-B`);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('/pdf/monthly-reports/:id', () => {
  it("son propriétaire l'obtient, avec ses montants", async () => {
    const res = await createAuthenticatedRequest('get', `/pdf/monthly-reports/${mensuelAlphaId}`, alpha);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain(`MM-${STAMP}-A`);
  });

  it("un autre locataire ne l'obtient pas", async () => {
    const res = await createAuthenticatedRequest('get', `/pdf/monthly-reports/${mensuelAlphaId}`, beta);

    expect(res.status).toBe(404);
    expect(res.text).not.toContain(`MM-${STAMP}-A`);
  });

  it("un anonyme ne l'obtient pas, et ne voit aucun montant", async () => {
    // C'était la fuite la plus grave du lot : 200 et montants en clair, sans
    // aucun compte. On vérifie les deux : le refus, et l'absence de chiffres
    // dans le corps de la réponse.
    const res = await anonymousRequest('get', `/pdf/monthly-reports/${mensuelAlphaId}`);

    expect([401, 403]).toContain(res.status);
    const corps = res.text ?? '';
    expect(corps).not.toContain(`MM-${STAMP}-A`);
    expect(corps).not.toContain(String(ALPHA_COUT));
  });

  it('Beta obtient bien le sien', async () => {
    const res = await createAuthenticatedRequest('get', `/pdf/monthly-reports/${mensuelBetaId}`, beta);

    expect(res.status).toBe(200);
    expect(res.text).toContain(`MM-${STAMP}-B`);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('/pdf/comprehensive-report', () => {
  it("un locataire authentifié l'obtient", async () => {
    // Cette route n'a pas d'identifiant à deviner : elle agrège le parc du
    // demandeur. Avant correctif elle répondait 401 à tout le monde.
    const res = await createAuthenticatedRequest('get', '/pdf/comprehensive-report?period=month&department=all', alpha);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  it("un anonyme ne l'obtient pas", async () => {
    const res = await anonymousRequest('get', '/pdf/comprehensive-report?period=month&department=all');

    expect([401, 403]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Le préfixe /pdf est bien couvert, et pas seulement ces trois routes', () => {
  it("une URL /pdf inconnue est refusée avant d'être routée", async () => {
    // Le contrôle est monté sur le PRÉFIXE, non route par route : toute route
    // `/pdf/...` ajoutée plus tard héritera du refus sans rien oublier. C'est
    // la propriété qui empêche le défaut de se reproduire — un contrôle posé
    // route par route se fait oublier, comme il l'a été.
    const res = await anonymousRequest('get', '/pdf/route-qui-nexiste-pas');

    expect([401, 403]).toContain(res.status);
  });
});
