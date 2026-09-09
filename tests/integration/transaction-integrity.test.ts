/**
 * Intégrité transactionnelle des opérations multi-étapes — F04.
 *
 * ═══════════════════════════════════════════════════════════════════
 * MÉTHODE D'INJECTION DE PANNE
 * ═══════════════════════════════════════════════════════════════════
 * Aucun crochet de test n'est ajouté au code applicatif. On installe à la
 * place un TRIGGER PostgreSQL qui fait échouer une écriture précise — la
 * DEUXIÈME étape d'une opération multi-étapes — puis on appelle l'endpoint
 * normalement et on inspecte la base.
 *
 * Le contrat vérifié est simple : **tout ou rien**. Si la seconde étape
 * échoue, la première ne doit avoir laissé aucune trace.
 *
 * Sans transaction, chacun de ces tests observe une ligne orpheline : c'est
 * exactement l'incohérence que F04 corrige.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Pool } from 'pg';
import {
  authenticateUser,
  createAuthenticatedRequest,
  SEEDED,
  superAdminRequest,
  freshCsrfToken,
  type AuthenticatedAgent,
} from '../helpers/setup';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL absente — lancez `npm test`, pas `jest` directement.');
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
let auth: AuthenticatedAgent;

/**
 * Installe un trigger qui fait systématiquement échouer une écriture sur
 * `table`, exécute `fn`, puis retire le trigger — même en cas d'échec.
 */
async function withFailingWrite<T>(
  table: string,
  event: 'INSERT' | 'UPDATE',
  fn: () => Promise<T>,
): Promise<T> {
  const fname = `f04_fail_${table}_${event.toLowerCase()}`;
  const tname = `t_${fname}`;
  await pool.query(`
    CREATE OR REPLACE FUNCTION ${fname}() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'F04_PANNE_INJECTEE sur ${table}';
    END; $$ LANGUAGE plpgsql;
  `);
  await pool.query(`DROP TRIGGER IF EXISTS ${tname} ON ${table};`);
  await pool.query(`
    CREATE TRIGGER ${tname} BEFORE ${event} ON ${table}
    FOR EACH ROW EXECUTE FUNCTION ${fname}();
  `);
  try {
    return await fn();
  } finally {
    await pool.query(`DROP TRIGGER IF EXISTS ${tname} ON ${table};`);
    await pool.query(`DROP FUNCTION IF EXISTS ${fname}();`);
  }
}

async function countWhere(table: string, where: string, params: unknown[]): Promise<number> {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE ${where}`, params);
  return rows[0].n as number;
}

beforeAll(async () => {
  auth = await authenticateUser(SEEDED.admin, SEEDED.password);
});

afterAll(async () => {
  await pool.end();
});

// ═══════════════════════════════════════════════════════════════════
describe('F04 — Budget : transaction financière et imputation', () => {
  let budgetId: string;

  beforeAll(async () => {
    const res = await createAuthenticatedRequest('post', '/api/budgets', auth).send({
      title: `Budget intégrité ${Date.now()}`,
      fiscalYear: 2026,
      budgetType: 'maintenance',
      totalAllocated: 100000,
      currency: 'EUR',
      lines: [],
    });
    expect([200, 201]).toContain(res.status);
    budgetId = res.body.id;
    expect(budgetId).toBeDefined();
  });

  it('cas nominal : la dépense est enregistrée ET imputée au budget', async () => {
    const res = await createAuthenticatedRequest('post', `/api/budgets/${budgetId}/transactions`, auth).send({
      transactionType: 'expense',
      amount: 1500,
      description: 'Dépense nominale intégrité',
      transactionDate: new Date().toISOString().slice(0, 10),
    });
    expect(res.status).toBe(201);

    const { rows } = await pool.query('SELECT total_spent FROM budget_plans WHERE id=$1', [budgetId]);
    expect(Number(rows[0].total_spent)).toBe(1500);
  });

  it('si l\'imputation échoue, la dépense ne doit PAS rester enregistrée', async () => {
    const before = await countWhere('budget_transactions', 'budget_id=$1', [budgetId]);
    const { rows: b0 } = await pool.query('SELECT total_spent FROM budget_plans WHERE id=$1', [budgetId]);

    // Le trigger fait échouer la MISE À JOUR du budget, seconde étape de
    // l'opération. L'INSERT de la transaction, lui, réussit.
    const res = await withFailingWrite('budget_plans', 'UPDATE', () =>
      createAuthenticatedRequest('post', `/api/budgets/${budgetId}/transactions`, auth).send({
        transactionType: 'expense',
        amount: 4242,
        description: 'Dépense qui doit être annulée',
        transactionDate: new Date().toISOString().slice(0, 10),
      }),
    );

    // L'opération doit échouer franchement.
    expect(res.status).toBeGreaterThanOrEqual(400);

    // ── Le cœur du test ──────────────────────────────────────────────
    // Sans transaction : la ligne de dépense reste, le total n'a pas bougé →
    // le budget sous-estime durablement les dépenses, sans aucune alerte.
    const after = await countWhere('budget_transactions', 'budget_id=$1', [budgetId]);
    expect(after).toBe(before);

    const orphan = await countWhere('budget_transactions', 'budget_id=$1 AND amount=$2', [budgetId, 4242]);
    expect(orphan).toBe(0);

    // Le total doit être resté strictement identique.
    const { rows: b1 } = await pool.query('SELECT total_spent FROM budget_plans WHERE id=$1', [budgetId]);
    expect(Number(b1[0].total_spent)).toBe(Number(b0[0].total_spent));
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('F04 — Budget : dépenses concurrentes', () => {
  let budgetId: string;

  beforeAll(async () => {
    const res = await createAuthenticatedRequest('post', '/api/budgets', auth).send({
      title: `Budget concurrence ${Date.now()}`,
      fiscalYear: 2026,
      budgetType: 'maintenance',
      totalAllocated: 100000,
      currency: 'EUR',
      lines: [],
    });
    expect([200, 201]).toContain(res.status);
    budgetId = res.body.id;
  });

  it('dix dépenses simultanées sont toutes imputées, sans perte', async () => {
    const N = 10;
    const AMOUNT = 100;

    const results = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        createAuthenticatedRequest('post', `/api/budgets/${budgetId}/transactions`, auth).send({
          transactionType: 'expense',
          amount: AMOUNT,
          description: `Dépense concurrente ${i}`,
          transactionDate: new Date().toISOString().slice(0, 10),
        }),
      ),
    );
    for (const r of results) expect(r.status).toBe(201);

    // Propriété métier réellement vérifiée : le total imputé correspond
    // exactement à la somme des mouvements. Une écriture perdue (deux
    // transactions lisant le même total avant de l'écrire) se traduirait par un
    // total inférieur — un écart budgétaire silencieux.
    const { rows } = await pool.query('SELECT total_spent FROM budget_plans WHERE id=$1', [budgetId]);
    expect(Number(rows[0].total_spent)).toBe(N * AMOUNT);

    const lines = await countWhere('budget_transactions', 'budget_id=$1', [budgetId]);
    expect(lines).toBe(N);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('F04 — Intervention : exécution et première étape', () => {
  /**
   * Crée un ordre de travail exploitable et renvoie son identifiant ainsi que
   * celui de l'équipement associé.
   *
   * `CreateExecutionSchema` exige un `equipmentId` NUMÉRIQUE obligatoire. Le
   * `POST /api/work-orders` crée l'équipement à la volée quand on lui passe un
   * `equipmentName` : on relit donc l'identifiant réel depuis la ligne créée,
   * plutôt que de le deviner.
   */
  async function createWorkOrder(label: string): Promise<{ workOrderId: number; equipmentId: number }> {
    const wo = await createAuthenticatedRequest('post', '/api/work-orders', auth).send({
      title: `OT intégrité ${label} ${Date.now()}`,
      description: 'Ordre de travail pour test transactionnel',
      priority: 'medium',
      status: 'pending',
      equipmentName: `TX-EQ-${label}-${Date.now()}`,
    });
    expect([200, 201]).toContain(wo.status);
    const workOrderId = wo.body?.id ?? wo.body?.workOrder?.id;
    expect(typeof workOrderId).toBe('number');

    const { rows } = await pool.query('SELECT equipment_id FROM work_orders WHERE id=$1', [workOrderId]);
    const equipmentId = rows[0]?.equipment_id;
    expect(typeof equipmentId).toBe('number');

    return { workOrderId, equipmentId };
  }

  // Le chemin nominal est vérifié EN PREMIER, et volontairement : sans lui, le
  // test d'injection pourrait « passer » simplement parce que l'opération
  // échoue en amont (ordre de travail introuvable, validation refusée…) sans
  // jamais atteindre l'écriture qu'on prétend faire échouer.
  it('cas nominal : l\'exécution ET sa première étape sont créées', async () => {
    const { workOrderId, equipmentId } = await createWorkOrder('nominal');

    const res = await createAuthenticatedRequest('post', '/api/interventions', auth).send({ workOrderId, equipmentId });
    expect(res.status).toBe(201);
    expect(res.body.execution).toBeDefined();
    expect(res.body.currentStep).toBeDefined();

    const executions = await countWhere('intervention_executions', 'work_order_id=$1', [workOrderId]);
    expect(executions).toBe(1);
    const steps = await countWhere('intervention_steps', 'execution_id=$1', [res.body.execution.id]);
    expect(steps).toBe(1);
  });

  it('si la première étape échoue, aucune exécution orpheline ne doit subsister', async () => {
    const { workOrderId, equipmentId } = await createWorkOrder('injection');
    const before = await countWhere('intervention_executions', 'work_order_id=$1', [workOrderId]);
    expect(before).toBe(0);

    const res = await withFailingWrite('intervention_steps', 'INSERT', () =>
      createAuthenticatedRequest('post', '/api/interventions', auth).send({ workOrderId, equipmentId }),
    );

    // L'opération doit échouer — et pour la BONNE raison : le chemin nominal
    // ci-dessus prouve que le même appel réussit sans le trigger.
    expect(res.status).toBeGreaterThanOrEqual(400);

    // Sans transaction : une intervention_executions existe sans aucune étape.
    // Le workflow est alors définitivement bloqué pour cet ordre de travail.
    const after = await countWhere('intervention_executions', 'work_order_id=$1', [workOrderId]);
    expect(after).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('F04 — Création de tenant : tenant + administrateur + licence', () => {
  let superAdminToken = '';

  beforeAll(async () => {
    const { default: request } = await import('supertest');
    const res = await request(process.env.API_URL as string)
      .post('/api/super-admin/login')
      .send({
        email: process.env.SUPER_ADMIN_EMAIL,
        password: process.env.SUPER_ADMIN_PASSWORD,
        secretKey: process.env.SUPER_ADMIN_SECRET,
      });
    if (res.status !== 200) {
      throw new Error(
        `Connexion super-admin impossible (HTTP ${res.status}) : ${JSON.stringify(res.body)}\n` +
        'SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD / SUPER_ADMIN_SECRET sont-ils bien transmis ' +
        'par scripts/run-tests.mjs ?',
      );
    }
    superAdminToken = res.body.token ?? res.body.superAdminToken ?? '';
    expect(superAdminToken).toBeTruthy();
  });

  async function createTenant(name: string, adminEmail: string) {
    // `superAdminRequest` ajoute le jeton CSRF : depuis F06, /api/super-admin
    // n'est plus exempté en bloc et une écriture sans en-tête reçoit un 403.
    const csrf = await freshCsrfToken();
    return superAdminRequest('post', '/api/super-admin/tenants', superAdminToken, csrf)
      .send({
        name,
        domain: `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.test.local`,
        adminEmail,
        adminFirstName: 'Admin',
        adminLastName: 'Test',
        maxUsers: 5,
      });
  }

  it('cas nominal : le tenant, son administrateur ET sa licence sont créés', async () => {
    const name = `TenantNominal${Date.now()}`;
    const res = await createTenant(name, `admin-${Date.now()}@nominal.test.local`);
    expect([200, 201]).toContain(res.status);

    const { rows } = await pool.query('SELECT id, license_key FROM tenants WHERE name=$1', [name]);
    expect(rows).toHaveLength(1);
    const tenantId = rows[0].id;

    // Les trois effets doivent être présents ensemble.
    expect(await countWhere('user_profiles', 'tenant_id=$1', [tenantId])).toBe(1);
    expect(rows[0].license_key).toBeTruthy();
    expect(await countWhere('license_history', 'tenant_id=$1', [tenantId])).toBe(1);
  });

  it('si la création de l\'administrateur échoue, aucun tenant orphelin ne doit subsister', async () => {
    const name = `TenantOrphelin${Date.now()}`;
    const before = await countWhere('tenants', 'name=$1', [name]);
    expect(before).toBe(0);

    const res = await withFailingWrite('user_profiles', 'INSERT', () =>
      createTenant(name, `admin-${Date.now()}@orphelin.test.local`),
    );

    expect(res.status).toBeGreaterThanOrEqual(400);

    // Sans transaction : le tenant existe sans aucun administrateur. Personne
    // ne peut s'y connecter, et une nouvelle tentative bute sur l'unicité du
    // nom et du domaine désormais pris — état non rattrapable.
    const after = await countWhere('tenants', 'name=$1', [name]);
    expect(after).toBe(0);
  });

  it('si l\'historique de licence échoue, aucun tenant orphelin ne doit subsister', async () => {
    const name = `TenantLicence${Date.now()}`;

    const res = await withFailingWrite('license_history', 'INSERT', () =>
      createTenant(name, `admin-${Date.now()}@licence.test.local`),
    );

    expect(res.status).toBeGreaterThanOrEqual(400);

    // L'initialisation de licence était enveloppée dans un try/catch qui
    // absorbait l'erreur : le tenant était créé sans licence exploitable.
    expect(await countWhere('tenants', 'name=$1', [name])).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('F04 — Catalogue de modules : purge puis réinsertion', () => {
  // `initializeModuleCatalog()` fait DELETE de tout le catalogue puis réinsère
  // les modules un par un, à CHAQUE démarrage du serveur. Une panne en cours de
  // boucle laisse le catalogue vide ou partiel, ce qui affecte le contrôle
  // d'accès aux modules de toute la plateforme.
  it('le catalogue est peuplé après le démarrage du serveur', async () => {
    const n = await countWhere('module_catalog', '1=1', []);
    expect(n).toBeGreaterThan(0);
  });
});
