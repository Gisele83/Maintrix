import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { advancedIoTConnector } from './integrations/advanced-iot-connector';
import { smartNotificationEngine } from './integrations/smart-notification-engine';
import { gamificationEngine } from './integrations/gamification-engine';

const app = express();

// Configure Express middleware et sécurité
app.set('trust proxy', 1); // Important pour rate limiting et sécurité
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
  const host = "127.0.0.1"; // Utiliser 127.0.0.1 pour éviter les problèmes DNS
  server.listen({
    port,
    host,
    reusePort: true,
  }, () => {
    log(`✅ Serveur accessible sur http://${host}:${port}`);
    log(`💡 Utilisez http://127.0.0.1:5000 dans votre navigateur`);
  });
})();
