// Middleware de sécurité pour Smart GMAO DiagFix
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
// import { users } from '@shared/schema'; // Removed unused import
import { z } from 'zod';

// Configuration des headers de sécurité
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Pour Vite en dev
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
});

// Rate limiting pour les API critiques
export const diagnosticRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Maximum 100 diagnostics par IP par fenêtre
  message: {
    error: 'Trop de requêtes de diagnostic',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip pour les utilisateurs authentifiés avec accès premium
    return req.user?.planType === 'enterprise';
  }
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 5, // Maximum 5 tentatives de connexion par IP
  message: {
    error: 'Trop de tentatives de connexion',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true
});

export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Maximum 1000 requêtes par IP par fenêtre
  message: {
    error: 'Trop de requêtes',
    retryAfter: '15 minutes'
  }
});

// Validation et sanitisation des entrées
export const validateInput = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Valider le body de la requête
      if (Object.keys(req.body).length > 0) {
        req.body = schema.parse(req.body);
      }
      
      // Sanitiser les strings pour éviter les injections
      sanitizeObject(req.body);
      sanitizeObject(req.query);
      sanitizeObject(req.params);
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Données invalides',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};

// Sanitisation des objets
function sanitizeObject(obj: any): void {
  if (!obj || typeof obj !== 'object') return;
  
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Supprimer les caractères potentiellement dangereux
      obj[key] = obj[key]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Scripts
        .replace(/javascript:/gi, '') // JavaScript URLs
        .replace(/on\w+\s*=/gi, '') // Event handlers
        .trim();
    } else if (typeof obj[key] === 'object') {
      sanitizeObject(obj[key]);
    }
  }
}

// Logging de sécurité
interface SecurityLogEntry {
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  ip: string;
  userAgent: string;
  success: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details?: any;
}

class SecurityLogger {
  private static logs: SecurityLogEntry[] = [];
  
  static log(entry: Partial<SecurityLogEntry>, req: Request, success: boolean = true) {
    const logEntry: SecurityLogEntry = {
      timestamp: new Date(),
      userId: (req as any).user?.id || 'anonymous',
      action: entry.action || 'unknown',
      resource: entry.resource || req.path,
      ip: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      success,
      riskLevel: entry.riskLevel || 'LOW',
      details: entry.details
    };
    
    this.logs.push(logEntry);
    
    // En production, envoyer vers un système de logging externe
    if (logEntry.riskLevel === 'CRITICAL' || logEntry.riskLevel === 'HIGH') {
      console.error(`[SECURITY ALERT] ${JSON.stringify(logEntry)}`);
    } else {
      console.log(`[SECURITY] ${logEntry.action} - ${logEntry.riskLevel}`);
    }
    
    // Nettoyer les anciens logs (garder seulement les 10000 derniers)
    if (this.logs.length > 10000) {
      this.logs = this.logs.slice(-10000);
    }
  }
  
  private static getClientIP(req: Request): string {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           'unknown';
  }
  
  static getRecentLogs(limit: number = 100): SecurityLogEntry[] {
    return this.logs.slice(-limit);
  }
  
  static getHighRiskLogs(): SecurityLogEntry[] {
    return this.logs.filter(log => 
      log.riskLevel === 'HIGH' || log.riskLevel === 'CRITICAL'
    );
  }
}

// Middleware de logging de sécurité
export const securityLogging = (action: string, riskLevel: SecurityLogEntry['riskLevel'] = 'LOW') => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Log de l'action
    SecurityLogger.log({
      action,
      riskLevel,
      resource: req.path
    }, req);
    
    // Intercepter la réponse pour logger le résultat
    const originalSend = res.send;
    res.send = function(data) {
      const success = res.statusCode >= 200 && res.statusCode < 400;
      
      if (!success) {
        SecurityLogger.log({
          action: `${action}_FAILED`,
          riskLevel: res.statusCode >= 500 ? 'HIGH' : 'MEDIUM',
          details: { statusCode: res.statusCode }
        }, req, false);
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

// Détection d'anomalies simples
class AnomalyDetection {
  private static requestCounts = new Map<string, { count: number; firstRequest: Date }>();
  
  static detectSuspiciousActivity(req: Request): boolean {
    const ip = req.ip || 'unknown';
    const now = new Date();
    const key = `${ip}:${req.path}`;
    
    const current = this.requestCounts.get(key) || { count: 0, firstRequest: now };
    current.count++;
    
    // Nettoyer les anciens compteurs (plus de 1 heure)
    if (now.getTime() - current.firstRequest.getTime() > 60 * 60 * 1000) {
      current.count = 1;
      current.firstRequest = now;
    }
    
    this.requestCounts.set(key, current);
    
    // Seuil de détection d'anomalie : plus de 200 requêtes par heure sur le même endpoint
    if (current.count > 200) {
      SecurityLogger.log({
        action: 'SUSPICIOUS_ACTIVITY_DETECTED',
        riskLevel: 'HIGH',
        details: { requestCount: current.count, timeWindow: '1 hour' }
      }, req, false);
      
      return true;
    }
    
    return false;
  }
}

// Middleware de détection d'anomalies
export const anomalyDetection = (req: Request, res: Response, next: NextFunction) => {
  if (AnomalyDetection.detectSuspiciousActivity(req)) {
    return res.status(429).json({
      error: 'Activité suspecte détectée',
      message: 'Trop de requêtes détectées depuis votre adresse IP'
    });
  }
  next();
};

// Middleware de validation d'accès par rôle
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!(req as any).user) {
      SecurityLogger.log({
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        riskLevel: 'MEDIUM'
      }, req, false);
      
      return res.status(401).json({ error: 'Authentification requise' });
    }
    
    const userRole = (req as any).user?.role || 'user';
    if (!roles.includes(userRole)) {
      SecurityLogger.log({
        action: 'INSUFFICIENT_PRIVILEGES',
        riskLevel: 'MEDIUM',
        details: { requiredRoles: roles, userRole }
      }, req, false);
      
      return res.status(403).json({ error: 'Privilèges insuffisants' });
    }
    
    next();
  };
};

// Middleware de protection CSRF
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip pour les requêtes GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = (req as any).session?.csrfToken;
  
  if (!token || !sessionToken || token !== sessionToken) {
    SecurityLogger.log({
      action: 'CSRF_PROTECTION_TRIGGERED',
      riskLevel: 'HIGH'
    }, req, false);
    
    return res.status(403).json({ error: 'Token CSRF invalide ou manquant' });
  }
  
  next();
};

// Export de la classe SecurityLogger pour utilisation dans d'autres modules
export { SecurityLogger };

// Schemas de validation courants
export const commonSchemas = {
  diagnosticInput: z.object({
    equipmentType: z.string().min(1).max(50),
    symptoms: z.union([z.string().max(2000), z.array(z.string().max(500)).max(20)]),
    symptomsChecked: z.array(z.string().max(500)).max(20).optional(),
    zone: z.string().max(100).optional(),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string().max(2000).optional(),
    equipmentId: z.string().max(50).optional(),
    sector: z.string().max(100).optional()
  }),
  
  userInput: z.object({
    email: z.string().email().max(254),
    name: z.string().min(1).max(100),
    role: z.enum(['user', 'admin', 'owner']).optional()
  }),
  
  equipmentInput: z.object({
    name: z.string().min(1).max(100),
    type: z.string().min(1).max(50),
    location: z.string().max(100).optional(),
    serialNumber: z.string().max(50).optional()
  })
};