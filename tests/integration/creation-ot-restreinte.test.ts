/**
 * Créer un ordre de travail engage la planification et le budget.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT
 * ═══════════════════════════════════════════════════════════════════
 * `POST /api/work-orders` n'avait AUCUN contrôle de rôle. L'audit du
 * 2026-10-25 (section 1) le relevait comme première conséquence de l'absence
 * de demande d'intervention : « n'importe qui doit créer directement un OT,
 * c'est-à-dire engager la planification et le budget ».
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE VERROUILLE
 * ═══════════════════════════════════════════════════════════════════
 *   1. un technicien ne crée plus d'ordre directement — et RIEN n'est écrit ;
 *   2. le refus NOMME l'alternative : un refus qui ne dit pas quoi faire ne
 *      fait qu'empêcher le travail ;
 *   3. le niveau est celui de l'ARBITRAGE d'une demande. Si créer était plus
 *      permissif qu'arbitrer, la séparation DI / OT se contournerait par la
 *      porte d'à côté ;
 *   4. LES TROIS PORTES sont fermées au même seuil — la création directe, la
 *      conversion d'une recommandation, et l'arbitrage d'une demande. Une
 *      seule porte restée ouverte rendrait la restriction cosmétique ;
 *   5. les créations AUTOMATIQUES ne sont pas touchées : elles n'empruntent
 *      pas la route HTTP ;
 *   6. témoin — un chef d'équipe crée toujours. Sans lui, une route cassée
 *      pour tout le monde passerait pour une restriction réussie.
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

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL absente — lancez `npm test`.');
const pool = new Pool({ connectionString: DATABASE_URL, max: 6 });

const STAMP = `RES${Date.now()}`;

let admin: AuthenticatedAgent;        // niveau 6 — au-dessus de tout
let technicien: AuthenticatedAgent;   // niveau 1 — ne crée plus
let chefEquipe: AuthenticatedAgent;   // niveau 2 — le seuil retenu

async function insererEquipement(suffixe: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO equipment_registry (tenant_id, equipment_id, equipment_name, equipment_type, location)
     VALUES ($1, $2, $3, 'pompe', 'Atelier restriction') RETURNING id`,
    [SEEDED.tenantAlpha, `EQ-${STAMP}-${suffixe}`, `EQUIPEMENT-${STAMP}-${suffixe}`],
  );
  return rows[0].id;
}

/** Les ordres de cette suite, repérés par leur titre. */
async function nombreOrdres(suffixe: string): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*) AS n FROM work_orders WHERE title LIKE $1`, [`ORDRE-${STAMP}-${suffixe}%`]);
  return Number(rows[0].n);
}

const creerOrdre = (auth: AuthenticatedAgent, suffixe: string, equipmentId: number) =>
  createAuthenticatedRequest('post', '/api/work-orders', auth).send({
    title: `ORDRE-${STAMP}-${suffixe}`,
    description: 'Tentative de création directe.',
    equipmentId,
    category: 'Correctif',
  });

beforeAll(async () => {
  admin = await authenticateUser(SEEDED.admin, SEEDED.password);
  technicien = await authenticateUser(SEEDED.technician, SEEDED.password);
  chefEquipe = await authenticateUser(SEEDED.validateurN1, SEEDED.password);
});

afterAll(async () => {
  const MARQUES = [`ORDRE-${STAMP}-%`, `DEMANDE-${STAMP}-%`];
  // La DEMANDE référence l'ordre : on relève les identifiants d'ordre avant de
  // supprimer les demandes, puis on supprime les ordres.
  const { rows: ordresNes } = await pool.query<{ work_order_id: number }>(
    `SELECT work_order_id FROM intervention_requests
      WHERE work_order_id IS NOT NULL AND title LIKE $1`, [`DEMANDE-${STAMP}-%`]);
  await pool.query('DELETE FROM intervention_requests WHERE title LIKE $1', [`DEMANDE-${STAMP}-%`]);
  if (ordresNes.length > 0) {
    await pool.query('DELETE FROM work_orders WHERE id = ANY($1::int[])',
      [ordresNes.map((o) => o.work_order_id)]);
  }
  await pool.query('DELETE FROM work_orders WHERE title LIKE $1 OR title LIKE $2', MARQUES);

  const { rows: referents } = await pool.query<{ table_name: string; column_name: string }>(
    `SELECT c.conrelid::regclass::text AS table_name, a.attname AS column_name
       FROM pg_constraint c
       JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
      WHERE c.confrelid = 'equipment_registry'::regclass AND c.contype = 'f'`);
  for (const r of referents) {
    await pool.query(
      `DELETE FROM ${r.table_name}
        WHERE ${r.column_name} IN (SELECT id FROM equipment_registry WHERE equipment_id LIKE $1)`,
      [`EQ-${STAMP}-%`],
    ).catch(() => { /* rien à supprimer ici */ });
  }
  await pool.query('DELETE FROM equipment_registry WHERE equipment_id LIKE $1', [`EQ-${STAMP}-%`]);
  await pool.end();
});

// ═══════════════════════════════════════════════════════════════════
describe('La création directe est refusée sous le niveau de chef d\'équipe', () => {
  it("un technicien reçoit 403, et RIEN n'est écrit", async () => {
    const equipement = await insererEquipement('A1');

    const res = await creerOrdre(technicien, 'A1', equipement);

    expect(res.status).toBe(403);
    // Vérifié SUR LA TABLE : un 403 poli au-dessus d'une écriture déjà faite
    // ne prouverait rien.
    expect(await nombreOrdres('A1')).toBe(0);
  });

  it('le refus NOMME le geste qui reste possible', async () => {
    // Un refus qui ne dit pas quoi faire ne fait qu'empêcher le travail. Le
    // message doit renvoyer vers la demande d'intervention, qui est le geste
    // ouvert à tous.
    const equipement = await insererEquipement('A2');

    const res = await creerOrdre(technicien, 'A2', equipement);

    expect(res.body.error).toBe('FORBIDDEN');
    expect(res.body.message).toMatch(/demande d'intervention/i);
    expect(res.body.message).toMatch(/chef d'équipe/i);
    // Et il dit POURQUOI : c'est l'engagement de planification et de budget
    // qui justifie le seuil, pas une hiérarchie pour elle-même.
    expect(res.body.message).toMatch(/planification et le budget/i);
    expect(res.body.alternative).toBe('/api/demandes-intervention');
  });

  it("le technicien garde en revanche TOUT le reste de son travail", async () => {
    // Le témoin qui distingue une restriction d'un verrouillage. Démarrer et
    // clôturer un ordre est le travail quotidien d'un technicien : si la
    // restriction l'avait atteint, elle aurait cassé la GMAO au lieu de la
    // structurer.
    const equipement = await insererEquipement('A3');
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO work_orders (tenant_id, order_number, equipment_id, order_type, title, description, status)
       VALUES ($1, $2, $3, 'corrective', $4, 'Ordre posé en base', 'pending') RETURNING id`,
      [SEEDED.tenantAlpha, `WO-${STAMP}-A3`, equipement, `ORDRE-${STAMP}-A3-existant`],
    );
    const ordre = rows[0].id;

    const demarrage = await createAuthenticatedRequest('put', `/api/work-orders/${ordre}`, technicien)
      .send({ status: 'in_progress' });
    expect(demarrage.status).toBe(200);

    const cloture = await createAuthenticatedRequest('put', `/api/work-orders/${ordre}`, technicien)
      .send({ status: 'completed' });
    expect(cloture.status).toBe(200);

    const { rows: apres } = await pool.query<{ status: string }>(
      'SELECT status FROM work_orders WHERE id = $1', [ordre]);
    expect(apres[0].status).toBe('completed');
  });

  it("un chef d'équipe crée toujours — témoin", async () => {
    // Sans ce témoin, une route cassée pour tout le monde passerait pour une
    // restriction réussie.
    const equipement = await insererEquipement('A4');

    const res = await creerOrdre(chefEquipe, 'A4', equipement);

    expect(res.status).toBe(201);
    expect(await nombreOrdres('A4')).toBe(1);
  });

  it('un administrateur aussi — le niveau se compare, il ne s\'énumère pas', async () => {
    // `admin` (6) et `owner` (7) sont au-dessus de `team_leader` (2) et
    // passent sans être nommés. Une comparaison littérale les refuserait.
    const equipement = await insererEquipement('A5');

    const res = await creerOrdre(admin, 'A5', equipement);

    expect(res.status).toBe(201);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Les trois portes vers le même acte sont fermées au même seuil', () => {
  it('la conversion d\'une recommandation est refusée au technicien', async () => {
    // C'ÉTAIT LA SECONDE PORTE. `POST /api/maintenance-recommendations/apply`
    // crée un ordre de travail et n'exigeait que l'authentification :
    // restreindre la création directe sans elle aurait rendu la restriction
    // cosmétique.
    const equipement = await insererEquipement('B1');

    const res = await createAuthenticatedRequest('post', '/api/maintenance-recommendations/apply', technicien)
      .send({ recommendationId: 'rec-test', equipmentId: equipement, title: `ORDRE-${STAMP}-B1` });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/demande d'intervention/i);
    expect(await nombreOrdres('B1')).toBe(0);
  });

  it("et accordée à un chef d'équipe — témoin", async () => {
    const equipement = await insererEquipement('B2');

    const res = await createAuthenticatedRequest('post', '/api/maintenance-recommendations/apply', chefEquipe)
      .send({ recommendationId: 'rec-test', equipmentId: equipement, title: `ORDRE-${STAMP}-B2` });

    expect(res.status).toBe(201);
    expect(await nombreOrdres('B2')).toBe(1);
  });

  it("l'arbitrage d'une demande exige le MÊME niveau", async () => {
    // Les trois gestes engagent la planification et le budget : un seul seuil.
    // Si l'un d'eux était plus permissif, il deviendrait le contournement des
    // deux autres.
    const equipement = await insererEquipement('B3');
    const demande = await createAuthenticatedRequest('post', '/api/demandes-intervention', technicien)
      .send({
        title: `DEMANDE-${STAMP}-B3`,
        description: 'Constat signalé par un technicien.',
        equipmentId: equipement,
      });
    expect(demande.status).toBe(201);

    const parTechnicien = await createAuthenticatedRequest(
      'post', `/api/demandes-intervention/${demande.body.id}/accepter`, technicien).send({});
    expect(parTechnicien.status).toBe(403);

    const parChefEquipe = await createAuthenticatedRequest(
      'post', `/api/demandes-intervention/${demande.body.id}/accepter`, chefEquipe).send({});
    expect(parChefEquipe.status).toBe(201);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('La voie ouverte à tous reste ouverte', () => {
  it('un technicien signale toujours, et son signalement devient un ordre', async () => {
    // C'est le point de toute la restriction : on ne bloque pas l'exploitant,
    // on le redirige vers le geste qui lui revient — et ce geste aboutit.
    const equipement = await insererEquipement('C1');

    const demande = await createAuthenticatedRequest('post', '/api/demandes-intervention', technicien)
      .send({
        title: `DEMANDE-${STAMP}-C1`,
        description: "Fuite d'huile constatée sous la presse.",
        urgency: 'high',
        equipmentId: equipement,
      });
    expect(demande.status).toBe(201);

    const acceptation = await createAuthenticatedRequest(
      'post', `/api/demandes-intervention/${demande.body.id}/accepter`, chefEquipe)
      .send({ priority: 'medium' });
    expect(acceptation.status).toBe(201);

    // L'ordre existe, et il porte le TECHNICIEN comme demandeur : c'est lui
    // qui a signalé, la restriction ne l'a pas effacé de la chaîne.
    const { rows } = await pool.query<{ requested_by: number | null; equipment_id: number | null }>(
      'SELECT requested_by, equipment_id FROM work_orders WHERE id = $1', [acceptation.body.ordre.id]);
    expect(rows[0].requested_by).toBe(technicien.userId);
    expect(rows[0].equipment_id).toBe(equipement);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Les créations automatiques ne sont pas touchées', () => {
  it("le franchissement d'un seuil de compteur crée toujours son ordre", async () => {
    // Les automatismes écrivent par la couche de stockage, pas par la route
    // HTTP : ils n'ont pas de rôle, et la restriction ne doit pas les
    // atteindre. Sans ce test, une garde posée trop bas dans la pile aurait
    // éteint la boucle « compteur → OT » sans que rien ne le signale.
    const equipement = await insererEquipement('D1');
    const { rows: plans } = await pool.query<{ id: number }>(
      `INSERT INTO preventive_maintenance_plans
         (tenant_id, plan_name, equipment_type, frequency, frequency_value, is_active)
       VALUES ($1, $2, 'pompe', 'hours_based', 500, true) RETURNING id`,
      [SEEDED.tenantAlpha, `PLAN-${STAMP}-D1`]);
    const { rows: compteurs } = await pool.query<{ id: number }>(
      `INSERT INTO maintenance_counters
         (tenant_id, plan_id, equipment_id, counter_type, description, current_value,
          threshold_value, last_reset_value, is_active, warning_threshold_pct, alert_level, alert_email_sent)
       VALUES ($1, $2, $3, 'hours', $4, 460, 500, 0, true, 90, 'info', false) RETURNING id`,
      [SEEDED.tenantAlpha, plans[0].id, equipement, `COMPTEUR-${STAMP}-D1`]);

    // Le relevé est saisi par un TECHNICIEN — qui ne peut pas créer d'ordre
    // directement. L'ordre naît quand même, parce que c'est le seuil qui
    // décide, et non l'utilisateur.
    const releve = await createAuthenticatedRequest(
      'post', `/api/maintenance-counters/${compteurs[0].id}/readings`, technicien).send({ usage: 20 });
    expect(releve.status).toBe(201);

    const { rows: nes } = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM work_orders WHERE plan_id = $1`, [plans[0].id]);
    expect(Number(nes[0].n)).toBe(1);

    // Nettoyage propre à ce cas : l'ordre né du compteur n'a pas notre titre.
    await pool.query('DELETE FROM counter_readings WHERE counter_id = $1', [compteurs[0].id]);
    await pool.query('DELETE FROM counter_history WHERE counter_id = $1', [compteurs[0].id]);
    await pool.query('DELETE FROM maintenance_counters WHERE id = $1', [compteurs[0].id]);
    await pool.query('DELETE FROM work_orders WHERE plan_id = $1', [plans[0].id]);
    await pool.query('DELETE FROM preventive_maintenance_plans WHERE id = $1', [plans[0].id]);
  });
});
