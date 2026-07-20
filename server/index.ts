import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import path from "path";

// Extend Express Request type for CSRF token
declare global {
  namespace Express {
    interface Request {
      csrfToken?: string;
    }
  }
}
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { advancedIoTConnector } from './integrations/advanced-iot-connector';
import { smartNotificationEngine } from './integrations/smart-notification-engine';
import { gamificationEngine } from './integrations/gamification-engine';
import { LicenseService } from './license-service';
import { initDatabase, isDatabaseReady } from './db';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { EnterpriseAuthMiddleware } from './enterprise-auth-middleware';
import { securityHeaders } from './security-middleware';
import { setupSwagger } from './swagger-config';
import { licenseEnforcementMiddleware } from './license-enforcement-middleware';

// ═══════════════════════════════════════════════════════════════════
// 🔒 GÉNÉRATION AUTOMATIQUE DES SECRETS EN DÉVELOPPEMENT
// En production : bloquant si absent. En dev : auto-généré + avertissement.
// ═══════════════════════════════════════════════════════════════════
function ensureDevelopmentSecrets(): void {
  if (process.env.NODE_ENV === 'production') return;

  const DEV_SECRETS = [
    { key: 'JWT_SECRET',         label: 'JWT_SECRET',         bytes: 64 },
    { key: 'SESSION_SECRET',     label: 'SESSION_SECRET',     bytes: 64 },
    { key: 'MFA_ENCRYPTION_KEY', label: 'MFA_ENCRYPTION_KEY', bytes: 32 },
    { key: 'KMS_MASTER_KEY',     label: 'KMS_MASTER_KEY',     bytes: 32 },
  ];

  const insecureDefaults = ['smartgmao-default-secret', 'smartgmao-session-secret'];
  let generated = false;

  DEV_SECRETS.forEach(({ key, label, bytes }) => {
    const val = process.env[key];
    if (!val || insecureDefaults.includes(val)) {
      process.env[key] = crypto.randomBytes(bytes).toString('hex');
      console.warn(`⚠️  [DEV] ${label} auto-généré (ephémère — redémarrage invalide les sessions)`);
      generated = true;
    }
  });

  if (generated) {
    console.warn('⚠️  [DEV] Pour des sessions persistantes, définissez ces variables dans votre fichier .env');
  }
}

ensureDevelopmentSecrets();

// ═══════════════════════════════════════════════════════════════════
// 🔒 VALIDATION CRITIQUE DES VARIABLES D'ENVIRONNEMENT
// Arrêt immédiat en production si une variable critique est absente
// ═══════════════════════════════════════════════════════════════════
function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const CRITICAL: Array<{ key: string; description: string }> = [
    { key: 'DATABASE_URL',       description: 'Connexion base de données' },
    { key: 'KMS_MASTER_KEY',     description: 'Chiffrement données tenant (KMS)' },
    { key: 'JWT_SECRET',         description: 'Signature tokens JWT' },
    { key: 'SESSION_SECRET',     description: 'Signature sessions' },
    { key: 'MFA_ENCRYPTION_KEY', description: 'Chiffrement codes MFA' },
  ];

  const REQUIRED_SECURE: Array<{ key: string; insecureDefault: string; description: string }> = [
    { key: 'JWT_SECRET',     insecureDefault: 'smartgmao-default-secret',  description: 'JWT_SECRET' },
    { key: 'SESSION_SECRET', insecureDefault: 'smartgmao-session-secret',  description: 'SESSION_SECRET' },
  ];

  const missing = CRITICAL.filter(v => !process.env[v.key]);
  const insecure = REQUIRED_SECURE.filter(v => process.env[v.key] === v.insecureDefault);

  if (missing.length > 0 || insecure.length > 0) {
    console.error('\n');
    console.error('═══════════════════════════════════════════════════════');
    console.error('⛔  DÉMARRAGE BLOQUÉ — CONFIGURATION DE SÉCURITÉ MANQUANTE');
    console.error('═══════════════════════════════════════════════════════');
    if (missing.length > 0) {
      console.error('Variables manquantes :');
      missing.forEach(v => console.error(`  ✗ ${v.key.padEnd(22)} — ${v.description}`));
    }
    if (insecure.length > 0) {
      console.error('Variables avec valeur par défaut insécurisée :');
      insecure.forEach(v => console.error(`  ✗ ${v.description} — valeur de développement détectée en production`));
    }
    console.error('═══════════════════════════════════════════════════════\n');
    process.exit(1);
  }

  // Avertissements non-bloquants (services optionnels)
  const OPTIONAL_WARN = [
    'SENDGRID_API_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'ANTHROPIC_API_KEY',
  ];
  OPTIONAL_WARN.forEach(key => {
    if (!process.env[key]) {
      console.warn(`⚠️  ${key} non défini — fonctionnalité dégradée`);
    }
  });
}

validateProductionEnvironment();

const app = express();

// Configure Express middleware et sécurité
app.set('trust proxy', 1); // Important pour rate limiting et sécurité
// 🛡️ SECURITY HEADERS - Protection contre XSS, clickjacking, MIME sniffing
app.use(securityHeaders);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser()); // CRITIQUE: Parsing des cookies

// 🔒 Configure cookies sécurisés globalement
app.use(EnterpriseAuthMiddleware.configureSecureCookies);

// 📎 Fichiers uploadés (pièces jointes) — servis derrière l'authentification.
// Corrige un gap existant : les fichiers multer (bons de commande, interventions)
// étaient enregistrés sur disque mais jamais servis en HTTP.
app.use('/uploads', EnterpriseAuthMiddleware.requireAuthentication, express.static(path.join(process.cwd(), 'uploads')));

// 🔒 CSRF Protection Middleware
app.use((req, res, next) => {
  // Generate CSRF token for all requests
  if (!req.cookies?.csrfToken) {
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('csrfToken', csrfToken, {
      httpOnly: false, // Readable by frontend for X-CSRF-Token header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });
    req.csrfToken = csrfToken;
  } else {
    req.csrfToken = req.cookies.csrfToken;
  }

  // Validate CSRF token on unsafe methods
  const unsafeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  const isUnsafeMethod = unsafeMethods.includes(req.method);
  const isApiRoute = req.path.startsWith('/api');
  
  // Exempter les endpoints de login, register et paiements de la vérification CSRF
  const exemptPaths = [
    '/api/enterprise-auth/login',
    '/api/enterprise-auth/register',
    '/api/auth/login',
    '/api/auth/register',
    '/api/super-admin',
    '/api/data-import-export/import',
    '/api/payments',
    '/api/paypal',
    '/api/diagnostic-test',
  ];
  const isExemptPath = exemptPaths.some(path => req.path.startsWith(path));
  
  if (isUnsafeMethod && isApiRoute && !isExemptPath) {
    const tokenFromHeader = req.headers['x-csrf-token'];
    const tokenFromCookie = req.cookies?.csrfToken;
    
    if (!tokenFromHeader || !tokenFromCookie || tokenFromHeader !== tokenFromCookie) {
      return res.status(403).json({
        error: 'CSRF_TOKEN_INVALID',
        message: 'CSRF token validation failed'
      });
    }
  }

  // Extra Origin validation for auth endpoints
  if (isApiRoute && process.env.NODE_ENV === 'production' && (req.path.includes('/auth/') || req.path.includes('/enterprise-auth/'))) {
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const allowedOrigins = [
      'http://localhost:5000',
      'http://localhost:5173', // Vite dev server
      'https://localhost:5000',
      'https://localhost:5173'
    ];
    
    if (origin && !allowedOrigins.includes(origin)) {
      return res.status(403).json({
        error: 'ORIGIN_NOT_ALLOWED',
        message: 'Request origin not allowed for auth endpoints'
      });
    }
    
    // Fallback: Validate Referer if no Origin
    if (!origin && referer) {
      const refererValid = allowedOrigins.some(allowed => referer.startsWith(allowed));
      if (!refererValid) {
        return res.status(403).json({
          error: 'REFERER_NOT_ALLOWED',
          message: 'Request referer not allowed for auth endpoints'
        });
      }
    }
  }

  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize advanced IoT and gamification systems
  console.log('🚀 Initializing advanced IoT and gamification systems...');
  
  try {
    // Initialize IoT connector
    await advancedIoTConnector.initialize();
    
    // Initialize smart notification engine
    await smartNotificationEngine.initialize();
    
    // Initialize gamification engine
    await gamificationEngine.initialize();
    
    // Set up event connections between systems
    advancedIoTConnector.on('thresholdAlert', (alert) => {
      smartNotificationEngine.processThresholdAlert(alert);
    });
    
    advancedIoTConnector.on('symptomDetected', (detection) => {
      smartNotificationEngine.processSymptomDetection(detection);
    });
    
    // Set up gamification events
    smartNotificationEngine.on('notificationCreated', (notification) => {
      console.log(`📢 Smart notification created: ${notification.title}`);
    });
    
    gamificationEngine.on('levelUp', (event) => {
      console.log(`🎉 User ${event.userId} leveled up in skill ${event.skillId}!`);
    });
    
    gamificationEngine.on('achievementUnlocked', (event) => {
      console.log(`🏆 User ${event.userId} unlocked achievement: ${event.achievementName}!`);
    });
    
    console.log('✅ Advanced IoT and gamification systems initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing advanced systems:', error);
  }

  // 🔌 INITIALIZE DATABASE CONNECTION
  console.log('🔄 Connecting to database...');
  const dbConnected = await initDatabase();
  if (!dbConnected) {
    console.warn('⚠️ Database unavailable - app will start with limited functionality');
  }

  // 📜 INITIALIZE LICENSE SYSTEM
  if (dbConnected) {
    try {
      console.log('🔄 Initializing license system...');
      await LicenseService.initializeLicenseTypes();
      console.log('✅ License system initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing license system:', error);
    }
  }

  // 📖 SWAGGER API DOCUMENTATION
  setupSwagger(app);

  // 🔐 LICENSE ENFORCEMENT — bloque les API si licence expirée
  app.use('/api', licenseEnforcementMiddleware as any);

  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const isProduction = process.env.NODE_ENV === 'production';

    // In production, never return raw error details — prevents leaking stack traces,
    // DB schema info, or internal paths to clients
    if (isProduction && status >= 500) {
      console.error(`[ERROR] ${req.method} ${req.path} → ${status}:`, err);
      return res.status(status).json({ error: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue.' });
    }

    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Port configurable via PORT (défaut 5000) — sert à la fois l'API et le client.
  const port = parseInt(process.env.PORT ?? "5000", 10);
  // Essayer plusieurs configurations d'écoute
  server.listen(port, '0.0.0.0', () => {
    log(`✅ Serveur démarré sur le port ${port}`);
    log(`🌐 Accessible via:`);
    log(`   → http://localhost:${port}`);
    log(`   → http://127.0.0.1:${port}`);
    log(`   → http://0.0.0.0:${port}`);
    
    // Test automatique de connectivité
    setTimeout(() => {
      import('http').then(http => {
        const req = http.request({
          hostname: '127.0.0.1',
          port: port,
          path: '/api/health',
          method: 'GET'
        }, (res) => {
          log(`✅ Test de connectivité réussi: ${res.statusCode}`);
        });
        req.on('error', (err) => {
          log(`❌ Test de connectivité échoué: ${err.message}`);
        });
        req.end();
      });
    }, 1000);
  });
})();
