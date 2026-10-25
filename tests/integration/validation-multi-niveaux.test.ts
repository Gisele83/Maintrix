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

/** Un bon de commande neuf, en attente, du montant demandé. */
async function creerBon(montant: string, suffixe: string): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO purchase_orders (order_number, order_type, document_type, status, priority,
                                  total_amount, currency, validation_status, notes)
     VALUES ($1, 'spare_parts', 'purchase_order', 'pending', 'medium', $2, 'EUR', 'pending', $3)
     RETURNING id`,
    [`PO-${STAMP}-${suffixe}`, montant, `Bon ${suffixe} ${STAMP}`],
  );
  return rows[0].id;
}

async function lireBon(id: number) {
  const { rows } = await pool.query(
    `SELECT validation_status, chef_service_validated_by, chef_service_validated_at,
            directeur_validated_by, directeur_validated_at, can_print,
            printed_by, printed_at
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
    const bon = await creerBon('4250.00', 'plafond');

    const r = await validerBon(niveau1, { purchaseorderId: bon, action: 'validate', validationLevel: 1 });

    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).toMatch(/PLAFOND_DEPASSE/);

    const apres = await lireBon(bon);
    expect(apres.validation_status).toBe('pending');
    expect(apres.chef_service_validated_by).toBeNull();
    expect(await journal('purchase_order', bon)).toHaveLength(0);
  }, 60_000);

  it('un montant sous le plafond passe, et inscrit un IDENTIFIANT de compte', async () => {
    const bon = await creerBon('1500.00', 'sous-plafond');

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
    const bon = await creerBon('4250.00', 'sans-plafond');

    const r = await validerBon(niveau2, { purchaseorderId: bon, action: 'validate', validationLevel: 1 });
    expect(r.status).toBe(200);
    expect((await lireBon(bon)).chef_service_validated_by).toBe(niveau2.userId);
  }, 60_000);

  it("les trois échelons mènent à canPrint, et seulement à ce moment-là", async () => {
    const bon = await creerBon('900.00', 'chaine');

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
    const bon = await creerBon('100.00', 'clos');

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

// ═══════════════════════════════════════════════════════════════════
describe("Impression — l'auteur vient de la session, pas du corps", () => {
  /**
   * `POST /api/purchase-orders/:id/mark-printed` lisait `printedBy` ET
   * `printedAt` dans le CORPS. Mesuré depuis un technicien sans aucun droit
   * d'achat, sur un bon de 87 000 € jamais validé : HTTP 200,
   * `printed_by` = le compte que le corps désignait, `printed_at` = 2020, et le
   * bon passé à « printed » — statut qui ne correspond à aucune étape du
   * circuit, de sorte que le validateur de niveau 1 recevait ensuite 409
   * CIRCUIT_CLOS. L'approbation de n'importe quelle dépense pouvait donc être
   * neutralisée en une requête.
   */
  const marquerImprime = (agent: AuthenticatedAgent, id: number, corps: Record<string, unknown> = {}) =>
    createAuthenticatedRequest('post', `/api/purchase-orders/${id}/mark-printed`, agent).send(corps);

  /** Un bon mené à `can_print` par les trois échelons réels. */
  async function bonImprimable(suffixe: string): Promise<number> {
    const bon = await creerBon('900.00', suffixe);
    for (const [agent, niveau] of [[niveau1, 1], [niveau2, 2], [niveau3, 3]] as const) {
      const r = await validerBon(agent, { purchaseorderId: bon, action: 'validate', validationLevel: niveau });
      expect(r.status).toBe(200);
    }
    expect((await lireBon(bon)).can_print).toBe(true);
    return bon;
  }

  it('inscrit le compte de la SESSION, et ignore un printedBy menteur dans le corps', async () => {
    const bon = await bonImprimable('impr');
    const avant = Date.now();

    // Le corps désigne un autre compte et une date de 2020 : les deux doivent
    // être ignorés.
    const r = await marquerImprime(niveau3, bon, {
      printedBy: niveau1.userId,
      printedAt: '2020-01-01T00:00:00.000Z',
    });
    expect(r.status).toBe(200);

    const apres = await lireBon(bon);
    expect(apres.validation_status).toBe('printed');
    expect(apres.printed_by).toBe(niveau3.userId);
    expect(apres.printed_by).not.toBe(niveau1.userId);

    // ⚠️ L'INSTANT se vérifie sur la réponse de la route, pas sur la colonne
    // relue ici. `printed_at` est un `timestamp` SANS fuseau : l'application
    // l'écrit et le relit en UTC (vérifié : une date rendue par l'API revient
    // identique), tandis que le pilote `pg` de cette suite interprète la valeur
    // nue comme une heure LOCALE. Sur une machine à UTC+1, la comparer à
    // `Date.now()` donne donc un retard d'une heure qui ne dit rien du code —
    // d'où un échec qui serait vert sur un serveur réglé en UTC.
    expect(new Date(r.body.printedAt).getTime()).toBeGreaterThanOrEqual(avant - 60_000);
    // La colonne, elle, répond à la seule question qui la concerne : la date du
    // corps (2020) n'a pas été retenue.
    expect(apres.printed_at).toBeInstanceOf(Date);
    expect(apres.printed_at.getUTCFullYear()).toBeGreaterThan(2020);
  }, 60_000);

  it("un compte sans droit sur les achats est REFUSÉ, et rien n'est inscrit", async () => {
    const bon = await bonImprimable('impr-refus');

    const r = await marquerImprime(technicien, bon);

    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).toMatch(/IMPRESSION_NON_HABILITEE/);
    const apres = await lireBon(bon);
    expect(apres.printed_by).toBeNull();
    expect(apres.printed_at).toBeNull();
    expect(apres.validation_status).toBe('validated');
  }, 60_000);

  it("un bon non validé ne peut pas être « imprimé », et son circuit reste ouvert", async () => {
    const bon = await creerBon('87000.00', 'impr-neutralisation');

    const r = await marquerImprime(niveau3, bon);

    expect(r.status).toBe(409);
    expect(JSON.stringify(r.body)).toMatch(/CIRCUIT_INCOMPLET/);
    expect((await lireBon(bon)).validation_status).toBe('pending');

    // Le circuit est intact : l'approbation suit son cours.
    const v = await validerBon(niveau2, { purchaseorderId: bon, action: 'validate', validationLevel: 1 });
    expect(v.status).toBe(200);
    expect((await lireBon(bon)).validation_status).toBe('level1_validated');
  }, 60_000);

  it('une seconde impression est refusée, et la première trace est conservée', async () => {
    const bon = await bonImprimable('impr-deux-fois');
    expect((await marquerImprime(niveau3, bon)).status).toBe(200);
    const premiere = await lireBon(bon);

    const r = await marquerImprime(niveau3, bon);

    expect(r.status).toBe(409);
    expect(JSON.stringify(r.body)).toMatch(/DEJA_IMPRIME/);
    const apres = await lireBon(bon);
    expect(apres.printed_by).toBe(premiere.printed_by);
    expect(apres.printed_at.getTime()).toBe(premiere.printed_at.getTime());
  }, 60_000);

  it("un bon inexistant répond 404, au lieu de confirmer une impression", async () => {
    // L'ancienne route répondait 200 « marqué comme imprimé » : l'UPDATE ne
    // touchait aucune ligne et personne ne regardait le résultat.
    const r = await marquerImprime(niveau3, 999_999);

    expect(r.status).toBe(404);
    expect(JSON.stringify(r.body)).toMatch(/BON_INTROUVABLE/);
  }, 60_000);

  it("la route de démonstration n'existe plus", async () => {
    // `POST /api/create-validation-demo` écrivait, depuis n'importe quel compte
    // authentifié, deux bons de commande RÉELS (654,00 € et 4 250,00 €) dans la
    // file de validation, et des profils à identifiants forcés portant des rôles
    // hors référentiel. Le jeu de démonstration légitime est
    // `npm run demo:charger` (scripts/jeu-de-demonstration.ts).
    const r = await createAuthenticatedRequest('post', '/api/create-validation-demo', technicien).send({});
    expect(r.status).toBe(404);

    // Et rien ne porte sa signature en base. (Les montants seuls ne la font
    // pas : cette suite crée elle-même des bons à 4 250,00 € pour éprouver le
    // plafond. Ce sont les libellés du jeu de démonstration qui sont uniques.)
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM purchase_orders
       WHERE order_number IN ('PO-2025-001', 'PO-2025-002')
          OR notes LIKE 'Commande de roulements et joints%'
          OR notes LIKE 'Acquisition d''un nouveau moteur électrique%'`,
    );
    expect(rows[0].n).toBe(0);
  }, 60_000);
});
