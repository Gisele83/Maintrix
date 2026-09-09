/**
 * Parcours testeur de bout en bout, dans un vrai navigateur — F09.
 *
 *   npm run test:e2e
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CES TESTS EXISTENT
 * ═══════════════════════════════════════════════════════════════════
 * Les suites d'intégration (F05→F08) valident l'API. Elles ont toutes réussi
 * alors que le parcours réel dans un navigateur était CASSÉ à deux endroits :
 *
 *   1. `403 ORIGIN_NOT_ALLOWED` — la page de connexion s'affichait, l'API
 *      répondait, mais l'authentification était refusée parce que l'en-tête
 *      `Origin` du navigateur n'était pas dans ALLOWED_ORIGINS. Invisible en
 *      test d'intégration : supertest n'envoie pas d'`Origin`.
 *
 *   2. Écran de première connexion sans issue — le changement de mot de passe
 *      réussissait (HTTP 200, drapeaux levés en base), mais l'interface exigeait
 *      un `sessionToken` dans le corps de la réponse que le serveur ne renvoie
 *      pas (la session est dans un cookie httpOnly). La condition de redirection
 *      était donc toujours fausse : le testeur restait bloqué à la dernière
 *      étape de son accueil.
 *
 * Ces deux défauts ne sont détectables QUE depuis un navigateur. C'est la
 * raison d'être de cette suite.
 *
 * ═══════════════════════════════════════════════════════════════════
 * PRÉREQUIS
 * ═══════════════════════════════════════════════════════════════════
 * Un environnement de test en fonctionnement :
 *     node scripts/provision-test-env.mjs
 * L'URL et les identifiants sont lus dans .env.test-cloud.
 */
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.test-cloud', 'utf8').split(/\r?\n/)
    .filter(l => /^[A-Z_]+=/.test(l))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

const BASE = `http://127.0.0.1:${env.APP_HOST_PORT || '5000'}`;

/** Provisionne un testeur via l'API super-admin et renvoie ses identifiants. */
async function provisionTester(): Promise<{ email: string; password: string }> {
  const stamp = Date.now();
  const email = `e2e-${stamp}@testeur.test.local`;

  const curl = (args: string[]) =>
    execFileSync('curl', ['-s', ...args], { encoding: 'utf8' });

  const login = JSON.parse(curl([
    '-X', 'POST', `${BASE}/api/super-admin/login`,
    '-H', 'Content-Type: application/json',
    '-d', JSON.stringify({
      email: env.SUPER_ADMIN_EMAIL,
      password: env.SUPER_ADMIN_PASSWORD,
      secretKey: env.SUPER_ADMIN_SECRET,
    }),
  ]));
  const token = login.token ?? login.superAdminToken;
  if (!token) throw new Error(`Connexion super-admin impossible : ${JSON.stringify(login)}`);

  // Jeton CSRF : depuis F06, /api/super-admin n'est plus exempté.
  const headers = curl(['-i', `${BASE}/api/health`]);
  const csrf = decodeURIComponent((headers.match(/csrfToken=([^;]+)/) || [])[1] ?? '');

  const created = JSON.parse(curl([
    '-X', 'POST', `${BASE}/api/super-admin/tenants`,
    '-H', `Authorization: Bearer ${token}`,
    '-H', `X-CSRF-Token: ${csrf}`,
    '-H', `Cookie: csrfToken=${csrf}`,
    '-H', 'Content-Type: application/json',
    '-d', JSON.stringify({
      name: `Testeur E2E ${stamp}`,
      domain: `e2e-${stamp}.test.local`,
      adminEmail: email,
      adminFirstName: 'E2E',
      adminLastName: 'Testeur',
      maxUsers: 3,
    }),
  ]));

  const password = created.temporaryCredentials?.password;
  if (!password) {
    throw new Error(
      'Mot de passe temporaire absent de la réponse. ' +
      'Régression du correctif F08 : sans SendGrid, il DOIT être restitué.',
    );
  }
  return { email, password };
}

/**
 * Attend que l'application serve réellement, avant le premier test.
 *
 * Le healthcheck Docker peut déclarer le conteneur `healthy` alors que la
 * première requête applicative reste lente (initialisations paresseuses).
 * Sans cette mise en chauffe, le premier test échouait par dépassement de délai
 * juste après un `docker compose up --build`, puis passait au lancement suivant.
 * Une barrière de déploiement qui dépend de la température du cache n'en est
 * pas une : on rend l'attente explicite.
 */
test.beforeAll(async ({ request }) => {
  // ── Compteurs de limitation de débit ──────────────────────────────
  // `/api/enterprise-auth/login` est limité à 5 tentatives / 15 min, avec
  // blocage de 30 min (server/enterprise-auth-middleware.ts). Ce limiteur n'est
  // désactivé qu'en NODE_ENV `test` ou `development` — l'environnement testeur
  // tourne en `production`, il est donc ACTIF.
  //
  // Le compteur est indexé par `req.tenantId || req.ip`. Avant authentification
  // il n'y a pas de tenant : c'est donc l'IP. Ces tests visent l'application
  // DIRECTEMENT (127.0.0.1:PORT) en court-circuitant nginx, si bien que toutes
  // leurs requêtes proviennent de la même passerelle Docker et partagent un
  // unique compteur. Deux exécutions consécutives suffisaient à déclencher un
  // blocage de 30 minutes, rendant la barrière inutilisable.
  //
  // ⚠️ Par le point d'entrée PUBLIC, ce problème ne se pose pas : nginx pose
  // `X-Forwarded-For` et l'application a `trust proxy`, donc chaque testeur a
  // son propre compteur. Le partage n'affecte que ce harnais.
  try {
    execFileSync('docker', [
      'exec', 'maintrix-test-db', 'psql',
      '-U', env.POSTGRES_USER || 'maintrix_test',
      '-d', env.POSTGRES_DB || 'maintrix_test',
      '-c', 'DELETE FROM rate_limits',
    ], { encoding: 'utf8' });
  } catch {
    // Base inaccessible : le test échouera plus loin, avec un message clair.
  }

  const limite = Date.now() + 120_000;
  while (Date.now() < limite) {
    try {
      const r = await request.get(`${BASE}/api/health`, { timeout: 5000 });
      if (r.ok()) {
        const body = await r.json();
        if (body.status === 'ok') return;
      }
    } catch { /* pas encore prêt */ }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(
    `L'application ne répond pas sur ${BASE}/api/health.\n` +
    'Montez l\'environnement : node scripts/provision-test-env.mjs',
  );
});

async function fillLogin(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder('vous@exemple.com').fill(email);
  await page.getByPlaceholder('Votre mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

// ═══════════════════════════════════════════════════════════════════
test.describe('F09 — Parcours complet d\'un testeur', () => {
  test('de la création du compte au tableau de bord', async ({ page }) => {
    const { email, password } = await provisionTester();

    // ── 1. Première connexion ────────────────────────────────────────
    await fillLogin(page, email, password);

    // Le défaut ORIGIN_NOT_ALLOWED se manifestait ICI : la connexion échouait
    // en 403 et l'on restait sur /login.
    await expect(page).toHaveURL(/first-login-password-change/, { timeout: 20000 });

    // ── 2. Changement de mot de passe imposé ─────────────────────────
    const nouveau = 'TesteurE2E2026!';
    await page.getByPlaceholder('Mot de passe reçu du super-admin').fill(password);
    await page.getByPlaceholder('Choisissez un mot de passe sécurisé').fill(nouveau);
    await page.getByPlaceholder('Tapez à nouveau votre mot de passe').fill(nouveau);
    await page.getByRole('button', { name: /Changer mon mot de passe/ }).click();

    // Le second défaut se manifestait ICI : le mot de passe était bien changé
    // côté serveur, mais la page ne redirigeait jamais.
    await expect(page).toHaveURL(new RegExp(`^${BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`), { timeout: 20000 });

    // ── 3. Le testeur est réellement dans l'application ──────────────
    // On vérifie du CONTENU, pas seulement l'URL : une page blanche à la bonne
    // adresse ne prouverait rien.
    await expect(page.getByText('Maintrix').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Équipements Surveillés|Accès rapide/).first()).toBeVisible({ timeout: 15000 });

    // La session vit dans un cookie httpOnly ; localStorage ne porte qu'un
    // marqueur explicite. Surtout PAS la chaîne "undefined", sur laquelle
    // l'application s'appuyait par accident avant F09.
    const flag = await page.evaluate(() => localStorage.getItem('sessionToken'));
    expect(flag).toBeTruthy();
    expect(flag).not.toBe('undefined');

    // ── 4. Le mot de passe temporaire ne fonctionne plus ─────────────
    await page.evaluate(() => localStorage.clear());
    await fillLogin(page, email, password);
    await expect(page).toHaveURL(/login/);
  });

  test('la connexion échoue proprement avec un mauvais mot de passe', async ({ page }) => {
    await fillLogin(page, 'admin@maintrix.local', 'mauvais-mot-de-passe');
    // On reste sur la page de connexion, sans plantage ni page blanche.
    await expect(page).toHaveURL(/login/);
    await expect(page.getByPlaceholder('vous@exemple.com')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════
test.describe('F09 — Hygiène de la page', () => {
  test('aucun script tiers externe n\'est chargé', async ({ page }) => {
    // Le build de production embarquait un script de bannière Replit chargé
    // depuis replit.com. Bloqué par la CSP, mais produisant une requête en
    // échec et une erreur console à chaque page vue par un testeur.
    const externes: string[] = [];
    page.on('request', (r) => {
      const url = r.url();
      if (r.resourceType() === 'script' && !url.startsWith(BASE) && !url.startsWith('data:')) {
        externes.push(url);
      }
    });

    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    expect(externes).toEqual([]);
  });

  test('le point d\'entrée public sert bien l\'application', async ({ page }) => {
    // Les autres tests visent l'application directement, en boucle locale. Ici
    // on emprunte le chemin RÉEL d'un testeur : nginx en HTTPS.
    const httpsPort = env.HTTPS_PORT || '443';
    const url = httpsPort === '443' ? 'https://127.0.0.1' : `https://127.0.0.1:${httpsPort}`;

    const res = await page.goto(`${url}/login`);
    expect(res?.status()).toBe(200);
    await expect(page.getByPlaceholder('vous@exemple.com')).toBeVisible({ timeout: 15000 });
  });

  test('la page de connexion s\'affiche sans erreur console', async ({ page }) => {
    const erreurs: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });

    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');

    // Les 401 sur les requêtes de profil sont attendus tant qu'on n'est pas
    // connecté : on ne retient que le reste.
    const inattendues = erreurs.filter(e => !/401|Unauthorized/i.test(e));
    expect(inattendues).toEqual([]);
  });
});
