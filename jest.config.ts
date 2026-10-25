import type { Config } from '@jest/types';

/**
 * Deux « projects », qui matérialisent les deux voies de test — F05.
 *
 *   unit        → aucune base, aucun serveur. Quelques secondes.
 *                 `npm run test:fast`
 *   integration → serveur applicatif + PostgreSQL jetable, provisionnés par
 *                 scripts/run-tests.mjs. `npm run test:integration`
 *
 * Ne lancez pas `jest` directement pour la voie « integration » : elle attend
 * les variables API_URL et DATABASE_URL que l'orchestrateur fabrique. Passez
 * toujours par `npm test`.
 */

const shared: Partial<Config.InitialProjectOptions> = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Le code serveur écrit ses imports dynamiques à la mode ESM —
    // `await import('../db.js')` — alors que le fichier sur le disque est
    // `db.ts`. esbuild résout cela au moment du paquetage, donc le serveur
    // fonctionne ; le résolveur de Jest, lui, cherche un `db.js` inexistant et
    // l'import échoue. Comme ces imports sont entourés de try/catch, l'échec
    // ne lève pas : la fonction retombe sur son cas dégradé et rend une liste
    // vide. Un test des notifications lisait donc « aucun destinataire » sans
    // pouvoir distinguer « le cloisonnement fonctionne » de « rien ne s'est
    // exécuté ».
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Même raison pour les chemins passant par un alias : le serveur écrit
    // `import('@shared/schema.js')`, et `shared/schema.js` n'existe pas plus
    // que `db.js`. Cette règle doit précéder celle sans extension, sinon
    // c'est elle qui l'emporte et produit un chemin introuvable.
    '^@shared/(.*)\\.js$': '<rootDir>/shared/$1',
    '^@server/(.*)\\.js$': '<rootDir>/server/$1',
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@server/(.*)$': '<rootDir>/server/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }],
  },
};

const config: Config.InitialOptions = {
  rootDir: '.',
  verbose: true,
  projects: [
    {
      ...shared,
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      testTimeout: 15000,
    } as Config.InitialProjectOptions,
    {
      ...shared,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.ts'],
      // Les appels réseau vers un serveur qui démarre à froid peuvent être lents.
      testTimeout: 60000,
    } as Config.InitialProjectOptions,
  ],
  collectCoverageFrom: [
    'server/**/*.ts',
    'shared/**/*.ts',
    '!server/index.ts',
    '!**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
};

export default config;
