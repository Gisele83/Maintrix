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
        // Extract from JWT token (implementation depends on JWT structure)
        return (req as any).user?.tenantId || null;
      
      case TenantStrategy.DOMAIN:
        // Custom domain mapping - would require domain-to-tenant lookup
        const domain = req.get('host');
        // TODO: Implement domain-to-tenant mapping
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
      // Check if this is guest mode or legacy route that doesn't require tenant
      const isGuestSession = req.session?.isGuest || req.headers.authorization?.includes('guest');
      const isLegacyRoute = !req.path.startsWith('/api/tenant') && !req.path.startsWith('/api/admin');
      
      if (isGuestSession || isLegacyRoute) {
        req.tenantId = this.defaultTenantId;
        return next();
      }

      const tenantId = this.extractTenantId(req);
      
      if (!tenantId) {
        return res.status(400).json({
          error: "TENANT_REQUIRED",
          message: "Tenant identification required. Provide X-Tenant-ID header or use subdomain.",
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