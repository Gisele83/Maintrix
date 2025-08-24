// =================================================================
// JWT OIDC AUTHENTICATION & TENANT EXTRACTION MIDDLEWARE
// =================================================================
// Objectif 1: Middleware tenant_id + JWT OIDC complet
// Intégration JWT avec extraction sécurisée du tenant_id

import { Request, Response, NextFunction } from "express";
import jwt from 'jsonwebtoken';
import { TenantRequest } from "./tenant-middleware";

// Interface pour les claims JWT OIDC
interface JWTClaims {
  sub: string;              // Subject (user ID)
  email?: string;           // Email utilisateur
  iss: string;              // Issuer (fournisseur OIDC)
  aud: string;              // Audience
  iat: number;              // Issued at
  exp: number;              // Expiration
  tenant_id?: string;       // ID du tenant (claim personnalisé)
  tenant_role?: string;     // Rôle dans le tenant
  permissions?: string[];   // Permissions utilisateur
}

export interface JWTRequest extends TenantRequest {
  user?: JWTClaims;
  jwt?: {
    token: string;
    claims: JWTClaims;
    verified: boolean;
  };
}

// Configuration OIDC par défaut (peut être surchargée par env vars)
const OIDC_CONFIG = {
  issuer: process.env.OIDC_ISSUER || 'https://auth.smartgmao.com',
  audience: process.env.OIDC_AUDIENCE || 'smartgmao-api',
  algorithms: ['RS256'] as const,
  jwksUri: process.env.OIDC_JWKS_URI || 'https://auth.smartgmao.com/.well-known/jwks.json',
};

// Configuration simplifiée pour JWT (sans JWKS pour cette version)
// Pour production complète, intégrer jwks-rsa pour validation des clés publiques

export class JWTOIDCMiddleware {
  
  /**
   * Extraire le token JWT de la requête
   */
  private static extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    
    // Bearer token format: "Bearer <token>"
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Alternative: token dans un cookie (pour web apps)
    if (req.cookies?.auth_token) {
      return req.cookies.auth_token;
    }
    
    // Alternative: token dans query params (déconseillé sauf debug)
    if (process.env.NODE_ENV !== 'production' && req.query.token) {
      return req.query.token as string;
    }
    
    return null;
  }
  
  /**
   * Obtenir la clé de signature (version simplifiée - env var ou secret partagé)
   */
  private static getSigningKey(): string {
    const secret = process.env.JWT_SECRET || process.env.OIDC_SECRET || 'smartgmao-default-secret';
    
    if (process.env.NODE_ENV === 'production' && secret === 'smartgmao-default-secret') {
      throw new Error('JWT_SECRET must be set in production');
    }
    
    return secret;
  }
  
  /**
   * Vérifier et décoder le token JWT
   */
  private static async verifyJWT(token: string): Promise<JWTClaims> {
    return new Promise((resolve, reject) => {
      try {
        // Obtenir la clé de signature
        const signingKey = this.getSigningKey();
        
        // Options de vérification JWT
        const verifyOptions: jwt.VerifyOptions = {
          algorithms: ['HS256', 'RS256'],
          issuer: OIDC_CONFIG.issuer,
          audience: OIDC_CONFIG.audience,
        };
        
        // Vérifier et décoder le token
        const decoded = jwt.verify(token, signingKey, verifyOptions) as JWTClaims;
        
        resolve(decoded);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Middleware principal JWT OIDC
   */
  static async authenticate(req: JWTRequest, res: Response, next: NextFunction) {
    try {
      const token = this.extractToken(req);
      
      if (!token) {
        return res.status(401).json({
          error: "JWT_REQUIRED",
          message: "Valid JWT token required. Provide Bearer token in Authorization header."
        });
      }
      
      // Vérifier le token JWT
      const claims = await this.verifyJWT(token);
      
      // Attacher les informations JWT à la requête
      req.user = claims;
      req.jwt = {
        token,
        claims,
        verified: true
      };
      
      // Extraire tenant_id du JWT (claim personnalisé)
      if (claims.tenant_id) {
        req.tenantId = claims.tenant_id;
      }
      
      next();
    } catch (error) {
      console.error("JWT verification error:", error);
      
      if ((error as any).name === 'TokenExpiredError') {
        return res.status(401).json({
          error: "JWT_EXPIRED",
          message: "JWT token has expired. Please obtain a new token."
        });
      }
      
      if ((error as any).name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: "JWT_INVALID",
          message: "Invalid JWT token format or signature."
        });
      }
      
      return res.status(401).json({
        error: "JWT_VERIFICATION_FAILED",
        message: "Failed to verify JWT token."
      });
    }
  }
  
  /**
   * Middleware optionnel JWT (n'échoue pas si pas de token)
   */
  static async optionalAuthenticate(req: JWTRequest, res: Response, next: NextFunction) {
    try {
      const token = this.extractToken(req);
      
      if (token) {
        const claims = await this.verifyJWT(token);
        req.user = claims;
        req.jwt = {
          token,
          claims,
          verified: true
        };
        
        if (claims.tenant_id) {
          req.tenantId = claims.tenant_id;
        }
      }
      
      next();
    } catch (error) {
      // Mode optionnel : continuer même en cas d'erreur JWT
      console.warn("Optional JWT verification failed:", error);
      next();
    }
  }
  
  /**
   * Middleware de vérification des permissions
   */
  static requirePermissions(requiredPermissions: string[]) {
    return (req: JWTRequest, res: Response, next: NextFunction) => {
      if (!req.user?.permissions) {
        return res.status(403).json({
          error: "INSUFFICIENT_PERMISSIONS",
          message: "User permissions not found in JWT token."
        });
      }
      
      const hasAllPermissions = requiredPermissions.every(permission =>
        req.user!.permissions!.includes(permission)
      );
      
      if (!hasAllPermissions) {
        return res.status(403).json({
          error: "INSUFFICIENT_PERMISSIONS",
          message: `Required permissions: ${requiredPermissions.join(', ')}`,
          userPermissions: req.user.permissions
        });
      }
      
      next();
    };
  }
  
  /**
   * Middleware de vérification du rôle tenant
   */
  static requireTenantRole(requiredRoles: string[]) {
    return (req: JWTRequest, res: Response, next: NextFunction) => {
      if (!req.user?.tenant_role) {
        return res.status(403).json({
          error: "TENANT_ROLE_REQUIRED",
          message: "Tenant role not found in JWT token."
        });
      }
      
      if (!requiredRoles.includes(req.user.tenant_role)) {
        return res.status(403).json({
          error: "INSUFFICIENT_TENANT_ROLE",
          message: `Required roles: ${requiredRoles.join(', ')}`,
          userRole: req.user.tenant_role
        });
      }
      
      next();
    };
  }
  
  /**
   * Middleware de validation tenant_id (cohérence JWT vs header/subdomain)
   */
  static validateTenantConsistency(req: JWTRequest, res: Response, next: NextFunction) {
    const jwtTenantId = req.user?.tenant_id;
    const headerTenantId = req.headers['x-tenant-id'] as string;
    const extractedTenantId = req.tenantId;
    
    // Si un tenant_id est dans le JWT, il doit correspondre à celui extrait
    if (jwtTenantId && extractedTenantId && jwtTenantId !== extractedTenantId) {
      return res.status(403).json({
        error: "TENANT_ID_MISMATCH",
        message: "Tenant ID in JWT does not match request tenant context.",
        jwtTenantId,
        requestTenantId: extractedTenantId
      });
    }
    
    // Utiliser le tenant_id du JWT comme source de vérité
    if (jwtTenantId) {
      req.tenantId = jwtTenantId;
    }
    
    next();
  }
}

// Middlewares exportés pour utilisation facile
export const jwtAuthenticate = JWTOIDCMiddleware.authenticate.bind(JWTOIDCMiddleware);
export const jwtOptionalAuth = JWTOIDCMiddleware.optionalAuthenticate.bind(JWTOIDCMiddleware);
export const requirePermissions = JWTOIDCMiddleware.requirePermissions.bind(JWTOIDCMiddleware);
export const requireTenantRole = JWTOIDCMiddleware.requireTenantRole.bind(JWTOIDCMiddleware);
export const validateTenantConsistency = JWTOIDCMiddleware.validateTenantConsistency.bind(JWTOIDCMiddleware);

// Helper pour générer un token de test (développement uniquement)
export function generateTestJWT(payload: Partial<JWTClaims>, secret: string = 'test-secret'): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Test JWT generation not allowed in production');
  }
  
  const claims: JWTClaims = {
    sub: payload.sub || 'test-user',
    iss: payload.iss || OIDC_CONFIG.issuer,
    aud: payload.aud || OIDC_CONFIG.audience,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 heures
    tenant_id: payload.tenant_id || 'test-tenant',
    tenant_role: payload.tenant_role || 'admin',
    permissions: payload.permissions || ['read', 'write', 'admin'],
    email: payload.email || 'test@smartgmao.com'
  };
  
  return jwt.sign(claims, secret, { algorithm: 'HS256' });
}