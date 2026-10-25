/**
 * Les coûts de maintenance d'un locataire restent-ils chez lui ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ
 * ═══════════════════════════════════════════════════════════════════
 * `maintenance_reports` et `monthly_reports` ne portaient pas de `tenant_id` :
 * la table des rapports d'intervention n'était rattachée qu'à `equipment_id`,
 * colonne NULLABLE, et celle des rapports mensuels à rien du tout. Aucun
 * filtrage par locataire n'était donc exprimable, et personne ne l'exprimait :
 *
 *   • `getMaintenanceReports()` ne prenait pas de locataire en paramètre ;
 *   • `GET /api/maintenance-reports` et `GET /api/monthly-reports` n'en
 *     exigeaient aucun ;
 *   • `generateMonthlyReport()` restreignait bien le parc, les ordres de
 *     travail et les alertes à son `tenantId`, mais lisait les rapports
 *     d'intervention SANS lui. Les quatre indicateurs de coût du mois
 *     additionnaient les dépenses de toute l'instance, et le coût par
 *     intervention divisait cette somme globale par les seules interventions
 *     du locataire — un chiffre qui ne mesurait rien.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE VÉRIFIE, ET COMMENT
 * ═══════════════════════════════════════════════════════════════════
 * Les fixtures sont insérées EN BASE plutôt que par l'API, pour trois raisons :
 *
 *   1. l'API ne permet pas de fabriquer un rapport d'un montant choisi — elle
 *      le recalcule depuis l'ordre de travail ; or la démonstration repose sur
 *      des montants distincts et reconnaissables ;
 *   2. écrire directement permet de poser un rapport SANS équipement
 *      (`equipment_id` NULL), le cas précis qui aurait échappé à un
 *      cloisonnement par jointure sur `equipment_registry` ;
 *   3. le défaut porte sur la LECTURE. Fabriquer les fixtures par le chemin
 *      corrigé risquerait de masquer une lecture restée trop large.
 *
 * Les montants sont choisis pour qu'aucune confusion ne passe inaperçue : la
 * somme d'Alpha (1 500) et celle de Beta (7 777) n'ont aucun chiffre commun, et
 * leur total (9 277) est reconnaissable au premier coup d'œil. Avant correctif,
 * Alpha lisait 9 277.
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

/** Marqueur unique : permet de nettoyer sans toucher aux fixtures d'autrui. */
const STAMP = `ISO${Date.now()}`;

/** Période visée : le mois civil en cours, celui que lira le rapport mensuel. */
const MAINTENANT = new Date();
const MOIS = MAINTENANT.getMonth() + 1;
const ANNEE = MAINTENANT.getFullYear();

/**
 * Montants posés par cette suite. Ils ne servent PLUS de valeur attendue — les
 * attentes sont relues en base, voir `sommesEnBase()` — mais de PLANCHER : ils
 * garantissent que les sommes comparées ne sont pas vides et que les deux
 * organisations diffèrent, sans quoi la suite se déclarerait verte en
 * comparant zéro à zéro.
 *
 * Alpha : deux interventions, dont une SANS équipement rattaché.
 *   total 1 000 + 500 = 1 500   main d'œuvre 600 + 300 = 900   pièces 400 + 200 = 600
 */
const ALPHA_TOTAL = 1500;
const ALPHA_OT_TERMINES = 2;

/** Beta : une seule intervention, volontairement sans chiffre commun avec Alpha. */
const BETA_TOTAL = 7777;

let alpha: AuthenticatedAgent;
let beta: AuthenticatedAgent;

/** Insère un rapport d'intervention daté du mois en cours. */
async function insererRapport(opts: {
  tenantId: string;
  suffixe: string;
  total: number;
  mo: number;
  pieces: number;
}): Promise<string> {
  const numero = `MR-${STAMP}-${opts.suffixe}`;
  await pool.query(
    `INSERT INTO maintenance_reports
       (tenant_id, report_number, report_type, technician, start_time, end_time,
        work_description, actions_taken, total_cost, labor_cost, parts_cost, status, created_at)
     VALUES ($1, $2, 'corrective', $3, now(), now(), $4, 'Intervention de test', $5, $6, $7, 'approved', now())`,
    [
      opts.tenantId,
      numero,
      `Technicien ${opts.suffixe}`,
      `Intervention ${opts.suffixe} — ${STAMP}`,
      opts.total,
      opts.mo,
      opts.pieces,
    ],
  );
  return numero;
}

/** Insère un ordre de travail terminé, daté du mois en cours. */
async function insererOrdreTermine(tenantId: string, suffixe: string): Promise<void> {
  await pool.query(
    `INSERT INTO work_orders
       (tenant_id, order_number, order_type, title, description, status, created_at)
     VALUES ($1, $2, 'corrective', $3, 'Ordre de travail de test', 'completed', now())`,
    [tenantId, `WO-${STAMP}-${suffixe}`, `OT ${suffixe} — ${STAMP}`],
  );
}

let numerosAlpha: string[] = [];
let numerosBeta: string[] = [];

/** Bornes du mois civil que lira le rapport mensuel. */
const DEBUT_PERIODE = new Date(ANNEE, MOIS - 1, 1);
const FIN_PERIODE = new Date(ANNEE, MOIS, 0, 23, 59, 59);

/**
 * Somme, relue EN BASE, des coûts d'un locataire sur la période du rapport.
 *
 * ⚠️ Les montants de cette suite étaient d'abord comparés à des constantes —
 * 1 500 €, 900 €, 600 €, 7 777 €. Cela supposait que `maintenance_reports` ne
 * contienne RIEN d'autre pour ces deux locataires sur le mois en cours : une
 * seule ligne résiduelle, laissée par une exécution interrompue ou par une
 * mesure manuelle, faisait échouer cinq cas d'un coup — et l'échec ressemblait
 * à une régression du cloisonnement alors qu'il ne disait que « la base n'est
 * pas vierge ». Un test doit échouer pour la raison qu'il annonce.
 *
 * La propriété vérifiée ne change pas, elle devient seulement exacte : le
 * rapport mensuel d'un locataire totalise SES rapports, tous ses rapports, et
 * rien que les siens. On la mesure donc contre la base plutôt que contre des
 * nombres écrits d'avance, et les fixtures de la suite garantissent seulement
 * que ces sommes ne sont pas vides et qu'Alpha et Beta diffèrent.
 */
async function sommesEnBase(tenantId?: string): Promise<{ total: number; mo: number; pieces: number }> {
  const conditions = tenantId ? 'tenant_id = $3' : '1 = 1';
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(total_cost), 0)::float8 AS total,
            COALESCE(SUM(labor_cost), 0)::float8 AS mo,
            COALESCE(SUM(parts_cost), 0)::float8 AS pieces
       FROM maintenance_reports
      WHERE created_at BETWEEN $1 AND $2 AND ${conditions}`,
    tenantId ? [DEBUT_PERIODE, FIN_PERIODE, tenantId] : [DEBUT_PERIODE, FIN_PERIODE],
  );
  return rows[0];
}

beforeAll(async () => {
  alpha = await authenticateUser(SEEDED.admin, SEEDED.password);
  beta = await authenticateUser(SEEDED.adminBeta, SEEDED.password);

  // Alpha : 1 000 € avec équipement implicite (NULL) + 500 €. Le cas
  // `equipment_id` NULL est volontaire : c'est celui qu'un cloisonnement par
  // jointure sur l'équipement aurait laissé hors de toute portée.
  numerosAlpha = [
    await insererRapport({ tenantId: SEEDED.tenantAlpha, suffixe: 'A1', total: 1000, mo: 600, pieces: 400 }),
    await insererRapport({ tenantId: SEEDED.tenantAlpha, suffixe: 'A2', total: 500, mo: 300, pieces: 200 }),
  ];
  numerosBeta = [
    await insererRapport({ tenantId: SEEDED.tenantBeta, suffixe: 'B1', total: BETA_TOTAL, mo: 7000, pieces: 777 }),
  ];

  // Deux ordres terminés chez Alpha, un chez Beta : le coût par intervention
  // d'Alpha doit valoir 1 500 / 2 = 750, et non 9 277 / 2 = 4 638,50.
  await insererOrdreTermine(SEEDED.tenantAlpha, 'A1');
  await insererOrdreTermine(SEEDED.tenantAlpha, 'A2');
  await insererOrdreTermine(SEEDED.tenantBeta, 'B1');
});

afterAll(async () => {
  // Nettoyage par marqueur : les rapports mensuels engendrés par la suite sont
  // repérés par leur période et leurs locataires, n'ayant pas de numéro connu
  // d'avance (il est fabriqué côté serveur).
  await pool.query(`DELETE FROM maintenance_reports WHERE report_number LIKE $1`, [`MR-${STAMP}-%`]);
  await pool.query(`DELETE FROM work_orders WHERE order_number LIKE $1`, [`WO-${STAMP}-%`]);
  await pool.query(
    `DELETE FROM monthly_reports WHERE month = $1 AND year = $2 AND tenant_id = ANY($3)`,
    [MOIS, ANNEE, [SEEDED.tenantAlpha, SEEDED.tenantBeta]],
  );
  await pool.end();
});

// ═══════════════════════════════════════════════════════════════════
describe("Rapports d'intervention : la liste ne franchit pas le locataire", () => {
  it("Alpha ne voit que ses propres rapports", async () => {
    const res = await createAuthenticatedRequest('get', '/api/maintenance-reports', alpha);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const numeros = (res.body as Array<{ reportNumber: string }>).map(r => r.reportNumber);
    for (const n of numerosAlpha) expect(numeros).toContain(n);
    for (const n of numerosBeta) expect(numeros).not.toContain(n);
  });

  it("Beta ne voit que les siens", async () => {
    const res = await createAuthenticatedRequest('get', '/api/maintenance-reports', beta);

    expect(res.status).toBe(200);
    const numeros = (res.body as Array<{ reportNumber: string }>).map(r => r.reportNumber);
    for (const n of numerosBeta) expect(numeros).toContain(n);
    for (const n of numerosAlpha) expect(numeros).not.toContain(n);
  });

  it("sans session, la liste n'est pas servie du tout", async () => {
    // La route n'exigeait aucun locataire : elle le reçoit désormais de la
    // session, et une requête anonyme ne peut plus rien en obtenir.
    const res = await anonymousRequest('get', '/api/maintenance-reports');

    expect([401, 403]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Indicateurs mensuels : les coûts sont ceux du locataire, et eux seuls', () => {
  let mensuelAlpha: Record<string, any>;

  it("le rapport mensuel d'Alpha ne retient que les dépenses d'Alpha", async () => {
    const res = await createAuthenticatedRequest('post', '/api/monthly-reports', alpha)
      .send({ month: MOIS, year: ANNEE, generatedBy: `test-${STAMP}` });

    expect(res.status).toBe(201);
    mensuelAlpha = res.body;

    const chezAlpha = await sommesEnBase(SEEDED.tenantAlpha);
    const toutesOrganisations = await sommesEnBase();

    // Garde-fou : sans lui, une base vidée rendrait 0 = 0 des deux côtés et la
    // suite se déclarerait verte sans rien avoir comparé.
    expect(chezAlpha.total).toBeGreaterThanOrEqual(ALPHA_TOTAL);
    expect(toutesOrganisations.total).toBeGreaterThan(chezAlpha.total);

    // Le cœur du constat : cette somme valait celle de TOUTES les organisations.
    expect(Number(mensuelAlpha.totalMaintenanceCost)).toBeCloseTo(chezAlpha.total, 2);
    expect(Number(mensuelAlpha.totalMaintenanceCost)).not.toBeCloseTo(toutesOrganisations.total, 2);

    expect(Number(mensuelAlpha.laborCost)).toBeCloseTo(chezAlpha.mo, 2);
    expect(Number(mensuelAlpha.partsCost)).toBeCloseTo(chezAlpha.pieces, 2);

    // Et le montant propre à Beta n'entre pour rien dans le total d'Alpha.
    expect(Number(mensuelAlpha.totalMaintenanceCost)).toBeLessThan(toutesOrganisations.total);
  });

  it("le coût par intervention d'Alpha rapporte SES dépenses à SES interventions", async () => {
    // Indicateur le plus trompeur des quatre : son numérateur était global et
    // son dénominateur local, si bien qu'il ne mesurait aucune grandeur réelle.
    //
    // Le dénominateur n'est pas figé : les suites qui tournent avant celle-ci
    // (gmao, inter-module-communication) laissent elles aussi des ordres de
    // travail chez Alpha dans le mois en cours. On vérifie donc la PROPRIÉTÉ —
    // le numérateur est bien le total d'Alpha — plutôt qu'une valeur absolue
    // qui dépendrait de l'ordre des suites.
    const otTermines = Number(mensuelAlpha.completedWorkOrders);
    expect(otTermines).toBeGreaterThanOrEqual(ALPHA_OT_TERMINES);

    const chezAlpha = await sommesEnBase(SEEDED.tenantAlpha);
    const toutesOrganisations = await sommesEnBase();

    expect(Number(mensuelAlpha.costPerWorkOrder)).toBeCloseTo(chezAlpha.total / otTermines, 2);
    expect(Number(mensuelAlpha.costPerWorkOrder)).not.toBeCloseTo(toutesOrganisations.total / otTermines, 2);
  });

  it("le détail des coûts servi au graphique ne contient pas ceux de Beta", async () => {
    // L'écran trace un camembert « Main d'œuvre / Pièces » à partir de ces deux
    // nombres : ils doivent eux aussi être cloisonnés.
    const chezAlpha = await sommesEnBase(SEEDED.tenantAlpha);
    const repartition = mensuelAlpha.chartsData?.costBreakdownChart?.data as number[];

    expect(repartition).toHaveLength(2);
    expect(repartition[0]).toBeCloseTo(chezAlpha.mo, 2);
    expect(repartition[1]).toBeCloseTo(chezAlpha.pieces, 2);
  });

  it("Beta calcule les siens de son côté, sans ceux d'Alpha", async () => {
    const res = await createAuthenticatedRequest('post', '/api/monthly-reports', beta)
      .send({ month: MOIS, year: ANNEE, generatedBy: `test-${STAMP}` });

    expect(res.status).toBe(201);

    const chezBeta = await sommesEnBase(SEEDED.tenantBeta);
    const toutesOrganisations = await sommesEnBase();

    expect(chezBeta.total).toBeGreaterThanOrEqual(BETA_TOTAL);
    expect(Number(res.body.totalMaintenanceCost)).toBeCloseTo(chezBeta.total, 2);
    expect(Number(res.body.totalMaintenanceCost)).not.toBeCloseTo(toutesOrganisations.total, 2);
  });

  it("la liste des rapports mensuels d'Alpha ignore ceux de Beta", async () => {
    const res = await createAuthenticatedRequest('get', '/api/monthly-reports', alpha);

    expect(res.status).toBe(200);
    const lignes = res.body as Array<{ reportNumber: string; totalMaintenanceCost: string | null }>;

    // On vise le rapport que BETA vient d'engendrer, repéré par son montant
    // relu en base : c'est lui, nommément, qui ne doit pas apparaître chez
    // Alpha. Comparer à une constante écrite d'avance reviendrait à supposer
    // que personne d'autre n'a écrit dans la table.
    const chezBeta = await sommesEnBase(SEEDED.tenantBeta);
    const toutesOrganisations = await sommesEnBase();

    const montants = lignes.map(l => Number(l.totalMaintenanceCost));
    expect(montants).not.toContain(chezBeta.total);
    expect(montants).not.toContain(toutesOrganisations.total);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe("Un rapport sans équipement reste chez son locataire", () => {
  it("`equipment_id` NULL n'empêche pas le rattachement", async () => {
    // Les fixtures d'Alpha n'ont PAS d'équipement. Si le cloisonnement passait
    // par une jointure sur equipment_registry, elles seraient invisibles ici —
    // et leurs 1 500 € absents du rapport mensuel vérifié plus haut.
    const { rows } = await pool.query(
      `SELECT tenant_id, equipment_id FROM maintenance_reports WHERE report_number LIKE $1`,
      [`MR-${STAMP}-A%`],
    );

    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.equipment_id).toBeNull();
      expect(r.tenant_id).toBe(SEEDED.tenantAlpha);
    }
  });
});
