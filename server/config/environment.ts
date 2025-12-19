/**
 * Configuration centralisée des environnements pour Maintrix
 * Gestion des environnements : development, test, staging, production
 */

export type Environment = 'development' | 'test' | 'staging' | 'production';

export interface DatabaseConfig {
  url: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
}

export interface SecurityConfig {
  jwtSecret: string;
  sessionSecret: string;
  passwordSaltRounds: number;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

export interface EmailConfig {
  sendgridApiKey: string;
  fromEmail: string;
  fromName: string;
}

export interface FeatureFlags {
  enableAdvancedDiagnostic: boolean;
  enableIoTIntegration: boolean;
  enableMultiTenant: boolean;
  enablePayments: boolean;
  enableReporting: boolean;
}

export interface EnvironmentConfig {
  env: Environment;
  port: number;
  database: DatabaseConfig;
  security: SecurityConfig;
  email: EmailConfig;
  features: FeatureFlags;
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    enableConsole: boolean;
    enableFile: boolean;
  };
}

/**
 * Configuration par défaut pour chaque environnement
 */
interface EnvironmentDefaults {
  env: Environment;
  port: number;
  database: Partial<DatabaseConfig>;
  security: Partial<SecurityConfig>;
  features: FeatureFlags;
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    enableConsole: boolean;
    enableFile: boolean;
  };
}

const environments: Record<Environment, EnvironmentDefaults> = {
  development: {
    env: 'development',
    port: 5000,
    database: {
      ssl: false,
    },
    security: {
      passwordSaltRounds: 10,
      corsOrigins: ['http://localhost:3000', 'http://localhost:5000'],
      rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
      rateLimitMaxRequests: 1000, // Plus permissif en dev
    },
    features: {
      enableAdvancedDiagnostic: true,
      enableIoTIntegration: true,
      enableMultiTenant: true,
      enablePayments: true, // Activé avec clés Stripe
      enableReporting: true,
    },
    logging: {
      level: 'debug',
      enableConsole: true,
      enableFile: false,
    },
  },

  test: {
    env: 'test',
    port: 5001,
    database: {
      ssl: false,
      database: 'maintrix_test', // Base dédiée aux tests
    },
    security: {
      passwordSaltRounds: 4, // Plus rapide pour les tests
      corsOrigins: ['http://localhost:3000'],
      rateLimitWindowMs: 15 * 60 * 1000,
      rateLimitMaxRequests: 10000, // Très permissif pour les tests
    },
    features: {
      enableAdvancedDiagnostic: true,
      enableIoTIntegration: false, // Simulé en test
      enableMultiTenant: true,
      enablePayments: false, // Toujours désactivé en test
      enableReporting: true,
    },
    logging: {
      level: 'warn',
      enableConsole: false,
      enableFile: true,
    },
  },

  staging: {
    env: 'staging',
    port: 5000,
    database: {
      ssl: true,
      database: 'maintrix_staging',
    },
    security: {
      passwordSaltRounds: 12,
      corsOrigins: ['https://staging.smartgmao.com'],
      rateLimitWindowMs: 15 * 60 * 1000,
      rateLimitMaxRequests: 500,
    },
    features: {
      enableAdvancedDiagnostic: true,
      enableIoTIntegration: true,
      enableMultiTenant: true,
      enablePayments: true, // Mode test Stripe
      enableReporting: true,
    },
    logging: {
      level: 'info',
      enableConsole: true,
      enableFile: true,
    },
  },

  production: {
    env: 'production',
    port: 5000,
    database: {
      ssl: true,
    },
    security: {
      passwordSaltRounds: 12,
      corsOrigins: ['https://smartgmao.com', 'https://app.smartgmao.com'],
      rateLimitWindowMs: 15 * 60 * 1000,
      rateLimitMaxRequests: 100,
    },
    features: {
      enableAdvancedDiagnostic: true,
      enableIoTIntegration: true,
      enableMultiTenant: true,
      enablePayments: true,
      enableReporting: true,
    },
    logging: {
      level: 'error',
      enableConsole: false,
      enableFile: true,
    },
  },
};

/**
 * Charge la configuration pour l'environnement courant
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  const currentEnv = (process.env.NODE_ENV || 'development') as Environment;
  
  // Configuration de base
  const baseConfig = environments[currentEnv] || environments.development;
  
  // Configuration des variables d'environnement
  const config: EnvironmentConfig = {
    env: currentEnv,
    port: Number(process.env.PORT) || baseConfig.port || 5000,
    
    database: {
      url: process.env.DATABASE_URL || '',
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      database: process.env.PGDATABASE || baseConfig.database?.database || 'maintrix_db',
      ssl: baseConfig.database?.ssl || false,
    },
    
    security: {
      jwtSecret: process.env.JWT_SECRET || process.env.OIDC_SECRET || 'smartgmao-default-secret',
      sessionSecret: process.env.SESSION_SECRET || 'smartgmao-session-secret',
      passwordSaltRounds: baseConfig.security?.passwordSaltRounds || 12,
      corsOrigins: baseConfig.security?.corsOrigins || [],
      rateLimitWindowMs: baseConfig.security?.rateLimitWindowMs || 15 * 60 * 1000,
      rateLimitMaxRequests: baseConfig.security?.rateLimitMaxRequests || 100,
    },
    
    email: {
      sendgridApiKey: process.env.SENDGRID_API_KEY || '',
      fromEmail: process.env.FROM_EMAIL || 'noreply@smartgmao.com',
      fromName: process.env.FROM_NAME || 'Maintrix',
    },
    
    features: baseConfig.features || {
      enableAdvancedDiagnostic: true,
      enableIoTIntegration: true,
      enableMultiTenant: true,
      enablePayments: false,
      enableReporting: true,
    },
    
    logging: baseConfig.logging || {
      level: 'info',
      enableConsole: true,
      enableFile: false,
    },
  };

  // Validation de la configuration en production
  if (currentEnv === 'production') {
    validateProductionConfig(config);
  }

  return config;
}

/**
 * Valide la configuration pour l'environnement de production
 */
function validateProductionConfig(config: EnvironmentConfig): void {
  const requiredSecrets = [
    { key: 'database.url', value: config.database.url },
    { key: 'security.jwtSecret', value: config.security.jwtSecret },
    { key: 'security.sessionSecret', value: config.security.sessionSecret },
  ];

  const missingSecrets = requiredSecrets.filter(
    ({ value }) => !value || value.includes('default')
  );

  if (missingSecrets.length > 0) {
    throw new Error(
      `Configuration manquante pour la production: ${missingSecrets
        .map(({ key }) => key)
        .join(', ')}`
    );
  }
}

/**
 * Vérifie si une fonctionnalité est activée
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const config = loadEnvironmentConfig();
  return config.features[feature];
}

/**
 * Obtient la configuration de base de données formatée pour Drizzle
 */
export function getDatabaseConfig() {
  const config = loadEnvironmentConfig();
  
  if (config.database.url) {
    return { connectionString: config.database.url };
  }
  
  return {
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
    ssl: config.database.ssl,
  };
}

// Export de la configuration globale
export const config = loadEnvironmentConfig();