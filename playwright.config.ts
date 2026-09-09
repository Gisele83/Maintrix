import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration Playwright — tests end-to-end (F09).
 *
 * Ces tests visent l'environnement de test EN FONCTIONNEMENT, monté par
 * `node scripts/provision-test-env.mjs`. Ils ne le démarrent pas eux-mêmes :
 * un environnement cloud se provisionne une fois et sert à plusieurs
 * campagnes, contrairement à la base jetable de `npm test`.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // En série : les tests provisionnent de vrais tenants sur un environnement
  // partagé ; les paralléliser rendrait les échecs difficiles à interpréter.
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['json', { outputFile: 'e2e-report.json' }]],
  use: {
    ...devices['Desktop Chrome'],
    // Certificat auto-signé en environnement de test.
    //
    // ⚠️ F12 — CE RÉGLAGE MASQUE UNE RÉSERVE RÉELLE.
    //
    // Avec `ignoreHTTPSErrors`, cette suite passe au vert sur un certificat
    // qu'un navigateur ordinaire REFUSE. Constaté en tentant d'ouvrir
    // `https://172.25.88.119/login` dans un navigateur non instrumenté :
    // navigation bloquée, alors que le même parcours est vert ici.
    //
    // Autrement dit, la barrière E2E ne dira jamais rien du certificat. Un
    // testeur, lui, verra un avertissement de sécurité à chaque visite — et
    // apprendra à passer outre, ce qui rend indétectable un vrai incident.
    //
    // On garde le réglage : sans lui, la suite ne pourrait pas tourner contre
    // l'environnement local auto-signé, et l'on perdrait une barrière utile pour
    // un problème qui n'est pas applicatif. Mais la vérification du certificat
    // appartient à `npm run verify:opening`, pas ici — voir
    // docs/CONTROLLED_OPENING.md.
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
