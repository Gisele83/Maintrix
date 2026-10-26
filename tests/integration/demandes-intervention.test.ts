/**
 * Demandes d'intervention : signaler, arbitrer, convertir ou refuser.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI MANQUAIT
 * ═══════════════════════════════════════════════════════════════════
 * Aucune table ne portait la demande d'intervention (audit du 2026-10-25,
 * section 1 : « Demande d'intervention → OT : ABSENTE — aucune table de
 * demande ; la DI est confondue avec l'OT »). Trois conséquences, que cette
 * suite verrouille une par une :
 *
 *   1. n'importe qui devait créer directement un ordre de travail, c'est-à-dire
 *      engager la planification et le budget ;
 *   2. le refus motivé n'existait pas, donc la charge non traitée n'était pas
 *      mesurable ;
 *   3. l'alerte ne menait à rien (« Alerte → OT : ouverte »).
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE VERROUILLE
 * ═══════════════════════════════════════════════════════════════════
 *   • SIGNALER est ouvert à un technicien — c'est le point de la séparation ;
 *   • ARBITRER ne l'est pas : accepter ou refuser demande un chef d'équipe ;
 *   • l'acceptation crée l'ordre de travail ET marque la demande, dans la MÊME
 *     transaction, avec la priorité DÉCIDÉE par l'arbitre et non l'urgence
 *     perçue par le demandeur ;
 *   • le refus EXIGE un motif, et ce motif est relu ;
 *   • la charge par état est comptée, refus inclus ;
 *   • une alerte devient une demande, sans doublon ;
 *   • rien ne traverse la frontière entre locataires.
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

const STAMP = `DI${Date.now()}`;

let alpha: AuthenticatedAgent;       // admin Alpha — au-dessus de tous les niveaux
let beta: AuthenticatedAgent;        // admin Beta — cloisonnement
let technicien: AuthenticatedAgent;  // niveau 0 : peut signaler, pas arbitrer
let chefEquipe: AuthenticatedAgent;  // team_leader : arbitre

// ═══════════════════════════════════════════════════════════════════
async function insererEquipement(tenantId: string, suffixe: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO equipment_registry (tenant_id, equipment_id, equipment_name, equipment_type, location)
     VALUES ($1, $2, $3, 'pompe', 'Atelier demandes') RETURNING id`,
    [tenantId, `EQ-${STAMP}-${suffixe}`, `EQUIPEMENT-${STAMP}-${suffixe}`],
  );
  return rows[0].id;
}

async function insererAlerte(opts: {
  tenantId: string; suffixe: string; severity?: string; equipmentId?: number | null; status?: string;
}): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO alerts_notifications
       (tenant_id, alert_type, equipment_id, severity, title, message, status, trigger_value, threshold_value)
     VALUES ($1, 'anomaly', $2, $3, $4, $5, $6, '7.800000', '4.500000') RETURNING id`,
    [
      opts.tenantId,
      opts.equipmentId ?? null,
      opts.severity ?? 'high',
      `ALERTE-${STAMP}-${opts.suffixe}`,
      `Dérive vibratoire constatée — ALERTE-${STAMP}-${opts.suffixe}`,
      opts.status ?? 'active',
    ],
  );
  return rows[0].id;
}

const signaler = (auth: AuthenticatedAgent, corps: Record<string, unknown>) =>
  createAuthenticatedRequest('post', '/api/demandes-intervention', auth).send(corps);

const lister = (auth: AuthenticatedAgent, filtre = '') =>
  createAuthenticatedRequest('get', `/api/demandes-intervention${filtre}`, auth);

async function demandeEnBase(id: number) {
  const { rows } = await pool.query(
    `SELECT request_number, status, urgency, title, description, equipment_id, alert_id,
            requested_by, reviewed_by, rejection_reason, review_notes, work_order_id,
            reported_location, tenant_id
       FROM intervention_requests WHERE id = $1`, [id]);
  return rows[0];
}

async function ordreEnBase(id: number) {
  const { rows } = await pool.query(
    `SELECT order_number, order_type, status, priority, equipment_id, requested_by,
            assigned_to, estimated_duration, requires_shutdown, title, description, tenant_id
       FROM work_orders WHERE id = $1`, [id]);
  return rows[0];
}

beforeAll(async () => {
  alpha = await authenticateUser(SEEDED.admin, SEEDED.password);
  beta = await authenticateUser(SEEDED.adminBeta, SEEDED.password);
  technicien = await authenticateUser(SEEDED.technician, SEEDED.password);
  chefEquipe = await authenticateUser(SEEDED.validateurN1, SEEDED.password);
});

afterAll(async () => {
  // ⚠️ L'ORDRE IMPORTE, ET DANS CE SENS-LÀ : c'est la DEMANDE qui référence
  // l'ordre de travail (`intervention_requests.work_order_id`), pas l'inverse.
  // Supprimer les ordres d'abord viole
  // `intervention_requests_work_order_id_work_orders_id_fk` — mesuré, et c'est
  // ce qui a fait tomber cette suite en « failed to run » avec pourtant 26
  // tests au vert.
  //
  // On relève donc les identifiants d'ordre AVANT de supprimer les demandes,
  // puisqu'après on ne saurait plus lesquels étaient les nôtres : leur numéro
  // est auto-généré et ne porte pas le marqueur de cette suite.
  const MARQUES = [`DEMANDE-${STAMP}-%`, `ALERTE-${STAMP}-%`];
  const { rows: ordresNes } = await pool.query<{ work_order_id: number }>(
    `SELECT work_order_id FROM intervention_requests
      WHERE work_order_id IS NOT NULL AND (title LIKE $1 OR title LIKE $2)`, MARQUES);

  await pool.query(
    'DELETE FROM intervention_requests WHERE title LIKE $1 OR title LIKE $2', MARQUES);

  if (ordresNes.length > 0) {
    await pool.query(
      'DELETE FROM work_orders WHERE id = ANY($1::int[])',
      [ordresNes.map((o) => o.work_order_id)]);
  }
  await pool.query('DELETE FROM alerts_notifications WHERE title LIKE $1', [`ALERTE-${STAMP}-%`]);

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
    ).catch(() => { /* rien à supprimer ici */ });
  }
  await pool.query('DELETE FROM equipment_registry WHERE equipment_id LIKE $1', [`EQ-${STAMP}-%`]);
  await pool.end();
});

// ═══════════════════════════════════════════════════════════════════
describe('Signaler est ouvert — c\'est le point de la séparation', () => {
  it('un technicien peut signaler, sans engager de planification', async () => {
    // L'audit reproche que « n'importe qui devait créer directement un ordre
    // de travail, c'est-à-dire engager la planification et le budget ».
    // Signaler doit donc être le geste le plus simple du produit : aucun
    // niveau exigé, et aucun ordre de travail créé.
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'A1');

    const res = await signaler(technicien, {
      title: `DEMANDE-${STAMP}-A1`,
      description: "Fuite d'huile sous la presse, flaque d'environ 20 cm.",
      urgency: 'high',
      equipmentId: equipement,
    });

    expect(res.status).toBe(201);
    const enBase = await demandeEnBase(res.body.id);
    expect(enBase).toMatchObject({
      status: 'pending',
      urgency: 'high',
      equipment_id: equipement,
      tenant_id: SEEDED.tenantAlpha,
      work_order_id: null,
    });
    // Le demandeur vient de la SESSION, jamais du corps.
    expect(enBase.requested_by).toBe(technicien.userId);
    expect(enBase.request_number).toMatch(/^DI-/);

    // AUCUN ordre de travail : signaler n'engage rien.
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM work_orders WHERE equipment_id = $1`, [equipement]);
    expect(Number(rows[0].n)).toBe(0);
  });

  it("accepte un signalement SANS équipement, avec un lieu", async () => {
    // Un exploitant signale parfois un lieu avant d'avoir identifié la machine
    // au référentiel. Exiger l'équipement transformerait la demande en
    // formulaire d'expert — exactement ce qu'on veut éviter.
    const res = await signaler(technicien, {
      title: `DEMANDE-${STAMP}-A2`,
      description: 'Bruit métallique intermittent, origine non identifiée.',
      reportedLocation: 'Atelier B, près du convoyeur',
    });

    expect(res.status).toBe(201);
    const enBase = await demandeEnBase(res.body.id);
    expect(enBase.equipment_id).toBeNull();
    expect(enBase.reported_location).toBe('Atelier B, près du convoyeur');
    // L'urgence par défaut est `medium` : une absence de précision ne doit pas
    // faire passer devant les autres.
    expect(enBase.urgency).toBe('medium');
  });

  it('refuse un signalement vide — sans rien écrire', async () => {
    const avant = await pool.query<{ n: string }>('SELECT count(*) AS n FROM intervention_requests');

    for (const corps of [{}, { title: 'ab' }, { title: `DEMANDE-${STAMP}-X`, description: 'x' }]) {
      const res = await signaler(technicien, corps);
      expect(res.status).toBe(400);
    }

    const apres = await pool.query<{ n: string }>('SELECT count(*) AS n FROM intervention_requests');
    expect(apres.rows[0].n).toBe(avant.rows[0].n);
  });

  it("refuse de signaler sur l'équipement d'un autre locataire", async () => {
    const equipementBeta = await insererEquipement(SEEDED.tenantBeta, 'A4');

    const res = await signaler(alpha, {
      title: `DEMANDE-${STAMP}-A4`,
      description: 'Tentative de signalement hors locataire.',
      equipmentId: equipementBeta,
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('EQUIPEMENT_INTROUVABLE');
  });

  it("un anonyme ne peut ni lire ni signaler", async () => {
    const lecture = await anonymousRequest('get', '/api/demandes-intervention');
    expect([401, 403]).toContain(lecture.status);

    const ecriture = await anonymousRequest('post', '/api/demandes-intervention')
      .send({ title: `DEMANDE-${STAMP}-A5`, description: 'anonyme' });
    expect([401, 403]).toContain(ecriture.status);

    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM intervention_requests WHERE title = $1`, [`DEMANDE-${STAMP}-A5`]);
    expect(Number(rows[0].n)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe("Arbitrer ne l'est pas — accepter crée l'ordre de travail", () => {
  async function demandePending(suffixe: string, opts: { urgency?: string; equipmentId?: number } = {}) {
    const res = await signaler(technicien, {
      title: `DEMANDE-${STAMP}-${suffixe}`,
      description: `Constat ${suffixe} : vibration anormale au démarrage.`,
      urgency: opts.urgency ?? 'urgent',
      ...(opts.equipmentId ? { equipmentId: opts.equipmentId } : {}),
    });
    expect(res.status).toBe(201);
    return res.body.id as number;
  }

  it('un technicien ne peut pas arbitrer', async () => {
    const id = await demandePending('B1');

    const acceptation = await createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/accepter`, technicien).send({});
    expect(acceptation.status).toBe(403);

    const refus = await createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/refuser`, technicien)
      .send({ rejectionReason: 'je tente de refuser' });
    expect(refus.status).toBe(403);

    // Vérifié SUR LA TABLE : un 403 poli au-dessus d'une écriture déjà faite
    // ne prouverait rien.
    expect((await demandeEnBase(id)).status).toBe('pending');
  });

  it("crée l'ordre avec la priorité DÉCIDÉE, et non l'urgence perçue", async () => {
    // C'est toute la raison d'être de la séparation DI / OT : celui qui
    // signale ne fixe pas la priorité d'un travail qu'il ne planifie pas.
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'B2');
    const id = await demandePending('B2', { urgency: 'urgent', equipmentId: equipement });

    const res = await createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/accepter`, chefEquipe)
      .send({
        orderType: 'corrective',
        priority: 'low',
        requiresShutdown: true,
        estimatedHours: 2.5,
        reviewNotes: 'Constat réel mais sans gravité, à traiter au prochain arrêt.',
      });

    expect(res.status).toBe(201);
    const ordre = await ordreEnBase(res.body.ordre.id);

    // L'urgence perçue était `urgent`, la priorité décidée est `low`. Les deux
    // coexistent, et c'est l'arbitrage qui tranche.
    expect(ordre.priority).toBe('low');
    expect((await demandeEnBase(id)).urgency).toBe('urgent');

    expect(ordre).toMatchObject({
      order_type: 'corrective',
      status: 'pending',
      equipment_id: equipement,
      requires_shutdown: true,
      // 2,5 h → 150 minutes.
      estimated_duration: 150,
      tenant_id: SEEDED.tenantAlpha,
    });
    // `requestedBy` porte le DEMANDEUR, pas l'arbitre : c'est lui qui a
    // signalé, et c'est à lui qu'on rendra compte.
    expect(ordre.requested_by).toBe(technicien.userId);
    // La demande d'origine est citée dans l'ordre : un technicien qui l'ouvre
    // voit ce qui a été signalé.
    expect(ordre.description).toContain('DI-');
    expect(ordre.description).toContain('urgence perçue');
  });

  it('marque la demande ET la relie à son ordre, dans la même opération', async () => {
    const id = await demandePending('B3');

    const res = await createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/accepter`, chefEquipe)
      .send({ priority: 'high' });
    expect(res.status).toBe(201);

    const demande = await demandeEnBase(id);
    expect(demande.status).toBe('accepted');
    expect(demande.work_order_id).toBe(res.body.ordre.id);
    expect(demande.reviewed_by).toBe(chefEquipe.userId);
  });

  it("refuse un second arbitrage — 409, et l'ordre n'est pas dupliqué", async () => {
    // Sans cette garde, un second clic créerait un deuxième ordre pour un seul
    // signalement ; et un refus pourrait écraser une acceptation, laissant un
    // ordre orphelin de sa demande.
    const id = await demandePending('B4');
    const premier = await createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/accepter`, chefEquipe).send({});
    expect(premier.status).toBe(201);

    const second = await createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/accepter`, chefEquipe).send({});
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('DEMANDE_DEJA_ARBITREE');
    // Le message DIT l'état trouvé : un « conflit » muet obligerait à
    // recharger pour comprendre.
    expect(second.body.etat).toBe('accepted');

    const refusApres = await createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/refuser`, chefEquipe)
      .send({ rejectionReason: 'tentative de refus après acceptation' });
    expect(refusApres.status).toBe(409);

    const demande = await demandeEnBase(id);
    expect(demande.status).toBe('accepted');
    expect(demande.work_order_id).toBe(premier.body.ordre.id);
  });

  it('deux arbitrages simultanés ne créent qu\'un seul ordre', async () => {
    // Le verrou sur la demande est ce qui l'empêche : sans lui, les deux
    // liraient `pending` et créeraient chacun un ordre.
    const id = await demandePending('B5');

    const [r1, r2] = await Promise.all([
      createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/accepter`, chefEquipe).send({}),
      createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/accepter`, chefEquipe).send({}),
    ]);

    const statuts = [r1.status, r2.status].sort();
    expect(statuts).toEqual([201, 409]);

    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM work_orders WHERE description LIKE $1`,
      [`%${(await demandeEnBase(id)).request_number}%`]);
    expect(Number(rows[0].n)).toBe(1);
  });

  it("refuse d'affecter l'ordre à quelqu'un d'une autre organisation", async () => {
    const id = await demandePending('B6');
    const betaUser = await authenticateUser(SEEDED.adminBeta, SEEDED.password);

    const res = await createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/accepter`, chefEquipe)
      .send({ assignedTo: betaUser.userId });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('UTILISATEUR_INTROUVABLE');
    // Rien n'a été écrit : la demande est toujours à arbitrer.
    expect((await demandeEnBase(id)).status).toBe('pending');
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Le refus EXIGE un motif — la charge écartée devient mesurable', () => {
  async function demandePending(suffixe: string) {
    const res = await signaler(technicien, {
      title: `DEMANDE-${STAMP}-${suffixe}`,
      description: `Constat ${suffixe}.`,
    });
    return res.body.id as number;
  }

  it('refuse un refus sans motif, et un motif trop court', async () => {
    // C'est le défaut n° 2 de l'audit : « le refus motivé n'existe pas, donc
    // la charge non traitée n'est pas mesurable ». Un refus sans motif est
    // indistinguable d'un oubli.
    const id = await demandePending('C1');

    for (const corps of [{}, { rejectionReason: '' }, { rejectionReason: 'ok' }]) {
      const res = await createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/refuser`, chefEquipe).send(corps);
      expect(res.status).toBe(400);
    }

    expect((await demandeEnBase(id)).status).toBe('pending');
  });

  it('enregistre le motif, et le rend', async () => {
    const id = await demandePending('C2');
    const motif = `Relève du réglage de production, pas de la maintenance — ${STAMP}`;

    const res = await createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/refuser`, chefEquipe)
      .send({ rejectionReason: motif });

    expect(res.status).toBe(200);
    const enBase = await demandeEnBase(id);
    expect(enBase.status).toBe('rejected');
    expect(enBase.rejection_reason).toBe(motif);
    expect(enBase.reviewed_by).toBe(chefEquipe.userId);
    // Aucun ordre de travail : refuser ne crée rien.
    expect(enBase.work_order_id).toBeNull();

    // Et le motif est relu par la liste — c'est là qu'il devient exploitable.
    const liste = await lister(alpha, '?status=rejected');
    expect(liste.status).toBe(200);
    expect(liste.text).toContain(motif);
  });

  it('compte la charge par état, refus inclus', async () => {
    // La mesure que l'absence de table rendait impossible.
    const avant = (await lister(alpha)).body.charge;

    const id = await demandePending('C3');
    const apresSignalement = (await lister(alpha)).body.charge;
    expect(apresSignalement.pending).toBe(avant.pending + 1);

    await createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/refuser`, chefEquipe)
      .send({ rejectionReason: `écarté pour mesure de charge ${STAMP}` });

    const apresRefus = (await lister(alpha)).body.charge;
    expect(apresRefus.rejected).toBe(avant.rejected + 1);
    expect(apresRefus.pending).toBe(avant.pending);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe("L'auteur peut retirer sa demande, un tiers ne peut pas", () => {
  it("l'auteur annule la sienne", async () => {
    const res = await signaler(technicien, {
      title: `DEMANDE-${STAMP}-D1`, description: 'Signalement fait par erreur.',
    });
    const id = res.body.id;

    const annulation = await createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/annuler`, technicien).send({});

    expect(annulation.status).toBe(200);
    expect((await demandeEnBase(id)).status).toBe('cancelled');
  });

  it("un tiers sans niveau ne peut pas retirer la demande d'autrui", async () => {
    // Ce serait un moyen de faire disparaître une charge sans la refuser,
    // donc sans laisser de motif — exactement le trou qu'on vient de combler.
    const res = await signaler(chefEquipe, {
      title: `DEMANDE-${STAMP}-D2`, description: "Signalement d'un autre utilisateur.",
    });
    const id = res.body.id;

    const tentative = await createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/annuler`, technicien).send({});

    expect(tentative.status).toBe(403);
    expect((await demandeEnBase(id)).status).toBe('pending');
  });

  it("une demande annulée ne s'arbitre plus", async () => {
    const res = await signaler(technicien, {
      title: `DEMANDE-${STAMP}-D3`, description: 'Annulée puis arbitrée ?',
    });
    const id = res.body.id;
    expect((await createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/annuler`, technicien).send({})).status).toBe(200);

    const acceptation = await createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/accepter`, chefEquipe).send({});

    expect(acceptation.status).toBe(409);
    expect((await demandeEnBase(id)).work_order_id).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Alerte → demande → ordre de travail', () => {
  it("une alerte devient une demande, en reprenant son contenu", async () => {
    // « Alerte → OT : ouverte — aucune création d'OT depuis une alerte ». La
    // boucle se ferme PAR L'ARBITRAGE : une alerte est un symptôme, pas une
    // décision.
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'E1');
    const alerte = await insererAlerte({
      tenantId: SEEDED.tenantAlpha, suffixe: 'E1', severity: 'critical', equipmentId: equipement,
    });

    const res = await createAuthenticatedRequest('post', `/api/alerts/${alerte}/demande-intervention`, technicien).send({});

    expect(res.status).toBe(201);
    const enBase = await demandeEnBase(res.body.id);
    expect(enBase).toMatchObject({
      status: 'pending',
      alert_id: alerte,
      equipment_id: equipement,
      tenant_id: SEEDED.tenantAlpha,
    });
    // L'urgence perçue suit la SÉVÉRITÉ de l'alerte, qui est une mesure —
    // `critical` → `urgent`.
    expect(enBase.urgency).toBe('urgent');
    // Le titre et le message de l'alerte sont reportés : le signalement ne se
    // ressaisit pas.
    expect(enBase.title).toBe(`ALERTE-${STAMP}-E1`);
    expect(enBase.description).toContain('Dérive vibratoire');
    expect(enBase.description).toContain(`alerte #${alerte}`);
    // Le relevé et le seuil sont cités : ils justifient le signalement. Et ils
    // sont écrits SANS la précision de la colonne : `trigger_value` est un
    // `decimal(15,6)` et se relit « 7.800000 » — une précision de schéma n'a
    // rien à faire dans un message que des humains lisent.
    expect(enBase.description).toContain('relevé 7.8 pour un seuil de 4.5');
    expect(enBase.description).not.toContain('7.800000');
  });

  it('ne signale pas deux fois la même alerte', async () => {
    const alerte = await insererAlerte({ tenantId: SEEDED.tenantAlpha, suffixe: 'E2' });

    const premier = await createAuthenticatedRequest('post', `/api/alerts/${alerte}/demande-intervention`, technicien).send({});
    expect(premier.status).toBe(201);

    const second = await createAuthenticatedRequest('post', `/api/alerts/${alerte}/demande-intervention`, technicien).send({});
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('ALERTE_DEJA_SIGNALEE');
    // La réponse NOMME la demande existante : sans cela, l'utilisateur ne sait
    // pas où est passé son signalement.
    expect(second.body.demande.requestNumber).toBe(premier.body.requestNumber);

    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM intervention_requests WHERE alert_id = $1`, [alerte]);
    expect(Number(rows[0].n)).toBe(1);
  });

  it("une alerte dont la demande a été REFUSÉE peut être re-signalée", async () => {
    // Les circonstances ont pu changer. Bloquer définitivement ferait d'un
    // refus une condamnation, alors qu'il n'est qu'un arbitrage daté.
    const alerte = await insererAlerte({ tenantId: SEEDED.tenantAlpha, suffixe: 'E3' });
    const premier = await createAuthenticatedRequest('post', `/api/alerts/${alerte}/demande-intervention`, technicien).send({});
    await createAuthenticatedRequest('post', `/api/demandes-intervention/${premier.body.id}/refuser`, chefEquipe)
      .send({ rejectionReason: `faux positif à la première analyse ${STAMP}` });

    const second = await createAuthenticatedRequest('post', `/api/alerts/${alerte}/demande-intervention`, technicien).send({});

    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(premier.body.id);
  });

  it('LA CHAÎNE COMPLÈTE : alerte → demande → ordre de travail', async () => {
    const equipement = await insererEquipement(SEEDED.tenantAlpha, 'E4');
    const alerte = await insererAlerte({
      tenantId: SEEDED.tenantAlpha, suffixe: 'E4', severity: 'high', equipmentId: equipement,
    });

    // 1. l'alerte est signalée
    const demande = await createAuthenticatedRequest('post', `/api/alerts/${alerte}/demande-intervention`, technicien).send({});
    expect(demande.status).toBe(201);

    // 2. la maintenance arbitre et décide de la priorité
    const acceptation = await createAuthenticatedRequest('post', `/api/demandes-intervention/${demande.body.id}/accepter`, chefEquipe)
      .send({ orderType: 'corrective', priority: 'high', requiresShutdown: false });
    expect(acceptation.status).toBe(201);

    // 3. l'ordre existe, sur le bon équipement, et porte la trace de la chaîne
    const ordre = await ordreEnBase(acceptation.body.ordre.id);
    expect(ordre).toMatchObject({
      order_type: 'corrective', priority: 'high', equipment_id: equipement, status: 'pending',
    });
    expect(ordre.description).toContain(`alerte #${alerte}`);

    // 4. la demande porte son ordre, et l'alerte sa demande : la chaîne se
    //    remonte dans les deux sens.
    const enBase = await demandeEnBase(demande.body.id);
    expect(enBase.status).toBe('accepted');
    expect(enBase.work_order_id).toBe(acceptation.body.ordre.id);
    expect(enBase.alert_id).toBe(alerte);
  });

  it("refuse de signaler l'alerte d'un autre locataire", async () => {
    // Sans ce contrôle, le titre et le message de l'alerte d'autrui
    // passeraient dans la demande créée.
    const alerteBeta = await insererAlerte({ tenantId: SEEDED.tenantBeta, suffixe: 'E5' });

    const res = await createAuthenticatedRequest('post', `/api/alerts/${alerteBeta}/demande-intervention`, alpha).send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('ALERTE_INTROUVABLE');
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM intervention_requests WHERE alert_id = $1`, [alerteBeta]);
    expect(Number(rows[0].n)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Cloisonnement', () => {
  it("ne sert que les demandes du demandeur", async () => {
    await signaler(alpha, { title: `DEMANDE-${STAMP}-F1A`, description: "Demande d'Alpha." });
    await signaler(beta, { title: `DEMANDE-${STAMP}-F1B`, description: 'Demande de Beta.' });

    const res = await lister(alpha);

    expect(res.status).toBe(200);
    expect(res.text).toContain(`DEMANDE-${STAMP}-F1A`);
    expect(res.text).not.toContain(`DEMANDE-${STAMP}-F1B`);
  });

  it("la charge comptée est celle du demandeur seul", async () => {
    // Un compteur global donnerait à chacun la charge de tous — et le nombre
    // affiché ne voudrait rien dire.
    const chargeAlpha = (await lister(alpha)).body.charge;
    const chargeBeta = (await lister(beta)).body.charge;

    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM intervention_requests WHERE tenant_id = $1`, [SEEDED.tenantBeta]);
    const totalBeta = Object.values(chargeBeta).reduce((s: number, n) => s + Number(n), 0);
    expect(totalBeta).toBe(Number(rows[0].n));
    expect(totalBeta).not.toBe(Object.values(chargeAlpha).reduce((s: number, n) => s + Number(n), 0));
  });

  it("Beta ne peut pas arbitrer une demande d'Alpha, et elle reste intacte", async () => {
    const res = await signaler(alpha, { title: `DEMANDE-${STAMP}-F3`, description: "D'Alpha." });
    const id = res.body.id;

    const acceptation = await createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/accepter`, beta).send({});
    expect(acceptation.status).toBe(404);

    const refus = await createAuthenticatedRequest('post', `/api/demandes-intervention/${id}/refuser`, beta)
      .send({ rejectionReason: "refus par une autre organisation" });
    expect(refus.status).toBe(404);

    const enBase = await demandeEnBase(id);
    expect(enBase.status).toBe('pending');
    expect(enBase.rejection_reason).toBeNull();
  });

  it('un état de filtre inconnu est refusé, et ne rend pas tout', async () => {
    // Un filtre non reconnu qui retomberait sur « tout » serait le pire des
    // deux : l'utilisateur croit lire un sous-ensemble.
    const res = await lister(alpha, '?status=nimporte_quoi');
    expect(res.status).toBe(400);
  });
});
