/**
 * Le stock d'un locataire ne se lit ni ne se modifie depuis un autre.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT OUVERT, ET MESURÉ
 * ═══════════════════════════════════════════════════════════════════
 * Aucune méthode de `server/stock-management.ts` ne recevait de locataire, et
 * ses quatre accès à la base cherchaient `spare_parts` / `stock_movements` par
 * clé primaire seule — ou, pour les alertes, sans aucune condition. Les huit
 * routes `/api/stock/*` prenaient le `sparePartId` dans la requête et le
 * transmettaient tel quel. Mesuré sur `96fe408`, deux locataires :
 *
 *   • `GET /api/stock/alerts/low-stock` servait à l'administrateur d'Alpha les
 *     pièces sous seuil de TOUS les locataires — « ROULEMENT SECRET DE BETA,
 *     stock 0/10, CRITICAL ». L'écran des alertes de stock appelle cette route.
 *   • `GET /api/stock/:id/availability/:qty` renvoyait le niveau de stock
 *     d'une pièce de Beta, en HTTP 200.
 *   • `POST /api/stock/adjust` laissait Alpha porter de **1 à 999** le stock
 *     d'une pièce de Beta — une ÉCRITURE chez autrui, appliquée en base.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE VERROUILLE
 * ═══════════════════════════════════════════════════════════════════
 * Trois propriétés, et le témoin qui les rend significatives :
 *
 *   1. les ALERTES ne nomment que les pièces du demandeur ;
 *   2. une pièce d'autrui est, en lecture comme en écriture, un objet absent
 *      (404) — jamais une donnée servie, jamais une écriture appliquée ;
 *   3. le stock d'autrui est INCHANGÉ EN BASE après une tentative, ce qui est
 *      vérifié sur la table et non sur le code de retour : un 4xx poli
 *      au-dessus d'une écriture déjà faite ne prouverait rien ;
 *   4. témoin — le demandeur garde l'accès et le droit d'écriture sur SES
 *      pièces. Sans lui, une route cassée pour tout le monde passerait.
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

const STAMP = `STK${Date.now()}`;

/** Les deux pièces sont sous leur seuil, donc toutes deux candidates aux alertes. */
const ALPHA_STOCK = 2;
const BETA_STOCK = 1;
const SEUIL = 10;

let alpha: AuthenticatedAgent;
let beta: AuthenticatedAgent;
let pieceAlpha: number;
let pieceBeta: number;

async function insererPiece(tenantId: string, suffixe: string, stock: number): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO spare_parts
       (tenant_id, part_number, part_name, category, current_stock, min_stock, unit_price, created_at)
     VALUES ($1,$2,$3,'mecanique',$4,$5,450,now())
     RETURNING id`,
    [tenantId, `PN-${STAMP}-${suffixe}`, `PIECE-${STAMP}-${suffixe}`, stock, SEUIL],
  );
  return rows[0].id;
}

/** Le stock réellement écrit en base — la seule mesure qui vaut pour une écriture. */
async function stockEnBase(id: number): Promise<number | null> {
  const { rows } = await pool.query<{ current_stock: number | null }>(
    'SELECT current_stock FROM spare_parts WHERE id = $1', [id]);
  return rows[0]?.current_stock ?? null;
}

beforeAll(async () => {
  alpha = await authenticateUser(SEEDED.admin, SEEDED.password);
  beta = await authenticateUser(SEEDED.adminBeta, SEEDED.password);

  pieceAlpha = await insererPiece(SEEDED.tenantAlpha, 'A', ALPHA_STOCK);
  pieceBeta = await insererPiece(SEEDED.tenantBeta, 'B', BETA_STOCK);

  // Un mouvement chez Beta, porteur d'un motif reconnaissable : sans lui,
  // l'historique serait vide et son cloisonnement ne prouverait rien.
  await pool.query(
    `INSERT INTO stock_movements
       (tenant_id, spare_part_id, movement_type, quantity, previous_stock, new_stock,
        reason, reference, created_at)
     VALUES ($1,$2,'OUT',4,5,$3,$4,$5,now())`,
    [SEEDED.tenantBeta, pieceBeta, BETA_STOCK, `motif de Beta ${STAMP}`, `REF-${STAMP}-B`],
  );
});

afterAll(async () => {
  await pool.query(
    'DELETE FROM stock_movements WHERE spare_part_id IN (SELECT id FROM spare_parts WHERE part_number LIKE $1)',
    [`PN-${STAMP}-%`]);
  await pool.query('DELETE FROM spare_parts WHERE part_number LIKE $1', [`PN-${STAMP}-%`]);
  await pool.end();
});

// ═══════════════════════════════════════════════════════════════════
describe('GET /api/stock/alerts/low-stock', () => {
  it("ne nomme que les pièces du demandeur", async () => {
    // C'était la fuite visible dans l'écran : les pièces sous seuil de tous
    // les locataires. Les deux pièces de cette suite sont sous leur seuil,
    // donc les deux seraient remontées sans cloisonnement.
    const res = await createAuthenticatedRequest('get', '/api/stock/alerts/low-stock', alpha);

    expect(res.status).toBe(200);
    expect(res.text).toContain(`PIECE-${STAMP}-A`);
    expect(res.text).not.toContain(`PIECE-${STAMP}-B`);
  });

  it('Beta voit les siennes, et pas celles d\'Alpha', async () => {
    // Le cas qui distingue un cloisonnement d'une route cassée : si elle ne
    // rendait plus rien à personne, le test précédent passerait quand même.
    const res = await createAuthenticatedRequest('get', '/api/stock/alerts/low-stock', beta);

    expect(res.status).toBe(200);
    expect(res.text).toContain(`PIECE-${STAMP}-B`);
    expect(res.text).not.toContain(`PIECE-${STAMP}-A`);
  });

  it("un anonyme n'obtient rien", async () => {
    const res = await anonymousRequest('get', '/api/stock/alerts/low-stock');

    expect([401, 403]).toContain(res.status);
    expect(res.text ?? '').not.toContain(`PIECE-${STAMP}-A`);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('GET /api/stock/:id/availability/:quantity', () => {
  it('rend le niveau de stock de SA pièce', async () => {
    const res = await createAuthenticatedRequest('get', `/api/stock/${pieceAlpha}/availability/1`, alpha);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ currentStock: ALPHA_STOCK });
  });

  it("traite la pièce d'un autre locataire comme absente, et ne livre pas son stock", async () => {
    const res = await createAuthenticatedRequest('get', `/api/stock/${pieceBeta}/availability/1`, alpha);

    // 404 et non 500 : l'objet est hors de portée, le serveur n'est pas en panne.
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain(`"currentStock":${BETA_STOCK}`);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('GET /api/stock/:id/history', () => {
  it("ne rend pas l'historique de la pièce d'un autre locataire", async () => {
    const res = await createAuthenticatedRequest('get', `/api/stock/${pieceBeta}/history`, alpha);

    expect(res.text).not.toContain(`motif de Beta ${STAMP}`);
    expect(res.text).not.toContain(`REF-${STAMP}-B`);
  });

  it('Beta obtient bien le sien — le refus ci-dessus vise le locataire, pas la route', async () => {
    const res = await createAuthenticatedRequest('get', `/api/stock/${pieceBeta}/history`, beta);

    expect(res.status).toBe(200);
    expect(res.text).toContain(`motif de Beta ${STAMP}`);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe("POST /api/stock/adjust — l'écriture ne franchit pas le locataire", () => {
  it("n'applique pas un ajustement sur la pièce d'un autre locataire", async () => {
    // Le défaut le plus grave du lot : mesuré, Alpha portait le stock de Beta
    // de 1 à 999. On vérifie le refus ET la table, dans cet ordre
    // d'importance inverse : c'est la table qui tranche.
    const avant = await stockEnBase(pieceBeta);

    const res = await createAuthenticatedRequest('post', '/api/stock/adjust', alpha)
      .send({ sparePartId: pieceBeta, newQuantity: 999, performedBy: 1 });

    expect(res.status).toBe(404);
    expect(await stockEnBase(pieceBeta)).toBe(avant);
  });

  it('applique bien un ajustement sur SA propre pièce', async () => {
    // Témoin indispensable : sans lui, une route qui refuserait toute écriture
    // passerait le test précédent.
    const res = await createAuthenticatedRequest('post', '/api/stock/adjust', alpha)
      .send({ sparePartId: pieceAlpha, newQuantity: 7, performedBy: 1 });

    expect(res.status).toBe(200);
    expect(await stockEnBase(pieceAlpha)).toBe(7);
  });

  it('rattache le mouvement créé à son locataire', async () => {
    // Ce champ n'était jamais posé : tous les mouvements existants ont un
    // `tenant_id` nul. C'est aussi ce qui rendait `antiLeakageValidator`
    // aveugle à ces charges.
    const { rows } = await pool.query<{ tenant_id: string | null }>(
      'SELECT tenant_id FROM stock_movements WHERE spare_part_id = $1 ORDER BY id DESC LIMIT 1',
      [pieceAlpha]);

    expect(rows[0]?.tenant_id).toBe(SEEDED.tenantAlpha);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Les autres mutations de stock sont cloisonnées par la même garde', () => {
  // Les cinq routes de mutation passent toutes par `recordStockMovement`, dont
  // la lecture ET la mise à jour portent désormais la condition de locataire.
  // On les vérifie une à une plutôt que de déduire des trois précédentes : une
  // route qui résoudrait mal son locataire ne serait visible que sur elle.
  const mutations: Array<[string, string, Record<string, unknown>]> = [
    ['sortie pour maintenance', '/api/stock/outbound', { quantity: 1, performedBy: 1 }],
    ['retour en stock', '/api/stock/return', { quantity: 1, performedBy: 1 }],
    ['entrée en stock', '/api/stock/inbound', { quantity: 1, reason: 'PURCHASE', performedBy: 1 }],
    ['réservation', '/api/stock/reserve', { quantity: 1, workOrderId: 1, performedBy: 1 }],
  ];

  for (const [libelle, chemin, corps] of mutations) {
    it(`${libelle} : refusée sur la pièce d'un autre locataire, stock inchangé`, async () => {
      const avant = await stockEnBase(pieceBeta);

      const res = await createAuthenticatedRequest('post', chemin, alpha)
        .send({ sparePartId: pieceBeta, ...corps });

      expect({ chemin, statut: res.status }).toEqual({ chemin, statut: 404 });
      expect({ chemin, stock: await stockEnBase(pieceBeta) }).toEqual({ chemin, stock: avant });
    });
  }
});
