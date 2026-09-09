/**
 * Parcours complet d'un nouveau testeur — F08.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI EST VÉRIFIÉ
 * ═══════════════════════════════════════════════════════════════════
 * L'objectif de la mission est d'ouvrir Maintrix à des testeurs externes. Ce
 * parcours doit donc fonctionner de bout en bout, sans intervention manuelle
 * en base :
 *
 *   1. le super-admin crée un tenant avec son administrateur ;
 *   2. les identifiants temporaires sont RÉCUPÉRABLES ;
 *   3. la première connexion impose le changement de mot de passe ;
 *   4. le changement aboutit à une session utilisable ;
 *   5. le testeur peut réellement se servir de l'application ;
 *   6. ses données sont isolées de celles des autres tenants ;
 *   7. sa licence lui permet d'opérer.
 *
 * Chaque étape est vérifiée par son EFFET observable, pas par un code HTTP.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { Pool } from 'pg';
import {
  API_BASE,
  freshCsrfToken,
  superAdminRequest,
  SEEDED,
  authenticateUser,
  createAuthenticatedRequest,
} from '../helpers/setup';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL absente — lancez `npm test`.');
const pool = new Pool({ connectionString: DATABASE_URL, max: 3 });

const STAMP = Date.now();
const TESTER_EMAIL = `testeur-${STAMP}@externe.test.local`;
const TENANT_NAME = `TenantTesteur${STAMP}`;
/** Mot de passe que le testeur choisira lui-même à la première connexion. */
const NEW_PASSWORD = 'TesteurMaintrix2026!';

let superAdminToken = '';
let provisioning: any = null;
let temporaryPassword = '';
let tenantId = '';
let testerUserId = 0;

beforeAll(async () => {
  const res = await request(API_BASE).post('/api/super-admin/login').send({
    email: process.env.SUPER_ADMIN_EMAIL,
    password: process.env.SUPER_ADMIN_PASSWORD,
    secretKey: process.env.SUPER_ADMIN_SECRET,
  });
  expect(res.status).toBe(200);
  superAdminToken = res.body.token ?? res.body.superAdminToken ?? '';
  expect(superAdminToken).toBeTruthy();
});

afterAll(async () => {
  await pool.end();
});

// ═══════════════════════════════════════════════════════════════════
describe('F08 — Étape 1 : provisionnement du tenant testeur', () => {
  it('le super-admin crée le tenant et son administrateur', async () => {
    const csrf = await freshCsrfToken();
    const res = await superAdminRequest('post', '/api/super-admin/tenants', superAdminToken, csrf)
      .send({
        name: TENANT_NAME,
        domain: `testeur-${STAMP}.test.local`,
        adminEmail: TESTER_EMAIL,
        adminFirstName: 'Testeur',
        adminLastName: 'Externe',
        maxUsers: 3,
      });

    expect([200, 201]).toContain(res.status);
    provisioning = res.body;
    expect(provisioning.tenant?.id).toBeTruthy();
    tenantId = provisioning.tenant.id;

    const { rows } = await pool.query(
      'SELECT id FROM user_profiles WHERE tenant_id=$1 AND email=$2',
      [tenantId, TESTER_EMAIL],
    );
    expect(rows).toHaveLength(1);
    testerUserId = rows[0].id;
  });

  it('les identifiants temporaires sont RÉCUPÉRABLES par le super-admin', async () => {
    // Le cœur de F08. Sans SendGrid configuré, `sendTenantCredentials()` renvoie
    // `false` SANS lever : la branche `catch` censée restituer les identifiants
    // ne s'exécute jamais, et la réponse nominale ne contient pas le mot de
    // passe. Le compte existe alors sans que personne n'en connaisse l'accès.
    //
    // Contrat attendu : soit l'e-mail est parti (`credentials.sent === true`),
    // soit le mot de passe temporaire figure dans la réponse. Jamais ni l'un
    // ni l'autre.
    const sent = provisioning?.credentials?.sent === true;
    temporaryPassword =
      provisioning?.temporaryCredentials?.password ??
      provisioning?.credentials?.password ??
      '';

    expect(sent || temporaryPassword.length > 0).toBe(true);
    if (!sent) {
      expect(temporaryPassword.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('le compte est marqué « identifiants par défaut, à changer »', async () => {
    const { rows } = await pool.query(
      'SELECT must_change_password, is_default_credentials, is_active, role FROM user_profiles WHERE id=$1',
      [testerUserId],
    );
    expect(rows[0].must_change_password).toBe(true);
    expect(rows[0].is_default_credentials).toBe(true);
    expect(rows[0].is_active).toBe(true);
    expect(rows[0].role).toBe('owner');
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('F08 — Étape 2 : licence et période d\'essai', () => {
  it('le tenant dispose d\'une licence exploitable dès sa création', async () => {
    // Un tenant fraîchement créé n'a ni `subscriptionId`, ni `trialEndDate`, ni
    // `gracePeriodEnd`. `getLicenseStatus()` le classe donc « expired » et
    // `canOperate` vaut false : le testeur naît sans droit d'opérer.
    //
    // Ce n'est aujourd'hui pas bloquant parce que le middleware de licence est
    // inerte (il s'exécute AVANT l'authentification, donc `req.user` est
    // indéfini et il laisse tout passer). Mais corriger cet ordre verrouillerait
    // instantanément tous les tenants testeurs.
    const { rows } = await pool.query(
      'SELECT license_key, trial_end_date, subscription_id, plan FROM tenants WHERE id=$1',
      [tenantId],
    );
    expect(rows[0].license_key).toBeTruthy();

    const hasSubscription = !!rows[0].subscription_id && rows[0].plan !== 'free';
    const trialEnd = rows[0].trial_end_date ? new Date(rows[0].trial_end_date) : null;
    const trialActive = !!trialEnd && trialEnd.getTime() > Date.now();

    expect(hasSubscription || trialActive).toBe(true);
  });

  it('une ligne d\'historique de licence est enregistrée', async () => {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM license_history WHERE tenant_id=$1',
      [tenantId],
    );
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('CONSTAT : le contrôle de licence est actuellement INERTE', async () => {
    // ⚠️ Ce test épingle un ÉTAT CONNU, il ne valide pas un comportement voulu.
    //
    // `licenseEnforcementMiddleware` ne bloque jamais rien, pour deux raisons
    // cumulées :
    //   1. il est monté ligne 363 de server/index.ts, AVANT
    //      `registerRoutes()` qui installe l'authentification — `req.user` est
    //      donc toujours indéfini et le middleware sort par `if (!user) next()` ;
    //   2. monté via `app.use('/api', …)`, Express retire le préfixe du
    //      `req.path`, si bien qu'aucune entrée de sa liste d'exemptions
    //      (toutes écrites avec `/api/…`) ne peut correspondre.
    //
    // On rend la licence expirée et on vérifie que l'accès reste ouvert.
    // Si ce test se met à ÉCHOUER, c'est que l'ordre des middlewares a été
    // corrigé : il faudra alors s'assurer que TOUS les tenants — y compris ceux
    // du seed — disposent d'un essai ou d'un abonnement valides, faute de quoi
    // ils seront tous verrouillés d'un coup.
    const tester = await authenticateUser(TESTER_EMAIL, NEW_PASSWORD).catch(() => null);
    if (!tester) return; // l'étape 3 n'a pas encore tourné

    await pool.query(
      `UPDATE tenants SET trial_end_date = NOW() - INTERVAL '1 day',
                          subscription_id = NULL,
                          grace_period_end = NULL
       WHERE id = $1`,
      [tenantId],
    );

    const res = await createAuthenticatedRequest('get', '/api/equipment', tester);
    expect(res.status).toBe(200); // état actuel : aucun blocage

    // Remise en état pour ne pas polluer les tests suivants.
    await pool.query(
      `UPDATE tenants SET trial_end_date = NOW() + INTERVAL '30 days' WHERE id = $1`,
      [tenantId],
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('F08 — Étape 3 : première connexion et changement de mot de passe', () => {
  let tempSessionToken = '';

  it('la connexion avec le mot de passe temporaire impose un changement', async () => {
    expect(temporaryPassword).toBeTruthy();

    const res = await request(API_BASE)
      .post('/api/enterprise-auth/login')
      .send({ email: TESTER_EMAIL, password: temporaryPassword });

    expect(res.status).toBe(200);
    expect(res.body.requirePasswordChange).toBe(true);
    expect(res.body.userId).toBe(testerUserId);
    tempSessionToken = res.body.tempSessionToken;
    expect(tempSessionToken).toBeTruthy();

    // Aucune session ne doit être ouverte tant que le mot de passe n'a pas changé.
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM user_sessions WHERE user_id=$1',
      [testerUserId],
    );
    expect(rows[0].n).toBe(0);
  });

  /**
   * `tempSessionToken` protégeait RIEN avant F11 : le serveur le fabriquait,
   * l'exigeait en entrée, mais ne le stockait nulle part et ne le comparait à
   * rien — le schéma zod vérifiait seulement qu'il s'agissait d'une chaîne non
   * vide. N'importe quelle valeur passait.
   *
   * Il est désormais lié à l'utilisateur, expirant et à usage unique
   * (server/temp-session-tokens.ts). Les trois tests qui suivent épinglent
   * chacune de ces propriétés.
   */
  it('un jeton inventé est refusé', async () => {
    const csrf = await freshCsrfToken();
    const res = await request(API_BASE)
      .post('/api/enterprise-auth/force-password-change')
      .set('Cookie', `csrfToken=${csrf}`)
      .set('X-CSRF-Token', csrf)
      .send({
        userId: testerUserId,
        currentPassword: temporaryPassword,
        newPassword: NEW_PASSWORD,
        tempSessionToken: 'a'.repeat(64), // bien formé, mais jamais émis
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_TEMP_SESSION');

    // Le compte n'a pas bougé.
    const { rows } = await pool.query(
      'SELECT must_change_password FROM user_profiles WHERE id=$1',
      [testerUserId],
    );
    expect(rows[0].must_change_password).toBe(true);
  });

  it("le jeton d'un autre utilisateur ne vaut pas pour celui-ci", async () => {
    const csrf = await freshCsrfToken();
    const res = await request(API_BASE)
      .post('/api/enterprise-auth/force-password-change')
      .set('Cookie', `csrfToken=${csrf}`)
      .set('X-CSRF-Token', csrf)
      .send({
        userId: testerUserId + 100000, // un identifiant qui n'est pas le sien
        currentPassword: temporaryPassword,
        newPassword: NEW_PASSWORD,
        tempSessionToken, // jeton authentique, mais émis pour testerUserId
      });

    // Refusé, que l'utilisateur visé existe ou non : le jeton est lié à un id.
    expect([401, 404]).toContain(res.status);
  });

  it('un mauvais mot de passe actuel est refusé, jeton valide ou non', async () => {
    const csrf = await freshCsrfToken();
    const res = await request(API_BASE)
      .post('/api/enterprise-auth/force-password-change')
      .set('Cookie', `csrfToken=${csrf}`)
      .set('X-CSRF-Token', csrf)
      .send({
        userId: testerUserId,
        currentPassword: 'ce-nest-pas-le-bon-mot-de-passe',
        newPassword: NEW_PASSWORD,
        tempSessionToken, // le jeton authentique, obtenu à l'étape précédente
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_CURRENT_PASSWORD');

    // Et le compte n'a pas bougé : les drapeaux sont toujours levés.
    const { rows } = await pool.query(
      'SELECT must_change_password FROM user_profiles WHERE id=$1',
      [testerUserId],
    );
    expect(rows[0].must_change_password).toBe(true);
  });

  it('le changement de mot de passe aboutit et lève les drapeaux', async () => {
    const csrf = await freshCsrfToken();
    const res = await request(API_BASE)
      .post('/api/enterprise-auth/force-password-change')
      .set('Cookie', `csrfToken=${csrf}`)
      .set('X-CSRF-Token', csrf)
      .send({
        userId: testerUserId,
        currentPassword: temporaryPassword,
        newPassword: NEW_PASSWORD,
        tempSessionToken,
      });

    expect(res.status).toBe(200);

    const { rows } = await pool.query(
      'SELECT must_change_password, is_default_credentials, password_expires_at FROM user_profiles WHERE id=$1',
      [testerUserId],
    );
    expect(rows[0].must_change_password).toBe(false);
    expect(rows[0].is_default_credentials).toBe(false);
    expect(rows[0].password_expires_at).toBeNull();
  });

  it('le jeton ne peut pas être rejoué après un changement réussi', async () => {
    // Le mot de passe vient d'être changé avec ce jeton. Le rejouer ne doit
    // plus rien donner, même si l'appelant reproduit exactement la requête.
    const csrf = await freshCsrfToken();
    const res = await request(API_BASE)
      .post('/api/enterprise-auth/force-password-change')
      .set('Cookie', `csrfToken=${csrf}`)
      .set('X-CSRF-Token', csrf)
      .send({
        userId: testerUserId,
        currentPassword: NEW_PASSWORD,
        newPassword: 'UnAutreMotDePasse2026!',
        tempSessionToken,
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_TEMP_SESSION');
  });

  it('l\'ancien mot de passe temporaire ne fonctionne plus', async () => {
    const res = await request(API_BASE)
      .post('/api/enterprise-auth/login')
      .send({ email: TESTER_EMAIL, password: temporaryPassword });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('F08 — Étape 4 : le testeur peut réellement se servir de Maintrix', () => {
  it('il se connecte normalement avec son nouveau mot de passe', async () => {
    const res = await request(API_BASE)
      .post('/api/enterprise-auth/login')
      .send({ email: TESTER_EMAIL, password: NEW_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.requirePasswordChange).toBeFalsy();
    expect(res.body.user?.tenantId).toBe(tenantId);
  });

  it('il lit et écrit dans son propre tenant', async () => {
    const tester = await authenticateUser(TESTER_EMAIL, NEW_PASSWORD);

    const list = await createAuthenticatedRequest('get', '/api/equipment', tester);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);

    const created = await createAuthenticatedRequest('post', '/api/equipment', tester).send({
      equipmentId: `TESTEUR-EQ-${STAMP}`,
      equipmentName: 'Équipement du testeur',
      equipmentType: 'Grue portuaire',
      zone: 'Zone Testeur',
      criticalityLevel: 'medium',
      operationalState: 'operational',
    });
    expect([200, 201]).toContain(created.status);

    const after = await createAuthenticatedRequest('get', '/api/equipment', tester);
    expect(JSON.stringify(after.body)).toContain(`TESTEUR-EQ-${STAMP}`);
  });

  it('ses données ne fuitent pas vers un autre tenant', async () => {
    const otherTenantAdmin = await authenticateUser(SEEDED.admin, SEEDED.password);
    const seen = await createAuthenticatedRequest('get', '/api/equipment', otherTenantAdmin);
    expect(seen.status).toBe(200);
    expect(JSON.stringify(seen.body)).not.toContain(`TESTEUR-EQ-${STAMP}`);
  });

  it('il ne voit pas les données du tenant de référence', async () => {
    const tester = await authenticateUser(TESTER_EMAIL, NEW_PASSWORD);
    const list = await createAuthenticatedRequest('get', '/api/equipment', tester);
    const rows = list.body as Array<Record<string, unknown>>;
    for (const row of rows) {
      expect(row.tenantId).toBe(tenantId);
    }
  });
});
