/**
 * Le diagnostic reste-t-il dans l'organisation de celui qui le demande ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ (mesuré le 2026-10-25)
 * ═══════════════════════════════════════════════════════════════════
 * Les onze lectures du pipeline de diagnostic — cas de maintenance, sessions,
 * mémoire des pannes, tendances de défaillance, équipements, ordres de travail,
 * compteurs — s'exécutaient SANS filtre de locataire. `tenantId` était
 * optionnel sur la requête, et `getFailureMemoryMatches` le recevait même en
 * paramètre sans jamais l'employer dans son `WHERE`.
 *
 * Mesuré : un technicien du locataire ALPHA demandant un diagnostic recevait
 * SIX occurrences des données du locataire BETA — dont le diagnostic et la
 * solution de BETA proposés comme suggestions, sa session close en « incident
 * similaire », sa tendance de défaillance et la criticité de sa machine en
 * signal de contexte. Pire : le cas d'ALPHA, moins bien noté, était ÉCARTÉ au
 * profit de celui de BETA.
 *
 * Trois autres portes menaient à la même table :
 *   • `/api/maintenance-cases` et six autres lectures de `routes.ts` servaient
 *     les cas de toutes les organisations ;
 *   • `/api/diagnostic-test` figurait dans `publicPaths` : un appel ANONYME
 *     exécutait le pipeline complet sur les données de tout le monde ;
 *   • `/api/feedback` acceptait un retour sur la session d'une AUTRE
 *     organisation (200), écrivait une ligne rattachée à cette session, et
 *     alimentait `failure_memory` avec le diagnostic d'autrui.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE MESURE
 * ═══════════════════════════════════════════════════════════════════
 * Chaque cas pose des données marquées « SECRETBETA » dans le locataire BETA,
 * puis interroge en tant qu'ALPHA et compte les occurrences du marqueur dans la
 * réponse ENTIÈRE — pas seulement dans le champ attendu : une fuite déplacée
 * d'un champ à l'autre resterait une fuite.
 *
 * Et le contrôle symétrique, sans lequel « zéro fuite » ne prouve rien : ALPHA
 * doit continuer à voir SES données. Un cloisonnement qui rend les écrans muets
 * n'est pas un cloisonnement.
 *
 * ⚠️ Cette suite ne se lance pas avec `jest` seul : `npm test` provisionne la
 * base, le serveur et les variables (voir scripts/run-tests.mjs).
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import {
  authenticateUser,
  createAuthenticatedRequest,
  anonymousRequest,
  SEEDED,
  type AuthenticatedAgent,
} from '../helpers/setup';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL absente — lancez `npm test`.');
const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });

const STAMP = `CLO${Date.now()}`;
/** Marqueur porté par toutes les données de BETA. Aucune réponse à ALPHA ne doit le contenir. */
const SECRET = 'SECRETBETA';
const SYMPTOMES = `Bruit anormal et vibrations ${STAMP}`;
const TYPE = 'moteur';

let alpha: AuthenticatedAgent;
let beta: AuthenticatedAgent;

let casBeta: number;
let casAlpha: number;
let sessionBeta: number;

/** Combien de fois les données de BETA apparaissent dans une réponse ? */
function fuites(corps: unknown): number {
  return (JSON.stringify(corps ?? null).match(new RegExp(SECRET, 'gi')) || []).length;
}

const diagnostiquer = (agent: AuthenticatedAgent, chemin = '/api/diagnostic') =>
  createAuthenticatedRequest('post', chemin, agent).send({
    equipmentType: TYPE,
    symptoms: SYMPTOMES,
    urgency: 'medium',
    zone: 'production',
    sector: 'Ligne 1',
  });

beforeAll(async () => {
  alpha = await authenticateUser(SEEDED.technician, SEEDED.password);
  beta = await authenticateUser(SEEDED.adminBeta, SEEDED.password);

  // ── Tout le dossier technique de BETA ────────────────────────────
  casBeta = (await pool.query(
    `INSERT INTO maintenance_cases (tenant_id, equipment_type, symptoms, diagnosis, solution, urgency, confidence, resolved)
     VALUES ($1,$2,$3,$4,$5,'medium',0.99,true) RETURNING id`,
    [SEEDED.tenantBeta, TYPE, SYMPTOMES, `${SECRET} roulement broyé`, `${SECRET} remplacer le rotor`],
  )).rows[0].id;

  await pool.query(
    `INSERT INTO repair_procedures (tenant_id, case_id, step_number, title, title_en, description, description_en)
     VALUES ($1,$2,1,$3,'step','desc','desc')`,
    [SEEDED.tenantBeta, casBeta, `${SECRET} gamme de réparation`],
  );

  sessionBeta = (await pool.query(
    `INSERT INTO diagnostic_sessions (tenant_id, equipment_type, symptoms, urgency, status, selected_diagnosis)
     VALUES ($1,$2,$3,'medium','completed',$4) RETURNING id`,
    [SEEDED.tenantBeta, TYPE, SYMPTOMES, `${SECRET} session close`],
  )).rows[0].id;

  await pool.query(
    `INSERT INTO failure_trends (tenant_id, equipment_type, failure_code, occurrences, trend_direction)
     VALUES ($1,$2,$3,42,'increasing')`,
    [SEEDED.tenantBeta, TYPE, `${SECRET}_code`],
  );
  await pool.query(
    `INSERT INTO failure_memory (tenant_id, equipment_type, symptom_signature, diagnosis, solution, confirmed_count, status)
     VALUES ($1,$2,$3,$4,$5,5,'active')`,
    [SEEDED.tenantBeta, TYPE, SYMPTOMES, `${SECRET} mémoire`, `${SECRET} solution apprise`],
  );
  await pool.query(
    `INSERT INTO equipment_registry (tenant_id, equipment_id, equipment_name, equipment_type, lifecycle_stage, criticality_level)
     VALUES ($1,$2,$3,$4,'operational','critical')`,
    [SEEDED.tenantBeta, `EQ-${STAMP}`, `${SECRET} machine`, TYPE],
  );
  await pool.query(
    `INSERT INTO work_orders (tenant_id, order_number, order_type, title, description, validation_status)
     VALUES ($1,$2,'corrective',$3,$4,'pending')`,
    [SEEDED.tenantBeta, `WO-${STAMP}`, `${TYPE} ${SECRET} à réviser`, `Intervention ${SECRET}`],
  );

  // ── Et le cas d'ALPHA, qui doit rester visible d'ALPHA ───────────
  casAlpha = (await pool.query(
    `INSERT INTO maintenance_cases (tenant_id, equipment_type, symptoms, diagnosis, solution, urgency, confidence, resolved)
     VALUES ($1,$2,$3,$4,$5,'medium',0.95,true) RETURNING id`,
    [SEEDED.tenantAlpha, TYPE, SYMPTOMES, `CASALPHA frein de parking collé`, 'CASALPHA libérer le frein'],
  )).rows[0].id;
}, 90_000);

afterAll(async () => {
  // Les sessions de diagnostic créées PAR les requêtes de cette suite, et leurs
  // retours, avant les documents qu'elles référencent.
  await pool.query(
    `DELETE FROM feedback_sessions WHERE session_id IN
       (SELECT id FROM diagnostic_sessions WHERE symptoms = $1)`, [SYMPTOMES]);
  await pool.query(`DELETE FROM diagnostic_sessions WHERE symptoms = $1`, [SYMPTOMES]);
  // Par `case_id`, et non par titre : la route `/api/repair/:caseId` crée des
  // gammes par défaut dont les titres ne portent aucun marqueur. C'est ce
  // nettoyage incomplet qui a révélé qu'elle écrivait dans le dossier d'une
  // autre organisation.
  await pool.query(
    `DELETE FROM repair_procedures WHERE case_id IN
       (SELECT id FROM maintenance_cases WHERE symptoms = $1)`, [SYMPTOMES]);
  await pool.query(`DELETE FROM maintenance_cases WHERE symptoms = $1`, [SYMPTOMES]);
  await pool.query(`DELETE FROM failure_memory WHERE symptom_signature = $1`, [SYMPTOMES]);
  await pool.query(`DELETE FROM failure_trends WHERE failure_code LIKE $1`, [`${SECRET}%`]);
  await pool.query(`DELETE FROM work_orders WHERE order_number = $1`, [`WO-${STAMP}`]);

  // ⚠️ Plusieurs tables alimentées en continu par les tâches de fond du serveur
  // référencent `equipment_registry` : les référents d'abord, sinon la
  // suppression échoue sur contrainte de clé étrangère.
  const ref = `(SELECT id FROM equipment_registry WHERE equipment_id = $1)`;
  for (const table of ['iot_sensor_data', 'alerts_notifications', 'iot_devices',
    'maintenance_reports', 'smart_notifications', 'automated_symptom_detection']) {
    await pool.query(`DELETE FROM ${table} WHERE equipment_id IN ${ref}`, [`EQ-${STAMP}`]);
  }
  await pool.query(`DELETE FROM equipment_registry WHERE equipment_id = $1`, [`EQ-${STAMP}`]);
  await pool.end();
}, 90_000);

// ═══════════════════════════════════════════════════════════════════
describe('Diagnostic hybride — rien ne traverse la frontière', () => {
  it("aucune donnée de BETA n'apparaît dans le diagnostic d'ALPHA", async () => {
    const r = await diagnostiquer(alpha);

    expect(r.status).toBe(200);
    // La réponse entière, pas seulement le champ attendu.
    expect(fuites(r.body)).toBe(0);
    expect(fuites(r.body.suggestions)).toBe(0);
    expect(fuites(r.body.similarIncidents)).toBe(0);
    expect(fuites(r.body.failureTrends)).toBe(0);
    expect(fuites(r.body.contextSignals)).toBe(0);
  }, 90_000);

  it('ALPHA voit en revanche SON propre cas — le cloisonnement ne rend pas muet', async () => {
    const r = await diagnostiquer(alpha);

    expect(r.status).toBe(200);
    // Le cas d'ALPHA était écarté par celui de BETA, mieux noté : il doit
    // désormais remonter, et par le moteur historique.
    expect(JSON.stringify(r.body)).toContain('CASALPHA');
    const historiques = (r.body.suggestions as Array<{ source: string; diagnosis: string }>)
      .filter((s) => s.source === 'historical');
    expect(historiques.some((s) => s.diagnosis.includes('CASALPHA'))).toBe(true);
  }, 90_000);

  it('BETA voit son cas, et pas celui d\'ALPHA — la frontière tient dans les deux sens', async () => {
    const r = await diagnostiquer(beta);

    expect(r.status).toBe(200);
    const texte = JSON.stringify(r.body);
    expect(texte).toContain(SECRET);
    expect(texte).not.toContain('CASALPHA');
  }, 90_000);

  it("le moteur « enhanced » de /api/diagnostic/analyze est cloisonné lui aussi", async () => {
    const r = await createAuthenticatedRequest('post', '/api/diagnostic/analyze', alpha)
      .send({ equipmentType: TYPE, symptoms: SYMPTOMES, urgency: 'medium' });

    expect(r.status).toBe(200);
    expect(fuites(r.body)).toBe(0);
  }, 90_000);
});

// ═══════════════════════════════════════════════════════════════════
describe('Les autres portes vers la même table', () => {
  it('/api/maintenance-cases ne rend que les cas du locataire', async () => {
    const vue = await createAuthenticatedRequest('get', '/api/maintenance-cases', alpha);

    expect(vue.status).toBe(200);
    expect(fuites(vue.body)).toBe(0);
    const ids = (vue.body as Array<{ id: number }>).map((c) => c.id);
    expect(ids).toContain(casAlpha);
    expect(ids).not.toContain(casBeta);
  }, 90_000);

  it("/api/repair/:caseId refuse le cas d'une autre organisation — et n'y écrit rien", async () => {
    // Mesuré : la route ne trouvait aucune gamme pour ce cas étranger et en
    // FABRIQUAIT quatre, `tenant_id` à NULL, rattachées au cas de BETA. Une
    // lecture écrivait dans le dossier d'autrui.
    const vue = await createAuthenticatedRequest('get', `/api/repair/${casBeta}`, alpha);

    expect(vue.status).toBe(404);
    expect(fuites(vue.body)).toBe(0);
    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM repair_procedures WHERE case_id = $1', [casBeta]);
    // La seule gamme de ce cas reste celle que BETA possédait au départ.
    expect(rows[0].n).toBe(1);
  }, 90_000);

  it('/api/repair/:caseId sert le cas du locataire, et complète ses gammes dans son locataire', async () => {
    const vue = await createAuthenticatedRequest('get', `/api/repair/${casAlpha}`, alpha);

    expect(vue.status).toBe(200);
    expect(vue.body.case.id).toBe(casAlpha);
    expect((vue.body.procedures as unknown[]).length).toBeGreaterThan(0);
    const { rows } = await pool.query(
      'SELECT DISTINCT tenant_id FROM repair_procedures WHERE case_id = $1', [casAlpha]);
    expect(rows.map((l: { tenant_id: string }) => l.tenant_id)).toEqual([SEEDED.tenantAlpha]);
  }, 90_000);

  it('/api/diagnostic-test refuse un appel ANONYME', async () => {
    // La route figurait dans `publicPaths` : sans session, elle exécutait le
    // pipeline sur les données de toutes les organisations.
    const r = await anonymousRequest('post', '/api/diagnostic-test')
      .send({ equipmentType: TYPE, symptoms: SYMPTOMES, urgency: 'medium' });

    expect([401, 403]).toContain(r.status);
    expect(fuites(r.body)).toBe(0);
  }, 90_000);

  it('/api/diagnostic-test est cloisonné pour une session valide', async () => {
    const r = await diagnostiquer(alpha, '/api/diagnostic-test');

    expect(r.status).toBe(200);
    expect(fuites(r.body)).toBe(0);
  }, 90_000);
});

// ═══════════════════════════════════════════════════════════════════
describe("Retour d'expérience — on ne note que ses propres sessions", () => {
  const lignesDeRetour = async (sessionId: number) => (await pool.query(
    'SELECT count(*)::int AS n FROM feedback_sessions WHERE session_id = $1', [sessionId],
  )).rows[0].n as number;

  it("un retour sur la session d'une AUTRE organisation est refusé, et rien n'est écrit", async () => {
    const memoireAvant = (await pool.query('SELECT count(*)::int AS n FROM failure_memory')).rows[0].n;

    const r = await createAuthenticatedRequest('post', '/api/feedback', alpha).send({
      sessionId: sessionBeta,
      rating: 5,
      helpful: true,
      comments: 'retour posé par ALPHA sur une session de BETA',
      actualDiagnosis: 'ALPHA réécrit le diagnostic de BETA',
      actualSolution: 'ALPHA impose sa solution',
    });

    expect(r.status).toBe(404);
    expect(await lignesDeRetour(sessionBeta)).toBe(0);
    // Et la mémoire de diagnostic de BETA n'a rien appris d'ALPHA.
    const memoireApres = (await pool.query('SELECT count(*)::int AS n FROM failure_memory')).rows[0].n;
    expect(memoireApres).toBe(memoireAvant);
  }, 90_000);

  it("un retour sur SA session est accepté, et n'écrit qu'UNE ligne", async () => {
    // Une session d'ALPHA, créée par son propre diagnostic.
    const diag = await diagnostiquer(alpha);
    expect(diag.status).toBe(200);
    const sessionAlpha = diag.body.sessionId as number;

    const r = await createAuthenticatedRequest('post', '/api/feedback', alpha).send({
      sessionId: sessionAlpha, rating: 5, helpful: true, comments: 'retour légitime',
    });

    expect(r.status).toBe(200);
    // La route écrivait la ligne en plus du pipeline : un retour en créait DEUX,
    // et comptait donc double dans toute statistique de retours.
    expect(await lignesDeRetour(sessionAlpha)).toBe(1);
  }, 90_000);
});
