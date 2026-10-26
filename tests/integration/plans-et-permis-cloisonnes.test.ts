/**
 * Écrire chez une autre entreprise : les deux anomalies critiques de l'examen.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT, ET QUI A ÉTÉ MESURÉ AVANT CORRECTION
 * ═══════════════════════════════════════════════════════════════════
 * Deux routes écrivaient la ligne d'un AUTRE locataire, en HTTP 200 :
 *
 *   A. `PUT /api/maintenance-plans/:id` — ni `tenantRequis` dans la route, ni
 *      locataire dans la clause `WHERE` du stockage, et une liste NOIRE qui
 *      laissait `tenantId` modifiable. Un technicien d'Alpha a renommé le plan
 *      préventif de Beta et s'en est attribué la propriété.
 *
 *   B. `PATCH /api/permits/:id` — mêmes défauts, sur un PERMIS DE TRAVAIL :
 *      document de sécurité (points chauds, consignation, espace confiné).
 *
 * Voir docs/EXAMEN_LISTES_BLANCHES.md pour les relevés d'origine.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE VERROUILLE
 * ═══════════════════════════════════════════════════════════════════
 *   1. A n'existe plus — et la capacité est préservée par la route sanctionnée,
 *      qui est cloisonnée ;
 *   2. B ne voit plus le permis d'autrui : 404, et RIEN n'est écrit ;
 *   3. B refuse `tenantId` au lieu de l'ignorer ;
 *   4. témoin — le propriétaire modifie toujours son permis.
 *
 * Chaque constat est relu DANS LA TABLE : sur ces routes, le code de retour
 * mentait (un 403 posé par le filet anti-fuite arrivait après l'écriture).
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

const STAMP = `CLO${Date.now()}`;

let techAlpha: AuthenticatedAgent;   // locataire Alpha, niveau 1
let respAlpha: AuthenticatedAgent;   // locataire Alpha, niveau 4
let respBeta: AuthenticatedAgent;    // locataire BETA — le propriétaire légitime

/** Un plan préventif appartenant au locataire indiqué. */
async function planDe(tenantId: string, suffixe: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO preventive_maintenance_plans
       (tenant_id, plan_name, equipment_type, frequency, frequency_value, next_due)
     VALUES ($1, $2, 'pompe', 'monthly', 1, now()) RETURNING id`,
    [tenantId, `PLAN-${STAMP}-${suffixe}`],
  );
  return rows[0].id;
}

/** Un permis appartenant au locataire indiqué, à l'état brouillon. */
async function permisDe(tenantId: string, suffixe: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO permit_to_work
       (tenant_id, permit_number, type, title, status, risk_level)
     VALUES ($1, $2, 'hot_work', $3, 'draft', 'medium') RETURNING id`,
    [tenantId, `PTW-${STAMP}-${suffixe}`, `PERMIS-${STAMP}-${suffixe}`],
  );
  return rows[0].id;
}

const litPlan = async (id: number) =>
  (await pool.query<{ plan_name: string; tenant_id: string | null }>(
    `SELECT plan_name, tenant_id FROM preventive_maintenance_plans WHERE id = $1`, [id])).rows[0];

const litPermis = async (id: number) =>
  (await pool.query<{ title: string; tenant_id: string | null; status: string }>(
    `SELECT title, tenant_id, status FROM permit_to_work WHERE id = $1`, [id])).rows[0];

beforeAll(async () => {
  techAlpha = await authenticateUser(SEEDED.technician, SEEDED.password);
  respAlpha = await authenticateUser(SEEDED.validateurN2, SEEDED.password);
  respBeta = await authenticateUser(SEEDED.validateurBeta, SEEDED.password);
});

afterAll(async () => {
  await pool.query(`DELETE FROM permit_to_work WHERE permit_number LIKE $1`, [`PTW-${STAMP}-%`]);
  await pool.query(`DELETE FROM preventive_maintenance_plans WHERE plan_name LIKE $1`, [`PLAN-${STAMP}-%`]);
  await pool.end();
});

describe('A — la porte redondante vers les plans préventifs est fermée', () => {
  it("`PUT /api/maintenance-plans/:id` n'existe plus", async () => {
    const plan = await planDe(SEEDED.tenantBeta, 'a-supprimee');

    const res = await createAuthenticatedRequest('put', `/api/maintenance-plans/${plan}`, techAlpha)
      .send({ planName: 'DÉTOURNÉ', tenantId: SEEDED.tenantAlpha });

    // La route est retirée : plus aucun gestionnaire ne répond.
    expect(res.status).toBe(404);

    // Et surtout : la ligne de Beta est intacte.
    const apres = await litPlan(plan);
    expect(apres.plan_name).toBe(`PLAN-${STAMP}-a-supprimee`);
    expect(apres.tenant_id).toBe(SEEDED.tenantBeta);
  });

  it('la capacité subsiste par la route sanctionnée, qui est cloisonnée', async () => {
    // Sans ce témoin, supprimer la route pourrait passer pour une correction
    // alors qu'on aurait simplement retiré une fonction.
    const planAlpha = await planDe(SEEDED.tenantAlpha, 'a-propre');

    const ok = await createAuthenticatedRequest(
      'put', `/api/preventive-maintenance-plans/${planAlpha}`, respAlpha,
    ).send({ planName: `PLAN-${STAMP}-a-renomme` });
    expect(ok.status).toBe(200);
    expect((await litPlan(planAlpha)).plan_name).toBe(`PLAN-${STAMP}-a-renomme`);

    // Et elle refuse le plan d'autrui — en le DISANT.
    //
    // Mesuré : son cloisonnement tenait déjà (rien n'était écrit), mais elle
    // répondait 200 avec un corps vide, c'est-à-dire qu'elle annonçait un
    // succès sur un coup dans le vide. Devenue la seule voie vers cette table,
    // elle doit rendre 404. Les deux assertions comptent : le statut pour
    // l'appelant, la table pour la sécurité.
    const planBeta = await planDe(SEEDED.tenantBeta, 'a-autrui');
    const refus = await createAuthenticatedRequest(
      'put', `/api/preventive-maintenance-plans/${planBeta}`, respAlpha,
    ).send({ planName: 'DÉTOURNÉ' });
    expect(refus.status).toBe(404);
    expect((await litPlan(planBeta)).plan_name).toBe(`PLAN-${STAMP}-a-autrui`);
  });
});

describe('B — le permis de travail d\'autrui est hors de portée', () => {
  it("le permis d'un autre locataire est ABSENT, et rien n'est écrit", async () => {
    const permis = await permisDe(SEEDED.tenantBeta, 'b-autrui');

    const res = await createAuthenticatedRequest('patch', `/api/permits/${permis}`, techAlpha)
      .send({ title: 'DÉTOURNÉ-PAR-ALPHA' });

    // 404 et non 403 : répondre « interdit » renseignerait sur l'existence du
    // document d'une autre entreprise.
    expect(res.status).toBe(404);

    const apres = await litPermis(permis);
    expect(apres.title).toBe(`PERMIS-${STAMP}-b-autrui`);
    expect(apres.tenant_id).toBe(SEEDED.tenantBeta);
  });

  it('`tenantId` est REFUSÉ, et le permis reste chez son propriétaire', async () => {
    // Avant correction, ce champ passait par une liste noire qui ne le nommait
    // pas : le permis changeait d'entreprise.
    const permis = await permisDe(SEEDED.tenantBeta, 'b-tenant');

    const res = await createAuthenticatedRequest('patch', `/api/permits/${permis}`, respBeta)
      .send({ title: 'TITRE-LEGITIME', tenantId: SEEDED.tenantAlpha });

    expect(res.status).toBe(400);
    expect(res.body.champs).toContain('tenantId');

    const apres = await litPermis(permis);
    expect(apres.tenant_id).toBe(SEEDED.tenantBeta);
    // Rien n'a été écrit : le refus précède l'écriture, il ne la constate pas.
    expect(apres.title).toBe(`PERMIS-${STAMP}-b-tenant`);
  });

  it('le numéro de permis et le statut restent hors de portée', async () => {
    // Le numéro est l'identifiant du document affiché au poste de travail ;
    // le statut passe par les routes de transition, qui tracent.
    const permis = await permisDe(SEEDED.tenantBeta, 'b-numero');

    const res = await createAuthenticatedRequest('patch', `/api/permits/${permis}`, respBeta)
      .send({ permitNumber: 'PTW-FAUX', status: 'approved' });

    expect(res.status).toBe(400);
    expect(res.body.champs).toEqual(expect.arrayContaining(['permitNumber', 'status']));
    expect((await litPermis(permis)).status).toBe('draft');
  });

  it("un champ inconnu est refusé, pas ignoré en silence", async () => {
    const permis = await permisDe(SEEDED.tenantBeta, 'b-inconnu');

    const res = await createAuthenticatedRequest('patch', `/api/permits/${permis}`, respBeta)
      .send({ champInvente: 'valeur' });

    expect(res.status).toBe(400);
    expect(res.body.champs).toContain('champInvente');
  });

  it('témoin : le propriétaire modifie toujours son permis', async () => {
    // Sans lui, une route cassée pour tout le monde passerait pour un
    // cloisonnement réussi.
    const permis = await permisDe(SEEDED.tenantBeta, 'b-temoin');

    const res = await createAuthenticatedRequest('patch', `/api/permits/${permis}`, respBeta)
      .send({ title: `PERMIS-${STAMP}-b-modifie`, description: 'Retouche légitime.' });

    expect(res.status).toBe(200);
    const apres = await litPermis(permis);
    expect(apres.title).toBe(`PERMIS-${STAMP}-b-modifie`);
    expect(apres.tenant_id).toBe(SEEDED.tenantBeta);
    // La retouche renvoie le permis en relecture : c'est le rôle de la route.
    expect(apres.status).toBe('draft');
  });
});

describe("Les sept transitions d'un permis sont cloisonnées", () => {
  /**
   * ═══════════════════════════════════════════════════════════════════
   * POURQUOI CHAQUE ATTAQUE PART DU BON ÉTAT
   * ═══════════════════════════════════════════════════════════════════
   * Chaque transition a une précondition (`submit` exige un brouillon,
   * `approve` un permis soumis…). Si l'on attaquait depuis le mauvais état, le
   * 409 masquerait l'absence de cloisonnement : le test passerait sans rien
   * prouver. Chaque permis de Beta est donc placé dans l'état où l'action
   * RÉUSSIRAIT si le locataire n'était pas vérifié.
   *
   * L'attaquant est un responsable maintenance (niveau 4) et non un
   * technicien : `approve` et `reject` exigent au moins un chef d'équipe, et
   * un 403 de rôle masquerait lui aussi le constat.
   *
   * Ce que ces routes permettaient, mesuré avant correction : soumettre,
   * APPROUVER, ACTIVER, clôturer, rejeter ou annuler le permis d'une autre
   * entreprise. `approve` et `activate` autorisent des travaux — points
   * chauds, consignation, espace confiné.
   */
  const TRANSITIONS = [
    { nom: 'submit', chemin: 'submit', etat: 'draft', corps: {} },
    { nom: 'approve', chemin: 'approve', etat: 'submitted', corps: {} },
    { nom: 'reject', chemin: 'reject', etat: 'submitted', corps: { reason: 'Motif de rejet' } },
    { nom: 'activate', chemin: 'activate', etat: 'approved', corps: {} },
    { nom: 'complete', chemin: 'complete', etat: 'active', corps: { notes: 'Travaux finis' } },
    { nom: 'cancel', chemin: 'cancel', etat: 'draft', corps: {} },
  ] as const;

  /** Un permis de Beta dans l'état voulu. */
  async function permisBetaDansEtat(etat: string, suffixe: string): Promise<number> {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO permit_to_work
         (tenant_id, permit_number, type, title, status, risk_level)
       VALUES ($1, $2, 'hot_work', $3, $4, 'medium') RETURNING id`,
      [SEEDED.tenantBeta, `PTW-${STAMP}-${suffixe}`, `PERMIS-${STAMP}-${suffixe}`, etat],
    );
    return rows[0].id;
  }

  for (const { nom, chemin, etat, corps } of TRANSITIONS) {
    it(`POST /:id/${chemin} refuse le permis d'autrui, et son état ne bouge pas`, async () => {
      const permis = await permisBetaDansEtat(etat, `t-${nom}`);

      const res = await createAuthenticatedRequest(
        'post', `/api/permits/${permis}/${chemin}`, respAlpha,
      ).send(corps);

      expect(res.status).toBe(404);

      // La preuve est l'état en base : un 404 rendu APRÈS la transition
      // laisserait le permis d'autrui modifié.
      const apres = await litPermis(permis);
      expect(apres.status).toBe(etat);
      expect(apres.tenant_id).toBe(SEEDED.tenantBeta);
    });
  }

  it("PATCH /:id/checklist refuse le permis d'autrui", async () => {
    const permis = await permisBetaDansEtat('draft', 't-checklist');

    const res = await createAuthenticatedRequest(
      'patch', `/api/permits/${permis}/checklist`, respAlpha,
    ).send({ checklistItems: [{ label: 'Injecté', checked: true }] });

    expect(res.status).toBe(404);

    // La colonne vaut `[]` par défaut, pas `null` : on vérifie donc que
    // l'élément injecté n'y est pas, plutôt que la forme de la valeur initiale.
    const { rows } = await pool.query<{ checklist_items: unknown }>(
      `SELECT checklist_items FROM permit_to_work WHERE id = $1`, [permis]);
    expect(JSON.stringify(rows[0].checklist_items ?? [])).not.toContain('Injecté');
  });

  it('un identifiant inexistant rend 404, et non 200 sur une checklist fantôme', async () => {
    // Cette route n'avait aucune lecture préalable : elle écrivait à l'aveugle
    // et répondait 200 même quand aucune ligne n'existait.
    const res = await createAuthenticatedRequest(
      'patch', '/api/permits/99999999/checklist', respBeta,
    ).send({ checklistItems: [] });

    expect(res.status).toBe(404);
  });

  it("TÉMOIN — le propriétaire parcourt toute la chaîne de son permis", async () => {
    // Sans ce témoin, un module cassé pour tout le monde passerait pour un
    // cloisonnement réussi. On suit le cycle complet dans l'ordre réel.
    const permis = await permisBetaDansEtat('draft', 't-temoin');
    const etape = (chemin: string, corps: Record<string, unknown> = {}) =>
      createAuthenticatedRequest('post', `/api/permits/${permis}/${chemin}`, respBeta).send(corps);

    expect((await etape('submit')).status).toBe(200);
    expect((await litPermis(permis)).status).toBe('submitted');

    expect((await etape('approve')).status).toBe(200);
    expect((await litPermis(permis)).status).toBe('approved');

    expect((await etape('activate')).status).toBe(200);
    expect((await litPermis(permis)).status).toBe('active');

    const checklist = await createAuthenticatedRequest(
      'patch', `/api/permits/${permis}/checklist`, respBeta,
    ).send({ checklistItems: [{ label: 'Consignation vérifiée', checked: true }] });
    expect(checklist.status).toBe(200);

    expect((await etape('complete', { notes: 'Travaux terminés' })).status).toBe(200);
    const fin = await litPermis(permis);
    expect(fin.status).toBe('completed');
    expect(fin.tenant_id).toBe(SEEDED.tenantBeta);
  });

  it('TÉMOIN — le propriétaire rejette et annule ses propres permis', async () => {
    const aRejeter = await permisBetaDansEtat('submitted', 't-rejet');
    const rejet = await createAuthenticatedRequest(
      'post', `/api/permits/${aRejeter}/reject`, respBeta,
    ).send({ reason: 'Conditions non réunies' });
    expect(rejet.status).toBe(200);
    expect((await litPermis(aRejeter)).status).toBe('rejected');

    const aAnnuler = await permisBetaDansEtat('draft', 't-annul');
    const annul = await createAuthenticatedRequest(
      'post', `/api/permits/${aAnnuler}/cancel`, respBeta,
    ).send({});
    expect(annul.status).toBe(200);
    expect((await litPermis(aAnnuler)).status).toBe('cancelled');
  });
});
