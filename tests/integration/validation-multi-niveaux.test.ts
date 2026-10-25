/**
 * Le circuit de validation contrôle-t-il quelque chose ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ
 * ═══════════════════════════════════════════════════════════════════
 * `POST /api/validation/work-orders/validate` et son équivalent bons de
 * commande lisaient `validatorId` et `validationLevel` DANS LE CORPS de la
 * requête. Aucune vérification que l'appelant portait `canValidateWorkOrders` /
 * `canValidatePurchaseOrders`, ni le niveau qu'il annonçait, ni un
 * `maxPurchaseAmount` suffisant.
 *
 * Donc : n'importe quel compte authentifié pouvait approuver n'importe quoi, et
 * poster `validationLevel: 2` sur un ordre jamais validé au niveau 1 obtenait
 * `canExecute = true` — le champ que `shared/schema.ts` documente comme « Only
 * true after full validation ». L'identité de l'approbateur n'était jamais
 * inscrite : `level1ValidatedBy` / `level2ValidatedBy` restaient vides, et
 * `chefServiceValidatedBy` recevait `validatorId?.toString() || "Chef Service"`.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE MESURE
 * ═══════════════════════════════════════════════════════════════════
 * Chaque cas lit L'ÉTAT EN BASE après coup, et pas seulement le code de retour :
 * un refus qui aurait quand même écrit serait indiscernable d'un vrai refus si
 * l'on s'arrêtait au 403.
 *
 * Les comptes viennent de tests/seed.ts : `technician` (niveau 0, aucun droit),
 * `validateurN1` (niveau 1, plafond d'achat 2 000), `validateurN2` (niveau 2,
 * sans plafond), `validateurN3` (niveau 3, bons de commande seulement) et
 * `validateurBeta` (niveau 2, AUTRE locataire).
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

const STAMP = `VAL${Date.now()}`;

let technicien: AuthenticatedAgent;
let niveau1: AuthenticatedAgent;
let niveau2: AuthenticatedAgent;
let niveau3: AuthenticatedAgent;
let beta: AuthenticatedAgent;
let admin: AuthenticatedAgent;

interface LigneOrdre {
  validation_status: string | null;
  level1_validated_by: number | null;
  level1_validated_at: Date | null;
  level2_validated_by: number | null;
  level2_validated_at: Date | null;
  can_execute: boolean | null;
  rejected_by: number | null;
}

/** Un ordre de travail neuf, en attente de validation, dans le locataire donné. */
async function creerOrdre(tenantId: string, suffixe: string): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO work_orders (tenant_id, order_number, order_type, title, description, validation_status)
     VALUES ($1, $2, 'corrective', $3, 'Ordre créé par la suite de validation', 'pending')
     RETURNING id`,
    [tenantId, `WO-${STAMP}-${suffixe}`, `Ordre ${suffixe} ${STAMP}`],
  );
  return rows[0].id;
}

async function lireOrdre(id: number): Promise<LigneOrdre> {
  const { rows } = await pool.query(
    `SELECT validation_status, level1_validated_by, level1_validated_at,
            level2_validated_by, level2_validated_at, can_execute, rejected_by
     FROM work_orders WHERE id = $1`,
    [id],
  );
  return rows[0];
}

/**
 * Un bon de commande neuf, du montant demandé, DANS le locataire donné.
 *
 * `tenant_id` est arrivé avec la migration 0023, et la colonne est NOT NULL :
 * avant elle, cette fixture insérait un bon sans propriétaire — ce qui était
 * précisément le défaut. Le locataire est le premier paramètre, comme pour
 * `creerOrdre`, pour qu'aucun appel ne puisse l'oublier en silence.
 *
 * `statut` permet de poser un bon directement à une étape avancée du circuit,
 * ce dont les cas de file d'attente par niveau ont besoin.
 */
async function creerBon(
  tenantId: string,
  montant: string,
  suffixe: string,
  statut: string = 'pending',
): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO purchase_orders (tenant_id, order_number, order_type, document_type, status,
                                  priority, total_amount, currency, validation_status, notes)
     VALUES ($1, $2, 'spare_parts', 'purchase_order', 'pending', 'medium', $3, 'EUR', $4, $5)
     RETURNING id`,
    [tenantId, `PO-${STAMP}-${suffixe}`, montant, statut, `Bon ${suffixe} ${STAMP}`],
  );
  return rows[0].id;
}

async function lireBon(id: number) {
  const { rows } = await pool.query(
    `SELECT tenant_id, validation_status, chef_service_validated_by, chef_service_validated_at,
            directeur_validated_by, directeur_validated_at, can_print, printed_at
     FROM purchase_orders WHERE id = $1`,
    [id],
  );
  return rows[0];
}

async function journal(recordType: string, recordId: number) {
  const { rows } = await pool.query(
    `SELECT tenant_id, validation_level, action, validated_by, previous_status, new_status
     FROM validation_logs WHERE record_type = $1 AND record_id = $2
     ORDER BY id`,
    [recordType, recordId],
  );
  return rows;
}

const valider = (agent: AuthenticatedAgent, corps: Record<string, unknown>) =>
  createAuthenticatedRequest('post', '/api/validation/work-orders/validate', agent).send(corps);

const validerBon = (agent: AuthenticatedAgent, corps: Record<string, unknown>) =>
  createAuthenticatedRequest('post', '/api/validation/purchase-orders/validate', agent).send(corps);

beforeAll(async () => {
  technicien = await authenticateUser(SEEDED.technician, SEEDED.password);
  niveau1 = await authenticateUser(SEEDED.validateurN1, SEEDED.password);
  niveau2 = await authenticateUser(SEEDED.validateurN2, SEEDED.password);
  niveau3 = await authenticateUser(SEEDED.validateurN3, SEEDED.password);
  beta = await authenticateUser(SEEDED.validateurBeta, SEEDED.password);
  admin = await authenticateUser(SEEDED.admin, SEEDED.password);
}, 60_000);

afterAll(async () => {
  // Les traces d'abord : `validation_logs.record_id` ne porte pas de clé
  // étrangère, mais laisser des lignes pointant vers des documents supprimés
  // ferait compter des validations fantômes au cas « historique ».
  await pool.query(
    `DELETE FROM validation_logs
     WHERE (record_type = 'work_order'
            AND record_id IN (SELECT id FROM work_orders WHERE order_number LIKE $1))
        OR (record_type = 'purchase_order'
            AND record_id IN (SELECT id FROM purchase_orders WHERE order_number LIKE $2))`,
    [`WO-${STAMP}-%`, `PO-${STAMP}-%`],
  );
  await pool.query('DELETE FROM work_orders WHERE order_number LIKE $1', [`WO-${STAMP}-%`]);
  await pool.query('DELETE FROM purchase_orders WHERE order_number LIKE $1', [`PO-${STAMP}-%`]);
  await pool.end();
}, 60_000);

// ═══════════════════════════════════════════════════════════════════
describe("Habilitation — qui a le droit d'approuver", () => {
  it('un technicien de niveau 0 est REFUSÉ, et rien n\'est écrit', async () => {
    const ordre = await creerOrdre(SEEDED.tenantAlpha, 'tech');

    const r = await valider(technicien, { workorderId: ordre, action: 'validate', validationLevel: 1 });

    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).toMatch(/VALIDATION_NON_HABILITEE/);

    const apres = await lireOrdre(ordre);
    expect(apres.validation_status).toBe('pending');
    expect(apres.level1_validated_by).toBeNull();
    expect(apres.can_execute).toBe(false);
    expect(await journal('work_order', ordre)).toHaveLength(0);
  }, 60_000);

  it("un administrateur non habilité est REFUSÉ lui aussi — le rôle ne remplace pas le drapeau", async () => {
    // `admin` porte le rôle le plus étendu après `owner`, mais
    // `can_validate_work_orders` est à `false` : c'est la colonne qui décide,
    // pas la hiérarchie des rôles.
    const ordre = await creerOrdre(SEEDED.tenantAlpha, 'admin');

    const r = await valider(admin, { workorderId: ordre, action: 'validate', validationLevel: 1 });

    expect(r.status).toBe(403);
    expect((await lireOrdre(ordre)).validation_status).toBe('pending');
  }, 60_000);

  it('un appel anonyme est REFUSÉ avant d\'atteindre la route', async () => {
    const ordre = await creerOrdre(SEEDED.tenantAlpha, 'anon');

    const r = await anonymousRequest('post', '/api/validation/work-orders/validate')
      .send({ workorderId: ordre, action: 'validate', validationLevel: 1 });

    // 403 et non 401 : mesuré, c'est le contrôle CSRF qui refuse le premier,
    // avant l'authentification — une requête anonyme ne porte aucun jeton. Les
    // deux codes conviennent ici, ce qui compte est qu'aucune écriture n'ait
    // lieu ; figer l'un des deux coderait en dur un ordre de middlewares que
    // cette suite n'a pas pour objet.
    expect([401, 403]).toContain(r.status);
    expect((await lireOrdre(ordre)).validation_status).toBe('pending');
    expect(await journal('work_order', ordre)).toHaveLength(0);
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
describe('Niveau — on ne valide pas au-dessus de son échelon', () => {
  it("un validateur de niveau 1 qui réclame le niveau 2 est REFUSÉ et n'obtient PAS canExecute", async () => {
    const ordre = await creerOrdre(SEEDED.tenantAlpha, 'saut1');

    const r = await valider(niveau1, { workorderId: ordre, action: 'validate', validationLevel: 2 });

    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).toMatch(/NIVEAU_INSUFFISANT/);

    const apres = await lireOrdre(ordre);
    expect(apres.validation_status).toBe('pending');
    expect(apres.can_execute).toBe(false);
    expect(apres.level2_validated_by).toBeNull();
    expect(await journal('work_order', ordre)).toHaveLength(0);
  }, 60_000);

  it("un validateur qui DÉTIENT le niveau 2 ne peut pas sauter le niveau 1 pour autant", async () => {
    // Le cas que le contrôle de niveau seul ne couvre pas : l'habilitation est
    // réelle, c'est l'ÉTAPE qui ne l'est pas. Sans cette barrière, le niveau 1
    // reste contournable par quiconque détient le niveau 2.
    const ordre = await creerOrdre(SEEDED.tenantAlpha, 'saut2');

    const r = await valider(niveau2, { workorderId: ordre, action: 'validate', validationLevel: 2 });

    expect(r.status).toBe(409);
    expect(JSON.stringify(r.body)).toMatch(/ETAPE_INATTENDUE/);

    const apres = await lireOrdre(ordre);
    expect(apres.validation_status).toBe('pending');
    expect(apres.can_execute).toBe(false);
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
describe("Traçabilité — l'approbateur est celui de la session", () => {
  it('une validation réussie inscrit levelNValidatedBy avec le compte EN SESSION', async () => {
    const ordre = await creerOrdre(SEEDED.tenantAlpha, 'trace');

    const r1 = await valider(niveau1, { workorderId: ordre, action: 'validate', validationLevel: 1 });
    expect(r1.status).toBe(200);

    const apresN1 = await lireOrdre(ordre);
    expect(apresN1.validation_status).toBe('level1_validated');
    expect(apresN1.level1_validated_by).toBe(niveau1.userId);
    expect(apresN1.level1_validated_at).toBeInstanceOf(Date);
    // Pas encore exécutable : le niveau 2 n'est pas passé.
    expect(apresN1.can_execute).toBe(false);

    const r2 = await valider(niveau2, { workorderId: ordre, action: 'validate', validationLevel: 2 });
    expect(r2.status).toBe(200);

    const apresN2 = await lireOrdre(ordre);
    expect(apresN2.validation_status).toBe('validated');
    expect(apresN2.level2_validated_by).toBe(niveau2.userId);
    expect(apresN2.level2_validated_at).toBeInstanceOf(Date);
    // Les deux approbateurs sont distincts ET conservés.
    expect(apresN2.level1_validated_by).toBe(niveau1.userId);
    expect(apresN2.can_execute).toBe(true);

    // Et la trace : deux entrées, chacune au bon niveau et au bon compte.
    const trace = await journal('work_order', ordre);
    expect(trace).toHaveLength(2);
    expect(trace[0]).toMatchObject({
      tenant_id: SEEDED.tenantAlpha,
      validation_level: 1,
      action: 'validate',
      validated_by: niveau1.userId,
      previous_status: 'pending',
      new_status: 'level1_validated',
    });
    expect(trace[1]).toMatchObject({
      validation_level: 2,
      validated_by: niveau2.userId,
      previous_status: 'level1_validated',
      new_status: 'validated',
    });
  }, 60_000);

  it("le validatorId du CORPS est ignoré : c'est la session qui est inscrite", async () => {
    const ordre = await creerOrdre(SEEDED.tenantAlpha, 'menteur');

    const r = await valider(niveau1, {
      workorderId: ordre,
      action: 'validate',
      validationLevel: 1,
      validatorId: admin.userId,   // ← ce que le client prétend être
    });

    expect(r.status).toBe(200);
    const apres = await lireOrdre(ordre);
    expect(apres.level1_validated_by).toBe(niveau1.userId);
    expect(apres.level1_validated_by).not.toBe(admin.userId);
    expect((await journal('work_order', ordre))[0].validated_by).toBe(niveau1.userId);
  }, 60_000);

  it('un rejet inscrit son auteur, et non une valeur venue du client', async () => {
    const ordre = await creerOrdre(SEEDED.tenantAlpha, 'rejet');

    const r = await valider(niveau1, {
      workorderId: ordre,
      action: 'reject',
      validationLevel: 1,
      validatorId: 999_999,       // identifiant inexistant
      comments: 'Besoin non justifié',
    });

    expect(r.status).toBe(200);
    const apres = await lireOrdre(ordre);
    expect(apres.validation_status).toBe('rejected');
    expect(apres.rejected_by).toBe(niveau1.userId);
  }, 60_000);

  it("un rejet par un compte non habilité est REFUSÉ — rejeter engage autant que valider", async () => {
    const ordre = await creerOrdre(SEEDED.tenantAlpha, 'rejet-refuse');

    const r = await valider(technicien, {
      workorderId: ordre, action: 'reject', validationLevel: 1, comments: 'non',
    });

    expect(r.status).toBe(403);
    const apres = await lireOrdre(ordre);
    expect(apres.validation_status).toBe('pending');
    expect(apres.rejected_by).toBeNull();
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
describe('Organisations — une habilitation ne traverse pas la frontière', () => {
  it("un validateur de niveau 2 d'une AUTRE organisation reçoit 404, pas une écriture", async () => {
    const ordre = await creerOrdre(SEEDED.tenantAlpha, 'frontiere');

    const r = await valider(beta, { workorderId: ordre, action: 'validate', validationLevel: 1 });

    expect(r.status).toBe(404);
    const apres = await lireOrdre(ordre);
    expect(apres.validation_status).toBe('pending');
    expect(apres.level1_validated_by).toBeNull();
  }, 60_000);

  it("un validateur habilité de Beta ne peut pas approuver un BON DE COMMANDE d'Alpha", async () => {
    // Le cas que le lot précédent n'a PAS pu couvrir : `purchase_orders` ne
    // portait aucun `tenant_id`, et `getPurchaseOrderById(id)` retrouvait donc
    // le bon de n'importe quelle organisation. Les quatre barrières
    // d'habilitation s'appliquaient alors correctement — au profit du mauvais
    // document : `validateurBeta` détient réellement le niveau 2, porte
    // `can_validate_purchase_orders` et n'a aucun plafond. Rien, côté
    // habilitation, ne l'arrêtait. Seule la colonne du locataire pouvait.
    const bon = await creerBon(SEEDED.tenantAlpha, '900.00', 'bc-frontiere');

    const r = await validerBon(beta, {
      purchaseorderId: bon,
      action: 'validate',
      validationLevel: 1,
      // Le locataire PRÉTENDU par le client, pour vérifier qu'il n'est pas lu :
      // c'est `req.tenantId` de la session qui sert, et lui seul.
      tenantId: SEEDED.tenantAlpha,
    });

    expect(r.status).toBe(404);

    // ET RIEN N'A ÉTÉ ÉCRIT — c'est le point. Un 404 rendu par-dessus un UPDATE
    // qui s'exécute quand même serait indiscernable d'un vrai refus si l'on
    // s'arrêtait au code de retour.
    const apres = await lireBon(bon);
    expect(apres.tenant_id).toBe(SEEDED.tenantAlpha);
    expect(apres.validation_status).toBe('pending');
    expect(apres.chef_service_validated_by).toBeNull();
    expect(apres.chef_service_validated_at).toBeNull();
    expect(apres.can_print).toBe(false);
    expect(await journal('purchase_order', bon)).toHaveLength(0);
  }, 60_000);

  it("un rejet d'un bon d'Alpha par Beta est refusé de la même façon", async () => {
    // Rejeter engage autant que valider : un bon rejeté sort du circuit.
    const bon = await creerBon(SEEDED.tenantAlpha, '900.00', 'bc-rejet-frontiere');

    const r = await validerBon(beta, {
      purchaseorderId: bon, action: 'reject', validationLevel: 1, comments: 'non',
    });

    expect(r.status).toBe(404);
    const apres = await lireBon(bon);
    expect(apres.validation_status).toBe('pending');
    expect(await journal('purchase_order', bon)).toHaveLength(0);
  }, 60_000);

  it("la file d'attente des BONS DE COMMANDE est cloisonnée, dans les deux sens", async () => {
    // Un bon par locataire au niveau 1…
    const bonAlpha = await creerBon(SEEDED.tenantAlpha, '800.00', 'file-bc-a');
    const bonBeta = await creerBon(SEEDED.tenantBeta, '800.00', 'file-bc-b');
    // …et un par locataire au niveau 2, pour éprouver l'autre sens avec
    // `validateurBeta`, qui détient le niveau 2 et lit donc la file
    // « level1_validated ».
    const bonAlphaN2 = await creerBon(SEEDED.tenantAlpha, '800.00', 'file-bc-a2', 'level1_validated');
    const bonBetaN2 = await creerBon(SEEDED.tenantBeta, '800.00', 'file-bc-b2', 'level1_validated');

    const vueAlpha = await createAuthenticatedRequest(
      'get', '/api/validation/purchase-orders/pending', niveau1,
    );
    expect(vueAlpha.status).toBe(200);
    const idsAlpha = (vueAlpha.body as Array<{ id: number }>).map((b) => b.id);
    expect(idsAlpha).toContain(bonAlpha);
    expect(idsAlpha).not.toContain(bonBeta);

    const vueBeta = await createAuthenticatedRequest(
      'get', '/api/validation/purchase-orders/pending', beta,
    );
    expect(vueBeta.status).toBe(200);
    const idsBeta = (vueBeta.body as Array<{ id: number }>).map((b) => b.id);
    expect(idsBeta).toContain(bonBetaN2);
    expect(idsBeta).not.toContain(bonAlphaN2);
  }, 60_000);

  it("la file d'attente d'un locataire ne contient pas les ordres de l'autre", async () => {
    const ordreAlpha = await creerOrdre(SEEDED.tenantAlpha, 'file-a');
    const ordreBeta = await creerOrdre(SEEDED.tenantBeta, 'file-b');

    const vue = await createAuthenticatedRequest('get', '/api/validation/work-orders/pending', niveau1);
    expect(vue.status).toBe(200);
    const ids = (vue.body as Array<{ id: number }>).map((o) => o.id);
    expect(ids).toContain(ordreAlpha);
    expect(ids).not.toContain(ordreBeta);
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
describe("Files d'attente — le niveau vient de la session", () => {
  it("un compte sans habilitation reçoit une liste VIDE, pas la file du niveau 1", async () => {
    await creerOrdre(SEEDED.tenantAlpha, 'file-vide');

    const ot = await createAuthenticatedRequest('get', '/api/validation/work-orders/pending', technicien);
    expect(ot.status).toBe(200);
    expect(ot.body).toEqual([]);

    const bc = await createAuthenticatedRequest('get', '/api/validation/purchase-orders/pending', technicien);
    expect(bc.status).toBe(200);
    expect(bc.body).toEqual([]);
  }, 60_000);

  it("le validationLevel passé en paramètre de requête n'a plus d'effet", async () => {
    const ordre = await creerOrdre(SEEDED.tenantAlpha, 'param');

    // Le niveau 1 réclame la file du niveau 2 : il obtient quand même la sienne,
    // donc un ordre « pending » — pas un ordre déjà validé au niveau 1.
    const vue = await createAuthenticatedRequest(
      'get', '/api/validation/work-orders/pending?validationLevel=2&validatorId=1', niveau1,
    );
    expect(vue.status).toBe(200);
    const lignes = vue.body as Array<{ id: number; validationStatus: string; niveauAttendu: number }>;
    expect(lignes.map((o) => o.id)).toContain(ordre);
    for (const ligne of lignes) {
      expect(ligne.validationStatus).toBe('pending');
      expect(ligne.niveauAttendu).toBe(1);
    }
  }, 60_000);

  it("aucun bon de commande FICTIF n'est injecté quand la file est vide", async () => {
    // La route ajoutait « PO-2025-001 » (654 €) et « PO-2025-002 » (4 250 €)
    // dès que la file était vide — avec les identifiants 1 et 2, donc ceux de
    // vrais bons de commande de la base.
    const vue = await createAuthenticatedRequest('get', '/api/validation/purchase-orders/pending', niveau1);
    expect(vue.status).toBe(200);
    const numeros = (vue.body as Array<{ orderNumber: string }>).map((b) => b.orderNumber);
    expect(numeros).not.toContain('PO-2025-001');
    expect(numeros).not.toContain('PO-2025-002');
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
describe('Bons de commande — le plafond est opposable', () => {
  it("un montant supérieur au plafond du validateur est REFUSÉ, sans écriture", async () => {
    const bon = await creerBon(SEEDED.tenantAlpha, '4250.00', 'plafond');

    const r = await validerBon(niveau1, { purchaseorderId: bon, action: 'validate', validationLevel: 1 });

    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).toMatch(/PLAFOND_DEPASSE/);

    const apres = await lireBon(bon);
    expect(apres.validation_status).toBe('pending');
    expect(apres.chef_service_validated_by).toBeNull();
    expect(await journal('purchase_order', bon)).toHaveLength(0);
  }, 60_000);

  it('un montant sous le plafond passe, et inscrit un IDENTIFIANT de compte', async () => {
    const bon = await creerBon(SEEDED.tenantAlpha, '1500.00', 'sous-plafond');

    const r = await validerBon(niveau1, { purchaseorderId: bon, action: 'validate', validationLevel: 1 });
    expect(r.status).toBe(200);

    const apres = await lireBon(bon);
    expect(apres.validation_status).toBe('level1_validated');
    // La colonne est un `integer` référençant `user_profiles.id` : elle recevait
    // auparavant la chaîne « Chef Service » comme valeur de repli.
    expect(apres.chef_service_validated_by).toBe(niveau1.userId);
    expect(apres.chef_service_validated_at).toBeInstanceOf(Date);
    expect(apres.can_print).toBe(false);
  }, 60_000);

  it("un validateur SANS plafond peut engager le montant que le niveau 1 refusait", async () => {
    const bon = await creerBon(SEEDED.tenantAlpha, '4250.00', 'sans-plafond');

    const r = await validerBon(niveau2, { purchaseorderId: bon, action: 'validate', validationLevel: 1 });
    expect(r.status).toBe(200);
    expect((await lireBon(bon)).chef_service_validated_by).toBe(niveau2.userId);
  }, 60_000);

  it("les trois échelons mènent à canPrint, et seulement à ce moment-là", async () => {
    const bon = await creerBon(SEEDED.tenantAlpha, '900.00', 'chaine');

    expect((await validerBon(niveau1, { purchaseorderId: bon, action: 'validate', validationLevel: 1 })).status).toBe(200);
    expect((await lireBon(bon)).can_print).toBe(false);

    expect((await validerBon(niveau2, { purchaseorderId: bon, action: 'validate', validationLevel: 2 })).status).toBe(200);
    const apresN2 = await lireBon(bon);
    expect(apresN2.validation_status).toBe('level2_validated');
    expect(apresN2.directeur_validated_by).toBe(niveau2.userId);
    expect(apresN2.can_print).toBe(false);

    expect((await validerBon(niveau3, { purchaseorderId: bon, action: 'validate', validationLevel: 3 })).status).toBe(200);
    const final = await lireBon(bon);
    expect(final.validation_status).toBe('validated');
    expect(final.can_print).toBe(true);
    // `printedAt` n'est PLUS renseigné par la validation : rien n'a été imprimé.
    expect(final.printed_at).toBeNull();

    // Trois échelons, trois traces, trois comptes.
    const trace = await journal('purchase_order', bon);
    expect(trace.map((t) => t.validation_level)).toEqual([1, 2, 3]);
    expect(trace.map((t) => t.validated_by)).toEqual([niveau1.userId, niveau2.userId, niveau3.userId]);
  }, 60_000);

  it("un compte habilité aux ordres de travail mais PAS aux achats est refusé sur un bon", async () => {
    // `validateurN3` porte `can_validate_purchase_orders` mais pas
    // `can_validate_work_orders` : le contrôle lit bien le drapeau du bon type.
    const ordre = await creerOrdre(SEEDED.tenantAlpha, 'drapeau');

    const r = await valider(niveau3, { workorderId: ordre, action: 'validate', validationLevel: 1 });

    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).toMatch(/VALIDATION_NON_HABILITEE/);
    expect((await lireOrdre(ordre)).validation_status).toBe('pending');
  }, 60_000);

  it('un circuit déjà clos ne se rejoue pas', async () => {
    const bon = await creerBon(SEEDED.tenantAlpha, '100.00', 'clos');

    expect((await validerBon(niveau1, { purchaseorderId: bon, action: 'validate', validationLevel: 1 })).status).toBe(200);
    // Deuxième validation de niveau 1 sur le même bon : l'étape est passée.
    const r = await validerBon(niveau1, { purchaseorderId: bon, action: 'validate', validationLevel: 1 });
    expect(r.status).toBe(409);
    expect((await journal('purchase_order', bon))).toHaveLength(1);
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
describe('Historique — plus aucune entrée inventée', () => {
  it("l'historique est lu dans validation_logs et cloisonné par organisation", async () => {
    const ordre = await creerOrdre(SEEDED.tenantAlpha, 'histo');
    expect((await valider(niveau1, { workorderId: ordre, action: 'validate', validationLevel: 1 })).status).toBe(200);

    const vue = await createAuthenticatedRequest('get', '/api/validation/statistics', niveau1);
    expect(vue.status).toBe(200);
    const logs = vue.body.logs as Array<{
      recordId: number; validatedBy: number; comments: string | null; tenantId: string;
    }>;

    // La validation qu'on vient de faire y est, avec son vrai auteur.
    expect(logs.some((l) => l.recordId === ordre && l.validatedBy === niveau1.userId)).toBe(true);

    // Les deux entrées écrites en dur ont disparu, et tout ce qui est rendu
    // appartient au locataire de l'appelant.
    const commentaires = logs.map((l) => l.comments ?? '');
    expect(commentaires).not.toContain('Validation niveau 1 - ordre de travail approuvé');
    expect(commentaires).not.toContain('Validation niveau 2 - bon de commande approuvé');
    for (const log of logs) {
      expect(log.tenantId).toBe(SEEDED.tenantAlpha);
    }
  }, 60_000);

  it("l'historique de Beta ne contient pas les validations d'Alpha", async () => {
    const ordre = await creerOrdre(SEEDED.tenantAlpha, 'histo-beta');
    expect((await valider(niveau1, { workorderId: ordre, action: 'validate', validationLevel: 1 })).status).toBe(200);

    const vue = await createAuthenticatedRequest('get', '/api/validation/statistics', beta);
    expect(vue.status).toBe(200);
    const ids = (vue.body.logs as Array<{ recordId: number; recordType: string }>)
      .filter((l) => l.recordType === 'work_order')
      .map((l) => l.recordId);
    expect(ids).not.toContain(ordre);
  }, 60_000);
});
