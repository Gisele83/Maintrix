/**
 * La conformité CCTP laisse-t-elle l'appelant désigner l'organisation ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ
 * ═══════════════════════════════════════════════════════════════════
 * Les dix routes de `server/cctp-routes.ts` prenaient le locataire DANS L'URL
 * (`/api/cctp/tenant/:tenantId/...`) et le passaient tel quel au service.
 * Aucune ne le comparait à la session. Changer un segment d'URL suffisait donc
 * à travailler dans les données d'une autre entreprise — y compris EN ÉCRITURE :
 *
 *   • la configuration des bons de commande porte les seuils de montant,
 *     l'entête d'impression et la GRILLE DE VALIDATION (qui approuve jusqu'à
 *     combien). En lecture comme en écriture ;
 *   • la configuration des rapports porte la liste de diffusion par courriel ;
 *   • `POST /tenant/:id/work-order/:ot/generate-report` produisait un rapport
 *     d'intervention complet — description, technicien, durée, équipement — sur
 *     l'ordre de travail d'un autre locataire. Là, le défaut était double :
 *     l'URL désignait l'organisation, ET `checkAndGenerateWorkOrderReport`
 *     cherchait l'ordre de travail sur son seul identifiant alors que
 *     `work_orders.tenant_id` est NOT NULL et que le locataire était dans sa
 *     signature.
 *
 * L'écran `client/src/pages/cctp-compliance.tsx` envoie l'organisation
 * authentifiée depuis sa correction du 19/10/2026 : le défaut n'était pas
 * atteint par l'interface, il l'était par quiconque formait l'URL à la main.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE MESURE
 * ═══════════════════════════════════════════════════════════════════
 * Deux barrières, distinctes, et chacune éprouvée pour elle-même :
 *
 *   1. le SEGMENT D'URL ne vaut plus autorisation — un segment qui contredit la
 *      session donne 403 (`locataireDeLaSession`) ;
 *   2. même avec une URL légitime, la REQUÊTE est cloisonnée — l'ordre de
 *      travail d'un autre locataire n'est pas atteignable.
 *
 * La seconde est celle qui compte : sans elle, la première ne serait qu'un
 * contrôle de forme sur l'URL.
 *
 * Chaque cas d'écriture RELIT LA CONFIGURATION EN BASE après coup. Un 403 rendu
 * par-dessus un UPDATE qui s'exécute quand même serait indiscernable d'un vrai
 * refus si l'on s'arrêtait au code de retour.
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

const STAMP = `CCTP${Date.now()}`;

let alpha: AuthenticatedAgent;
let beta: AuthenticatedAgent;

/** La configuration de bon de commande d'un locataire, relue en base. */
async function configEnBase(tenantId: string): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    'SELECT purchase_order_config AS config FROM tenants WHERE id = $1',
    [tenantId],
  );
  return rows[0]?.config ?? null;
}

/** Un ordre de travail TERMINÉ dans le locataire donné — l'état qu'exige le rapport. */
async function creerOrdreTermine(tenantId: string, suffixe: string): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO work_orders (tenant_id, order_number, order_type, title, description,
                              status, actual_duration, actual_end)
     VALUES ($1, $2, 'corrective', $3, $4, 'completed', 120, now())
     RETURNING id`,
    [
      tenantId,
      `WO-${STAMP}-${suffixe}`,
      `Ordre ${suffixe} ${STAMP}`,
      `Intervention confidentielle ${suffixe} ${STAMP}`,
    ],
  );
  return rows[0].id;
}

beforeAll(async () => {
  alpha = await authenticateUser(SEEDED.admin, SEEDED.password);
  beta = await authenticateUser(SEEDED.adminBeta, SEEDED.password);

  // L'auto-génération doit être active chez Alpha, sinon
  // `checkAndGenerateWorkOrderReport` rend `null` avant même de chercher
  // l'ordre de travail — et le cas « je n'atteins pas l'OT d'autrui » passerait
  // pour la mauvaise raison.
  await pool.query(
    `UPDATE tenants SET work_order_config = '{"autoReportGeneration": true}'::jsonb WHERE id = $1`,
    [SEEDED.tenantAlpha],
  );
}, 60_000);

afterAll(async () => {
  await pool.query('DELETE FROM work_orders WHERE order_number LIKE $1', [`WO-${STAMP}-%`]);
  await pool.end();
}, 60_000);

// ═══════════════════════════════════════════════════════════════════
describe("Le segment d'URL ne vaut plus autorisation", () => {
  it("lire la configuration de bon de commande d'une AUTRE organisation est refusé", async () => {
    const r = await createAuthenticatedRequest(
      'get', `/api/cctp/tenant/${SEEDED.tenantBeta}/purchase-order-config`, alpha,
    );

    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).toMatch(/LOCATAIRE_ETRANGER/);
    // Et rien de la configuration de Beta n'a été servi au passage.
    expect(JSON.stringify(r.body)).not.toMatch(/companyHeader|validationLevels|numberingPrefix/);
  }, 60_000);

  it("ÉCRIRE la configuration d'une autre organisation est refusé, et n'écrit RIEN", async () => {
    const avant = await configEnBase(SEEDED.tenantBeta);

    // ⚠️ CETTE CHARGE UTILE DOIT ÊTRE VALIDE AU REGARD DE
    // `PurchaseOrderConfigSchema`, sinon ce cas ne prouve rien : une première
    // version portait `email: 'c@d.e'`, que Zod refuse (TLD d'une lettre). Le
    // témoin négatif rendait alors 400 au lieu de 200, et « rien n'a été
    // écrit » était vrai parce que la VALIDATION avait refusé — pas le
    // cloisonnement. Vérifié depuis : avec cette charge, le témoin négatif
    // rend 200 et la configuration de Beta est bel et bien réécrite.
    const r = await createAuthenticatedRequest(
      'put', `/api/cctp/tenant/${SEEDED.tenantBeta}/purchase-order-config`, alpha,
    ).send({
      letterOrderThreshold: 1,
      purchaseOrderThreshold: 1,
      companyHeader: {
        name: `DÉTOURNÉ PAR ALPHA ${STAMP}`,
        address: 'Adresse imposée', phone: '+33000000000', email: 'complice@exemple.test',
      },
      validationLevels: [{ level: 1, name: 'Complice', maxAmount: 9_999_999, roleRequired: 'admin' }],
      autoGenerate: true,
      numberingPrefix: 'XX',
    });

    expect(r.status).toBe(403);

    // LA PREUVE EST EN BASE. Abaisser le seuil de validation d'un concurrent à
    // 1 € et y inscrire un approbateur à 9 999 999 € est exactement ce que
    // cette route permettait.
    const apres = await configEnBase(SEEDED.tenantBeta);
    expect(apres).toEqual(avant);
    expect(JSON.stringify(apres ?? {})).not.toMatch(new RegExp(STAMP));
  }, 60_000);

  it("la configuration des rapports d'une autre organisation est tout aussi fermée", async () => {
    const lecture = await createAuthenticatedRequest(
      'get', `/api/cctp/tenant/${SEEDED.tenantBeta}/reporting-config`, alpha,
    );
    expect(lecture.status).toBe(403);

    const ecriture = await createAuthenticatedRequest(
      'put', `/api/cctp/tenant/${SEEDED.tenantBeta}/auto-reports`, alpha,
    ).send({ enabled: false });
    expect(ecriture.status).toBe(403);
  }, 60_000);

  it('le relevé de conformité et son rapport imprimable sont refusés aussi', async () => {
    const releve = await createAuthenticatedRequest(
      'get', `/api/cctp/tenant/${SEEDED.tenantBeta}/cctp-compliance`, alpha,
    );
    expect(releve.status).toBe(403);

    const rapport = await createAuthenticatedRequest(
      'get', `/api/cctp/tenant/${SEEDED.tenantBeta}/cctp-compliance/report`, alpha,
    );
    expect(rapport.status).toBe(403);
    // Le rapport interpole le locataire dans son HTML : il ne doit pas non plus
    // être rendu avec l'identifiant de Beta dedans.
    expect(String(rapport.text ?? '')).not.toMatch(new RegExp(SEEDED.tenantBeta));
  }, 60_000);

  it('sa propre organisation reste accessible — le garde ne ferme pas tout', async () => {
    const r = await createAuthenticatedRequest(
      'get', `/api/cctp/tenant/${SEEDED.tenantAlpha}/purchase-order-config`, alpha,
    );
    expect(r.status).toBe(200);
    expect(r.body).toBeTruthy();
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
describe('Même avec une URL légitime, la requête est cloisonnée', () => {
  it("le rapport d'intervention d'un ordre de travail d'AUTRUI n'est pas produit", async () => {
    // Le cas que le contrôle d'URL seul ne couvre PAS : Alpha nomme sa propre
    // organisation — l'URL est irréprochable — et désigne l'ordre de travail de
    // Beta. Sans le filtre dans `checkAndGenerateWorkOrderReport`, le rapport
    // sortait avec la description et le technicien de Beta.
    const ordreBeta = await creerOrdreTermine(SEEDED.tenantBeta, 'beta');

    const r = await createAuthenticatedRequest(
      'post', `/api/cctp/tenant/${SEEDED.tenantAlpha}/work-order/${ordreBeta}/generate-report`, alpha,
    ).send({});

    // 400 : le service rend `null`, l'ordre n'étant pas atteignable dans la
    // portée d'Alpha — même réponse que pour un ordre inexistant, ce qui est
    // la bonne réponse.
    expect(r.status).toBe(400);

    // Et SURTOUT : rien de Beta n'est sorti dans le corps de la réponse.
    const corps = JSON.stringify(r.body) + String(r.text ?? '');
    expect(corps).not.toMatch(new RegExp(`Intervention confidentielle beta ${STAMP}`));
    expect(corps).not.toMatch(new RegExp(`WO-${STAMP}-beta`));
  }, 60_000);

  it("son propre ordre de travail terminé donne bien un rapport", async () => {
    // Le témoin positif : sans lui, le cas ci-dessus passerait même si la route
    // était cassée pour tout le monde.
    const ordreAlpha = await creerOrdreTermine(SEEDED.tenantAlpha, 'alpha');

    const r = await createAuthenticatedRequest(
      'post', `/api/cctp/tenant/${SEEDED.tenantAlpha}/work-order/${ordreAlpha}/generate-report`, alpha,
    ).send({});

    expect(r.status).toBe(200);
    expect(String(r.text ?? '')).toMatch(new RegExp(`WO-${STAMP}-alpha`));
  }, 60_000);
});
