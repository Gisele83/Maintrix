/**
 * Deux locataires, deux identités commerciales : chacun relit-il la SIENNE ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ
 * ═══════════════════════════════════════════════════════════════════
 * `company_config` ne portait pas de `tenant_id`. Elle porte pourtant la
 * raison sociale, l'adresse, le numéro fiscal, le logo, le papier à en-tête —
 * et les seuils à partir desquels une dépense exige une validation.
 *
 *   • `getCompanyConfig()` n'avait aucun paramètre de locataire et aucun
 *     filtre : son unique critère était `is_active = true`. Les cinq endroits
 *     qui l'appelaient lisaient donc tous la même ligne.
 *   • `createCompanyConfig()` faisait
 *     `db.update(companyConfig).set({ isActive: false })` — SANS WHERE. Le
 *     locataire qui enregistrait sa configuration ÉTEIGNAIT celle de tous les
 *     autres, puis sa ligne devenait la seule active : son identité était
 *     ensuite servie à l'instance entière.
 *   • Conséquence la plus lourde : un bon de commande — document d'engagement
 *     de dépense — sortait à l'en-tête, à l'adresse et au numéro fiscal d'une
 *     AUTRE entreprise. Pas seulement une fuite : un document faux.
 *   • Les deux seuils vivant dans la même ligne, un locataire déplaçait sans
 *     le savoir le montant au-delà duquel les autres déclenchent une
 *     validation renforcée.
 *   • Aucun contrôle de rôle sur l'écriture : un technicien pouvait réécrire
 *     l'identité de l'entreprise et relever le seuil d'engagement.
 *
 * ═══════════════════════════════════════════════════════════════════
 * COMMENT C'EST VÉRIFIÉ
 * ═══════════════════════════════════════════════════════════════════
 * Les deux locataires enregistrent chacun leur configuration DANS `beforeAll`,
 * Alpha d'abord. L'ordre importe : les deux passent par `createCompanyConfig`
 * (aucun n'a de configuration au départ), donc l'enregistrement de Beta est
 * exactement le geste qui éteignait celui d'Alpha.
 *
 * Les assertions portent sur les VALEURS relues, jamais sur un 200 : un refus
 * global et une lecture correcte rendent le même code. Trois mesures :
 *
 *   1. les champs relus par chacun (raison sociale, adresse, numéro fiscal) ;
 *   2. le COMPORTEMENT des seuils — le même montant est classé « lettre de
 *      commande » chez Alpha et « bon de commande » chez Beta, ce qui ne peut
 *      pas être vrai si les deux lisent la même ligne ;
 *   3. le TEXTE RÉELLEMENT IMPRIMÉ dans le PDF du bon de commande, flux
 *      décompressés. C'est le seul endroit où le défaut sortait sur papier.
 *
 * ⚠️ Un cas de cette suite AFFIRME UNE LIMITE OUVERTE (« la provenance du bon
 * de commande reste commune »), à la manière de tests/unit/filet-anti-fuite.test.ts :
 * `purchase_orders` ne porte aucun `tenant_id`, et ce lot ne corrige que
 * l'en-tête. Une limite qu'aucun test n'énonce se reprend pour une garantie.
 *
 * ⚠️ Cette suite ne se lance pas avec `jest` seul : `npm test` provisionne la
 * base, le serveur et les variables (voir scripts/run-tests.mjs).
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import { inflateSync } from 'node:zlib';
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

const STAMP = `CFG${Date.now()}`;

/**
 * Deux identités sans un seul caractère commun hors du marqueur : une
 * confusion ne peut pas passer pour une égalité. ASCII uniquement — le texte
 * est ensuite cherché dans les flux d'un PDF, où un caractère accentué est
 * échappé en octal et ne se retrouverait pas tel quel.
 */
const ALPHA_CFG = {
  companyName: `ALPHA INDUSTRIES ${STAMP}`,
  address: '7 rue des Fondeurs, 59000 Lille',
  phone: '+33 3 20 00 00 01',
  email: 'achats@alpha-industries.test',
  website: 'www.alpha-industries.test',
  taxNumber: `FR-ALPHA-${STAMP}`,
  purchaseOrderThreshold: '1500.00',
  commandLetterThreshold: '1500.01',
} as const;

const BETA_CFG = {
  companyName: `BETA MANUFACTURING ${STAMP}`,
  address: '42 avenue du Port, 13000 Marseille',
  phone: '+33 4 91 00 00 02',
  email: 'commandes@beta-manufacturing.test',
  website: 'www.beta-manufacturing.test',
  taxNumber: `FR-BETA-${STAMP}`,
  purchaseOrderThreshold: '5000.00',
  commandLetterThreshold: '5000.01',
} as const;

/** Montant choisi ENTRE les deux seuils : c'est ce qui rend l'écart visible. */
const MONTANT_PIVOT = 3000;

let alpha: AuthenticatedAgent;
let beta: AuthenticatedAgent;
let technicien: AuthenticatedAgent;

let reponseAlpha: any;
let reponseBeta: any;
let bonDeCommandeId = 0;

/** Nombre de configurations ACTIVES d'un locataire, lu en base. */
async function configsActives(tenantId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM company_config WHERE tenant_id = $1 AND is_active = true`,
    [tenantId],
  );
  return rows[0].c;
}

/**
 * Le texte réellement imprimé dans un PDF.
 *
 * Trois obstacles, relevés en inspectant un document produit par ce serveur —
 * et chacun rendait une recherche naïve muette, donc verte à tort :
 *
 *   1. PDFKit COMPRESSE ses flux de contenu (`compress: true` par défaut).
 *      Chercher une sous-chaîne dans les octets rendus ne prouve rien, ni la
 *      présence ni l'absence. On déplie donc chaque flux.
 *   2. Le texte n'est PAS écrit en littéraux `(…)` mais en CHAÎNES
 *      HEXADÉCIMALES : `[<414c5048 41> 0] TJ`. Un extracteur qui ne lit que les
 *      parenthèses rend une chaîne vide sur ce document (mesuré).
 *   3. Le crénage DÉCOUPE un même mot en plusieurs fragments séparés par des
 *      nombres de positionnement : `<372072> -15 <75652074657374>` est
 *      « 7 rue test ». On recolle donc les fragments sans séparateur, les
 *      nombres restant hors des délimiteurs.
 *
 * Les deux formes de chaîne sont acceptées : le générateur pourrait repasser
 * aux littéraux selon la police embarquée.
 */
function texteDuPdf(pdf: Buffer): string {
  const brut = pdf.toString('latin1');
  const flux: string[] = [];
  // `(?<!end)` : sans cette précaution, « endstream » fournit lui aussi un
  // « stream » et le découpage part en vrille sur les documents multi-flux.
  const debutFlux = /(?<!end)stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = debutFlux.exec(brut)) !== null) {
    const debut = m.index + m[0].length;
    const fin = brut.indexOf('endstream', debut);
    if (fin === -1) continue;
    const octets = Buffer.from(brut.slice(debut, fin), 'latin1');
    try {
      flux.push(inflateSync(octets).toString('latin1'));
    } catch {
      flux.push(octets.toString('latin1')); // flux non compressé (police, image)
    }
  }

  const fragments = flux.join('\n').match(/<[0-9A-Fa-f\s]+>|\((?:[^()\\]|\\.)*\)/g) ?? [];
  return fragments
    .map((f) =>
      f.startsWith('<')
        ? Buffer.from(f.slice(1, -1).replace(/\s+/g, ''), 'hex').toString('latin1')
        : f.slice(1, -1),
    )
    .join('');
}

/** Télécharge un PDF en Buffer — supertest ne le fait pas tout seul. */
function telechargerPdf(chemin: string, auth: AuthenticatedAgent) {
  return createAuthenticatedRequest('get', chemin, auth)
    .buffer(true)
    .parse((r: any, cb: any) => {
      const morceaux: Buffer[] = [];
      r.on('data', (c: Buffer) => morceaux.push(c));
      r.on('end', () => cb(null, Buffer.concat(morceaux)));
    });
}

beforeAll(async () => {
  alpha = await authenticateUser(SEEDED.admin, SEEDED.password);
  beta = await authenticateUser(SEEDED.adminBeta, SEEDED.password);
  technicien = await authenticateUser(SEEDED.technician, SEEDED.password);

  // État de départ connu : aucune configuration pour les deux locataires de
  // test. Sans cette purge, une exécution précédente laisserait une ligne
  // active et les enregistrements ci-dessous passeraient par la mise à jour au
  // lieu de la création — or c'est la CRÉATION qui portait le défaut.
  await pool.query('DELETE FROM company_config WHERE tenant_id = ANY($1::varchar[])', [
    [SEEDED.tenantAlpha, SEEDED.tenantBeta],
  ]);

  // Alpha d'abord, Beta ensuite : l'enregistrement de Beta est le geste qui
  // éteignait celui d'Alpha.
  reponseAlpha = await createAuthenticatedRequest('post', '/api/company-config', alpha).send(ALPHA_CFG);
  reponseBeta = await createAuthenticatedRequest('post', '/api/company-config', beta).send(BETA_CFG);

  // Un bon de commande pour éprouver l'en-tête du document émis.
  const { rows } = await pool.query(
    `INSERT INTO purchase_orders (order_number, order_type, requested_by, total_amount, currency, status)
     VALUES ($1, 'spare_parts', $2, '1234.00', 'EUR', 'draft') RETURNING id`,
    [`BC-${STAMP}`, `Demandeur ${STAMP}`],
  );
  bonDeCommandeId = rows[0].id;
});

afterAll(async () => {
  await pool.query('DELETE FROM purchase_order_items WHERE purchase_order_id = $1', [bonDeCommandeId]);
  await pool.query('DELETE FROM purchase_orders WHERE order_number = $1', [`BC-${STAMP}`]);
  await pool.query('DELETE FROM company_config WHERE tenant_id = ANY($1::varchar[])', [
    [SEEDED.tenantAlpha, SEEDED.tenantBeta],
  ]);
  await pool.end();
});

// ═══════════════════════════════════════════════════════════════════
describe("Chacun enregistre et relit SA configuration", () => {
  it('les deux enregistrements ont été acceptés', () => {
    // Témoin : sans lui, tout ce qui suit serait vert sur deux refus.
    expect(reponseAlpha.status).toBe(200);
    expect(reponseBeta.status).toBe(200);
    expect(reponseAlpha.body.success).toBe(true);
    expect(reponseBeta.body.success).toBe(true);
  });

  it('Alpha relit sa raison sociale, son adresse et son numéro fiscal', async () => {
    const res = await createAuthenticatedRequest('get', '/api/company-config', alpha);

    expect(res.status).toBe(200);
    // Les VALEURS, champ par champ. Un 200 ne dit pas de qui est l'en-tête.
    expect(res.body.companyName).toBe(ALPHA_CFG.companyName);
    expect(res.body.address).toBe(ALPHA_CFG.address);
    expect(res.body.taxNumber).toBe(ALPHA_CFG.taxNumber);
    expect(res.body.email).toBe(ALPHA_CFG.email);
  });

  it('Beta relit la sienne, et jamais celle d\'Alpha', async () => {
    const res = await createAuthenticatedRequest('get', '/api/company-config', beta);

    expect(res.status).toBe(200);
    expect(res.body.companyName).toBe(BETA_CFG.companyName);
    expect(res.body.taxNumber).toBe(BETA_CFG.taxNumber);
    // Et rien d'Alpha ne doit s'y trouver — y compris sous un autre champ.
    expect(JSON.stringify(res.body)).not.toContain(ALPHA_CFG.taxNumber);
    expect(JSON.stringify(res.body)).not.toContain(ALPHA_CFG.companyName);
  });

  it("l'enregistrement de Beta n'a pas désactivé celui d'Alpha", async () => {
    // LE DÉFAUT CENTRAL. `createCompanyConfig()` désactivait toutes les
    // configurations de l'instance avant d'insérer la sienne. Avant correctif,
    // Alpha retombait ici sur le gabarit « Votre Entreprise » : sa
    // configuration existait toujours en base, mais `is_active` valait false.
    expect(await configsActives(SEEDED.tenantAlpha)).toBe(1);
    expect(await configsActives(SEEDED.tenantBeta)).toBe(1);

    const res = await createAuthenticatedRequest('get', '/api/company-config', alpha);
    expect(res.body.companyName).toBe(ALPHA_CFG.companyName);
    expect(res.body.companyName).not.toBe('Votre Entreprise');
  });

  it("un locataire sans configuration reçoit un gabarit vide, pas celle d'un autre", async () => {
    // 'default-tenant' existe dans le seed et n'a rien enregistré. On lit sa
    // ligne en base plutôt que par l'API (aucun compte n'y est rattaché) : il
    // ne doit avoir aucune configuration active, donc aucune chance d'hériter
    // de celle d'Alpha ou de Beta.
    expect(await configsActives('default-tenant')).toBe(0);

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS c FROM company_config WHERE company_name = ANY($1::varchar[])`,
      [[ALPHA_CFG.companyName, BETA_CFG.companyName]],
    );
    // Exactement deux lignes portent ces deux raisons sociales : une par
    // locataire. Trois signifierait qu'un enregistrement en a dupliqué une.
    expect(rows[0].c).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe("Les seuils d'approbation sont propres à chaque locataire", () => {
  it(`${MONTANT_PIVOT} € exige une lettre de commande chez Alpha`, async () => {
    const res = await createAuthenticatedRequest('post', '/api/purchase-orders/document-type', alpha)
      .send({ amount: MONTANT_PIVOT });

    expect(res.status).toBe(200);
    expect(res.body.documentType).toBe('command_letter');
    expect(res.body.threshold).toBe(1500);
  });

  it(`le MÊME montant reste un bon de commande chez Beta`, async () => {
    // La mesure la plus parlante du lot : un seul et même montant classé
    // différemment par les deux locataires. C'est impossible si les deux
    // lisent la même ligne — avant correctif, le second à enregistrer imposait
    // ses seuils au premier.
    const res = await createAuthenticatedRequest('post', '/api/purchase-orders/document-type', beta)
      .send({ amount: MONTANT_PIVOT });

    expect(res.status).toBe(200);
    expect(res.body.documentType).toBe('purchase_order');
    expect(res.body.threshold).toBe(5000);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Le bon de commande porte l\'en-tête de son demandeur', () => {
  it('le PDF demandé par Alpha est imprimé à l\'en-tête d\'Alpha', async () => {
    const res = await telechargerPdf(`/api/purchase-orders/${bonDeCommandeId}/pdf`, alpha);

    expect(res.status).toBe(200);
    const pdf = res.body as Buffer;
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');

    const texte = texteDuPdf(pdf);
    // Témoin d'abord : si l'extraction ne rendait rien, l'absence du nom de
    // Beta plus bas ne prouverait rien du tout.
    expect(texte).toContain('BON DE COMMANDE');
    expect(texte).toContain(ALPHA_CFG.companyName);
    expect(texte).toContain(ALPHA_CFG.taxNumber);
    expect(texte).not.toContain(BETA_CFG.companyName);
    expect(texte).not.toContain(BETA_CFG.taxNumber);
  });

  it('le même bon demandé par Beta est imprimé à l\'en-tête de Beta', async () => {
    const res = await telechargerPdf(`/api/purchase-orders/${bonDeCommandeId}/pdf`, beta);

    expect(res.status).toBe(200);
    const texte = texteDuPdf(res.body as Buffer);

    expect(texte).toContain('BON DE COMMANDE');
    expect(texte).toContain(BETA_CFG.companyName);
    expect(texte).toContain(BETA_CFG.taxNumber);
    expect(texte).not.toContain(ALPHA_CFG.companyName);
    expect(texte).not.toContain(ALPHA_CFG.taxNumber);
  });

  it("la route /letterhead applique la même règle", async () => {
    const res = await telechargerPdf(`/api/purchase-orders/${bonDeCommandeId}/letterhead`, alpha);

    expect(res.status).toBe(200);
    const texte = texteDuPdf(res.body as Buffer);
    expect(texte).toContain(ALPHA_CFG.companyName);
    expect(texte).not.toContain(BETA_CFG.companyName);
  });

  it("sans session, aucun bon de commande n'est servi", async () => {
    const res = await anonymousRequest('get', `/api/purchase-orders/${bonDeCommandeId}/pdf`);
    expect([401, 403]).toContain(res.status);
  });

  it('LIMITE OUVERTE : la PROVENANCE du bon de commande reste commune', async () => {
    // ⚠️ Ce cas N'EST PAS une régression : il énonce ce que ce lot ne corrige
    // pas. `purchase_orders` ne porte aucun `tenant_id` — ni dans
    // shared/schema.ts, ni dans aucune migration — et rien ne filtre
    // `getPurchaseOrderById()`. Les deux locataires obtiennent donc 200 sur le
    // MÊME identifiant de commande, chacun sous son propre en-tête.
    //
    // La correction demande sa propre migration et la reprise de toute la
    // chaîne achats (liste, validation, impression). Si ce cas devient rouge,
    // c'est que ce travail a été fait : il faut alors le remplacer par
    // l'assertion inverse (404 ou 403 pour le locataire étranger), pas le
    // supprimer.
    const vuParAlpha = await createAuthenticatedRequest('get', `/api/purchase-orders/${bonDeCommandeId}/pdf`, alpha);
    const vuParBeta = await createAuthenticatedRequest('get', `/api/purchase-orders/${bonDeCommandeId}/pdf`, beta);

    expect(vuParAlpha.status).toBe(200);
    expect(vuParBeta.status).toBe(200);

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS c FROM information_schema.columns
        WHERE table_name = 'purchase_orders' AND column_name = 'tenant_id'`,
    );
    expect(rows[0].c).toBe(0); // le jour où la colonne existe, ce cas doit être réécrit
  });
});

// ═══════════════════════════════════════════════════════════════════
describe("Qui a le droit d'écrire", () => {
  it("un technicien ne peut pas modifier l'identité de l'entreprise", async () => {
    const res = await createAuthenticatedRequest('post', '/api/company-config', technicien)
      .send({ ...ALPHA_CFG, companyName: `USURPATION ${STAMP}` });

    expect(res.status).toBe(403);

    // Et la configuration n'a pas bougé — un 403 qui écrirait quand même
    // serait le pire des deux mondes.
    const relu = await createAuthenticatedRequest('get', '/api/company-config', alpha);
    expect(relu.body.companyName).toBe(ALPHA_CFG.companyName);
  });

  it("un technicien ne peut pas relever le seuil d'engagement", async () => {
    // Le point le plus sensible : relever le seuil désarme le contrôle de
    // validation des dépenses, et ne laisse de trace nulle part ailleurs.
    const res = await createAuthenticatedRequest('post', '/api/company-config', technicien)
      .send({ ...ALPHA_CFG, purchaseOrderThreshold: '999999.00', commandLetterThreshold: '999999.01' });

    expect(res.status).toBe(403);

    const typeDoc = await createAuthenticatedRequest('post', '/api/purchase-orders/document-type', alpha)
      .send({ amount: MONTANT_PIVOT });
    expect(typeDoc.body.threshold).toBe(1500);
  });

  it('un technicien peut toujours LIRE la configuration de son locataire', async () => {
    // Le contrôle vise l'écriture, pas la lecture : l'en-tête sert à
    // l'affichage des documents, et un refus global masquerait un
    // cloisonnement défaillant derrière un verrou.
    const res = await createAuthenticatedRequest('get', '/api/company-config', technicien);

    expect(res.status).toBe(200);
    expect(res.body.companyName).toBe(ALPHA_CFG.companyName);
  });

  it('sans session, ni lecture ni écriture', async () => {
    const lecture = await anonymousRequest('get', '/api/company-config');
    expect([401, 403]).toContain(lecture.status);

    const ecriture = await anonymousRequest('post', '/api/company-config').send(ALPHA_CFG);
    expect([401, 403]).toContain(ecriture.status);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('La charge ne peut pas déplacer la ligne', () => {
  it("poster un tenantId étranger ne déménage pas la configuration", async () => {
    // ⚠️ Risque INTRODUIT par l'ajout de la colonne, et fermé avant d'être
    // ouvert. La route passait `req.body` tel quel à `.set({ ...configData })` :
    // une fois `tenant_id` écrivable, `{ "tenantId": "<Beta>" }` posté par
    // Alpha aurait réécrit la colonne même que la clause WHERE venait de viser,
    // et la configuration d'Alpha serait partie chez Beta. C'est pourquoi
    // `companyConfigPayloadSchema` l'écarte.
    //
    // Ce n'est pas théorique : threshold-configuration.tsx renvoie l'objet lu
    // par le GET, donc `tenantId` revient dans la charge à chaque
    // enregistrement de seuils.
    const res = await createAuthenticatedRequest('post', '/api/company-config', alpha)
      .send({ ...ALPHA_CFG, tenantId: SEEDED.tenantBeta, isActive: false });

    expect(res.status).toBe(200);

    // La ligne d'Alpha est restée chez Alpha, et reste active.
    expect(await configsActives(SEEDED.tenantAlpha)).toBe(1);
    const { rows } = await pool.query(
      `SELECT tenant_id FROM company_config WHERE company_name = $1`,
      [ALPHA_CFG.companyName],
    );
    expect(rows.map((r) => r.tenant_id)).toEqual([SEEDED.tenantAlpha]);

    // Et Beta lit toujours la sienne, inchangée.
    const chezBeta = await createAuthenticatedRequest('get', '/api/company-config', beta);
    expect(chezBeta.body.companyName).toBe(BETA_CFG.companyName);
  });

  it('une charge invalide est refusée en 400, sans rien écrire', async () => {
    const res = await createAuthenticatedRequest('post', '/api/company-config', alpha)
      .send({ companyName: '', primaryColor: 'une couleur beaucoup trop longue pour la colonne' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');

    const relu = await createAuthenticatedRequest('get', '/api/company-config', alpha);
    expect(relu.body.companyName).toBe(ALPHA_CFG.companyName);
  });
});
