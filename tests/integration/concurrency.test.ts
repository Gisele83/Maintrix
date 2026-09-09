/**
 * Usage simultané par plusieurs utilisateurs — F10.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI EST VÉRIFIÉ
 * ═══════════════════════════════════════════════════════════════════
 * Les suites précédentes exercent un utilisateur à la fois. L'environnement
 * étant destiné à PLUSIEURS testeurs simultanés, on vérifie ici ce qui ne casse
 * qu'en concurrence :
 *
 *   • aucune fuite de session — chaque réponse appartient bien à son demandeur ;
 *   • l'isolation multi-tenant tient sous requêtes entrelacées ;
 *   • les écritures concurrentes ne se perdent ni ne se corrompent ;
 *   • une contrainte d'unicité départage proprement au lieu de corrompre ;
 *   • le pool de connexions (max: 10) ne s'épuise pas sous charge simultanée.
 *
 * ⚠️ Le limiteur de débit du login (5 essais / 15 min) est DÉSACTIVÉ en
 * NODE_ENV=test. Le comportement multi-utilisateur face à ce limiteur ne peut
 * donc pas être vérifié ici : il l'est par
 * scripts/verify-concurrent-testers.mjs, contre l'environnement en mode
 * production.
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

const STAMP = Date.now();

let adminAlpha: AuthenticatedAgent;
let techAlpha: AuthenticatedAgent;
let adminBeta: AuthenticatedAgent;

beforeAll(async () => {
  // Trois sessions distinctes, ouvertes séparément.
  adminAlpha = await authenticateUser(SEEDED.admin, SEEDED.password);
  techAlpha = await authenticateUser(SEEDED.technician, SEEDED.password);
  adminBeta = await authenticateUser(SEEDED.adminBeta, SEEDED.password);
});

afterAll(async () => {
  await pool.end();
});

// ═══════════════════════════════════════════════════════════════════
describe('F10 — Sessions simultanées : aucune fuite entre utilisateurs', () => {
  it('trois sessions coexistent sans se mélanger', () => {
    expect(adminAlpha.tenantId).toBe(SEEDED.tenantAlpha);
    expect(techAlpha.tenantId).toBe(SEEDED.tenantAlpha);
    expect(adminBeta.tenantId).toBe(SEEDED.tenantBeta);
    // Trois identifiants d'utilisateur distincts.
    const ids = [adminAlpha.userId, techAlpha.userId, adminBeta.userId];
    expect(new Set(ids).size).toBe(3);
  });

  it('des requêtes entrelacées renvoient chacune les données de SON demandeur', async () => {
    // 30 requêtes, trois utilisateurs, tirées en même temps et volontairement
    // mélangées : c'est l'entrelacement qui révèle une éventuelle fuite d'état
    // partagé côté serveur (variable de module, cache mal scopé…).
    const acteurs: Array<[string, AuthenticatedAgent, string]> = [
      ['alpha-admin', adminAlpha, SEEDED.tenantAlpha],
      ['alpha-tech', techAlpha, SEEDED.tenantAlpha],
      ['beta-admin', adminBeta, SEEDED.tenantBeta],
    ];

    const requetes = Array.from({ length: 30 }, (_, i) => {
      const [nom, agent, tenantAttendu] = acteurs[i % 3];
      return createAuthenticatedRequest('get', '/api/equipment', agent)
        .then(res => ({ nom, tenantAttendu, status: res.status, body: res.body }));
    });

    const resultats = await Promise.all(requetes);

    for (const r of resultats) {
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body)).toBe(true);
      // Chaque ligne rendue doit appartenir au tenant du demandeur.
      for (const ligne of r.body as Array<Record<string, unknown>>) {
        expect(ligne.tenantId).toBe(r.tenantAttendu);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('F10 — Isolation multi-tenant sous écritures concurrentes', () => {
  it('deux tenants écrivent en même temps sans se voir', async () => {
    const marqueurAlpha = `CONC-ALPHA-${STAMP}`;
    const marqueurBeta = `CONC-BETA-${STAMP}`;

    const creer = (agent: AuthenticatedAgent, marqueur: string, i: number) =>
      createAuthenticatedRequest('post', '/api/equipment', agent).send({
        equipmentId: `${marqueur}-${i}`,
        equipmentName: `Équipement ${marqueur} ${i}`,
        equipmentType: 'Grue portuaire',
        zone: 'Zone Concurrence',
        criticalityLevel: 'medium',
        operationalState: 'operational',
      });

    // 5 créations par tenant, toutes lancées simultanément et entremêlées.
    const resultats = await Promise.all([
      ...Array.from({ length: 5 }, (_, i) => creer(adminAlpha, marqueurAlpha, i)),
      ...Array.from({ length: 5 }, (_, i) => creer(adminBeta, marqueurBeta, i)),
    ]);
    for (const r of resultats) expect([200, 201]).toContain(r.status);

    // Chaque tenant voit SES 5 équipements, et aucun de l'autre.
    const vuAlpha = JSON.stringify((await createAuthenticatedRequest('get', '/api/equipment', adminAlpha)).body);
    const vuBeta = JSON.stringify((await createAuthenticatedRequest('get', '/api/equipment', adminBeta)).body);

    for (let i = 0; i < 5; i++) {
      expect(vuAlpha).toContain(`${marqueurAlpha}-${i}`);
      expect(vuBeta).toContain(`${marqueurBeta}-${i}`);
    }
    expect(vuAlpha).not.toContain(marqueurBeta);
    expect(vuBeta).not.toContain(marqueurAlpha);

    // Contrôle en base : le cloisonnement doit être réel, pas seulement filtré
    // à l'affichage.
    const { rows } = await pool.query(
      `SELECT tenant_id, COUNT(*)::int AS n FROM equipment_registry
       WHERE equipment_id LIKE $1 GROUP BY tenant_id`,
      [`CONC-%-${STAMP}-%`],
    );
    const parTenant = Object.fromEntries(rows.map(r => [r.tenant_id, r.n]));
    expect(parTenant[SEEDED.tenantAlpha]).toBe(5);
    expect(parTenant[SEEDED.tenantBeta]).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('F10 — Écritures concurrentes sur une même ressource', () => {
  it('des créations simultanées du MÊME identifiant ne corrompent pas les données', async () => {
    // Deux utilisateurs du même tenant tentent de créer le même équipement
    // exactement en même temps. Le résultat acceptable est : soit un seul
    // enregistrement, soit un refus explicite — jamais un doublon silencieux
    // ni une erreur 500.
    const duplique = `CONC-DUP-${STAMP}`;
    const charge = {
      equipmentId: duplique,
      equipmentName: 'Équipement en double',
      equipmentType: 'Grue portuaire',
      zone: 'Zone Concurrence',
      criticalityLevel: 'medium',
      operationalState: 'operational',
    };

    const resultats = await Promise.all([
      createAuthenticatedRequest('post', '/api/equipment', adminAlpha).send(charge),
      createAuthenticatedRequest('post', '/api/equipment', techAlpha).send(charge),
      createAuthenticatedRequest('post', '/api/equipment', adminAlpha).send(charge),
    ]);

    const codes = resultats.map(r => r.status);
    // Aucune erreur serveur : une collision est un cas métier, pas un plantage.
    expect(codes.filter(c => c >= 500)).toHaveLength(0);

    // Contrat observé et vérifié : exactement UNE création réussit, les autres
    // sont refusées en 400 avec un message exploitable par l'utilisateur.
    expect(codes.filter(c => c === 200 || c === 201)).toHaveLength(1);
    const refus = resultats.filter(r => r.status === 400);
    expect(refus).toHaveLength(2);
    for (const r of refus) {
      expect(String(r.body?.message ?? '')).toMatch(/existe déjà/i);
    }

    // Aucun doublon en base — l'unicité tient malgré la simultanéité.
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM equipment_registry WHERE equipment_id = $1',
      [duplique],
    );
    expect(rows[0].n).toBe(1);
  });

  it('l\'unicité des identifiants d\'équipement est GLOBALE, pas par tenant', async () => {
    // ⚠️ Ce test épingle un comportement de conception, pas un défaut.
    //
    // L'index `equipment_registry_equipment_id_unique` porte sur la seule
    // colonne `equipment_id`, sans `tenant_id`. Conséquence pour un pilote
    // multi-testeurs : le premier qui crée « POMPE-01 » empêche TOUS les autres
    // tenants d'utiliser cet identifiant, et apprend indirectement qu'il est
    // pris ailleurs.
    //
    // Ce n'est pas dangereux — la collision est refusée proprement en 400 avec
    // un message actionnable, sans fuite de donnée ni corruption — mais c'est
    // une friction réelle entre testeurs, chacun choisissant naturellement des
    // identifiants évidents. Le corriger impose une migration de schéma
    // (index composite tenant_id + equipment_id) : décision hors périmètre F10.
    const partage = `CONC-XTENANT-${STAMP}`;
    const charge = {
      equipmentId: partage,
      equipmentName: 'Équipement inter-tenant',
      equipmentType: 'Pompe hydraulique',
      zone: 'Zone Concurrence',
    };

    const premier = await createAuthenticatedRequest('post', '/api/equipment', adminAlpha).send(charge);
    expect([200, 201]).toContain(premier.status);

    // Un AUTRE tenant, avec le même identifiant.
    const second = await createAuthenticatedRequest('post', '/api/equipment', adminBeta).send(charge);
    expect(second.status).toBe(400);
    expect(String(second.body?.message ?? '')).toMatch(/existe déjà/i);

    // Une seule ligne, appartenant au premier tenant.
    const { rows } = await pool.query(
      'SELECT tenant_id FROM equipment_registry WHERE equipment_id = $1',
      [partage],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].tenant_id).toBe(SEEDED.tenantAlpha);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('F10 — Le pool de connexions tient la charge simultanée', () => {
  it('40 requêtes simultanées aboutissent toutes, sans épuisement du pool', async () => {
    // server/db.ts fixe `max: 10` connexions et `connectionTimeoutMillis: 10000`.
    // Au-delà de 10 requêtes concurrentes touchant la base, les suivantes
    // attendent une connexion libre ; si l'attente dépasse 10 s, elles échouent.
    // Les tâches de fond consomment elles aussi ce pool (F02).
    const debut = Date.now();

    const resultats = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        createAuthenticatedRequest('get', '/api/equipment', [adminAlpha, techAlpha, adminBeta][i % 3])
          .then(r => r.status)
          .catch(() => 0),
      ),
    );
    const duree = Date.now() - debut;

    const echecs = resultats.filter(s => s !== 200);
    // Toutes doivent aboutir : une seule 500 ou 0 signalerait un pool saturé.
    expect(echecs).toHaveLength(0);
    // Repère de capacité : au-delà de 30 s pour 40 lectures, la contention
    // deviendrait perceptible pour les testeurs.
    expect(duree).toBeLessThan(30000);
  });

  it('des écritures et des lectures simultanées cohabitent', async () => {
    const marqueur = `CONC-MIX-${STAMP}`;
    const melange = [
      ...Array.from({ length: 10 }, (_, i) =>
        createAuthenticatedRequest('post', '/api/equipment', adminAlpha).send({
          equipmentId: `${marqueur}-${i}`,
          equipmentName: `Mixte ${i}`,
          equipmentType: 'Pompe hydraulique',
          zone: 'Zone Concurrence',
        }).then(r => ({ type: 'ecriture', status: r.status })),
      ),
      ...Array.from({ length: 10 }, () =>
        createAuthenticatedRequest('get', '/api/equipment', techAlpha)
          .then(r => ({ type: 'lecture', status: r.status })),
      ),
    ];

    const resultats = await Promise.all(melange);
    const ecritures = resultats.filter(r => r.type === 'ecriture');
    const lectures = resultats.filter(r => r.type === 'lecture');

    expect(ecritures.every(r => [200, 201].includes(r.status))).toBe(true);
    expect(lectures.every(r => r.status === 200)).toBe(true);

    // Les 10 écritures doivent toutes avoir abouti — aucune perdue.
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM equipment_registry WHERE equipment_id LIKE $1',
      [`${marqueur}-%`],
    );
    expect(rows[0].n).toBe(10);
  });
});
