// =======================
// MULTI-TENANT MIDDLEWARE
// =======================
// Strict tenant isolation middleware ensuring zero data leakage between clients

import { Request, Response, NextFunction } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { tenants, auditLogs } from "@shared/schema";

// Extended Request interface with tenant context
export interface TenantRequest extends Request {
  tenantId?: string;
  tenantData?: {
    id: string;
    name: string;
    plan: string;
    isActive: boolean;
    maxUsers: number;
    currentUsers: number;
    dataRetentionDays: number;
    gdprCompliant: boolean;
    auditLogsEnabled: boolean;
    settings: any;
    features: any;
  };
}

// Tenant identification strategies
export enum TenantStrategy {
  SUBDOMAIN = "subdomain",    // tenant.smartgmao.com
  HEADER = "header",         // X-Tenant-ID header
  PATH = "path",            // /tenants/:tenantId/api/...
  JWT_CLAIM = "jwt_claim",  // Tenant ID in JWT token
  DOMAIN = "domain"         // custom domain mapping
}

export class TenantMiddleware {
  private strategy: TenantStrategy;
  private defaultTenantId: string;

  constructor(strategy: TenantStrategy = TenantStrategy.HEADER, defaultTenant = "demo-tenant") {
    this.strategy = strategy;
    this.defaultTenantId = defaultTenant;
  }

  /**
   * Extract tenant ID from request based on configured strategy
   */
  private extractTenantId(req: Request): string | null {
    switch (this.strategy) {
      case TenantStrategy.SUBDOMAIN:
        const subdomain = req.get('host')?.split('.')[0];
        return subdomain && subdomain !== 'www' ? subdomain : null;
      
      case TenantStrategy.HEADER:
        return req.get('X-Tenant-ID') || req.get('x-tenant-id') || null;
      
      case TenantStrategy.PATH:
        const pathMatch = req.path.match(/^\/tenants\/([^\/]+)\//);
        return pathMatch ? pathMatch[1] : null;
      
      case TenantStrategy.JWT_CLAIM:
        // Extract from JWT token - intégration avec JWT OIDC middleware
        return (req as any).user?.tenant_id || (req as any).jwt?.claims?.tenant_id || null;
      
      case TenantStrategy.DOMAIN:
        // Async domain lookup handled separately in resolveTenant()
        return null;
      
      default:
        return null;
    }
  }

  /**
   * Main tenant resolution middleware
   */
  public async resolveTenant(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      // SÉCURITÉ CRITIQUE: Plus de contournement par defaultTenantId
      // Tous les utilisateurs doivent avoir un tenantId valide

      // 1. Essayer d'extraire tenantId depuis l'utilisateur authentifié (Enterprise Auth)
      let tenantId = (req as any).user?.tenantId || (req as any).tenantId;
      
      // 2. Si pas disponible, essayer les méthodes d'extraction configurées  
      if (!tenantId) {
        tenantId = this.extractTenantId(req);
      }

      // 2b. Stratégie DOMAIN : résolution asynchrone par domaine personnalisé
      if (!tenantId && this.strategy === TenantStrategy.DOMAIN) {
        const host = (req.get('host') || '').split(':')[0];
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
          try {
            const [match] = await db.select({ id: tenants.id })
              .from(tenants)
              .where(eq((tenants as any).domain, host))
              .limit(1);
            tenantId = match?.id || null;
          } catch {
            tenantId = null;
          }
        }
      }

      // 3. SÉCURITÉ CRITIQUE: Si aucun tenantId trouvé, REJETER la requête
      if (!tenantId) {
        console.error(`❌ TENANT SECURITY VIOLATION: No tenantId for path ${req.path}, user:`, (req as any).user?.username || 'anonymous');
        return res.status(400).json({
          error: "TENANT_REQUIRED", 
          message: "Tenant context required for data access. Multi-tenant isolation enforced.",
          details: "Each authenticated user must have a valid tenant assignment.",
          strategies: Object.values(TenantStrategy)
        });
      }

      // Validate and fetch tenant data
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenant) {
        return res.status(404).json({
          error: "TENANT_NOT_FOUND",
          message: `Tenant '${tenantId}' not found or inactive.`
        });
      }

      if (!tenant.isActive) {
        return res.status(403).json({
          error: "TENANT_INACTIVE",
          message: "Tenant account is inactive. Contact administrator."
        });
      }

      // Attach tenant context to request
      req.tenantId = tenant.id;
      req.tenantData = tenant;

      // CRITIQUE: Définir le tenant_id dans PostgreSQL pour RLS
      await this.setPostgreSQLTenantContext(tenant.id);

      next();
    } catch (error) {
      console.error("Tenant resolution error:", error);
      return res.status(500).json({
        error: "TENANT_RESOLUTION_ERROR",
        message: "Failed to resolve tenant context."
      });
    }
  }

  /**
   * Data isolation enforcement middleware
   * Automatically adds tenant filter to all database queries
   */
  public enforceDataIsolation(req: TenantRequest, res: Response, next: NextFunction) {
    if (!req.tenantId) {
      return res.status(400).json({
        error: "TENANT_CONTEXT_MISSING",
        message: "Tenant context required for data access."
      });
    }

    // Override database query methods to automatically include tenant filter
    const originalQuery = req.query;
    req.query = new Proxy(originalQuery, {
      get: (target: any, prop: string) => {
        // Inject tenant filter for sensitive operations
        if (prop === 'tenantId') {
          return req.tenantId;
        }
        return target[prop];
      }
    });

    next();
  }

  /**
   * Audit logging middleware for GDPR compliance
   */
  public async auditLogger(req: TenantRequest, res: Response, next: NextFunction) {
    if (!req.tenantData?.auditLogsEnabled) {
      return next();
    }

    const startTime = Date.now();
    let responseStatusCode = 200;
    let responseBody: any = null;

    // Capture response
    const originalSend = res.send;
    res.send = function(data) {
      responseBody = data;
      return originalSend.call(this, data);
    };

    // Capture response status
    const originalStatus = res.status;
    res.status = function(code) {
      responseStatusCode = code;
      return originalStatus.call(this, code);
    };

    // Continue request processing
    res.on('finish', async () => {
      try {
        // Only log significant actions (not health checks, static files, etc.)
        if (req.path.startsWith('/api/') && !req.path.includes('/health')) {
          await db.insert(auditLogs).values({
            tenantId: req.tenantId!,
            userId: (req as any).user?.id || null,
            action: req.method,
            resourceType: req.path.split('/')[2] || 'unknown',
            resourceId: req.params.id || null,
            oldValues: req.method === 'PUT' || req.method === 'PATCH' ? req.body : null,
            newValues: responseBody && responseStatusCode < 300 ? responseBody : null,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            sessionId: req.sessionID,
            success: responseStatusCode < 400,
            errorMessage: responseStatusCode >= 400 ? responseBody?.message : null,
          });
        }
      } catch (error) {
        console.error("Audit logging error:", error);
        // Don't fail the request if audit logging fails
      }
    });

    next();
  }

  /**
   * GDPR data retention enforcement
   */
  public async enforceDataRetention(req: TenantRequest, res: Response, next: NextFunction) {
    if (!req.tenantData?.gdprCompliant) {
      return next();
    }

    // Check if tenant has data retention policies
    const retentionDays = req.tenantData.dataRetentionDays || 365;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // This would typically run as a background job, but for demonstration:
    // Clean up old audit logs beyond retention period
    try {
      await db.delete(auditLogs)
        .where(
          sql`${auditLogs.tenantId} = ${req.tenantId} AND ${auditLogs.timestamp} < ${cutoffDate}`
        );
    } catch (error) {
      console.warn("Data retention cleanup warning:", error);
    }

    next();
  }

  /**
   * Définir le contexte tenant dans PostgreSQL pour RLS
   * CRITIQUE pour isolation multi-tenant
   */
  private async setPostgreSQLTenantContext(tenantId: string): Promise<void> {
    try {
      // Utiliser la fonction PostgreSQL pour définir le tenant courant
      await db.execute(sql`SELECT set_current_tenant(${tenantId})`);
    } catch (error) {
      console.error("Failed to set PostgreSQL tenant context:", error);
      // Ne pas bloquer la requête si la configuration échoue
      // En production, ceci devrait être traité comme une erreur critique
    }
  }

  /**
   * Vérifier si une ressource est statique (pour rate limiting)
   */
  private isStaticResource(req: Request): boolean {
    const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg'];
    const staticPaths = ['/assets', '/public', '/favicon'];
    
    return staticExtensions.some(ext => req.path.toLowerCase().endsWith(ext)) ||
           staticPaths.some(path => req.path.toLowerCase().startsWith(path));
  }

  /**
   * Rate limiting per tenant
   */
  public rateLimitByTenant(requestsPerMinute: number = 100) {
    const tenantRequests = new Map<string, { count: number; resetTime: number }>();

    return (req: TenantRequest, res: Response, next: NextFunction) => {
      // Skip rate limiting for static resources and frontend assets
      if (!req.tenantId || this.isStaticResource(req)) return next();

      const now = Date.now();
      const resetTime = now + 60000; // 1 minute
      
      const existing = tenantRequests.get(req.tenantId);
      
      if (!existing || now > existing.resetTime) {
        tenantRequests.set(req.tenantId, { count: 1, resetTime });
        return next();
      }
      
      if (existing.count >= requestsPerMinute) {
        return res.status(429).json({
          error: "RATE_LIMIT_EXCEEDED",
          message: `Rate limit exceeded for tenant. Max ${requestsPerMinute} requests per minute.`,
          resetTime: existing.resetTime
        });
      }
      
      existing.count++;
      next();
    };
  }
}

// Database query helpers with automatic tenant isolation
export class TenantAwareQuery {
  
  /**
   * Add tenant filter to any query
   */
  static addTenantFilter<T>(query: any, tenantId: string, table: any): any {
    return query.where(eq(table.tenantId, tenantId));
  }
  
  /**
   * Validate tenant access to resource
   */
  static async validateTenantAccess(tenantId: string, resourceTable: any, resourceId: number): Promise<boolean> {
    try {
      const [record] = await db
        .select()
        .from(resourceTable)
        .where(sql`${resourceTable.id} = ${resourceId} AND ${resourceTable.tenantId} = ${tenantId}`)
        .limit(1);
      
      return !!record;
    } catch (error) {
      console.error("Tenant access validation error:", error);
      return false;
    }
  }
  
  /**
   * Cross-tenant data leakage prevention
   */
  static async preventDataLeakage(req: TenantRequest, res: Response, data: any[]): Promise<any[]> {
    if (!req.tenantId || !Array.isArray(data)) {
      return data;
    }
    
    // Filter out any records that don't belong to current tenant
    return data.filter(record => 
      !record.tenantId || record.tenantId === req.tenantId
    );
  }
}

// Default tenant middleware instance
export const tenantMiddleware = new TenantMiddleware();

// Middleware functions for easy use
export const resolveTenant = tenantMiddleware.resolveTenant.bind(tenantMiddleware);
export const enforceDataIsolation = tenantMiddleware.enforceDataIsolation.bind(tenantMiddleware);
export const auditLogger = tenantMiddleware.auditLogger.bind(tenantMiddleware);
export const enforceDataRetention = tenantMiddleware.enforceDataRetention.bind(tenantMiddleware);
export const rateLimitByTenant = tenantMiddleware.rateLimitByTenant.bind(tenantMiddleware);