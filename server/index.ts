import express, { type Request, Response, NextFunction } from "express";

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
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { EnterpriseAuthMiddleware } from './enterprise-auth-middleware';
import { securityHeaders } from './security-middleware';

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
  
  // Exempter les endpoints de login et register de la vérification CSRF
  const exemptPaths = [
    '/api/enterprise-auth/login',
    '/api/enterprise-auth/register',
    '/api/auth/login',
    '/api/auth/register',
    '/api/super-admin'
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

  // Extra Origin validation for auth endpoints (DISABLED for login troubleshooting)
  if (false && isApiRoute && (req.path.includes('/auth/') || req.path.includes('/enterprise-auth/'))) {
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

  // 📜 INITIALIZE LICENSE SYSTEM
  try {
    console.log('🔄 Initializing license system...');
    await LicenseService.initializeLicenseTypes();
    console.log('✅ License system initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing license system:', error);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
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

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
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
