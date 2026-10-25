/**
 * La politique d'approvisionnement d'un locataire reste-t-elle chez lui ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ
 * ═══════════════════════════════════════════════════════════════════
 * `reorder_rules` a été créée sans `tenant_id` (migration 0000) — dernière
 * table de la chaîne achats dans ce cas, après que 0019 ait cloisonné
 * `suppliers` et 0023 `purchase_orders` et `purchase_order_items`.
 *
 * `getReorderRules()` ne filtrait sur rien, et DEUX routes la servaient :
 * `GET /api/reorder-rules` (server/gmao-routes.ts) et `GET /reorder-rules`
 * (server/procurement-routes.ts). Le tableau de bord « Stocks & Achats »
 * affichait donc à chaque client les règles de TOUS les autres : seuil de
 * déclenchement, quantité à commander, stock maximum, délai, fournisseur
 * retenu, drapeau de commande automatique. C'est-à-dire, mises bout à bout,
 * leur politique d'approvisionnement — à quel rythme ils consomment une pièce
 * et combien ils immobilisent en stock.
 *
 * `PUT /reorder-rules/:id` agissait de son côté sur un identifiant nu : la
 * règle de n'importe qui.
 *
 * Et deux fuites de plus, que le typage a révélées en cloisonnant la première :
 * `getPartsNeedingReorder()` lisait TOUTES les pièces de rechange
 * (`db.select().from(spareParts)` nu) puis la règle de chacune, servie par
 * `GET /api/parts-needing-reorder` et `GET /parts-needing-reorder`.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI NE FUYAIT PAS, ET POURQUOI CETTE SUITE LE VÉRIFIE AUSSI
 * ═══════════════════════════════════════════════════════════════════
 * Le DÉCLENCHEMENT automatique était accidentellement protégé :
 * `checkStockLevelsAndTriggerReorders(tenantId)` lisait toutes les règles mais
 * résolvait la pièce dans la portée du locataire, et passait à la suivante
 * quand elle n'y était pas. Une règle d'autrui ne pouvait donc pas créer de
 * commande. Le dernier cas de cette suite fixe ce comportement : il était juste
 * par accident, il doit le rester par construction.
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
const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });

const STAMP = `RAP${Date.now()}`;

let alpha: AuthenticatedAgent;
let beta: AuthenticatedAgent;

/** Une pièce de rechange, dont le stock est volontairement sous le seuil. */
async function creerPiece(tenantId: string, suffixe: string, stock: number): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO spare_parts (tenant_id, part_number, part_name, current_stock, min_stock, reorder_point)
     VALUES ($1, $2, $3, $4, 5, 10) RETURNING id`,
    [tenantId, `SP-${STAMP}-${suffixe}`, `Pièce ${suffixe} ${STAMP}`, stock],
  );
  return rows[0].id;
}

/** Une règle de réapprovisionnement, avec son locataire explicite. */
async function creerRegle(
  tenantId: string,
  sparePartId: number,
  options: { seuil?: number; quantite?: number; autoOrder?: boolean } = {},
): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO reorder_rules (tenant_id, spare_part_id, reorder_point, reorder_quantity, is_active, auto_order)
     VALUES ($1, $2, $3, $4, true, $5) RETURNING id`,
    [tenantId, sparePartId, options.seuil ?? 10, options.quantite ?? 50, options.autoOrder ?? false],
  );
  return rows[0].id;
}

async function lireRegle(id: number) {
  const { rows } = await pool.query(
    'SELECT tenant_id, reorder_point, reorder_quantity, auto_order, last_triggered FROM reorder_rules WHERE id = $1',
    [id],
  );
  return rows[0];
}

let pieceAlpha = 0;
let pieceBeta = 0;
let regleAlpha = 0;
let regleBeta = 0;

beforeAll(async () => {
  alpha = await authenticateUser(SEEDED.admin, SEEDED.password);
  beta = await authenticateUser(SEEDED.adminBeta, SEEDED.password);

  pieceAlpha = await creerPiece(SEEDED.tenantAlpha, 'A', 2);
  pieceBeta = await creerPiece(SEEDED.tenantBeta, 'B', 2);
  // Des valeurs distinctes et reconnaissables : si l'une apparaît chez l'autre,
  // on sait laquelle a fui.
  regleAlpha = await creerRegle(SEEDED.tenantAlpha, pieceAlpha, { seuil: 11, quantite: 111 });
  regleBeta = await creerRegle(SEEDED.tenantBeta, pieceBeta, { seuil: 22, quantite: 222 });
}, 60_000);

afterAll(async () => {
  await pool.query('DELETE FROM reorder_rules WHERE spare_part_id IN (SELECT id FROM spare_parts WHERE part_number LIKE $1)', [`SP-${STAMP}-%`]);
  await pool.query('DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE notes LIKE $1)', [`%${STAMP}%`]);
  await pool.query('DELETE FROM purchase_orders WHERE notes LIKE $1', [`%${STAMP}%`]);
  await pool.query('DELETE FROM alerts_notifications WHERE message LIKE $1', [`%${STAMP}%`]);
  await pool.query('DELETE FROM stock_movements WHERE spare_part_id IN (SELECT id FROM spare_parts WHERE part_number LIKE $1)', [`SP-${STAMP}-%`]).catch(() => { /* table absente selon le schéma */ });
  await pool.query('DELETE FROM spare_parts WHERE part_number LIKE $1', [`SP-${STAMP}-%`]);
  await pool.end();

  const { pool: poolServeur } = await import('../../server/db');
  await poolServeur.end();
}, 60_000);

// ═══════════════════════════════════════════════════════════════════
describe('Lecture des règles — les deux routes qui les servaient', () => {
  it.each([
    ['/api/reorder-rules', 'gmao-routes'],
    ['/api/procurement/reorder-rules', 'procurement-routes'],
  ])('%s ne rend que les règles du locataire appelant', async (chemin) => {
    const vue = await createAuthenticatedRequest('get', chemin, alpha);
    // Une route montée sous un autre préfixe donnerait 404 : on le dit, plutôt
    // que de laisser un `[]` passer pour un cloisonnement réussi.
    expect(vue.status).toBe(200);

    const regles = vue.body as Array<{ id: number; reorderQuantity?: number; reorder_quantity?: number }>;
    const ids = regles.map((r) => r.id);
    expect(ids).toContain(regleAlpha);
    expect(ids).not.toContain(regleBeta);

    // Et sur le fond, pas seulement sur les identifiants : la quantité de Beta
    // ne doit apparaître nulle part.
    const quantites = regles.map((r) => Number(r.reorderQuantity ?? r.reorder_quantity));
    expect(quantites).not.toContain(222);
  }, 60_000);

  it("Beta ne voit pas davantage les règles d'Alpha", async () => {
    const vue = await createAuthenticatedRequest('get', '/api/reorder-rules', beta);
    expect(vue.status).toBe(200);
    const ids = (vue.body as Array<{ id: number }>).map((r) => r.id);
    expect(ids).toContain(regleBeta);
    expect(ids).not.toContain(regleAlpha);
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
describe('Écriture des règles', () => {
  it("une création inscrit le locataire de la SESSION, et ignore celui du corps", async () => {
    const r = await createAuthenticatedRequest('post', '/api/reorder-rules', alpha).send({
      tenantId: SEEDED.tenantBeta,   // ← ce que le client prétend
      sparePartId: pieceAlpha,
      reorderPoint: 7,
      reorderQuantity: 77,
    });

    expect(r.status).toBe(201);
    const creee = await lireRegle(r.body.id);
    expect(creee.tenant_id).toBe(SEEDED.tenantAlpha);
  }, 60_000);

  it("une mise à jour sur la règle d'une AUTRE organisation rend 404 et n'écrit rien", async () => {
    const avant = await lireRegle(regleBeta);

    const r = await createAuthenticatedRequest('put', `/api/procurement/reorder-rules/${regleBeta}`, alpha)
      .send({ reorderQuantity: 999 });

    expect(r.status).toBe(404);
    const apres = await lireRegle(regleBeta);
    expect(Number(apres.reorder_quantity)).toBe(Number(avant.reorder_quantity));
    expect(Number(apres.reorder_quantity)).toBe(222);
  }, 60_000);

  it('une mise à jour sur sa propre règle passe', async () => {
    const r = await createAuthenticatedRequest('put', `/api/procurement/reorder-rules/${regleAlpha}`, alpha)
      .send({ reorderQuantity: 123 });

    expect(r.status).toBe(200);
    expect(Number((await lireRegle(regleAlpha)).reorder_quantity)).toBe(123);
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
describe('Pièces en rupture — la lecture que le typage a révélée', () => {
  it.each([
    ['/api/parts-needing-reorder'],
    ['/api/procurement/parts-needing-reorder'],
  ])('%s ne rend que les pièces du locataire appelant', async (chemin) => {
    const vue = await createAuthenticatedRequest('get', chemin, alpha);
    expect(vue.status).toBe(200);

    const pieces = vue.body as Array<{ id: number; partNumber?: string; part_number?: string }>;
    const numeros = pieces.map((p) => p.partNumber ?? p.part_number);
    expect(numeros).toContain(`SP-${STAMP}-A`);
    expect(numeros).not.toContain(`SP-${STAMP}-B`);
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
describe("Déclenchement automatique — juste par construction, non par accident", () => {
  it("le contrôle de stock d'Alpha ne déclenche pas la règle de Beta", async () => {
    const { gmaoStorage } = await import('../../server/gmao-storage');

    const avantBeta = await lireRegle(regleBeta);
    const resultat = await gmaoStorage.checkStockLevelsAndTriggerReorders(SEEDED.tenantAlpha);

    // Aucune règle de Beta dans les règles déclenchées…
    const idsDeclenches = resultat.triggeredRules.map((r) => r.id);
    expect(idsDeclenches).not.toContain(regleBeta);

    // …et son horodatage de dernier déclenchement n'a pas bougé. C'est ce
    // second contrôle qui compte : avant cloisonnement, la règle de Beta était
    // bien PARCOURUE par le contrôle d'Alpha, et seule l'absence de la pièce
    // dans sa portée l'empêchait d'aller plus loin.
    const apresBeta = await lireRegle(regleBeta);
    expect(apresBeta.last_triggered).toEqual(avantBeta.last_triggered);
  }, 60_000);
});
