/**
 * Les compteurs d'usage : suivi, relevés, seuils.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT, ET MESURÉ
 * ═══════════════════════════════════════════════════════════════════
 * Le module était écrit en entier et joignable par rien. Recensement du
 * 2026-10-26 : AUCUNE route du serveur ne servait `maintenance_counters`, et
 * six méthodes de stockage n'avaient aucun appelant — dont `incrementCounter()`.
 * Rien n'augmentait `current_value` : un compteur restait à la valeur posée à
 * sa création, n'atteignait donc jamais son seuil, et la remise à zéro à la
 * clôture d'un ordre de travail (migration 0024) n'avait rien à remettre.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE VERROUILLE
 * ═══════════════════════════════════════════════════════════════════
 *   1. un relevé fait AVANCER le compteur du bon montant, et laisse une ligne
 *      de `counter_readings` qui se lit seule (avant, usage, après, auteur) ;
 *   2. franchir le seuil ÉMET une alerte — sinon le compteur monte en silence
 *      et l'échéance passe inaperçue ;
 *   3. l'auteur vient de la SESSION, jamais du corps de la requête ;
 *   4. deux relevés simultanés s'additionnent, aucun n'écrase l'autre ;
 *   5. un compteur désactivé refuse les relevés (409), et un compteur d'autrui
 *      est un objet absent (404) — en lecture comme en écriture ;
 *   6. les droits suivent le geste : relever est ouvert, régler un seuil
 *      demande un chef d'équipe, supprimer un directeur technique ;
 *   7. l'historique réunit relevés ET remises à zéro, cloisonné ;
 *   8. la valeur courante n'est PAS modifiable par une édition de champ.
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
const pool = new Pool({ connectionString: DATABASE_URL, max: 6 });

const STAMP = `CPT${Date.now()}`;

let alpha: AuthenticatedAgent;   // admin Alpha — au-dessus de tous les niveaux
let beta: AuthenticatedAgent;    // admin Beta — pour le cloisonnement
let technicien: AuthenticatedAgent;  // niveau 0 : peut relever, rien de plus
let chefEquipe: AuthenticatedAgent;  // team_leader : peut régler et remettre à zéro

// ═══════════════════════════════════════════════════════════════════
// Fixtures en SQL : on maîtrise exactement la valeur de départ, ce qui
// est le point de toute assertion sur un incrément.
// ═══════════════════════════════════════════════════════════════════
async function insererEquipement(tenantId: string, suffixe: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO equipment_registry (tenant_id, equipment_id, equipment_name, equipment_type, location)
     VALUES ($1, $2, $3, 'pompe', 'Atelier compteurs') RETURNING id`,
    [tenantId, `EQ-${STAMP}-${suffixe}`, `EQUIPEMENT-${STAMP}-${suffixe}`],
  );
  return rows[0].id;
}

async function insererCompteur(opts: {
  tenantId: string;
  suffixe: string;
  valeur: number;
  seuil?: number | null;
  actif?: boolean;
  alertePct?: number;
  planId?: number | null;
  equipmentId?: number | null;
}): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO maintenance_counters
       (tenant_id, plan_id, equipment_id, counter_type, description, current_value,
        threshold_value, last_reset_value, is_active, warning_threshold_pct,
        alert_level, alert_email_sent)
     VALUES ($1, $2, $3, 'hours', $4, $5, $6, 0, $7, $8, 'info', false)
     RETURNING id`,
    [
      opts.tenantId,
      opts.planId ?? null,
      opts.equipmentId ?? null,
      `COMPTEUR-${STAMP}-${opts.suffixe}`,
      opts.valeur,
      opts.seuil === undefined ? 500 : opts.seuil,
      opts.actif ?? true,
      opts.alertePct ?? 90,
    ],
  );
  return rows[0].id;
}

// ── Relevés en base ────────────────────────────────────────────────
async function compteurEnBase(id: number) {
  const { rows } = await pool.query(
    `SELECT current_value, alert_level, alert_email_sent, threshold_value,
            warning_threshold_pct, description, counter_type, is_active
       FROM maintenance_counters WHERE id = $1`, [id]);
  return rows[0];
}

async function relevesEnBase(counterId: number): Promise<Array<{
  previous_value: number; usage: number; new_value: number;
  recorded_by: number | null; notes: string | null; tenant_id: string;
}>> {
  const { rows } = await pool.query(
    `SELECT previous_value, usage, new_value, recorded_by, notes, tenant_id
       FROM counter_readings WHERE counter_id = $1 ORDER BY id`, [counterId]);
  return rows;
}

async function alertesPourEquipement(equipmentId: number): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*) AS n FROM alerts_notifications WHERE equipment_id = $1`, [equipmentId]);
  return Number(rows[0].n);
}

const relever = (id: number, auth: AuthenticatedAgent, corps: Record<string, unknown>) =>
  createAuthenticatedRequest('post', `/api/maintenance-counters/${id}/readings`, auth).send(corps);

beforeAll(async () => {
  alpha = await authenticateUser(SEEDED.admin, SEEDED.password);
  beta = await authenticateUser(SEEDED.adminBeta, SEEDED.password);
  technicien = await authenticateUser(SEEDED.technician, SEEDED.password);
  chefEquipe = await authenticateUser(SEEDED.validateurN1, SEEDED.password);
});

afterAll(async () => {
  await pool.query(
    `DELETE FROM counter_readings
      WHERE counter_id IN (SELECT id FROM maintenance_counters WHERE description LIKE $1)`,
    [`COMPTEUR-${STAMP}-%`]);
  await pool.query(
    `DELETE FROM counter_history
      WHERE counter_id IN (SELECT id FROM maintenance_counters WHERE description LIKE $1)`,
    [`COMPTEUR-${STAMP}-%`]);
  await pool.query('DELETE FROM maintenance_counters WHERE description LIKE $1', [`COMPTEUR-${STAMP}-%`]);
  await pool.query('DELETE FROM preventive_maintenance_plans WHERE plan_name LIKE $1', [`PLAN-${STAMP}-%`]);

  // Les référents de `equipment_registry` sont recensés au catalogue : la
  // liste change (les tâches de fond alimentent alertes et relevés de capteurs
  // en continu), et l'énumérer à la main la laisserait périmer.
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
    ).catch(() => { /* rien à supprimer dans cette table */ });
  }
  await pool.query('DELETE FROM equipment_registry WHERE equipment_id LIKE $1', [`EQ-${STAMP}-%`]);
  await pool.end();
});

// ═══════════════════════════════════════════════════════════════════
describe("Un relevé fait avancer le compteur — l'incrémentation", () => {
  it('ajoute exactement l\'usage déclaré, et trace le relevé', async () => {
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'A1', valeur: 120 });

    const res = await relever(compteur, alpha, { usage: 40, notes: `relevé ${STAMP}` });

    expect(res.status).toBe(201);
    // La valeur EN BASE, pas celle du corps de réponse : c'est l'écriture qui
    // manquait, et un 201 au-dessus d'une écriture absente ne prouve rien.
    expect((await compteurEnBase(compteur)).current_value).toBe(160);

    const releves = await relevesEnBase(compteur);
    expect(releves).toHaveLength(1);
    // La ligne se lit SEULE : avant, usage, après. Avec le seul incrément,
    // retrouver l'état du compteur à une date donnée obligerait à rejouer
    // toute la série.
    expect(releves[0]).toMatchObject({
      previous_value: 120,
      usage: 40,
      new_value: 160,
      tenant_id: SEEDED.tenantAlpha,
      notes: `relevé ${STAMP}`,
    });
  });

  it('accepte les décimales : les heures ne sont pas entières', async () => {
    // `usage` est un `real` en base, et c'est voulu : un compteur horaire se
    // lit en heures et dixièmes.
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'A2', valeur: 10 });

    expect((await relever(compteur, alpha, { usage: 12.5 })).status).toBe(201);

    expect((await compteurEnBase(compteur)).current_value).toBeCloseTo(22.5, 4);
  });

  it("s'accumule sur plusieurs relevés", async () => {
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'A3', valeur: 0 });

    for (const usage of [10, 20, 30]) {
      expect((await relever(compteur, alpha, { usage })).status).toBe(201);
    }

    expect((await compteurEnBase(compteur)).current_value).toBe(60);
    const releves = await relevesEnBase(compteur);
    expect(releves.map((r) => r.new_value)).toEqual([10, 30, 60]);
  });

  it("signe le relevé avec l'utilisateur de la SESSION", async () => {
    // Un relevé signé d'un identifiant fourni par le client imputerait la
    // saisie à n'importe qui. On tente de forger l'auteur, et on vérifie que
    // c'est la session qui gagne.
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'A4', valeur: 0 });

    const res = await relever(compteur, technicien, { usage: 5, recordedBy: 99999, recorded_by: 99999 });
    expect(res.status).toBe(201);

    const [releve] = await relevesEnBase(compteur);
    expect(releve.recorded_by).toBe(technicien.userId);
    expect(releve.recorded_by).not.toBe(99999);
  });

  it('refuse un usage nul, négatif ou non numérique — sans rien écrire', async () => {
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'A5', valeur: 77 });

    for (const usage of [0, -5, 'beaucoup', null]) {
      const res = await relever(compteur, alpha, { usage });
      expect(res.status).toBe(400);
    }

    expect((await compteurEnBase(compteur)).current_value).toBe(77);
    expect(await relevesEnBase(compteur)).toHaveLength(0);
  });

  it('refuse un relevé sur un compteur désactivé, en 409', async () => {
    // Le suivi a été suspendu délibérément : l'avancer le ferait rentrer dans
    // le suivi par la petite porte, en déclenchant éventuellement une alerte
    // sur un équipement sorti du périmètre.
    const compteur = await insererCompteur({
      tenantId: SEEDED.tenantAlpha, suffixe: 'A6', valeur: 50, actif: false,
    });

    const res = await relever(compteur, alpha, { usage: 10 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('COMPTEUR_DESACTIVE');
    expect((await compteurEnBase(compteur)).current_value).toBe(50);
    expect(await relevesEnBase(compteur)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe("Franchir le seuil émet une alerte", () => {
  it("produit une alerte quand le relevé fait atteindre l'échéance", async () => {
    // C'est la raison d'être du compteur. Sans alerte, il monte en silence et
    // l'échéance passe inaperçue — ce qui était l'état du système, puisque
    // rien ne le faisait monter du tout.
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'B1');
    const compteur = await insererCompteur({
      tenantId: SEEDED.tenantAlpha, suffixe: 'B1', valeur: 480, seuil: 500, equipmentId: equipement,
    });
    const avant = await alertesPourEquipement(equipement);

    expect((await relever(compteur, alpha, { usage: 30 })).status).toBe(201);

    expect((await compteurEnBase(compteur)).current_value).toBe(510);
    expect(await alertesPourEquipement(equipement)).toBeGreaterThan(avant);
  });

  it("l'alerte NOMME la machine et la gamme — jamais « null »", async () => {
    // ⚠️ DÉFAUT RÉELLEMENT RENCONTRÉ, trouvé en provoquant l'alerte depuis
    // l'écran. Le message était composé de `equipmentName` et
    // `maintenanceType`, deux champs facultatifs — et `equipmentName` est une
    // copie dénormalisée vide sur la plupart des lignes. Relevé :
    //   « Maintenance due: null » / « null is due for null. Current value:
    //     2025.5/2000 hours »
    // Le défaut n'avait jamais pu se voir : rien n'augmentait les compteurs,
    // donc ce chemin ne s'exécutait pas. Une alerte de maintenance qui ne
    // nomme pas la machine ne sert à rien.
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'B4');
    const compteur = await insererCompteur({
      tenantId: SEEDED.tenantAlpha, suffixe: 'B4', valeur: 490, seuil: 500, equipmentId: equipement,
    });
    // La copie dénormalisée est vide — l'état réel de la plupart des lignes.
    await pool.query('UPDATE maintenance_counters SET equipment_name = NULL, maintenance_type = NULL WHERE id = $1', [compteur]);

    expect((await relever(compteur, alpha, { usage: 20 })).status).toBe(201);

    const { rows } = await pool.query<{ title: string; message: string }>(
      `SELECT title, message FROM alerts_notifications WHERE equipment_id = $1 ORDER BY id DESC LIMIT 1`,
      [equipement]);
    expect(rows).toHaveLength(1);

    // Le nom est résolu depuis le registre, et aucun « null » ne subsiste.
    expect(rows[0].title).toContain(`EQUIPEMENT-${STAMP}-B4`);
    expect(rows[0].message).toContain(`EQUIPEMENT-${STAMP}-B4`);
    expect(rows[0].title.toLowerCase()).not.toContain('null');
    expect(rows[0].message.toLowerCase()).not.toContain('null');
    // La valeur relevée et la périodicité sont dans le message : une alerte
    // qui ne dit pas de combien on a dépassé n'aide pas à arbitrer.
    expect(rows[0].message).toContain('510');
    expect(rows[0].message).toContain('500');
  });

  it("n'alerte pas tant que le seuil d'alerte n'est pas atteint — témoin", async () => {
    // Sans ce témoin, un correctif qui alerterait à chaque relevé passerait le
    // test précédent. Et une supervision qui crie tout le temps est plus
    // dangereuse qu'une supervision muette.
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'B2');
    const compteur = await insererCompteur({
      tenantId: SEEDED.tenantAlpha, suffixe: 'B2', valeur: 10, seuil: 1000,
      alertePct: 90, equipmentId: equipement,
    });
    const avant = await alertesPourEquipement(equipement);

    expect((await relever(compteur, alpha, { usage: 20 })).status).toBe(201);

    expect(await alertesPourEquipement(equipement)).toBe(avant);
  });

  it("un compteur SANS seuil ne produit aucune alerte, et ne bloque pas le relevé", async () => {
    // `threshold_value` est nullable. Un compteur sans seuil compte sans
    // échéance : il ne doit ni alerter, ni refuser le relevé.
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'B3');
    const compteur = await insererCompteur({
      tenantId: SEEDED.tenantAlpha, suffixe: 'B3', valeur: 0, seuil: null, equipmentId: equipement,
    });
    const avant = await alertesPourEquipement(equipement);

    expect((await relever(compteur, alpha, { usage: 9999 })).status).toBe(201);

    expect((await compteurEnBase(compteur)).current_value).toBe(9999);
    expect(await alertesPourEquipement(equipement)).toBe(avant);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Deux relevés simultanés', () => {
  it("s'additionnent : aucun n'écrase l'autre", async () => {
    // Sans verrou, les deux liraient la même valeur de départ et le second
    // écraserait le premier : le compteur n'avancerait que d'un seul usage, et
    // les deux lignes de relevé se contrediraient.
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'C1', valeur: 100 });

    const [r1, r2] = await Promise.all([
      relever(compteur, alpha, { usage: 10 }),
      relever(compteur, alpha, { usage: 25 }),
    ]);
    expect([r1.status, r2.status].every((s) => s === 201)).toBe(true);

    expect((await compteurEnBase(compteur)).current_value).toBe(135);

    // Les deux lignes s'enchaînent sans trou : la valeur d'arrivée de l'une
    // est la valeur de départ de l'autre.
    const releves = await relevesEnBase(compteur);
    expect(releves).toHaveLength(2);
    expect(releves[1].previous_value).toBe(releves[0].new_value);
    expect(releves[1].new_value).toBe(135);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Cloisonnement', () => {
  it("ne sert que les compteurs du demandeur", async () => {
    await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'D1A', valeur: 1 });
    await insererCompteur({ tenantId: SEEDED.tenantBeta, suffixe: 'D1B', valeur: 2 });

    const res = await createAuthenticatedRequest('get', '/api/maintenance-counters', alpha);

    expect(res.status).toBe(200);
    expect(res.text).toContain(`COMPTEUR-${STAMP}-D1A`);
    expect(res.text).not.toContain(`COMPTEUR-${STAMP}-D1B`);
  });

  it("résout le nom de l'équipement, sans dépendre de la copie dénormalisée", async () => {
    // ⚠️ DÉFAUT RÉELLEMENT RENCONTRÉ, trouvé en ouvrant l'écran.
    // `maintenance_counters.equipment_name` est une copie dénormalisée, et
    // elle est souvent VIDE : le seul chemin qui la remplissait la prend du
    // corps de la requête. Deux compteurs rattachés à l'équipement #9
    // « Compresseur atelier » s'affichaient « Équipement non précisé », alors
    // que le rattachement était juste en base. Le nom est donc lu là où il est
    // vrai, et la copie ne sert que de repli.
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'D1C');
    const compteur = await insererCompteur({
      tenantId: SEEDED.tenantAlpha, suffixe: 'D1C', valeur: 1, equipmentId: equipement,
    });
    // La copie est explicitement vidée : c'est l'état réel de la plupart des
    // lignes, et c'est ce que le test doit reproduire.
    await pool.query('UPDATE maintenance_counters SET equipment_name = NULL WHERE id = $1', [compteur]);

    const res = await createAuthenticatedRequest('get', '/api/maintenance-counters', alpha);
    const servi = (res.body as Array<{ id: number; equipmentName: string | null }>)
      .find((c) => c.id === compteur);

    expect(servi).toBeDefined();
    expect(servi!.equipmentName).toBe(`EQUIPEMENT-${STAMP}-D1C`);
  });

  it("ne rapproche pas un compteur de l'équipement d'un autre locataire", async () => {
    // Sans la condition de locataire sur la jointure, le nom d'un équipement
    // d'autrui s'afficherait. Le cas est forgé en base : un compteur d'Alpha
    // pointant sur un équipement de Beta ne peut pas être créé par la route,
    // qui le refuse en 404.
    const equipementBeta = await insererEquipement(SEEDED.tenantBeta, 'D1D');
    const compteur = await insererCompteur({
      tenantId: SEEDED.tenantAlpha, suffixe: 'D1D', valeur: 1, equipmentId: equipementBeta,
    });
    await pool.query('UPDATE maintenance_counters SET equipment_name = NULL WHERE id = $1', [compteur]);

    const res = await createAuthenticatedRequest('get', '/api/maintenance-counters', alpha);
    const servi = (res.body as Array<{ id: number; equipmentName: string | null }>)
      .find((c) => c.id === compteur);

    expect(servi).toBeDefined();
    expect(servi!.equipmentName).toBeNull();
    expect(res.text).not.toContain(`EQUIPEMENT-${STAMP}-D1D`);
  });

  it("un compteur d'autrui est un objet ABSENT en lecture (404)", async () => {
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'D2', valeur: 5 });

    const res = await createAuthenticatedRequest('get', `/api/maintenance-counters/${compteur}/history`, beta);

    // 404 et non 403 : ne pas distinguer les deux cas évite de révéler qu'un
    // identifiant existe ailleurs.
    expect(res.status).toBe(404);
  });

  it("un compteur d'autrui est un objet ABSENT en écriture, et reste INCHANGÉ", async () => {
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'D3', valeur: 300 });

    const res = await relever(compteur, beta, { usage: 500 });

    expect(res.status).toBe(404);
    // Vérifié SUR LA TABLE : un 4xx poli au-dessus d'une écriture déjà faite
    // ne prouverait rien.
    expect((await compteurEnBase(compteur)).current_value).toBe(300);
    expect(await relevesEnBase(compteur)).toHaveLength(0);
  });

  it('un anonyme n\'obtient rien', async () => {
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'D4', valeur: 7 });

    const lecture = await anonymousRequest('get', '/api/maintenance-counters');
    expect([401, 403]).toContain(lecture.status);
    expect(lecture.text ?? '').not.toContain(`COMPTEUR-${STAMP}-D4`);

    expect((await compteurEnBase(compteur)).current_value).toBe(7);
  });

  it("refuse de rattacher un compteur au plan d'un autre locataire", async () => {
    // Conséquence si on l'acceptait : la clôture d'un ordre de travail de
    // l'autre organisation remettrait ce compteur à zéro.
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO preventive_maintenance_plans (tenant_id, plan_name, equipment_type, frequency, is_active)
       VALUES ($1, $2, 'pompe', 'hours_based', true) RETURNING id`,
      [SEEDED.tenantBeta, `PLAN-${STAMP}-D5`]);
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'D5');

    const res = await createAuthenticatedRequest('post', '/api/maintenance-counters', alpha).send({
      equipmentId: equipement,
      counterType: 'hours',
      description: `COMPTEUR-${STAMP}-D5`,
      thresholdValue: 500,
      planId: rows[0].id,
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('PLAN_INTROUVABLE');
  });

  it("refuse de poser un compteur sur l'équipement d'un autre locataire", async () => {
    const equipementBeta = await insererEquipement(SEEDED.tenantBeta, 'D6');

    const res = await createAuthenticatedRequest('post', '/api/maintenance-counters', alpha).send({
      equipmentId: equipementBeta,
      counterType: 'hours',
      description: `COMPTEUR-${STAMP}-D6`,
      thresholdValue: 500,
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('EQUIPEMENT_INTROUVABLE');
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Les droits suivent le geste', () => {
  it('RELEVER est ouvert à un technicien — son travail quotidien', async () => {
    // Exiger un chef d'équipe pour saisir un relevé garantirait que personne
    // ne le saisit.
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'E1', valeur: 0 });

    expect((await relever(compteur, technicien, { usage: 8 })).status).toBe(201);
    expect((await compteurEnBase(compteur)).current_value).toBe(8);
  });

  it('RÉGLER UN SEUIL est refusé à un technicien, accordé à un chef d\'équipe', async () => {
    // C'est le seuil qui décide quand une machine est déclarée due : un acte
    // d'ingénierie de maintenance.
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'E2', valeur: 10, seuil: 500 });

    const refus = await createAuthenticatedRequest('put', `/api/maintenance-counters/${compteur}`, technicien)
      .send({ thresholdValue: 50 });
    expect(refus.status).toBe(403);
    expect((await compteurEnBase(compteur)).threshold_value).toBe(500);

    const accord = await createAuthenticatedRequest('put', `/api/maintenance-counters/${compteur}`, chefEquipe)
      .send({ thresholdValue: 250 });
    expect(accord.status).toBe(200);
    expect((await compteurEnBase(compteur)).threshold_value).toBe(250);
  });

  it('REMETTRE À ZÉRO est refusé à un technicien, et exige un motif', async () => {
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'E3', valeur: 400 });

    const refus = await createAuthenticatedRequest('post', `/api/maintenance-counters/${compteur}/reset`, technicien)
      .send({ motif: 'je tente' });
    expect(refus.status).toBe(403);
    expect((await compteurEnBase(compteur)).current_value).toBe(400);

    // Un motif est obligatoire : une remise à zéro efface un relevé d'usage,
    // et sans motif l'historique ne dirait pas pourquoi.
    const sansMotif = await createAuthenticatedRequest('post', `/api/maintenance-counters/${compteur}/reset`, chefEquipe)
      .send({});
    expect(sansMotif.status).toBe(400);
    expect((await compteurEnBase(compteur)).current_value).toBe(400);

    const avecMotif = await createAuthenticatedRequest('post', `/api/maintenance-counters/${compteur}/reset`, chefEquipe)
      .send({ motif: `graissage hors GMAO ${STAMP}` });
    expect(avecMotif.status).toBe(200);
    expect((await compteurEnBase(compteur)).current_value).toBe(0);
  });

  it('SUPPRIMER est refusé à un chef d\'équipe', async () => {
    // La suppression détruit l'historique d'usage d'un équipement.
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'E4', valeur: 1 });

    const res = await createAuthenticatedRequest('delete', `/api/maintenance-counters/${compteur}`, chefEquipe);

    expect(res.status).toBe(403);
    expect(await compteurEnBase(compteur)).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
describe("La valeur courante ne se modifie pas par une édition de champ", () => {
  it('rejette `currentValue` dans une modification', async () => {
    // Faire bouger un usage par une édition le laisserait changer SANS TRACE.
    // Pour l'augmenter on relève, pour le ramener à zéro on le remet à zéro —
    // les deux laissent une ligne d'historique. Le schéma est `.strict()`,
    // donc un champ non prévu est refusé au lieu d'être ignoré en silence.
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'F1', valeur: 42 });

    const res = await createAuthenticatedRequest('put', `/api/maintenance-counters/${compteur}`, chefEquipe)
      .send({ currentValue: 999 });

    expect(res.status).toBe(400);
    expect((await compteurEnBase(compteur)).current_value).toBe(42);
  });

  it('accepte le libellé, le seuil et la désactivation', async () => {
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'F2', valeur: 5 });

    const res = await createAuthenticatedRequest('put', `/api/maintenance-counters/${compteur}`, chefEquipe)
      .send({ description: `COMPTEUR-${STAMP}-F2-renomme`, warningThresholdPct: 75, isActive: false });

    expect(res.status).toBe(200);
    const apres = await compteurEnBase(compteur);
    expect(apres.description).toBe(`COMPTEUR-${STAMP}-F2-renomme`);
    expect(apres.warning_threshold_pct).toBe(75);
    expect(apres.is_active).toBe(false);
    // La valeur n'a pas bougé.
    expect(apres.current_value).toBe(5);
  });

  it("abaisser le seuil sous l'usage déjà accumulé rend l'échéance due", async () => {
    // Un seuil abaissé par l'ingénierie doit produire l'alerte tout de suite,
    // et non attendre le relevé suivant — c'est-à-dire potentiellement des
    // semaines après la décision.
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'F3');
    const compteur = await insererCompteur({
      tenantId: SEEDED.tenantAlpha, suffixe: 'F3', valeur: 600, seuil: 2000, equipmentId: equipement,
    });
    const avant = await alertesPourEquipement(equipement);

    const res = await createAuthenticatedRequest('put', `/api/maintenance-counters/${compteur}`, chefEquipe)
      .send({ thresholdValue: 500 });

    expect(res.status).toBe(200);
    expect(await alertesPourEquipement(equipement)).toBeGreaterThan(avant);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe("L'historique réunit relevés et remises à zéro", () => {
  it('rend les deux genres, le plus récent en tête', async () => {
    // Les lire séparément ne dirait rien : une suite de relevés sans les
    // remises à zéro donne une courbe qui semble redescendre sans raison.
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'G1', valeur: 0 });

    expect((await relever(compteur, alpha, { usage: 100 })).status).toBe(201);
    expect((await createAuthenticatedRequest('post', `/api/maintenance-counters/${compteur}/reset`, chefEquipe)
      .send({ motif: `révision ${STAMP}` })).status).toBe(200);
    expect((await relever(compteur, alpha, { usage: 15 })).status).toBe(201);

    const res = await createAuthenticatedRequest('get', `/api/maintenance-counters/${compteur}/history`, alpha);
    expect(res.status).toBe(200);

    const lignes = res.body as Array<{ genre: string; usage: number | null; valeurAvant: number; valeurApres: number; motif: string | null }>;
    expect(lignes).toHaveLength(3);
    expect(lignes.map((l) => l.genre)).toEqual(['releve', 'remise_a_zero', 'releve']);

    // Le relevé le plus récent : 0 → 15, après la remise à zéro.
    expect(lignes[0]).toMatchObject({ genre: 'releve', usage: 15, valeurAvant: 0, valeurApres: 15 });
    // La remise à zéro a enregistré le relevé qu'elle effaçait.
    expect(lignes[1]).toMatchObject({ genre: 'remise_a_zero', valeurAvant: 100, valeurApres: 0 });
    expect(lignes[1].motif).toContain('révision');
  });

  it('rend une liste vide pour un compteur sans histoire — et non une erreur', async () => {
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'G2', valeur: 0 });

    const res = await createAuthenticatedRequest('get', `/api/maintenance-counters/${compteur}/history`, alpha);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Création et suppression', () => {
  it('crée un compteur cloisonné, et le sert ensuite', async () => {
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'H1');

    const creation = await createAuthenticatedRequest('post', '/api/maintenance-counters', chefEquipe).send({
      equipmentId: equipement,
      counterType: 'cycles',
      description: `COMPTEUR-${STAMP}-H1`,
      currentValue: 250,
      thresholdValue: 1000,
      warningThresholdPct: 80,
    });

    expect(creation.status).toBe(201);
    const id = creation.body.id;
    const enBase = await compteurEnBase(id);
    expect(enBase).toMatchObject({
      current_value: 250, threshold_value: 1000, warning_threshold_pct: 80, counter_type: 'cycles',
    });

    const lecture = await createAuthenticatedRequest('get', '/api/maintenance-counters', alpha);
    expect(lecture.text).toContain(`COMPTEUR-${STAMP}-H1`);
  });

  it('refuse un seuil nul ou négatif', async () => {
    // Un seuil à zéro rendrait toute échéance due en permanence.
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'H2');

    for (const thresholdValue of [0, -10]) {
      const res = await createAuthenticatedRequest('post', '/api/maintenance-counters', chefEquipe).send({
        equipmentId: equipement,
        counterType: 'hours',
        description: `COMPTEUR-${STAMP}-H2`,
        thresholdValue,
      });
      expect(res.status).toBe(400);
    }
  });

  it("supprime le compteur ET ses relevés", async () => {
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'H3', valeur: 0 });
    expect((await relever(compteur, alpha, { usage: 30 })).status).toBe(201);
    expect(await relevesEnBase(compteur)).toHaveLength(1);

    const res = await createAuthenticatedRequest('delete', `/api/maintenance-counters/${compteur}`, alpha);

    expect(res.status).toBe(200);
    expect(await compteurEnBase(compteur)).toBeUndefined();
    // La cascade de `counter_readings` emporte les relevés : sans elle, la
    // suppression échouerait sur la clé étrangère.
    expect(await relevesEnBase(compteur)).toHaveLength(0);
  });

  it("Beta ne peut pas supprimer un compteur d'Alpha", async () => {
    const compteur = await insererCompteur({ tenantId: SEEDED.tenantAlpha, suffixe: 'H4', valeur: 3 });

    const res = await createAuthenticatedRequest('delete', `/api/maintenance-counters/${compteur}`, beta);

    expect(res.status).toBe(404);
    expect(await compteurEnBase(compteur)).toBeDefined();
  });
});
