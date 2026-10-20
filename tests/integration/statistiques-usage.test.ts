/**
 * Les statistiques d'usage s'autorisent sur la session, pas sur un identifiant
 * fourni par l'appelant.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT OUVERT, ET MESURÉ
 * ═══════════════════════════════════════════════════════════════════
 * `GET /api/data-usage-stats` lisait `req.query.userId` et le passait à
 * `verifyUserAccess`, qui vérifie bien que cet utilisateur appartient au
 * locataire de la session — l'inter-locataires était donc fermé — mais évalue
 * ensuite la permission DE CET UTILISATEUR-LÀ. Il suffisait de nommer un
 * collègue mieux doté pour emprunter son droit.
 *
 * Mesuré le 2026-10-21, après avoir accordé `view_data_usage_stats` au seul
 * administrateur du locataire Alpha :
 *
 *   technicien, ?userId=<le sien>      -> 403, correctement refusé
 *   technicien, ?userId=<l'admin>      -> 200, DONNÉES SERVIES
 *   administrateur, ?userId=<le sien>  -> 200, légitime
 *   administrateur de Beta, ?userId=1  -> 403, inter-locataires fermé
 *   administrateur, SANS paramètre     -> 403  (parseInt(undefined) = NaN)
 *
 * La dernière ligne dit à quel point le défaut était structurel : la route
 * n'était utilisable QU'EN nommant un identifiant, donc le seul usage prévu
 * passait par le mécanisme fautif.
 *
 * Le défaut était latent sur une installation neuve, `data_access_permissions`
 * étant vide : la route refusait alors tout le monde. Il devenait exploitable
 * dès la première permission accordée — c'est pourquoi cette suite accorde
 * elle-même la permission avant de mesurer, puis la retire.
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

const PERMISSION = 'view_data_usage_stats';

let admin: AuthenticatedAgent;
let technicien: AuthenticatedAgent;
let adminBeta: AuthenticatedAgent;
let idAdmin: number;
let idTechnicien: number;

beforeAll(async () => {
  admin = await authenticateUser(SEEDED.admin, SEEDED.password);
  technicien = await authenticateUser(SEEDED.technician, SEEDED.password);
  adminBeta = await authenticateUser(SEEDED.adminBeta, SEEDED.password);

  idAdmin = Number(admin.userId);
  idTechnicien = Number(technicien.userId);

  // Sans cette permission la route refuse tout le monde, et le défaut reste
  // invisible : c'est ce qui l'a laissé passer jusqu'ici.
  await pool.query('DELETE FROM data_access_permissions WHERE permission = $1', [PERMISSION]);
  await pool.query(
    'INSERT INTO data_access_permissions (user_id, permission, is_active) VALUES ($1,$2,true)',
    [idAdmin, PERMISSION]);
});

afterAll(async () => {
  await pool.query('DELETE FROM data_access_permissions WHERE permission = $1', [PERMISSION]);
  await pool.end();
});

// ═══════════════════════════════════════════════════════════════════
describe('GET /api/data-usage-stats', () => {
  it("le titulaire de la permission l'obtient, sans avoir à se nommer", async () => {
    // Témoin, et correction d'un défaut d'ergonomie au passage : avant, la
    // route sans paramètre répondait 403 à son propre titulaire.
    const res = await createAuthenticatedRequest('get', '/api/data-usage-stats', admin);

    expect(res.status).toBe(200);
    expect(res.body?.company?.id).toBe(SEEDED.tenantAlpha);
  });

  it("un compte sans la permission est refusé, même en nommant celui qui l'a", async () => {
    // LE CAS DÉCISIF. Les deux requêtes doivent être refusées : avec son
    // propre identifiant comme avec celui de l'administrateur.
    const sien = await createAuthenticatedRequest(
      'get', `/api/data-usage-stats?userId=${idTechnicien}`, technicien);
    const emprunte = await createAuthenticatedRequest(
      'get', `/api/data-usage-stats?userId=${idAdmin}`, technicien);

    expect({ cas: 'son propre identifiant', statut: sien.status })
      .toEqual({ cas: 'son propre identifiant', statut: 403 });
    expect({ cas: "l'identifiant de l'administrateur", statut: emprunte.status })
      .toEqual({ cas: "l'identifiant de l'administrateur", statut: 403 });
  });

  it("le paramètre `userId` ne change rien pour le titulaire non plus", async () => {
    // L'autre sens du même contrôle : le paramètre est ignoré, il ne retire
    // pas plus qu'il n'accorde. Nommer le technicien ne doit pas dégrader
    // l'accès de l'administrateur.
    const res = await createAuthenticatedRequest(
      'get', `/api/data-usage-stats?userId=${idTechnicien}`, admin);

    expect(res.status).toBe(200);
    expect(res.body?.company?.id).toBe(SEEDED.tenantAlpha);
  });

  it('les chiffres servis sont ceux du locataire de la session', async () => {
    // Beta a son propre administrateur, donc son propre accès par le rôle.
    // Ce qu'il lit doit porter SON identifiant de locataire, et pas celui
    // d'Alpha — c'est la propriété que le paramètre de requête menaçait.
    const res = await createAuthenticatedRequest('get', '/api/data-usage-stats', adminBeta);

    expect(res.status).toBe(200);
    expect(res.body?.company?.id).toBe(SEEDED.tenantBeta);
    expect(JSON.stringify(res.body)).not.toContain(SEEDED.tenantAlpha);
  });

  it("un anonyme n'obtient rien", async () => {
    const res = await anonymousRequest('get', `/api/data-usage-stats?userId=${idAdmin}`);

    expect([401, 403]).toContain(res.status);
  });
});
