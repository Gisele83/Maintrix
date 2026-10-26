/**
 * La clôture d'un ordre de travail transmet-elle réellement quelque chose ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT, ET MESURÉ
 * ═══════════════════════════════════════════════════════════════════
 * `PUT /api/work-orders/:id` avec `status: 'completed'` ne déclenchait qu'une
 * tentative de génération de rapport HTML non enregistrée. Relevé sur une
 * grappe jetable, locataire Alpha, OT préventif clôturé avec trois pièces
 * déclarées — AVANT correctif :
 *
 *     HTTP 200 · next_due inchangé (+0 j) · last_executed nul ·
 *     current_stock 10 → 10 · ZÉRO mouvement de stock ·
 *     operational_state inchangé · actual_end NUL
 *
 * Après correctif, mêmes fixtures, même banc :
 *
 *     HTTP 200 · next_due +31 j (une période exacte) · last_executed renseigné ·
 *     current_stock 10 → 7 · un mouvement OUT 3 (10→7, WORK_ORDER, cloisonné) ·
 *     operational_state maintenance → operational · actual_end renseigné
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE VERROUILLE
 * ═══════════════════════════════════════════════════════════════════
 * Aucune assertion ne se contente d'un code de retour. Un 200 était déjà
 * rendu quand la clôture ne faisait RIEN : c'est précisément pour cela que le
 * défaut a survécu. Tout se vérifie donc sur la table.
 *
 *   1. l'échéance d'un plan avance d'EXACTEMENT une période, depuis
 *      l'échéance prévue et non depuis la date de réalisation ;
 *   2. un retard supérieur à une période ne laisse pas le plan dans le passé,
 *      et ne décale pas la grille ;
 *   3. les pièces déclarées sont décomptées du BON montant, avec le mouvement
 *      `OUT` correspondant ;
 *   4. un stock insuffisant REFUSE la clôture et n'écrit RIEN — ni statut, ni
 *      mouvement, ni replanification (c'est la transaction qu'on éprouve) ;
 *   5. deux clôtures simultanées ne décomptent qu'une fois ;
 *   6. l'état opérationnel ne bascule que pour les interventions AVEC arrêt,
 *      et pas tant qu'il en reste une autre ouverte ;
 *   7. témoins — un OT sans plan ne replanifie rien, un OT sans arrêt ne
 *      touche pas à l'état, une clôture sans pièces reste possible. Sans eux,
 *      un correctif qui ferait basculer n'importe quoi passerait aussi.
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

/**
 * Marqueur unique de cette exécution. Il sert à deux choses : retrouver nos
 * lignes pour les supprimer, et ne jamais confondre nos fixtures avec celles
 * d'une autre suite — des suites de ce dépôt s'interfèrent déjà par les
 * agrégats, et un marqueur fixe les rendrait indiscernables entre deux
 * exécutions sur la même base.
 */
const STAMP = `CLO${Date.now()}`;

let alpha: AuthenticatedAgent;
let beta: AuthenticatedAgent;

// ═══════════════════════════════════════════════════════════════════
// Fixtures — posées en SQL, pour maîtriser EXACTEMENT les valeurs de
// départ. Passer par les routes ferait dépendre le point de départ du
// comportement qu'on mesure.
// ═══════════════════════════════════════════════════════════════════

async function insererEquipement(tenantId: string, suffixe: string, etat = 'operational'): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO equipment_registry
       (tenant_id, equipment_id, equipment_name, equipment_type, location, operational_state)
     VALUES ($1, $2, $3, 'pompe', 'Atelier essais', $4)
     RETURNING id`,
    [tenantId, `EQ-${STAMP}-${suffixe}`, `EQUIPEMENT-${STAMP}-${suffixe}`, etat],
  );
  return rows[0].id;
}

async function insererPiece(tenantId: string, suffixe: string, stock: number): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO spare_parts
       (tenant_id, part_number, part_name, current_stock, min_stock, max_stock, unit_price, is_active)
     VALUES ($1, $2, $3, $4, 2, 50, '12.50', true)
     RETURNING id`,
    [tenantId, `PN-${STAMP}-${suffixe}`, `PIECE-${STAMP}-${suffixe}`, stock],
  );
  return rows[0].id;
}

/**
 * Plan préventif dont l'échéance est posée en SQL par rapport à `now()`.
 *
 * `decalage` est une expression d'intervalle PostgreSQL (`'1 day'`,
 * `'-2 months -3 days'`). Elle est évaluée PAR LA BASE, et l'échéance est
 * relue en texte : un `timestamp` sans fuseau relu par le pilote `pg` est
 * interprété en heure LOCALE alors que l'application l'écrit en UTC, et
 * comparer les deux produirait un échec d'une heure qui ne dirait rien du
 * code. Toutes les comparaisons de dates de cette suite se font donc EN SQL.
 */
async function insererPlan(
  tenantId: string,
  suffixe: string,
  frequence: string,
  valeur: number | null,
  decalage: string,
): Promise<{ id: number; echeance: string }> {
  const { rows } = await pool.query<{ id: number; echeance: string }>(
    `INSERT INTO preventive_maintenance_plans
       (tenant_id, plan_name, equipment_type, frequency, frequency_value, is_active, next_due, last_executed)
     VALUES ($1, $2, 'pompe', $3, $4, true,
             date_trunc('second', now()) + $5::interval, NULL)
     RETURNING id, to_char(next_due, 'YYYY-MM-DD HH24:MI:SS') AS echeance`,
    [tenantId, `PLAN-${STAMP}-${suffixe}`, frequence, valeur, decalage],
  );
  return rows[0];
}

async function insererOrdre(opts: {
  tenantId: string;
  suffixe: string;
  equipmentId?: number | null;
  planId?: number | null;
  orderType?: string;
  status?: string;
  requiresShutdown?: boolean;
}): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO work_orders
       (tenant_id, order_number, equipment_id, plan_id, order_type, title, description,
        status, requires_shutdown, actual_start)
     VALUES ($1, $2, $3, $4, $5, $6, 'Intervention de la suite de clôture', $7, $8, now() - interval '2 hours')
     RETURNING id`,
    [
      opts.tenantId,
      `OT-${STAMP}-${opts.suffixe}`,
      opts.equipmentId ?? null,
      opts.planId ?? null,
      opts.orderType ?? 'preventive',
      `ORDRE-${STAMP}-${opts.suffixe}`,
      opts.status ?? 'in_progress',
      opts.requiresShutdown ?? false,
    ],
  );
  return rows[0].id;
}

// ── Relevés ────────────────────────────────────────────────────────

/**
 * L'échéance a-t-elle avancé d'EXACTEMENT `periodes` × `intervalle` depuis
 * l'échéance d'origine ? Comparaison faite par PostgreSQL, sur deux
 * `timestamp`, donc sans aucune conversion de fuseau.
 */
async function echeanceConforme(planId: number, origine: string, intervalle: string): Promise<{
  conforme: boolean; lue: string | null; attendue: string | null; dansLeFutur: boolean;
}> {
  const { rows } = await pool.query(
    `SELECT next_due = ($2::timestamp + $3::interval)                    AS conforme,
            to_char(next_due, 'YYYY-MM-DD HH24:MI:SS')                   AS lue,
            to_char($2::timestamp + $3::interval, 'YYYY-MM-DD HH24:MI:SS') AS attendue,
            next_due > now()                                             AS dans_le_futur
       FROM preventive_maintenance_plans WHERE id = $1`,
    [planId, origine, intervalle],
  );
  return {
    conforme: rows[0]?.conforme === true,
    lue: rows[0]?.lue ?? null,
    attendue: rows[0]?.attendue ?? null,
    dansLeFutur: rows[0]?.dans_le_futur === true,
  };
}

async function planBrut(planId: number): Promise<{ echeance: string | null; derniere: string | null }> {
  const { rows } = await pool.query(
    `SELECT to_char(next_due, 'YYYY-MM-DD HH24:MI:SS')      AS echeance,
            to_char(last_executed, 'YYYY-MM-DD HH24:MI:SS') AS derniere
       FROM preventive_maintenance_plans WHERE id = $1`, [planId]);
  return { echeance: rows[0]?.echeance ?? null, derniere: rows[0]?.derniere ?? null };
}

async function stockEnBase(pieceId: number): Promise<number | null> {
  const { rows } = await pool.query('SELECT current_stock FROM spare_parts WHERE id = $1', [pieceId]);
  return rows[0]?.current_stock ?? null;
}

async function mouvements(pieceId: number): Promise<Array<{
  movement_type: string; quantity: number; previous_stock: number; new_stock: number;
  reason: string | null; work_order_id: number | null; tenant_id: string | null;
}>> {
  const { rows } = await pool.query(
    `SELECT movement_type, quantity, previous_stock, new_stock, reason, work_order_id, tenant_id
       FROM stock_movements WHERE spare_part_id = $1 ORDER BY id`, [pieceId]);
  return rows;
}

async function etatOrdre(id: number): Promise<{ status: string; actual_end: string | null }> {
  const { rows } = await pool.query(
    `SELECT status, to_char(actual_end, 'YYYY-MM-DD HH24:MI:SS') AS actual_end
       FROM work_orders WHERE id = $1`, [id]);
  return rows[0];
}

async function etatEquipement(id: number): Promise<string | null> {
  const { rows } = await pool.query('SELECT operational_state FROM equipment_registry WHERE id = $1', [id]);
  return rows[0]?.operational_state ?? null;
}

const cloturer = (ordre: number, auth: AuthenticatedAgent, corps: Record<string, unknown> = {}) =>
  createAuthenticatedRequest('put', `/api/work-orders/${ordre}`, auth).send({ status: 'completed', ...corps });

beforeAll(async () => {
  alpha = await authenticateUser(SEEDED.admin, SEEDED.password);
  beta = await authenticateUser(SEEDED.adminBeta, SEEDED.password);
});

afterAll(async () => {
  // Nos lignes sont supprimées, et dans l'ordre des dépendances. Les suites de
  // ce dépôt qui comptent des agrégats sur Alpha échouent sur des fixtures
  // laissées derrière, et le message accuse alors le cloisonnement.
  await pool.query(
    `DELETE FROM stock_movements
      WHERE spare_part_id IN (SELECT id FROM spare_parts WHERE part_number LIKE $1)`, [`PN-${STAMP}-%`]);
  // ⚠️ Le filtre porte sur le numéro ET sur le titre. Les ordres posés en SQL
  // par cette suite portent le marqueur dans leur `order_number`, mais ceux
  // créés via `POST /api/work-orders` reçoivent un numéro AUTO-GÉNÉRÉ
  // (`WO-<horodatage>-<alea>`, voir gmaoStorage.createWorkOrder) : seul leur
  // titre porte le marqueur. Un nettoyage sur le seul numéro les laissait
  // derrière, et la suppression du plan qu'ils référencent échouait alors sur
  // la clé étrangère — mesuré, et c'est ce qui a fait tomber la suite entière
  // en « failed to run » avec pourtant 21 tests au vert.
  const NOTRE_ORDRE = 'order_number LIKE $1 OR title LIKE $2';
  const MARQUES = [`OT-${STAMP}-%`, `ORDRE-${STAMP}-%`];
  await pool.query(
    `DELETE FROM maintenance_reports
      WHERE work_order_id IN (SELECT id FROM work_orders WHERE ${NOTRE_ORDRE})`, MARQUES);
  await pool.query(`DELETE FROM work_orders WHERE ${NOTRE_ORDRE}`, MARQUES);
  await pool.query('DELETE FROM spare_parts WHERE part_number LIKE $1', [`PN-${STAMP}-%`]);
  await pool.query('DELETE FROM preventive_maintenance_plans WHERE plan_name LIKE $1', [`PLAN-${STAMP}-%`]);

  // `equipment_registry` est référencée par des tables que les tâches de fond
  // alimentent en continu (alertes, relevés de capteurs). La liste des
  // référents change : on la demande au catalogue plutôt que de l'énumérer.
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
    ).catch(() => { /* table sans ligne concernée, ou vue : sans conséquence */ });
  }
  await pool.query('DELETE FROM equipment_registry WHERE equipment_id LIKE $1', [`EQ-${STAMP}-%`]);
  await pool.end();
});

// ═══════════════════════════════════════════════════════════════════
describe('Clôture → replanification du plan préventif', () => {
  it("avance l'échéance d'EXACTEMENT une période", async () => {
    // Le plan est dû DEMAIN et l'intervention est faite aujourd'hui : aucune
    // période n'est à rattraper, donc l'échéance doit avancer d'un mois pile.
    const plan = await insererPlan(SEEDED.tenantAlpha, 'A1', 'monthly', 1, '1 day');
    const ordre = await insererOrdre({ tenantId: SEEDED.tenantAlpha, suffixe: 'A1', planId: plan.id });

    const res = await cloturer(ordre, alpha);
    expect(res.status).toBe(200);

    const releve = await echeanceConforme(plan.id, plan.echeance, '1 month');
    // Le message porte les deux dates : un échec doit dire DE COMBIEN on s'est
    // trompé, sinon il faut relancer la suite pour le savoir.
    expect(releve).toMatchObject({ conforme: true });
    expect(`${releve.lue}`).toBe(`${releve.attendue}`);

    // `lastExecuted` est la seconde moitié de la boucle : sans elle,
    // l'historique du préventif reste vide (server/routes.ts le filtre dessus).
    const { derniere } = await planBrut(plan.id);
    expect(derniere).not.toBeNull();
  });

  it("repart de l'échéance PRÉVUE, donc un retard ne décale pas la grille", async () => {
    // Plan mensuel dû il y a 2 mois et 3 jours. Depuis la date de RÉALISATION,
    // l'échéance tomberait dans un mois à compter d'aujourd'hui — et le plan
    // aurait glissé de deux mois pour toujours. Depuis l'échéance prévue, elle
    // reste sur la grille d'origine : origine + 3 mois, la première qui soit
    // dans le futur.
    const plan = await insererPlan(SEEDED.tenantAlpha, 'A2', 'monthly', 1, '-2 months -3 days');
    const ordre = await insererOrdre({ tenantId: SEEDED.tenantAlpha, suffixe: 'A2', planId: plan.id });

    const res = await cloturer(ordre, alpha);
    expect(res.status).toBe(200);

    const releve = await echeanceConforme(plan.id, plan.echeance, '3 months');
    expect(releve).toMatchObject({ conforme: true });
    // Le défaut qu'on empêche : une échéance recalculée qui reste dans le
    // passé ferait ressortir le plan « en retard » juste après son exécution.
    expect(releve.dansLeFutur).toBe(true);
  });

  it("ne touche à aucun plan quand l'ordre n'en porte pas — témoin", async () => {
    // Sans ce témoin, une replanification qui avancerait n'importe quel plan à
    // chaque clôture passerait les deux tests précédents.
    const plan = await insererPlan(SEEDED.tenantAlpha, 'A3', 'monthly', 1, '1 day');
    const avant = await planBrut(plan.id);
    const ordre = await insererOrdre({
      tenantId: SEEDED.tenantAlpha, suffixe: 'A3', planId: null, orderType: 'corrective',
    });

    expect((await cloturer(ordre, alpha)).status).toBe(200);

    expect(await planBrut(plan.id)).toEqual(avant);
  });

  it("enregistre la dernière exécution même sans échéance calculable", async () => {
    // Un plan réglé sur un compteur d'usage n'a pas d'échéance de date : il n'y
    // a rien à recalculer. La date de dernière exécution, elle, est vraie et
    // doit être écrite — sinon l'intervention disparaît de l'historique.
    const plan = await insererPlan(SEEDED.tenantAlpha, 'A4', 'hours_based', 500, '1 day');
    const ordre = await insererOrdre({ tenantId: SEEDED.tenantAlpha, suffixe: 'A4', planId: plan.id });

    expect((await cloturer(ordre, alpha)).status).toBe(200);

    const apres = await planBrut(plan.id);
    expect(apres.derniere).not.toBeNull();
    expect(apres.echeance).toBe(plan.echeance); // inchangée, et c'est voulu
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Clôture → consommation des pièces', () => {
  it('décrémente du BON montant et écrit le mouvement OUT correspondant', async () => {
    const piece = await insererPiece(SEEDED.tenantAlpha, 'B1', 10);
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'B1');
    const ordre = await insererOrdre({ tenantId: SEEDED.tenantAlpha, suffixe: 'B1', equipmentId: equipement });

    const res = await cloturer(ordre, alpha, { partsUsed: [{ sparePartId: piece, quantity: 3 }] });
    expect(res.status).toBe(200);

    // Le stock EN BASE, pas le corps de la réponse : c'est l'écriture qui
    // manquait, et un 200 au-dessus d'une écriture absente ne prouve rien.
    expect(await stockEnBase(piece)).toBe(7);

    const mvts = await mouvements(piece);
    expect(mvts).toHaveLength(1);
    expect(mvts[0]).toMatchObject({
      movement_type: 'OUT',
      quantity: 3,
      previous_stock: 10,
      new_stock: 7,
      reason: 'WORK_ORDER',
      work_order_id: ordre,
      // Le mouvement porte son locataire : sans ce champ, le filet
      // anti-fuite de server/tenant-security-middleware.ts ne sait pas
      // reconnaître la ligne.
      tenant_id: SEEDED.tenantAlpha,
    });
  });

  it('agrège deux lignes de la MÊME référence avant de vérifier', async () => {
    // Deux lignes de 6 sur un stock de 10 : vérifiées séparément, les deux
    // passent (6 ≤ 10) et le stock finirait à -2.
    const piece = await insererPiece(SEEDED.tenantAlpha, 'B2', 10);
    const ordre = await insererOrdre({ tenantId: SEEDED.tenantAlpha, suffixe: 'B2' });

    const res = await cloturer(ordre, alpha, {
      partsUsed: [{ sparePartId: piece, quantity: 6 }, { sparePartId: piece, quantity: 6 }],
    });

    expect(res.status).toBe(409);
    expect(await stockEnBase(piece)).toBe(10);
    expect(await mouvements(piece)).toHaveLength(0);
  });

  it('clôture sans pièces reste possible — témoin de la tournée de graissage', async () => {
    // Le refus pour stock insuffisant ne doit pas rendre toute clôture
    // tributaire d'une déclaration de pièces.
    const ordre = await insererOrdre({ tenantId: SEEDED.tenantAlpha, suffixe: 'B3' });

    expect((await cloturer(ordre, alpha)).status).toBe(200);
    expect((await etatOrdre(ordre)).status).toBe('completed');
  });

  it("renseigne actual_end, que l'interface n'envoie jamais", async () => {
    // Mesuré avant correctif : `actual_end` restait NUL après clôture, donc la
    // date de fin de travail était perdue — et `lastExecuted` n'avait rien à
    // lire. L'interface envoie `{ status: "completed" }` et rien d'autre.
    const ordre = await insererOrdre({ tenantId: SEEDED.tenantAlpha, suffixe: 'B4' });

    expect((await cloturer(ordre, alpha)).status).toBe(200);
    expect((await etatOrdre(ordre)).actual_end).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Stock insuffisant → la clôture est REFUSÉE, et rien n\'est écrit', () => {
  it("refuse en 409, nomme les manques, et n'écrit NI statut NI mouvement NI replanification", async () => {
    // C'est ce test qui éprouve la transaction. Le comportement décidé est le
    // refus (voir l'en-tête de server/cloture-ordre-travail.ts) ; ce qui ne se
    // défendrait pas serait de clôturer en silence sans décrémenter.
    const piece = await insererPiece(SEEDED.tenantAlpha, 'C1', 2);
    const plan = await insererPlan(SEEDED.tenantAlpha, 'C1', 'monthly', 1, '1 day');
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'C1', 'maintenance');
    const ordre = await insererOrdre({
      tenantId: SEEDED.tenantAlpha, suffixe: 'C1',
      equipmentId: equipement, planId: plan.id, requiresShutdown: true,
    });

    const res = await cloturer(ordre, alpha, { partsUsed: [{ sparePartId: piece, quantity: 5 }] });

    // 409 et non 400 : la requête est bien formée, c'est l'état du magasin qui
    // la contredit.
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('STOCK_INSUFFISANT');
    expect(res.body.manques).toHaveLength(1);
    expect(res.body.manques[0]).toMatchObject({
      sparePartId: piece, demande: 5, disponible: 2, manque: 3,
    });

    // L'ANNULATION COMPLÈTE, vérifiée sur chacune des cinq tables que la
    // clôture touche. Un rollback partiel laisserait un état que personne n'a
    // décidé — et c'est exactement ce qu'une transaction est là pour empêcher.
    expect(await stockEnBase(piece)).toBe(2);
    expect(await mouvements(piece)).toHaveLength(0);
    expect((await etatOrdre(ordre)).status).toBe('in_progress');
    expect((await etatOrdre(ordre)).actual_end).toBeNull();
    expect(await planBrut(plan.id)).toEqual({ echeance: plan.echeance, derniere: null });
    expect(await etatEquipement(equipement)).toBe('maintenance');
  });

  it('rend la liste COMPLÈTE des manques, pas le premier rencontré', async () => {
    // Un magasinier à qui l'on annonce une rupture à la fois régularise en
    // autant d'allers-retours.
    const p1 = await insererPiece(SEEDED.tenantAlpha, 'C2a', 1);
    const p2 = await insererPiece(SEEDED.tenantAlpha, 'C2b', 0);
    const p3 = await insererPiece(SEEDED.tenantAlpha, 'C2c', 99);
    const ordre = await insererOrdre({ tenantId: SEEDED.tenantAlpha, suffixe: 'C2' });

    const res = await cloturer(ordre, alpha, {
      partsUsed: [
        { sparePartId: p1, quantity: 4 },
        { sparePartId: p2, quantity: 1 },
        { sparePartId: p3, quantity: 1 },
      ],
    });

    expect(res.status).toBe(409);
    const vises = (res.body.manques as Array<{ sparePartId: number }>).map(m => m.sparePartId).sort();
    expect(vises).toEqual([p1, p2].sort());
    // La pièce disponible n'a pas été sortie : le refus est bien total.
    expect(await stockEnBase(p3)).toBe(99);
  });

  it("la clôture passe une fois le magasin régularisé", async () => {
    // Le refus doit être RATTRAPABLE sur place, et par le bon geste : un
    // ajustement d'inventaire. Sans ce test, « refuser » pourrait vouloir dire
    // « bloquer définitivement ».
    const piece = await insererPiece(SEEDED.tenantAlpha, 'C3', 1);
    const ordre = await insererOrdre({ tenantId: SEEDED.tenantAlpha, suffixe: 'C3' });

    expect((await cloturer(ordre, alpha, { partsUsed: [{ sparePartId: piece, quantity: 3 }] })).status).toBe(409);

    const ajust = await createAuthenticatedRequest('post', '/api/stock/adjust', alpha)
      .send({ sparePartId: piece, newQuantity: 5, notes: `régularisation ${STAMP}` });
    expect(ajust.status).toBe(200);

    expect((await cloturer(ordre, alpha, { partsUsed: [{ sparePartId: piece, quantity: 3 }] })).status).toBe(200);
    expect(await stockEnBase(piece)).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Deux clôtures simultanées', () => {
  it('ne décomptent pas deux fois et n\'avancent le plan qu\'une fois', async () => {
    // `recordStockMovement` LIT le stock puis ÉCRIT une valeur absolue. Deux
    // transactions qui lisent 10 écriraient toutes deux 7 : six pièces
    // sorties, trois décomptées. Le verrou posé sur la ligne de l'ordre de
    // travail, plus la relecture du statut sous ce verrou, sont ce qui
    // l'empêche.
    const piece = await insererPiece(SEEDED.tenantAlpha, 'D1', 10);
    const plan = await insererPlan(SEEDED.tenantAlpha, 'D1', 'monthly', 1, '1 day');
    const ordre = await insererOrdre({ tenantId: SEEDED.tenantAlpha, suffixe: 'D1', planId: plan.id });
    const charge = { partsUsed: [{ sparePartId: piece, quantity: 3 }] };

    // Émises sans attendre l'une l'autre : c'est le recouvrement qui fait le
    // test. Les deux peuvent lire l'ordre « en cours » avant qu'aucune n'ait
    // validé — d'où le besoin du verrou côté transaction.
    const [r1, r2] = await Promise.all([
      cloturer(ordre, alpha, charge),
      cloturer(ordre, alpha, charge),
    ]);

    // Les deux réponses sont acceptables (la seconde est une clôture sans
    // effet) ; ce qui compte est l'état final.
    expect([r1.status, r2.status].every(s => s === 200)).toBe(true);

    expect(await stockEnBase(piece)).toBe(7);
    const mvts = await mouvements(piece);
    expect(mvts).toHaveLength(1);
    expect(mvts[0]).toMatchObject({ previous_stock: 10, new_stock: 7 });

    const releve = await echeanceConforme(plan.id, plan.echeance, '1 month');
    expect(releve).toMatchObject({ conforme: true });
  });

  it("une seconde clôture, plus tard, ne reconsomme rien — idempotence", async () => {
    // Le cas non concurrent du même risque : un rejeu de la requête, un
    // double-clic, une reprise réseau.
    const piece = await insererPiece(SEEDED.tenantAlpha, 'D2', 10);
    const plan = await insererPlan(SEEDED.tenantAlpha, 'D2', 'monthly', 1, '1 day');
    const ordre = await insererOrdre({ tenantId: SEEDED.tenantAlpha, suffixe: 'D2', planId: plan.id });
    const charge = { partsUsed: [{ sparePartId: piece, quantity: 2 }] };

    expect((await cloturer(ordre, alpha, charge)).status).toBe(200);
    expect((await cloturer(ordre, alpha, charge)).status).toBe(200);

    expect(await stockEnBase(piece)).toBe(8);
    expect(await mouvements(piece)).toHaveLength(1);
    const releve = await echeanceConforme(plan.id, plan.echeance, '1 month');
    expect(releve).toMatchObject({ conforme: true });
  });
});

// ═══════════════════════════════════════════════════════════════════
describe("Clôture → état opérationnel de l'équipement", () => {
  it('remet en service un équipement immobilisé par une intervention AVEC arrêt', async () => {
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'E1', 'maintenance');
    const ordre = await insererOrdre({
      tenantId: SEEDED.tenantAlpha, suffixe: 'E1', equipmentId: equipement, requiresShutdown: true,
    });

    expect((await cloturer(ordre, alpha)).status).toBe(200);

    expect(await etatEquipement(equipement)).toBe('operational');
  });

  it("ne touche à rien pour une intervention SANS arrêt — la tournée de graissage", async () => {
    // Le défaut qu'on empêche : faire basculer l'état sur tout OT déclarerait
    // indisponible un équipement qui produit, et fausserait la disponibilité.
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'E2', 'maintenance');
    const ordre = await insererOrdre({
      tenantId: SEEDED.tenantAlpha, suffixe: 'E2', equipmentId: equipement, requiresShutdown: false,
    });

    expect((await cloturer(ordre, alpha)).status).toBe(200);

    expect(await etatEquipement(equipement)).toBe('maintenance');
  });

  it("ne remet PAS en service s'il reste un autre ordre ouvert avec arrêt", async () => {
    // Deux interventions avec arrêt peuvent être ouvertes en même temps.
    // Remettre en service à la première clôture déclarerait disponible une
    // machine encore consignée pour la seconde — un défaut de sécurité.
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'E3', 'maintenance');
    const premier = await insererOrdre({
      tenantId: SEEDED.tenantAlpha, suffixe: 'E3a', equipmentId: equipement, requiresShutdown: true,
    });
    const second = await insererOrdre({
      tenantId: SEEDED.tenantAlpha, suffixe: 'E3b', equipmentId: equipement, requiresShutdown: true,
    });

    expect((await cloturer(premier, alpha)).status).toBe(200);
    expect(await etatEquipement(equipement)).toBe('maintenance');

    // La seconde clôture libère la machine : plus aucun arrêt ouvert.
    expect((await cloturer(second, alpha)).status).toBe(200);
    expect(await etatEquipement(equipement)).toBe('operational');
  });

  it("n'écrase pas un équipement hors ligne ou réformé", async () => {
    // `offline` et `decommissioned` sont des décisions d'exploitation. Une
    // clôture d'intervention ne doit pas les effacer au profit d'un état
    // transitoire — on ne rebascule que depuis `maintenance`.
    const horsLigne = await insererEquipement(SEEDED.tenantAlpha, 'E4', 'offline');
    const ordre = await insererOrdre({
      tenantId: SEEDED.tenantAlpha, suffixe: 'E4', equipmentId: horsLigne, requiresShutdown: true,
    });

    expect((await cloturer(ordre, alpha)).status).toBe(200);

    expect(await etatEquipement(horsLigne)).toBe('offline');
  });

  it('immobilise la machine au DÉMARRAGE d\'une intervention avec arrêt', async () => {
    // Symétrique de la remise en service : sans cette bascule, la clôture
    // n'aurait jamais rien à remettre en service, et `operationalState`
    // resterait une colonne que le serveur n'écrit qu'à l'import.
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'E5', 'operational');
    const ordre = await insererOrdre({
      tenantId: SEEDED.tenantAlpha, suffixe: 'E5',
      equipmentId: equipement, status: 'pending', requiresShutdown: true,
    });

    const res = await createAuthenticatedRequest('put', `/api/work-orders/${ordre}`, alpha)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);

    expect(await etatEquipement(equipement)).toBe('maintenance');
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Le rattachement au plan ne traverse pas la frontière entre locataires', () => {
  it("refuse d'attacher un ordre d'Alpha à un plan de Beta", async () => {
    // La clé étrangère vérifie que le plan EXISTE, pas à qui il est. Sans le
    // contrôle de locataire, la clôture de cet ordre avancerait l'échéance
    // d'une gamme d'une autre organisation.
    const planBeta = await insererPlan(SEEDED.tenantBeta, 'F1', 'monthly', 1, '1 day');
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'F1');

    const res = await createAuthenticatedRequest('post', '/api/work-orders', alpha).send({
      title: `ORDRE-${STAMP}-F1`,
      description: 'Tentative de rattachement hors locataire',
      category: 'Préventif',
      equipmentId: equipement,
      planId: planBeta.id,
    });

    expect(res.status).toBe(400);

    // Et le plan de Beta est intact.
    expect(await planBrut(planBeta.id)).toEqual({ echeance: planBeta.echeance, derniere: null });
  });

  it("accepte un plan du MÊME locataire — témoin", async () => {
    // Sans ce témoin, un contrôle qui refuserait tous les `planId` passerait
    // le test précédent.
    const planAlpha = await insererPlan(SEEDED.tenantAlpha, 'F2', 'monthly', 1, '1 day');
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'F2');

    const res = await createAuthenticatedRequest('post', '/api/work-orders', alpha).send({
      title: `ORDRE-${STAMP}-F2`,
      description: 'Rattachement légitime au plan du locataire',
      category: 'Préventif',
      equipmentId: equipement,
      planId: planAlpha.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.planId).toBe(planAlpha.id);
  });

  it("Beta ne peut pas clôturer un ordre d'Alpha", async () => {
    const piece = await insererPiece(SEEDED.tenantAlpha, 'F3', 10);
    const ordre = await insererOrdre({ tenantId: SEEDED.tenantAlpha, suffixe: 'F3' });

    const res = await cloturer(ordre, beta, { partsUsed: [{ sparePartId: piece, quantity: 1 }] });

    expect(res.status).not.toBe(200);
    expect((await etatOrdre(ordre)).status).toBe('in_progress');
    expect(await stockEnBase(piece)).toBe(10);
  });
});
