import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { userProfiles, userSessions, rateLimits, tenants } from "@shared/schema";
import { eq, and, gt, lt, sql } from "drizzle-orm";
import crypto from "crypto";
import { PIIRedactionService, logWithRedaction } from './pii-redaction-system';
import { licenseEnforcementMiddleware } from "./license-enforcement-middleware";

// Extended Request interface for enterprise auth
interface EnterpriseAuthRequest extends Request {
  user?: any;
  tenantId?: string;
  tenantData?: any;
  sessionId?: string;
  securityContext?: {
    ipAddress: string;
    userAgent: string;
    riskScore: number;
    requiresMFA: boolean;
  };
}

/**
 * 🔒 PRIORITÉ 1: AUTHENTIFICATION OBLIGATOIRE ENTERPRISE
 * Force l'authentification sur TOUTES les routes API (fini l'accès public)
 */
export class EnterpriseAuthMiddleware {
  
  /**
   * Middleware d'authentification obligatoire global
   * Bloque tout accès anonyme - plus de "guest mode"
   */
  static requireAuthentication(req: EnterpriseAuthRequest, res: Response, next: NextFunction) {
    // Routes publiques autorisées (très restrictives)
    const publicPaths = [
      '/api/auth/login',
      '/api/auth/register-invitation', 
      '/api/auth/verify-invitation',
      '/api/enterprise-auth/login',
      '/api/enterprise-auth/register',
      '/api/enterprise-auth/invitations/verify',
      '/api/enterprise-auth/invitations/accept',
      '/api/enterprise-auth/forgot-password',
      '/api/enterprise-auth/reset-password',
      '/api/super-admin',
      '/api/health',
      '/api/ping',
      '/api/platform/editions',
      '/api/payments/config',
      '/api/paypal/config',
      '/api/payments/create-payment-intent',
      '/api/paypal/create-order',
      '/api/diagnostic-test',
      '/diagnostic-test',
      '/payments/config',
      '/paypal/config',
      '/payments/create-payment-intent',
      '/paypal/create-order',
    ];
    
    // req.path est relatif au point de montage quand ce middleware est enregistré via
    // app.use('/api', requireAuthentication) (Express retire le préfixe '/api' de req.path
    // dans ce cas précis) — ce qui fait que les entrées de publicPaths (écrites avec le préfixe
    // '/api/...') ne correspondaient jamais. req.originalUrl n'est jamais réécrit par le montage,
    // donc reste fiable quel que soit le point d'enregistrement de ce middleware (montage global
    // ou route individuelle).
    const requestPath = req.originalUrl.split('?')[0];
    const isPublicPath = publicPaths.some(path => requestPath.startsWith(path));
    
    if (isPublicPath) {
      return next();
    }
    
    // 🔒 CRITIQUE: SEULEMENT cookies sécurisés - plus de Bearer tokens
    const sessionToken = req.cookies?.sessionToken;
    
    if (!sessionToken) {
      return res.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message: "Valid authentication required. Anonymous access disabled.",
        action: "redirect_to_login"
      });
    }
    
    // Valider le token de session, PUIS appliquer le contrôle de licence.
    //
    // ⚠️ F11 — Le contrôle de licence était monté globalement dans
    // server/index.ts avant `registerRoutes`, donc avant que quoi que ce soit
    // ne pose `req.user` : il laissait passer toutes les requêtes. C'est ici,
    // juste après `validateSession`, que `req.user` existe pour la première
    // fois — donc le seul endroit où ce contrôle peut réellement opérer.
    return EnterpriseAuthMiddleware.validateSession(req, res, (err?: any) => {
      if (err) return next(err);
      return licenseEnforcementMiddleware(req as any, res, next);
    });
  }
  
  /**
   * Validation sécurisée des sessions avec audit
   */
  static async validateSession(req: EnterpriseAuthRequest, res: Response, next: NextFunction) {
    try {
      // 🔒 SÉCURITÉ: SEULEMENT cookies HttpOnly/Secure/SameSite
      const sessionToken = req.cookies?.sessionToken;
      
      if (!sessionToken) {
        return res.status(401).json({
          error: "SESSION_TOKEN_MISSING",
          message: "Session token required"
        });
      }
      
      // Chercher la session active
      const [session] = await db
        .select({
          session: userSessions,
          user: userProfiles,
          tenant: tenants
        })
        .from(userSessions)
        .innerJoin(userProfiles, eq(userSessions.userId, userProfiles.id))
        .innerJoin(tenants, eq(userSessions.tenantId, tenants.id))
        .where(
          and(
            eq(userSessions.sessionToken, sessionToken),
            eq(userSessions.isActive, true),
            gt(userSessions.expiresAt, new Date()),
            eq(userProfiles.isActive, true),
            eq(tenants.isActive, true)
          )
        )
        .limit(1);
      
      if (!session) {
        return res.status(401).json({
          error: "SESSION_INVALID",
          message: "Session expired or invalid"
        });
      }
      
      // Mettre à jour l'activité de session
      await db
        .update(userSessions)
        .set({ lastActivityAt: new Date() })
        .where(eq(userSessions.id, session.session.id));
      
      // Attacher le contexte utilisateur/tenant à la requête
      req.user = session.user;
      req.tenantId = session.tenant.id;
      req.tenantData = session.tenant;
      req.sessionId = session.session.id;
      
      // SÉCURITÉ CRITIQUE: Enrichir le contexte utilisateur avec tenantId
      // pour compatibilité avec le middleware tenant
      req.user.tenantId = session.user.tenantId || session.tenant.id;
      
      // Contexte de sécurité
      req.securityContext = {
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        riskScore: await EnterpriseAuthMiddleware.calculateRiskScore(req),
        requiresMFA: session.tenant.plan === 'enterprise'
      };
      
      next();
    } catch (error: any) {
      // ✅ INTÉGRATION REDACTION PII : Logs sécurisés
      logWithRedaction('error', "Session validation error:", {
        error: error.message,
        path: req.path,
        ip: req.ip,
        timestamp: new Date()
      });
      // 🔧 Le cas "session absente/expirée" est déjà traité plus haut avec un 401 propre
      // (SESSION_INVALID) avant d'atteindre ce bloc catch — toute exception qui arrive ici vient
      // donc d'une défaillance infra (base injoignable, requête inattendue), pas d'un problème
      // d'identifiants. 503 (plutôt qu'un 500 générique) le signale correctement à l'appelant
      // (retry raisonnable) et à la supervision, au lieu de ressembler à une erreur d'authentification.
      return res.status(503).json({
        error: "SESSION_VALIDATION_UNAVAILABLE",
        message: "Service de validation de session temporairement indisponible — veuillez réessayer."
      });
    }
  }
  
  /**
   * 📊 PRIORITÉ 5: RATE LIMITING PAR TENANT
   * Protection contre bruteforce et abus par tenant
   */
  static rateLimitByTenant(endpoint: string, limits: { requests: number; windowMs: number; blockDurationMs: number }) {
    return async (req: EnterpriseAuthRequest, res: Response, next: NextFunction) => {
      try {
        // 🧪 DISABLE RATE LIMITING IN TEST AND DEVELOPMENT MODES
        if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
          return next();
        }
        
        const identifier = req.tenantId || req.ip || 'anonymous';
        const identifierType = req.tenantId ? 'tenant' : 'ip';

        // 🔑 F10 — NE COMPTER QUE LES ÉCHECS.
        //
        // Ce middleware s'exécute AVANT le handler : il incrémentait donc le
        // compteur à chaque requête, succès compris. Mesuré sur l'environnement
        // de test : **six connexions RÉUSSIES** depuis la même adresse
        // suffisaient à déclencher 30 minutes de blocage, sans le moindre échec.
        //
        // L'identifiant étant l'IP tant qu'aucun tenant n'est résolu (le cas
        // avant authentification), tous les testeurs partageant une sortie
        // réseau — NAT d'entreprise, VPN — partagent ce compteur : six d'entre
        // eux se connectant normalement verrouillaient TOUT LE GROUPE.
        //
        // Un limiteur anti-force-brute doit compter les tentatives INFRUCTUEUSES.
        // On annule donc l'incrément quand la réponse est un succès (2xx) : la
        // protection contre le bourrinage reste entière — les échecs, eux,
        // continuent de s'accumuler — mais l'usage normal ne pénalise plus
        // personne.
        const annulerSiSucces = (rateLimitRowId: string) => {
          res.on('finish', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              void db.update(rateLimits)
                .set({ requestCount: sql`GREATEST(0, ${rateLimits.requestCount} - 1)` })
                .where(eq(rateLimits.id, rateLimitRowId))
                .catch(() => { /* décompte au mieux : ne doit jamais casser la réponse */ });
            }
          });
        };
        const windowStart = new Date(Date.now() - limits.windowMs);
        
        // Vérifier les limites existantes
        const [existing] = await db
          .select()
          .from(rateLimits)
          .where(
            and(
              eq(rateLimits.identifier, identifier),
              eq(rateLimits.identifierType, identifierType),
              eq(rateLimits.endpoint, endpoint),
              gt(rateLimits.windowStart, windowStart)
            )
          )
          .limit(1);
        
        if (existing) {
          // Vérifier si bloqué
          if (existing.isBlocked && existing.blockExpiresAt && existing.blockExpiresAt > new Date()) {
            return res.status(429).json({
              error: "RATE_LIMITED",
              message: `Too many requests. Blocked until ${existing.blockExpiresAt}`,
              retryAfter: Math.ceil((existing.blockExpiresAt.getTime() - Date.now()) / 1000)
            });
          }
          
          // Incrémenter le compteur
          const newCount = (existing.requestCount || 0) + 1;
          
          if (newCount > limits.requests) {
            // Bloquer et enregistrer
            const blockExpiresAt = new Date(Date.now() + limits.blockDurationMs);
            await db
              .update(rateLimits)
              .set({
                requestCount: newCount,
                isBlocked: true,
                blockExpiresAt,
                lastRequestAt: new Date()
              })
              .where(eq(rateLimits.id, existing.id));
            
            return res.status(429).json({
              error: "RATE_LIMITED",
              message: `Rate limit exceeded. Blocked for ${limits.blockDurationMs/1000} seconds`,
              retryAfter: limits.blockDurationMs / 1000
            });
          }
          
          // Mettre à jour le compteur
          await db
            .update(rateLimits)
            .set({
              requestCount: newCount,
              lastRequestAt: new Date()
            })
            .where(eq(rateLimits.id, existing.id));

          annulerSiSucces(existing.id);
          
        } else {
          // Créer nouvelle entrée
          const [creee] = await db.insert(rateLimits).values({
            identifier,
            identifierType,
            endpoint,
            requestCount: 1,
            windowStart: new Date(),
            lastRequestAt: new Date()
          }).returning({ id: rateLimits.id });

          if (creee) annulerSiSucces(creee.id);
        }
        
        next();
      } catch (error) {
        console.error("Rate limiting error:", error);
        // Ne pas bloquer la requête en cas d'erreur du rate limiter
        next();
      }
    };
  }
  
  /**
   * Calcul du score de risque pour détection d'anomalies
   */
  private static async calculateRiskScore(req: EnterpriseAuthRequest): Promise<number> {
    let riskScore = 0;
    
    // IP inconnue
    const knownIP = req.user?.lastKnownIPs?.includes(req.securityContext?.ipAddress);
    if (!knownIP) riskScore += 0.3;
    
    // User-Agent suspect
    const userAgent = req.get('User-Agent') || '';
    if (userAgent.includes('bot') || userAgent.includes('crawler')) riskScore += 0.5;
    
    // Heures inhabituelles (basique)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) riskScore += 0.2;
    
    return Math.min(riskScore, 1.0);
  }
  
  /**
   * 🔐 PRIORITÉ 4: SESSIONS SÉCURISÉES
   * Configuration HttpOnly + SameSite + Secure cookies
   */
  static configureSecureCookies(req: Request, res: Response, next: NextFunction) {
    // Configuration sécurisée des cookies
    res.cookie = new Proxy(res.cookie, {
      apply: (target, thisArg, args) => {
        const [name, value, options = {}] = args;
        
        // Force les paramètres de sécurité (EXCEPTION: csrfToken doit être lisible par frontend)
        const secureOptions = {
          ...options,
          httpOnly: name === 'csrfToken' ? false : true, // CSRF token lisible, autres HttpOnly
          secure: process.env.NODE_ENV === 'production', // HTTPS en production
          sameSite: 'strict' as const,
          domain: process.env.COOKIE_DOMAIN,
          path: '/',
          maxAge: 24 * 60 * 60 * 1000 // 24h par défaut
        };
        
        return (target as (...args: any[]) => any).call(thisArg, name, value, secureOptions);
      }
    });
    
    next();
  }
  
  /**
   * Révocation de session (déconnexion sécurisée)
   */
  static async revokeSession(sessionId: string, reason: string = 'logout'): Promise<void> {
    await db
      .update(userSessions)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokedReason: reason
      })
      .where(eq(userSessions.id, sessionId));
  }
  
  /**
   * Nettoyage des sessions expirées (tâche de maintenance)
   */
  static async cleanupExpiredSessions(): Promise<void> {
    await db
      .update(userSessions)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokedReason: 'expired'
      })
      .where(
        and(
          eq(userSessions.isActive, true),
          lt(userSessions.expiresAt, new Date())
        )
      );
  }
}

// Middleware de protection anti-robots et anti-indexation
export const blockPublicAccess = (req: Request, res: Response, next: NextFunction) => {
  // Headers de sécurité anti-indexation (Point 0 du plan)
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  next();
};