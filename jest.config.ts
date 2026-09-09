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
