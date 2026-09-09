/**
 * Seed déterministe de la base de TEST — F05.
 *
 *   DATABASE_URL=<base de test> node_modules/.bin/tsx tests/seed.ts
 *
 * Appelé automatiquement par `npm test` (voir scripts/run-tests.mjs).
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER
 * ═══════════════════════════════════════════════════════════════════
 * Les suites d'intégration s'authentifiaient avec `admin@maintrix.local` /
 * `Maintrix2024!` — un compte créé À LA MAIN, référencé nulle part dans le
 * dépôt. Les tests étaient donc irreproductibles : ils passaient sur la machine
 * qui avait ce compte, échouaient partout ailleurs.
 *
 * Ce seed crée exactement les fixtures dont les suites ont besoin, avec des
 * identifiants FIXES (UUID, usernames, e-mails). Il est idempotent : rejouable
 * sans erreur sur une base déjà seedée.
 *
 * ⚠️ Refuse de s'exécuter si la base ne ressemble pas à une base de test —
 * garde-fou contre un seed accidentel en développement ou en production.
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { sql } from 'drizzle-orm';

// Mot de passe partagé par tous les comptes de test. Volontairement identique à
// celui qu'utilisaient déjà les suites, pour ne pas avoir à toucher à leurs
// assertions (règle F05 : ne pas modifier les tests pour obtenir du vert).
export const TEST_PASSWORD = 'Maintrix2024!';

/** Tenants de test. Identifiants figés : les assertions peuvent s'y référer. */
export const TENANT_ALPHA = '00000000-0000-4000-8000-00000000a1fa';
export const TENANT_BETA = '00000000-0000-4000-8000-00000000be7a';

/** Comptes de test, un par rôle utile aux suites. */
export const TEST_USERS = {
  /** Administrateur du tenant Alpha — compte principal des suites existantes. */
  admin: { email: 'admin@maintrix.local', username: 'admin_alpha', role: 'admin', tenantId: TENANT_ALPHA },
  /** Technicien du tenant Alpha — sert aux tests RBAC (droits réduits). */
  technician: { email: 'tech@maintrix.local', username: 'tech_alpha', role: 'technician', tenantId: TENANT_ALPHA },
  /** Administrateur du tenant Beta — sert aux tests d'isolation multi-tenant. */
  adminBeta: { email: 'admin-beta@maintrix.local', username: 'admin_beta', role: 'admin', tenantId: TENANT_BETA },
} as const;

/**
 * Vérifie que l'URL pointe bien vers une base de test.
 * Sans ce contrôle, une variable d'environnement mal placée écraserait des
 * données de développement — ou pire.
 */
function assertTestDatabase(url: string): void {
  const dbName = (url.split('/').pop() ?? '').split('?')[0];
  const looksLikeTest = /test/i.test(dbName) || process.env.MAINTRIX_SEED_ALLOW_ANY_DB === '1';
  if (!looksLikeTest) {
    throw new Error(
      `Refus de seeder « ${dbName} » : le nom de base ne contient pas « test ».\n` +
      `Le seed n'est destiné qu'aux bases de test. Pour forcer (à vos risques) : ` +
      `MAINTRIX_SEED_ALLOW_ANY_DB=1`,
    );
  }
}

export async function seedTestDatabase(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL absent — impossible de seeder.');
  assertTestDatabase(url);

  // Import tardif : db.ts lit DATABASE_URL au chargement du module.
  const { db, pool } = await import('../server/db');
  const { tenants, userProfiles } = await import('@shared/schema');

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  // ── Tenants ──────────────────────────────────────────────────────
  await db.insert(tenants).values([
    {
      id: TENANT_ALPHA,
      name: 'Tenant Alpha (tests)',
      domain: 'alpha.test.local',
      plan: 'enterprise',
      isActive: true,
      maxUsers: 50,
      contactEmail: 'contact@alpha.test.local',
    },
    {
      id: TENANT_BETA,
      name: 'Tenant Beta (tests)',
      domain: 'beta.test.local',
      plan: 'pro',
      isActive: true,
      maxUsers: 10,
      contactEmail: 'contact@beta.test.local',
    },
  ]).onConflictDoNothing();

  // Certaines routes historiques supposent l'existence de `default-tenant`
  // (voir enterprise-auth-routes.ts, qui l'utilise comme repli). On le crée
  // pour que ces chemins ne cassent pas sur une base neuve.
  await db.insert(tenants).values({
    id: 'default-tenant',
    name: 'Default Tenant (tests)',
    domain: 'default.test.local',
    plan: 'free',
    isActive: true,
  }).onConflictDoNothing();

  // ── Utilisateurs ─────────────────────────────────────────────────
  for (const u of Object.values(TEST_USERS)) {
    await db.insert(userProfiles).values({
      tenantId: u.tenantId,
      username: u.username,
      email: u.email,
      password: passwordHash,
      firstName: 'Test',
      lastName: u.role,
      role: u.role,
      isActive: true,
      // Ces deux drapeaux à `false` sont indispensables : à `true`, le login
      // renvoie une redirection « changement de mot de passe obligatoire »
      // au lieu d'une session, et toutes les suites échoueraient.
      mustChangePassword: false,
      isDefaultCredentials: false,
      mfaEnabled: false,
    }).onConflictDoNothing();
  }

  // Rejouabilité : si les comptes existaient déjà avec un autre mot de passe
  // (base réutilisée entre deux exécutions), on réaligne le hash et les
  // drapeaux, sinon l'authentification échouerait silencieusement.
  for (const u of Object.values(TEST_USERS)) {
    await db.execute(sql`
      UPDATE user_profiles
      SET password = ${passwordHash},
          is_active = true,
          must_change_password = false,
          is_default_credentials = false,
          mfa_enabled = false,
          failed_login_attempts = 0,
          account_locked_until = NULL,
          tenant_id = ${u.tenantId},
          role = ${u.role}
      WHERE email = ${u.email}
    `);
  }

  // F08 — Les tenants du seed doivent eux aussi disposer d'un essai valide.
  // Sans cela, ils sont « expired » au sens de getLicenseStatus() : inoffensif
  // tant que le contrôle de licence est inerte, mais toute la suite de tests
  // tomberait le jour où ce contrôle sera rétabli.
  await db.execute(sql`
    UPDATE tenants
    SET trial_start_date = NOW(),
        trial_end_date   = NOW() + INTERVAL '30 days',
        license_status   = 'trial'
    WHERE id IN (${TENANT_ALPHA}, ${TENANT_BETA}, 'default-tenant')
  `);

  const [{ count: tenantCount }] = (await db.execute(
    sql`SELECT COUNT(*)::int AS count FROM tenants`,
  )).rows as Array<{ count: number }>;
  const [{ count: userCount }] = (await db.execute(
    sql`SELECT COUNT(*)::int AS count FROM user_profiles`,
  )).rows as Array<{ count: number }>;

  console.log(`✓ Seed de test : ${tenantCount} tenant(s), ${userCount} utilisateur(s)`);
  console.log(`  comptes : ${Object.values(TEST_USERS).map(u => `${u.email} (${u.role})`).join(', ')}`);

  await pool.end();
}

// Exécution directe (`tsx tests/seed.ts`).
const invokedDirectly = process.argv[1]?.replace(/\\/g, '/').endsWith('tests/seed.ts');
if (invokedDirectly) {
  seedTestDatabase().catch((err) => {
    console.error('✗ Seed échoué :', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
